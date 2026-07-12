#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPTURE_SCRIPT="${SCRIPT_DIR}/../scripts/capture-deploy-state.sh"
ROLLBACK_SCRIPT="${SCRIPT_DIR}/../scripts/rollback-images.sh"
WORKFLOW_FILE="${SCRIPT_DIR}/../../../.github/workflows/deploy.yml"
TEMP_DIR="$(mktemp -d)"
MOCK_BIN="${TEMP_DIR}/bin"
MOCK_DOCKER="${MOCK_BIN}/docker"
MOCK_LOG="${TEMP_DIR}/docker.log"
OVERRIDE_CAPTURE="${TEMP_DIR}/rollback-override.yml"
ENV_FILE="${TEMP_DIR}/homelab.env"
COMPOSE_FILE="${TEMP_DIR}/docker-compose.yml"
STATE_FILE="${TEMP_DIR}/state/prior-images.env"
FRONTEND_IMAGE="sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
BACKEND_IMAGE="sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

cleanup() {
  rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT

mkdir -p "${MOCK_BIN}"
printf 'CADDY_HTTP_PORT=8088\n' >"${ENV_FILE}"
printf 'services: {}\n' >"${COMPOSE_FILE}"

cat >"${MOCK_DOCKER}" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$*" >>"${MOCK_DOCKER_LOG}"

if [[ "${1:-}" == "compose" ]]; then
  for (( index = 1; index <= $#; index++ )); do
    argument="${!index}"
    if [[ "${argument}" == "ps" ]]; then
      service="${!#}"
      printf '%s-container\n' "${service}"
      exit 0
    fi
    if [[ "${argument}" == "up" ]]; then
      previous=""
      for value in "$@"; do
        if [[ "${previous}" == "-f" && "${value}" != "${MOCK_COMPOSE_FILE}" ]]; then
          cp "${value}" "${MOCK_OVERRIDE_CAPTURE}"
        fi
        previous="${value}"
      done
      [[ "${MOCK_ROLLBACK_SCENARIO:-success}" != "failure" ]] || exit 37
      exit 0
    fi
  done
fi

if [[ "${1:-}" == "inspect" ]]; then
  case "${!#}" in
    frontend-container) printf '%s\n' "${MOCK_FRONTEND_IMAGE}" ;;
    backend-container) printf '%s\n' "${MOCK_BACKEND_IMAGE}" ;;
    *) exit 2 ;;
  esac
  exit 0
fi

if [[ "${1:-}" == "image" ]]; then
  case "${2:-}" in
    inspect)
      [[ "${MOCK_IMAGE_SCENARIO:-present}" == "present" ]] || exit 44
      exit 0
      ;;
    tag|rm)
      exit 0
      ;;
  esac
fi

echo "unsupported mock docker command: $*" >&2
exit 2
MOCK
chmod +x "${MOCK_DOCKER}"

fail_test() {
  echo "[fail] $1" >&2
  exit 1
}

assert_contains() {
  local file="$1"
  local expected="$2"
  grep -Fq -- "${expected}" "${file}" || fail_test "expected '${expected}' in ${file}"
}

assert_not_contains() {
  local file="$1"
  local unexpected="$2"
  if grep -Fq -- "${unexpected}" "${file}"; then
    fail_test "did not expect '${unexpected}' in ${file}"
  fi
}

run_capture() {
  local output_file="$1"

  MOCK_DOCKER_LOG="${MOCK_LOG}" \
    MOCK_COMPOSE_FILE="${COMPOSE_FILE}" \
    MOCK_OVERRIDE_CAPTURE="${OVERRIDE_CAPTURE}" \
    MOCK_FRONTEND_IMAGE="${FRONTEND_IMAGE}" \
    MOCK_BACKEND_IMAGE="${BACKEND_IMAGE}" \
    DEPLOY_DOCKER_BIN="${MOCK_DOCKER}" \
    DEPLOY_ENV_FILE="${ENV_FILE}" \
    DEPLOY_COMPOSE_FILE="${COMPOSE_FILE}" \
    DEPLOY_STATE_FILE="${STATE_FILE}" \
    DEPLOY_ATTEMPT_ID="fixture-attempt" \
    bash "${CAPTURE_SCRIPT}" >"${output_file}" 2>&1
}

run_release() {
  local output_file="$1"

  MOCK_DOCKER_LOG="${MOCK_LOG}" \
    MOCK_COMPOSE_FILE="${COMPOSE_FILE}" \
    MOCK_OVERRIDE_CAPTURE="${OVERRIDE_CAPTURE}" \
    MOCK_FRONTEND_IMAGE="${FRONTEND_IMAGE}" \
    MOCK_BACKEND_IMAGE="${BACKEND_IMAGE}" \
    DEPLOY_DOCKER_BIN="${MOCK_DOCKER}" \
    DEPLOY_ENV_FILE="${ENV_FILE}" \
    DEPLOY_COMPOSE_FILE="${COMPOSE_FILE}" \
    DEPLOY_STATE_FILE="${STATE_FILE}" \
    bash "${CAPTURE_SCRIPT}" --release >"${output_file}" 2>&1
}

run_rollback() {
  local scenario="$1"
  local output_file="$2"

  MOCK_DOCKER_LOG="${MOCK_LOG}" \
    MOCK_COMPOSE_FILE="${COMPOSE_FILE}" \
    MOCK_OVERRIDE_CAPTURE="${OVERRIDE_CAPTURE}" \
    MOCK_FRONTEND_IMAGE="${FRONTEND_IMAGE}" \
    MOCK_BACKEND_IMAGE="${BACKEND_IMAGE}" \
    MOCK_ROLLBACK_SCENARIO="${scenario}" \
    DEPLOY_DOCKER_BIN="${MOCK_DOCKER}" \
    DEPLOY_ENV_FILE="${ENV_FILE}" \
    DEPLOY_COMPOSE_FILE="${COMPOSE_FILE}" \
    DEPLOY_STATE_FILE="${STATE_FILE}" \
    ROLLBACK_WAIT_TIMEOUT_SECONDS=45 \
    bash "${ROLLBACK_SCRIPT}" >"${output_file}" 2>&1
}

test_capture_exact_prior_images() {
  local output_file="${TEMP_DIR}/capture.out"
  local frontend_protected
  local backend_protected

  : >"${MOCK_LOG}"
  run_capture "${output_file}" || { cat "${output_file}" >&2; fail_test "capture fixture failed"; }

  [[ -s "${STATE_FILE}" ]] || fail_test "capture did not publish a manifest"
  [[ "$(stat -f '%Lp' "${STATE_FILE}" 2>/dev/null || stat -c '%a' "${STATE_FILE}")" == "600" ]] || fail_test "manifest mode is not 0600"
  assert_contains "${STATE_FILE}" "manifest_version=1"
  assert_contains "${STATE_FILE}" "frontend_image=${FRONTEND_IMAGE}"
  assert_contains "${STATE_FILE}" "backend_image=${BACKEND_IMAGE}"
  assert_not_contains "${STATE_FILE}" "latest"
  frontend_protected="$(sed -n 's/^frontend_protected=//p' "${STATE_FILE}")"
  backend_protected="$(sed -n 's/^backend_protected=//p' "${STATE_FILE}")"
  [[ "${frontend_protected}" == justime-rollback/frontend:fixture-attempt-* ]] || fail_test "frontend protection tag is not attempt-scoped"
  [[ "${backend_protected}" == justime-rollback/backend:fixture-attempt-* ]] || fail_test "backend protection tag is not attempt-scoped"
  assert_contains "${MOCK_LOG}" "image tag ${FRONTEND_IMAGE} ${frontend_protected}"
  assert_contains "${MOCK_LOG}" "image tag ${BACKEND_IMAGE} ${backend_protected}"
  echo "[ok] exact prior images captured atomically"
}

test_candidate_success_releases_without_rollback() {
  local output_file="${TEMP_DIR}/release.out"
  local frontend_protected
  local backend_protected

  frontend_protected="$(sed -n 's/^frontend_protected=//p' "${STATE_FILE}")"
  backend_protected="$(sed -n 's/^backend_protected=//p' "${STATE_FILE}")"
  : >"${MOCK_LOG}"
  run_release "${output_file}" || { cat "${output_file}" >&2; fail_test "release fixture failed"; }
  [[ ! -e "${STATE_FILE}" ]] || fail_test "successful candidate left the prior-state manifest behind"
  assert_contains "${MOCK_LOG}" "image rm ${frontend_protected}"
  assert_contains "${MOCK_LOG}" "image rm ${backend_protected}"
  assert_not_contains "${MOCK_LOG}" " up "
  echo "[ok] candidate success releases protection without rollback"
}

test_candidate_failure_restores_exact_images() {
  local output_file="${TEMP_DIR}/rollback-success.out"

  run_capture "${TEMP_DIR}/recapture.out"
  : >"${MOCK_LOG}"
  rm -f "${OVERRIDE_CAPTURE}"
  run_rollback success "${output_file}" || { cat "${output_file}" >&2; fail_test "rollback success fixture failed"; }

  assert_contains "${OVERRIDE_CAPTURE}" "image: \"${FRONTEND_IMAGE}\""
  assert_contains "${OVERRIDE_CAPTURE}" "image: \"${BACKEND_IMAGE}\""
  assert_contains "${MOCK_LOG}" "up -d --no-build --pull never --wait --wait-timeout 45"
  assert_not_contains "${MOCK_LOG}" "--force-recreate"
  assert_contains "${output_file}" "[ok] image-rollback: prior application images are running and compose-ready"
  echo "[ok] candidate failure restores exact prior images"
}

test_missing_and_malformed_manifest() {
  local missing_output="${TEMP_DIR}/missing.out"
  local malformed_output="${TEMP_DIR}/malformed.out"

  rm -f "${STATE_FILE}"
  if run_rollback success "${missing_output}"; then
    fail_test "missing manifest fixture unexpectedly succeeded"
  fi
  assert_contains "${missing_output}" "prior-state manifest not found"

  mkdir -p "$(dirname "${STATE_FILE}")"
  cat >"${STATE_FILE}" <<EOF
manifest_version=1
attempt_id=malformed-fixture
frontend_image=latest
frontend_protected=justime-rollback/frontend:malformed-fixture
backend_image=${BACKEND_IMAGE}
backend_protected=justime-rollback/backend:malformed-fixture
EOF
  if run_rollback success "${malformed_output}"; then
    fail_test "malformed manifest fixture unexpectedly succeeded"
  fi
  assert_contains "${malformed_output}" "invalid immutable image ID for frontend"
  echo "[ok] missing and malformed manifests fail without guessing"
}

test_rollback_failure_is_nonzero() {
  local output_file="${TEMP_DIR}/rollback-failure.out"

  rm -f "${STATE_FILE}"
  run_capture "${TEMP_DIR}/failure-recapture.out"
  if run_rollback failure "${output_file}"; then
    fail_test "rollback failure fixture unexpectedly succeeded"
  fi
  assert_contains "${output_file}" "compose failed to restore prior application images"
  echo "[ok] rollback compose failure remains nonzero"
}

test_workflow_ordering() {
  local staging_block="${TEMP_DIR}/staging-workflow.txt"
  local capture_line
  local build_line
  local up_line
  local smoke_line
  local rollback_line
  local prune_line
  local release_line

  sed -n '/name: Deploy to Staging/,/  deploy-production:/p' "${WORKFLOW_FILE}" >"${staging_block}"
  capture_line="$(grep -n 'capture-deploy-state.sh$' "${staging_block}" | head -n1 | cut -d: -f1)"
  build_line="$(grep -n 'docker compose .* build$' "${staging_block}" | head -n1 | cut -d: -f1)"
  up_line="$(grep -n 'docker compose .* up -d --wait' "${staging_block}" | head -n1 | cut -d: -f1)"
  smoke_line="$(grep -n 'business-smoke.sh' "${staging_block}" | head -n1 | cut -d: -f1)"
  rollback_line="$(grep -n 'rollback-images.sh' "${staging_block}" | head -n1 | cut -d: -f1)"
  prune_line="$(grep -n 'docker system prune -f' "${staging_block}" | head -n1 | cut -d: -f1)"
  release_line="$(grep -n 'capture-deploy-state.sh --release' "${staging_block}" | head -n1 | cut -d: -f1)"

  [[ -n "${capture_line}${build_line}${up_line}${smoke_line}${rollback_line}${prune_line}${release_line}" ]] || fail_test "workflow ordering markers are incomplete"
  (( capture_line < build_line && build_line < up_line && up_line < smoke_line )) || fail_test "capture/build/readiness/smoke ordering is incorrect"
  (( smoke_line < rollback_line && rollback_line < prune_line && prune_line < release_line )) || fail_test "rollback/prune/release ordering is incorrect"
  echo "[ok] workflow preserves candidate gate and post-success prune ordering"
}

test_capture_exact_prior_images
test_candidate_success_releases_without_rollback
test_candidate_failure_restores_exact_images
test_missing_and_malformed_manifest
test_rollback_failure_is_nonzero
test_workflow_ordering

echo "All image rollback fixtures passed."
