#!/usr/bin/env bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directories
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_DIR="$ROOT_DIR/.dev"
VALKEY_DIR="$ROOT_DIR/.valkey"

# Ensure directories exist
mkdir -p "$DEV_DIR"
mkdir -p "$VALKEY_DIR"

# Functions
start_valkey() {
  if valkey-cli ping >/dev/null 2>&1; then
    echo -e "${RED}●${NC} Valkey already running"
  else
    valkey-server --daemonize yes \
      --dir "$VALKEY_DIR" \
      --pidfile "$VALKEY_DIR/valkey.pid" \
      --logfile "$VALKEY_DIR/valkey.log"
    echo -e "${RED}●${NC} Valkey started on port 6379"
  fi
}

stop_valkey() {
  if valkey-cli shutdown nosave 2>/dev/null; then
    echo "  Valkey stopped"
  else
    echo "  Valkey not running"
  fi
}

start_server() {
  cd "$ROOT_DIR/apps/server"
  node --import tsx src/main.ts > "$DEV_DIR/server.log" 2>&1 &
  echo $! > "$DEV_DIR/server.pid"
  echo -e "${GREEN}●${NC} Server started (PID: $(cat "$DEV_DIR/server.pid"))"
}

start_web() {
  cd "$ROOT_DIR/apps/web"
  npx expo start --web --port 8081 --non-interactive > "$DEV_DIR/web.log" 2>&1 &
  echo $! > "$DEV_DIR/web.pid"
  echo -e "${BLUE}●${NC} Web started (PID: $(cat "$DEV_DIR/web.pid"))"
}

stop_service() {
  local name=$1
  local pidfile="$DEV_DIR/$name.pid"
  if [ -f "$pidfile" ]; then
    local pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo "  $name stopped (PID: $pid)"
    else
      echo "  $name not running"
    fi
    rm -f "$pidfile"
  else
    echo "  $name not running"
  fi
}

# Kill any process using a specific port
kill_port() {
  local port=$1
  local pids=$(lsof -ti ":$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
}

check_service() {
  local name=$1
  local pidfile="$DEV_DIR/$name.pid"
  if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    echo -e "  ${GREEN}●${NC} $name running (PID: $(cat "$pidfile"))"
  else
    echo -e "  ${RED}●${NC} $name stopped"
  fi
}

status() {
  echo ""
  echo "📊 Service Status:"
  if valkey-cli ping >/dev/null 2>&1; then
    echo -e "  ${RED}●${NC} Valkey running"
  else
    echo -e "  ${RED}○${NC} Valkey stopped"
  fi
  check_service "server"
  check_service "web"
  echo ""
  echo "🔗 URLs:"
  echo "  Server: http://localhost:3000"
  echo "  Web:    http://localhost:8081"
  echo ""
  echo "📝 Logs:"
  echo "  yarn logs         # All logs"
  echo "  yarn logs:server  # Server only"
  echo "  yarn logs:web     # Web only"
}

case "${1:-start}" in
  start)
    echo "🎬 Starting Mediaserver..."
    echo ""
    # Stop existing services first
    "$0" stop 2>/dev/null || true
    echo ""
    start_valkey
    sleep 1
    start_server
    sleep 1
    start_web
    sleep 2
    status
    ;;
  stop)
    echo "⏹️  Stopping services..."
    stop_service "web"
    stop_service "server"
    stop_valkey
    # Clean up any orphaned processes on our ports
    kill_port 3000
    kill_port 8081
    echo "✅ All services stopped"
    ;;
  status)
    status
    ;;
  restart)
    "$0" stop
    echo ""
    "$0" start
    ;;
  *)
    echo "Usage: $0 {start|stop|status|restart}"
    exit 1
    ;;
esac
