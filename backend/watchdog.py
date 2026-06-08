"""Celery beat schedule: periodic watchdog for stuck processing jobs.

Runs every 5 minutes. Any Document that has been in `processing` for
more than `STUCK_PROCESSING_MINUTES` gets flipped to `error` with a
helpful message, so the user's UI doesn't show "Processing…" forever
when a worker crashed mid-job.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone

from celery_app import app as celery_app
from celery.schedules import schedule
from database import SessionLocal
from models import Document
from sqlalchemy import update

logger = logging.getLogger(__name__)

STUCK_PROCESSING_MINUTES = int(os.getenv("STUCK_PROCESSING_MINUTES", "30"))


@celery_app.task(name="tasks.watchdog_stuck_documents")
def watchdog_stuck_documents() -> int:
    """Mark long-stuck `processing` documents as `error`.

    Returns the number of documents flipped.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=STUCK_PROCESSING_MINUTES)
    db = SessionLocal()
    try:
        result = db.execute(
            update(Document)
            .where(Document.status == "processing")
            .where(Document.updated_at < cutoff)
            .values(
                status="error",
                error_message=(
                    f"Processing exceeded {STUCK_PROCESSING_MINUTES} minutes "
                    "without completion. The worker may have crashed."
                ),
            )
        )
        db.commit()
        n = result.rowcount or 0
        if n:
            logger.warning("Watchdog flipped %d stuck document(s) to error", n)
        return n
    except Exception:
        logger.exception("Watchdog task failed")
        db.rollback()
        return 0
    finally:
        db.close()


# ── Beat schedule ────────────────────────────────────────────────────────────

celery_app.conf.beat_schedule = {
    "watchdog-stuck-documents": {
        "task": "tasks.watchdog_stuck_documents",
        # Every 5 minutes
        "schedule": schedule(run_every=300.0),
    },
}
celery_app.conf.timezone = "UTC"
