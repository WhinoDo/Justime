#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOMELAB_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${DEPLOY_ENV_FILE:-${HOMELAB_DIR}/.env}"
COMPOSE_FILE="${DEPLOY_COMPOSE_FILE:-${HOMELAB_DIR}/docker-compose.yml}"
DOCKER_BIN="${DEPLOY_DOCKER_BIN:-docker}"
STATE_FILE="${DEPLOY_STATE_FILE:-${HOMELAB_DIR}/data/deploy-state/prior-images.env}"
WAIT_TIMEOUT_SECONDS="${ROLLBACK_WAIT_TIMEOUT_SECONDS:-180}"
OVERRIDE_FILE=""

fail() {
  echo "[fail] image-rollback: $1" >&2
  exit 1
}

cleanup() {
  local exit_code=$?
  [[ -z "${OVERRIDE_FILE}" ]] || rm -f -- "${OVERRIDE_FILE}"
  exit "${exit_code}"
}
trap cleanup EXIT

manifest_value() {
  local key="$1"
  local count

  count="$(awk -F= -v key="${key}" '$1 == key { count++ } END { print count + 0 }' "${STATE_FILE}")"
  [[ "${count}" == "1" ]] || fail "manifest key ${key} must appear exactly once"
  awk -F= -v key="${key}" '$1 == key { print substr($0, index($0, "=") + 1) }' "${STATE_FILE}"
}

command -v "${DOCKER_BIN}" >/dev/null 2>&1 || fail "docker binary not found: ${DOCKER_BIN}"
[[ -f "${COMPOSE_FILE}" ]] || fail "compose file not found: ${COMPOSE_FILE}"
[[ -f "${ENV_FILE}" ]] || fail "compose environment file not found: ${ENV_FILE}"
[[ -f "${STATE_FILE}" ]] || fail "prior-state manifest not found: ${STATE_FILE}"
[[ -s "${STATE_FILE}" ]] || fail "prior-state manifest is empty: ${STATE_FILE}"
[[ "${WAIT_TIMEOUT_SECONDS}" =~ ^[0-9]+$ ]] || fail "ROLLBACK_WAIT_TIMEOUT_SECONDS must be an integer between 1 and 600"
(( 10#${WAIT_TIMEOUT_SECONDS} >= 1 && 10#${WAIT_TIMEOUT_SECONDS} <= 600 )) || fail "ROLLBACK_WAIT_TIMEOUT_SECONDS must be an integer between 1 and 600"
WAIT_TIMEOUT_SECONDS=$(( 10#${WAIT_TIMEOUT_SECONDS} ))

if grep -Evq '^(manifest_version|attempt_id|frontend_image|frontend_protected|backend_image|backend_protected)=[^[:space:]]+$' "${STATE_FILE}"; then
  fail "prior-state manifest is malformed"
fi
[[ "$(manifest_value manifest_version)" == "1" ]] || fail "unsupported manifest version"
manifest_value attempt_id >/dev/null

FRONTEND_IMAGE="$(manifest_value frontend_image)"
BACKEND_IMAGE="$(manifest_value backend_image)"
FRONTEND_PROTECTED="$(manifest_value frontend_protected)"
BACKEND_PROTECTED="$(manifest_value backend_protected)"

[[ "${FRONTEND_IMAGE}" =~ ^sha256:[0-9a-f]{64}$ ]] || fail "invalid immutable image ID for frontend"
[[ "${BACKEND_IMAGE}" =~ ^sha256:[0-9a-f]{64}$ ]] || fail "invalid immutable image ID for backend"
[[ "${FRONTEND_PROTECTED}" =~ ^justime-rollback/frontend:[A-Za-z0-9_.-]{1,128}$ ]] || fail "invalid protected image reference for frontend"
[[ "${BACKEND_PROTECTED}" =~ ^justime-rollback/backend:[A-Za-z0-9_.-]{1,128}$ ]] || fail "invalid protected image reference for backend"

for image_id in "${FRONTEND_IMAGE}" "${BACKEND_IMAGE}"; do
  "${DOCKER_BIN}" image inspect "${image_id}" >/dev/null || fail "prior image is unavailable locally: ${image_id}"
done

OVERRIDE_FILE="$(mktemp "${TMPDIR:-/tmp}/justime-rollback.XXXXXX")"
cat >"${OVERRIDE_FILE}" <<EOF
services:
  frontend:
    image: "${FRONTEND_IMAGE}"
  backend:
    image: "${BACKEND_IMAGE}"
EOF

echo "[info] image-rollback: restoring frontend=${FRONTEND_IMAGE} backend=${BACKEND_IMAGE}"
if ! "${DOCKER_BIN}" compose \
  --env-file "${ENV_FILE}" \
  -f "${COMPOSE_FILE}" \
  -f "${OVERRIDE_FILE}" \
  up -d --no-build --pull never --wait --wait-timeout "${WAIT_TIMEOUT_SECONDS}"; then
  fail "compose failed to restore prior application images"
fi

echo "[ok] image-rollback: prior application images are running and compose-ready"
