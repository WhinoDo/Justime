#!/usr/bin/env bash
# 始终在「桌面仓库」的 justime_backend 根目录启动，避免误用废纸篓/其它副本。
# 用法: 在终端执行
#   bash scripts/run_dev_backend.sh
# 或在 justime_backend 目录下:
#   bash scripts/run_dev_backend.sh

set -euo pipefail

BACKEND_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BACKEND_ROOT"

echo "📂 后端根目录: $BACKEND_ROOT"

# 安全密钥处理: 仅在开发环境自动生成临时密钥
# 生产环境必须通过环境变量显式配置安全密钥，否则拒绝启动

# 检测是否为生产环境 (通过 ENV 或其他标志)
if [[ "${ENV:-}" == "production" || "${DEPLOY_ENV:-}" == "production" ]]; then
  # 生产环境: 必须显式设置所有密钥，不允许回退
  if [[ -z "${JWT_SECRET:-}" || -z "${JWT_REFRESH_SECRET:-}" || -z "${ENCRYPTION_SECRET:-}" ]]; then
    echo "❌ 错误: 生产环境必须显式设置 JWT_SECRET、JWT_REFRESH_SECRET 和 ENCRYPTION_SECRET 环境变量" >&2
    echo "   请使用 openssl rand -hex 32 生成安全密钥" >&2
    exit 1
  fi
  echo "✓ 生产环境密钥已配置"
else
  # 开发环境: 自动生成临时随机密钥 (每次启动不同)
  if [[ -z "${JWT_SECRET:-}" ]]; then
    JWT_SECRET="$(openssl rand -hex 32)"
    echo "⚠️  JWT_SECRET 未设置，已自动生成临时密钥 (仅限开发环境使用)"
  fi
  if [[ -z "${JWT_REFRESH_SECRET:-}" ]]; then
    JWT_REFRESH_SECRET="$(openssl rand -hex 32)"
    echo "⚠️  JWT_REFRESH_SECRET 未设置，已自动生成临时密钥 (仅限开发环境使用)"
  fi
  if [[ -z "${ENCRYPTION_SECRET:-}" ]]; then
    ENCRYPTION_SECRET="$(openssl rand -hex 32)"
    echo "⚠️  ENCRYPTION_SECRET 未设置，已自动生成临时密钥 (仅限开发环境使用)"
  fi
  export JWT_SECRET
  export JWT_REFRESH_SECRET
  export ENCRYPTION_SECRET
fi

# 安全检查: 禁止使用已知的弱密钥
WEAK_SECRETS="dev-jwt-secret dev-refresh-secret dev-encryption-secret test-secret secret password"
for secret_name in JWT_SECRET JWT_REFRESH_SECRET ENCRYPTION_SECRET; do
  secret_value="${!secret_name}"
  for weak in $WEAK_SECRETS; do
    if [[ "$secret_value" == "$weak" ]]; then
      echo "❌ 错误: $secret_name 使用了已知的弱密钥 '$weak'，禁止启动" >&2
      exit 1
    fi
  done
done

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
