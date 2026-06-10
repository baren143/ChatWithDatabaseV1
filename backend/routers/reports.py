"""Report generation endpoint — PDF, CSV, Excel export from filtered document data."""

from __future__ import annotations

import csv
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
from database import get_db, SessionLocal
from models import Document, DocumentRow, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["reports"])

# ── Request model ─────────────────────────────────────────────────────────────

class ReportRequest(BaseModel):
    document_ids: List[str]
    filters: Optional[List[Dict[str, Any]]] = None
    group_by: Optional[str] = None
    output_format: str = "csv"  # csv | excel | pdf
    report_title: Optional[str] = "Data Report"


class FilterDef(BaseModel):
    column: str
    operator: str
    value: str


# ── Filter execution (same logic as chat.py) ────────────────────────────────

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
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
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
    writer.writerow(["---"] * len(headers))

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
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Report"

    # Title
    ws.merge_cells("A1:Z1")
    title_cell = ws["A1"]
    title_cell.value = report_title
    title_cell.font = Font(bold=True, size=14, color="FFFFFF")
    title_cell.fill = PatternFill("solid", fgColor="3B82F6")
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 25

    # Subtitle
    ws.merge_cells("A2:Z2")
    sub_cell = ws["A2"]
    sub_cell.value = f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    sub_cell.font = Font(italic=True, size=10, color="888888")
    sub_cell.alignment = Alignment(horizontal="center")
    ws.row_dimensions[2].height = 18

    ws.append([])  # blank row

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
            # Group header
            ws.merge_cells(f"A{row_num}:Z{row_num}")
            g_cell = ws.cell(row=row_num, column=1)
            g_cell.value = f"{group_by}: {group_key}"
            g_cell.font = Font(bold=True, size=11, color="FFFFFF")
            g_cell.fill = PatternFill("solid", fgColor="6366F1")
            g_cell.alignment = Alignment(horizontal="left")
            ws.row_dimensions[row_num].height = 20
            row_num += 1

            # Column headers
            for col_idx, h in enumerate(headers, 1):
                c = ws.cell(row=row_num, column=col_idx)
                c.value = h
                c.font = Font(bold=True, color="FFFFFF")
                c.fill = PatternFill("solid", fgColor="4B5563")
                c.alignment = Alignment(horizontal="center")
            ws.row_dimensions[row_num].height = 18
            row_num += 1

            # Data rows
            for row in group_rows:
                for col_idx, h in enumerate(headers, 1):
                    c = ws.cell(row=row_num, column=col_idx)
                    c.value = row.get(h, "")
                row_num += 1

            row_num += 1  # blank between groups
    else:
        # Column headers
        for col_idx, h in enumerate(headers, 1):
            c = ws.cell(row=ws.max_row + 1, column=col_idx)
            c.value = h
            c.font = Font(bold=True, color="FFFFFF")
            c.fill = PatternFill("solid", fgColor="4B5563")
            c.alignment = Alignment(horizontal="center")

        # Data
        for row in rows:
            ws.append([row.get(h, "") for h in headers])

    # Auto-width columns
    for col_idx, h in enumerate(headers, 1):
        col_letter = get_column_letter(col_idx)
        max_len = max(len(str(h)),12)
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
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.platypus import (
            SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
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

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Title"],
        fontSize=18,
        textColor=colors.HexColor("#3B82F6"),
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.grey,
        spaceAfter=12,
    )

    elements = []

    # Title
    elements.append(Paragraph(report_title, title_style))
    elements.append(Paragraph(
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        subtitle_style,
    ))

    if not rows:
        elements.append(Paragraph("No data found.", styles["Normal"]))
        doc.build(elements)
        return output.getvalue()

    headers = list(rows[0].keys())

    if group_by:
        grouped = _group_rows(rows, group_by)
        for group_key, group_rows in grouped.items():
            elements.append(Paragraph(
                f"<b>{group_by}:</b> {group_key}",
                ParagraphStyle("GroupHeader", parent=styles["Normal"],
                              fontSize=11, textColor=colors.HexColor("#6366F1"),
                              spaceBefore=10, spaceAfter=4),
            ))

            table_data = [headers] + [
                [row.get(h, "") for h in headers] for row in group_rows
            ]

            col_widths = [min(max(len(str(h)),12) * 5 + 20, 80) * mm / 25 for h in headers]
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

@router.post("/reports/generate")
async def generate_report(payload: ReportRequest, request: Request, db: Session = Depends(get_db)):
    """Generate a PDF, CSV, or Excel report from filtered document data."""
    user_id = get_current_user(db, request)

    if not payload.document_ids:
        raise HTTPException(status_code=400, detail="At least one document_id is required")

    if payload.output_format not in ("csv", "excel", "pdf"):
        raise HTTPException(status_code=400, detail="output_format must be csv, excel, or pdf")

    # Verify documents belong to user and are ready
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

    if not docs:
        raise HTTPException(
            status_code=400,
            detail="No ready documents found for the given IDs",
        )

    # Fetch filtered rows
    rows = _fetch_filtered_rows(db, user_id, payload.document_ids, payload.filters)

    if not rows:
        rows = [{"note": "No data matches the selected filters"}]

    title = payload.report_title or "Data Report"

    # Generate report
    if payload.output_format == "csv":
        content = _generate_csv(rows, title, payload.group_by)
        media_type = "text/csv"
        ext = "csv"
        filename = f"{title.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    elif payload.output_format == "excel":
        content = _generate_excel(rows, title, payload.group_by)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ext = "xlsx"
        filename = f"{title.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

    else:  # pdf
        content = _generate_pdf(rows, title, payload.group_by)
        media_type = "application/pdf"
        ext = "pdf"
        filename = f"{title.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"

    return StreamingResponse(
        io.BytesIO(content),
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
 },
    )
