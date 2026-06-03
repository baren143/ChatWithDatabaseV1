# Production Readiness Verification Checklist

Use this checklist before deploying to production to ensure all components are configured correctly.

## Docker Configuration

### docker-compose.prod.yml
- [ ] PostgreSQL service configured
  - [ ] Using `ankane/pgvector:v0.5.1` image
  - [ ] Volume mounted for persistence
  - [ ] Health check enabled
  - [ ] Internal network only (no exposed ports)
  - [ ] Environment variables set via .env
- [ ] Redis service configured
  - [ ] Using `redis:7-alpine` image
  - [ ] Password protection enabled
  - [ ] Health check enabled
  - [ ] Internal network only (no exposed ports)
- [ ] FastAPI backend service
  - [ ] Using custom Dockerfile.prod
  - [ ] Environment variables set correctly
  - [ ] Port 8000 exposed to internal network
  - [ ] Health check enabled
  - [ ] Depends on db and redis
  - [ ] Command: uvicorn with 4 workers
- [ ] Celery worker service
  - [ ] Using custom Dockerfile.prod
  - [ ] Environment variables set correctly
  - [ ] Depends on db and redis
  - [ ] Command: celery worker configured
- [ ] Next.js frontend service
  - [ ] Using custom Dockerfile.prod
  - [ ] Port 3000 exposed to internal network
  - [ ] Health check enabled
  - [ ] Depends on backend
  - [ ] Environment variables for API URL set
- [ ] Docker volumes configured
  - [ ] `postgres_data` volume created
  - [ ] Volume driver is "local"
- [ ] Docker network configured
  - [ ] `saas_network` bridge network created
  - [ ] All services connected to network

### Backend Dockerfile.prod
- [ ] Multi-stage build implemented
  - [ ] Stage 1 (builder) creates wheels
  - [ ] Stage 2 (runtime) minimal size
- [ ] System dependencies
  - [ ] curl included for health checks
- [ ] Python dependencies
  - [ ] Using wheel cache (faster builds)
  - [ ] pip installed and upgraded
- [ ] Application code
  - [ ] Copied correctly
- [ ] Non-root user
  - [ ] appuser created with --system flag
  - [ ] Ownership changed to appuser
- [ ] Port exposed
  - [ ] 8000 exposed
- [ ] Health functionality
  - [ ] Supports both FastAPI and Celery via command
  - [ ] Default command is uvicorn

### Frontend Dockerfile.prod
- [ ] Multi-stage build implemented
  - [ ] Stage 1 (deps) installs dependencies
  - [ ] Stage 2 (builder) builds application
  - [ ] Stage 3 (runner) minimal runtime
- [ ] Node dependencies
  - [ ] npm ci used for dependency installation
  - [ ] Cache cleaned
- [ ] Build process
  - [ ] Next.js build executed
  - [ ] .next directory copied
  - [ ] public directory copied
- [ ] Non-root user
  - [ ] nextjs user created
  - [ ] Ownership changed to nextjs
- [ ] Port exposed
  - [ ] 3000 exposed
- [ ] Health check
  - [ ] Implemented
  - [ ] curl based (not complex)
- [ ] Production settings
  - [ ] NODE_ENV=production
  - [ ] npm start used

## Environment Configuration

### .env.production Template
- [ ] Passwords section present
  - [ ] POSTGRES_PASSWORD with guidance
  - [ ] REDIS_PASSWORD with guidance
  - [ ] JWT_SECRET_KEY with guidance
- [ ] API configuration
  - [ ] NVIDIA_API_KEY placeholder
  - [ ] ALLOWED_ORIGINS placeholder
  - [ ] NEXT_PUBLIC_API_URL placeholder
- [ ] Security notes
  - [ ] Password generation instructions
  - [ ] Secrets management guidance
  - [ ] Rotation recommendations

### .env File (Actual Deployment)
- [ ] All variables filled in
- [ ] No commented values left
- [ ] Passwords are minimum 32 characters
- [ ] ALLOWED_ORIGINS set to your domain
- [ ] JWT_SECRET_KEY is random and strong
- [ ] NEXT_PUBLIC_API_URL matches domain
- [ ] File not committed to Git
- [ ] File has restrictive permissions (600)

## Reverse Proxy Configuration

### nginx.conf
- [ ] HTTP to HTTPS redirect configured
  - [ ] Port 80 redirects to 443
  - [ ] All HTTP traffic redirected
- [ ] HTTPS configuration
  - [ ] Port 443 configured
  - [ ] SSL certificate paths set
  - [ ] TLSv1.2 and TLSv1.3 enabled
- [ ] Security headers
  - [ ] HSTS enabled
  - [ ] X-Frame-Options set
  - [ ] X-Content-Type-Options set
  - [ ] X-XSS-Protection set
  - [ ] Referrer-Policy set
- [ ] Frontend upstream
  - [ ] Proxy to localhost:3000
  - [ ] WebSocket upgrade enabled
  - [ ] Proper headers forwarded
- [ ] Backend upstream
  - [ ] Proxy to localhost:8000
  - [ ] Proper headers forwarded
  - [ ] Timeout settings appropriate

## Deployment Tools

### deploy.sh Script
- [ ] Has execute permissions (755)
- [ ] All commands implemented
  - [ ] start - starts services
  - [ ] stop - stops services
  - [ ] restart - restarts services
  - [ ] status - shows status
  - [ ] logs - shows logs
  - [ ] backup - creates backup
  - [ ] restore - restores backup
  - [ ] update - updates code
  - [ ] health - health checks
  - [ ] shell - opens shell
- [ ] Error handling implemented
- [ ] Help text clear
- [ ] Color coded output

### docker-compose.override.yml
- [ ] Development overrides present
- [ ] Hot reload configured
- [ ] Ports exposed for local development
- [ ] Volume mounts for code
- [ ] Environment set for development

## Security Configuration

### Port Security
- [ ] PostgreSQL (5432) - Internal only ✓
- [ ] Redis (6379) - Internal only ✓
- [ ] FastAPI (8000) - Internal only ✓
- [ ] Next.js (3000) - Internal only ✓
- [ ] HTTP (80) - Public (redirects to 443)
- [ ] HTTPS (443) - Public (proxied by Nginx)

### Data Security
- [ ] Database password strong (32+ chars)
- [ ] Redis password strong (32+ chars)
- [ ] JWT secret strong (32+ chars)
- [ ] CORS properly restricted
- [ ] Secrets not in version control

### Network Security
- [ ] Docker network isolated
- [ ] Services can communicate internally
- [ ] External access only through Nginx
- [ ] SSL/TLS enabled for all external access

## Documentation

### PRODUCTION_DEPLOYMENT.md
- [ ] Prerequisites section complete
- [ ] Setup steps clear and detailed
- [ ] Architecture diagram present
- [ ] Service roles documented
- [ ] Common operations documented
- [ ] Security best practices included
- [ ] Troubleshooting guide present
- [ ] Backup procedures documented

### QUICK_START.md
- [ ] One-time setup commands provided
- [ ] Essential commands listed
- [ ] Services overview table present
- [ ] Port security documented
- [ ] Monitoring commands included
- [ ] Emergency procedures documented

### SECURITY_HARDENING.md
- [ ] System security covered
- [ ] Docker security covered
- [ ] Network security covered
- [ ] Database security covered
- [ ] Application security covered
- [ ] Logging and monitoring covered
- [ ] Incident response covered

### DEPLOYMENT_PACKAGE_SUMMARY.md
- [ ] Overview of all files
- [ ] Architecture diagram
- [ ] Service roles table
- [ ] Security features listed
- [ ] Quick deployment steps
- [ ] File guide present
- [ ] Checklist provided

## Pre-Deployment Testing

### Local Testing
- [ ] docker-compose up works locally
- [ ] All services start successfully
- [ ] Health checks pass
- [ ] Frontend loads at localhost:3000
- [ ] API responds at localhost:8000
- [ ] Database connection works
- [ ] Redis connection works
- [ ] Celery worker processes tasks

### Build Testing
- [ ] Backend image builds without errors
- [ ] Frontend image builds without errors
- [ ] Backend image doesn't have vulnerabilities
- [ ] Frontend image doesn't have vulnerabilities
- [ ] Images are reasonable size

### Image Scanning
- [ ] Run: `docker scan saas_backend_prod`
- [ ] Run: `docker scan saas_frontend_prod`
- [ ] No critical vulnerabilities found
- [ ] Review and address any findings

## VPS Preparation

### System Configuration
- [ ] Ubuntu 22.04 LTS installed
- [ ] System updated and upgraded
- [ ] Docker installed
- [ ] Docker Compose installed
- [ ] Git installed
- [ ] Firewall enabled (UFW)
- [ ] SSH hardened (no root login, key-based only)

### Firewall Rules
- [ ] Port 22 (SSH) allowed from admin IP
- [ ] Port 80 (HTTP) allowed from anywhere
- [ ] Port 443 (HTTPS) allowed from anywhere
- [ ] All other inbound blocked by default

### Domain and SSL
- [ ] Domain name purchased
- [ ] DNS records configured
  - [ ] yourdomain.com → VPS IP
  - [ ] www.yourdomain.com → VPS IP
  - [ ] api.yourdomain.com → VPS IP (if separate)
- [ ] SSL certificate obtained (Let's Encrypt)
- [ ] Certificate paths correct in nginx.conf
- [ ] Certificate auto-renewal configured

### Monitoring and Logging
- [ ] Log rotation configured
- [ ] Backup location prepared
- [ ] Backup script created
- [ ] Cron job for daily backups set
- [ ] Monitoring tools installed (optional)

## Final Verification

### Deployment Commands
- [ ] `docker-compose -f docker-compose.prod.yml build` succeeds
- [ ] `docker-compose -f docker-compose.prod.yml up -d` succeeds
- [ ] `docker-compose -f docker-compose.prod.yml ps` shows all running
- [ ] `./deploy.sh status` shows all healthy
- [ ] `./deploy.sh health` passes all checks

### Service Health
- [ ] PostgreSQL: `./deploy.sh logs db` shows startup complete
- [ ] Redis: `./deploy.sh logs redis` shows ready
- [ ] Backend: `./deploy.sh logs backend` shows "Uvicorn running"
- [ ] Frontend: `./deploy.sh logs frontend` shows started
- [ ] Worker: `./deploy.sh logs worker` shows "Ready to accept tasks"

### API Endpoints
- [ ] `curl http://localhost:8000/` returns success
- [ ] `curl http://localhost:8000/health` returns healthy
- [ ] `curl http://localhost:3000` returns HTML
- [ ] CORS headers present in API responses

### Data Persistence
- [ ] Create test data in frontend
- [ ] Restart containers: `./deploy.sh restart`
- [ ] Verify data persisted
- [ ] Create backup: `./deploy.sh backup`
- [ ] Verify backup file created
- [ ] Test restore process

## Production Deployment

- [ ] All above items checked and passing
- [ ] Team notified of deployment window
- [ ] Backup created before deployment
- [ ] Production domain ready to point to VPS
- [ ] Post-deployment testing plan prepared
- [ ] Rollback procedure documented
- [ ] On-call person assigned
- [ ] Deployment completed successfully
- [ ] Final verification run
- [ ] Team notified of successful deployment
- [ ] Monitoring enabled
- [ ] First automated backup completed

## Post-Deployment

- [ ] Monitor logs for errors: `./deploy.sh logs -f`
- [ ] Verify all services stable after 1 hour
- [ ] Verify all services stable after 24 hours
- [ ] Create second backup to verify backup process
- [ ] Test restore process with second backup
- [ ] Update documentation with any deviations
- [ ] Schedule regular maintenance window
- [ ] Plan security audit for next month

---

## Sign-Off

- [ ] Infrastructure Team Lead: _________________ Date: _____
- [ ] Security Team Lead: _________________ Date: _____
- [ ] Application Owner: _________________ Date: _____

---

**Last Updated:** June 3, 2024  
**Version:** 1.0  
**Status:** Production Deployment Checklist
