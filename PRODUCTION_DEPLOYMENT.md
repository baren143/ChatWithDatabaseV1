# Production Deployment Guide

Complete guide for deploying the Chat with Database stack to a production Ubuntu VPS.

## Prerequisites

- Ubuntu 22.04 LTS or later
- Docker and Docker Compose installed
- Domain name (for SSL/HTTPS)
- SSH access to VPS
- Root or sudo privileges

## Quick Setup Steps

### 1. Install Docker and Docker Compose

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version

# Restart to apply docker group changes
exit
# SSH back in
```

### 2. Deploy Application

```bash
# Clone or upload repository
cd /opt/chat-app  # or your preferred directory

# Copy environment configuration
cp .env.production .env

# Edit .env with your values
nano .env

# Build and start containers
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Verify all services are running
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f
```

### 3. Setup Nginx Reverse Proxy (Recommended)

```bash
# Install Nginx
sudo apt-get install -y nginx

# Copy nginx configuration
sudo cp nginx.conf /etc/nginx/sites-available/chat-app

# Edit configuration with your domain
sudo nano /etc/nginx/sites-available/chat-app
# Replace:
#   yourdomain.com → your actual domain
#   api.yourdomain.com → your API subdomain

# Enable the site
sudo ln -s /etc/nginx/sites-available/chat-app /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 4. Setup SSL Certificate with Let's Encrypt

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Generate SSL certificate
sudo certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com

# Restart Nginx
sudo systemctl restart nginx

# Setup automatic renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

## File Structure

```
.
├── docker-compose.prod.yml      # Production compose configuration
├── .env.production              # Production environment template
├── nginx.conf                   # Nginx reverse proxy config
├── backend/
│   ├── Dockerfile.prod          # Multi-stage production backend build
│   ├── requirements.txt
│   ├── main.py
│   ├── celery_app.py
│   └── ...
├── frontend/
│   ├── Dockerfile.prod          # Multi-stage production frontend build
│   ├── package.json
│   ├── next.config.ts
│   └── ...
└── PRODUCTION_DEPLOYMENT.md     # This file
```

## Service Architecture

```
┌─────────────────────────────────────────────────┐
│              Internet / HTTPS (443)              │
└────────────────────┬────────────────────────────┘
                     │
                ┌────▼────┐
                │  Nginx   │ (Reverse Proxy, SSL/TLS)
                └────┬────┘
                     │
        ┌────────────┴────────────┐
        │                         │
   ┌────▼────┐             ┌─────▼────┐
   │Frontend  │             │ Backend  │
   │(Next.js) │             │(FastAPI) │
   │Port 3000 │             │Port 8000 │
   └────┬────┘             └─────┬────┘
        │                        │
        └────────┬───────────────┘
                 │
        ┌────────┴──────────┬─────────────┐
        │                   │             │
   ┌────▼────┐        ┌────▼────┐  ┌────▼──────┐
   │Postgres │        │  Redis   │  │Celery     │
   │Port 5432│        │Port 6379 │  │Worker     │
   │(internal)│       │(internal)│  │(internal) │
   └─────────┘        └─────────┘  └───────────┘
```

## Port Mapping

**Public (via Nginx):**
- Port 80 (HTTP) → redirects to 443
- Port 443 (HTTPS) → Nginx reverse proxy

**Private (Docker network only):**
- Port 3000: Next.js Frontend
- Port 8000: FastAPI Backend
- Port 5432: PostgreSQL Database
- Port 6379: Redis Cache

## Environment Variables

All variables must be set in `.env` file. Key variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_USER` | DB username | `postgres` |
| `POSTGRES_PASSWORD` | DB password (min 32 chars) | See below |
| `POSTGRES_DB` | Database name | `chat_db_prod` |
| `REDIS_PASSWORD` | Redis password (min 32 chars) | See below |
| `JWT_SECRET_KEY` | JWT signing key (min 32 chars) | See below |
| `NVIDIA_API_KEY` | LLM API key | `nvapi-xxx` |
| `ALLOWED_ORIGINS` | CORS allowed domains | `https://yourdomain.com` |
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://api.yourdomain.com` |

## Generate Secure Passwords

```bash
# Generate a 32-character random password
openssl rand -base64 32

# Generate multiple passwords at once
for i in {1..3}; do echo "Password $i:"; openssl rand -base64 32; done
```

## Common Operations

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f worker
docker-compose -f docker-compose.prod.yml logs -f frontend

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100
```

### Restart Services

```bash
# Restart all services
docker-compose -f docker-compose.prod.yml restart

# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend

# Stop and start (cleans up better)
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild images
docker-compose -f docker-compose.prod.yml build

# Apply changes
docker-compose -f docker-compose.prod.yml up -d

# Clean up old images
docker image prune -f
```

### Database Backup

```bash
# Backup PostgreSQL
docker-compose -f docker-compose.prod.yml exec db pg_dump -U postgres chat_db_prod > backup-$(date +%Y%m%d-%H%M%S).sql

# Restore from backup
docker-compose -f docker-compose.prod.yml exec -T db psql -U postgres chat_db_prod < backup-20240603-120000.sql
```

### Monitor System Resources

```bash
# View Docker stats
docker stats

# View disk usage
du -sh /var/lib/docker/volumes/*/

# Check system resources
free -h
df -h
```

## Security Best Practices

### 1. Firewall Configuration

```bash
# Enable UFW firewall
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

### 2. Regular Updates

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Pull latest Docker images
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# Prune unused resources
docker system prune -a -f
```

### 3. Monitoring and Alerts

```bash
# Setup Systemd service for auto-restart
sudo tee /etc/systemd/system/docker-compose-app.service > /dev/null <<EOF
[Unit]
Description=Docker Compose App
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/chat-app
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d
RemainAfterExit=true
StandardOutput=journal

[Install]
WantedBy=multi-user.target
EOF

# Enable service
sudo systemctl daemon-reload
sudo systemctl enable docker-compose-app
sudo systemctl start docker-compose-app
```

### 4. Log Rotation

```bash
# Create logrotate config
sudo tee /etc/logrotate.d/docker-compose-app > /dev/null <<EOF
/var/lib/docker/containers/*/*.log {
  max-size 10m
  max-backups 10
  compress
  delaycompress
  missingok
}
EOF
```

### 5. Secrets Management (Advanced)

For production deployments with multiple environments, consider:

- **HashiCorp Vault**: Centralized secret management
- **AWS Secrets Manager**: If using AWS infrastructure
- **Docker Secrets**: For Docker Swarm deployments
- **Environment-specific .env files**: Store outside Git in secure locations

Do NOT commit `.env` files with secrets to version control.

## Troubleshooting

### Services not starting

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs backend
docker-compose -f docker-compose.prod.yml logs frontend

# Check health status
docker-compose -f docker-compose.prod.yml ps

# Remove and recreate
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### Database connection issues

```bash
# Check if DB is accessible
docker-compose -f docker-compose.prod.yml exec db pg_isready -U postgres

# Check Redis connectivity
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping

# Verify network
docker network ls
docker network inspect saas_network
```

### Frontend/Backend communication issues

```bash
# Check if services are on same network
docker network inspect saas_network

# Test backend health
docker-compose -f docker-compose.prod.yml exec backend curl http://localhost:8000/health

# Check CORS configuration
# Verify ALLOWED_ORIGINS in .env
```

### Celery worker not processing tasks

```bash
# Check worker logs
docker-compose -f docker-compose.prod.yml logs -f worker

# Verify Redis connection
docker-compose -f docker-compose.prod.yml exec redis redis-cli PING

# Check pending tasks
docker-compose -f docker-compose.prod.yml exec redis redis-cli --raw
# Then in redis-cli: KEYS "*" to see all keys
```

## Performance Optimization

### 1. Database Optimization

```sql
-- Create indexes for frequently queried columns
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_vectors_document_id ON vectors(document_id);

-- Vacuum database
VACUUM ANALYZE;
```

### 2. Redis Optimization

```bash
# Monitor Redis performance
docker-compose -f docker-compose.prod.yml exec redis redis-cli INFO stats
```

### 3. Backend Concurrency

```bash
# Adjust workers in docker-compose.prod.yml
command: uvicorn main:app --host 0.0.0.0 --port 8000 --workers 8
```

### 4. Frontend Caching

Configure in nginx.conf to cache static assets:

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

## Backup and Disaster Recovery

### Daily Backup Script

```bash
#!/bin/bash
# /usr/local/bin/backup-app.sh

BACKUP_DIR="/backups/chat-app"
mkdir -p $BACKUP_DIR

# Backup database
docker-compose -f /opt/chat-app/docker-compose.prod.yml exec -T db pg_dump -U postgres chat_db_prod | gzip > $BACKUP_DIR/db-$(date +%Y%m%d-%H%M%S).sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "db-*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR"
```

Schedule with cron:

```bash
# Edit crontab
crontab -e

# Add line (runs daily at 2 AM)
0 2 * * * /usr/local/bin/backup-app.sh
```

## Support and Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Celery Documentation](https://docs.celeryproject.io/)

---

**Last Updated:** June 3, 2024
**Status:** Production Ready
