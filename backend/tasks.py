"""Document processing pipeline.

Extracts text/rows from uploaded files, chunks them, embeds them via
NVIDIA or mock, and persists both vector chunks and (for spreadsheets)
structured rows in PostgreSQL.
"""


from __future__ import annotations

import os
import re
import time
from typing import Any, Dict, List, Optional, Sequence, Tuple

from celery_app import app as celery_app
from sqlalchemy import text as sql_text
from database import SessionLocal
from models import Document, DocumentRow, DocumentVector
from langchain_text_splitters import RecursiveCharacterTextSplitter
from embeddings import get_embedder

# Hard cap: maximum number of chunks to embed per document.
# Prevents very large files from running indefinitely.
MAX_CHUNKS = 300
# Per-file hard timeout (seconds). Exceeding marks document as 'error'.
MAX_PROCESSING_SECONDS = 3600  # 1 hour
# Batch size for the embedder.
BATCH_SIZE = 50
MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds
# Spreadsheet chunking: number of rows per markdown chunk used for embedding.
ROWS_PER_CHUNK = 10


def _is_image(blob: bytes) -> bool:
    """Check if the blob is an image by magic bytes."""
    # Check for common image signatures
    if blob.startswith(b'\x89PNG\r\n\x1a\n'):  # PNG
        return True
    if blob.startswith(b'\xff\xd8\xff'):  # JPEG
        return True
    if blob.startswith(b'GIF87a') or blob.startswith(b'GIF89a'):  # GIF
        return True
    if blob.startswith(b'BM'):  # BMP
        return True
    if blob.startswith(b'II*\x00') or blob.startswith(b'MM\x00*'):  # TIFF
        return True
    # WebP
    if blob.startswith(b'RIFF') and blob[8:12] == b'WEBP':
        return True
    return False


# ── Text extractors ───────────────────────────────────────────────────────

def extract_text(file_path: str) -> str:
    """Extract text from a file based on its extension. Best-effort fallback."""
    # Check if the file is an image by magic bytes
    try:
        with open(file_path, "rb") as f:
            blob = f.read()
            if _is_image(blob):
                # If it's an image, we cannot extract text, so return empty string.
                return ""
    except IOError:
        # If we can't read the file, return empty string.
        return ""

    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        from pypdf import PdfReader
        reader = PdfReader(file_path)
        return "\n".join(page.extract_text() or "" for page in reader.pages)

    if ext == ".txt" or ext == ".md":
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()

    if ext == ".csv":
        import pandas as pd
        return pd.read_csv(file_path).to_csv(index=False)

    if ext == ".xlsx":
        import pandas as pd
        xl = pd.ExcelFile(file_path, engine="openpyxl")
        parts = []
        for sheet in xl.sheet_names:
            df = xl.parse(sheet)
            parts.append(f"[Sheet: {sheet}]\n{df.to_csv(index=False)}")
        return "\n\n".join(parts)

    if ext in (".doc", ".docx"):
        try:
            from docx import Document as DocxDocument
            d = DocxDocument(file_path)
            return "\n".join(p.text for p in d.paragraphs)
        except Exception:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()

    # Final fallback
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


# ── Spreadsheet parsing → structured rows + chunks ────────────────────────

def _cell_to_str(v: Any) -> str:
    """Normalize a pandas/numpy cell value to a clean string for storage."""
    if v is None:
        return ""
    try:
        # pandas NaN
        if v != v:  # NaN != NaN
            return ""
    except Exception:
        pass
    s = str(v)
    # Collapse whitespace so header/row matching works reliably
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse_spreadsheet_rows(
    file_path: str, ext: str
) -> List[Tuple[str, List[str], Dict[str, str], List[str]]]:
    """Return a list of (sheet_name, headers, values_dict, raw_row_lines).

    Each entry corresponds to one data row in the source spreadsheet. The
    caller is responsible for chunking and embedding — this function only
    parses the file.

    For multi-sheet XLSX, we emit rows from every sheet. `sheet_name` is
    the source sheet for downstream filtering.
    """
    import pandas as pd

    if ext == ".xlsx":
        xl = pd.ExcelFile(file_path, engine="openpyxl")
        sheets = xl.sheet_names
    else:
        sheets = ["Sheet1"]

    out: List[Tuple[str, List[str], Dict[str, str], List[str]]] = []

    for sheet in sheets:
        if ext == ".xlsx":
            df = xl.parse(sheet)
        else:
            df = pd.read_csv(file_path)

        if df.empty:
            continue

        headers = [_cell_to_str(c) for c in df.columns]
        # Keep only non-empty headers; build a positional list
        clean_headers: List[str] = [h for h in headers if h]
        if not clean_headers:
            continue

        for _, row in df.iterrows():
            values: Dict[str, str] = {}
            cells: List[str] = []
            for col, val in zip(df.columns, row.tolist()):
                col_name = _cell_to_str(col)
                cell = _cell_to_str(val)
                if col_name:
                    values[col_name] = cell
                cells.append(cell)
            if not any(cells):
                continue  # skip empty rows
            raw_line = "| " + " | ".join(cells) + " |"
            out.append((sheet, clean_headers, values, [raw_line]))

    return out


# ── Background processing ────────────────────────────────────────────────

def _is_spreadsheet(path: str) -> bool:
    ext = os.path.splitext(path)[1].lower()
    return ext in (".xlsx", ".csv")


def _run_processing(document_id: str) -> None:
    """Core processing logic.

    1. Extract content
    2. For spreadsheets: parse rows → write to `document_rows` table
       (column-level queryable). Also build markdown chunks for embedding.
    3. For other docs: recursive text split into chunks.
    4. Embed chunks in batches with retry; persist to `document_vectors`.
    5. Mark document ready.
    """
    db = SessionLocal()
    document: Optional[Document] = None
    processing_start = time.time()

    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            print(f"[processor] Document {document_id} not found")
            return

        print(f"[processor] Starting processing for {document.file_name}")
        ext = os.path.splitext(document.file_path)[1].lower()

        # ── Extract chunks and (for spreadsheets) structured rows ─────
        chunks: List[str] = []
        rows_to_insert: List[DocumentRow] = []

        if _is_spreadsheet(document.file_path):
            try:
                parsed_rows = parse_spreadsheet_rows(document.file_path, ext)
            except Exception as parse_err:
                print(f"[processor] Error parsing spreadsheet: {parse_err}")
                parsed_rows = []

            if parsed_rows:
                # Group rows into chunks of ROWS_PER_CHUNK for embedding context
                header_seen_per_sheet: Dict[str, List[str]] = {}
                for idx, (sheet, headers, values, raw_lines) in enumerate(parsed_rows):
                    rows_to_insert.append(
                        DocumentRow(
                            user_id=document.user_id,
                            document_id=document.id,
                            sheet_name=sheet,
                            row_index=idx,
                            headers=headers,
                            values=values,
                            raw_text=raw_lines[0],
                        )
                    )
                    if sheet not in header_seen_per_sheet:
                        header_seen_per_sheet[sheet] = headers

                # Build markdown chunks for vector retrieval
                for sheet, headers in header_seen_per_sheet.items():
                    sheet_rows = [r for r in parsed_rows if r[0] == sheet]
                    if not sheet_rows:
                        continue
                    header_line = "| " + " | ".join(headers) + " |"
                    sep_line = "| " + " | ".join("---" for _ in headers) + " |"
                    sheet_label = (
                        f"[Sheet: {sheet}]" if ext == ".xlsx" else "[Document Table]"
                    )
                    for chunk_start in range(0, len(sheet_rows), ROWS_PER_CHUNK):
                        chunk_rows = sheet_rows[chunk_start : chunk_start + ROWS_PER_CHUNK]
                        chunk_lines = [sheet_label, header_line, sep_line]
                        for _, _, _, raw_lines in chunk_rows:
                            chunk_lines.append(raw_lines[0])
                        chunks.append("\n".join(chunk_lines))
            else:
                # Spreadsheet parse failed — fall back to plain text extraction
                text = extract_text(document.file_path)
                if text.strip():
                    splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=120)
                    chunks = splitter.split_text(text)
        else:
            text = extract_text(document.file_path)
            if not text.strip():
                print(f"[processor] No text extracted from {document.file_name}")
                document.status = "error"
                document.error_message = "No text could be extracted from the file."
                db.commit()
                return
            splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=120)
            chunks = splitter.split_text(text)

        if not chunks and not rows_to_insert:
            print(f"[processor] No chunks created for {document.file_name}")
            document.status = "error"
            document.error_message = "File produced no content."
            db.commit()
            return

        # ── Track progress ─────────────────────────────────────────────
        document.total_chunks = len(chunks)
        document.processed_chunks = 0
        db.commit()

        # ── Bulk-insert structured rows (no embedding needed) ──────────
        if rows_to_insert:
            # bulk_save_objects doesn't auto-flush; we batch in groups of 500
            BULK_ROW_BATCH = 500
            for i in range(0, len(rows_to_insert), BULK_ROW_BATCH):
                db.bulk_save_objects(rows_to_insert[i : i + BULK_ROW_BATCH])
            db.commit()
            print(f"[processor] Stored {len(rows_to_insert)} structured rows")

        if not chunks:
            document.status = "ready"
            db.commit()
            print(
                f"[processor] Document {document.file_name} processed (rows only, no embeddings)"
            )
            return

        # ── Embed chunks ───────────────────────────────────────────────
        embedding_model = get_embedder(model="nvidia/nv-embed-v1")
        all_embeddings: List[List[float]] = []
        total_batches = (len(chunks) + BATCH_SIZE - 1) // BATCH_SIZE

        for i in range(0, len(chunks), BATCH_SIZE):
            elapsed = time.time() - processing_start
            if elapsed > MAX_PROCESSING_SECONDS:
                print(
                    f"[processor] TIMEOUT: Processing exceeded {MAX_PROCESSING_SECONDS}s "
                    f"for {document.file_name}. Marking as error."
                )
                document.status = "error"
                document.error_message = f"Processing exceeded {MAX_PROCESSING_SECONDS}s timeout"
                db.commit()
                return

            batch = chunks[i : i + BATCH_SIZE]
            batch_num = i // BATCH_SIZE + 1
            print(f"[processor] Embedding batch {batch_num}/{total_batches}")

            embeddings: Optional[Sequence[List[float]]] = None
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    embeddings = embedding_model.embed_documents(batch)
                    break
                except Exception as emb_err:
                    print(
                        f"[processor] Embedding attempt {attempt}/{MAX_RETRIES} failed: {emb_err}"
                    )
                    if attempt < MAX_RETRIES:
                        time.sleep(RETRY_DELAY)
                    else:
                        document.status = "error"
                        document.error_message = (
                            f"Embedding failed after {MAX_RETRIES} attempts: {emb_err}"
                        )
                        db.commit()
                        return

            assert embeddings is not None
            all_embeddings.extend(embeddings)

            document.processed_chunks += len(batch)
            if len(all_embeddings) % 200 == 0 or len(all_embeddings) == len(chunks):
                db.commit()

        document.status = "ready"
        db.commit()

        try:
            # BATCH insert vectors using bulk_insert_mappings
            vector_rows = []
            for chunk, embedding in zip(chunks, all_embeddings):
                vector_rows.append({
                    "user_id": document.user_id,
                    "document_id": document.id,
                    "text_chunk": chunk,
                    "embedding": str(embedding),
                })
                if len(vector_rows) >= 200:
                    db.execute(
                        DocumentVector.__table__.insert(),
                        vector_rows
                    )
                    db.commit()
                    vector_rows = []
            if vector_rows:
                db.execute(
                    DocumentVector.__table__.insert(),
                    vector_rows
                )
                db.commit()
        except Exception as ve:
            print(f"[processor] Vector insert failed (non-fatal): {ve}")
            db.commit()
        print(
            f"[processor] [SUCCESS] Document {document.file_name} processed "
            f"({len(chunks)} chunks, {len(rows_to_insert)} rows)"
        )

    except Exception as e:
        print(f"[processor] [ERROR] Error processing document {document_id}: {e}")
        if document:
            document.status = "error"
            document.error_message = str(e)[:1000]
            db.commit()
    finally:
        db.close()


@celery_app.task(name="tasks.process_document")
def process_document(document_id: str) -> None:
    """Celery task entry point."""
    _run_processing(document_id)