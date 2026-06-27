#!/usr/bin/env bash
set -euo pipefail

# Build a signed DMG from the JustimeNative binary.
#
# Usage:
#   bash scripts/build-dmg.sh [--identity "Developer ID Application: Name (Team)"]
#
# If --identity is not provided, reads $CODESIGN_IDENTITY.
# Produces: apps/macos-native/Justime.dmg

IDENTITY="${CODESIGN_IDENTITY:-}"

if [[ "${1:-}" == "--identity" ]]; then
  shift
  IDENTITY="${1:?Missing value for --identity}"
fi

if [[ -z "$IDENTITY" ]]; then
  echo "error: No signing identity provided." >&2
  echo "Usage: $0 --identity \"Developer ID Application: Name (TeamID)\"" >&2
  echo "   or: export CODESIGN_IDENTITY=\"Developer ID Application: Name (TeamID)\"" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="${APP_DIR}/.build/release"
BINARY="${BUILD_DIR}/JustimeNative"
DMG_OUTPUT="${APP_DIR}/Justime.dmg"

if [[ ! -f "$BINARY" ]]; then
  echo "error: Binary not found at ${BINARY}. Run 'swift build -c release' first." >&2
  exit 1
fi

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

STAGING="${TMPDIR}/Justime"
mkdir -p "${STAGING}"

echo "==> Staging binary and Applications symlink"
cp "$BINARY" "${STAGING}/JustimeNative"
ln -s /Applications "${STAGING}/Applications"

echo "==> Creating DMG"
rm -f "$DMG_OUTPUT"
hdiutil create \
  -volname "Justime" \
  -srcfolder "$STAGING" \
  -ov \
  -format UDZO \
  "$DMG_OUTPUT"

echo "==> Signing DMG with identity: ${IDENTITY}"
codesign --force --sign "$IDENTITY" "$DMG_OUTPUT"

echo "==> build-dmg.sh complete: ${DMG_OUTPUT}"
