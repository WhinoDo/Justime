#!/usr/bin/env bash
set -euo pipefail

storage_path="${1:-${NOTEBOOKLM_STORAGE:-${HOME}/.notebooklm/storage_state.json}}"

echo "NotebookLM environment check"
echo "binary: $(command -v notebooklm || echo 'missing')"

if command -v notebooklm >/dev/null 2>&1; then
  notebooklm --version || true
fi

echo "NOTEBOOKLM_HOME: ${NOTEBOOKLM_HOME:-<unset>}"

if [[ -n "${NOTEBOOKLM_AUTH_JSON:-}" ]]; then
  echo "NOTEBOOKLM_AUTH_JSON: set"
else
  echo "NOTEBOOKLM_AUTH_JSON: <unset>"
fi

echo "storage_state.json: ${storage_path}"
if [[ -f "${storage_path}" ]]; then
  echo "storage_state.json exists"
else
  echo "storage_state.json missing"
fi

if command -v notebooklm >/dev/null 2>&1; then
  echo
  echo "status probe:"
  notebooklm status || true
fi
