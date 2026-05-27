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

    spec = importlib.util.spec_from_file_location("user_service_under_test", USER_SERVICE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


class UserServiceAuthLoggingTest(unittest.TestCase):
    def test_authenticate_user_does_not_log_plain_password(self):
        module = _load_user_service_module()

        secret = "SuperSecret123!"
        captured = io.StringIO()
        with contextlib.redirect_stdout(captured):
            asyncio.run(module.UserService.authenticate_user("demo@example.com", secret))

        output = captured.getvalue()
        self.assertNotIn(secret, output)
        self.assertIn("[REDACTED]", output)

    def test_authenticate_user_masks_identifier_in_logs(self):
        module = _load_user_service_module()

        identifier = "demo@example.com"
        captured = io.StringIO()
        with contextlib.redirect_stdout(captured):
            asyncio.run(module.UserService.authenticate_user(identifier, "Secret!"))

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
