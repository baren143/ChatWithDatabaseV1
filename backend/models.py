import uuid
from sqlalchemy import Column, String, Integer, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector

from database import Base


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