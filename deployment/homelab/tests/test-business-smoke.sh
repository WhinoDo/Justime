#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SMOKE_SCRIPT="${SCRIPT_DIR}/../scripts/business-smoke.sh"
TEMP_DIR="$(mktemp -d)"
SERVER_PID=""

cleanup() {
  if [[ -n "${SERVER_PID}" ]]; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
  rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT

start_server() {
  local scenario="$1"
  local port_file="${TEMP_DIR}/port"
  rm -f "${port_file}"

  python3 - "${scenario}" "${port_file}" <<'PY' &
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

scenario = sys.argv[1]
port_file = sys.argv[2]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/backend/api/v1/health/ready":
            if scenario == "readiness_503":
                self.respond(503, {"status": "not_ready"})
            elif scenario == "malformed_json":
                self.respond(200, b'{"status":')
            elif scenario == "degraded":
                self.respond(200, {"status": "degraded"})
            else:
                self.respond(200, {"status": "ready"})
            return

        if self.path == "/backend/api/v1/auth/me":
            if scenario == "api_5xx":
                self.respond(500, {"detail": "fixture failure"})
            else:
                self.respond(401, {"detail": "Not authenticated"})
            return

        self.respond(404, {"detail": "Not found"})

    def respond(self, status, payload):
        body = payload if isinstance(payload, bytes) else json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        return


server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
with open(port_file, "w", encoding="utf-8") as output:
    output.write(str(server.server_port))
server.serve_forever()
PY
  SERVER_PID=$!

  for _ in $(seq 1 50); do
    if [[ -s "${port_file}" ]]; then
      SERVER_PORT="$(cat "${port_file}")"
      return
    fi
    sleep 0.05
  done

  echo "fake server did not start" >&2
  exit 1
}

stop_server() {
  kill "${SERVER_PID}" >/dev/null 2>&1 || true
  wait "${SERVER_PID}" 2>/dev/null || true
  SERVER_PID=""
}

run_smoke() {
  local output_file="$1"
  BASE_URL="http://127.0.0.1:${SERVER_PORT}" \
    SMOKE_TIMEOUT_SECONDS=1 \
    SMOKE_RETRY_INTERVAL_SECONDS=1 \
    SMOKE_REQUEST_TIMEOUT_SECONDS=1 \
    bash "${SMOKE_SCRIPT}" >"${output_file}" 2>&1
}

assert_contains() {
  local file="$1"
  local expected="$2"
  if ! grep -Fq "${expected}" "${file}"; then
    echo "expected '${expected}' in ${file}" >&2
    cat "${file}" >&2
    exit 1
  fi
}

assert_success() {
  local scenario="$1"
  local expected_status="$2"
  local output_file="${TEMP_DIR}/${scenario}.out"

  start_server "${scenario}"
  if ! run_smoke "${output_file}"; then
    cat "${output_file}" >&2
    exit 1
  fi
  stop_server

  assert_contains "${output_file}" "[ok] readiness: HTTP 200 status=${expected_status}"
  assert_contains "${output_file}" "[ok] auth-contract: HTTP 401 credential-free GET"
  echo "[ok] fixture ${scenario}"
}

assert_failure() {
  local scenario="$1"
  local expected_stage="$2"
  local output_file="${TEMP_DIR}/${scenario}.out"

  start_server "${scenario}"
  if run_smoke "${output_file}"; then
    echo "expected fixture ${scenario} to fail" >&2
    cat "${output_file}" >&2
    exit 1
  fi
  stop_server

  assert_contains "${output_file}" "[fail] ${expected_stage}:"
  echo "[ok] fixture ${scenario}"
}

assert_configuration_failure() {
  local output_file="${TEMP_DIR}/configuration.out"

  if BASE_URL="http://127.0.0.1:1" SMOKE_TIMEOUT_SECONDS=0 bash "${SMOKE_SCRIPT}" >"${output_file}" 2>&1; then
    echo "expected invalid timeout configuration to fail" >&2
    cat "${output_file}" >&2
    exit 1
  fi

  assert_contains "${output_file}" "[fail] configuration: SMOKE_TIMEOUT_SECONDS"
  echo "[ok] fixture invalid_configuration"
}

assert_success "success" "ready"
assert_success "degraded" "degraded"
assert_failure "readiness_503" "readiness"
assert_failure "malformed_json" "readiness"
assert_failure "api_5xx" "auth-contract"
assert_configuration_failure

echo "All business smoke fixtures passed."
