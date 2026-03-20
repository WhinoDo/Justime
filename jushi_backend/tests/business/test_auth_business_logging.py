import asyncio
import contextlib
import importlib.util
import io
import sys
import types
import unittest
from pathlib import Path


AUTH_BUSINESS_PATH = (
    Path(__file__).resolve().parents[2]
    / "app"
    / "business"
    / "auth_business.py"
)


def _load_auth_business_module(authenticate_error: Exception | None = None):
    fastapi_module = types.ModuleType("fastapi")

    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str):
            self.status_code = status_code
            self.detail = detail
            super().__init__(detail)

    fastapi_module.HTTPException = HTTPException
    sys.modules["fastapi"] = fastapi_module

    sys.modules.setdefault("app", types.ModuleType("app"))

    core_exceptions_module = types.ModuleType("app.core.exceptions")

    class UserNotFoundError(Exception):
        pass

    class PasswordIncorrectError(Exception):
        pass

    core_exceptions_module.UserNotFoundError = UserNotFoundError
    core_exceptions_module.PasswordIncorrectError = PasswordIncorrectError
    sys.modules["app.core.exceptions"] = core_exceptions_module

    class _UserService:
        @staticmethod
        def _mask_identifier(identifier: str) -> str:
            local, _, domain = identifier.partition("@")
            return f"{local[:1]}***@{domain}" if domain else "***"

        @staticmethod
        async def authenticate_user(identifier: str, password: str):
            if authenticate_error is not None:
                raise authenticate_error
            raise UserNotFoundError("not found")

        @staticmethod
        async def get_user_profile(user_id: str):
            return {}

        @staticmethod
        async def get_available_models_for_user(user_id: str):
            return []

        @staticmethod
        async def get_user_active_model_id(user_id: str):
            return None

    user_service_module = types.ModuleType("app.services.user_service")
    user_service_module.UserService = _UserService
    sys.modules["app.services.user_service"] = user_service_module

    security_service_module = types.ModuleType("app.services.security_service")

    class SecurityService:
        @staticmethod
        def create_access_token(data, expires_delta=None):
            return "token"

    security_service_module.SecurityService = SecurityService
    sys.modules["app.services.security_service"] = security_service_module

    encryption_service_module = types.ModuleType("app.services.encryption_service")
    encryption_service_module.encryption_service = types.SimpleNamespace(
        decrypt=lambda value: value
    )
    sys.modules["app.services.encryption_service"] = encryption_service_module

    database_module = types.ModuleType("app.database")
    database_module.db = types.SimpleNamespace(db=object())
    sys.modules["app.database"] = database_module

    models_auth_module = types.ModuleType("app.models.auth")

    class LoginRequest:
        def __init__(self, identifier: str, password: str, rememberMe: bool = False):
            self.identifier = identifier
            self.password = password
            self.rememberMe = rememberMe

    class AuthResponse:
        def __init__(self, success: bool, message: str, data=None):
            self.success = success
            self.message = message
            self.data = data

    class _Dummy:
        def __init__(self, *args, **kwargs):
            pass

    models_auth_module.RegisterRequest = _Dummy
    models_auth_module.LoginRequest = LoginRequest
    models_auth_module.SafeUser = _Dummy
    models_auth_module.UserProfile = _Dummy
    models_auth_module.AuthData = _Dummy
    models_auth_module.AuthResponse = AuthResponse
    models_auth_module.LLMConfig = _Dummy
    sys.modules["app.models.auth"] = models_auth_module

    spec = importlib.util.spec_from_file_location("auth_business_under_test", AUTH_BUSINESS_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


class AuthBusinessLoggingTest(unittest.TestCase):
    def test_login_not_found_masks_identifier_in_logs(self):
        module = _load_auth_business_module()
        payload = module.LoginRequest(identifier="demo@example.com", password="Secret!")

        captured = io.StringIO()
        with contextlib.redirect_stdout(captured):
            result = asyncio.run(module.AuthBusiness.login(payload))

        output = captured.getvalue()
        self.assertFalse(result.success)
        self.assertNotIn("demo@example.com", output)
        self.assertIn("d***@example.com", output)

    def test_login_unexpected_error_does_not_leak_identifier(self):
        module = _load_auth_business_module(
            authenticate_error=RuntimeError("db fail for demo@example.com")
        )
        payload = module.LoginRequest(identifier="demo@example.com", password="Secret!")

        captured = io.StringIO()
        with contextlib.redirect_stdout(captured):
            result = asyncio.run(module.AuthBusiness.login(payload))

        output = captured.getvalue()
        self.assertFalse(result.success)
        self.assertEqual(result.message, "登录失败，请稍后重试")
        self.assertNotIn("demo@example.com", output)


if __name__ == "__main__":
    unittest.main()
