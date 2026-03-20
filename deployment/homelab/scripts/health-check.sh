#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "缺少 ${ENV_FILE}"
  exit 1
fi

CADDY_PORT="$(awk -F= '/^CADDY_HTTP_PORT=/{print $2}' "${ENV_FILE}" | tail -n1)"
CADDY_PORT="${CADDY_PORT:-8088}"
BASE_URL="http://127.0.0.1:${CADDY_PORT}"

echo "== docker compose ps =="
docker compose --env-file "${ENV_FILE}" -f "${ROOT_DIR}/docker-compose.yml" ps
echo

check_http() {
  local name="$1"
  local url="$2"
  if curl -fsS "${url}" >/dev/null; then
    echo "[ok] ${name}: ${url}"
  else
    echo "[fail] ${name}: ${url}"
    return 1
  fi
}

check_http "gateway" "${BASE_URL}/healthz"
check_http "frontend" "${BASE_URL}/"
check_http "backend" "${BASE_URL}/backend/api/v1/health/"
check_http "openclaw" "${BASE_URL}/openclaw/"

docker compose --env-file "${ENV_FILE}" -f "${ROOT_DIR}/docker-compose.yml" exec -T mongodb mongosh --quiet --eval "db.adminCommand('ping').ok" >/dev/null
echo "[ok] mongodb: ping"

docker compose --env-file "${ENV_FILE}" -f "${ROOT_DIR}/docker-compose.yml" exec -T redis redis-cli ping | grep -q PONG
echo "[ok] redis: ping"
