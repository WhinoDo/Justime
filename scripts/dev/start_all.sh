#!/bin/bash

# 获取项目根目录 (Get project root directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🚀 Starting Justime development services..."
echo "📂 Project Root: $PROJECT_ROOT"

# 1. 启动数据库 (Start databases)
echo "📦 Starting MongoDB and Redis..."
docker start local-mongodb 2>/dev/null || docker run -d --name local-mongodb -p 127.0.0.1:27017:27017 mongo:7
docker start local-redis 2>/dev/null || docker run -d --name local-redis -p 127.0.0.1:6379:6379 redis:7-alpine

# 2. 清理端口占用 (Clean port occupations)
echo "🧹 Checking and cleaning ports 8080 and 3000..."
lsof -ti :8080 | xargs kill -9 2>/dev/null || true
lsof -ti :3000 | xargs kill -9 2>/dev/null || true

# 3. 创建日志目录 (Create log directory if not exists)
mkdir -p "$PROJECT_ROOT/logs"

# 4. 启动后端 (Start backend)
echo "🐍 Starting FastAPI backend..."
cd "$PROJECT_ROOT/justime_backend"
./.venv/bin/python start.py > "$PROJECT_ROOT/logs/dev-backend.log" 2>&1 &
echo "   Backend logs redirect to: logs/dev-backend.log"

# 5. 启动前端 (Start frontend)
echo "⚛️ Starting Next.js frontend..."
cd "$PROJECT_ROOT/justime_agent"
npm run dev > "$PROJECT_ROOT/logs/dev-frontend.log" 2>&1 &
echo "   Frontend logs redirect to: logs/dev-frontend.log"

echo "✅ All services successfully launched in background!"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend:  http://localhost:8080"
