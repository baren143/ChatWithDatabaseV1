"""Chat endpoint — Schema-aware, LLM-driven RAG over user documents.

Pipeline:
  1. Authenticate user (JWT).
  2. Identify in-scope documents (spreadsheets vs non-spreadsheets).
  3. For spreadsheets:
       a. Discover schema: fetch column headers + sample rows from document_rows.
       b. Ask the LLM to produce a structured filter plan (JSON) based on the
          user's question and the actual schema — no hardcoded column names.
       c. Apply the filter plan in Python against all rows.
       d. For COUNT queries: count DISTINCT values of the entity column (e.g.
          distinct ATM IDs) so duplicate time-series rows are not double-counted.
       e. Return a direct count or pass matched rows to the LLM for a
          conversational answer.
  4. Fallback to vector + keyword hybrid retrieval for non-spreadsheet docs or
     when the LLM filter plan yields no usable result.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_nvidia_ai_endpoints import ChatNVIDIA, NVIDIAEmbeddings
from pydantic import BaseModel
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session
from starlette.concurrency import iterate_in_threadpool, run_in_threadpool

from database import SessionLocal
from embeddings import get_embedder
from dependencies import resolve_user_id_from_request
from models import Document, DocumentRow, DocumentVector

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["chat"])

# Rate limiter for chat endpoint
chat_limiter = Limiter(key_func=get_remote_address)

VECTOR_TOP_K = 8
MAX_CONTEXT_CHARS = 350_000
MAX_KEYWORD_HITS = 250
MAX_LIST_ROWS = 200
SAMPLE_ROWS_FOR_SCHEMA = 5

# ── LLM factory ─────────────────────────────────────────────────────────────

def _llm(max_tokens: int = 4096, temperature: float = 0.0) -> ChatNVIDIA:
    return ChatNVIDIA(
        model="meta/llama-3.3-70b-instruct",
        
        max_completion_tokens=max_tokens,
        temperature=temperature,
    )


# ── Schema discovery ─────────────────────────────────────────────────────────

def _get_schema_sample(
    db: Session, user_id: str, doc_ids: Sequence[str]
) -> Dict[str, Any]:
    """Return column headers, sample rows, and total row count for the given docs."""
    if not doc_ids:
        return {"columns": [], "sample_rows": [], "total_rows": 0}

    stmt = (
        select(DocumentRow)
        .where(DocumentRow.user_id == user_id)
        .where(DocumentRow.document_id.in_(doc_ids))
        .order_by(DocumentRow.document_id, DocumentRow.row_index)
        .limit(SAMPLE_ROWS_FOR_SCHEMA)
    )
    sample = list(db.execute(stmt).scalars().all())

    # total count
    from sqlalchemy import func as sqlfunc
    total = db.execute(
        select(sqlfunc.count()).select_from(DocumentRow)
        .where(DocumentRow.user_id == user_id)
        .where(DocumentRow.document_id.in_(doc_ids))
    ).scalar() or 0

    columns: List[str] = []
    sample_rows: List[Dict] = []
    for row in sample:
        vals = row.values or {}
        if not columns and row.headers:
            columns = list(row.headers)
        elif not columns:
            columns = list(vals.keys())
        sample_rows.append(vals)

    return {"columns": columns, "sample_rows": sample_rows, "total_rows": total}


# ── LLM filter-plan generation ───────────────────────────────────────────────

_FILTER_PLAN_SYSTEM = """\
You are a data-query planner. The user has uploaded a spreadsheet and asked a question.
Your job is to analyse the spreadsheet's columns and sample rows and produce a structured
filter plan so that Python code can answer the question accurately.

Output ONLY a single valid JSON object — no explanation, no markdown fences.

JSON schema:
{
  "filters": [
    {"column": "<exact column name from schema>", "operator": "<eq|ne|contains|not_contains|gt|lt|gte|lte>", "value": "<value matching case in data>"}
  ],
  "entity_column": "<column whose DISTINCT values to count, or null to count rows>",
  "intent": "<count|list|aggregate|general>",
  "aggregate": {"function": "<sum|avg|max|min>", "column": "<col>"} // include only when needed
}

Rules:
- Use EXACT column names from the schema.
- Match value CASE to the sample data (e.g. if data has 'NOT-WORKING', use 'NOT-WORKING').
- For "how many ATMs/branches/records..." → set entity_column to the primary-ID column
  (e.g. 'BANKATMID', 'ATM ID', 'Branch Code', 'ID', etc.) so duplicates are not counted.
  If there is no ID column, set entity_column to null (count rows).
- For filtering by region/city/area → use the region/location column and eq operator.
- For "not working / broken / down / out of service" → find the column whose values
  indicate working status (like 'WORKING or NOT', 'Status', 'Active') and filter appropriately.
- If the question is conversational with no clear filter, return {"filters":[], "intent":"general"}.
- Do NOT invent column names. Only use what is in the schema.

FOLLOW-UP QUESTIONS (CRITICAL):
- If the "Previous user questions" section contains a question, the CURRENT question may be a follow-up.
- When the user asks something like "Nagapattinam?" or "Mumbai?" after a previous question about
  "non-working ATMs in Pune", interpret it as: "How many non-working ATMs in Nagapattinam?" or
  "How many non-working ATMs in Mumbai?" — preserve the original intent (working status filter)
  and apply it to the new location.
- Short follow-ups like single city names, region names, or partial phrases should ALWAYS be
  interpreted in the context of the previous question's intent.
- Only return {"filters":[], "intent":"general"} if the current question is completely
  unrelated to the previous question AND has no clear filter on its own.
"""


def _llm_generate_filter_plan(
    schema_info: Dict[str, Any],
    user_question: str,
    history: Optional[List[dict]],
) -> Dict[str, Any]:
    """Ask the LLM to produce a filter plan JSON for the given question + schema."""
    columns = schema_info.get("columns", [])
    sample_rows = schema_info.get("sample_rows", [])
    total_rows = schema_info.get("total_rows", 0)

    if not columns:
        return {}

    sample_str = json.dumps(sample_rows[:3], indent=2, ensure_ascii=False)
    schema_block = (
        f"COLUMNS: {json.dumps(columns)}\n"
        f"TOTAL ROWS IN DATASET: {total_rows}\n"
        f"SAMPLE ROWS (first {len(sample_rows[:3])}):\n{sample_str}"
    )

    # Include last 2 user turns for follow-up context
    context_turns = ""
    if history:
        prev = [h for h in history[-4:] if isinstance(h, dict) and h.get("role") == "user"]
        if prev:
            context_turns = "\nPrevious user questions:\n" + "\n".join(
                f"- {h['content']}" for h in prev[-2:]
            )

    user_content = (
        f"{schema_block}\n"
        f"{context_turns}\n"
        f"Current question: {user_question}\n\n"
        "Produce the filter plan JSON now."
    )

    try:
        model = _llm(max_tokens=512, temperature=0.0)
        resp = model.invoke([
            SystemMessage(content=_FILTER_PLAN_SYSTEM),
            HumanMessage(content=user_content),
        ])
        raw = resp.content if hasattr(resp, "content") else str(resp)
        logger.info("Filter plan raw response: %s", raw[:500])

        # Extract JSON block (handles ```json ... ``` wrappers)
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception:
        logger.exception("Filter plan LLM call failed")

    return {}


# ── Filter plan execution ─────────────────────────────────────────────────────

def _cell_matches(cell_val: Any, operator: str, filter_val: str) -> bool:
    """Apply a single filter to one cell value."""
    if cell_val is None:
        cell_str = ""
    else:
        cell_str = str(cell_val)

    cv_lower = cell_str.lower().strip()
    fv_lower = filter_val.lower().strip()

    if operator == "eq":
        return cv_lower == fv_lower
    if operator == "ne":
        return cv_lower != fv_lower
    if operator == "contains":
        return fv_lower in cv_lower
    if operator == "not_contains":
        return fv_lower not in cv_lower
    if operator in ("gt", "lt", "gte", "lte"):
        try:
            cv_num = float(cell_str.replace(",", ""))
            fv_num = float(filter_val.replace(",", ""))
            if operator == "gt":
                return cv_num > fv_num
            if operator == "lt":
                return cv_num < fv_num
            if operator == "gte":
                return cv_num >= fv_num
            if operator == "lte":
                return cv_num <= fv_num
        except ValueError:
            return False
    return False


def _row_matches_plan(row_values: Dict[str, Any], filters: List[Dict]) -> bool:
    """Return True iff a row matches ALL filters in the plan."""
    for f in filters:
        col = f.get("column", "")
        operator = f.get("operator", "eq")
        value = str(f.get("value", ""))

        # Case-insensitive column lookup
        matched_key = None
        for k in row_values:
            if k.lower().strip() == col.lower().strip():
                matched_key = k
                break

        if matched_key is None:
            # Column not found in this row — treat as non-match
            return False

        if not _cell_matches(row_values[matched_key], operator, value):
            return False

    return True


def _apply_filter_plan(
    db: Session,
    user_id: str,
    doc_ids: Sequence[str],
    plan: Dict[str, Any],
) -> Dict[str, Any]:
    """Execute the filter plan against all document rows and return results."""
    filters: List[Dict] = plan.get("filters", [])
    entity_col: Optional[str] = plan.get("entity_column")
    intent: str = plan.get("intent", "general")

    # Fetch all rows for target docs
    stmt = (
        select(DocumentRow)
        .where(DocumentRow.user_id == user_id)
        .where(DocumentRow.document_id.in_(doc_ids))
        .order_by(DocumentRow.document_id, DocumentRow.row_index)
    )
    all_rows = list(db.execute(stmt).scalars().all())

    # Apply filters
    matched_rows = [
        r for r in all_rows
        if _row_matches_plan(r.values or {}, filters)
    ]

    # Count distinct entity IDs when entity_column is specified
    # This prevents counting duplicate time-series rows for the same entity
    if intent == "count" and entity_col:
        seen: set = set()
        distinct_entities: List[Dict] = []
        for r in matched_rows:
            vals = r.values or {}
            # Case-insensitive entity column lookup
            eid = None
            for k, v in vals.items():
                if k.lower().strip() == entity_col.lower().strip():
                    eid = str(v).strip()
                    break
            if eid and eid not in seen:
                seen.add(eid)
                distinct_entities.append(vals)

        return {
            "count": len(seen),
            "rows": distinct_entities[:MAX_LIST_ROWS],
            "intent": intent,
            "plan": plan,
            "distinct": True,
            "entity_col": entity_col,
        }

    return {
        "count": len(matched_rows),
        "rows": [r.values for r in matched_rows[:MAX_LIST_ROWS]],
        "intent": intent,
        "plan": plan,
        "distinct": False,
        "entity_col": entity_col,
    }


# ── Answer formatting ─────────────────────────────────────────────────────────

def _describe_filters(plan: Dict) -> str:
    """Build a human-readable description of the applied filters."""
    filters = plan.get("filters", [])
    if not filters:
        return ""
    parts = []
    for f in filters:
        op = f.get("operator", "eq")
        col = f.get("column", "")
        val = f.get("value", "")
        if op == "eq":
            parts.append(f"{col} = {val}")
        elif op == "ne":
            parts.append(f"{col} ≠ {val}")
        elif op == "contains":
            parts.append(f"{col} contains '{val}'")
        elif op == "not_contains":
            parts.append(f"{col} does not contain '{val}'")
        else:
            parts.append(f"{col} {op} {val}")
    return " AND ".join(parts)


def _format_plan_answer(
    result: Dict[str, Any],
    user_question: str,
    payload: Any,
    history_messages: List,
) -> Dict[str, Any]:
    """Format the filter plan result into a streamed or direct response."""
    intent = result.get("intent", "general")
    count = result.get("count", 0)
    rows = result.get("rows", [])
    plan = result.get("plan", {})
    is_distinct = result.get("distinct", False)
    entity_col = result.get("entity_col")

    filter_desc = _describe_filters(plan)

    # ── COUNT intent: return direct answer ──────────────────────────────────
    if intent == "count":
        distinct_note = (
            f" (distinct **{entity_col}**)" if is_distinct and entity_col else ""
        )
        filter_note = f" matching _{filter_desc}_" if filter_desc else ""
        body = (
            f"There are **{count}** records{distinct_note}{filter_note}."
        )
        return {"mode": "direct", "content": body}

    # ── LIST intent: build markdown table and ask LLM to narrate ────────────
    if intent == "list" and rows:
        headers = list(rows[0].keys()) if rows else []
        table_lines = ["| " + " | ".join(headers) + " |",
                       "| " + " | ".join("---" for _ in headers) + " |"]
        for row in rows[:50]:
            table_lines.append("| " + " | ".join(str(row.get(h, "")) for h in headers) + " |")
        table_md = "\n".join(table_lines)

        sys_prompt = (
            "You are a precise data assistant. The user asked a question about their uploaded data. "
            "The matching rows from the dataset are shown below as a markdown table. "
            "You must answer using ONLY the provided context. If the answer is not present, decline to answer. "
            "Present these results clearly and helpfully. "
            "Do NOT invent any data not in the table.\n\n"
            f"=== MATCHING DATA (total {count} records) ===\n{table_md}\n=== END ==="
        )
        messages = [SystemMessage(content=sys_prompt)] + history_messages + [HumanMessage(content=user_question)]
        return {"mode": "stream", "messages": messages}

    # ── AGGREGATE or GENERAL: send matched rows to LLM ──────────────────────
    if rows:
        headers = list(rows[0].keys()) if rows else []
        table_lines = ["| " + " | ".join(headers) + " |",
                       "| " + " | ".join("---" for _ in headers) + " |"]
        for row in rows[:100]:
            table_lines.append("| " + " | ".join(str(row.get(h, "")) for h in headers) + " |")
        table_md = "\n".join(table_lines)

        sys_prompt = (
            "You are a precise data assistant. Answer the user's question ONLY using "
            "the data table below. Do NOT use any general knowledge. "
            "You must answer using ONLY the provided context. If the answer is not present, decline to answer.\n\n"
            f"=== DATA ({count} matching records) ===\n{table_md}\n=== END DATA ==="
        )
        messages = [SystemMessage(content=sys_prompt)] + history_messages + [HumanMessage(content=user_question)]
        return {"mode": "stream", "messages": messages}

    # No rows matched
    filter_note = f" with filter: {filter_desc}" if filter_desc else ""
    return {
        "mode": "direct",
        "content": f"No records found{filter_note}. Try rephrasing or check your data.",
    }


# ── Vector / keyword fallback ─────────────────────────────────────────────────

def _vector_search(
    db: Session,
    user_id: str,
    query_vec: Sequence[float],
    doc_ids: Sequence[str],
    limit: int,
) -> List[Any]:
    from sqlalchemy import select as sa_select
    stmt = (
        sa_select(DocumentVector.id, DocumentVector.document_id, DocumentVector.text_chunk)
        .where(DocumentVector.user_id == user_id)
        .where(DocumentVector.embedding.isnot(None))
    )
    if doc_ids:
        stmt = stmt.where(DocumentVector.document_id.in_(doc_ids))
    stmt = stmt.order_by(DocumentVector.embedding.cosine_distance(list(query_vec))).limit(limit)
    return list(db.execute(stmt).all())


def _keyword_search(
    db: Session,
    user_id: str,
    doc_ids: Sequence[str],
    keywords: Sequence[str],
    per_kw_limit: int = 150,
) -> List[Any]:
    if not keywords:
        return []
    found: Dict[int, Any] = {}
    for kw in list(keywords)[:8]:
        stmt = (
            select(DocumentVector.id, DocumentVector.document_id, DocumentVector.text_chunk)
            .where(DocumentVector.user_id == user_id)
            .where(DocumentVector.text_chunk.ilike(f"%{kw}%"))
        )
        if doc_ids:
            stmt = stmt.where(DocumentVector.document_id.in_(doc_ids))
        stmt = stmt.limit(per_kw_limit)
        for r in db.execute(stmt).all():
            if r.id not in found:
                found[r.id] = r
    return list(found.values())


def _build_vector_context(chunks: Sequence[Any]) -> str:
    parts = [f"[doc={c.document_id}]\n{c.text_chunk}" for c in chunks]
    ctx = "\n\n---\n\n".join(parts)
    if len(ctx) > MAX_CONTEXT_CHARS:
        ctx = ctx[:MAX_CONTEXT_CHARS] + "\n\n...[TRUNCATED]..."
    return ctx


# ── Request model ─────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    document_ids: Optional[List[str]] = None
    document_id: Optional[str] = None
    history: Optional[List[dict]] = None


# ── History helpers ───────────────────────────────────────────────────────────

def _build_history_messages(payload: ChatRequest) -> List:
    out: List = []
    if not payload.history:
        return out
    for h in payload.history[-6:]:
        if not isinstance(h, dict):
            continue
        role = h.get("role", "")
        content = (h.get("content") or "").strip()
        if not content:
            continue
        if role == "user":
            out.append(HumanMessage(content=content))
        elif role == "assistant":
            out.append(AIMessage(content=content))
    return out


def _target_doc_ids(payload: ChatRequest) -> List[str]:
    out: List[str] = []
    if payload.document_ids:
        out.extend([d for d in payload.document_ids if d])
    if payload.document_id:
        out.append(payload.document_id)
    return out


# ── Main pipeline ─────────────────────────────────────────────────────────────

def _execute_chat(payload: ChatRequest, request: Request) -> Dict[str, Any]:
    db = SessionLocal()
    try:
        user_id = resolve_user_id_from_request(request, db)
        history_messages = _build_history_messages(payload)
        target_doc_ids = _target_doc_ids(payload)

        # Resolve which docs are in scope
        if target_doc_ids:
            docs_meta = list(
                db.execute(
                    select(Document).where(
                        and_(
                            Document.user_id == user_id,
                            Document.id.in_(target_doc_ids),
                        )
                    )
                ).scalars().all()
            )
        else:
            docs_meta = list(
                db.execute(
                    select(Document).where(Document.user_id == user_id)
                ).scalars().all()
            )

        docs_meta = [d for d in docs_meta if d.status == "ready"]

        if not docs_meta:
            return {
                "mode": "direct",
                "content": (
                    "I couldn't find any ready documents in your library. "
                    "Upload a file and wait for it to show 'Ready' before asking questions."
                ),
            }

        spreadsheet_doc_ids = [
            d.id for d in docs_meta if d.file_name.lower().endswith((".xlsx", ".xls", ".csv"))
        ]
        non_spreadsheet_doc_ids = [d.id for d in docs_meta if d.id not in spreadsheet_doc_ids]

        # ── Path 1: Spreadsheet — schema-aware LLM filter ────────────────────
        if spreadsheet_doc_ids:
            schema_info = _get_schema_sample(db, user_id, spreadsheet_doc_ids)
            logger.info(
                "Schema: columns=%s | total_rows=%d",
                schema_info.get("columns", []),
                schema_info.get("total_rows", 0),
            )

            if schema_info["columns"]:
                plan = _llm_generate_filter_plan(
                    schema_info, payload.message, payload.history
                )
                logger.info("Filter plan: %s", plan)

                intent = plan.get("intent", "general")
                filters = plan.get("filters", [])

                # Use the plan if we have filters OR a non-general intent
                if filters or intent in ("count", "list", "aggregate"):
                    result = _apply_filter_plan(db, user_id, spreadsheet_doc_ids, plan)
                    logger.info(
                        "Filter result: intent=%s | matched=%d | distinct=%s",
                        result["intent"], result["count"], result["distinct"],
                    )
                    answer = _format_plan_answer(
                        result, payload.message, payload, history_messages
                    )
                    # For list/aggregate that wants LLM stream, fall through to streaming
                    if answer["mode"] == "direct":
                        return answer
                    # mode == "stream": return with messages
                    return answer

            # No usable plan — fall through to vector search on the spreadsheet chunks
            target_for_vector = spreadsheet_doc_ids

        else:
            target_for_vector = non_spreadsheet_doc_ids

        if not target_for_vector:
            target_for_vector = non_spreadsheet_doc_ids or spreadsheet_doc_ids

        # ── Path 2: Vector + keyword fallback ────────────────────────────────
        embedder = get_embedder(
            
            
        )
        query_vec = embedder.embed_query(payload.message)

        simple_kws = re.findall(r"[a-zA-Z0-9]+", payload.message.lower())
        sim_chunks = _vector_search(db, user_id, query_vec, target_for_vector, limit=VECTOR_TOP_K)
        kw_chunks = _keyword_search(db, user_id, target_for_vector, simple_kws)

        # merge, deduplicate
        seen_ids: set = set()
        merged = []
        for c in (sim_chunks + kw_chunks):
            if c.id not in seen_ids:
                seen_ids.add(c.id)
                merged.append(c)
        merged = merged[:MAX_KEYWORD_HITS]

        if not merged:
            return {
                "mode": "direct",
                "content": (
                    "I could not find the answer in your uploaded documents. "
                    "Try rephrasing, or make sure the relevant file is selected."
                ),
            }

        context = _build_vector_context(merged)
        sys_prompt = (
            "You are a precise document assistant. Answer the user's question ONLY "
            "using the context below. Do NOT use general knowledge. "
            "You must answer using ONLY the provided context. If the answer is not present, decline to answer.\n\n"
            f"=== DOCUMENT CONTEXT ===\n{context}\n=== END CONTEXT ==="
        )
        messages = [SystemMessage(content=sys_prompt)] + history_messages + [
            HumanMessage(content=payload.message)
        ]
        return {"mode": "stream", "messages": messages}

    except HTTPException:
        raise
    except Exception:
        logger.exception("Chat pipeline failed")
        raise
    finally:
        db.close()


# ── Streaming ─────────────────────────────────────────────────────────────────

def _stream_llm_chunks(messages: Sequence) -> Iterable[str]:
    llm = _llm(max_tokens=4096, temperature=0.0)
    try:
        for chunk in llm.stream(messages):
            text = chunk.content if hasattr(chunk, "content") else str(chunk)
            if text:
                yield text
    except Exception:
        logger.exception("LLM streaming failed")
        yield "Error: Unable to generate a response. Please try again."


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/chat")
@chat_limiter.limit("30/minute")
async def chat_endpoint(payload: ChatRequest, request: Request):
    # ── Natural Language Report Detection ───────────────────────────────────
    user_msg = (payload.message or "").strip()
    report_trigger_phrases = [
        "generate a report", "prepare a report", "create a report",
        "download a report", "export a report", "report on",
        "give me a report", "a report of", "report for",
    ]
    is_report_request = any(
        user_msg.lower().startswith(phrase) or
        user_msg.lower().startswith("can you " + phrase) or
        user_msg.lower().startswith("could you " + phrase) or
        user_msg.lower().startswith("please " + phrase) or
        user_msg.lower().startswith("i want a report") or
        user_msg.lower().startswith("i need a report") or
        ("report") in user_msg.lower() and
        any(w in user_msg.lower() for w in ["prepare", "generate", "create", "export", "download"])
 )

    if is_report_request and len(user_msg) > 5:
        try:
            nl_payload = NLReportRequest(
                prompt=user_msg,
                output_format="excel",
                document_ids=payload.document_ids if payload.document_ids else None,
            )
            # Forward to the NL report endpoint
            from fastapi import Depends
            from database import SessionLocal
            db = SessionLocal()
            try:
                result = await generate_report_from_prompt(
                    nl_payload, request, db
                )
                return result
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"NL report generation failed, falling back to chat: {e}")
 # ── Normal Chat ───────────────────────────────────────────────────────────

    try:
        result = await run_in_threadpool(_execute_chat, payload, request)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Chat endpoint failed")
        raise HTTPException(status_code=500, detail="Internal server error") from None

    if result["mode"] == "direct":
        async def _gen_direct():
            yield result["content"]
        return StreamingResponse(_gen_direct(), media_type="text/plain; charset=utf-8")

    return StreamingResponse(
        iterate_in_threadpool(_stream_llm_chunks(result["messages"])),
        media_type="text/plain; charset=utf-8",
    )
