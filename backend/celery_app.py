import os
from dotenv import load_dotenv
from celery import Celery

# Load environment variables from .env file
load_dotenv()

broker_url = os.getenv("REDIS_URL")
if not broker_url:
    raise RuntimeError("REDIS_URL environment variable is required")

app = Celery("tasks", broker=broker_url)

app.conf.update(
    imports=("tasks", "watchdog"),
    broker_connection_retry_on_startup=True,
    broker_pool_limit=int(os.getenv("CELERY_BROKER_POOL_LIMIT", "10")),
    broker_transport_options={
        "max_connections": int(os.getenv("REDIS_MAX_CONNECTIONS", "20")),
        "visibility_timeout": int(os.getenv("CELERY_VISIBILITY_TIMEOUT", "3600")),
        "socket_keepalive": True,
        "health_check_interval": int(os.getenv("REDIS_HEALTH_CHECK_INTERVAL", "30")),
    },
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)

# Load the watchdog beat schedule (must be imported after `app` is configured)
import watchdog  # noqa: E402, F401  (registers beat_schedule)
