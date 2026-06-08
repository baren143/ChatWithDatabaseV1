import os
import logging

from dotenv import load_dotenv

logger = logging.getLogger(__name__)
load_dotenv()


def get_allowed_origins() -> list[str]:
    """Parse comma-separated frontend URLs for CORSMiddleware.

    In development (DEBUG=true) we permit common localhost origins. In
    production, ALLOWED_ORIGINS must be set to the public frontend URL.
    """
    is_debug = os.getenv("DEBUG", "").lower() in ("1", "true", "yes")
    raw = os.getenv("ALLOWED_ORIGINS", "")
    origins = [o.strip() for o in raw.split(",") if o.strip()]

    if not origins:
        if is_debug:
            origins = [
                "http://localhost:3000",
                "http://localhost:8080",
                "http://127.0.0.1:3000",
            ]
            logger.info("DEBUG mode: using localhost CORS defaults")
        else:
            logger.warning(
                "ALLOWED_ORIGINS not set in production — using empty list (CORS will block)"
            )
            origins = []

    logger.info("CORS allowed origins: %s", origins)
    return origins


def get_trusted_hosts() -> list[str]:
    """Parse TRUSTED_HOSTS env var for TrustedHostMiddleware.

    Returns an empty list if not set, which disables the middleware.
    """
    raw = os.getenv("TRUSTED_HOSTS", "")
    hosts = [h.strip() for h in raw.split(",") if h.strip()]
    if hosts:
        logger.info("Trusted hosts: %s", hosts)
    return hosts
