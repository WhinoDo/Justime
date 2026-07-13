"""Regression tests for security environment handling in test bootstrap."""

import json
import subprocess
import sys
from pathlib import Path


CONFTEST_PATH = Path(__file__).with_name("conftest.py")
SECURITY_KEYS = (
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "JWT_PASSWORD_RESET_SECRET",
    "ENCRYPTION_SECRET",
    "CSRF_SECRET",
)
DEFAULT_VALUES = {
    "JWT_SECRET": "test-jwt-secret-key-at-least-32-characters-long!",
    "JWT_REFRESH_SECRET": "test-refresh-secret-key-at-least-32-characters-long!",
    "JWT_PASSWORD_RESET_SECRET": "test-password-reset-secret-key-at-least-32-characters-long!",
    "ENCRYPTION_SECRET": "test-encryption-secret-key-at-least-32-characters-long!",
    "CSRF_SECRET": "test-csrf-secret-key-at-least-32-characters-long!",
}
BOOTSTRAP_SCRIPT = """
import json
import os
import runpy
import sys

keys = json.loads(sys.argv[1])
initial_values = json.loads(sys.argv[2])
for key in keys:
    os.environ.pop(key, None)
os.environ.update(initial_values)

runpy.run_path(sys.argv[3], run_name="__security_env_test_conftest__")
print(json.dumps({key: os.environ[key] for key in keys}))
"""


def run_conftest_bootstrap(initial_values: dict[str, str]) -> dict[str, str]:
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            BOOTSTRAP_SCRIPT,
            json.dumps(SECURITY_KEYS),
            json.dumps(initial_values),
            str(CONFTEST_PATH),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def test_conftest_preserves_explicit_security_environment() -> None:
    sentinel_values = {
        key: f"sentinel-{index}-{key.lower()}"
        for index, key in enumerate(SECURITY_KEYS, start=1)
    }

    assert run_conftest_bootstrap(sentinel_values) == sentinel_values


def test_conftest_defaults_security_environment_when_absent() -> None:
    assert run_conftest_bootstrap({}) == DEFAULT_VALUES
