#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${1:-8080}"
STATE_DIR="$ROOT_DIR/.agent/runtime"
BACKEND_PID_FILE="$STATE_DIR/backend-${PORT}.pid"

echo "Stopping ngrok tunnel ..."
"$ROOT_DIR/scripts/stop_ngrok_backend.sh" "$PORT"

if [[ ! -f "$BACKEND_PID_FILE" ]]; then
  echo "No managed backend pid file: $BACKEND_PID_FILE"
  exit 0
fi

PID="$(cat "$BACKEND_PID_FILE" 2>/dev/null || true)"
if [[ -z "$PID" ]]; then
  rm -f "$BACKEND_PID_FILE"
  echo "Empty backend pid file removed."
  exit 0
fi

if kill -0 "$PID" 2>/dev/null; then
  kill "$PID" 2>/dev/null || true
  for _ in {1..10}; do
    if ! kill -0 "$PID" 2>/dev/null; then
      break
    fi
    sleep 0.3
  done
  if kill -0 "$PID" 2>/dev/null; then
    kill -9 "$PID" 2>/dev/null || true
  fi
  echo "Stopped backend pid=$PID"
else
  echo "Backend process already stopped (pid=$PID)"
fi

rm -f "$BACKEND_PID_FILE"
echo "Removed $BACKEND_PID_FILE"

