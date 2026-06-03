import os
import uuid
from sqlalchemy import Column, String, Integer, Text, ForeignKey, Index, text
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
    email = Column(String, unique=True, nullable=False)
    subscription_status = Column(String, default="free")

    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")
    document_vectors = relationship("DocumentVector", back_populates="user", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    status = Column(String, default="pending")
    total_chunks = Column(Integer, default=0)
    processed_chunks = Column(Integer, default=0)

    user = relationship("User", back_populates="documents")
    vectors = relationship("DocumentVector", back_populates="document", cascade="all, delete-orphan")


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
