"""
结构化日志配置
支持请求ID跟踪和JSON格式输出
"""

import logging
import sys
import json
import time
import uuid
from datetime import datetime
from typing import Optional
from contextvars import ContextVar
from pythonjsonlogger import jsonlogger

from app.core.log_sanitizer import (
    sanitize_url,
    sanitize_error_message,
    sanitize_data,
    sanitize_headers,
)

request_id_var: ContextVar[Optional[str]] = ContextVar('request_id', default=None)


def get_request_id() -> Optional[str]:
    """获取当前请求ID"""
    return request_id_var.get()


def set_request_id(request_id: str) -> None:
    """设置当前请求ID"""
    request_id_var.set(request_id)


class RequestIdFilter(logging.Filter):
    """日志过滤器：添加请求ID"""

    def filter(self, record):
        record.request_id = get_request_id() or '-'
        return True


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """自定义JSON日志格式"""

    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)

        # 添加时间戳
        log_record['timestamp'] = datetime.utcnow().isoformat()

        # 添加请求ID
        log_record['request_id'] = getattr(record, 'request_id', '-')

        # 添加模块信息
        log_record['module'] = record.name
        log_record['level'] = record.levelname


def setup_logging(json_output: bool = False, log_level: str = "INFO"):
    """
    配置日志系统

    Args:
        json_output: 是否使用JSON格式输出
        log_level: 日志级别
    """
    # 获取根日志器
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))

    # 清除现有处理器
    root_logger.handlers.clear()

    # 创建控制台处理器
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(getattr(logging, log_level.upper()))

    if json_output:
        # JSON格式
        formatter = CustomJsonFormatter(
            '%(timestamp)s %(level)s %(request_id)s %(module)s %(message)s'
        )
    else:
        # 文本格式（带请求ID）
        formatter = logging.Formatter(
            '%(asctime)s - [%(request_id)s] - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )

    handler.setFormatter(formatter)
    handler.addFilter(RequestIdFilter())

    root_logger.addHandler(handler)

    # 配置第三方库日志级别
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("motor").setLevel(logging.WARNING)
    logging.getLogger("pymongo").setLevel(logging.WARNING)

    return root_logger


class LoggingMiddleware:
    """
    日志中间件
    为每个请求添加请求ID和日志记录，自动脱敏敏感数据
    """

    def __init__(self, app, exclude_paths: list = None):
        self.app = app
        self.exclude_paths = exclude_paths or ['/health', '/metrics', '/favicon.ico']

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        from fastapi import Request
        request = Request(scope, receive=receive)

        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            await self.app(scope, receive, send)
            return

        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())[:8]
        set_request_id(request_id)

        logger = logging.getLogger(__name__)

        start_time = time.time()

        sanitized_path = sanitize_url(request.url.path)
        client_ip = request.client.host if request.client else "-"

        logger.info(
            f"Request started: {request.method} {sanitized_path}",
            extra={
                "method": request.method,
                "path": sanitized_path,
                "client_ip": client_ip,
            }
        )

        response_status = None

        async def send_wrapper(message):
            nonlocal response_status
            if message["type"] == "http.response.start":
                response_status = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)

            duration = time.time() - start_time
            logger.info(
                f"Request completed: {request.method} {sanitized_path} - {response_status} ({duration:.3f}s)",
                extra={
                    "method": request.method,
                    "path": sanitized_path,
                    "status_code": response_status,
                    "duration_ms": round(duration * 1000, 2),
                }
            )

        except Exception as e:
            duration = time.time() - start_time
            error_msg = sanitize_error_message(str(e))
            logger.error(
                f"Request failed: {request.method} {sanitized_path} - {type(e).__name__}: {error_msg}",
                extra={
                    "method": request.method,
                    "path": sanitized_path,
                    "error_type": type(e).__name__,
                    "duration_ms": round(duration * 1000, 2),
                },
                exc_info=True
            )
            raise

        finally:
            request_id_var.set(None)


# 便捷函数
def get_logger(name: str) -> logging.Logger:
    """获取带请求ID支持的日志器"""
    return logging.getLogger(name)
