#!/usr/bin/env bash
set -euo pipefail

# Codesign the JustimeNative macOS app bundle.
#
# Usage:
#   bash scripts/codesign.sh [--identity "Developer ID Application: Name (Team)"]
#
# If --identity is not provided, the script reads $CODESIGN_IDENTITY.

IDENTITY=""

if [[ "${1:-}" == "--identity" ]]; then
  shift
  IDENTITY="${1:?Missing value for --identity}"
fi

IDENTITY="${IDENTITY:-${CODESIGN_IDENTITY:-}}"

if [[ -z "$IDENTITY" ]]; then
  echo "error: No signing identity provided." >&2
  echo "Usage: $0 --identity \"Developer ID Application: Name (TeamID)\"" >&2
  echo "   or: export CODESIGN_IDENTITY=\"Developer ID Application: Name (TeamID)\"" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_BUNDLE="${APP_DIR}/JustimeNative.app"
ENTITLEMENTS="${APP_BUNDLE}/Contents/Resources/JustimeNative.entitlements"

if [[ ! -d "$APP_BUNDLE" ]]; then
  echo "error: App bundle not found at ${APP_BUNDLE}. Run build-dmg.sh first to create the .app wrapper." >&2
  exit 1
fi

if [[ ! -f "$ENTITLEMENTS" ]]; then
  echo "error: Entitlements file not found at ${ENTITLEMENTS}." >&2
  exit 1
fi

echo "==> Signing ${APP_BUNDLE} with identity: ${IDENTITY}"
codesign --deep --force --options runtime --entitlements "$ENTITLEMENTS" --sign "$IDENTITY" "$APP_BUNDLE"

echo "==> Verifying signature"
codesign --verify --verbose=2 "$APP_BUNDLE"

echo "==> codesign.sh complete"
