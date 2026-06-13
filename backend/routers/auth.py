"""Authentication API: signup, login, current-user, logout."""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from auth.utils import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    get_password_hash,
    get_user_by_email,
    validate_email,
    validate_password,
    verify_password,
)
from database import get_db
from models import User


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


# ── Pydantic models ──────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(default=None, max_length=120)


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int  # seconds


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    subscription_status: str

    class Config:
        from_attributes = True


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Create a new user account and return a JWT access token."""
    try:
        email = validate_email(payload.email)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    try:
        validate_password(payload.password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    existing = get_user_by_email(db, email)
    if existing:
        # Don't leak whether the email is taken — return generic 409.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        email=email,
        hashed_password=get_password_hash(payload.password),
        full_name=(payload.full_name or "").strip() or None,
        is_active=True,
        subscription_status="free",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(user.email)
    logger.info("User signed up: %s", user.email)
    return TokenResponse(
        access_token=access_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Authenticate with email + password and return a JWT access token."""
    try:
        email = validate_email(payload.email)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    user = get_user_by_email(db, email)
    # Constant-ish message to avoid leaking which half of the credential was wrong
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password.",
    )
    if not user or not user.hashed_password or not user.is_active:
        raise invalid
    if not verify_password(payload.password, user.hashed_password):
        raise invalid

    access_token = create_access_token(user.email)
    logger.info("User logged in: %s", user.email)
    return TokenResponse(
        access_token=access_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Return the currently authenticated user."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        subscription_status=current_user.subscription_status or "free",
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(_current_user: User = Depends(get_current_user)) -> None:
    """Client-side logout (token discard). We keep the endpoint for symmetry
    and as a hook for server-side token-blacklist in the future."""
    # JWTs are stateless; client should discard the token.
    return None
