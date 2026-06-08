"""FastAPI dependencies for the chat pipeline.

This module bridges between the new auth layer (auth/utils.py) and the
existing routers. It exposes `resolve_user_id` (legacy) and
`get_current_user_id` (FastAPI dependency) that return a real user id
when a Bearer token is present, and raise 401 otherwise.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from auth.utils import decode_token, get_user_by_email
from database import SessionLocal
from models import User


def resolve_user_id_from_request(request: Request, db: Session) -> str:
    """Resolve the user id from a Bearer token.

    Falls back to a hard 401 if no valid token is supplied. There is no
    silent `test_user_123` fallback — every protected endpoint must
    authenticate.
    """
    auth_header = request.headers.get("Authorization") or ""
    token: str | None = None
    if auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    if not token:
        token = request.headers.get("X-Access-Token")  # optional alt header

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    email = payload.get("sub")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_by_email(db, email)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user.id


def get_current_user_id(
    request: Request,
    db: Session = Depends(lambda: SessionLocal()),
) -> str:
    """FastAPI dependency that returns the authenticated user's id.

    Note: we don't use `db: Session = Depends(get_db)` here because the
    chat endpoint opens its own session inside `_execute_chat` to manage
    a longer transaction.
    """
    return resolve_user_id_from_request(request, db)


def get_current_user_from_token(token: str, db: Session) -> User | None:
    """Helper for endpoints that already have a token in hand."""
    payload = decode_token(token)
    if not payload:
        return None
    email = payload.get("sub")
    if not email:
        return None
    return get_user_by_email(db, email)
