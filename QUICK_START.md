# Docker Production Deployment - Quick Reference

## One-Time Setup

```bash
# 1. SSH into your VPS
ssh user@your-vps-ip

# 2. Clone repository
cd /opt
git clone <your-repo-url>
cd ChatWithDatabaseV1

# 3. Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 4. Create and configure .env file
cp .env.production .env
nano .env  # Edit with your values

# 5. Generate secure passwords
openssl rand -base64 32  # Run 3 times for: POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET_KEY

# 6. Make deploy script executable
chmod +x deploy.sh

# 7. Start the stack
./deploy.sh start

# 8. Verify all services are running
./deploy.sh status
./deploy.sh health
```

## Essential Commands

```bash
# View all services status
./deploy.sh status

# View logs (real-time)
./deploy.sh logs

# View specific service logs
./deploy.sh logs backend
./deploy.sh logs worker
./deploy.sh logs frontend

# Restart all services
./deploy.sh restart

# Create database backup
./deploy.sh backup

# Restore from backup
./deploy.sh restore backups/db-20240603-120000.sql.gz

# Run health checks
./deploy.sh health

# Update and rebuild
./deploy.sh update

# Open shell in container
./deploy.sh shell backend
./deploy.sh shell backend
```

## Services Overview

| Service | Port | Purpose | Exposed |
|---------|------|---------|---------|
| **PostgreSQL** | 5432 | Document storage + vectors | ❌ Internal only |
| **Redis** | 6379 | Task queue + caching | ❌ Internal only |
| **FastAPI Backend** | 8000 | REST API | ✅ Via Nginx proxy |
| **Celery Worker** | N/A | Async tasks | ❌ Internal only |
| **Next.js Frontend** | 3000 | Web UI | ✅ Via Nginx proxy |
| **Nginx** | 80/443 | SSL/TLS + routing | ✅ Public |

## Port Security

```
Internet ──(HTTPS 443)──> Nginx ──(HTTP)──> Frontend (3000)
                              │
                              └──(HTTP)──> Backend (8000)

Database (5432) ──────────> Internal Network Only
Redis (6379) ──────────────> Internal Network Only
```

## Monitoring & Maintenance

```bash
# Monitor system resources
docker stats

# View all volumes
docker volume ls

# Check disk usage
du -sh /var/lib/docker/volumes/*/

# Prune old Docker data
docker system prune -a

# Update Docker images
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## Troubleshooting

```bash
# Check if container is running
docker-compose -f docker-compose.prod.yml ps

# View detailed logs
docker-compose -f docker-compose.prod.yml logs backend

# Restart a specific service
docker-compose -f docker-compose.prod.yml restart backend

# Test backend health endpoint
curl http://localhost:8000/health

# Test frontend
curl http://localhost:3000

# Check network connectivity
docker network inspect saas_network
```

## Security Checklist

- [ ] Changed all default passwords
- [ ] Generated min 32-char random passwords
- [ ] Setup Nginx with SSL certificate
- [ ] Configured firewall (UFW)
- [ ] Set ALLOWED_ORIGINS to your domain
- [ ] Verified .env not committed to Git
- [ ] Setup automated backups
- [ ] Configured log rotation
- [ ] Tested database backups
- [ ] Set up monitoring/alerts

## Emergency Procedures

### Database is down
```bash
./deploy.sh logs db
docker-compose -f docker-compose.prod.yml restart db
./deploy.sh health
```

### Redis not responding
```bash
docker-compose -f docker-compose.prod.yml restart redis
```

### Full restart needed
```bash
./deploy.sh stop
sleep 5
./deploy.sh start
./deploy.sh health
```

### Restore from backup
```bash
# List available backups
ls -lh backups/

# Stop services
./deploy.sh stop

# Restore database
./deploy.sh restore backups/db-TIMESTAMP.sql.gz

# Start services
./deploy.sh start
```

---

For detailed information, see **PRODUCTION_DEPLOYMENT.md**
