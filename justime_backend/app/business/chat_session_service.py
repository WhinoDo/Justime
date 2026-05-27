"""Chat session management service."""

from typing import Dict, Any, List

from app.business.chat_persistence import chat_persistence


class ChatSessionService:
    """Manages chat sessions and messages — delegates to chat_persistence."""

    async def create_session(self, user_id: str, title: str) -> str:
        return await chat_persistence.create_session(user_id, title)

    async def save_message(self, session_id: str, role: str, content: str, **kwargs) -> str:
        return await chat_persistence.save_message(session_id, role, content, **kwargs)

    async def update_message_interactive_state(self, message_id: str, updates: Dict[str, Any]):
        return await chat_persistence.update_message_interactive_state(message_id, updates)

    async def get_user_sessions(self, user_id: str) -> List[dict]:
        return await chat_persistence.get_user_sessions(user_id)

    async def get_session_messages(self, session_id: str, limit: int = 200) -> List[dict]:
        return await chat_persistence.get_session_messages(session_id, limit)

    async def build_recent_context(self, session_id: str, window_size: int) -> str:
        return await chat_persistence.build_recent_context(session_id, window_size)


chat_session_service = ChatSessionService()
