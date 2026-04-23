#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${1:-8080}"
BACKEND_DIR="$ROOT_DIR/jushi_backend"
BACKEND_PY="$BACKEND_DIR/.venv/bin/python"
STATE_DIR="$ROOT_DIR/.agent/runtime"
BACKEND_PID_FILE="$STATE_DIR/backend-${PORT}.pid"
BACKEND_LOG_FILE="$STATE_DIR/backend-${PORT}.log"

mkdir -p "$STATE_DIR"

is_listening() {
  local target_port="$1"
  lsof -nP -iTCP:"$target_port" -sTCP:LISTEN >/dev/null 2>&1
}

start_backend() {
  if [[ ! -x "$BACKEND_PY" ]]; then
    echo "ERROR: backend runtime not found: $BACKEND_PY"
    echo "Run: cd $BACKEND_DIR && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
    exit 1
  fi

  echo "Starting backend on 127.0.0.1:${PORT} ..."
  (
    cd "$BACKEND_DIR"
    nohup "$BACKEND_PY" start.py >"$BACKEND_LOG_FILE" 2>&1 &
    echo "$!" >"$BACKEND_PID_FILE"
  )

  for _ in {1..30}; do
    if is_listening "$PORT"; then
      local pid
      pid="$(cat "$BACKEND_PID_FILE" 2>/dev/null || true)"
      echo "Backend started (pid=$pid)"
      return 0
    fi
    sleep 1
  done

  echo "ERROR: backend did not become ready on port $PORT"
  echo "Log: $BACKEND_LOG_FILE"
  sed -n '1,120p' "$BACKEND_LOG_FILE" || true
  exit 1
}

if is_listening "$PORT"; then
  echo "Backend already listening on port $PORT, skip start."
else
  start_backend
fi

if [[ "${SKIP_TUNNEL:-0}" == "1" ]]; then
  echo "SKIP_TUNNEL=1, tunnel startup skipped."
  echo "Backend URL: http://127.0.0.1:${PORT}"
  exit 0
fi

echo "Starting ngrok tunnel ..."
"$ROOT_DIR/scripts/dev/start_ngrok_backend.sh" "$PORT"

echo "Done. For APK, fill the 'APK base URL' shown above."
