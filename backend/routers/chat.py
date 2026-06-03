"""Chat endpoint for RAG using NVIDIA embeddings and LLM.

This module defines a FastAPI router that exposes a POST /api/chat endpoint.
The endpoint authenticates the user, embeds the incoming message, performs a
vector similarity search against the user's stored document vectors, and
streams the LLM response back to the client.
"""

import os
import re
import logging
from dataclasses import dataclass
from typing import Any, Dict, Iterator, List, Optional
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, select
from starlette.concurrency import iterate_in_threadpool, run_in_threadpool

from database import SessionLocal
from models import DocumentVector
from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings, ChatNVIDIA
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from pydantic import BaseModel
from dependencies import resolve_user_id

router = APIRouter(prefix="/api", tags=["chat"])
logger = logging.getLogger(__name__)
DEBUG_LOGGING = os.getenv("DEBUG", "").lower() in ("1", "true", "yes")

VECTOR_TOP_K = 5
_CHUNK_COLUMNS = (
    DocumentVector.id,
    DocumentVector.document_id,
    DocumentVector.text_chunk,
)


@dataclass(frozen=True)
class RetrievedChunk:
    id: int
    document_id: str
    text_chunk: str


def _rows_to_chunks(rows) -> List[RetrievedChunk]:
    return [
        RetrievedChunk(id=row.id, document_id=row.document_id, text_chunk=row.text_chunk)
        for row in rows
    ]


def _vector_similarity_search(
    db: Session,
    user_id: str,
    query_vec: List[float],
    target_doc_ids: List[str],
    limit: int = VECTOR_TOP_K,
) -> List[RetrievedChunk]:
    """Filter by user_id first, then cosine distance (<=>), return top-k without loading embeddings."""
    stmt = (
        select(*_CHUNK_COLUMNS)
        .where(DocumentVector.user_id == user_id)
        .where(DocumentVector.embedding.isnot(None))
    )
    if target_doc_ids:
        stmt = stmt.where(DocumentVector.document_id.in_(target_doc_ids))
    stmt = stmt.order_by(DocumentVector.embedding.cosine_distance(query_vec)).limit(limit)
    return _rows_to_chunks(db.execute(stmt).all())


def _fetch_user_chunks(
    db: Session,
    user_id: str,
    target_doc_ids: List[str],
    *,
    order_by_id: bool = False,
    limit: Optional[int] = None,
) -> List[RetrievedChunk]:
    """Fetch id/document_id/text_chunk only — never loads the embedding column."""
    stmt = select(*_CHUNK_COLUMNS).where(DocumentVector.user_id == user_id)
    if target_doc_ids:
        stmt = stmt.where(DocumentVector.document_id.in_(target_doc_ids))
    if order_by_id:
        stmt = stmt.order_by(DocumentVector.id.asc())
    if limit is not None:
        stmt = stmt.limit(limit)
    return _rows_to_chunks(db.execute(stmt).all())


def _keyword_search_chunks(
    db: Session,
    user_id: str,
    target_doc_ids: List[str],
    keywords: List[str],
    per_keyword_limit: int = 150,
) -> List[RetrievedChunk]:
    """ILIKE keyword lookup scoped to user_id; returns text columns only."""
    candidate_chunks: Dict[int, RetrievedChunk] = {}
    for kw in keywords[:8]:
        kw_spaced = kw.replace("-", " ")
        kw_stmt = (
            select(*_CHUNK_COLUMNS)
            .where(DocumentVector.user_id == user_id)
            .where(
                or_(
                    DocumentVector.text_chunk.ilike(f"%{kw}%"),
                    DocumentVector.text_chunk.ilike(f"%{kw_spaced}%"),
                )
            )
        )
        if target_doc_ids:
            kw_stmt = kw_stmt.where(DocumentVector.document_id.in_(target_doc_ids))
        kw_stmt = kw_stmt.limit(per_keyword_limit)
        for row in db.execute(kw_stmt).all():
            if row.id not in candidate_chunks:
                candidate_chunks[row.id] = RetrievedChunk(
                    id=row.id,
                    document_id=row.document_id,
                    text_chunk=row.text_chunk,
                )
    return list(candidate_chunks.values())

# Stop words excluded when extracting keywords from the user query
_STOP_WORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "of", "in", "on", "at",
    "to", "for", "with", "by", "from", "up", "about", "into", "through",
    "and", "or", "but", "which", "that", "this", "these", "those",
    "what", "who", "how", "when", "where", "why", "all", "any", "both",
    "each", "few", "more", "most", "other", "some", "such", "than",
    "too", "very", "just", "me", "my", "i", "we", "you", "he", "she", "it",
    "they", "them", "their", "our", "your", "its", "give", "list", "show",
    "find", "tell", "data", "file", "document", "branch", "atm",
    "region", "district", "city", "state", "area", "details", "info",
    "there", "total", "replied", "only", "rectify", "status", "question",
    "answer", "sheet", "page", "row", "column", "table", "database",
    "number", "count", "sum", "average", "please", "thank", "thanks",
    "hello", "hi", "hey", "correct", "wrong", "right", "error", "issue",
    "problem", "solve", "fix", "help", "display", "get", "say", "saying",
    "said", "ask", "asked", "asking", "query", "search", "retrieve",
    "result", "results", "report"
}

_GENERIC_WORDS = {
    "working", "not", "status", "active", "inactive", "online", "offline",
    "yes", "no", "deposits", "advances", "business", "branches", "atm",
    "atms", "highest", "lowest", "best", "worst", "maximum", "minimum",
    "sum", "average", "total", "count", "number", "many"
}

def normalize_term(text: str) -> str:
    text = text.lower()
    text = text.replace("non-working", "not-working")
    text = text.replace("non working", "not-working")
    text = text.replace("not working", "not-working")
    text = text.replace("broken", "not-working")
    text = text.replace("down", "not-working")
    text = text.replace("failure", "not-working")
    return text

def _extract_keywords(message: str) -> List[str]:
    words = re.findall(r"[a-zA-Z0-9_-]+", message.lower())
    return [w for w in words if len(w) >= 3 and w not in _STOP_WORDS]

# ── Query intent detection ───────────────────────────────────────────────────
_COUNT_PHRASES = [
    "how many", "total number", "count of", "number of", "how much",
    "what is the count", "give me the count", "tell me the count",
]
_LIST_PHRASES = [
    "list", "show", "which", "give me all", "display", "what are",
    "enumerate", "name all", "all the", "details of",
]

def _detect_intent(message: str) -> str:
    """Returns 'count', 'list', or 'general'."""
    msg_lower = message.lower()
    for phrase in _COUNT_PHRASES:
        if phrase in msg_lower:
            return "count"
    for phrase in _LIST_PHRASES:
        if phrase in msg_lower:
            return "list"
    return "general"

_DOC_HEADERS = {}

def get_headers_for_doc(db: Session, document_id: str) -> list:
    if document_id in _DOC_HEADERS:
        return _DOC_HEADERS[document_id]
        
    stmt = (
        select(DocumentVector.text_chunk)
        .where(DocumentVector.document_id == document_id)
        .order_by(DocumentVector.id.asc())
        .limit(1)
    )
    text_chunk = db.execute(stmt).scalar_one_or_none()
    if text_chunk:
        lines = text_chunk.strip().split("\n")
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("|") and "---" not in stripped:
                headers = [c.strip() for c in stripped.split("|")[1:-1]]
                _DOC_HEADERS[document_id] = headers
                return headers
    return []

def reformat_markdown_table(db: Session, text_chunk: str, document_id: str, keywords: List[str] = None, filter_by_keywords: bool = True) -> str:
    lines = text_chunk.strip().split("\n")
    if not lines:
        return text_chunk
    
    header_line = None
    data_lines = []
    sheet_label = ""
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("[Sheet:") or stripped.startswith("[Document Table]"):
            sheet_label = stripped
        elif stripped.startswith("|"):
            if "---" in stripped:
                continue
            if header_line is None and ("BANKATMID" in stripped or "Region" in stripped or "Deposits" in stripped):
                header_line = stripped
            else:
                data_lines.append(stripped)
                
    headers = []
    if header_line:
        headers = [c.strip() for c in header_line.split("|")[1:-1]]
    else:
        headers = get_headers_for_doc(db, document_id)
        data_lines = [l.strip() for l in lines if l.strip().startswith("|") and "---" not in l.strip()]
        
    if not headers or not data_lines:
        return text_chunk
        
    entity_keywords = []
    if filter_by_keywords and keywords:
        entity_keywords = [kw for kw in keywords if kw not in _GENERIC_WORDS]
        
    formatted_rows = []
    for line in data_lines:
        if filter_by_keywords and entity_keywords:
            line_lower = line.lower()
            if not any(ekw in line_lower for ekw in entity_keywords):
                continue
                
        values = [v.strip() for v in line.split("|")[1:-1]]
        pair_strings = []
        for i in range(min(len(headers), len(values))):
            col = headers[i]
            val = values[i]
            if val and val.lower() != "nan" and val.lower() != "none":
                pair_strings.append(f"{col}: {val}")
        if pair_strings:
            formatted_rows.append(" | ".join(pair_strings))
            
    if formatted_rows:
        prefix = f"{sheet_label}\n" if sheet_label else ""
        return prefix + "\n".join(formatted_rows)
        
    return ""

class ChatRequest(BaseModel):
    message: str
    # Optional list of document IDs or a single document ID to scope the search.
    # If omitted, all vectors for the user are searched.
    document_ids: Optional[List[str]] = None
    document_id: Optional[str] = None
    # Conversation history for follow-up question support.
    # Each entry is {"role": "user"|"assistant", "content": str}
    history: Optional[List[dict]] = None

def _execute_chat(payload: ChatRequest, request: Request) -> Dict[str, Any]:
    """Blocking RAG pipeline: auth, embed, retrieve, and build LLM messages."""
    db = SessionLocal()
    try:
        current_user_id = resolve_user_id(request, db)

        # Build an effective query by merging recent user messages with the current one.
        # This lets retrieval and keyword extraction understand follow-up questions.
        history_user_msgs = []
        if payload.history:
            for h in payload.history[-4:]:   # last 4 turns
                if isinstance(h, dict) and h.get("role") == "user":
                    history_user_msgs.append(h.get("content", ""))
        effective_message = " ".join(history_user_msgs + [payload.message]).strip()
        if DEBUG_LOGGING:
            logger.debug("Chat retrieval started (message length=%d)", len(effective_message))

        # Extract keywords and entity_keywords early — needed for row filtering in both paths
        normalized_message = normalize_term(effective_message)
        keywords = _extract_keywords(normalized_message)
        # Entity keywords are highly specific terms (exclude generic words like "atm", "working")
        entity_keywords = [
            w for w in keywords if w not in _GENERIC_WORDS and not w.isdigit()
        ]

        # Embed the effective message (richer context for retrieval)
        embedder = NVIDIAEmbeddings(
            model="nvidia/nv-embed-v1",
            nvidia_api_key=os.getenv("NVIDIA_API_KEY"),
        )
        query_vec = embedder.embed_query(effective_message)

        # Merge document_ids and document_id into target list
        target_doc_ids = []
        if payload.document_ids:
            target_doc_ids.extend(payload.document_ids)
        if payload.document_id:
            target_doc_ids.append(payload.document_id)

        # Count total vectors for these documents (no row hydration)
        count_stmt = (
            select(func.count())
            .select_from(DocumentVector)
            .where(DocumentVector.user_id == current_user_id)
        )
        if target_doc_ids:
            count_stmt = count_stmt.where(DocumentVector.document_id.in_(target_doc_ids))
        total_chunks = db.execute(count_stmt).scalar_one()

        # Changed threshold: Only use full context if the file is very small (< 50 chunks).
        # This prevents the 131k token limit error for wide/long spreadsheets.
        is_full_context = total_chunks <= 50

        if is_full_context:
            # ── Full context: retrieve ALL chunks in original sequence order ─────
            results = _fetch_user_chunks(
                db,
                current_user_id,
                target_doc_ids,
                order_by_id=True,
            )
            logger.info("Full context retrieval: %d chunks", len(results))

        else:
            # ── Hybrid retrieval for documents > 50 chunks ───────────
            # Step 1: user_id filter → cosine distance (<=>) → top 5 only
            sim_results = _vector_similarity_search(
                db,
                current_user_id,
                query_vec,
                target_doc_ids,
                limit=VECTOR_TOP_K,
            )

            # Step 2: Keyword ILIKE filter — finds chunks that literally contain key terms
            search_keywords = entity_keywords if entity_keywords else keywords
            kw_candidates = _keyword_search_chunks(
                db,
                current_user_id,
                target_doc_ids,
                search_keywords,
            )

            # Score each chunk by the count of keywords it contains
            scored_chunks = []
            for r in kw_candidates:
                score = 0
                chunk_text_lower = r.text_chunk.lower()
                for kw in search_keywords:
                    if kw in chunk_text_lower:
                        score += 1
                scored_chunks.append((score, r))

            scored_chunks.sort(key=lambda x: x[0], reverse=True)
            kw_results = [r for score, r in scored_chunks]

            # Merge & deduplicate (cosine results first, keyword results appended)
            seen_ids: set = set()
            merged: List[RetrievedChunk] = []
            for r in sim_results + kw_results:
                if r.id not in seen_ids:
                    seen_ids.add(r.id)
                    merged.append(r)

            results = merged[:250]
            logger.info(
                "Hybrid retrieval: %d cosine (top %d) + %d keyword → %d unique (cap 250)",
                len(sim_results),
                VECTOR_TOP_K,
                len(kw_results),
                len(results),
            )

        # ── Build system prompt ──────────────────────────────────────────────
        if results:
            if is_full_context:
                # Merge chunks from the same document sequentially
                context_parts = []
                current_doc_id = None
                current_doc_chunks: List[str] = []
                for r in results:
                    if current_doc_id is None:
                        current_doc_id = r.document_id
                    if r.document_id != current_doc_id:
                        context_parts.append("\n".join(current_doc_chunks))
                        current_doc_chunks = []
                        current_doc_id = r.document_id
                    current_doc_chunks.append(r.text_chunk)
                if current_doc_chunks:
                    context_parts.append("\n".join(current_doc_chunks))

                if entity_keywords:
                    # Apply the same row-level filtering as hybrid path when we have specific entities
                    required_keywords = entity_keywords
                    min_score = len(required_keywords)
                    grouped_by_doc: dict = {}
                    for r in results:
                        headers = get_headers_for_doc(db, r.document_id)
                        lines = r.text_chunk.strip().split("\n")
                        data_lines = [l.strip() for l in lines if l.strip().startswith("|") and "---" not in l.strip()]
                        for line in data_lines:
                            line_lower_norm = normalize_term(line)
                            score = 0
                            for kw in required_keywords:
                                kw_norm = normalize_term(kw)
                                if kw_norm in line_lower_norm or kw_norm.replace("-", " ") in line_lower_norm:
                                    score += 1
                            if score >= min_score:
                                doc_id = r.document_id
                                if doc_id not in grouped_by_doc:
                                    grouped_by_doc[doc_id] = {"headers": headers, "lines": []}
                                filtered_values = [v.strip() for v in line.split("|")[1:-1]]
                                grouped_by_doc[doc_id]["lines"].append(line)

                    if grouped_by_doc:
                        table_parts = []
                        essential_cols = ["BANKATMID", "REGION_CODE", "REGION_NAME", "BRANCH_NUM", "LOCATION", "WORKING or NOT", "STATUS", "CONNECTIVITY"]
                        for doc_id, data in grouped_by_doc.items():
                            hdrs = data["headers"]
                            raw_lines = data["lines"]
                            filtered_h = []
                            filtered_rows = []
                            for raw_line in raw_lines:
                                vals = [v.strip() for v in raw_line.split("|")[1:-1]]
                                fh, fv = [], []
                                for col, val in zip(hdrs, vals):
                                    col_upper = col.upper()
                                    is_ess = (
                                        col_upper in [ec.upper() for ec in essential_cols] or
                                        any(t in col_upper for t in ["STATUS", "WORKING", "ERROR", "REASON", "FAILURE", "CONNECTIVITY"])
                                    )
                                    if is_ess:
                                        fh.append(col)
                                        fv.append(val)
                                if not filtered_h:
                                    filtered_h = fh
                                filtered_rows.append("| " + " | ".join(fv) + " |")
                            if filtered_h:
                                header_line = "| " + " | ".join(filtered_h) + " |"
                                sep_line = "| " + " | ".join("---" for _ in filtered_h) + " |"
                                table_parts.append(header_line + "\n" + sep_line + "\n" + "\n".join(filtered_rows))
                        context = "\n\n=== NEXT TABLE ===\n\n".join(table_parts)
                        is_full_context = False  # treat as filtered so grouped_by_doc is used below
                    else:
                        context = "No exact data found matching the requested entities."
                else:
                    # No entity keywords — send full context to LLM
                    formatted_parts = []
                    for part in context_parts:
                        formatted_parts.append(reformat_markdown_table(db, part, results[0].document_id, filter_by_keywords=False))
                    context = "\n\n=== NEXT DOCUMENT ===\n\n".join(formatted_parts)
            else:
                # Hybrid chunks are non-contiguous — apply score-based row filtering
                all_candidate_lines = []
                grouped_by_doc = {}  # initialise here so it is always defined
                
                # We strictly require a row to match ALL entity keywords to be counted
                required_keywords = entity_keywords if entity_keywords else keywords
                min_acceptable_score = len(required_keywords) if required_keywords else 1
                
                for r in results:
                    headers = get_headers_for_doc(db, r.document_id)
                    lines = r.text_chunk.strip().split("\n")
                    data_lines = [l.strip() for l in lines if l.strip().startswith("|") and "---" not in l.strip()]
                    
                    for line in data_lines:
                        line_lower_norm = normalize_term(line)
                        score = 0
                        for kw in required_keywords:
                            kw_norm = normalize_term(kw)
                            if kw_norm == "working":
                                if "working or not: working" in line_lower_norm or ("working" in line_lower_norm and "not-working" not in line_lower_norm):
                                    score += 1
                            else:
                                if kw_norm in line_lower_norm or kw_norm.replace("-", " ") in line_lower_norm or kw_norm.replace("-", "") in line_lower_norm:
                                    score += 1
                        if score >= min_acceptable_score:
                            all_candidate_lines.append((score, line, headers, r.document_id))

                if not all_candidate_lines:
                    # Fallback if no keywords matched perfectly
                    if entity_keywords:
                        context = "No exact data found matching the requested entities."
                    else:
                        context = "\n---\n".join([r.text_chunk for r in results[:10]]) # limit to 10 chunks to avoid overflow when it's just random
                else:
                    essential_cols = ["BANKATMID", "REGION_CODE", "REGION_NAME", "BRANCH_NUM", "LOCATION", "WORKING or NOT", "STATUS", "CONNECTIVITY"]
                    
                    grouped_by_doc = {}
                    for score, line, headers, doc_id in all_candidate_lines:
                        values = [v.strip() for v in line.split("|")[1:-1]]
                        
                        filtered_headers = []
                        filtered_values = []
                        for col, val in zip(headers, values):
                            col_upper = col.upper()
                            is_essential = (
                                col_upper in [ec.upper() for ec in essential_cols] or
                                any(term in col_upper for term in ["STATUS", "WORKING", "ERROR", "REASON", "FAILURE", "PROBLEM", "CONNECTIVITY", "REMARK", "COMMENT"])
                            )
                            if is_essential:
                                filtered_headers.append(col)
                                filtered_values.append(val)
                                
                        filtered_line = "| " + " | ".join(filtered_values) + " |"
                        
                        if doc_id not in grouped_by_doc:
                            grouped_by_doc[doc_id] = {"headers": filtered_headers, "lines": []}
                        grouped_by_doc[doc_id]["lines"].append(filtered_line)
                    
                    table_parts = []
                    for doc_id, data in grouped_by_doc.items():
                        headers = data["headers"]
                        lines = data["lines"]
                        if headers:
                            header_line = "| " + " | ".join(headers) + " |"
                            sep_line = "| " + " | ".join("---" for _ in headers) + " |"
                            table_parts.append(header_line + "\n" + sep_line + "\n" + "\n".join(lines))
                        else:
                            table_parts.append("\n".join(lines))
                            
                    context = "\n\n=== NEXT TABLE ===\n\n".join(table_parts)

            system_prompt = (
                "You are a precise document assistant. "
                "Answer the user's question ONLY using the context provided below. "
                "Do NOT use your general training knowledge. "
                "If the answer cannot be found in the context, respond with: "
                "'I could not find the answer in the uploaded document. "
                "Please make sure the document contains relevant information.'\n\n"
            )

            # ── Strict exact-match filtering — prevents wrong-region answers ──
            system_prompt += (
                "STRICT FILTERING RULES (follow these exactly):\n"
                "- If the user asks about a specific region, district, city, branch, "
                "zone, category, or any named entity, look at the corresponding column in the table. "
                "If the database categorizes a row under the requested entity (for example, the REGION_NAME "
                "column is 'NAGAPATTINAM'), you MUST include it, even if other columns (like LOCATION) "
                "mention another name (like PONDICHERRY or TANJORE).\n"
                "- Do NOT include data where the category column itself does not match the user's request.\n"
                "- Do NOT mention or reference data from unrelated regions. Show only what was explicitly asked for.\n"
                "- FOLLOW-UP QUESTIONS: If the user's latest question uses pronouns (e.g., 'these', 'those', 'them', 'it') "
                "or implies a continuation (e.g., 'what about...', 'list them'), you MUST resolve what they are referring to "
                "by looking at the previous conversation turns. Treat their current question as if it explicitly contained "
                "the entities mentioned in the previous turns.\n\n"
            )

            # ── Detect query intent and count rows in Python ─────────────────
            # Use payload.message (the CURRENT question only) for intent so that
            # follow-ups like "list these ATMs" are classified as "list" even
            # when conversation history contains "how many" (a count phrase).
            # effective_message is still used for retrieval/keyword extraction above.
            query_intent = _detect_intent(payload.message)

            # Count matched rows in backend (Python) — do NOT rely on LLM to count
            verified_row_count: Optional[int] = None
            if not is_full_context and grouped_by_doc:
                verified_row_count = sum(len(d["lines"]) for d in grouped_by_doc.values())
                logger.info(
                    "Python-verified row count: %d | intent: %s",
                    verified_row_count,
                    query_intent,
                )

            # ── If query is purely a count question, answer directly ──────────
            if query_intent == "count" and verified_row_count is not None:
                # Build a direct answer using the Python-counted rows
                # Detect region and status from the first matched row
                region_name = ""
                status_label = ""
                for doc_id, data in grouped_by_doc.items():
                    if data["lines"]:
                        first_vals = [v.strip() for v in data["lines"][0].split("|")[1:-1]]
                        hdrs = data["headers"]
                        for h, v in zip(hdrs, first_vals):
                            h_up = h.upper()
                            if "REGION_NAME" in h_up and v:
                                region_name = v
                            if ("WORKING" in h_up and "NOT" in h_up) and v:
                                status_label = v
                    break

                if region_name and status_label:
                    answer = f"There are **{verified_row_count}** ATMs with status **{status_label}** in the **{region_name}** region."
                elif region_name:
                    answer = f"There are **{verified_row_count}** matching ATMs in the **{region_name}** region."
                else:
                    answer = f"There are **{verified_row_count}** matching ATMs."

                return {"mode": "direct", "content": answer}

            # ── Extra rules for tabular / spreadsheet context ─────────────────
            if any("|" in r.text_chunk for r in results):
                if query_intent == "list":
                    system_prompt += (
                        "RULES FOR TABULAR DATA / SPREADSHEETS:\n"
                        "- Verify every row — do not overlook any.\n"
                        "- List EVERY matching row. Do NOT skip or truncate.\n"
                        "- CRITICAL: If the user uses a pronoun like 'these', 'them', or 'those', "
                        "you MUST infer the specific entity (region, status, branch) from the previous "
                        "conversation and STRICTLY filter the rows to only include those matching the exact same entity. "
                        "Do NOT list the entire table.\n"
                        "- OUTPUT FORMAT: Respond with a markdown table. Use these column headers:\n"
                        "  | ATM ID | Location | Status | Reason |\n"
                        "  | --- | --- | --- | --- |\n"
                        "  Fill in values from the context rows. After the table, write one sentence:\n"
                        f"  'There are {verified_row_count if verified_row_count else '?'} non-working ATMs in the region.'\n\n"
                    )
                else:
                    system_prompt += (
                        "RULES FOR TABULAR DATA / SPREADSHEETS:\n"
                        "- When asked for 'best', 'highest', 'maximum', 'lowest', "
                        "'minimum', or ranked values, trace the target column across "
                        "ALL rows from start to end.\n"
                        "- Compare numbers mathematically as float/decimal values.\n"
                        "- Ignore rows where the value is 'nan' or 'Grand Total'.\n"
                        "- Answer precisely based only on the context provided.\n\n"
                    )

            # ── Absolute character cap to prevent 131k token limit error ────
            # 1 token is ~4 chars. 131k tokens = ~524k chars. 
            # We cap the context string to 350,000 chars for extreme safety.
            MAX_CHARS = 350000
            if len(context) > MAX_CHARS:
                logger.warning(
                    "Context truncated from %d to %d characters",
                    len(context),
                    MAX_CHARS,
                )
                context = context[:MAX_CHARS] + "\n\n...[TRUNCATED DUE TO SIZE LIMITS]..."

            system_prompt += f"=== DOCUMENT CONTEXT ===\n{context}\n=== END CONTEXT ==="
            if DEBUG_LOGGING:
                logger.debug("System prompt length: %d characters", len(system_prompt))

        else:
            system_prompt = (
                "You are a document assistant. "
                "The user has not uploaded any documents yet, or their documents are "
                "still being processed. Politely inform the user that no document "
                "context is available. Tell them to upload a file and wait for it to "
                "show 'Ready' before asking questions. "
                "Do NOT answer from general knowledge."
            )

        # Build LLM messages: system prompt + conversation history + current message
        messages = [SystemMessage(content=system_prompt)]

        # Inject prior conversation turns so the LLM understands follow-ups
        if payload.history:
            for h in payload.history[-6:]:   # keep last 6 turns (3 exchanges)
                if not isinstance(h, dict):
                    continue
                role = h.get("role", "")
                content = h.get("content", "").strip()
                if not content:
                    continue
                if role == "user":
                    messages.append(HumanMessage(content=content))
                elif role == "assistant":
                    messages.append(AIMessage(content=content))

        messages.append(HumanMessage(content=payload.message))

        return {"mode": "stream", "messages": messages}

    except Exception:
        logger.exception("Chat pipeline failed")
        raise
    finally:
        db.close()


def _stream_llm_chunks(messages: List) -> Iterator[str]:
    llm = ChatNVIDIA(
        model="meta/llama-3.3-70b-instruct",
        nvidia_api_key=os.getenv("NVIDIA_API_KEY"),
        max_completion_tokens=4096,
        temperature=0.0,
    )
    try:
        for chunk in llm.stream(messages):
            text = chunk.content if hasattr(chunk, "content") else str(chunk)
            if text:
                yield text
    except Exception:
        logger.exception("LLM streaming failed")
        yield "Error: Unable to generate a response. Please try again."


@router.post("/chat")
async def chat_endpoint(payload: ChatRequest, request: Request):
    try:
        result = await run_in_threadpool(_execute_chat, payload, request)
    except Exception:
        logger.exception("Chat endpoint failed")
        raise HTTPException(status_code=500, detail="Internal server error") from None

    if result["mode"] == "direct":
        async def generate_direct():
            yield result["content"]

        return StreamingResponse(generate_direct(), media_type="text/plain; charset=utf-8")

    return StreamingResponse(
        iterate_in_threadpool(_stream_llm_chunks(result["messages"])),
        media_type="text/plain; charset=utf-8",
    )
