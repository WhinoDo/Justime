#!/bin/bash
set -euo pipefail

SPARKLE_VERSION="2.9.3"
SPARKLE_URL="https://github.com/sparkle-project/Sparkle/releases/download/${SPARKLE_VERSION}/Sparkle-for-Swift-Package-Manager.zip"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="${SCRIPT_DIR}/../Frameworks"
ZIP_FILE="${TARGET_DIR}/Sparkle.zip"

if [ -d "${TARGET_DIR}/Sparkle.xcframework" ]; then
    echo "Sparkle.xcframework already exists at ${TARGET_DIR}"
    exit 0
fi

echo "Downloading Sparkle ${SPARKLE_VERSION}..."
mkdir -p "${TARGET_DIR}"
curl -L --connect-timeout 30 --max-time 300 -o "${ZIP_FILE}" "${SPARKLE_URL}"

echo "Extracting..."
unzip -o "${ZIP_FILE}" -d "${TARGET_DIR}"
rm -f "${ZIP_FILE}"

echo "Sparkle ${SPARKLE_VERSION} installed to ${TARGET_DIR}/Sparkle.xcframework"
