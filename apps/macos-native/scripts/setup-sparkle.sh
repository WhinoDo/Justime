#!/bin/bash
set -euo pipefail

SPARKLE_VERSION="2.9.3"
SPARKLE_URL="https://github.com/sparkle-project/Sparkle/releases/download/${SPARKLE_VERSION}/Sparkle-for-Swift-Package-Manager.zip"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="${SCRIPT_DIR}/../Frameworks"
XCFRAMEWORK_DIR="${TARGET_DIR}/Sparkle.xcframework"

is_valid_sparkle() {
    local framework_dir="$1"

    [ -f "${framework_dir}/Info.plist" ] &&
        [ -n "$(find "${framework_dir}" -type f -path '*/Sparkle.framework/Versions/*/Sparkle' -print -quit)" ]
}

if is_valid_sparkle "${XCFRAMEWORK_DIR}"; then
    echo "Sparkle ${SPARKLE_VERSION} is already installed at ${XCFRAMEWORK_DIR}"
    exit 0
fi

echo "Downloading Sparkle ${SPARKLE_VERSION}..."
mkdir -p "${TARGET_DIR}"
TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/justime-sparkle.XXXXXX")"
trap 'rm -rf "${TEMP_DIR}"' EXIT
ZIP_FILE="${TEMP_DIR}/Sparkle.zip"

curl -fsSL --connect-timeout 30 --max-time 300 -o "${ZIP_FILE}" "${SPARKLE_URL}"

echo "Extracting..."
unzip -q "${ZIP_FILE}" -d "${TEMP_DIR}"

if ! is_valid_sparkle "${TEMP_DIR}/Sparkle.xcframework"; then
    echo "Error: downloaded Sparkle archive does not contain a valid binary target." >&2
    exit 1
fi

rm -rf "${XCFRAMEWORK_DIR}"
mv "${TEMP_DIR}/Sparkle.xcframework" "${XCFRAMEWORK_DIR}"

echo "Sparkle ${SPARKLE_VERSION} installed to ${XCFRAMEWORK_DIR}"
