#!/bin/bash
# Justime Agent - Unattended Execution Script
# Usage: ./scripts/auto-agent.sh "your task prompt"
# Background: nohup ./scripts/auto-agent.sh "task" &
# Logs: agent-output.log

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG="$PROJECT_DIR/agent-output.log"

if [ -z "${1:-}" ]; then
  echo "Usage: $0 \"your task prompt\""
  echo "Example: $0 \"Refactor the chat module to use dependency injection\""
  exit 1
fi

PROMPT="$1"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting agent in $PROJECT_DIR" | tee -a "$LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Prompt: $PROMPT" | tee -a "$LOG"
echo "---" | tee -a "$LOG"

cd "$PROJECT_DIR"

claude -p "$PROMPT" --permission-mode auto 2>&1 | tee -a "$LOG"

EXIT_CODE=${PIPESTATUS[0]:-0}
echo "---" | tee -a "$LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Agent finished with exit code: $EXIT_CODE" | tee -a "$LOG"

exit $EXIT_CODE
