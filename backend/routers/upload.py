import os
import re
import logging
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from dependencies import get_current_user_id
from models import Document, User
from tasks import process_document

router = APIRouter(
    prefix="/api",
    tags=["upload"],
)
logger = logging.getLogger(__name__)

# Configuration
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_EXTENSIONS = {'.pdf', '.txt', '.csv', '.xlsx', '.xls', '.doc', '.docx', '.md'}
UPLOAD_DIR = Path(os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads"))


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal attacks."""
    # Remove path components
    filename = Path(filename).name
    # Replace non-alphanumeric characters (except dots and hyphens) with underscores
    filename = re.sub(r'[^\w\-.]', '_', filename)
    # Limit length
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:255 - len(ext)] + ext
    return filename


def is_allowed_file(filename: str) -> bool:
    """Check if file extension is allowed."""
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


@router.post("/upload")
def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    # Validate file size
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Reset to beginning
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE // (1024*1024)} MB"
        )
    
    # Validate file extension
    if not is_allowed_file(file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Ensure the uploads directory exists
    UPLOAD_DIR.mkdir(exist_ok=True)

    # Upsert the user row so the FK constraint on Document.user_id is satisfied.
    existing_user = db.query(User).filter(User.id == user_id).first()
    if not existing_user:
        new_user = User(id=user_id, email=f"{user_id}@local.dev")
        db.add(new_user)
        db.commit()

    # Sanitize filename and save the file to disk
    safe_filename = sanitize_filename(file.filename)
    file_path = UPLOAD_DIR / safe_filename
    
    try:
        with open(file_path, "wb") as f:
            f.write(file.file.read())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write file: {e}")

    # Create the document record with status 'processing'
    document = Document(
        user_id=user_id,
        file_name=safe_filename,  # Store sanitized filename
        file_path=str(file_path),
        status="processing",
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    # Process document asynchronously using Celery worker
    # This prevents blocking the API request and allows proper scaling
    process_document.delay(document.id)

    return {"id": document.id, "document_id": document.id, "status": document.status}


@router.get("/documents/{document_id}")
def get_document(
    document_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve the status of a document by its ID."""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": document.id, 
        "status": document.status, 
        "file_name": document.file_name,
        "total_chunks": document.total_chunks,
        "processed_chunks": document.processed_chunks
    }


@router.get("/documents")
def list_documents(
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    """List all documents belonging to the authenticated user."""
    documents = db.query(Document).filter(Document.user_id == current_user_id).all()
    return [{
        "id": d.id, 
        "file_name": d.file_name, 
        "status": d.status,
        "total_chunks": d.total_chunks,
        "processed_chunks": d.processed_chunks
    } for d in documents]


@router.delete("/documents/{document_id}")
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    """Securely delete a document, its database record, stored vectors, and physical file."""
    from models import DocumentVector

    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Authorize deletion
    if document.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this document")

    try:
        # a) Purge associated vectors
        db.query(DocumentVector).filter(DocumentVector.document_id == document_id).delete()

        # b) Safely delete physical file from disk
        if os.path.exists(document.file_path):
            try:
                os.remove(document.file_path)
            except Exception:
                logger.exception(
                    "Failed to delete physical file for document %s", document_id
                )

        # c) Delete document row
        db.delete(document)
        db.commit()
        return {"status": "success", "message": "Document deleted successfully"}
    except Exception:
        db.rollback()
        logger.exception("Failed to delete document %s", document_id)
        raise HTTPException(status_code=500, detail="Failed to delete document")