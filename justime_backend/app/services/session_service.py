"""
会话服务模块
负责会话的创建、查询、删除等生命周期管理
"""

import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from app.database import db

logger = logging.getLogger(__name__)


class SessionService:
    """会话服务：管理聊天会话生命周期"""

    def __init__(self, database=None):
        """
        初始化会话服务

        Args:
            database: 数据库实例，默认使用全局db
        """
        self.db = database or db.db
        self.collection = "chat_sessions"

    async def create(self, user_id: str, title: str) -> str:
        """
        创建新会话

        Args:
            user_id: 用户ID
            title: 会话标题

        Returns:
            新创建的会话ID
        """
        session_doc = {
            "userId": user_id,
            "title": title,
            "updatedAt": datetime.now(timezone.utc),
            "createdAt": datetime.now(timezone.utc)
        }
        result = await self.db[self.collection].insert_one(session_doc)
        session_id = str(result.inserted_id)
        logger.debug(f"创建会话: {session_id}, 用户: {user_id}")
        return session_id

    async def get_by_id(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        根据ID获取会话

        Args:
            session_id: 会话ID

        Returns:
            会话文档或None
        """
        from bson import ObjectId
        session = await self.db[self.collection].find_one({"_id": ObjectId(session_id)})
        if session:
            session["_id"] = str(session["_id"])
        return session

    async def get_by_user(self, user_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """
        获取用户的会话列表

        Args:
            user_id: 用户ID
            limit: 返回数量限制

        Returns:
            会话列表
        """
        cursor = self.db[self.collection].find({"userId": user_id}).sort("updatedAt", -1)
        sessions = await cursor.to_list(length=limit)
        # 转换ObjectId为字符串
        for s in sessions:
            s["_id"] = str(s["_id"])
        return sessions

    async def update(self, session_id: str, updates: Dict[str, Any]) -> bool:
        """
        更新会话信息

        Args:
            session_id: 会话ID
            updates: 更新字段

        Returns:
            是否更新成功
        """
        from bson import ObjectId
        updates["updatedAt"] = datetime.now(timezone.utc)
        result = await self.db[self.collection].update_one(
            {"_id": ObjectId(session_id)},
            {"$set": updates}
        )
        return result.modified_count > 0

    async def delete(self, session_id: str) -> bool:
        """
        删除会话及其所有消息

        Args:
            session_id: 会话ID

        Returns:
            是否删除成功
        """
        from bson import ObjectId
        # 删除会话
        result = await self.db[self.collection].delete_one({"_id": ObjectId(session_id)})
        # 删除关联消息
        await self.db["chat_messages"].delete_many({"sessionId": session_id})
        return result.deleted_count > 0

    async def update_preview(self, session_id: str, preview: str) -> bool:
        """
        更新会话预览内容

        Args:
            session_id: 会话ID
            preview: 预览文本

        Returns:
            是否更新成功
        """
        from bson import ObjectId
        preview_text = preview[:50] + "..." if len(preview) > 50 else preview
        result = await self.db[self.collection].update_one(
            {"_id": ObjectId(session_id)},
            {
                "$set": {
                    "updatedAt": datetime.now(timezone.utc),
                    "preview": preview_text
                }
            }
        )
        return result.modified_count > 0


# 全局实例
session_service = SessionService()
