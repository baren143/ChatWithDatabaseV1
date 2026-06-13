from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from sqlalchemy import text
import logging
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from config import get_allowed_origins, get_trusted_hosts
from database import engine, Base
from models import User, Document, DocumentVector, DocumentRow, ensure_vector_indexes  # noqa: F401
from routers.upload import router as upload_router
from routers.reports import router as reports_router
from routers.chat import router as chat_router
from routers.auth import router as auth_router

logger = logging.getLogger(__name__)

# Rate limiter - 30 requests per minute per IP for chat endpoint
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Chat with Database API",
    version="1.0.0",
    description="RAG-powered document chat with structured row retrieval.",
)

# Add slowapi error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
    expose_headers=["Content-Length"],
    max_age=600,
)

# ── Trusted hosts (production hardening) ────────────────────────────────────
_trusted_hosts = get_trusted_hosts()
if _trusted_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=_trusted_hosts)


@app.on_event("startup")
def on_startup() -> None:
    """Register pgvector extension, create all tables, and build indexes."""
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.commit()
        Base.metadata.create_all(bind=engine)
        ensure_vector_indexes(engine)
        logger.info("Database startup tasks completed successfully")
    except Exception as e:
        logger.error("Database startup error (non-blocking): %s", e)
        # Continue even if database isn't ready — useful for development


@app.get("/")
def read_root() -> dict:
    return {
        "message": "FastAPI Backend is running!",
        "version": app.version,
        "docs": "/docs",
    }


@app.get("/health")
def health_check() -> dict:
    return {"status": "healthy"}


# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(upload_router)
app.include_router(chat_router)
app.include_router(reports_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
