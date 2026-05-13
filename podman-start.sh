#!/bin/bash

# LeanStock Podman Helper Script

set -e

ACTION="${1:-up}"
COMPOSE_FILE="${2:-podman-compose.yml}"

echo "=== LeanStock Podman Manager ==="
echo "Using: $COMPOSE_FILE"
echo "Action: $ACTION"
echo ""

case "$ACTION" in
  up)
    echo "🚀 Starting services..."
    podman-compose -f "$COMPOSE_FILE" up -d
    echo ""
    echo "✅ Services started!"
    echo "API: http://localhost:3000"
    echo "Logs: podman logs -f leanstock-app"
    ;;
    
  down)
    echo "🛑 Stopping services..."
    podman-compose -f "$COMPOSE_FILE" down
    echo "✅ Services stopped"
    ;;
    
  restart)
    echo "🔄 Restarting app..."
    podman-compose -f "$COMPOSE_FILE" restart app
    echo "✅ App restarted"
    ;;
    
  rebuild)
    echo "🔨 Rebuilding and starting..."
    podman-compose -f "$COMPOSE_FILE" down
    podman-compose -f "$COMPOSE_FILE" build --no-cache
    podman-compose -f "$COMPOSE_FILE" up -d
    echo ""
    echo "✅ Rebuild complete!"
    ;;
    
  logs)
    echo "📋 Showing logs (Ctrl+C to exit)..."
    podman logs -f leanstock-app
    ;;
    
  migrate)
    echo "🗄️ Running migrations..."
    podman exec -it leanstock-app npx prisma migrate deploy
    ;;
    
  seed)
    echo "🌱 Seeding database..."
    podman exec -it leanstock-app npx ts-node prisma/seed.ts
    ;;
    
  shell)
    echo "🐚 Opening shell in app container..."
    podman exec -it leanstock-app sh
    ;;
    
  psql)
    echo "🐘 Opening PostgreSQL console..."
    podman exec -it leanstock-postgres psql -U leanstock -d leanstock
    ;;
    
  redis)
    echo "⚡ Opening Redis console..."
    podman exec -it leanstock-redis redis-cli
    ;;
    
  status)
    echo "📊 Container status:"
    podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    ;;
    
  clean)
    echo "🧹 Cleaning up (removes volumes)!"
    podman-compose -f "$COMPOSE_FILE" down -v
    podman system prune -f
    echo "✅ Cleanup complete"
    ;;
    
  *)
    echo "Usage: $0 [compose-file] [action]"
    echo ""
    echo "Actions:"
    echo "  up       - Start services (default)"
    echo "  down     - Stop services"
    echo "  restart  - Restart app only"
    echo "  rebuild  - Full rebuild (rarely needed)"
    echo "  logs     - Show app logs"
    echo "  migrate  - Run database migrations"
    echo "  seed     - Seed database"
    echo "  shell    - Open app container shell"
    echo "  psql     - Open PostgreSQL console"
    echo "  redis    - Open Redis console"
    echo "  status   - Show container status"
    echo "  clean    - Remove everything including data"
    echo ""
    echo "Examples:"
    echo "  $0                     # Start with defaults"
    echo "  $0 up podman-compose.dev.yml     # Start in dev mode"
    echo "  $0 rebuild podman-compose.yml    # Full rebuild"
    echo "  $0 logs                # View logs"
    exit 1
    ;;
esac
