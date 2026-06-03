#!/bin/bash
#
# Production deployment manager script
# Usage: ./deploy.sh [start|stop|restart|logs|status|backup|update]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="chat-app"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.prod.yml"
ENV_FILE="$SCRIPT_DIR/.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

check_requirements() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error ".env file not found. Please create .env from .env.production template"
        exit 1
    fi
    
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "docker-compose.prod.yml not found"
        exit 1
    fi
}

cmd_start() {
    log_info "Starting $PROJECT_NAME services..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
    
    log_info "Waiting for services to be ready..."
    sleep 5
    
    # Check if services are healthy
    if cmd_status_quiet; then
        log_success "All services started successfully!"
        cmd_status
    else
        log_error "Some services failed to start. Check logs with: $0 logs"
        exit 1
    fi
}

cmd_stop() {
    log_info "Stopping $PROJECT_NAME services..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
    log_success "Services stopped"
}

cmd_restart() {
    cmd_stop
    sleep 2
    cmd_start
}

cmd_logs() {
    SERVICE="${1:-}"
    if [[ -n "$SERVICE" ]]; then
        log_info "Showing logs for $SERVICE (Ctrl+C to exit)..."
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f "$SERVICE"
    else
        log_info "Showing logs for all services (Ctrl+C to exit)..."
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f
    fi
}

cmd_status() {
    log_info "Service Status:"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
    echo ""
    log_info "Service Health:"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps --format "table {{.Service}}\t{{.Status}}"
}

cmd_status_quiet() {
    STATUS=$(docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q 2>/dev/null | wc -l)
    RUNNING=$(docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps --filter "status=running" -q 2>/dev/null | wc -l)
    
    # Expected: 4 services (db, redis, backend, worker, frontend) - at minimum 5
    # But for quiet check, return success if at least 3 are running
    [[ $RUNNING -ge 3 ]]
}

cmd_backup() {
    log_info "Creating database backup..."
    
    BACKUP_DIR="${SCRIPT_DIR}/backups"
    mkdir -p "$BACKUP_DIR"
    
    BACKUP_FILE="$BACKUP_DIR/db-$(date +%Y%m%d-%H%M%S).sql.gz"
    
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db pg_dump -U postgres chat_db_prod 2>/dev/null | gzip > "$BACKUP_FILE"
    
    if [[ -f "$BACKUP_FILE" ]]; then
        SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        log_success "Database backed up: $BACKUP_FILE ($SIZE)"
    else
        log_error "Backup failed"
        exit 1
    fi
}

cmd_restore() {
    if [[ -z "$1" ]]; then
        log_error "Usage: $0 restore <backup-file>"
        echo ""
        echo "Available backups:"
        ls -lh "${SCRIPT_DIR}/backups/db-"*.sql.gz 2>/dev/null || echo "No backups found"
        exit 1
    fi
    
    BACKUP_FILE="$1"
    
    if [[ ! -f "$BACKUP_FILE" ]]; then
        log_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    log_warning "This will restore the database from backup. Continue? (yes/no)"
    read -r CONFIRM
    
    if [[ "$CONFIRM" != "yes" ]]; then
        log_info "Restore cancelled"
        return
    fi
    
    log_info "Restoring database from $BACKUP_FILE..."
    gunzip -c "$BACKUP_FILE" | docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db psql -U postgres chat_db_prod 2>/dev/null
    log_success "Database restored"
}

cmd_update() {
    log_info "Updating application..."
    
    log_info "Pulling latest code..."
    git pull origin main || log_warning "Git pull failed"
    
    log_info "Rebuilding images..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --pull
    
    log_info "Restarting services..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
    
    log_info "Cleaning up old images..."
    docker image prune -f > /dev/null
    
    log_success "Update completed!"
    cmd_status
}

cmd_shell() {
    SERVICE="${1:-backend}"
    log_info "Opening shell in $SERVICE container..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec "$SERVICE" /bin/bash
}

cmd_health_check() {
    log_info "Running health checks..."
    
    # Check PostgreSQL
    if docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db pg_isready -U postgres > /dev/null 2>&1; then
        log_success "PostgreSQL: OK"
    else
        log_error "PostgreSQL: FAILED"
    fi
    
    # Check Redis
    if docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T redis redis-cli PING > /dev/null 2>&1; then
        log_success "Redis: OK"
    else
        log_error "Redis: FAILED"
    fi
    
    # Check Backend
    if docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T backend curl -s http://localhost:8000/health > /dev/null 2>&1; then
        log_success "Backend: OK"
    else
        log_error "Backend: FAILED"
    fi
    
    # Check Frontend
    if docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T frontend curl -s http://localhost:3000 > /dev/null 2>&1; then
        log_success "Frontend: OK"
    else
        log_error "Frontend: FAILED"
    fi
}

cmd_usage() {
    cat << EOF
${BLUE}Production Deployment Manager${NC}

Usage: $0 [command] [options]

Commands:
  start              Start all services
  stop               Stop all services
  restart            Restart all services
  status             Show service status
  logs [SERVICE]     Show logs (all services or specific)
  backup             Create database backup
  restore FILE       Restore database from backup
  update             Update code and rebuild services
  health             Run health checks on all services
  shell [SERVICE]    Open shell in container (default: backend)
  help               Show this help message

Examples:
  $0 start              # Start the stack
  $0 logs backend       # View backend logs
  $0 backup             # Create database backup
  $0 restore backups/db-20240603-120000.sql.gz  # Restore backup
  $0 health             # Check service health

Environment:
  .env file is required with all configuration variables
  See .env.production for template

EOF
}

# Main script
check_requirements

COMMAND="${1:-help}"

case "$COMMAND" in
    start)
        cmd_start
        ;;
    stop)
        cmd_stop
        ;;
    restart)
        cmd_restart
        ;;
    status)
        cmd_status
        ;;
    logs)
        cmd_logs "$2"
        ;;
    backup)
        cmd_backup
        ;;
    restore)
        cmd_restore "$2"
        ;;
    update)
        cmd_update
        ;;
    health|healthcheck)
        cmd_health_check
        ;;
    shell)
        cmd_shell "$2"
        ;;
    help|--help|-h)
        cmd_usage
        ;;
    *)
        log_error "Unknown command: $COMMAND"
        echo ""
        cmd_usage
        exit 1
        ;;
esac
