#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_NAME="JustimeNative"
PASS=0
FAIL=0

pass() { ((PASS++)); echo "  PASS: $1"; }
fail() { ((FAIL++)); echo "  FAIL: $1"; }

echo "=== JustimeNative Smoke Test ==="
echo "App directory: $APP_DIR"
echo ""

# Gate 1: Build in release mode
echo "[Gate 1] Release build"
if (cd "$APP_DIR" && swift build -c release 2>&1 | tail -5); then
    pass "swift build -c release"
else
    fail "swift build -c release"
fi

# Gate 2: Run all tests
echo ""
echo "[Gate 2] Unit + integration tests"
TEST_OUTPUT=$(cd "$APP_DIR" && swift test 2>&1) || true
if echo "$TEST_OUTPUT" | grep -q "Build complete"; then
    pass "swift test (build)"
fi
if echo "$TEST_OUTPUT" | grep -qE "Executed [0-9]+ tests.*0 failures"; then
    pass "swift test (all passing)"
elif echo "$TEST_OUTPUT" | grep -qE "Executed [0-9]+ tests"; then
    fail "swift test (some failures)"
    echo "$TEST_OUTPUT" | grep -E "(FAIL|failed|error:)" | head -10
else
    fail "swift test (unknown result)"
fi

# Gate 3: GUI launch test (only on GUI-capable runners)
echo ""
echo "[Gate 3] GUI smoke test"
if [ -n "${DISPLAY:-}" ] || [ "$(uname)" = "Darwin" ]; then
    BINARY_PATH=$(find "$APP_DIR/.build/release" -name "$APP_NAME" -type f 2>/dev/null | head -1)
    if [ -n "$BINARY_PATH" ]; then
        "$BINARY_PATH" &
        APP_PID=$!
        sleep 5
        if kill -0 "$APP_PID" 2>/dev/null; then
            pass "App launched and is running (PID: $APP_PID)"
            kill "$APP_PID" 2>/dev/null || true
            # Also try pkill by name as fallback
            pkill -f "$APP_NAME" 2>/dev/null || true
        else
            fail "App launched but exited within 5 seconds"
        fi
    else
        fail "Release binary not found"
    fi
else
    echo "  SKIP: No GUI environment available"
fi

# Gate 4: Code signing verification (if codesign script exists)
echo ""
echo "[Gate 4] Code signing verification"
if [ -f "$SCRIPT_DIR/codesign.sh" ]; then
    BINARY_PATH=$(find "$APP_DIR/.build/release" -name "$APP_NAME" -type f 2>/dev/null | head -1)
    if [ -n "$BINARY_PATH" ]; then
        if codesign --verify --deep --strict "$BINARY_PATH" 2>&1; then
            pass "codesign --verify"
        else
            fail "codesign --verify"
        fi
    else
        echo "  SKIP: Binary not found for codesign check"
    fi
else
    echo "  SKIP: codesign.sh not present — unsigned dev build"
fi

# Summary
echo ""
echo "=== Results ==="
echo "PASSED: $PASS"
echo "FAILED: $FAIL"

if [ "$FAIL" -gt 0 ]; then
    echo "SMOKE TEST: FAIL"
    exit 1
fi
echo "SMOKE TEST: PASS"
exit 0
