from sqlalchemy import create_engine, inspect, text

DATABASE_URL = "postgresql+psycopg://postgres:postgres_password@localhost:5432/chat_db"

engine = create_engine(DATABASE_URL)

with engine.begin() as conn:
    users_columns = inspect(engine).get_columns('users')
    documents_columns = inspect(engine).get_columns('documents')

    if 'full_name' not in [col['name'] for col in users_columns]:
        conn.execute(text("ALTER TABLE users ADD COLUMN full_name VARCHAR;"))
        print("Added full_name column to users table.")

    if 'is_active' not in [col['name'] for col in users_columns]:
        conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;"))
        print("Added is_active column to users table.")

    if 'created_at' not in [col['name'] for col in users_columns]:
        conn.execute(text("ALTER TABLE users ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;"))
        print("Added created_at column to users table.")

    if 'storage_key' not in [col['name'] for col in documents_columns]:
        conn.execute(text("ALTER TABLE documents ADD COLUMN storage_key VARCHAR;"))
        conn.execute(text("UPDATE documents SET storage_key = file_path;"))
        conn.execute(text("ALTER TABLE documents ALTER COLUMN storage_key SET NOT NULL;"))
        print("Added storage_key column to documents table.")

    if 'file_size' not in [col['name'] for col in documents_columns]:
        conn.execute(text("ALTER TABLE documents ADD COLUMN file_size INTEGER NOT NULL DEFAULT 0;"))
        print("Added file_size column to documents table.")

    if 'mime_type' not in [col['name'] for col in documents_columns]:
        conn.execute(text("ALTER TABLE documents ADD COLUMN mime_type VARCHAR;"))
        print("Added mime_type column to documents table.")

    if 'error_message' not in [col['name'] for col in documents_columns]:
        conn.execute(text("ALTER TABLE documents ADD COLUMN error_message TEXT;"))
        print("Added error_message column to documents table.")

    if 'created_at' not in [col['name'] for col in documents_columns]:
        conn.execute(text("ALTER TABLE documents ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;"))
        print("Added created_at column to documents table.")

    if 'updated_at' not in [col['name'] for col in documents_columns]:
        conn.execute(text("ALTER TABLE documents ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;"))
        print("Added updated_at column to documents table.")
