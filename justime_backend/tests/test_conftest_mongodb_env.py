"""Regression tests for MongoDB environment handling in test bootstrap."""

import json
import subprocess
import sys
from pathlib import Path


CONFTEST_PATH = Path(__file__).with_name("conftest.py")
BOOTSTRAP_SCRIPT = """
import json
import os
import runpy
import sys

mode = sys.argv[1]
if mode == "explicit":
    os.environ["MONGODB_URI"] = "mongodb://ci-mongo:27017/ci_database"
    os.environ["MONGODB_DB_NAME"] = "ci_database"
elif mode == "absent":
    os.environ.pop("MONGODB_URI", None)
    os.environ.pop("MONGODB_DB_NAME", None)
else:
    raise ValueError(f"Unsupported mode: {mode}")

runpy.run_path(sys.argv[2], run_name="__mongodb_env_test_conftest__")
print(json.dumps({
    "MONGODB_URI": os.environ["MONGODB_URI"],
    "MONGODB_DB_NAME": os.environ["MONGODB_DB_NAME"],
}))
"""


def run_conftest_bootstrap(mode: str) -> dict[str, str]:
    result = subprocess.run(
        [sys.executable, "-c", BOOTSTRAP_SCRIPT, mode, str(CONFTEST_PATH)],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def test_conftest_preserves_explicit_mongodb_environment() -> None:
    values = run_conftest_bootstrap("explicit")

    assert values == {
        "MONGODB_URI": "mongodb://ci-mongo:27017/ci_database",
        "MONGODB_DB_NAME": "ci_database",
    }


def test_conftest_defaults_mongodb_environment_when_absent() -> None:
    values = run_conftest_bootstrap("absent")

    assert values == {
        "MONGODB_URI": "mongodb://localhost:27018/justime_test",
        "MONGODB_DB_NAME": "justime_test",
    }
