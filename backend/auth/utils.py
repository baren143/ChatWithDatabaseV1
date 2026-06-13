"""Authentication utilities: password hashing, JWT issuance/validation,
JWT refresh tokens, FastAPI dependencies for the current user.
"""

from __future__ import annotations

import os
import re as _re_module
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import SessionLocal
from models import User


# ── Configuration ────────────────────────────────────────────────────────────

SECRET_KEY = os.getenv("JWT_SECRET_KEY") or os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY (or SECRET_KEY) environment variable is required")

# Warn if secret looks like default/placeholder
_PLACEHOLDERS = {
    "your_secret_key_for_jwt_here_min_32_chars",
    "your_s_cret_key_for_jwt_here_min_32_chars",
    "change-me",
    "secret",
    "",
}
if SECRET_KEY in _PLACEHOLDERS:
    import logging as _lg
    _lg.getLogger(__name__).warning(
        "JWT_SECRET_KEY is a placeholder! Generate: openssl rand -hex 32"
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_MINUTES = int(os.getenv("REFRESH_TOKEN_EXPIRE_MINUTES", "1440"))

# ⬇️ CHANGED: sha256_crypt → bcrypt (industry standard)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

# Keep a compiled email regex
_EMAIL_RE = _re_module.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ── Password helpers ─────────────────────────────────────────────────────────

def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


# ── JWT helpers ──────────────────────────────────────────────────────────────

def create_access_token(
    subject: str, *, expires_delta: Optional[timedelta] = None
) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": subject,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": subject,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


# ── DB helpers ───────────────────────────────────────────────────────────────

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email.lower()).first()


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


# ── FastAPI dependencies ────────────────────────────────────────────────────

def credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme),
) -> Optional[User]:
    """Resolve the current user from a Bearer token if present, else None."""
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    email = payload.get("sub")
    if not email:
        return None
    db = SessionLocal()
    try:
        return get_user_by_email(db, email)
    finally:
        db.close()


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
) -> User:
    """Hard auth: requires a valid Bearer token. Raises 401 otherwise."""
    if not token:
        raise credentials_exception()
    payload = decode_token(token)
    if not payload:
        raise credentials_exception()
    email = payload.get("sub")
    if not email:
        raise credentials_exception()
    db = SessionLocal()
    try:
        user = get_user_by_email(db, email)
        if not user or not user.is_active:
            raise credentials_exception()
        return user
    finally:
        db.close()
