"""
API限流中间件
基于IP和用户的请求限流机制
"""

import time
import logging
from collections import defaultdict
from typing import Dict, Tuple, Optional
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from threading import Lock

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    滑动窗口限流器
    支持基于IP和用户ID的限流
    """

    def __init__(
        self,
        requests_per_minute: int = 60,
        requests_per_hour: int = 1000,
        block_duration_seconds: int = 300
    ):
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour
        self.block_duration = block_duration_seconds

        # 存储请求记录: {key: [(timestamp, count), ...]}
        self._request_history: Dict[str, list] = defaultdict(list)
        # 存储被封禁的客户端: {key: block_until_timestamp}
        self._blocked: Dict[str, float] = {}
        # 线程锁
        self._lock = Lock()

    @staticmethod
    def _validate_ip(ip_str: str) -> str:
        import re
        ip_str = ip_str.strip()
        ipv4_pattern = r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$'
        ipv6_pattern = r'^\[?[0-9a-fA-F:]+\]?$'
        if re.match(ipv4_pattern, ip_str) or re.match(ipv6_pattern, ip_str):
            return ip_str
        return ""

    def _get_client_key(self, request: Request, user_id: Optional[str] = None) -> str:
        """获取客户端唯一标识"""
        if user_id:
            return f"user:{user_id}"

        client_ip = ""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            first_ip = forwarded.split(",")[0].strip()
            client_ip = self._validate_ip(first_ip)

        if not client_ip:
            client_ip = request.client.host if request.client else "unknown"

        return f"ip:{client_ip}"

    def _cleanup_old_records(self, key: str, current_time: float):
        """清理过期的请求记录"""
        # 保留最近1小时的记录
        hour_ago = current_time - 3600
        self._request_history[key] = [
            (ts, count) for ts, count in self._request_history[key]
            if ts > hour_ago
        ]

    def _count_requests(self, key: str, current_time: float, window_seconds: int) -> int:
        """统计时间窗口内的请求数"""
        window_start = current_time - window_seconds
        return sum(
            count for ts, count in self._request_history[key]
            if ts > window_start
        )

    def is_allowed(self, request: Request, user_id: Optional[str] = None) -> Tuple[bool, str]:
        """
        检查请求是否被允许

        Returns:
            (is_allowed, error_message)
        """
        key = self._get_client_key(request, user_id)
        current_time = time.time()

        with self._lock:
            # 检查是否被封禁
            if key in self._blocked:
                block_until = self._blocked[key]
                if current_time < block_until:
                    remaining = int(block_until - current_time)
                    return False, f"请求过于频繁，请{remaining}秒后再试"
                else:
                    del self._blocked[key]

            # 清理旧记录
            self._cleanup_old_records(key, current_time)

            # 统计请求数
            minute_requests = self._count_requests(key, current_time, 60)
            hour_requests = self._count_requests(key, current_time, 3600)

            # 检查是否超限
            if minute_requests >= self.requests_per_minute:
                # 封禁客户端
                self._blocked[key] = current_time + self.block_duration
                logger.warning(f"限流触发: {key} 每分钟请求{minute_requests}次")
                return False, f"请求过于频繁，请1分钟后再试"

            if hour_requests >= self.requests_per_hour:
                self._blocked[key] = current_time + self.block_duration
                logger.warning(f"限流触发: {key} 每小时请求{hour_requests}次")
                return False, f"小时请求次数已达上限，请稍后再试"

            # 记录本次请求
            self._request_history[key].append((current_time, 1))

            return True, ""

    def get_remaining(self, request: Request, user_id: Optional[str] = None) -> Dict[str, int]:
        """获取剩余请求次数"""
        key = self._get_client_key(request, user_id)
        current_time = time.time()

        with self._lock:
            self._cleanup_old_records(key, current_time)
            minute_requests = self._count_requests(key, current_time, 60)
            hour_requests = self._count_requests(key, current_time, 3600)

        return {
            "minute_remaining": max(0, self.requests_per_minute - minute_requests),
            "hour_remaining": max(0, self.requests_per_hour - hour_requests),
        }


class RateLimitMiddleware:
    """
    限流中间件
    """

    PATH_LIMITS = {
        "/api/v1/chat": (30, 500),
        "/api/v1/auth/login": (5, 20),
        "/api/v1/auth/register": (3, 10),
        "/api/v1/auth/refresh": (10, 50),
        "/api/v1/calendar": (20, 200),
        "/api/v1/agent": (20, 300),
        "/api/v1/book-analysis": (10, 50),
        "/api/v1/speech": (10, 100),
        "/api/v1/admin": (30, 300),
    }

    def __init__(self, app):
        self.app = app
        self._limiters: Dict[str, RateLimiter] = {}

        # 为不同路径创建限流器
        for path, (rpm, rph) in self.PATH_LIMITS.items():
            self._limiters[path] = RateLimiter(
                requests_per_minute=rpm,
                requests_per_hour=rph
            )

        # 默认限流器
        self._default_limiter = RateLimiter()

    def _get_limiter(self, path: str) -> RateLimiter:
        """获取路径对应的限流器"""
        for pattern, limiter in self._limiters.items():
            if path.startswith(pattern):
                return limiter
        return self._default_limiter

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive=receive)

        # 只对API路径进行限流
        if not request.url.path.startswith("/api"):
            await self.app(scope, receive, send)
            return

        limiter = self._get_limiter(request.url.path)
        is_allowed, error_message = limiter.is_allowed(request)

        if not is_allowed:
            response = JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "success": False,
                    "error": error_message,
                    "code": 429,
                }
            )
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)


# 全局限流器实例
rate_limiter = RateLimiter()


def check_rate_limit(request: Request, user_id: Optional[str] = None):
    """
    检查请求限流（可在路由中直接调用）

    Raises:
        HTTPException: 如果请求被限流
    """
    is_allowed, error_message = rate_limiter.is_allowed(request, user_id)
    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_message
        )
