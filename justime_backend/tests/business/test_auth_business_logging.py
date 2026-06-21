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


def _load_auth_business_module(
    authenticate_error: Exception | None = None,
    available_models: list[dict] | None = None,
    active_model_id: str | None = None,
    provider_models_error: Exception | None = None,
):
    injected_modules = [
        "fastapi",
        "app",
        "app.services",
        "app.services.cache_service",
        "app.core",
        "app.core.normalizers",
        "app.core.exceptions",
        "app.services.user_service",
        "app.services.security_service",
        "app.services.encryption_service",
        "app.database",
        "app.models.auth",
        "httpx",
    ]
    missing = object()
    original_modules = {name: sys.modules.get(name, missing) for name in injected_modules}

    fastapi_module = types.ModuleType("fastapi")

    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str):
            self.status_code = status_code
            self.detail = detail
            super().__init__(detail)

    fastapi_module.HTTPException = HTTPException
    sys.modules["fastapi"] = fastapi_module

    sys.modules.setdefault("app", types.ModuleType("app"))
    sys.modules.setdefault("app.services", types.ModuleType("app.services"))

    cache_service_module = types.ModuleType("app.services.cache_service")
    class FakeCacheService:
        pass
    cache_service_module.CacheService = FakeCacheService
    sys.modules["app.services.cache_service"] = cache_service_module

    sys.modules.setdefault("app.core", types.ModuleType("app.core"))

    normalizers_module = types.ModuleType("app.core.normalizers")
    normalizers_module.normalize_bool = lambda v: bool(v)
    normalizers_module.normalize_capabilities = lambda v: v
    normalizers_module.normalize_priority = lambda v: v
    sys.modules["app.core.normalizers"] = normalizers_module

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
            return available_models or []

        @staticmethod
        async def get_user_active_model_id(user_id: str):
            return active_model_id

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
    models_auth_module.ForgotPasswordRequest = _Dummy
    models_auth_module.ResetPasswordRequest = _Dummy
    sys.modules["app.models.auth"] = models_auth_module

    if provider_models_error is not None:
        httpx_module = types.ModuleType("httpx")

        class TimeoutException(Exception):
            pass

        class _AsyncClient:
            def __init__(self, timeout: float):
                self.timeout = timeout

            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc, tb):
                return False

            async def get(self, *args, **kwargs):
                raise provider_models_error

        httpx_module.TimeoutException = TimeoutException
        httpx_module.AsyncClient = _AsyncClient
        sys.modules["httpx"] = httpx_module

    def restore_modules():
        for name, original in original_modules.items():
            if original is missing:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = original

    try:
        spec = importlib.util.spec_from_file_location("auth_business_under_test", AUTH_BUSINESS_PATH)
        module = importlib.util.module_from_spec(spec)
        assert spec and spec.loader
        spec.loader.exec_module(module)
        module.restore_modules = restore_modules
        return module
    except Exception:
        restore_modules()
        raise


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


class AuthBusinessLoggingTest(unittest.TestCase):
    def test_login_not_found_masks_identifier_in_logs(self):
        module = _load_auth_business_module()
        self.addCleanup(module.restore_modules)
        payload = module.LoginRequest(identifier="demo@example.com", password="Secret!")

        captured = io.StringIO()
        with contextlib.redirect_stdout(captured):
            logger, handler = _capture_logs("auth_business_under_test")
            try:
                with self.assertRaises(module.HTTPException) as ctx:
                    asyncio.run(module.AuthBusiness.login(payload))
                self.assertEqual(ctx.exception.status_code, 404)
            finally:
                logger.removeHandler(handler)

        output = captured.getvalue()
        self.assertNotIn("demo@example.com", output)
        self.assertIn("d***@example.com", output)

    def test_login_unexpected_error_does_not_leak_identifier(self):
        module = _load_auth_business_module(
            authenticate_error=RuntimeError("db fail for demo@example.com")
        )
        self.addCleanup(module.restore_modules)
        payload = module.LoginRequest(identifier="demo@example.com", password="Secret!")

        captured = io.StringIO()
        with contextlib.redirect_stdout(captured):
            logger, handler = _capture_logs("auth_business_under_test")
            try:
                with self.assertRaises(RuntimeError):
                    asyncio.run(module.AuthBusiness.login(payload))
            finally:
                logger.removeHandler(handler)

        output = captured.getvalue()
        self.assertNotIn("demo@example.com", output)

    def test_get_provider_models_unexpected_error_does_not_leak_raw_detail(self):
        module = _load_auth_business_module(
            available_models=[
                {
                    "id": "cfg-1",
                    "base_url": "https://example.com",
                    "api_key": "enc-key",
                }
            ],
            active_model_id="cfg-1",
            provider_models_error=RuntimeError(
                "provider rejected api_key=sk-secret-demo@example.com"
            ),
        )
        self.addCleanup(module.restore_modules)

        with self.assertRaises(module.HTTPException) as ctx:
            asyncio.run(module.AuthBusiness.get_provider_models("user-1"))

        self.assertEqual(ctx.exception.status_code, 502)
        self.assertEqual(ctx.exception.detail, "获取供应商模型失败，请稍后重试")
        self.assertNotIn("sk-secret", ctx.exception.detail)
        self.assertNotIn("demo@example.com", ctx.exception.detail)


if __name__ == "__main__":
    unittest.main()
