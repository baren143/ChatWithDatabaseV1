import os
import logging

from dotenv import load_dotenv

logger = logging.getLogger(__name__)
load_dotenv()


def get_allowed_origins() -> list[str]:
    """Parse comma-separated frontend URLs for CORSMiddleware."""
    raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8080")
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    if not origins:
        # Fallback for development
        origins = ["http://localhost:3000", "http://localhost:8080"]
        logger.warning("ALLOWED_ORIGINS not set, using development defaults")
    logger.info(f"CORS allowed origins: {origins}")
    return origins
