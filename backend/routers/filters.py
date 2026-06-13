"""Shared filter utilities for chat.py and reports.py.

Eliminates the copy-pasted _cell_matches / _row_matches_filters
functions between the two modules. Keeps DRY with a single source
of truth for filter logic.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import DocumentRow


def cell_matches(cell_val: Any, operator: str, filter_val: str) -> bool:
    """Apply a single filter operator to one cell value."""
    if cell_val is None:
        cell_str = ""
    else:
        cell_str = str(cell_val)

    cv_lower = cell_str.lower().strip()
    fv_lower = filter_val.lower().strip()

    if operator in ("eq", "equals"):
        return cv_lower == fv_lower
    if operator in ("ne", "not_equals"):
        return cv_lower != fv_lower
    if operator in ("contains",):
        return fv_lower in cv_lower
    if operator in ("not_contains",):
        return fv_lower not in cv_lower
    if operator in ("gt", "lt", "gte", "lte", "greater_than", "less_than"):
        try:
            cv_num = float(cell_str.replace(",", ""))
            fv_num = float(filter_val.replace(",", ""))
            if operator in ("gt", "greater_than"):
                return cv_num > fv_num
            if operator in ("lt", "less_than"):
                return cv_num < fv_num
            if operator == "gte":
                return cv_num >= fv_num
            if operator == "lte":
                return cv_num <= fv_num
        except ValueError:
            return False
    return False


def row_matches_filters(row_values: Dict[str, Any], filters: List[Dict]) -> bool:
    """Return True iff a row matches ALL filters in the list."""
    if not filters:
        return True
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
        if not cell_matches(row_values[matched_key], operator, value):
            return False
    return True


def fetch_filtered_rows(
    db: Session,
    user_id: str,
    doc_ids: Sequence[str],
    filters: Optional[List[Dict]] = None,
) -> List[Dict[str, Any]]:
    """Fetch all rows matching filters for the given documents.

    For large datasets this could be optimized with SQL-level filtering,
    but for now it fetches all rows and filters in Python.
    """
    stmt = (
        select(DocumentRow)
        .where(DocumentRow.user_id == user_id)
        .where(DocumentRow.document_id.in_(doc_ids))
        .order_by(DocumentRow.document_id, DocumentRow.row_index)
    )
    all_rows = list(db.execute(stmt).scalars().all())

    if not filters:
        return [r.values or {} for r in all_rows]

    matched = [r for r in all_rows if row_matches_filters(r.values or {}, filters)]
    return [r.values or {} for r in matched]
