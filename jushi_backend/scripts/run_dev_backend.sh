#!/usr/bin/env bash
# 始终在「桌面仓库」的 jushi_backend 根目录启动，避免误用废纸篓/其它副本。
# 用法: 在终端执行
#   bash scripts/run_dev_backend.sh
# 或在 jushi_backend 目录下:
#   bash scripts/run_dev_backend.sh

set -euo pipefail

BACKEND_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BACKEND_ROOT"

echo "📂 后端根目录: $BACKEND_ROOT"

export JWT_SECRET="${JWT_SECRET:-dev-jwt-secret}"
export JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-dev-refresh-secret}"
export ENCRYPTION_SECRET="${ENCRYPTION_SECRET:-dev-encryption-secret}"

PY=""
if [[ -x "$BACKEND_ROOT/.venv312/bin/python" ]]; then
  PY="$BACKEND_ROOT/.venv312/bin/python"
elif [[ -x "$BACKEND_ROOT/.venv/bin/python" ]]; then
  PY="$BACKEND_ROOT/.venv/bin/python"
else
  echo "未找到 .venv312 或 .venv/bin/python，请先在该目录创建虚拟环境。" >&2
  exit 1
fi

echo "🐍 Python: $PY"
exec "$PY" "$BACKEND_ROOT/start.py"
