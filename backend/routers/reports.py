"""Natural-language report generation — user describes what they want, AI builds the report."""

from __future__ import annotations

import io
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from auth.utils import get_current_user
from database import get_db
from models import Document, DocumentRow, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["reports"])

# ── Request model ─────────────────────────────────────────────────────────────

class NLReportRequest(BaseModel):
    prompt: str  # Natural language: "prepare a report of which ATMs are not working in Nagapattinam"
    output_format: str = "excel"  # csv | excel | pdf
    document_ids: Optional[List[str]] = None  # Optional: specify which docs, or let AI pick


_REPORT_SYSTEM_PROMPT = """\
You are a report planning assistant. The user has uploaded spreadsheet documents and wants
to generate a report using natural language.

Your job is to produce a JSON plan describing EXACTLY what data to extract and how to format it.

Output ONLY a single valid JSON object — no explanation, no markdown fences.

JSON schema:
{
  "report_title": "<human-readable title for the report>",
  "filters": [
    {"column": "<exact column name>", "operator": "<eq|ne|contains|not_contains|gt|lt|gte|lte>", "value": "<value>"}
  ],
  "group_by": "<column to group results by, or null if no grouping needed>",
  "output_format": "<csv|excel|pdf>",
  "reasoning": "<brief explanation of your interpretation>"
}

Rules:
- Use EXACT column names from the schema (case-sensitive).
- Match value CASE to the sample data (e.g. if data has 'NOT-WORKING', use 'NOT-WORKING').
- If the user asks for a report about "not working / broken / down" things, filter by the
  working-status column with appropriate operator.
- If the user names a location (city, region, area), filter by the location/region column.
- If no specific format is mentioned, default to "excel".
- If no grouping is mentioned, set group_by to null.
- Do NOT invent column names. Only use columns that exist in the schema.
- If the user's request is vague or unclear, make reasonable assumptions and include them in reasoning.
"""


def _build_report_plan_messages(
    prompt: str,
    schema: Dict[str, Any],
    history: List[Dict[str, str]],
) -> List[Dict[str, str]]:
    """Build messages for the LLM to plan a report from natural language."""
    schema_lines = []
    for col in schema.get("columns", []):
        sample = schema.get("sample_values", {}).get(col, "")
        schema_lines.append(f"  - {col}: (sample: {sample})")

    schema_text = "\n".join(schema_lines) if schema_lines else "  (no schema available)"

    sample_rows_text = ""
    for row in schema.get("sample_rows", [])[:5]:
        sample_rows_text += str(row) + "\n"

    history_text = ""
    if history:
        history_text = "Previous user questions:\n" + "\n".join(
            f"- {h['content']}" for h in history[-6:]
        ) + "\n\n"

    system_msg = {
        "role": "system",
        "content": _REPORT_SYSTEM_PROMPT,
    }

    user_msg = {
        "role": "user",
        "content": (
            f"{history_text}"
            f"Schema (column names and sample values):\n{schema_text}\n\n"
            f"Sample rows:\n{sample_rows_text}\n\n"
            f"User request: {prompt}\n\n"
            f"Output the JSON plan now."
        ),
    }

    return [system_msg, user_msg]


def _call_nvidia_chat(messages: List[Dict], model: str = "meta/llama-3.3-70b-instruct") -> str:
    """Call NVIDIA API for chat completion."""
    import os
    api_key = os.environ.get("NVIDIA_API_KEY", "")
    if not api_key:
        from config import settings
        api_key = getattr(settings, "nvidia_api_key", "")

    if not api_key:
        raise HTTPException(status_code=500, detail="NVIDIA API key not configured")

    import urllib.request
    import urllib.error

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 512,
    }

    req = urllib.request.Request(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        logger.error(f"NVIDIA API error: {e.code} {error_body}")
        raise HTTPException(status_code=502, detail="AI service error. Please try again.")
    except Exception as e:
        logger.error(f"NVIDIA API call failed: {e}")
        raise HTTPException(status_code=502, detail="Failed to reach AI service.")


def _call_llm_for_report_plan(
    prompt: str,
    schema: Dict[str, Any],
    history: List[Dict],
) -> Dict[str, Any]:
    """Call LLM to get a report plan from natural language."""
    msgs = _build_report_plan_messages(prompt, schema, history)
    response_text = _call_nvidia_chat(msgs)

    try:
        start = response_text.find("{")
        end = response_text.rfind("}") + 1
        if start != -1 and end != 0:
            json_str = response_text[start:end]
            plan = json.loads(json_str)
            return plan
        else:
            raise ValueError("No JSON found in response")
    except Exception as e:
        logger.error(f"Failed to parse report plan: {e}, response: {response_text}")
        raise HTTPException(status_code=500, detail="Failed to interpret report request. Please rephrase.")


# ── Filter execution ──────────────────────────────────────────────────────────

def _cell_matches(cell_val: Any, operator: str, filter_val: str) -> bool:
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


def _row_matches_filters(row_values: Dict[str, Any], filters: List[Dict]) -> bool:
    for f in filters:
        col = f.get("column", "")
        operator = f.get("operator", "eq")
        value = str(f.get("value", ""))

        matched_key = None
        for k in row_values:
            if k.lower().strip() == col.lower().strip():
                matched_key = k
                break

        if matched_key is None:
            return False

        if not _cell_matches(row_values[matched_key], operator, value):
            return False

    return True


def _fetch_filtered_rows(
    db: Session,
    user_id: str,
    doc_ids: Sequence[str],
    filters: Optional[List[Dict]],
) -> List[Dict[str, Any]]:
    """Fetch all rows matching filters for the given documents."""
    stmt = (
        select(DocumentRow)
        .where(DocumentRow.user_id == user_id)
        .where(DocumentRow.document_id.in_(doc_ids))
        .order_by(DocumentRow.document_id, DocumentRow.row_index)
    )
    all_rows = list(db.execute(stmt).scalars().all())

    if not filters:
        return [r.values or {} for r in all_rows]

    matched = [
        r for r in all_rows
        if _row_matches_filters(r.values or {}, filters)
    ]
    return [r.values or {} for r in matched]


def _group_rows(rows: List[Dict[str, Any]], group_by: str) -> Dict[str, List[Dict]]:
    """Group rows by a specific column."""
    groups: Dict[str, List[Dict]] = {}
    for row in rows:
        key = None
        for k, v in row.items():
            if k.lower().strip() == group_by.lower().strip():
                key = str(v).strip()
                break
        if key is None:
            key = "(unknown)"
        if key not in groups:
            groups[key] = []
        groups[key].append(row)
    return groups


# ── CSV generation ───────────────────────────────────────────────────────────

def _generate_csv(
    rows: List[Dict[str, Any]],
    report_title: str,
    group_by: Optional[str] = None,
) -> bytes:
    import csv
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([f"# {report_title}"])
    writer.writerow([f"# Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"])
    if group_by:
        writer.writerow([f"# Grouped by: {group_by}"])
    writer.writerow([])

    if not rows:
        writer.writerow(["No data found"])
        return output.getvalue().encode("utf-8")

    headers = list(rows[0].keys())
    writer.writerow(headers)

    if group_by:
        grouped = _group_rows(rows, group_by)
        for group_key, group_rows in grouped.items():
            writer.writerow([f"# {group_by}: {group_key}"])
            writer.writerow(headers)
            for row in group_rows:
                writer.writerow([row.get(h, "") for h in headers])
            writer.writerow([])
    else:
        for row in rows:
            writer.writerow([row.get(h, "") for h in headers])

    return output.getvalue().encode("utf-8")


# ── Excel generation ────────────────────────────────────────────────────────

def _generate_excel(
    rows: List[Dict[str, Any]],
    report_title: str,
    group_by: Optional[str] = None,
) -> bytes:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.utils import get_column_letter

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Report"

    ws.merge_cells("A1:Z1")
    title_cell = ws["A1"]
    title_cell.value = report_title
    title_cell.font = Font(bold=True, size=14, color="FFFFFF")
    title_cell.fill = PatternFill("solid", fgColor="3B82F6")
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 25

    ws.merge_cells("A2:Z2")
    sub_cell = ws["A2"]
    sub_cell.value = f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    sub_cell.font = Font(italic=True, size=10, color="888888")
    sub_cell.alignment = Alignment(horizontal="center")
    ws.row_dimensions[2].height = 18

    ws.append([])

    if not rows:
        ws.append(["No data found"])
        output = io.BytesIO()
        wb.save(output)
        return output.getvalue()

    headers = list(rows[0].keys())

    if group_by:
        grouped = _group_rows(rows, group_by)
        row_num = ws.max_row + 1
        for group_key, group_rows in grouped.items():
            ws.merge_cells(f"A{row_num}:Z{row_num}")
            g_cell = ws.cell(row=row_num, column=1)
            g_cell.value = f"{group_by}: {group_key}"
            g_cell.font = Font(bold=True, size=11, color="FFFFFF")
            g_cell.fill = PatternFill("solid", fgColor="6366F1")
            g_cell.alignment = Alignment(horizontal="left")
            ws.row_dimensions[row_num].height = 20
            row_num += 1

            for col_idx, h in enumerate(headers, 1):
                c = ws.cell(row=row_num, column=col_idx)
                c.value = h
                c.font = Font(bold=True, color="FFFFFF")
                c.fill = PatternFill("solid", fgColor="4B5563")
                c.alignment = Alignment(horizontal="center")
            ws.row_dimensions[row_num].height = 18
            row_num += 1

            for row in group_rows:
                for col_idx, h in enumerate(headers, 1):
                    c = ws.cell(row=row_num, column=col_idx)
                    c.value = row.get(h, "")
                row_num += 1

            row_num += 1
    else:
        for col_idx, h in enumerate(headers, 1):
            c = ws.cell(row=ws.max_row + 1, column=col_idx)
            c.value = h
            c.font = Font(bold=True, color="FFFFFF")
            c.fill = PatternFill("solid", fgColor="4B5563")
            c.alignment = Alignment(horizontal="center")

        for row in rows:
            ws.append([row.get(h, "") for h in headers])

    for col_idx, h in enumerate(headers, 1):
        col_letter = get_column_letter(col_idx)
        max_len = max(len(str(h)), 12)
        ws.column_dimensions[col_letter].width = min(max_len + 2, 40)

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()


# ── PDF generation ──────────────────────────────────────────────────────────

def _generate_pdf(
    rows: List[Dict[str, Any]],
    report_title: str,
    group_by: Optional[str] = None,
) -> bytes:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.platypus import (
            SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        )
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="PDF generation library not installed. Use CSV or Excel format.",
        )

    output = io.BytesIO()
    doc = SimpleDocTemplate(
        output,
        pagesize=landscape(A4),
        leftMargin=10*mm,
        rightMargin=10*mm,
        topMargin=15*mm,
        bottomMargin=15*mm,
    )

    title_style = ParagraphStyle(
        "Title",
        fontSize=18,
        textColor=colors.HexColor("#3B82F6"),
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        fontSize=9,
        textColor=colors.grey,
        spaceAfter=12,
    )

    elements = []
    elements.append(Paragraph(report_title, title_style))
    elements.append(Paragraph(
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        subtitle_style,
    ))

    if not rows:
        elements.append(Paragraph("No data found.", subtitle_style))
        doc.build(elements)
        return output.getvalue()

    headers = list(rows[0].keys())

    if group_by:
        grouped = _group_rows(rows, group_by)
        for group_key, group_rows in grouped.items():
            elements.append(Paragraph(
                f"<b>{group_by}:</b> {group_key}",
                ParagraphStyle(
                    "GroupHeader",
                    fontSize=11,
                    textColor=colors.HexColor("#6366F1"),
                    spaceBefore=10,
                    spaceAfter=4,
                ),
            ))

            table_data = [headers] + [
                [row.get(h, "") for h in headers] for row in group_rows
            ]
            col_widths = [min(max(len(str(h)), 12) * 5 + 20, 80) * mm / 25 for h in headers]
            t = Table(table_data, colWidths=col_widths)
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4B5563")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 9),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTSIZE", (0, 1), (-1, -1), 8),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F4F6")]),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]))
            elements.append(t)
            elements.append(Spacer(1, 8 * mm))
    else:
        table_data = [headers] + [
            [row.get(h, "") for h in headers] for row in rows
        ]
        col_widths = [min(max(len(str(h)), 12) * 5 + 20, 80) * mm / 25 for h in headers]
        t = Table(table_data, colWidths=col_widths)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3B82F6")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F4F6")]),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        elements.append(t)

    doc.build(elements)
    return output.getvalue()


# ── Endpoint ────────────────────────────────────────────────────────────────

@router.post("/reports/generate-from-prompt")
async def generate_report_from_prompt(
    payload: NLReportRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Natural language report generation.
    User says: 'prepare a report of which ATMs are not working in Nagapattinam'
    AI interprets → builds filters → generates report → downloads.
    """
    user_id = get_current_user(db, request)

    if not payload.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt is required")

    # Get user's ready documents
    if payload.document_ids:
        docs = list(
            db.execute(
                select(Document).where(
                    and_(
                        Document.user_id == user_id,
                        Document.id.in_(payload.document_ids),
                        Document.status == "ready",
                    )
                )
            ).scalars().all()
        )
    else:
        docs = list(
            db.execute(
                select(Document).where(
                    and_(
                        Document.user_id == user_id,
                        Document.status == "ready",
                    )
                )
            ).scalars().all()
        )

    if not docs:
        raise HTTPException(
            status_code=400,
            detail="No ready documents found. Please upload and process a file first.",
        )

    # Get schema from first document
    first_doc = docs[0]
    schema: Dict[str, Any] = {}

    if first_doc.schema_ and isinstance(first_doc.schema_, dict):
        schema = first_doc.schema_
    elif first_doc.schema_ and isinstance(first_doc.schema_, str):
        try:
            schema = json.loads(first_doc.schema_)
        except Exception:
            pass

    # If no schema, try to build from rows
    if not schema:
        sample_rows = list(
            db.execute(
                select(DocumentRow)
                .where(DocumentRow.document_id == first_doc.id)
                .limit(5)
            ).scalars().all()
        )
        if sample_rows:
            all_keys = set()
            for r in sample_rows:
                if r.values:
                    all_keys.update(r.values.keys())
            schema["columns"] = list(all_keys)
            schema["sample_values"] = {}
            schema["sample_rows"] = [r.values for r in sample_rows if r.values]

    # Get conversation history for context
    history: List[Dict[str, str]] = []

    # Call LLM to interpret the prompt into a report plan
    try:
        plan = _call_llm_for_report_plan(payload.prompt, schema, history)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"LLM report planning failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to interpret report request. Please try rephrasing.")

    report_title = plan.get("report_title", payload.prompt)
    filters = plan.get("filters", [])
    group_by = plan.get("group_by")
    output_format = plan.get("output_format", payload.output_format or "excel")

    if output_format not in ("csv", "excel", "pdf"):
        output_format = "excel"

    # Fetch filtered rows
    doc_ids = [d.id for d in docs]
    rows = _fetch_filtered_rows(db, user_id, doc_ids, filters)

    if not rows:
        rows = [{"note": "No data matches the requested filters"}]

    # Generate report
    title = report_title or "Data Report"
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    if output_format == "csv":
        content = _generate_csv(rows, title, group_by)
        media_type = "text/csv"
        filename = f"{title.replace(' ', '_')}_{ts}.csv"
    elif output_format == "excel":
        content = _generate_excel(rows, title, group_by)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"{title.replace(' ', '_')}_{ts}.xlsx"
    else:
        content = _generate_pdf(rows, title, group_by)
        media_type = "application/pdf"
        filename = f"{title.replace(' ', '_')}_{ts}.pdf"

    return StreamingResponse(
        io.BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
