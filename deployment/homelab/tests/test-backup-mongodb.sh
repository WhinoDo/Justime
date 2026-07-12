#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/../scripts/backup-mongodb.sh"
TEMP_DIR="$(mktemp -d)"
MOCK_BIN="${TEMP_DIR}/bin"
MOCK_COMPOSE="${MOCK_BIN}/docker"
MOCK_LOG="${TEMP_DIR}/compose.log"
ENV_FILE="${TEMP_DIR}/homelab.env"
COMPOSE_FILE="${TEMP_DIR}/docker-compose.yml"

cleanup() {
  rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT

mkdir -p "${MOCK_BIN}"
printf 'MONGO_ROOT_PASSWORD=test-only\n' >"${ENV_FILE}"
printf 'services: {}\n' >"${COMPOSE_FILE}"

cat >"${MOCK_COMPOSE}" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$*" >>"${MOCK_COMPOSE_LOG}"
case "${MOCK_DUMP_SCENARIO}" in
  success)
    printf 'mock-gzip-archive:%s\n' "${MOCK_ARCHIVE_CONTENT:-default}"
    ;;
  failure)
    printf 'partial-archive'
    exit 42
    ;;
  zero)
    exit 0
    ;;
  *)
    echo "unknown mock scenario: ${MOCK_DUMP_SCENARIO}" >&2
    exit 2
    ;;
esac
MOCK
chmod +x "${MOCK_COMPOSE}"

fail_test() {
  echo "[fail] $1" >&2
  exit 1
}

assert_contains() {
  local file="$1"
  local expected="$2"
  grep -Fq -- "${expected}" "${file}" || fail_test "expected '${expected}' in ${file}"
}

assert_no_published_archive() {
  local backup_dir="$1"
  local archives=("${backup_dir}"/justime-mongodb-*.archive.gz)
  local manifests=("${backup_dir}"/justime-mongodb-*.archive.gz.sha256)
  local temporaries=("${backup_dir}"/.*.tmp.*)

  [[ ! -e "${archives[0]}" ]] || fail_test "unexpected published archive in ${backup_dir}"
  [[ ! -e "${manifests[0]}" ]] || fail_test "unexpected published manifest in ${backup_dir}"
  [[ ! -e "${temporaries[0]}" ]] || fail_test "unexpected temporary artifact in ${backup_dir}"
}

run_backup() {
  local backup_dir="$1"
  local scenario="$2"
  local retention="$3"
  local output_file="$4"

  MOCK_COMPOSE_LOG="${MOCK_LOG}" \
    MOCK_DUMP_SCENARIO="${scenario}" \
    MOCK_ARCHIVE_CONTENT="${scenario}" \
    MONGODB_BACKUP_COMPOSE_BIN="${MOCK_COMPOSE}" \
    MONGODB_BACKUP_COMPOSE_FILE="${COMPOSE_FILE}" \
    MONGODB_BACKUP_ENV_FILE="${ENV_FILE}" \
    MONGODB_BACKUP_DIR="${backup_dir}" \
    MONGODB_BACKUP_RETENTION="${retention}" \
    JUSTIME_DEPLOY_SHA="0123456789abcdef0123456789abcdef01234567" \
    bash "${BACKUP_SCRIPT}" >"${output_file}" 2>&1
}

test_success_and_command() {
  local backup_dir="${TEMP_DIR}/success"
  local output_file="${TEMP_DIR}/success.out"
  local archive
  local manifest

  : >"${MOCK_LOG}"
  if ! run_backup "${backup_dir}" success 3 "${output_file}"; then
    cat "${output_file}" >&2
    fail_test "success fixture failed"
  fi

  archive="$(sed -n 's/^BACKUP_ARTIFACT=//p' "${output_file}")"
  [[ -n "${archive}" && -s "${archive}" ]] || fail_test "success fixture did not publish a nonempty archive"
  manifest="$(sed -n 's/^BACKUP_MANIFEST=//p' "${output_file}")"
  [[ "${manifest}" == "${archive}.sha256" ]] || fail_test "manifest path does not match archive path"
  [[ -s "${manifest}" ]] || fail_test "success fixture did not publish a manifest"

  assert_contains "${manifest}" "$(basename "${archive}")"
  assert_contains "${output_file}" "DEPLOY_SHA=0123456789abcdef0123456789abcdef01234567"
  assert_contains "${MOCK_LOG}" "compose --env-file ${ENV_FILE} -f ${COMPOSE_FILE} exec -T mongodb sh -ec"
  assert_contains "${MOCK_LOG}" "mongodump --archive --gzip"
  assert_contains "${MOCK_LOG}" "--authenticationDatabase admin"
  echo "[ok] success and command construction"
}

test_dump_failure_cleanup() {
  local backup_dir="${TEMP_DIR}/failure"
  local output_file="${TEMP_DIR}/failure.out"

  if run_backup "${backup_dir}" failure 3 "${output_file}"; then
    fail_test "dump failure fixture unexpectedly succeeded"
  fi
  assert_contains "${output_file}" "[fail] mongodb-backup: mongodump failed"
  assert_no_published_archive "${backup_dir}"
  echo "[ok] dump failure cleanup"
}

test_zero_byte_cleanup() {
  local backup_dir="${TEMP_DIR}/zero"
  local output_file="${TEMP_DIR}/zero.out"

  if run_backup "${backup_dir}" zero 3 "${output_file}"; then
    fail_test "zero-byte fixture unexpectedly succeeded"
  fi
  assert_contains "${output_file}" "[fail] mongodb-backup: mongodump produced an empty archive"
  assert_no_published_archive "${backup_dir}"
  echo "[ok] zero-byte cleanup"
}

write_complete_backup() {
  local backup_dir="$1"
  local timestamp="$2"
  local sha="$3"
  local archive="${backup_dir}/justime-mongodb-${timestamp}-${sha}.archive.gz"

  printf 'fixture-%s\n' "${timestamp}" >"${archive}"
  printf 'fixture-sha  %s\n' "$(basename "${archive}")" >"${archive}.sha256"
}

test_retention_ordering() {
  local backup_dir="${TEMP_DIR}/retention"
  local output_file="${TEMP_DIR}/retention.out"
  local old_sha="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  local incomplete_archive
  local complete_count

  mkdir -p "${backup_dir}"
  write_complete_backup "${backup_dir}" 20260101T000000Z "${old_sha}"
  write_complete_backup "${backup_dir}" 20260201T000000Z "${old_sha}"
  write_complete_backup "${backup_dir}" 20260301T000000Z "${old_sha}"
  incomplete_archive="${backup_dir}/justime-mongodb-20250101T000000Z-${old_sha}.archive.gz"
  printf 'incomplete' >"${incomplete_archive}"

  if ! run_backup "${backup_dir}" success 3 "${output_file}"; then
    cat "${output_file}" >&2
    fail_test "retention fixture failed"
  fi

  [[ ! -e "${backup_dir}/justime-mongodb-20260101T000000Z-${old_sha}.archive.gz" ]] || fail_test "oldest complete archive was not pruned"
  [[ ! -e "${backup_dir}/justime-mongodb-20260101T000000Z-${old_sha}.archive.gz.sha256" ]] || fail_test "oldest complete manifest was not pruned"
  [[ -e "${backup_dir}/justime-mongodb-20260201T000000Z-${old_sha}.archive.gz" ]] || fail_test "newer complete archive was pruned"
  [[ -e "${backup_dir}/justime-mongodb-20260301T000000Z-${old_sha}.archive.gz" ]] || fail_test "newest fixture archive was pruned"
  [[ -e "${incomplete_archive}" ]] || fail_test "incomplete archive was pruned"

  complete_count="$(find "${backup_dir}" -maxdepth 1 -type f -name 'justime-mongodb-*.archive.gz.sha256' | wc -l | tr -d ' ')"
  [[ "${complete_count}" == "3" ]] || fail_test "expected 3 complete retained backups, found ${complete_count}"
  echo "[ok] retention ordering"
}

test_retention_floor() {
  local backup_dir="${TEMP_DIR}/floor"
  local output_file="${TEMP_DIR}/floor.out"

  if run_backup "${backup_dir}" success 1 "${output_file}"; then
    fail_test "retention floor fixture unexpectedly succeeded"
  fi
  assert_contains "${output_file}" "MONGODB_BACKUP_RETENTION must be at least 2"
  assert_no_published_archive "${backup_dir}"
  echo "[ok] retention safety floor"
}

test_root_path_rejection() {
  local output_file="${TEMP_DIR}/root-path.out"

  : >"${MOCK_LOG}"
  if run_backup "/" success 3 "${output_file}"; then
    fail_test "root path fixture unexpectedly succeeded"
  fi
  assert_contains "${output_file}" "MONGODB_BACKUP_DIR cannot resolve to the filesystem root"
  [[ ! -s "${MOCK_LOG}" ]] || fail_test "compose was invoked for a rejected root backup path"
  echo "[ok] root path rejection"
}

test_new_backup_is_never_pruned() {
  local backup_dir="${TEMP_DIR}/clock-skew"
  local output_file="${TEMP_DIR}/clock-skew.out"
  local future_sha="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  local new_archive

  mkdir -p "${backup_dir}"
  write_complete_backup "${backup_dir}" 29990101T000000Z "${future_sha}"
  write_complete_backup "${backup_dir}" 29990201T000000Z "${future_sha}"

  if ! run_backup "${backup_dir}" success 2 "${output_file}"; then
    cat "${output_file}" >&2
    fail_test "clock-skew fixture failed"
  fi

  new_archive="$(sed -n 's/^BACKUP_ARTIFACT=//p' "${output_file}")"
  [[ -s "${new_archive}" && -s "${new_archive}.sha256" ]] || fail_test "new backup was pruned under clock skew"
  [[ ! -e "${backup_dir}/justime-mongodb-29990101T000000Z-${future_sha}.archive.gz" ]] || fail_test "oldest prior complete backup was not pruned under clock skew"
  [[ -e "${backup_dir}/justime-mongodb-29990201T000000Z-${future_sha}.archive.gz" ]] || fail_test "newest prior complete backup was pruned under clock skew"
  echo "[ok] new backup retention protection"
}

test_success_and_command
test_dump_failure_cleanup
test_zero_byte_cleanup
test_retention_ordering
test_retention_floor
test_root_path_rejection
test_new_backup_is_never_pruned

echo "All MongoDB backup fixtures passed."
