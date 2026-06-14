"""Natural-language presentation generation — user describes what they want, AI builds PowerPoint slides."""

from __future__ import annotations

import io
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from auth.utils import get_current_user
from database import get_db
from models import Document, DocumentRow
from dependencies import get_current_user_id
from routers.filters import cell_matches, row_matches_filters, fetch_filtered_rows

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["reports"])

# ── Request model ─────────────────────────────────────────────────────────────

class NLPresentationRequest(BaseModel):
    prompt: str  # Natural language: "create a presentation about ATM performance in Nagapattinam"
    document_ids: Optional[List[str]] = None


class ReportRequest(BaseModel):
    document_ids: Optional[List[str]] = None
    filters: List[dict] = []
    group_by: Optional[str] = None
    output_format: str = "excel"
    report_title: str = "Report"


_PPTX_SYSTEM_PROMPT = """\
You are a presentation planning assistant. The user has uploaded spreadsheet documents and wants
to generate a PowerPoint presentation using natural language.

Your job is to produce a JSON plan describing EXACTLY what slides to create.

Output ONLY a single valid JSON object — no explanation, no markdown fences.

JSON schema:
{
  "presentation_title": "<human-readable title for the presentation>",
  "slides": [
    {
      "slide_title": "<title of this slide>",
      "content_type": "<title_only|text_and_data|bullet_points|table|chart>",
      "bullets": ["<bullet 1>", "<bullet 2>", ...],  // for bullet_points
      "headers": ["<col1>", "<col2>", ...],           // for table
      "rows": [["<val1>", "<val2>", ...], ...],       // for table
      "chart_title": "<title>",                        // for chart
      "chart_labels": ["<label1>", ...],              // for chart
      "chart_values": [<num1>, <num2>, ...],          // for chart
      "narration": "<optional speaker notes / narration text>"
    }
  ],
  "reasoning": "<brief explanation of your interpretation>"
}

Rules:
- Use EXACT column names from the schema (case-sensitive) when referencing data.
- Match value CASE to the sample data.
- presentation_title should be catchy and descriptive.
- Each slide should have a clear purpose: title slide, summary, data table, key insights.
- MAX6 slides total — keep it concise.
- For data slides, summarize key findings in bullets, don't dump all raw data.
- Use bullet_points for key insights, table for detailed data (max 8 rows).
- Always include a "Key Findings" or "Summary" slide at the end.
- Do NOT invent column names or data. Only use columns that exist in the schema.
- If the user's request is vague, make reasonable assumptions.
"""


def _build_presentation_plan_messages(
    prompt: str,
    schema: Dict[str, Any],
    history: List[Dict[str, str]],
) -> List[Dict[str, str]]:
    """Build messages for the LLM to plan a presentation from natural language."""
    schema_lines = []
    for col in schema.get("columns", []):
        sample = schema.get("sample_values", {}).get(col, "")
        schema_lines.append(f"  - {col}: (sample: {sample})")

    schema_text = "\n".join(schema_lines) if schema_lines else "  (no schema available)"

    sample_rows_text = ""
    for row in schema.get("sample_rows", [])[:10]:
        sample_rows_text += str(row) + "\n"

    history_text = ""
    if history:
        history_text = "Previous user questions:\n" + "\n".join(
            f"- {h['content']}" for h in history[-6:]
        ) + "\n\n"

    system_msg = {
        "role": "system",
        "content": _PPTX_SYSTEM_PROMPT,
    }

    user_msg = {
        "role": "user",
        "content": (
            f"{history_text}"
            f"Schema (column names and sample values):\n{schema_text}\n\n"
            f"Sample rows (first 10):\n{sample_rows_text}\n\n"
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
        "max_tokens": 1024,
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
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        logger.error(f"NVIDIA API error: {e.code} {error_body}")
        raise HTTPException(status_code=502, detail="AI service error. Please try again.")
    except Exception as e:
        logger.error(f"NVIDIA API call failed: {e}")
        raise HTTPException(status_code=502, detail="Failed to reach AI service.")


def _call_llm_for_presentation_plan(
    prompt: str,
    schema: Dict[str, Any],
    history: List[Dict],
) -> Dict[str, Any]:
    """Call LLM to get a presentation plan from natural language."""
    msgs = _build_presentation_plan_messages(prompt, schema, history)
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
        logger.error(f"Failed to parse presentation plan: {e}, response: {response_text}")
        raise HTTPException(status_code=500, detail="Failed to interpret presentation request. Please rephrase.")


# ── Filter execution ──────────────────────────────────────────────────────────







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


# ── PPTX generation ──────────────────────────────────────────────────────────

def _generate_pptx(
    plan: Dict[str, Any],
    rows: List[Dict[str, Any]],
) -> bytes:
    try:
        from pptx import Presentation
        from pptx.util import Inches, Pt, Emu
        from pptx.dml.color import RGBColor
        from pptx.enum.text import PP_ALIGN
        from pptx.enum.shapes import MSO_SHAPE
        from pptx.oxml.ns import qn
        from pptx.oxml import parse_xml
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="Presentation library not installed. Please contact support.",
        )

    prs = Presentation()
    prs.slide_width = Inches(13.333)  # 16:9 widescreen
    prs.slide_height = Inches(7.5)

    # Color scheme
    BLUE = RGBColor(0x3B, 0x82, 0xF6)
    DARK_BLUE = RGBColor(0x1E, 0x3A, 0x5F)
    WHITE = RGBColor(0xFF, 0xFF, 0xFF)
    LIGHT_GRAY = RGBColor(0xF3, 0xF4, 0xF6)
    TEXT_DARK = RGBColor(0x1F, 0x29, 0x37)
    ACCENT = RGBColor(0x63, 0x66, 0xF1)

    def _add_title_slide(prs: Presentation, title: str, subtitle: str = ""):
        slide_layout = prs.slide_layouts[6]  # Blank
        slide = prs.slides.add_slide(slide_layout)

        # Blue background bar at top
        shape = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, Inches(3.5)
        )
        shape.fill.solid()
        shape.fill.fore_color.rgb = DARK_BLUE
        shape.line.fill.background()

        # Title
        txBox = slide.shapes.add_textbox(Inches(0.5), Inches(1.2), Inches(12.3), Inches(1.5))
        tf = txBox.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = title
        p.font.size = Pt(44)
        p.font.bold = True
        p.font.color.rgb = WHITE
        p.alignment = PP_ALIGN.CENTER

        # Subtitle
        if subtitle:
            txBox2 = slide.shapes.add_textbox(Inches(0.5), Inches(2.8), Inches(12.3), Inches(0.8))
            tf2 = txBox2.text_frame
            p2 = tf2.paragraphs[0]
            p2.text = subtitle
            p2.font.size = Pt(20)
            p2.font.color.rgb = RGBColor(0x93, 0xC5, 0xFD)
            p2.alignment = PP_ALIGN.CENTER

        # Footer
        txBox3 = slide.shapes.add_textbox(Inches(0.5), Inches(6.8), Inches(12.3), Inches(0.5))
        tf3 = txBox3.text_frame
        p3 = tf3.paragraphs[0]
        p3.text = f"Generated: {datetime.now().strftime('%Y-%m-%d')}"
        p3.font.size = Pt(12)
        p3.font.color.rgb = RGBColor(0x9C, 0xA3, 0xAF)
        p3.alignment = PP_ALIGN.CENTER

    def _add_content_slide(prs: Presentation, slide_data: Dict[str, Any]):
        slide_layout = prs.slide_layouts[6]  # Blank
        slide = prs.slides.add_slide(slide_layout)

        # Header bar
        shape = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, Inches(1.2)
        )
        shape.fill.solid()
        shape.fill.fore_color.rgb = BLUE
        shape.line.fill.background()

        # Slide title
        txBox = slide.shapes.add_textbox(Inches(0.5), Inches(0.25), Inches(12.3), Inches(0.8))
        tf = txBox.text_frame
        p = tf.paragraphs[0]
        p.text = slide_data.get("slide_title", "Slide")
        p.font.size = Pt(28)
        p.font.bold = True
        p.font.color.rgb = WHITE

        content_type = slide_data.get("content_type", "bullet_points")

        if content_type == "title_only":
            pass  # Just header, no content

        elif content_type == "bullet_points":
            bullets = slide_data.get("bullets", [])
            if bullets:
                txBox2 = slide.shapes.add_textbox(Inches(0.6), Inches(1.5), Inches(12), Inches(5.5))
                tf2 = txBox2.text_frame
                tf2.word_wrap = True
                for i, bullet in enumerate(bullets):
                    p2 = tf2.paragraphs[0] if i == 0 else tf2.add_paragraph()
                    p2.text = f"• {bullet}"
                    p2.font.size = Pt(20)
                    p2.font.color.rgb = TEXT_DARK
                    p2.space_before = Pt(8)
                    p2.space_after = Pt(4)

        elif content_type == "text_and_data":
            bullets = slide_data.get("bullets", [])
            if bullets:
                txBox2 = slide.shapes.add_textbox(Inches(0.6), Inches(1.5), Inches(12), Inches(5.5))
                tf2 = txBox2.text_frame
                tf2.word_wrap = True
                for i, bullet in enumerate(bullets):
                    p2 = tf2.paragraphs[0] if i == 0 else tf2.add_paragraph()
                    p2.text = f"• {bullet}"
                    p2.font.size = Pt(18)
                    p2.font.color.rgb = TEXT_DARK
                    p2.space_before = Pt(6)

        elif content_type == "table":
            headers = slide_data.get("headers", [])
            rows_data = slide_data.get("rows", [])

            if headers and rows_data:
                # Table
                table = slide.shapes.add_table(
                    len(rows_data) + 1, len(headers),
                    Inches(0.5), Inches(1.6), Inches(12.3), Inches(4.5)
                ).table

                # Header row
                for col_idx, h in enumerate(headers):
                    cell = table.cell(0, col_idx)
                    cell.text = str(h)
                    cell.fill.solid()
                    cell.fill.fore_color.rgb = BLUE
                    p = cell.text_frame.paragraphs[0]
                    p.font.size = Pt(12)
                    p.font.bold = True
                    p.font.color.rgb = WHITE
                    p.alignment = PP_ALIGN.CENTER

                # Data rows
                for row_idx, row_vals in enumerate(rows_data[:8]):  # Max 8 rows
                    for col_idx, val in enumerate(row_vals):
                        if col_idx < len(headers):
                            cell = table.cell(row_idx + 1, col_idx)
                            cell.text = str(val)[:50]  # Truncate long values
                            cell.fill.solid()
                            if row_idx % 2 == 0:
                                cell.fill.fore_color.rgb = WHITE
                            else:
                                cell.fill.fore_color.rgb = LIGHT_GRAY
                            p = cell.text_frame.paragraphs[0]
                            p.font.size = Pt(11)
                            p.font.color.rgb = TEXT_DARK

 # Narration / notes
        narration = slide_data.get("narration", "")
        if narration:
            try:
                notes_slide = slide.notes_slide
                notes_slide.notes_text_frame.text = narration
            except Exception:
                pass

    # Build slides
    presentation_title = plan.get("presentation_title", "Data Presentation")
    slides_plan = plan.get("slides", [])

    # Title slide
    _add_title_slide(prs, presentation_title, f"Generated from your data")

    # Content slides
    for slide_data in slides_plan:
        _add_content_slide(prs, slide_data)

    # Save
    output = io.BytesIO()
    prs.save(output)
    return output.getvalue()


# ── Endpoint ────────────────────────────────────────────────────────────────

@router.post("/reports/generate-presentation")
async def generate_presentation(
    payload: NLPresentationRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Natural language presentation generation.
    User says: 'create a presentation about ATM performance in Nagapattinam'
    AI interprets → builds slides → generates .pptx → downloads.
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

    # If no schema, build from rows
    if not schema:
        sample_rows = list(
            db.execute(
                select(DocumentRow)
                .where(DocumentRow.document_id == first_doc.id)
                .limit(10)
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

    # Call LLM to interpret the prompt into a presentation plan
    try:
        plan = _call_llm_for_presentation_plan(payload.prompt, schema, history)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"LLM presentation planning failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to interpret presentation request. Please try rephrasing.")

    presentation_title = plan.get("presentation_title", payload.prompt)

    # Fetch all rows (no filters — let AI decide what to show)
    doc_ids = [d.id for d in docs]
    rows = fetch_filtered_rows(db, user_id, doc_ids, None)

    if not rows:
        rows = [{"note": "No data available"}]

    # Generate presentation
    try:
        content = _generate_pptx(plan, rows)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PPTX generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate presentation. Please try again.")

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{presentation_title.replace(' ', '_')}_{ts}.pptx"

    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/reports/generate")
async def generate_report(
    payload: ReportRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Generate Excel/CSV/PDF report from filtered spreadsheet data."""
    user_id = get_current_user_id(request, db)
    
    # Find ready documents
    if payload.document_ids:
        docs = list(
            db.execute(
                select(Document)
                .where(
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
                select(Document)
                .where(
                    and_(
                        Document.user_id == user_id,
                        Document.status == "ready",
                    )
                )
            ).scalars().all()
        )
    
    if not docs:
        raise HTTPException(status_code=404, detail="No ready documents found")
    
    doc_ids = [d.id for d in docs]
    rows = fetch_filtered_rows(db, user_id, doc_ids, payload.filters or None)
    
    if not rows:
        rows = [{"note": "No data matching filters"}]
    
    fmt = payload.output_format.lower()
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    title = payload.report_title.replace(" ", "_")
    
    if fmt == "csv":
        import csv
        buf = io.StringIO()
        if rows:
            headers = list(rows[0].keys())
            writer = csv.DictWriter(buf, fieldnames=headers)
            writer.writeheader()
            writer.writerows(rows)
        content = buf.getvalue().encode("utf-8")
        return StreamingResponse(
            io.BytesIO(content),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{title}_{ts}.csv"'},
        )
    
    elif fmt == "pdf":
        try:
            from fpdf import FPDF
            pdf = FPDF()
            pdf.add_page()
            pdf.set_font("Arial", "B", 14)
            pdf.cell(0, 10, payload.report_title, ln=True, align="C")
            pdf.set_font("Arial", "", 10)
            for row in rows[:500]:
                line = ", ".join(f"{k}: {v}" for k, v in row.items())
                pdf.multi_cell(0, 6, line)
            content = pdf.output()
            return StreamingResponse(
                io.BytesIO(content) if isinstance(content, bytes) else io.BytesIO(content.encode("latin-1")),
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{title}_{ts}.pdf"'},
            )
        except ImportError:
            raise HTTPException(status_code=501, detail="PDF generation library not installed")
    
    else:  # Excel
        try:
            import openpyxl
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = payload.report_title[:31]
            if rows:
                headers = list(rows[0].keys())
                for ci, h in enumerate(headers, 1):
                    ws.cell(row=1, column=ci, value=h)
                for ri, row in enumerate(rows[:10000], 2):
                    for ci, h in enumerate(headers, 1):
                        ws.cell(row=ri, column=ci, value=str(row.get(h, "")))
            buf = io.BytesIO()
            wb.save(buf)
            buf.seek(0)
            return StreamingResponse(
                buf,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f'attachment; filename="{title}_{ts}.xlsx"'},
            )
        except ImportError:
            raise HTTPException(status_code=501, detail="Excel generation library not installed")
