#!/bin/bash

# 获取项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🛑 Stopping Justime development services..."

# 1. 停止后端和前端端口进程 (Stop processes running on ports)
echo "🧹 Killing processes on port 8080 and 3000..."
lsof -ti :8080 | xargs kill -9 2>/dev/null || true
lsof -ti :3000 | xargs kill -9 2>/dev/null || true

# 2. 停止数据库容器 (Stop database containers)
echo "📦 Stopping MongoDB and Redis docker containers..."
docker stop local-mongodb local-redis 2>/dev/null || true

echo "✅ All development services stopped."
