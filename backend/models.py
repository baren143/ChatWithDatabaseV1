import os
import uuid
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector

from database import Base

# pgvector ANN index type: "hnsw" (default, no training) or "ivfflat" (requires sufficient rows)
PGVECTOR_INDEX_TYPE = os.getenv("PGVECTOR_INDEX_TYPE", "hnsw").lower()
PGVECTOR_HNSW_M = int(os.getenv("PGVECTOR_HNSW_M", "16"))
PGVECTOR_HNSW_EF_CONSTRUCTION = int(os.getenv("PGVECTOR_HNSW_EF_CONSTRUCTION", "64"))
PGVECTOR_IVFFLAT_LISTS = int(os.getenv("PGVECTOR_IVFFLAT_LISTS", "100"))


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=True)
    full_name = Column(String, nullable=True)
    subscription_status = Column(String, default="free")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")
    document_vectors = relationship(
        "DocumentVector", back_populates="user", cascade="all, delete-orphan"
    )
    document_rows = relationship(
        "DocumentRow", back_populates="user", cascade="all, delete-orphan"
    )


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    file_name = Column(String, nullable=False)
    # Storage path on disk. Always prefixed with the user's id segment to avoid
    # filename collisions across users uploading files with the same name.
    file_path = Column(String, nullable=False)
    # Stable storage key — separate from file_name so renames in the UI don't
    # invalidate on-disk storage.
    storage_key = Column(String, nullable=False)
    file_size = Column(Integer, default=0)
    mime_type = Column(String, nullable=True)
    status = Column(String, default="pending")
    total_chunks = Column(Integer, default=0)
    processed_chunks = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user = relationship("User", back_populates="documents")
    vectors = relationship("DocumentVector", back_populates="document", cascade="all, delete-orphan")
    rows = relationship("DocumentRow", back_populates="document", cascade="all, delete-orphan")


class DocumentVector(Base):
    __tablename__ = "document_vectors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    text_chunk = Column(Text, nullable=False)
    embedding = Column(Vector(4096), nullable=True)

    user = relationship("User", back_populates="document_vectors")
    document = relationship("Document", back_populates="vectors")

    __table_args__ = (
        Index("ix_document_vectors_user_document", "user_id", "document_id"),
        Index("ix_document_vectors_user_id_id", "user_id", "id"),
    )


class DocumentRow(Base):
    """Structured row storage for tabular documents (CSV / XLSX).

    For non-tabular files this table is left empty — vector retrieval still
    works via DocumentVector.

    Storing rows as structured JSONB (instead of markdown-string chunks)
    lets the chat pipeline do real column-value filtering with SQL/JSONB
    instead of brittle substring matching. The `raw_text` field preserves
    the original line for the LLM context.
    """

    __tablename__ = "document_rows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    sheet_name = Column(String, nullable=False, default="")
    row_index = Column(Integer, nullable=False, default=0)
    # headers: ordered list of column names (cached for speed)
    headers = Column(JSONB, nullable=False, default=list)
    # values: {col_name: col_value, ...} — preserves original strings
    values = Column(JSONB, nullable=False, default=dict)
    # raw_text: the original markdown-table line, kept for LLM context
    raw_text = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="document_rows")
    document = relationship("Document", back_populates="rows")

    __table_args__ = (
        Index("ix_document_rows_user_document", "user_id", "document_id"),
        Index("ix_document_rows_user_sheet", "user_id", "sheet_name"),
        Index("ix_document_rows_user_doc_idx", "user_id", "document_id", "row_index"),
    )


def ensure_vector_indexes(engine) -> None:
    """Create pgvector ANN index on embedding if it does not already exist."""
    if PGVECTOR_INDEX_TYPE == "ivfflat":
        ddl = text(
            f"""
            CREATE INDEX IF NOT EXISTS ix_document_vectors_embedding_ivfflat
            ON document_vectors
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = {PGVECTOR_IVFFLAT_LISTS})
            """
        )
    else:
        ddl = text(
            f"""
            CREATE INDEX IF NOT EXISTS ix_document_vectors_embedding_hnsw
            ON document_vectors
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = {PGVECTOR_HNSW_M}, ef_construction = {PGVECTOR_HNSW_EF_CONSTRUCTION})
            """
        )

    with engine.connect() as conn:
        conn.execute(ddl)
        conn.commit()
