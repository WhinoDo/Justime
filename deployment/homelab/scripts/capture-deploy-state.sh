#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOMELAB_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${DEPLOY_ENV_FILE:-${HOMELAB_DIR}/.env}"
COMPOSE_FILE="${DEPLOY_COMPOSE_FILE:-${HOMELAB_DIR}/docker-compose.yml}"
DOCKER_BIN="${DEPLOY_DOCKER_BIN:-docker}"
STATE_FILE="${DEPLOY_STATE_FILE:-${HOMELAB_DIR}/data/deploy-state/prior-images.env}"
ACTION="${1:-capture}"
SERVICES=(frontend backend)
TEMP_FILE=""
PUBLISHED=0
CREATED_TAGS=()
STALE_TAGS=()

fail() {
  echo "[fail] deploy-state: $1" >&2
  exit 1
}

cleanup() {
  local exit_code=$?
  local tag

  [[ -z "${TEMP_FILE}" ]] || rm -f -- "${TEMP_FILE}"
  if (( PUBLISHED == 0 )); then
    for tag in "${CREATED_TAGS[@]}"; do
      "${DOCKER_BIN}" image rm "${tag}" >/dev/null 2>&1 || true
    done
  fi

  exit "${exit_code}"
}
trap cleanup EXIT

validate_common_configuration() {
  command -v "${DOCKER_BIN}" >/dev/null 2>&1 || fail "docker binary not found: ${DOCKER_BIN}"
  [[ -f "${COMPOSE_FILE}" ]] || fail "compose file not found: ${COMPOSE_FILE}"
  [[ -f "${ENV_FILE}" ]] || fail "compose environment file not found: ${ENV_FILE}"
  [[ "${STATE_FILE}" == /* ]] || fail "DEPLOY_STATE_FILE must be an absolute path"
}

manifest_value() {
  local key="$1"
  local count

  count="$(awk -F= -v key="${key}" '$1 == key { count++ } END { print count + 0 }' "${STATE_FILE}")"
  [[ "${count}" == "1" ]] || fail "manifest key ${key} must appear exactly once"
  awk -F= -v key="${key}" '$1 == key { print substr($0, index($0, "=") + 1) }' "${STATE_FILE}"
}

validate_manifest() {
  local version
  local service
  local image_id
  local protected_ref

  [[ -f "${STATE_FILE}" ]] || fail "prior-state manifest not found: ${STATE_FILE}"
  [[ -s "${STATE_FILE}" ]] || fail "prior-state manifest is empty: ${STATE_FILE}"
  if grep -Evq '^(manifest_version|attempt_id|frontend_image|frontend_protected|backend_image|backend_protected)=[^[:space:]]+$' "${STATE_FILE}"; then
    fail "prior-state manifest is malformed"
  fi

  version="$(manifest_value manifest_version)"
  [[ "${version}" == "1" ]] || fail "unsupported manifest version: ${version}"
  manifest_value attempt_id >/dev/null

  for service in "${SERVICES[@]}"; do
    image_id="$(manifest_value "${service}_image")"
    protected_ref="$(manifest_value "${service}_protected")"
    [[ "${image_id}" =~ ^sha256:[0-9a-f]{64}$ ]] || fail "invalid immutable image ID for ${service}"
    [[ "${protected_ref}" =~ ^justime-rollback/${service}:[A-Za-z0-9_.-]{1,128}$ ]] || fail "invalid protected image reference for ${service}"
  done
}

release_state() {
  local service
  local protected_ref

  validate_common_configuration
  validate_manifest
  for service in "${SERVICES[@]}"; do
    protected_ref="$(manifest_value "${service}_protected")"
    "${DOCKER_BIN}" image rm "${protected_ref}" >/dev/null
  done
  rm -- "${STATE_FILE}"
  PUBLISHED=1
  echo "[ok] deploy-state: released prior-image protection"
}

capture_state() {
  local state_dir
  local attempt_id
  local protection_id
  local service
  local container_id
  local image_id
  local protected_ref
  local stale_ref

  validate_common_configuration
  attempt_id="${DEPLOY_ATTEMPT_ID:-$(date -u +%Y%m%dT%H%M%SZ)-$$}"
  [[ "${attempt_id}" =~ ^[A-Za-z0-9_.-]{1,96}$ ]] || fail "DEPLOY_ATTEMPT_ID contains unsupported characters"
  protection_id="${attempt_id}-$(date -u +%Y%m%dT%H%M%SZ)-$$"
  [[ ${#protection_id} -le 128 ]] || fail "DEPLOY_ATTEMPT_ID is too long for an image protection tag"

  state_dir="$(dirname "${STATE_FILE}")"
  umask 077
  mkdir -p -- "${state_dir}" || fail "cannot create deploy-state directory: ${state_dir}"
  state_dir="$(cd "${state_dir}" && pwd -P)" || fail "cannot resolve deploy-state directory"
  chmod 700 "${state_dir}" || fail "cannot secure deploy-state directory: ${state_dir}"
  STATE_FILE="${state_dir}/$(basename "${STATE_FILE}")"
  TEMP_FILE="${STATE_FILE}.tmp.$$"

  if [[ -e "${STATE_FILE}" ]]; then
    validate_manifest
    for service in "${SERVICES[@]}"; do
      stale_ref="$(manifest_value "${service}_protected")"
      STALE_TAGS+=("${stale_ref}")
    done
  fi

  printf 'manifest_version=1\nattempt_id=%s\n' "${attempt_id}" >"${TEMP_FILE}"
  for service in "${SERVICES[@]}"; do
    container_id="$("${DOCKER_BIN}" compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps -q "${service}")"
    [[ -n "${container_id}" ]] || fail "service ${service} has no running container"
    image_id="$("${DOCKER_BIN}" inspect --format='{{.Image}}' "${container_id}")"
    [[ "${image_id}" =~ ^sha256:[0-9a-f]{64}$ ]] || fail "service ${service} is not running an immutable image ID"
    "${DOCKER_BIN}" image inspect "${image_id}" >/dev/null || fail "image ${image_id} for ${service} is unavailable locally"

    protected_ref="justime-rollback/${service}:${protection_id}"
    "${DOCKER_BIN}" image tag "${image_id}" "${protected_ref}" || fail "cannot protect prior image for ${service}"
    CREATED_TAGS+=("${protected_ref}")
    printf '%s_image=%s\n%s_protected=%s\n' "${service}" "${image_id}" "${service}" "${protected_ref}" >>"${TEMP_FILE}"
  done

  chmod 600 "${TEMP_FILE}" || fail "cannot secure temporary prior-state manifest"
  mv -- "${TEMP_FILE}" "${STATE_FILE}" || fail "cannot publish prior-state manifest"
  TEMP_FILE=""
  PUBLISHED=1
  for stale_ref in "${STALE_TAGS[@]}"; do
    if [[ " ${CREATED_TAGS[*]} " == *" ${stale_ref} "* ]]; then
      continue
    fi
    "${DOCKER_BIN}" image rm "${stale_ref}" >/dev/null 2>&1 || echo "[warn] deploy-state: could not release stale protection ${stale_ref}" >&2
  done
  echo "PRIOR_STATE_MANIFEST=${STATE_FILE}"
  for service in "${SERVICES[@]}"; do
    echo "[ok] deploy-state: captured ${service}=$(manifest_value "${service}_image")"
  done
}

case "${ACTION}" in
  capture)
    capture_state
    ;;
  --release)
    release_state
    ;;
  *)
    fail "usage: $0 [capture|--release]"
    ;;
esac
