import os

from dotenv import load_dotenv

load_dotenv()


def get_allowed_origins() -> list[str]:
    """Parse comma-separated frontend URLs for CORSMiddleware."""
    raw = os.getenv("ALLOWED_ORIGINS", "")
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    if not origins:
        raise RuntimeError(
            "ALLOWED_ORIGINS is required. Set a comma-separated list of frontend URLs "
            "(e.g. https://app.example.com,https://www.app.example.com)."
        )
    return origins
