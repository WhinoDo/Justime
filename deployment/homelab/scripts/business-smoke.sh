#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-${1:-}}"
SMOKE_TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-90}"
SMOKE_RETRY_INTERVAL_SECONDS="${SMOKE_RETRY_INTERVAL_SECONDS:-3}"
SMOKE_REQUEST_TIMEOUT_SECONDS="${SMOKE_REQUEST_TIMEOUT_SECONDS:-5}"

fail_stage() {
  local stage="$1"
  local reason="$2"
  echo "[fail] ${stage}: ${reason}" >&2
  exit 1
}

validate_integer() {
  local name="$1"
  local value="$2"
  local minimum="$3"
  local maximum="$4"

  if [[ ! "${value}" =~ ^[0-9]+$ ]] || (( 10#${value} < minimum || 10#${value} > maximum )); then
    fail_stage "configuration" "${name} must be an integer between ${minimum} and ${maximum}"
  fi
}

if [[ -z "${BASE_URL}" ]]; then
  fail_stage "configuration" "BASE_URL is required"
fi

if [[ "${BASE_URL}" != http://* && "${BASE_URL}" != https://* ]]; then
  fail_stage "configuration" "BASE_URL must start with http:// or https://"
fi

validate_integer "SMOKE_TIMEOUT_SECONDS" "${SMOKE_TIMEOUT_SECONDS}" 1 300
validate_integer "SMOKE_RETRY_INTERVAL_SECONDS" "${SMOKE_RETRY_INTERVAL_SECONDS}" 1 30
validate_integer "SMOKE_REQUEST_TIMEOUT_SECONDS" "${SMOKE_REQUEST_TIMEOUT_SECONDS}" 1 30

SMOKE_TIMEOUT_SECONDS=$(( 10#${SMOKE_TIMEOUT_SECONDS} ))
SMOKE_RETRY_INTERVAL_SECONDS=$(( 10#${SMOKE_RETRY_INTERVAL_SECONDS} ))
SMOKE_REQUEST_TIMEOUT_SECONDS=$(( 10#${SMOKE_REQUEST_TIMEOUT_SECONDS} ))

if (( SMOKE_REQUEST_TIMEOUT_SECONDS > SMOKE_TIMEOUT_SECONDS )); then
  fail_stage "configuration" "SMOKE_REQUEST_TIMEOUT_SECONDS cannot exceed SMOKE_TIMEOUT_SECONDS"
fi

command -v curl >/dev/null 2>&1 || fail_stage "configuration" "curl is required"
command -v python3 >/dev/null 2>&1 || fail_stage "configuration" "python3 is required for JSON validation"

BASE_URL="${BASE_URL%/}"
READINESS_URL="${BASE_URL}/backend/api/v1/health/ready"
AUTH_URL="${BASE_URL}/backend/api/v1/auth/me"
DEADLINE=$(( $(date +%s) + SMOKE_TIMEOUT_SECONDS ))
ATTEMPTS=0
LAST_REASON="timeout"

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TEMP_DIR}"' EXIT

request() {
  local url="$1"
  local body_file="$2"
  local error_file="$3"
  local now
  local remaining
  local request_timeout

  now="$(date +%s)"
  remaining=$(( DEADLINE - now ))
  if (( remaining <= 0 )); then
    return 124
  fi

  request_timeout="${SMOKE_REQUEST_TIMEOUT_SECONDS}"
  if (( request_timeout > remaining )); then
    request_timeout="${remaining}"
  fi

  curl \
    --silent \
    --show-error \
    --output "${body_file}" \
    --write-out '%{http_code}' \
    --connect-timeout "${request_timeout}" \
    --max-time "${request_timeout}" \
    "${url}" 2>"${error_file}"
}

sleep_before_retry() {
  local now
  local remaining
  local sleep_seconds

  now="$(date +%s)"
  remaining=$(( DEADLINE - now ))
  if (( remaining <= 0 )); then
    return 1
  fi

  sleep_seconds="${SMOKE_RETRY_INTERVAL_SECONDS}"
  if (( sleep_seconds > remaining )); then
    sleep_seconds="${remaining}"
  fi

  sleep "${sleep_seconds}"
  (( $(date +%s) < DEADLINE ))
}

while true; do
  ATTEMPTS=$(( ATTEMPTS + 1 ))
  READINESS_BODY="${TEMP_DIR}/readiness-body"
  READINESS_ERROR="${TEMP_DIR}/readiness-error"

  if READINESS_HTTP_STATUS="$(request "${READINESS_URL}" "${READINESS_BODY}" "${READINESS_ERROR}")"; then
    READINESS_REQUEST_EXIT=0
  else
    READINESS_REQUEST_EXIT=$?
  fi

  if (( READINESS_REQUEST_EXIT != 0 )); then
    LAST_REASON="request failed (curl exit ${READINESS_REQUEST_EXIT})"
  elif [[ "${READINESS_HTTP_STATUS}" =~ ^5[0-9][0-9]$ ]]; then
    LAST_REASON="HTTP ${READINESS_HTTP_STATUS}"
  elif [[ "${READINESS_HTTP_STATUS}" != "200" ]]; then
    LAST_REASON="expected HTTP 200, got ${READINESS_HTTP_STATUS}"
  else
    if ! READINESS_STATUS="$(python3 - "${READINESS_BODY}" <<'PY'
import json
import sys

try:
    with open(sys.argv[1], "r", encoding="utf-8") as response_file:
        payload = json.load(response_file)
except (OSError, UnicodeError, json.JSONDecodeError):
    raise SystemExit(1)

status = payload.get("status") if isinstance(payload, dict) else None
if not isinstance(status, str):
    raise SystemExit(1)

print(status)
PY
    )"; then
      fail_stage "readiness" "malformed JSON or missing string status"
    fi

    if [[ "${READINESS_STATUS}" == "ready" || "${READINESS_STATUS}" == "degraded" ]]; then
      echo "[ok] readiness: HTTP 200 status=${READINESS_STATUS} attempts=${ATTEMPTS}"
      break
    fi

    LAST_REASON="status=${READINESS_STATUS}"
  fi

  if ! sleep_before_retry; then
    fail_stage "readiness" "${LAST_REASON} after ${ATTEMPTS} attempt(s)"
  fi
done

DEADLINE=$(( $(date +%s) + SMOKE_TIMEOUT_SECONDS ))
ATTEMPTS=0
LAST_REASON="timeout"

while true; do
  ATTEMPTS=$(( ATTEMPTS + 1 ))
  AUTH_BODY="${TEMP_DIR}/auth-body"
  AUTH_ERROR="${TEMP_DIR}/auth-error"

  if AUTH_HTTP_STATUS="$(request "${AUTH_URL}" "${AUTH_BODY}" "${AUTH_ERROR}")"; then
    AUTH_REQUEST_EXIT=0
  else
    AUTH_REQUEST_EXIT=$?
  fi

  if (( AUTH_REQUEST_EXIT != 0 )); then
    LAST_REASON="request failed (curl exit ${AUTH_REQUEST_EXIT})"
  elif [[ "${AUTH_HTTP_STATUS}" =~ ^[1-4][0-9][0-9]$ ]]; then
    echo "[ok] auth-contract: HTTP ${AUTH_HTTP_STATUS} credential-free GET attempts=${ATTEMPTS}"
    break
  elif [[ "${AUTH_HTTP_STATUS}" =~ ^5[0-9][0-9]$ ]]; then
    fail_stage "auth-contract" "HTTP ${AUTH_HTTP_STATUS}"
  else
    LAST_REASON="invalid HTTP status ${AUTH_HTTP_STATUS}"
  fi

  if ! sleep_before_retry; then
    fail_stage "auth-contract" "${LAST_REASON} after ${ATTEMPTS} attempt(s)"
  fi
done
