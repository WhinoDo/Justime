#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET_PORT="${1:-8080}"
LOG_DIR="$ROOT_DIR/.agent/ngrok"
PID_FILE="$LOG_DIR/ngrok-${TARGET_PORT}.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "No pid file found for port $TARGET_PORT ($PID_FILE)"
  exit 0
fi

PID="$(cat "$PID_FILE" 2>/dev/null || true)"
if [[ -z "$PID" ]]; then
  rm -f "$PID_FILE"
  echo "Empty pid file removed."
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
  echo "Stopped ngrok pid=$PID"
else
  echo "Process not running for pid=$PID"
fi

rm -f "$PID_FILE"
echo "Removed $PID_FILE"
