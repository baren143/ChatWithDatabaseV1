"""Migration: Add GIN/tsvector index for full-text keyword search on document_vectors.

Run after the main app has created the tables:
    python migrate_add_fts.py
"""

import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:postgres_password@localhost:5432/chat_db",
)
engine = create_engine(DATABASE_URL)

with engine.begin() as conn:
    # Add tsvector generated column
    conn.execute(
        text(
            """
        ALTER TABLE document_vectors
        ADD COLUMN IF NOT EXISTS text_search tsvector
        GENERATED ALWAYS AS (to_tsvector('english', coalesce(text_chunk, ''))) STORED
        """
        )
    )
    # Add GIN index for fast full-text search
    conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_document_vectors_text_search_gin "
            "ON document_vectors USING GIN (text_search)"
        )
    )
    print("✅ Full-text search index created on document_vectors.text_chunk")

print("Migration complete.")
