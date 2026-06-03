FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir --timeout=100 -r requirements.txt

# Copy application code
COPY . .

# Create non-root user for security
RUN useradd --create-home appuser
WORKDIR /app
RUN chown -R appuser:appuser /app
USER appuser

# Expose port (though worker doesn't need it exposed)
EXPOSE 8000

# Default command (will be overridden in docker-compose)
CMD ["python", "-m", "celery", "-A", "celery_app", "worker", "--loglevel=info"]