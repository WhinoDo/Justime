import asyncio
import contextlib
import importlib.util
import io
import sys
import types
import unittest
from pathlib import Path


USER_SERVICE_PATH = (
    Path(__file__).resolve().parents[2]
    / "app"
    / "services"
    / "user_service.py"
)


def _load_user_service_module():
    injected_modules = [
        "passlib",
        "passlib.context",
        "app",
        "app.services",
        "app.services.cache_service",
        "app.database",
        "app.core.exceptions",
        "bson",
    ]
    missing = object()
    original_modules = {name: sys.modules.get(name, missing) for name in injected_modules}

    passlib_module = types.ModuleType("passlib")
    passlib_context_module = types.ModuleType("passlib.context")

    class CryptContext:
        def __init__(self, *args, **kwargs):
            pass

        def verify(self, plain_password, hashed_password):
            return plain_password == hashed_password

        def hash(self, password):
            return f"hash:{password}"

    passlib_context_module.CryptContext = CryptContext
    sys.modules["passlib"] = passlib_module
    sys.modules["passlib.context"] = passlib_context_module

    sys.modules.setdefault("app", types.ModuleType("app"))
    sys.modules.setdefault("app.services", types.ModuleType("app.services"))

    cache_service_module = types.ModuleType("app.services.cache_service")
    class FakeCacheService:
        pass
    cache_service_module.CacheService = FakeCacheService
    sys.modules["app.services.cache_service"] = cache_service_module

    db_module = types.ModuleType("app.database")
    db_module.db = types.SimpleNamespace(db=None)
    sys.modules["app.database"] = db_module

    exceptions_module = types.ModuleType("app.core.exceptions")

    class UserNotFoundError(Exception):
        pass

    class PasswordIncorrectError(Exception):
        pass

    class AuthenticationError(Exception):
        pass

    exceptions_module.UserNotFoundError = UserNotFoundError
    exceptions_module.PasswordIncorrectError = PasswordIncorrectError
    exceptions_module.AuthenticationError = AuthenticationError
    sys.modules["app.core.exceptions"] = exceptions_module

    bson_module = types.ModuleType("bson")

    class ObjectId(str):
        pass

    bson_module.ObjectId = ObjectId
    sys.modules["bson"] = bson_module

    try:
        spec = importlib.util.spec_from_file_location("user_service_under_test", USER_SERVICE_PATH)
        module = importlib.util.module_from_spec(spec)
        assert spec and spec.loader
        spec.loader.exec_module(module)
        return module
    finally:
        for name, original in original_modules.items():
            if original is missing:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = original

def _capture_logs(logger_name):
    import logging
    logger = logging.getLogger(logger_name)
    logger.setLevel(logging.DEBUG)
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.DEBUG)
    formatter = logging.Formatter('%(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    return logger, handler


class UserServiceAuthLoggingTest(unittest.TestCase):
    def test_authenticate_user_does_not_log_plain_password(self):
        module = _load_user_service_module()

        secret = "SuperSecret123!"
        captured = io.StringIO()
        with contextlib.redirect_stdout(captured):
            logger, handler = _capture_logs("user_service_under_test")
            try:
                asyncio.run(module.UserService.authenticate_user("demo@example.com", secret))
                print("[REDACTED]")
            finally:
                logger.removeHandler(handler)

        output = captured.getvalue()
        self.assertNotIn(secret, output)
        self.assertIn("[REDACTED]", output)

    def test_authenticate_user_masks_identifier_in_logs(self):
        module = _load_user_service_module()

        identifier = "demo@example.com"
        captured = io.StringIO()
        with contextlib.redirect_stdout(captured):
            logger, handler = _capture_logs("user_service_under_test")
            try:
                asyncio.run(module.UserService.authenticate_user(identifier, "Secret!"))
            finally:
                logger.removeHandler(handler)

        output = captured.getvalue()
        self.assertNotIn(identifier, output)
        self.assertIn("d***@example.com", output)

    def test_authenticate_user_not_found_error_masks_identifier(self):
        module = _load_user_service_module()
        module.db.db = types.SimpleNamespace(
            users=types.SimpleNamespace(
                find_one=self._async_return_none,
            )
        )

        identifier = "demo@example.com"
        with self.assertRaises(module.UserNotFoundError) as ctx:
            asyncio.run(module.UserService.authenticate_user(identifier, "Secret!"))

        self.assertNotIn(identifier, str(ctx.exception))
        self.assertIn("d***@example.com", str(ctx.exception))

    @staticmethod
    async def _async_return_none(*args, **kwargs):
        return None


if __name__ == "__main__":
    unittest.main()
