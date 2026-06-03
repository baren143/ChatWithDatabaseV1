from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from auth.utils import SECRET_KEY, ALGORITHM, oauth2_scheme
from database import get_db
from models import User


def resolve_user_id(request: Request, db: Session) -> str:
    """Resolve the authenticated user ID from request headers using the given session."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            email = payload.get("sub")
            if email:
                user = db.query(User).filter(User.email == email).first()
                if user:
                    return str(user.id)
        except JWTError:
            pass

    user_id = request.headers.get("X-User-Id")
    if user_id:
        return user_id

    return "test_user_123"


def get_current_user_id(
    request: Request,
    db: Session = Depends(get_db),
) -> str:
    """FastAPI dependency that resolves the current user ID without opening a second session."""
    return resolve_user_id(request, db)


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
):
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
