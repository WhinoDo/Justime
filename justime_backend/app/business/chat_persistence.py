import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from bson import ObjectId

from app.database import db

logger = logging.getLogger(__name__)


class ChatPersistence:
    async def create_session(self, user_id: str, title: str) -> str:
        session_doc = {
            "userId": user_id,
            "title": title,
            "updatedAt": datetime.now(timezone.utc),
            "createdAt": datetime.now(timezone.utc)
        }
        result = await db.db["chat_sessions"].insert_one(session_doc)
        return str(result.inserted_id)

    async def save_message(self, session_id: str, role: str, content: str, **kwargs) -> str:
        message_doc = {
            "sessionId": session_id,
            "role": role,
            "content": content,
            "timestamp": datetime.now(timezone.utc)
        }
        if kwargs.get("taskId"):
            message_doc["taskId"] = kwargs["taskId"]
        
        if kwargs.get("taskDecomposition"):
            message_doc["taskDecomposition"] = kwargs["taskDecomposition"]
        if kwargs.get("multiTaskDecompositions"):
            message_doc["multiTaskDecompositions"] = kwargs["multiTaskDecompositions"]
        if kwargs.get("suggestedEvents"):
            message_doc["suggestedEvents"] = kwargs["suggestedEvents"]
        if kwargs.get("timingStrategy"):
            message_doc["timingStrategy"] = kwargs["timingStrategy"]
        if kwargs.get("taskAnalysis"):
            message_doc["taskAnalysis"] = kwargs["taskAnalysis"]
        if kwargs.get("ragReferences"):
            message_doc["ragReferences"] = kwargs["ragReferences"]
            
        result = await db.db["chat_messages"].insert_one(message_doc)

        await db.db["chat_sessions"].update_one(
            {"_id": ObjectId(session_id)},
            {
                "$set": {
                    "updatedAt": datetime.now(timezone.utc),
                    "preview": content[:50] + "..." if len(content) > 50 else content
                }
            }
        )
        return str(result.inserted_id)

    async def update_message_interactive_state(self, message_id: str, updates: Dict[str, Any]):
        if not message_id:
            return
            
        update_fields = {}
        allowed_fields = ["taskDecomposition", "multiTaskDecompositions", "suggestedEvents"]
        
        for field in allowed_fields:
            if field in updates:
                update_fields[field] = updates[field]
                
        if update_fields:
            await db.db["chat_messages"].update_one(
                {"_id": ObjectId(message_id)},
                {"$set": update_fields}
            )

    async def get_user_sessions(self, user_id: str) -> List[dict]:
        cursor = db.db["chat_sessions"].find({"userId": user_id}).sort("updatedAt", -1)
        sessions = await cursor.to_list(length=100)
        for s in sessions:
            s["_id"] = str(s["_id"])
        return sessions

    async def get_session_messages(self, session_id: str, limit: int = 200) -> List[dict]:
        safe_limit = max(1, min(int(limit or 200), 1000))
        cursor = db.db["chat_messages"].find({"sessionId": session_id}).sort("timestamp", 1)
        messages = await cursor.to_list(length=safe_limit)
        for m in messages:
            m["_id"] = str(m["_id"])
        return messages

    async def build_recent_context(self, session_id: str, window_size: int) -> str:
        if not session_id or window_size <= 0:
            return ""
        try:
            cursor = db.db["chat_messages"].find({"sessionId": session_id}).sort("timestamp", -1)
            recent_messages = await cursor.to_list(length=window_size)
            if not recent_messages:
                return ""

            recent_messages.reverse()
            rendered = []
            for msg in recent_messages:
                role = "用户" if msg.get("role") == "user" else "助手"
                content = (msg.get("content") or "").strip().replace("\n", " ")
                if len(content) > 240:
                    content = content[:240] + "..."
                rendered.append(f"{role}: {content}")
            return "\n".join(rendered)
        except Exception as e:
            logger.warning(f"读取会话上下文失败: {e}")
            return ""


chat_persistence = ChatPersistence()
