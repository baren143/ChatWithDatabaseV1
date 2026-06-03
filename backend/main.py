from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from config import get_allowed_origins
from database import engine, Base
from models import User, Document, DocumentVector, ensure_vector_indexes  # noqa: F401 — ensure models are imported so tables are registered
from routers.upload import router as upload_router
from routers.chat import router as chat_router

app = FastAPI(title="Chat with Database API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    """Register pgvector extension and create all tables on application startup."""
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        conn.commit()
    Base.metadata.create_all(bind=engine)
    ensure_vector_indexes(engine)

@app.get("/")
def read_root():
    return {"message": "FastAPI Backend is running!"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

app.include_router(upload_router)
app.include_router(chat_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
