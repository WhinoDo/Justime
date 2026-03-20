#!/usr/bin/env bash
set -euo pipefail

venv_dir="${1:-.codex-notebooklm-venv}"

if [[ ! -d "${venv_dir}" ]]; then
  python3 -m venv "${venv_dir}"
fi

"${venv_dir}/bin/python" -m pip install --upgrade pip
"${venv_dir}/bin/python" -m pip install notebooklm-py

cat <<EOF
Installed notebooklm-py into ${venv_dir}

Use one of:
  export PATH="$(pwd)/${venv_dir}/bin:\$PATH"
  ${venv_dir}/bin/notebooklm --help
EOF
