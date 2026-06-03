# 🚀 Production Deployment - Complete Setup Guide

**Welcome!** This package contains everything you need to deploy the Chat with Database stack to production on a single Ubuntu VPS.

> **⏱️ Estimated setup time: 30 minutes**

---

## 📦 What You Get

### ✅ Docker Configuration (Production-Hardened)
- **docker-compose.prod.yml** - Complete orchestration with security hardening
- **backend/Dockerfile.prod** - Multi-stage FastAPI + Celery backend
- **frontend/Dockerfile.prod** - Multi-stage Next.js frontend
- **docker-compose.override.yml** - Development mode for testing

### ✅ Web Server & Security
- **nginx.conf** - Production Nginx with SSL/TLS and security headers
- **.env.production** - Environment configuration template

### ✅ Automation Tools
- **deploy.sh** - One-command deployment manager with 10+ operations

### ✅ Comprehensive Documentation (45KB+)
- **QUICK_START.md** - 5-minute rapid deployment guide
- **PRODUCTION_DEPLOYMENT.md** - Complete operational manual
- **SECURITY_HARDENING.md** - Security best practices and configuration
- **PRODUCTION_READINESS_CHECKLIST.md** - Pre-deployment verification
- **DEPLOYMENT_PACKAGE_SUMMARY.md** - Package overview

---

## ⚡ Quick Start (5 Minutes)

### Step 1: Connect to VPS
```bash
ssh user@your-vps-ip
cd /opt
```

### Step 2: Install Docker
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

### Step 3: Clone and Configure
```bash
git clone <your-repo-url> chat-app
cd chat-app

# Create environment file
cp .env.production .env

# Edit with your values (use strong passwords!)
nano .env
```

### Step 4: Deploy
```bash
chmod +x deploy.sh
./deploy.sh start

# Verify
./deploy.sh status
./deploy.sh health
```

### Step 5: Setup HTTPS
```bash
# Install Nginx and Certbot
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Copy config
sudo cp nginx.conf /etc/nginx/sites-available/chat-app
sudo nano /etc/nginx/sites-available/chat-app  # Edit domain names

# Enable and generate certificate
sudo ln -s /etc/nginx/sites-available/chat-app /etc/nginx/sites-enabled/
sudo certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com

# Start Nginx
sudo systemctl restart nginx
```

**Done! Your stack is running.** 🎉

---

## 📚 Documentation Map

**Start Here →** Different paths depending on your need:

### 🏃 I want to deploy NOW
**→ Read:** `QUICK_START.md` (4 KB, 5 min read)

### 🔧 I need detailed deployment instructions
**→ Read:** `PRODUCTION_DEPLOYMENT.md` (12 KB, 20 min read)

### 🔐 I need to secure this properly
**→ Read:** `SECURITY_HARDENING.md` (11 KB, 30 min read)

### ✅ I need to verify everything before going live
**→ Use:** `PRODUCTION_READINESS_CHECKLIST.md` (11 KB checklist)

### 📋 I need a complete overview
**→ Read:** `DEPLOYMENT_PACKAGE_SUMMARY.md` (12 KB overview)

### 📖 I want to understand the full picture
**→ Read:** `INDEX.md` (14 KB complete index)

---

## 🎯 Key Features

### ✅ Production Ready
- Multi-stage Docker builds for minimal image size
- Non-root containers for security
- Health checks and auto-restart
- Resource limits configurable
- SSL/TLS with modern protocols

### ✅ Secure by Default
- Internal Docker network - no internal service exposure
- PostgreSQL, Redis, and FastAPI not accessible from internet
- Security headers configured (HSTS, CSP, X-Frame-Options)
- Password-protected Redis
- CORS restrictions
- JWT authentication

### ✅ Data Safe
- PostgreSQL with pgvector persistence via Docker volumes
- Built-in backup functionality
- Easy restore capability
- Backup encryption support

### ✅ Operations Friendly
- Simple deployment script (`deploy.sh`)
- One-command operations (start, stop, restart, backup, logs)
- Health monitoring
- Centralized logging

---

## 🏗️ Architecture

```
Internet (HTTPS)
    ↓
Nginx (Reverse Proxy, SSL/TLS)
    ├→ Frontend (Next.js, Port 3000)
    └→ Backend (FastAPI, Port 8000)
        ├→ PostgreSQL (Port 5432) - Vector DB
        ├→ Redis (Port 6379) - Task Queue
        └→ Celery - Workers
```

**All internal services are on a private Docker network. Only Nginx is exposed.**

---

## 📊 Services Summary

| Service | Purpose | Port | Exposed |
|---------|---------|------|---------|
| **PostgreSQL** | Document + vector storage | 5432 | ❌ Internal |
| **Redis** | Celery task queue | 6379 | ❌ Internal |
| **FastAPI** | REST API backend | 8000 | ❌ Internal |
| **Celery** | Async workers | N/A | ❌ Internal |
| **Next.js** | Web frontend | 3000 | ❌ Internal |
| **Nginx** | Reverse proxy, SSL/TLS | 80, 443 | ✅ Public |

---

## 🚀 Daily Operations

### Start Services
```bash
./deploy.sh start
```

### Check Status
```bash
./deploy.sh status
./deploy.sh health
```

### View Logs
```bash
./deploy.sh logs              # All services
./deploy.sh logs backend      # Specific service
./deploy.sh logs -f           # Real-time
```

### Create Backup
```bash
./deploy.sh backup
```

### Restore from Backup
```bash
./deploy.sh restore backups/db-20240603-120000.sql.gz
```

### Restart Services
```bash
./deploy.sh restart
```

### Update Code
```bash
./deploy.sh update
```

### Health Checks
```bash
./deploy.sh health
```

**More commands?** Run `./deploy.sh help`

---

## 🔐 Security Checklist

- [ ] Generated 32+ character passwords for: POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET_KEY
- [ ] Created .env file with all values filled
- [ ] Domain name configured with DNS pointing to VPS
- [ ] Firewall configured (UFW) - only allow 22, 80, 443
- [ ] SSH hardened (no password login, key-based only)
- [ ] SSL certificate obtained (Let's Encrypt)
- [ ] Nginx configured with your domain
- [ ] ALLOWED_ORIGINS set to your domain
- [ ] First backup created and tested
- [ ] Monitoring/logging configured
- [ ] Team notified of production URL

See `SECURITY_HARDENING.md` for detailed security configuration.

---

## ⚠️ Important Notes

### 1. Environment Variables
- **Never commit `.env` to Git** - Contains secrets
- **Use .env.production as template only**
- **Generate strong passwords** (use: `openssl rand -base64 32`)

### 2. Data Persistence
- PostgreSQL data is stored in `postgres_data` Docker volume
- Located at: `/var/lib/docker/volumes/postgres_data/_data/`
- **Regular backups required** - test restore monthly

### 3. Certificates
- Use Let's Encrypt for free SSL certificates
- Auto-renewal recommended: `certbot renew --dry-run`
- Update nginx.conf with certificate paths

### 4. Backups
```bash
# Daily automated backup (recommended)
0 2 * * * cd /opt/chat-app && ./deploy.sh backup >> /var/log/backup.log 2>&1
```

### 5. Monitoring
```bash
# Monitor system resources
watch -n 1 'docker stats --no-stream'

# Monitor logs (real-time)
./deploy.sh logs -f
```

---

## 🆘 Troubleshooting

### Services not starting?
```bash
./deploy.sh logs
# Check for errors, restart affected service
./deploy.sh restart
```

### Database not accessible?
```bash
./deploy.sh logs db
# Verify database is running
docker-compose -f docker-compose.prod.yml exec db pg_isready -U postgres
```

### Memory issues?
```bash
docker stats
# Adjust worker concurrency in docker-compose.prod.yml
```

### Port conflicts?
```bash
# Check what's using port 8000
sudo lsof -i :8000
# Check what's using port 3000
sudo lsof -i :3000
```

For more troubleshooting, see `PRODUCTION_DEPLOYMENT.md` section.

---

## 📞 Deployment Verification

After deployment, verify everything works:

```bash
# 1. Check all services are running
./deploy.sh status

# 2. Run health checks
./deploy.sh health

# 3. Test frontend (if you have Nginx running)
curl https://yourdomain.com

# 4. Test API
curl https://yourdomain.com/api/

# 5. Create and verify backup
./deploy.sh backup
ls -lh backups/
```

✅ All passing? **Deployment successful!**

---

## 📋 File Checklist

### Essential Files (Must Have)
- [ ] docker-compose.prod.yml
- [ ] backend/Dockerfile.prod
- [ ] frontend/Dockerfile.prod
- [ ] .env.production (copy to .env)
- [ ] nginx.conf
- [ ] deploy.sh

### Documentation (Reference)
- [ ] QUICK_START.md
- [ ] PRODUCTION_DEPLOYMENT.md
- [ ] SECURITY_HARDENING.md
- [ ] PRODUCTION_READINESS_CHECKLIST.md

### Optional (Good to Have)
- [ ] docker-compose.override.yml (for local dev)
- [ ] INDEX.md (complete reference)

---

## 🎓 Learning Resources

### Docker & Containers
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)

### Web Application Stack
- [FastAPI](https://fastapi.tiangolo.com/)
- [Next.js](https://nextjs.org/docs)
- [Nginx](https://nginx.org/en/docs/)

### Databases
- [PostgreSQL](https://www.postgresql.org/docs/)
- [pgvector](https://github.com/pgvector/pgvector)
- [Redis](https://redis.io/docs/)

### Infrastructure
- [Let's Encrypt](https://letsencrypt.org/)
- [UFW Firewall](https://help.ubuntu.com/community/UFW)

---

## 🚨 Emergency Procedures

### Container Crashed
```bash
./deploy.sh restart
./deploy.sh health
```

### Database Restore Needed
```bash
./deploy.sh restore backups/db-TIMESTAMP.sql.gz
./deploy.sh start
```

### Out of Disk Space
```bash
# Clean up old Docker data
docker system prune -a

# Check disk usage
df -h
```

### Need to Access Container
```bash
./deploy.sh shell backend     # Shell in backend
./deploy.sh shell frontend    # Shell in frontend
```

---

## ✨ Success Indicators

After successful deployment, you should see:

```
✓ All services running (./deploy.sh status)
✓ All health checks passing (./deploy.sh health)
✓ Frontend loads at https://yourdomain.com
✓ API responds at https://yourdomain.com/api/
✓ Database accessible from backend
✓ Celery workers accepting tasks
✓ Logs show no critical errors
✓ Backup created successfully
```

---

## 📞 Getting Help

1. **Quick lookup?** → Check `QUICK_START.md`
2. **Setup issues?** → See `PRODUCTION_DEPLOYMENT.md` troubleshooting
3. **Security concerns?** → Review `SECURITY_HARDENING.md`
4. **Before going live?** → Use `PRODUCTION_READINESS_CHECKLIST.md`
5. **Want full details?** → Read `INDEX.md`

---

## 🎉 Next Steps

1. ✅ Read this file (you're here!)
2. 📖 Read `QUICK_START.md` or `PRODUCTION_DEPLOYMENT.md`
3. 🔧 Prepare your VPS (Ubuntu 22.04)
4. 🚀 Deploy using `deploy.sh`
5. 🔐 Secure with Nginx and SSL
6. 📊 Monitor with `./deploy.sh logs`
7. 💾 Setup automated backups

---

## 📝 Notes for Your Team

**Deployment Date:** _________________  
**Deployed To:** _________________  
**Domain:** _________________  
**Admin:** _________________  
**Backup Location:** _________________

---

**Status:** ✅ Production Ready  
**Last Updated:** June 3, 2024  
**Version:** 1.0

---

*For detailed information on any aspect, see the comprehensive documentation files included in this package.*

**Happy deploying! 🚀**
