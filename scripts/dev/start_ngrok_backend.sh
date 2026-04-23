#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NGROK_BIN="${NGROK_BIN:-$ROOT_DIR/jushi_agent/node_modules/.bin/ngrok}"
TARGET_PORT="${1:-8080}"
LOG_DIR="$ROOT_DIR/.agent/ngrok"
PID_FILE="$LOG_DIR/ngrok-${TARGET_PORT}.pid"
LOG_FILE="$LOG_DIR/ngrok-${TARGET_PORT}.log"
CONF_FILE="$LOG_DIR/ngrok-no-web.yml"

mkdir -p "$LOG_DIR"

if [[ ! -x "$NGROK_BIN" ]]; then
  echo "ERROR: ngrok not found at $NGROK_BIN"
  echo "Run: cd $ROOT_DIR/jushi_agent && npm ci"
  exit 1
fi

if [[ -n "${NGROK_AUTHTOKEN:-}" ]]; then
  "$NGROK_BIN" config add-authtoken "$NGROK_AUTHTOKEN" >/dev/null 2>&1 || true
fi

cat >"$CONF_FILE" <<'EOF'
version: 2
web_addr: false
EOF

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "$OLD_PID" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    PUBLIC_URL="$(sed -nE 's/.*url=(https:\/\/[^ ]+).*/\1/p' "$LOG_FILE" | head -n1 || true)"
    echo "ngrok already running (pid=$OLD_PID)"
    if [[ -n "$PUBLIC_URL" ]]; then
      echo "Public URL: $PUBLIC_URL"
    fi
    exit 0
  fi
fi

"$NGROK_BIN" http "http://127.0.0.1:${TARGET_PORT}" \
  --config "$CONF_FILE" \
  --log=stdout \
  --log-format=logfmt \
  >"$LOG_FILE" 2>&1 &
NGROK_PID=$!
echo "$NGROK_PID" >"$PID_FILE"

PUBLIC_URL=""
for _ in {1..30}; do
  sleep 1
  if ! kill -0 "$NGROK_PID" 2>/dev/null; then
    echo "ERROR: ngrok exited unexpectedly. Log: $LOG_FILE"
    sed -n '1,120p' "$LOG_FILE"
    exit 1
  fi
  PUBLIC_URL="$(sed -nE 's/.*url=(https:\/\/[^ ]+).*/\1/p' "$LOG_FILE" | head -n1 || true)"
  if [[ -n "$PUBLIC_URL" ]]; then
    break
  fi
done

if [[ -z "$PUBLIC_URL" ]]; then
  echo "ERROR: tunnel URL not ready. Check log: $LOG_FILE"
  sed -n '1,120p' "$LOG_FILE"
  exit 1
fi

echo "ngrok started."
echo "PID: $NGROK_PID"
echo "Public URL: $PUBLIC_URL"
echo "Health check: ${PUBLIC_URL}/api/v1/health/"
echo "APK base URL: $PUBLIC_URL"
