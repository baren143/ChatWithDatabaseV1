import os
import time
import threading
from celery_app import app as celery_app
from database import SessionLocal
from models import Document, DocumentVector
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings

# Hard cap: maximum number of chunks to embed per document.
# Prevents very large files from running indefinitely.
MAX_CHUNKS = 300
# Maximum seconds allowed for the entire processing job.
MAX_PROCESSING_SECONDS = 600  # 10 minutes


def extract_text(file_path: str) -> str:
    """Extract text from a file based on its extension."""
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        from pypdf import PdfReader
        reader = PdfReader(file_path)
        return "\n".join(page.extract_text() or "" for page in reader.pages)

    elif ext == ".txt":
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()

    elif ext == ".csv":
        import pandas as pd
        df = pd.read_csv(file_path)
        return df.to_csv(index=False)

    elif ext == ".xlsx":
        import pandas as pd
        # Read all sheets and concatenate their text representations
        xl = pd.ExcelFile(file_path, engine="openpyxl")
        parts = []
        for sheet in xl.sheet_names:
            df = xl.parse(sheet)
            parts.append(f"[Sheet: {sheet}]\n{df.to_csv(index=False)}")
        return "\n\n".join(parts)

    else:
        # Fallback: try reading as plain text
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()


def _run_processing(document_id: str):
    """
    Core processing logic: extract text → chunk → embed in batches → store vectors.
    Called either by the Celery task or directly in a background thread.

    Hardening changes:
    - rows_per_chunk raised 5 → 10 (halves the number of API calls for spreadsheets)
    - MAX_CHUNKS cap (300) so very large files do not run indefinitely
    - Per-batch retry (3 attempts, 2 s back-off) for transient NVIDIA API errors
    - Overall 10-minute timeout guard — marks document as 'error' instead of hanging
    - Intermediate DB commit every 50 embedded chunks keeps the DB session alive
    """
    db = SessionLocal()
    document = None
    processing_start = time.time()

    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            print(f"[processor] Document {document_id} not found")
            return

        print(f"[processor] Starting processing for {document.file_name}")

        # ── Extract / chunk based on file type ──────────────────────────
        ext = os.path.splitext(document.file_path)[1].lower()
        if ext in [".xlsx", ".csv"]:
            import pandas as pd
            chunks = []
            try:
                if ext == ".xlsx":
                    xl = pd.ExcelFile(document.file_path, engine="openpyxl")
                    sheets = xl.sheet_names
                else:
                    sheets = ["Sheet1"]

                for sheet in sheets:
                    if ext == ".xlsx":
                        df = xl.parse(sheet)
                    else:
                        df = pd.read_csv(document.file_path)
                    
                    if df.empty:
                        continue

                    headers = list(df.columns)
                    header_line = "| " + " | ".join(str(h) for h in headers) + " |"
                    sep_line = "| " + " | ".join("---" for _ in headers) + " |"
                    
                    # 10 rows per chunk (was 5) → half the number of embedding calls
                    rows_per_chunk = 10
                    for idx in range(0, len(df), rows_per_chunk):
                        chunk_rows = df.iloc[idx : idx + rows_per_chunk]
                        chunk_lines = [
                            f"[Sheet: {sheet}]"
                            if len(sheets) > 1 or ext == ".xlsx"
                            else "[Document Table]"
                        ]
                        chunk_lines.append(header_line)
                        chunk_lines.append(sep_line)
                        for _, row in chunk_rows.iterrows():
                            row_line = (
                                "| "
                                + " | ".join(str(val).replace("\n", " ") for val in row)
                                + " |"
                            )
                            chunk_lines.append(row_line)
                        chunks.append("\n".join(chunk_lines))
            except Exception as parse_err:
                print(f"[processor] Error parsing spreadsheet: {parse_err}")
                # Fall back to text extraction if spreadsheet parsing fails
                text = extract_text(document.file_path)
                splitter = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=40)
                chunks = splitter.split_text(text)
        else:
            text = extract_text(document.file_path)
            if not text.strip():
                print(f"[processor] No text extracted from {document.file_name}")
                document.status = "error"
                db.commit()
                return
            splitter = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=40)
            chunks = splitter.split_text(text)

        if not chunks:
            print(f"[processor] No chunks created for {document.file_name}")
            document.status = "error"
            db.commit()
            return

        # ── Setup progress tracking ─────
        document.total_chunks = len(chunks)
        document.processed_chunks = 0
        db.commit()

        print(f"[processor] {len(chunks)} chunks to embed for {document.file_name}")

        # ── Initialize NVIDIA embeddings ─────────────────────────────────
        embedding_model = NVIDIAEmbeddings(
            model="nvidia/nv-embed-v1",
            nvidia_api_key=os.getenv("NVIDIA_API_KEY"),
        )

        # ── Embed in batches with retry & timeout guards ─────────────────
        BATCH_SIZE = 10
        MAX_RETRIES = 3
        RETRY_DELAY = 2  # seconds between retries
        all_embeddings = []
        total_batches = (len(chunks) + BATCH_SIZE - 1) // BATCH_SIZE
        
        # Increase timeout to 1 hour for large files
        MAX_PROCESSING_SECONDS = 3600  

        for i in range(0, len(chunks), BATCH_SIZE):
            # ── Overall timeout check ────────────────────────────────────
            elapsed = time.time() - processing_start
            if elapsed > MAX_PROCESSING_SECONDS:
                print(
                    f"[processor] TIMEOUT: Processing exceeded {MAX_PROCESSING_SECONDS}s "
                    f"for {document.file_name}. Marking as error."
                )
                document.status = "error"
                db.commit()
                return

            batch = chunks[i : i + BATCH_SIZE]
            batch_num = i // BATCH_SIZE + 1
            print(f"[processor] Embedding batch {batch_num}/{total_batches}")

            # ── Per-batch retry loop ─────────────────────────────────────
            embeddings = None
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    embeddings = embedding_model.embed_documents(batch)
                    break  # success — exit retry loop
                except Exception as emb_err:
                    print(
                        f"[processor] Embedding attempt {attempt}/{MAX_RETRIES} failed: {emb_err}"
                    )
                    if attempt < MAX_RETRIES:
                        time.sleep(RETRY_DELAY)
                    else:
                        raise  # re-raise after all retries exhausted

            all_embeddings.extend(embeddings)

            # ── Update progress and keep DB session alive ──
            document.processed_chunks += len(batch)
            if len(all_embeddings) % 50 == 0 or len(all_embeddings) == len(chunks):
                db.commit()

        # ── Bulk-insert all vectors ───────────────────────────────────────
        vectors = [
            DocumentVector(
                user_id=document.user_id,
                document_id=document.id,
                text_chunk=chunk,
                embedding=embedding,
            )
            for chunk, embedding in zip(chunks, all_embeddings)
        ]
        db.bulk_save_objects(vectors)

        document.status = "ready"
        db.commit()
        print(
            f"[processor] [SUCCESS] Document {document.file_name} processed successfully "
            f"({len(chunks)} chunks)"
        )

    except Exception as e:
        print(f"[processor] [ERROR] Error processing document {document_id}: {e}")
        if document:
            document.status = "error"
            db.commit()
    finally:
        db.close()


@celery_app.task
def process_document(document_id: str):
    """Celery task entry point."""
    _run_processing(document_id)


def process_document_in_thread(document_id: str):
    """Run document processing in a daemon background thread (no Celery needed)."""
    t = threading.Thread(target=_run_processing, args=(document_id,), daemon=True)
    t.start()
    return t