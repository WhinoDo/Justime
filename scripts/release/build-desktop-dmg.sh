#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DESKTOP_DIR="$ROOT_DIR/apps/desktop"

cd "$DESKTOP_DIR"

if [ ! -d node_modules ]; then
  npm install
fi

npm run dist:dmg
