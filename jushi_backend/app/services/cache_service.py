"""
缓存服务
提供 LLM 配置、用户会话、权限等热点数据的缓存层
"""

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from app.core.redis_client import RedisClient

logger = logging.getLogger(__name__)


class CacheKeys:
    """缓存键常量"""
    # LLM 配置相关
    SYSTEM_LLM_CONFIGS = "cache:llm:system_configs"
    USER_AVAILABLE_MODELS = "cache:llm:user_models:{user_id}"
    USER_ACTIVE_MODEL = "cache:llm:active_model:{user_id}"
    API_KEYS_BATCH = "cache:api_keys:batch"

    # 用户会话相关
    USER_DATA = "cache:user:data:{user_id}"
    USER_PERMISSIONS = "cache:user:permissions:{user_id}"
    USER_PROFILE = "cache:user:profile:{user_id}"

    # 聊天会话相关
    USER_SESSIONS = "cache:chat:sessions:{user_id}"

    # 统计相关
    CACHE_STATS = "cache:stats:hit_rate"


class CacheTTL:
    """缓存 TTL 常量（秒）"""
    # LLM 配置：管理员不常修改，可以缓存较长时间
    SYSTEM_LLM_CONFIGS = 300  # 5 分钟
    USER_AVAILABLE_MODELS = 180  # 3 分钟
    USER_ACTIVE_MODEL = 180  # 3 分钟
    API_KEYS_BATCH = 300  # 5 分钟

    # 用户数据：用户信息变更不频繁
    USER_DATA = 300  # 5 分钟（与 JWT token 验证周期匹配）
    USER_PERMISSIONS = 180  # 3 分钟
    USER_PROFILE = 300  # 5 分钟

    # 聊天会话：更新较频繁
    USER_SESSIONS = 60  # 1 分钟


class CacheStats:
    """缓存统计计数器"""
    _hits: Dict[str, int] = {}
    _misses: Dict[str, int] = {}

    @classmethod
    def record_hit(cls, cache_type: str) -> None:
        cls._hits[cache_type] = cls._hits.get(cache_type, 0) + 1

    @classmethod
    def record_miss(cls, cache_type: str) -> None:
        cls._misses[cache_type] = cls._misses.get(cache_type, 0) + 1

    @classmethod
    def get_stats(cls) -> Dict[str, Any]:
        stats = {}
        all_keys = set(cls._hits.keys()) | set(cls._misses.keys())
        for key in all_keys:
            hits = cls._hits.get(key, 0)
            misses = cls._misses.get(key, 0)
            total = hits + misses
            hit_rate = (hits / total * 100) if total > 0 else 0
            stats[key] = {
                "hits": hits,
                "misses": misses,
                "total": total,
                "hit_rate": f"{hit_rate:.2f}%"
            }
        return stats

    @classmethod
    def reset(cls) -> None:
        cls._hits.clear()
        cls._misses.clear()


class CacheService:
    """缓存服务 - 提供热点数据的缓存层"""

    # ==================== LLM 配置缓存 ====================

    @staticmethod
    async def get_system_llm_configs() -> Optional[List[Dict[str, Any]]]:
        """获取缓存的系统 LLM 配置"""
        if not RedisClient.is_enabled():
            return None
        try:
            data = await RedisClient.get_json(CacheKeys.SYSTEM_LLM_CONFIGS)
            if data is not None:
                CacheStats.record_hit("system_llm_configs")
                logger.debug("Cache hit: system_llm_configs")
                return data
            CacheStats.record_miss("system_llm_configs")
            return None
        except Exception as e:
            logger.warning(f"Cache get failed for system_llm_configs: {e}")
            return None

    @staticmethod
    async def set_system_llm_configs(configs: List[Dict[str, Any]]) -> bool:
        """缓存系统 LLM 配置"""
        if not RedisClient.is_enabled():
            return False
        try:
            return await RedisClient.set_json(
                CacheKeys.SYSTEM_LLM_CONFIGS,
                configs,
                ex=CacheTTL.SYSTEM_LLM_CONFIGS
            )
        except Exception as e:
            logger.warning(f"Cache set failed for system_llm_configs: {e}")
            return False

    @staticmethod
    async def invalidate_system_llm_configs() -> int:
        """使系统 LLM 配置缓存失效"""
        return await RedisClient.delete(CacheKeys.SYSTEM_LLM_CONFIGS)

    @staticmethod
    async def get_user_available_models(user_id: str) -> Optional[List[Dict[str, Any]]]:
        """获取缓存的用户可用模型列表"""
        if not RedisClient.is_enabled():
            return None
        try:
            key = CacheKeys.USER_AVAILABLE_MODELS.format(user_id=user_id)
            data = await RedisClient.get_json(key)
            if data is not None:
                CacheStats.record_hit("user_available_models")
                logger.debug(f"Cache hit: user_available_models for {user_id}")
                return data
            CacheStats.record_miss("user_available_models")
            return None
        except Exception as e:
            logger.warning(f"Cache get failed for user_available_models: {e}")
            return None

    @staticmethod
    async def set_user_available_models(
        user_id: str,
        models: List[Dict[str, Any]]
    ) -> bool:
        """缓存用户可用模型列表"""
        if not RedisClient.is_enabled():
            return False
        try:
            key = CacheKeys.USER_AVAILABLE_MODELS.format(user_id=user_id)
            return await RedisClient.set_json(key, models, ex=CacheTTL.USER_AVAILABLE_MODELS)
        except Exception as e:
            logger.warning(f"Cache set failed for user_available_models: {e}")
            return False

    @staticmethod
    async def invalidate_user_available_models(user_id: str) -> int:
        """使用户可用模型列表缓存失效"""
        key = CacheKeys.USER_AVAILABLE_MODELS.format(user_id=user_id)
        return await RedisClient.delete(key)

    @staticmethod
    async def get_user_active_model(user_id: str) -> Optional[str]:
        """获取缓存的用户活跃模型 ID"""
        if not RedisClient.is_enabled():
            return None
        try:
            key = CacheKeys.USER_ACTIVE_MODEL.format(user_id=user_id)
            data = await RedisClient.get(key)
            if data is not None:
                CacheStats.record_hit("user_active_model")
                logger.debug(f"Cache hit: user_active_model for {user_id}")
                return data
            CacheStats.record_miss("user_active_model")
            return None
        except Exception as e:
            logger.warning(f"Cache get failed for user_active_model: {e}")
            return None

    @staticmethod
    async def set_user_active_model(user_id: str, model_id: str) -> bool:
        """缓存用户活跃模型 ID"""
        if not RedisClient.is_enabled():
            return False
        try:
            key = CacheKeys.USER_ACTIVE_MODEL.format(user_id=user_id)
            return await RedisClient.set(key, model_id, ex=CacheTTL.USER_ACTIVE_MODEL)
        except Exception as e:
            logger.warning(f"Cache set failed for user_active_model: {e}")
            return False

    @staticmethod
    async def invalidate_user_active_model(user_id: str) -> int:
        """使用户活跃模型缓存失效"""
        key = CacheKeys.USER_ACTIVE_MODEL.format(user_id=user_id)
        return await RedisClient.delete(key)

    # ==================== 用户数据缓存 ====================

    @staticmethod
    async def get_user_data(user_id: str) -> Optional[Dict[str, Any]]:
        """获取缓存的用户数据（用于会话验证）"""
        if not RedisClient.is_enabled():
            return None
        try:
            key = CacheKeys.USER_DATA.format(user_id=user_id)
            data = await RedisClient.get_json(key)
            if data is not None:
                CacheStats.record_hit("user_data")
                logger.debug(f"Cache hit: user_data for {user_id}")
                return data
            CacheStats.record_miss("user_data")
            return None
        except Exception as e:
            logger.warning(f"Cache get failed for user_data: {e}")
            return None

    @staticmethod
    async def set_user_data(user_id: str, user_data: Dict[str, Any]) -> bool:
        """缓存用户数据"""
        if not RedisClient.is_enabled():
            return False
        try:
            key = CacheKeys.USER_DATA.format(user_id=user_id)
            # 序列化 ObjectId
            if "_id" in user_data and hasattr(user_data["_id"], "__str__"):
                user_data = {**user_data, "_id": str(user_data["_id"])}
            return await RedisClient.set_json(key, user_data, ex=CacheTTL.USER_DATA)
        except Exception as e:
            logger.warning(f"Cache set failed for user_data: {e}")
            return False

    @staticmethod
    async def invalidate_user_data(user_id: str) -> int:
        """使用户数据缓存失效"""
        key = CacheKeys.USER_DATA.format(user_id=user_id)
        return await RedisClient.delete(key)

    @staticmethod
    async def get_user_permissions(user_id: str) -> Optional[Dict[str, Any]]:
        """获取缓存的用户权限信息"""
        if not RedisClient.is_enabled():
            return None
        try:
            key = CacheKeys.USER_PERMISSIONS.format(user_id=user_id)
            data = await RedisClient.get_json(key)
            if data is not None:
                CacheStats.record_hit("user_permissions")
                logger.debug(f"Cache hit: user_permissions for {user_id}")
                return data
            CacheStats.record_miss("user_permissions")
            return None
        except Exception as e:
            logger.warning(f"Cache get failed for user_permissions: {e}")
            return None

    @staticmethod
    async def set_user_permissions(
        user_id: str,
        permissions: Dict[str, Any]
    ) -> bool:
        """缓存用户权限信息"""
        if not RedisClient.is_enabled():
            return False
        try:
            key = CacheKeys.USER_PERMISSIONS.format(user_id=user_id)
            return await RedisClient.set_json(key, permissions, ex=CacheTTL.USER_PERMISSIONS)
        except Exception as e:
            logger.warning(f"Cache set failed for user_permissions: {e}")
            return False

    @staticmethod
    async def invalidate_user_permissions(user_id: str) -> int:
        """使用户权限缓存失效"""
        key = CacheKeys.USER_PERMISSIONS.format(user_id=user_id)
        return await RedisClient.delete(key)

    # ==================== 用户 Profile 缓存 ====================

    @staticmethod
    async def get_user_profile(user_id: str) -> Optional[Dict[str, Any]]:
        """获取缓存的用户 Profile"""
        if not RedisClient.is_enabled():
            return None
        try:
            key = CacheKeys.USER_PROFILE.format(user_id=user_id)
            data = await RedisClient.get_json(key)
            if data is not None:
                CacheStats.record_hit("user_profile")
                logger.debug(f"Cache hit: user_profile for {user_id}")
                return data
            CacheStats.record_miss("user_profile")
            return None
        except Exception as e:
            logger.warning(f"Cache get failed for user_profile: {e}")
            return None

    @staticmethod
    async def set_user_profile(user_id: str, profile: Dict[str, Any]) -> bool:
        """缓存用户 Profile"""
        if not RedisClient.is_enabled():
            return False
        try:
            key = CacheKeys.USER_PROFILE.format(user_id=user_id)
            return await RedisClient.set_json(key, profile, ex=CacheTTL.USER_PROFILE)
        except Exception as e:
            logger.warning(f"Cache set failed for user_profile: {e}")
            return False

    @staticmethod
    async def invalidate_user_profile(user_id: str) -> int:
        """使用户 Profile 缓存失效"""
        key = CacheKeys.USER_PROFILE.format(user_id=user_id)
        return await RedisClient.delete(key)

    # ==================== 聊天会话缓存 ====================

    @staticmethod
    async def get_user_sessions(user_id: str) -> Optional[List[Dict[str, Any]]]:
        """获取缓存的用户会话列表"""
        if not RedisClient.is_enabled():
            return None
        try:
            key = CacheKeys.USER_SESSIONS.format(user_id=user_id)
            data = await RedisClient.get_json(key)
            if data is not None:
                CacheStats.record_hit("user_sessions")
                logger.debug(f"Cache hit: user_sessions for {user_id}")
                return data
            CacheStats.record_miss("user_sessions")
            return None
        except Exception as e:
            logger.warning(f"Cache get failed for user_sessions: {e}")
            return None

    @staticmethod
    async def set_user_sessions(
        user_id: str,
        sessions: List[Dict[str, Any]]
    ) -> bool:
        """缓存用户会话列表"""
        if not RedisClient.is_enabled():
            return False
        try:
            key = CacheKeys.USER_SESSIONS.format(user_id=user_id)
            return await RedisClient.set_json(key, sessions, ex=CacheTTL.USER_SESSIONS)
        except Exception as e:
            logger.warning(f"Cache set failed for user_sessions: {e}")
            return False

    @staticmethod
    async def invalidate_user_sessions(user_id: str) -> int:
        """使用户会话列表缓存失效"""
        key = CacheKeys.USER_SESSIONS.format(user_id=user_id)
        return await RedisClient.delete(key)

    # ==================== 批量失效 ====================

    @staticmethod
    async def invalidate_all_user_cache(user_id: str) -> int:
        """使某用户的所有缓存失效"""
        keys = [
            CacheKeys.USER_DATA.format(user_id=user_id),
            CacheKeys.USER_PERMISSIONS.format(user_id=user_id),
            CacheKeys.USER_AVAILABLE_MODELS.format(user_id=user_id),
            CacheKeys.USER_ACTIVE_MODEL.format(user_id=user_id),
            CacheKeys.USER_PROFILE.format(user_id=user_id),
            CacheKeys.USER_SESSIONS.format(user_id=user_id),
        ]
        return await RedisClient.delete(*keys)

    @staticmethod
    async def invalidate_all_llm_cache() -> int:
        """使所有 LLM 配置缓存失效"""
        # 注意：这里只删除全局配置，用户级别的需要单独处理
        return await RedisClient.delete(CacheKeys.SYSTEM_LLM_CONFIGS)

    # ==================== 统计 ====================

    @staticmethod
    def get_cache_stats() -> Dict[str, Any]:
        """获取缓存统计信息"""
        return CacheStats.get_stats()

    @staticmethod
    def reset_cache_stats() -> None:
        """重置缓存统计"""
        CacheStats.reset()


# 全局缓存服务实例
cache_service = CacheService()
