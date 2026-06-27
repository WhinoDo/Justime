#!/usr/bin/env bash
set -euo pipefail

# Create an .app bundle from the SwiftPM release binary, then package it into a DMG.
#
# Usage:
#   bash scripts/build-dmg.sh [--identity "Developer ID Application: Name (Team)"]
#
# If --identity is not provided, reads $CODESIGN_IDENTITY.
# The .app bundle is signed by codesign.sh BEFORE this script packages the DMG;
# the DMG itself is signed by this script with the same identity.
#
# Produces:
#   apps/macos-native/JustimeNative.app  (app bundle — signed by codesign.sh)
#   apps/macos-native/Justime.dmg        (signed DMG)

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
BUILD_DIR="${APP_DIR}/.build/release"
BINARY="${BUILD_DIR}/JustimeNative"
PLIST="${APP_DIR}/Sources/JustimeNative/Resources/BundleInfo.plist"
APP_BUNDLE="${APP_DIR}/JustimeNative.app"
DMG_OUTPUT="${APP_DIR}/Justime.dmg"

if [[ ! -f "$BINARY" ]]; then
  echo "error: Binary not found at ${BINARY}. Run 'swift build -c release' first." >&2
  exit 1
fi

if [[ ! -f "$PLIST" ]]; then
  echo "error: BundleInfo.plist not found at ${PLIST}." >&2
  exit 1
fi

# --- Step 1: Create .app bundle structure ---

echo "==> Creating .app bundle at ${APP_BUNDLE}"
rm -rf "$APP_BUNDLE"

mkdir -p "${APP_BUNDLE}/Contents/MacOS"
mkdir -p "${APP_BUNDLE}/Contents/Resources"

cp "$BINARY" "${APP_BUNDLE}/Contents/MacOS/JustimeNative"
cp "$PLIST" "${APP_BUNDLE}/Contents/Info.plist"

# Copy entitlements for codesign.sh to use
ENTITLEMENTS="${APP_DIR}/Sources/JustimeNative/Resources/JustimeNative.entitlements"
if [[ -f "$ENTITLEMENTS" ]]; then
  cp "$ENTITLEMENTS" "${APP_BUNDLE}/Contents/Resources/JustimeNative.entitlements"
fi

echo "==> .app bundle created: ${APP_BUNDLE}"

# --- Step 2: Sign and create DMG ---

echo "==> Signing .app bundle with identity: ${IDENTITY}"
codesign --deep --force --options runtime \
  --entitlements "${APP_BUNDLE}/Contents/Resources/JustimeNative.entitlements" \
  --sign "$IDENTITY" \
  "$APP_BUNDLE"

echo "==> Verifying .app signature"
codesign --verify --verbose=2 "$APP_BUNDLE"

# --- Step 3: Create DMG ---

TMPDIR_STAGING="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_STAGING"' EXIT

STAGING="${TMPDIR_STAGING}/Justime"
mkdir -p "${STAGING}"

cp -R "$APP_BUNDLE" "${STAGING}/JustimeNative.app"
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
