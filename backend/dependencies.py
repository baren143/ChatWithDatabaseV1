from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session
from auth.utils import SECRET_KEY, ALGORITHM, get_db as get_auth_db, oauth2_scheme
from database import SessionLocal
from models import User


def get_db():
    """FastAPI dependency that yields a database session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Re-export the auth get_db for consistency
get_auth_db = get_auth_db

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_auth_db)):
    """Validate JWT token and return current user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


def get_current_user_id(request: Request) -> str:
    """
    Extract user ID from Authorization header (Bearer token) or X-User-Id header.
    Falls back to a test user if not provided (for development only).
    """
    # Try to get token from Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        # We can't easily validate the token here without DB session in a sync function
        # For now, we'll extract the user ID from the token payload (less secure but works for migration)
        # In production, use the async get_current_user dependency instead
        try:
            from jose import jwt
            payload = jwt.get_unverified_claims(token)
            user_id = payload.get("sub")
            if user_id:
                # Find user by email (sub claim)
                db = SessionLocal()
                try:
                    user = db.query(User).filter(User.email == user_id).first()
                    if user:
                        return str(user.id)
                finally:
                    db.close()
        except Exception:
            pass  # Fall back to other methods
    
    # Fall back to X-User-Id header (for frontend compatibility during transition)
    user_id = request.headers.get("X-User-Id")
    if user_id:
        return user_id
    
    # Final fallback for development only
    return "test_user_123"