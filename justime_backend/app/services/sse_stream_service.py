"""
SSE 流式上下文服务
支持 Last-Event-ID 断点续传，用于移动端网络切换场景
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict

from app.core.redis_client import RedisClient
from app.database import db

logger = logging.getLogger(__name__)

# Redis 键前缀
SSE_STREAM_KEY_PREFIX = "sse:stream:"
# 流上下文 TTL（秒）- 5 分钟
SSE_STREAM_TTL = 300
# 事件 ID 格式：{sessionId}:{messageId}:{tokenIndex}

_UPDATE_ACCUMULATED_LUA = """
local key = KEYS[1]
local data = redis.call('GET', key)
if not data then
    return 0
end
local obj = cjson.decode(data)
obj['accumulated_content'] = ARGV[1]
obj['token_index'] = tonumber(ARGV[2])
obj['updated_at'] = ARGV[3]
local new_data = cjson.encode(obj)
redis.call('SET', key, new_data, 'EX', tonumber(ARGV[4]))
return 1
"""


@dataclass
class SSEEventID:
    """SSE 事件 ID 结构"""
    session_id: str
    message_id: str
    token_index: int

    def __str__(self) -> str:
        """格式化为字符串：{sessionId}:{messageId}:{tokenIndex}"""
        return f"{self.session_id}:{self.message_id}:{self.token_index}"

    @classmethod
    def parse(cls, event_id_str: str) -> Optional['SSEEventID']:
        """
        解析事件 ID 字符串

        格式：{sessionId}:{messageId}:{tokenIndex}

        Args:
            event_id_str: 事件 ID 字符串

        Returns:
            解析成功返回 SSEEventID，失败返回 None
        """
        if not event_id_str:
            return None

        parts = event_id_str.split(':')
        if len(parts) != 3:
            logger.warning(f"Invalid event ID format: {event_id_str}")
            return None

        try:
            token_index = int(parts[2])
            return cls(
                session_id=parts[0],
                message_id=parts[1],
                token_index=token_index
            )
        except ValueError:
            logger.warning(f"Invalid token index in event ID: {event_id_str}")
            return None


@dataclass
class SSEStreamContext:
    """SSE 流上下文"""
    session_id: str
    message_id: str
    user_id: str
    model_id: str
    messages: List[Dict[str, str]]  # 对话上下文
    accumulated_content: str  # 已累积的内容
    token_index: int  # 当前 token 索引
    created_at: str  # 创建时间
    updated_at: str  # 更新时间

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SSEStreamContext':
        """
        从字典创建流上下文，带完整性校验

        校验必要字段 user_id, accumulated_content, token_index 是否存在且类型正确。
        缺少必要字段或类型不匹配时抛出 ValueError。

        Args:
            data: 字典数据（通常来自 Redis 反序列化）

        Returns:
            SSEStreamContext 实例

        Raises:
            ValueError: 必要字段缺失或类型不合法
        """
        if not isinstance(data, dict):
            raise ValueError(f"流上下文数据类型错误，期望 dict，实际为 {type(data).__name__}")

        required_fields = {
            "session_id": str,
            "message_id": str,
            "user_id": str,
            "accumulated_content": str,
            "token_index": int,
        }

        for field_name, expected_type in required_fields.items():
            value = data.get(field_name)
            if value is None:
                raise ValueError(f"流上下文缺少必要字段: {field_name}")
            if not isinstance(value, expected_type):
                raise ValueError(
                    f"流上下文字段 {field_name} 类型错误，"
                    f"期望 {expected_type.__name__}，实际为 {type(value).__name__}"
                )

        return cls(
            session_id=data["session_id"],
            message_id=data["message_id"],
            user_id=data["user_id"],
            model_id=data.get("model_id", ""),
            messages=data.get("messages", []),
            accumulated_content=data["accumulated_content"],
            token_index=data["token_index"],
            created_at=data.get("created_at", ""),
            updated_at=data.get("updated_at", ""),
        )


class SSEStreamService:
    """SSE 流上下文服务"""

    @staticmethod
    def _get_redis_key(session_id: str, message_id: str) -> str:
        """生成 Redis 键"""
        return f"{SSE_STREAM_KEY_PREFIX}{session_id}:{message_id}"

    @staticmethod
    async def save_context(context: SSEStreamContext) -> bool:
        """
        保存流上下文到 Redis

        Args:
            context: 流上下文

        Returns:
            保存成功返回 True
        """
        if not RedisClient.is_enabled():
            logger.debug("Redis not enabled, skip saving stream context")
            return False

        key = SSEStreamService._get_redis_key(context.session_id, context.message_id)

        # 更新时间戳
        context.updated_at = datetime.now(timezone.utc).isoformat()

        try:
            await RedisClient.set_json(
                key,
                context.to_dict(),
                ex=SSE_STREAM_TTL
            )
            logger.debug(f"Saved stream context: {key}")
            return True
        except Exception as e:
            logger.warning(f"Failed to save stream context: {e}")
            return False

    @staticmethod
    async def load_context(session_id: str, message_id: str) -> Optional[SSEStreamContext]:
        """
        从 Redis 加载流上下文

        Args:
            session_id: 会话 ID
            message_id: 消息 ID

        Returns:
            流上下文，不存在或反序列化失败返回 None
        """
        if not RedisClient.is_enabled():
            return None

        key = SSEStreamService._get_redis_key(session_id, message_id)

        try:
            data = await RedisClient.get_json(key)
            if data is None:
                return None

            # 使用带校验的反序列化
            try:
                return SSEStreamContext.from_dict(data)
            except ValueError as e:
                logger.warning(f"流上下文数据校验失败: {e}")
                # 删除无效数据，避免后续重试
                await RedisClient.delete(key)
                return None
        except Exception as e:
            logger.warning(f"Failed to load stream context: {e}")
            return None

    @staticmethod
    async def delete_context(session_id: str, message_id: str) -> bool:
        """
        删除流上下文

        Args:
            session_id: 会话 ID
            message_id: 消息 ID

        Returns:
            删除成功返回 True
        """
        if not RedisClient.is_enabled():
            return True

        key = SSEStreamService._get_redis_key(session_id, message_id)

        try:
            await RedisClient.delete(key)
            logger.debug(f"Deleted stream context: {key}")
            return True
        except Exception as e:
            logger.warning(f"Failed to delete stream context: {e}")
            return False

    @staticmethod
    async def update_accumulated_content(
        session_id: str,
        message_id: str,
        content: str,
        token_index: int
    ) -> bool:
        """
        更新累积内容和 token 索引

        使用 Lua 脚本在 Redis 内直接修改 JSON 字段，避免完整的
        读取-反序列化-修改-序列化-写入 循环。单次 Redis 调用完成更新。

        Args:
            session_id: 会话 ID
            message_id: 消息 ID
            content: 累积内容
            token_index: 当前 token 索引

        Returns:
            更新成功返回 True
        """
        if not RedisClient.is_enabled():
            logger.debug("Redis not enabled, skip updating accumulated content")
            return False

        key = SSEStreamService._get_redis_key(session_id, message_id)
        client = RedisClient.get_client()
        if client is None:
            return False

        try:
            result = await client.eval(
                _UPDATE_ACCUMULATED_LUA,
                1,
                key,
                content,
                str(token_index),
                datetime.now(timezone.utc).isoformat(),
                str(SSE_STREAM_TTL),
            )
            return result == 1
        except Exception as e:
            logger.warning(f"Failed to update accumulated content via Lua: {e}")
            return False

    @staticmethod
    def parse_last_event_id(last_event_id: str) -> Optional[SSEEventID]:
        """
        解析 Last-Event-ID 请求头

        Args:
            last_event_id: Last-Event-ID 头值

        Returns:
            解析成功返回 SSEEventID，失败返回 None
        """
        return SSEEventID.parse(last_event_id)

    @staticmethod
    def build_event_id(session_id: str, message_id: str, token_index: int) -> str:
        """
        构建事件 ID

        Args:
            session_id: 会话 ID
            message_id: 消息 ID
            token_index: token 索引

        Returns:
            事件 ID 字符串
        """
        return f"{session_id}:{message_id}:{token_index}"

    @staticmethod
    async def can_resume(last_event_id: str, user_id: str) -> Optional[SSEStreamContext]:
        """
        检查是否可以恢复流

        验证流程：
        1. 解析 Last-Event-ID
        2. 从 Redis 加载流上下文
        3. 验证上下文中的 user_id 与请求用户一致
        4. 验证 session 归属当前用户（MongoDB 校验）
        5. 验证 token 索引一致性

        Args:
            last_event_id: Last-Event-ID 头值
            user_id: 当前用户 ID

        Returns:
            可以恢复时返回流上下文，否则返回 None
        """
        event_id = SSEStreamService.parse_last_event_id(last_event_id)
        if event_id is None:
            return None

        context = await SSEStreamService.load_context(
            event_id.session_id,
            event_id.message_id
        )

        if context is None:
            logger.info(f"Stream context not found for resume: {last_event_id}")
            return None

        # 验证上下文中的 user_id 与请求用户一致
        if context.user_id != user_id:
            logger.warning(
                f"User mismatch for stream resume: "
                f"context.user_id={context.user_id}, request.user_id={user_id}"
            )
            return None

        # 验证 session 归属当前用户（MongoDB 校验）
        try:
            from bson import ObjectId
            session = await db.db["chat_sessions"].find_one(
                {"_id": ObjectId(event_id.session_id), "userId": user_id},
                {"_id": 1},
            )
            if not session:
                logger.warning(
                    f"Session ownership verification failed for stream resume: "
                    f"session_id={event_id.session_id}, user_id={user_id}"
                )
                return None
        except Exception as e:
            logger.warning(f"Session ownership check error during stream resume: {e}")
            return None

        # 验证 token 索引
        if context.token_index != event_id.token_index:
            logger.warning(
                f"Token index mismatch for stream resume: "
                f"context.token_index={context.token_index}, event_id.token_index={event_id.token_index}"
            )
            # 使用较小值，避免重复发送
            if event_id.token_index < context.token_index:
                context.token_index = event_id.token_index
            # 如果请求的索引大于实际值，使用实际值

        logger.info(
            f"Stream resume possible: session={context.session_id}, "
            f"message={context.message_id}, token_index={context.token_index}, "
            f"accumulated={len(context.accumulated_content)} chars"
        )
        return context


sse_stream_service = SSEStreamService()
