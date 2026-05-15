"""
中间件模块
提供请求日志、大小限制、CORS注册、API限流和CSRF防护。
"""

import logging
import time
import secrets
import hmac
import hashlib
from datetime import datetime, timedelta

from fastapi import Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.rate_limiter import RateLimitMiddleware
from app.core.log_sanitizer import sanitize_url, sanitize_headers

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware:
    """
    安全响应头中间件
    添加 OWASP 推荐的安全响应头
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = dict(message.get("headers", []))
                
                security_headers = {
                    "x-content-type-options": "nosniff",
                    "x-frame-options": "SAMEORIGIN",
                    "x-xss-protection": "1; mode=block",
                    "referrer-policy": "strict-origin-when-cross-origin",
                    "permissions-policy": "camera=(), microphone=(), geolocation=()",
                }
                
                from app.core.config import settings
                if not settings.DEBUG:
                    security_headers["strict-transport-security"] = "max-age=63072000; includeSubDomains; preload"
                
                for header_name, header_value in security_headers.items():
                    if header_name.encode() not in headers:
                        headers[header_name.encode()] = header_value.encode()
                
                message["headers"] = list(headers.items())
            
            await send(message)

        await self.app(scope, receive, send_wrapper)


class RequestLoggingMiddleware:
    """
    请求日志中间件
    记录请求和响应信息，自动脱敏敏感数据
    """

    SENSITIVE_PATHS = {
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/change-password",
        "/api/v1/auth/reset-password",
    }

    def __init__(self, app):
        self.app = app

    def _is_sensitive_path(self, path: str) -> bool:
        return path in self.SENSITIVE_PATHS or any(
            sensitive in path for sensitive in ["/auth/", "/login", "/register", "/password"]
        )

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive=receive)
        start_time = time.time()

        sanitized_path = sanitize_url(str(request.url.path))
        client_host = request.client.host if request.client else "unknown"
        
        sanitized_headers = sanitize_headers(dict(request.headers))
        auth_header = sanitized_headers.get("authorization", "")

        logger.info(
            f"Request: {request.method} {sanitized_path} "
            f"Client: {client_host}"
        )

        response_started = False

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                response_started = True
                process_time = time.time() - start_time
                status_code = message["status"]
                logger.info(
                    f"Response: {request.method} {sanitized_path} "
                    f"Status: {status_code} Time: {process_time:.3f}s"
                )
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as e:
            process_time = time.time() - start_time
            from app.core.log_sanitizer import sanitize_error_message
            error_msg = sanitize_error_message(f"{type(e).__name__}: {str(e)}")
            logger.error(
                f"Request failed: {request.method} {sanitized_path} "
                f"Error: {error_msg} Time: {process_time:.3f}s"
            )
            raise


class RequestSizeLimitMiddleware:
    """
    请求大小限制中间件
    防止过大的请求体
    """

    MAX_REQUEST_SIZE = 10 * 1024 * 1024  # 10MB 默认限制

    def __init__(self, app, max_size: int = None):
        self.app = app
        self.max_size = max_size or self.MAX_REQUEST_SIZE

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive=receive)

        # 检查 Content-Length
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                length = int(content_length)
                if length > self.max_size:
                    response = JSONResponse(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        content={
                            "success": False,
                            "error": f"请求体大小超过限制 ({self.max_size / 1024 / 1024:.1f}MB)",
                            "code": 413,
                        }
                    )
                    await response(scope, receive, send)
                    return
            except ValueError:
                pass

        await self.app(scope, receive, send)


class CSRFMiddleware:
    """
    CSRF 防护中间件
    
    工作原理:
    1. 对于需要 CSRF 保护的请求方法 (POST, PUT, DELETE, PATCH)，验证请求头中的 CSRF token
    2. CSRF token 通过 GET /api/v1/auth/csrf-token 获取，并设置到 cookie 中
    3. 前端需要从 cookie 读取 token 并在请求头中发送
    
    豁免路径:
    - 登录、注册、刷新令牌等无需认证的端点
    - 静态资源
    - 健康检查端点
    """

    CSRF_EXEMPT_PATHS = {
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh",
        "/api/v1/auth/csrf-token",
        "/api/v1/auth/forgot-password",
        "/api/v1/auth/reset-password",
        "/api/v1/health",
        "/api/v1/health/",
    }
    
    CSRF_EXEMPT_PREFIXES = (
        "/docs",
        "/redoc",
        "/openapi.json",
    )

    PROTECTED_METHODS = {"POST", "PUT", "DELETE", "PATCH"}

    def __init__(self, app):
        self.app = app

    def _generate_csrf_token(self) -> str:
        """生成 CSRF token"""
        timestamp = int(datetime.utcnow().timestamp())
        random_bytes = secrets.token_hex(16)
        payload = f"{timestamp}:{random_bytes}"
        signature = hmac.new(
            settings.CSRF_SECRET.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
        return f"{payload}:{signature}"

    def _validate_csrf_token(self, token: str) -> bool:
        """验证 CSRF token"""
        if not token:
            return False
        
        try:
            parts = token.split(":")
            if len(parts) != 3:
                return False
            
            timestamp_str, random_bytes, signature = parts
            timestamp = int(timestamp_str)
            
            if datetime.utcnow() > datetime.utcfromtimestamp(timestamp) + timedelta(hours=settings.CSRF_TOKEN_EXPIRE_HOURS):
                return False
            
            payload = f"{timestamp_str}:{random_bytes}"
            expected_signature = hmac.new(
                settings.CSRF_SECRET.encode(),
                payload.encode(),
                hashlib.sha256
            ).hexdigest()
            
            return hmac.compare_digest(signature, expected_signature)
        except (ValueError, TypeError):
            return False

    def _is_exempt(self, path: str) -> bool:
        """检查路径是否豁免 CSRF 检查"""
        if path in self.CSRF_EXEMPT_PATHS:
            return True
        for prefix in self.CSRF_EXEMPT_PREFIXES:
            if path.startswith(prefix):
                return True
        return False

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive=receive)
        path = request.url.path
        method = request.method

        if method in self.PROTECTED_METHODS and not self._is_exempt(path):
            csrf_token = request.headers.get(settings.CSRF_HEADER_NAME)
            
            if not csrf_token:
                response = JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={
                        "success": False,
                        "error": "缺少 CSRF Token",
                        "code": 403,
                    }
                )
                await response(scope, receive, send)
                return

            if not self._validate_csrf_token(csrf_token):
                response = JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={
                        "success": False,
                        "error": "CSRF Token 无效或已过期",
                        "code": 403,
                    }
                )
                await response(scope, receive, send)
                return

        await self.app(scope, receive, send)


def setup_middlewares(app):
    """
    设置应用中间件
    """
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=settings.ALLOWED_METHODS,
        allow_headers=settings.ALLOWED_HEADERS,
    )

    app.add_middleware(RequestSizeLimitMiddleware, max_size=10 * 1024 * 1024)

    app.add_middleware(RateLimitMiddleware)

    app.add_middleware(SecurityHeadersMiddleware)

    if settings.CSRF_ENABLED:
        app.add_middleware(CSRFMiddleware)

    if settings.DEBUG:
        app.add_middleware(RequestLoggingMiddleware)

    from app.core.structured_logging import LoggingMiddleware
    app.add_middleware(LoggingMiddleware)
