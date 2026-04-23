"""
消息服务模块
负责聊天消息的存储、检索和更新
"""

import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from app.database import db

logger = logging.getLogger(__name__)


class MessageService:
    """消息服务：管理聊天消息的存储和检索"""

    # 允许更新的字段（防止滥用）
    ALLOWED_UPDATE_FIELDS = ["taskDecomposition", "multiTaskDecompositions", "suggestedEvents", "timingStrategy", "taskAnalysis", "ragReferences"]

    def __init__(self, database=None):
        """
        初始化消息服务

        Args:
            database: 数据库实例，默认使用全局db
        """
        self.db = database or db.db
        self.collection = "chat_messages"

    async def create(
        self,
        session_id: str,
        role: str,
        content: str,
        **kwargs
    ) -> str:
        """
        创建新消息

        Args:
            session_id: 会话ID
            role: 角色 (user/ai/system)
            content: 消息内容
            **kwargs: 扩展字段 (taskDecomposition, suggestedEvents等)

        Returns:
            新创建的消息ID
        """
        message_doc = {
            "sessionId": session_id,
            "role": role,
            "content": content,
            "timestamp": datetime.now(timezone.utc)
        }

        # 添加可选字段
        for field in self.ALLOWED_UPDATE_FIELDS:
            if kwargs.get(field):
                message_doc[field] = kwargs[field]

        result = await self.db[self.collection].insert_one(message_doc)
        message_id = str(result.inserted_id)
        logger.debug(f"创建消息: {message_id}, 会话: {session_id}, 角色: {role}")
        return message_id

    async def get_by_session(self, session_id: str, limit: int = 1000) -> List[Dict[str, Any]]:
        """
        获取会话的所有消息

        Args:
            session_id: 会话ID
            limit: 返回数量限制

        Returns:
            消息列表（按时间升序）
        """
        cursor = self.db[self.collection].find({"sessionId": session_id}).sort("timestamp", 1)
        messages = await cursor.to_list(length=limit)
        # 转换ObjectId为字符串
        for m in messages:
            m["_id"] = str(m["_id"])
        return messages

    async def get_by_id(self, message_id: str) -> Optional[Dict[str, Any]]:
        """
        根据ID获取消息

        Args:
            message_id: 消息ID

        Returns:
            消息文档或None
        """
        from bson import ObjectId
        message = await self.db[self.collection].find_one({"_id": ObjectId(message_id)})
        if message:
            message["_id"] = str(message["_id"])
        return message

    async def update_interactive_state(self, message_id: str, updates: Dict[str, Any]) -> bool:
        """
        更新消息的交互状态

        Args:
            message_id: 消息ID
            updates: 更新字段（仅允许特定字段）

        Returns:
            是否更新成功
        """
        if not message_id:
            return False

        from bson import ObjectId

        update_fields = {}
        for field in self.ALLOWED_UPDATE_FIELDS:
            if field in updates:
                update_fields[field] = updates[field]

        if not update_fields:
            return False

        result = await self.db[self.collection].update_one(
            {"_id": ObjectId(message_id)},
            {"$set": update_fields}
        )
        return result.modified_count > 0

    async def delete_by_session(self, session_id: str) -> int:
        """
        删除会话的所有消息

        Args:
            session_id: 会话ID

        Returns:
            删除的消息数量
        """
        result = await self.db[self.collection].delete_many({"sessionId": session_id})
        return result.deleted_count

    async def get_recent_messages(
        self,
        session_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        获取会话最近的消息（用于构建上下文）

        Args:
            session_id: 会话ID
            limit: 返回数量限制

        Returns:
            消息列表（按时间升序）
        """
        cursor = self.db[self.collection].find({"sessionId": session_id}).sort("timestamp", -1).limit(limit)
        messages = await cursor.to_list(length=limit)
        # 转换ObjectId为字符串并反转顺序
        for m in messages:
            m["_id"] = str(m["_id"])
        return list(reversed(messages))

    async def count_by_session(self, session_id: str) -> int:
        """
        统计会话的消息数量

        Args:
            session_id: 会话ID

        Returns:
            消息数量
        """
        return await self.db[self.collection].count_documents({"sessionId": session_id})


# 全局实例
message_service = MessageService()
