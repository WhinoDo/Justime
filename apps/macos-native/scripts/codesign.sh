#!/usr/bin/env bash
set -euo pipefail

# Codesign the JustimeNative macOS binary.
#
# Usage:
#   bash scripts/codesign.sh [--identity "Developer ID Application: Name (Team)"]
#
# If --identity is not provided, the script reads $CODESIGN_IDENTITY.

IDENTITY="${1:-${CODESIGN_IDENTITY:-}}"

if [[ -z "$IDENTITY" ]]; then
  echo "error: No signing identity provided." >&2
  echo "Usage: $0 --identity \"Developer ID Application: Name (TeamID)\"" >&2
  echo "   or: export CODESIGN_IDENTITY=\"Developer ID Application: Name (TeamID)\"" >&2
  exit 1
fi

# Shift past --identity flag if present
if [[ "${1:-}" == "--identity" ]]; then
  shift
  IDENTITY="${1:?Missing value for --identity}"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="${APP_DIR}/.build/release"
BINARY="${BUILD_DIR}/JustimeNative"

if [[ ! -f "$BINARY" ]]; then
  echo "error: Binary not found at ${BINARY}. Run 'swift build -c release' first." >&2
  exit 1
fi

echo "==> Signing ${BINARY} with identity: ${IDENTITY}"
codesign --deep --force --options runtime --sign "$IDENTITY" "$BINARY"

echo "==> Verifying signature"
codesign --verify --verbose "$BINARY"

echo "==> codesign.sh complete"
