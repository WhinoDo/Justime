#!/usr/bin/env bash
set -euo pipefail

# Submit a signed binary or DMG for Apple notarization and staple the result.
#
# Usage:
#   bash scripts/notarize.sh <path-to-zip-or-dmg> \
#     [--apple-id <id>] [--password <app-specific-pw>] [--team-id <team>]
#
# Alternatively set env vars: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID.

TARGET="${1:?Usage: $0 <path-to-zip-or-dmg>}"
shift

APPLE_ID="${APPLE_ID:-}"
PASSWORD="${APPLE_APP_SPECIFIC_PASSWORD:-}"
TEAM_ID="${APPLE_TEAM_ID:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apple-id)  APPLE_ID="$2"; shift 2 ;;
    --password)  PASSWORD="$2"; shift 2 ;;
    --team-id)   TEAM_ID="$2";  shift 2 ;;
    *)           echo "error: Unknown option $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$APPLE_ID" || -z "$PASSWORD" || -z "$TEAM_ID" ]]; then
  echo "error: Missing notarization credentials." >&2
  echo "Required: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID" >&2
  echo "   or pass: --apple-id <id> --password <pw> --team-id <team>" >&2
  exit 1
fi

if [[ ! -f "$TARGET" ]]; then
  echo "error: Target file not found: ${TARGET}" >&2
  exit 1
fi

echo "==> Submitting ${TARGET} for notarization"
xcrun notarytool submit "$TARGET" \
  --apple-id "$APPLE_ID" \
  --password "$PASSWORD" \
  --team-id "$TEAM_ID" \
  --wait

echo "==> Stapling notarization ticket"
xcrun stapler staple "$TARGET"

echo "==> notarize.sh complete"
