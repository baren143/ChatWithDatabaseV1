# Production Security & Hardening Guide

Comprehensive security best practices for the Chat with Database production deployment.

## 1. System-Level Security

### Firewall Configuration (UFW)

```bash
# Enable firewall
sudo ufw enable

# Allow SSH (CRITICAL - do this first!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Deny everything else by default
sudo ufw default deny incoming
sudo ufw default allow outgoing

# View rules
sudo ufw status verbose

# Add per-IP SSH restriction (recommended)
sudo ufw allow from 1.2.3.4 to any port 22 comment 'SSH from admin IP'
```

### SSH Hardening

```bash
# Edit SSH configuration
sudo nano /etc/ssh/sshd_config

# Recommended settings:
# - PermitRootLogin no
# - PasswordAuthentication no (use keys only)
# - Port 2222 (change from default 22)
# - AllowUsers ubuntu@*
# - Protocol 2
# - X11Forwarding no

# Restart SSH
sudo systemctl restart ssh
```

### System Updates

```bash
# Enable automatic updates
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Manual updates (do regularly)
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get autoremove -y
```

## 2. Docker & Container Security

### Run Container as Non-Root

Already implemented in Dockerfiles:
```dockerfile
RUN useradd --system --uid 1001 nextjs
USER nextjs
```

### Image Scanning

```bash
# Scan images for vulnerabilities
docker scan saas_backend_prod
docker scan saas_frontend_prod

# Use trivy for comprehensive scanning
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image saas_backend_prod
```

### Resource Limits

Add to docker-compose.prod.yml services:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### Secrets Management (Don't use in .env!)

For truly sensitive data:

```yaml
# Use Docker Secrets (requires Swarm mode)
secrets:
  db_password:
    file: ./secrets/db_password.txt

services:
  db:
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
```

Or use external secret management:
- **HashiCorp Vault**
- **AWS Secrets Manager**
- **Azure Key Vault**
- **1Password**

## 3. Network Security

### Nginx Security Headers

Already configured in nginx.conf, but verify:

```nginx
# HSTS - Force HTTPS
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# Prevent clickjacking
add_header X-Frame-Options "SAMEORIGIN" always;

# Prevent MIME type sniffing
add_header X-Content-Type-Options "nosniff" always;

# XSS Protection
add_header X-XSS-Protection "1; mode=block" always;

# Content Security Policy (recommended)
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;

# Referrer Policy
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### SSL/TLS Configuration

```nginx
# Use strong protocols only
ssl_protocols TLSv1.2 TLSv1.3;

# Strong ciphers
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
ssl_prefer_server_ciphers on;

# Session settings
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_session_tickets off;

# Enable OCSP stapling
ssl_stapling on;
ssl_stapling_verify on;
```

### VPC/Network Isolation

- Use private Docker network (saas_network) - ✓ Already configured
- Internal services not exposed to internet - ✓ Already configured
- Use SSH tunnels for remote access:

```bash
# Port forward to local machine
ssh -L 5432:localhost:5432 user@vps-ip

# Connect to database locally
psql -h localhost -U postgres -d chat_db_prod
```

## 4. Database Security

### PostgreSQL Hardening

```sql
-- Create dedicated database user (not superuser)
CREATE ROLE app_user WITH LOGIN PASSWORD 'strong_password';
GRANT USAGE ON SCHEMA public TO app_user;
GRANT CREATE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

-- Restrict connections
-- Edit postgresql.conf:
# listen_addresses = 'localhost'  (if not using network)
# max_connections = 100
# log_connections = on
# log_disconnections = on
# log_statement = 'all'  (for audit)

-- Enable SSL
# ssl = on
# ssl_cert_file = '/path/to/server.crt'
# ssl_key_file = '/path/to/server.key'
```

### Backup Security

```bash
# Encrypt backups
openssl enc -aes-256-cbc -salt -in backup.sql -out backup.sql.enc

# Decrypt
openssl enc -aes-256-cbc -d -in backup.sql.enc -out backup.sql

# Secure storage location (not in web root)
sudo mkdir -p /var/backups/encrypted
sudo chmod 700 /var/backups/encrypted
```

## 5. Application Security

### CORS Configuration

```env
# Only allow your frontend domain
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# NOT wildcard!
# WRONG: ALLOWED_ORIGINS=*
```

### JWT Secret Management

```bash
# Generate strong JWT secret
openssl rand -base64 32

# Store securely, rotate regularly
# Consider implementing key rotation in application
```

### Input Validation

Already implemented in FastAPI with Pydantic models:

```python
# models.py validates all inputs
class Document(BaseModel):
    title: str = Field(..., max_length=255)
    content: str = Field(..., max_length=10000)
    # Pydantic validates before database insert
```

### Rate Limiting

Already configured with SlowAPI:

```python
# main.py already has rate limiting
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
```

## 6. API Security

### Authentication

- JWT tokens implemented - ✓
- Token expiration configured - ✓
- Refresh token mechanism - ✓

### API Endpoints

```bash
# Test authentication
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Use returned token for authenticated requests
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/protected-endpoint
```

### API Versioning

Consider adding version prefix:

```python
# Include version in routes
app.include_router(upload_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
```

## 7. Logging & Monitoring

### Centralized Logging

```bash
# View logs
./deploy.sh logs backend
./deploy.sh logs worker
./deploy.sh logs db

# Export logs
docker-compose -f docker-compose.prod.yml logs backend > backend.log

# For production, consider:
# - ELK Stack (Elasticsearch, Logstash, Kibana)
# - Splunk
# - Datadog
# - CloudWatch (if using AWS)
```

### Application Logging

Add to FastAPI:

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/app.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)
logger.info("User action: %s", user_action)
```

### Monitor Resource Usage

```bash
# Continuous monitoring
watch -n 1 'docker stats --no-stream'

# Memory leaks detection
docker stats --no-stream | awk '{print $1, $4}'

# Disk usage
du -sh /var/lib/docker/volumes/*
```

## 8. Incident Response

### Security Incident Checklist

```
[ ] Stop the affected service
[ ] Collect logs for forensics
[ ] Isolate the system if necessary
[ ] Identify the attack vector
[ ] Patch/fix the vulnerability
[ ] Review all recent changes
[ ] Restore from backup if needed
[ ] Verify integrity of data
[ ] Re-deploy with fixes
[ ] Enable enhanced monitoring
[ ] Document lessons learned
[ ] Notify stakeholders if data compromised
```

### Container Compromise Response

```bash
# Immediately stop the container
docker-compose -f docker-compose.prod.yml down

# Inspect the image for malware
docker image inspect saas_backend_prod

# Review logs
docker logs saas_backend_prod > incident_logs.txt

# Remove and rebuild from clean base
docker image rm saas_backend_prod
docker-compose -f docker-compose.prod.yml build --no-cache
```

## 9. Compliance & Auditing

### Enable Audit Logging

```bash
# PostgreSQL audit
sudo apt-get install postgresql-contrib
# CREATE EXTENSION pgaudit;

# Docker daemon events
docker events --filter type=container > docker-events.log &

# System audit
sudo apt-get install auditd
```

### Regular Security Audits

```bash
# Weekly checklist
- [ ] Review authentication logs
- [ ] Check for failed login attempts
- [ ] Verify all services are running
- [ ] Test backup restoration
- [ ] Review resource usage
- [ ] Check for security updates
- [ ] Review firewall rules

# Monthly checklist
- [ ] Update all Docker images
- [ ] Scan images for vulnerabilities
- [ ] Rotate credentials/secrets
- [ ] Review access logs
- [ ] Full backup verification
- [ ] Security tool updates
```

## 10. Disaster Recovery

### Backup Verification

```bash
# Test restore process monthly
./deploy.sh backup

# Restore to test environment
./deploy.sh restore backups/latest.sql.gz

# Verify data integrity
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -d chat_db_prod -c "\dt"
```

### High Availability (Advanced)

For production critical systems:

1. **Database Replication**
   - PostgreSQL streaming replication
   - Read replicas for load distribution

2. **Load Balancing**
   - Multiple backend instances
   - Redis Sentinel for failover

3. **Container Orchestration**
   - Docker Swarm mode
   - Kubernetes (if scaling needed)

## Security Tools

### Essential Tools

```bash
# Vulnerability scanner
sudo apt-get install -y trivy

# Port scanning
sudo apt-get install -y nmap

# SSL/TLS testing
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443

# Penetration testing
sudo apt-get install -y nessus metasploit

# Log analysis
sudo apt-get install -y fail2ban
```

### Configuration Files

```bash
# Fail2ban (intrusion prevention)
sudo tee /etc/fail2ban/jail.local > /dev/null <<EOF
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-noscript]
enabled = true
EOF

sudo systemctl restart fail2ban
```

---

**Remember:** Security is a process, not a destination. Continuously monitor, update, and improve your security posture.

For security vulnerabilities, please report responsibly to your security team immediately.

Last Updated: June 3, 2024
