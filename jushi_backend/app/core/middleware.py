"""
中间件模块
提供请求日志、大小限制、CORS注册和API限流。
"""

import logging
import time

from fastapi import Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.rate_limiter import RateLimitMiddleware

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware:
    """
    请求日志中间件
    记录请求和响应信息
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive=receive)
        start_time = time.time()

        # 记录请求
        logger.info(
            f"Request: {request.method} {request.url.path} "
            f"Client: {request.client.host if request.client else 'unknown'}"
        )

        # 处理请求
        response_started = False

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                response_started = True
                process_time = time.time() - start_time
                status_code = message["status"]
                logger.info(
                    f"Response: {request.method} {request.url.path} "
                    f"Status: {status_code} Time: {process_time:.3f}s"
                )
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as e:
            process_time = time.time() - start_time
            logger.error(
                f"Request failed: {request.method} {request.url.path} "
                f"Error: {type(e).__name__}: {str(e)} Time: {process_time:.3f}s"
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


def setup_middlewares(app):
    """
    设置应用中间件
    """
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_middleware(RequestSizeLimitMiddleware, max_size=10 * 1024 * 1024)

    # 添加API限流中间件
    app.add_middleware(RateLimitMiddleware)

    if settings.DEBUG:
        app.add_middleware(RequestLoggingMiddleware)
