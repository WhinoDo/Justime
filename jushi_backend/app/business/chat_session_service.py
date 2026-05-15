"""Chat session management service."""

from datetime import datetime
from typing import Dict, Any, List
from bson import ObjectId
from app.database import db


class ChatSessionService:
    """Manages chat sessions and messages."""

    async def create_session(self, user_id: str, title: str) -> str:
        """Create a new chat session.

        Args:
            user_id: User ID
            title: Session title

        Returns:
            Session ID as string
        """
        session_doc = {
            "userId": user_id,
            "title": title,
            "updatedAt": datetime.now(),
            "createdAt": datetime.now()
        }
        result = await db.db["chat_sessions"].insert_one(session_doc)
        return str(result.inserted_id)

    async def save_message(self, session_id: str, role: str, content: str, **kwargs) -> str:
        """Save a chat message.

        Args:
            session_id: Session ID
            role: Message role ('user' or 'ai')
            content: Message content
            **kwargs: Optional fields (taskDecomposition, multiTaskDecompositions, etc.)

        Returns:
            Message ID as string
        """
        message_doc = {
            "sessionId": session_id,
            "role": role,
            "content": content,
            "timestamp": datetime.now()
        }

        # Add optional fields if present
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

        # Update session's last update time and preview
        await db.db["chat_sessions"].update_one(
            {"_id": ObjectId(session_id)},
            {
                "$set": {
                    "updatedAt": datetime.now(),
                    "preview": content[:50] + "..." if len(content) > 50 else content
                }
            }
        )
        return str(result.inserted_id)

    async def update_message_interactive_state(self, message_id: str, updates: Dict[str, Any]) -> None:
        """Update message's interactive state (e.g., clear task decomposition data).

        Args:
            message_id: Message ID
            updates: Fields to update
        """
        if not message_id:
            return

        update_fields = {}
        # Only allow updating specific interactive fields to prevent abuse
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
        """Get user's chat sessions.

        Args:
            user_id: User ID

        Returns:
            List of session dictionaries
        """
        cursor = db.db["chat_sessions"].find({"userId": user_id}).sort("updatedAt", -1)
        sessions = await cursor.to_list(length=100)
        # Convert ObjectId to str
        for s in sessions:
            s["_id"] = str(s["_id"])
        return sessions

    async def get_session_messages(self, session_id: str) -> List[dict]:
        """Get messages for a session.

        Args:
            session_id: Session ID

        Returns:
            List of message dictionaries
        """
        cursor = db.db["chat_messages"].find({"sessionId": session_id}).sort("timestamp", 1)
        messages = await cursor.to_list(length=1000)
        # Convert ObjectId to str
        for m in messages:
            m["_id"] = str(m["_id"])
        return messages

    async def build_recent_context(self, session_id: str, window_size: int) -> str:
        """Read recent session context for thinking-type tasks.

        Args:
            session_id: Session ID
            window_size: Number of recent messages to include

        Returns:
            Formatted context string
        """
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
            print(f"⚠️ 读取会话上下文失败: {e}")
            return ""


# Singleton instance
chat_session_service = ChatSessionService()
