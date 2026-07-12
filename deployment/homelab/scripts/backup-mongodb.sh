#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOMELAB_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${MONGODB_BACKUP_ENV_FILE:-${HOMELAB_DIR}/.env}"
COMPOSE_FILE="${MONGODB_BACKUP_COMPOSE_FILE:-${HOMELAB_DIR}/docker-compose.yml}"
COMPOSE_BIN="${MONGODB_BACKUP_COMPOSE_BIN:-docker}"
ARCHIVE_PREFIX="justime-mongodb"
TEMP_ARCHIVE=""
TEMP_MANIFEST=""
FINAL_ARCHIVE=""
FINAL_MANIFEST=""
PUBLISHING=0
PUBLISHED=0

fail() {
  echo "[fail] mongodb-backup: $1" >&2
  exit 1
}

cleanup() {
  local exit_code=$?

  [[ -z "${TEMP_ARCHIVE}" ]] || rm -f -- "${TEMP_ARCHIVE}"
  [[ -z "${TEMP_MANIFEST}" ]] || rm -f -- "${TEMP_MANIFEST}"

  if (( PUBLISHING == 1 && PUBLISHED == 0 )); then
    [[ -z "${FINAL_ARCHIVE}" ]] || rm -f -- "${FINAL_ARCHIVE}"
    [[ -z "${FINAL_MANIFEST}" ]] || rm -f -- "${FINAL_MANIFEST}"
  fi

  exit "${exit_code}"
}
trap cleanup EXIT

read_env_value() {
  local key="$1"
  local line
  local value

  [[ -f "${ENV_FILE}" ]] || return 0
  line="$(grep -E "^[[:space:]]*${key}=" "${ENV_FILE}" | tail -n 1 || true)"
  [[ -n "${line}" ]] || return 0

  value="${line#*=}"
  value="${value%$'\r'}"
  if [[ "${value}" == \"*\" && "${value}" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "${value}" == \'*\' && "${value}" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "${value}"
}

sha256_file() {
  local file="$1"

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${file}" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "${file}" | awk '{print $1}'
  else
    fail "sha256sum or shasum is required"
  fi
}

BACKUP_DIR="${MONGODB_BACKUP_DIR:-}"
RETENTION="${MONGODB_BACKUP_RETENTION:-}"
DEPLOY_SHA="${JUSTIME_DEPLOY_SHA:-}"

[[ -n "${BACKUP_DIR}" ]] || BACKUP_DIR="$(read_env_value MONGODB_BACKUP_DIR)"
[[ -n "${RETENTION}" ]] || RETENTION="$(read_env_value MONGODB_BACKUP_RETENTION)"

[[ -n "${BACKUP_DIR}" ]] || fail "MONGODB_BACKUP_DIR must be configured"
[[ "${BACKUP_DIR}" == /* ]] || fail "MONGODB_BACKUP_DIR must be an absolute host path"
[[ -n "${DEPLOY_SHA}" ]] || fail "JUSTIME_DEPLOY_SHA is required"
[[ "${DEPLOY_SHA}" =~ ^[0-9a-fA-F]{7,64}$ ]] || fail "JUSTIME_DEPLOY_SHA must be a Git commit SHA"
[[ "${RETENTION}" =~ ^[0-9]+$ ]] || fail "MONGODB_BACKUP_RETENTION must be an integer of at least 2"
(( 10#${RETENTION} >= 2 )) || fail "MONGODB_BACKUP_RETENTION must be at least 2"
RETENTION=$(( 10#${RETENTION} ))

umask 077
mkdir -p -- "${BACKUP_DIR}" || fail "cannot create backup directory: ${BACKUP_DIR}"
BACKUP_DIR="$(cd "${BACKUP_DIR}" && pwd -P)" || fail "cannot resolve backup directory"
[[ "${BACKUP_DIR}" != "/" ]] || fail "MONGODB_BACKUP_DIR cannot resolve to the filesystem root"
chmod 700 "${BACKUP_DIR}" || fail "cannot secure backup directory: ${BACKUP_DIR}"
[[ -w "${BACKUP_DIR}" ]] || fail "backup directory is not writable: ${BACKUP_DIR}"

command -v "${COMPOSE_BIN}" >/dev/null 2>&1 || fail "compose binary not found: ${COMPOSE_BIN}"
[[ -f "${COMPOSE_FILE}" ]] || fail "compose file not found: ${COMPOSE_FILE}"
[[ -f "${ENV_FILE}" ]] || fail "compose environment file not found: ${ENV_FILE}"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE_NAME="${ARCHIVE_PREFIX}-${TIMESTAMP}-${DEPLOY_SHA}.archive.gz"
FINAL_ARCHIVE="${BACKUP_DIR}/${ARCHIVE_NAME}"
FINAL_MANIFEST="${FINAL_ARCHIVE}.sha256"
TEMP_ARCHIVE="${BACKUP_DIR}/.${ARCHIVE_NAME}.tmp.$$"
TEMP_MANIFEST="${BACKUP_DIR}/.${ARCHIVE_NAME}.sha256.tmp.$$"

[[ ! -e "${FINAL_ARCHIVE}" && ! -e "${FINAL_MANIFEST}" ]] || fail "backup artifact already exists: ${FINAL_ARCHIVE}"

# Credentials expand inside the MongoDB container, not in this host shell.
# shellcheck disable=SC2016
if ! "${COMPOSE_BIN}" compose \
  --env-file "${ENV_FILE}" \
  -f "${COMPOSE_FILE}" \
  exec -T mongodb \
  sh -ec 'exec mongodump --archive --gzip --username "${MONGO_INITDB_ROOT_USERNAME:-root}" --password "${MONGO_INITDB_ROOT_PASSWORD:?MONGO_INITDB_ROOT_PASSWORD is required}" --authenticationDatabase admin' \
  >"${TEMP_ARCHIVE}"; then
  fail "mongodump failed"
fi

[[ -s "${TEMP_ARCHIVE}" ]] || fail "mongodump produced an empty archive"

ARCHIVE_SHA256="$(sha256_file "${TEMP_ARCHIVE}")"
[[ "${ARCHIVE_SHA256}" =~ ^[0-9a-fA-F]{64}$ ]] || fail "could not calculate archive SHA-256"
printf '%s  %s\n' "${ARCHIVE_SHA256}" "${ARCHIVE_NAME}" >"${TEMP_MANIFEST}" || fail "cannot write SHA-256 manifest"
[[ -s "${TEMP_MANIFEST}" ]] || fail "SHA-256 manifest is empty"

PUBLISHING=1
mv -- "${TEMP_ARCHIVE}" "${FINAL_ARCHIVE}" || fail "cannot publish backup archive"
TEMP_ARCHIVE=""
mv -- "${TEMP_MANIFEST}" "${FINAL_MANIFEST}" || fail "cannot publish SHA-256 manifest"
TEMP_MANIFEST=""
PUBLISHED=1

shopt -s nullglob
COMPLETE_ARCHIVES=()
for archive in "${BACKUP_DIR}/${ARCHIVE_PREFIX}-"*.archive.gz; do
  [[ -s "${archive}" && -s "${archive}.sha256" ]] || continue
  COMPLETE_ARCHIVES+=("${archive}")
done

if (( ${#COMPLETE_ARCHIVES[@]} > RETENTION )); then
  PRUNE_COUNT=$(( ${#COMPLETE_ARCHIVES[@]} - RETENTION ))
  PRUNED=0
  for (( index = 0; index < ${#COMPLETE_ARCHIVES[@]} && PRUNED < PRUNE_COUNT; index++ )); do
    archive="${COMPLETE_ARCHIVES[index]}"
    [[ "${archive}" != "${FINAL_ARCHIVE}" ]] || continue
    rm -- "${archive}" "${archive}.sha256" || fail "cannot prune old backup: ${archive}"
    PRUNED=$(( PRUNED + 1 ))
  done
  (( PRUNED == PRUNE_COUNT )) || fail "cannot satisfy retention without pruning the new backup"
fi

echo "BACKUP_ARTIFACT=${FINAL_ARCHIVE}"
echo "BACKUP_MANIFEST=${FINAL_MANIFEST}"
echo "DEPLOY_SHA=${DEPLOY_SHA}"
