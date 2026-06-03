import os
from celery import Celery

broker_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
app = Celery('tasks', broker=broker_url)