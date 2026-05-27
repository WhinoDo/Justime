"""
Redis 客户端封装
提供缓存、会话管理、分布式锁等功能
"""

import json
import logging
import asyncio
import secrets
from typing import Any, Optional, Callable, TypeVar, Union
from datetime import timedelta
from functools import wraps

try:
    import redis.asyncio as redis
    from redis.asyncio import Redis
    from redis.asyncio.connection import ConnectionPool
    REDIS_AVAILABLE = True
except ImportError:
    redis = None
    Redis = None
    ConnectionPool = None
    REDIS_AVAILABLE = False

from app.core.config import settings

logger = logging.getLogger(__name__)

T = TypeVar('T')


class RedisClient:
    _pool: Optional[ConnectionPool] = None
    _client: Optional[Redis] = None
    _initialized: bool = False
    _enabled: bool = False

    @classmethod
    def is_enabled(cls) -> bool:
        return cls._enabled and cls._initialized and cls._client is not None

    @classmethod
    async def init(cls) -> None:
        if not REDIS_AVAILABLE:
            logger.warning("Redis library not installed, caching disabled")
            cls._enabled = False
            cls._initialized = True
            return

        redis_url = getattr(settings, 'REDIS_URL', None)
        if not redis_url:
            logger.info("REDIS_URL not configured, caching disabled")
            cls._enabled = False
            cls._initialized = True
            return

        try:
            cls._pool = ConnectionPool.from_url(
                redis_url,
                max_connections=getattr(settings, 'REDIS_MAX_CONNECTIONS', 10),
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
                retry_on_timeout=True,
            )
            cls._client = Redis(connection_pool=cls._pool)
            await cls._client.ping()
            cls._enabled = True
            cls._initialized = True
            logger.info("Redis connection established successfully")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}, caching disabled")
            cls._enabled = False
            cls._initialized = True
            cls._client = None
            cls._pool = None

    @classmethod
    async def close(cls) -> None:
        if cls._client:
            await cls._client.aclose()
            cls._client = None
        if cls._pool:
            await cls._pool.aclose()
            cls._pool = None
        cls._initialized = False
        cls._enabled = False
        logger.info("Redis connection closed")

    @classmethod
    def get_client(cls) -> Optional[Redis]:
        return cls._client if cls.is_enabled() else None

    @classmethod
    async def get(cls, key: str) -> Optional[str]:
        if not cls.is_enabled():
            return None
        try:
            return await cls._client.get(key)
        except Exception as e:
            logger.warning(f"Redis GET failed for key '{key}': {e}")
            return None

    @classmethod
    async def set(
        cls,
        key: str,
        value: str,
        ex: Optional[int] = None,
        px: Optional[int] = None,
        nx: bool = False,
        xx: bool = False,
    ) -> bool:
        if not cls.is_enabled():
            return False
        try:
            return await cls._client.set(key, value, ex=ex, px=px, nx=nx, xx=xx)
        except Exception as e:
            logger.warning(f"Redis SET failed for key '{key}': {e}")
            return False

    @classmethod
    async def delete(cls, *keys: str) -> int:
        if not cls.is_enabled() or not keys:
            return 0
        try:
            return await cls._client.delete(*keys)
        except Exception as e:
            logger.warning(f"Redis DELETE failed for keys {keys}: {e}")
            return 0

    @classmethod
    async def exists(cls, *keys: str) -> int:
        if not cls.is_enabled() or not keys:
            return 0
        try:
            return await cls._client.exists(*keys)
        except Exception as e:
            logger.warning(f"Redis EXISTS failed for keys {keys}: {e}")
            return 0

    @classmethod
    async def expire(cls, key: str, seconds: int) -> bool:
        if not cls.is_enabled():
            return False
        try:
            return await cls._client.expire(key, seconds)
        except Exception as e:
            logger.warning(f"Redis EXPIRE failed for key '{key}': {e}")
            return False

    @classmethod
    async def ttl(cls, key: str) -> int:
        if not cls.is_enabled():
            return -2
        try:
            return await cls._client.ttl(key)
        except Exception as e:
            logger.warning(f"Redis TTL failed for key '{key}': {e}")
            return -2

    @classmethod
    async def incr(cls, key: str) -> int:
        if not cls.is_enabled():
            return 0
        try:
            return await cls._client.incr(key)
        except Exception as e:
            logger.warning(f"Redis INCR failed for key '{key}': {e}")
            return 0

    @classmethod
    async def incrby(cls, key: str, amount: int) -> int:
        if not cls.is_enabled():
            return 0
        try:
            return await cls._client.incrby(key, amount)
        except Exception as e:
            logger.warning(f"Redis INCRBY failed for key '{key}': {e}")
            return 0

    @classmethod
    async def get_json(cls, key: str) -> Optional[Any]:
        value = await cls.get(key)
        if value is None:
            return None
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value

    @classmethod
    async def set_json(
        cls,
        key: str,
        value: Any,
        ex: Optional[int] = None,
    ) -> bool:
        try:
            json_str = json.dumps(value, ensure_ascii=False, default=str)
            return await cls.set(key, json_str, ex=ex)
        except (TypeError, ValueError) as e:
            logger.warning(f"Redis SET_JSON failed for key '{key}': {e}")
            return False

    @classmethod
    async def acquire_lock(
        cls,
        lock_name: str,
        timeout: int = 10,
        retry_interval: float = 0.1,
        max_retries: int = 50,
    ) -> Optional[str]:
        if not cls.is_enabled():
            return None

        lock_key = f"lock:{lock_name}"
        for _ in range(max_retries):
            identifier = secrets.token_hex(16)
            acquired = await cls.set(lock_key, identifier, ex=timeout, nx=True)
            if acquired:
                return identifier
            await asyncio.sleep(retry_interval)
        return None

    @classmethod
    async def release_lock(cls, lock_name: str, identifier: str) -> bool:
        if not cls.is_enabled():
            return False
        lock_key = f"lock:{lock_name}"
        try:
            lua_script = """
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
            """
            result = await cls._client.eval(lua_script, 1, lock_key, identifier)
            return result == 1
        except Exception as e:
            logger.warning(f"Redis release_lock failed for key '{lock_key}': {e}")
            return False


def cached(
    key_prefix: str,
    ttl: int = 300,
    key_builder: Optional[Callable[..., str]] = None,
):
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            if not RedisClient.is_enabled():
                return await func(*args, **kwargs)

            cache_key = key_builder(*args, **kwargs) if key_builder else f"{key_prefix}:{':'.join(str(a) for a in args)}"

            cached_value = await RedisClient.get_json(cache_key)
            if cached_value is not None:
                logger.debug(f"Cache hit for key: {cache_key}")
                return cached_value

            result = await func(*args, **kwargs)

            if result is not None:
                await RedisClient.set_json(cache_key, result, ex=ttl)

            return result
        return wrapper
    return decorator


async def get_cache(key: str) -> Optional[Any]:
    return await RedisClient.get_json(key)


async def set_cache(key: str, value: Any, ttl: int = 300) -> bool:
    return await RedisClient.set_json(key, value, ex=ttl)


async def delete_cache(*keys: str) -> int:
    return await RedisClient.delete(*keys)


async def get_rate_limit_count(key: str) -> int:
    count = await RedisClient.get(key)
    return int(count) if count else 0


async def increment_rate_limit(key: str, ttl: int) -> int:
    if not RedisClient.is_enabled():
        return 0

    pipe = RedisClient._client.pipeline()
    try:
        pipe.incr(key)
        pipe.expire(key, ttl)
        results = await pipe.execute()
        return results[0]
    except Exception as e:
        logger.warning(f"Rate limit increment failed: {e}")
        return 0
