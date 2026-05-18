#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
ENV_EXAMPLE="${ROOT_DIR}/.env.example"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1"
    exit 1
  fi
}

require_cmd docker
require_cmd tailscale
require_cmd curl

if ! docker info >/dev/null 2>&1; then
  echo "Docker Desktop 未启动或当前 shell 无法访问 Docker。"
  exit 1
fi

if ! tailscale status >/dev/null 2>&1; then
  echo "Tailscale 未登录或未连接。"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "未找到 ${ENV_FILE}"
  echo "请先复制并填写配置："
  echo "  cp ${ENV_EXAMPLE} ${ENV_FILE}"
  exit 1
fi

mkdir -p \
  "${ROOT_DIR}/data/caddy/data" \
  "${ROOT_DIR}/data/caddy/config" \
  "${ROOT_DIR}/data/mongodb" \
  "${ROOT_DIR}/data/redis" \
  "${ROOT_DIR}/data/openclaw" \
  "${ROOT_DIR}/data/backend/output" \
  "${ROOT_DIR}/data/logs/backend" \
  "${ROOT_DIR}/data/logs/frontend" \
  "${ROOT_DIR}/data/logs/caddy" \
  "${ROOT_DIR}/data/logs/openclaw"

docker compose --env-file "${ENV_FILE}" -f "${ROOT_DIR}/docker-compose.yml" pull
docker compose --env-file "${ENV_FILE}" -f "${ROOT_DIR}/docker-compose.yml" build
docker compose --env-file "${ENV_FILE}" -f "${ROOT_DIR}/docker-compose.yml" up -d

CADDY_PORT="$(awk -F= '/^CADDY_HTTP_PORT=/{print $2}' "${ENV_FILE}" | tail -n1)"
CADDY_PORT="${CADDY_PORT:-8088}"

tailscale serve --bg "http://127.0.0.1:${CADDY_PORT}"

echo
echo "Jushi Homelab 已启动。"
echo "本机入口: http://127.0.0.1:${CADDY_PORT}"
echo "Tailscale Serve 状态:"
tailscale serve status
