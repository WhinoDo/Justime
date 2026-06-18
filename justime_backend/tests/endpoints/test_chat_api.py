"""
Chat API 端点测试
使用 httpx.AsyncClient 测试聊天 API，mock chat_business 避免外部调用
"""

import pytest
from httpx import AsyncClient
from typing import Dict, Any
from unittest.mock import patch, AsyncMock

pytestmark = pytest.mark.asyncio


class TestChatSend:
    """POST /api/v1/chat/"""

    ENDPOINT = "/api/v1/chat/"

    async def test_send_success(self, client: AsyncClient, auth_headers):
        from app.business.chat_business import chat_business

        with patch.object(chat_business, "process_chat", new_callable=AsyncMock) as mock_fn:
            mock_fn.return_value = {
                "success": True,
                "data": {"response": "回复", "sessionId": "507f1f77bcf86cd799439011"},
            }
            resp = await client.post(self.ENDPOINT, json={"message": "你好"}, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["response"] == "回复"

    async def test_send_unauthorized(self, client: AsyncClient):
        resp = await client.post(self.ENDPOINT, json={"message": "你好"})
        assert resp.status_code == 401

    async def test_send_overlong_message(self, client: AsyncClient, auth_headers):
        resp = await client.post(
            self.ENDPOINT, json={"message": "a" * 50001}, headers=auth_headers
        )
        # Pydantic max_length validation returns 422
        assert resp.status_code == 422

    async def test_send_empty_message(self, client: AsyncClient, auth_headers):
        resp = await client.post(self.ENDPOINT, json={"message": ""}, headers=auth_headers)
        assert resp.status_code == 422


class TestChatStream:
    """POST /api/v1/chat/stream"""

    ENDPOINT = "/api/v1/chat/stream"

    async def _mock_sse_stream(self, events: list[tuple[str, dict]]):
        """创建 mock SSE 流生成器"""
        from app.business.chat_business import chat_business
        async def _gen():
            for evt, data in events:
                yield chat_business._format_sse_event(evt, data)
        return _gen()

    async def test_stream_success(self, client: AsyncClient, auth_headers):
        from app.business.chat_business import chat_business

        mock_gen = await self._mock_sse_stream([
            ("metadata", {"sessionId": "s1"}),
            ("token", {"content": "你好"}),
            ("token", {"content": "世界"}),
            ("usage", {"promptTokens": 10, "completionTokens": 20}),
            ("done", {"messageId": "m1"}),
        ])
        with patch.object(chat_business, "process_chat_stream", return_value=mock_gen):
            resp = await client.post(self.ENDPOINT, json={"message": "你好"}, headers=auth_headers)

        assert resp.status_code == 200
        text = resp.text
        assert "event: metadata" in text
        assert "event: token" in text
        assert "你好" in text
        assert "event: usage" in text
        assert "event: done" in text

    async def test_stream_unauthorized(self, client: AsyncClient):
        resp = await client.post(self.ENDPOINT, json={"message": "你好"})
        assert resp.status_code == 401

    async def test_stream_overlong_message(self, client: AsyncClient, auth_headers):
        resp = await client.post(
            self.ENDPOINT, json={"message": "a" * 50001}, headers=auth_headers
        )
        # Pydantic max_length validation returns 422
        assert resp.status_code == 422


class TestCreateSession:
    """POST /api/v1/chat/sessions"""

    ENDPOINT = "/api/v1/chat/sessions"

    async def test_create(self, client: AsyncClient, auth_headers):
        from app.business.chat_business import chat_business

        with patch.object(chat_business, "create_session", new_callable=AsyncMock) as mock_fn:
            mock_fn.return_value = "507f1f77bcf86cd799439011"
            resp = await client.post(self.ENDPOINT, json={"title": "新会话"}, headers=auth_headers)

        assert resp.status_code == 200
        assert resp.json()["sessionId"] == "507f1f77bcf86cd799439011"

    async def test_create_default_title(self, client: AsyncClient, auth_headers):
        from app.business.chat_business import chat_business

        with patch.object(chat_business, "create_session", new_callable=AsyncMock) as mock_fn:
            mock_fn.return_value = "507f1f77bcf86cd799439011"
            await client.post(self.ENDPOINT, json={}, headers=auth_headers)

        mock_fn.assert_called_once()
        assert mock_fn.call_args[0][1] == "新会话"

    async def test_create_title_too_long(self, client: AsyncClient, auth_headers):
        resp = await client.post(self.ENDPOINT, json={"title": "a" * 201}, headers=auth_headers)
        # Pydantic max_length validation returns 422
        assert resp.status_code == 422

    async def test_create_unauthorized(self, client: AsyncClient):
        resp = await client.post(self.ENDPOINT, json={"title": "会话"})
        assert resp.status_code == 401


class TestGetSessions:
    """GET /api/v1/chat/sessions"""

    ENDPOINT = "/api/v1/chat/sessions"

    async def test_list_sessions(self, client: AsyncClient, auth_headers):
        from app.business.chat_business import chat_business

        mock_sessions = [
            {"_id": "id1", "userId": "u1", "title": "会话1", "updatedAt": "2024-01-01T00:00:00Z"},
            {"_id": "id2", "userId": "u1", "title": "会话2", "updatedAt": "2024-01-02T00:00:00Z"},
        ]
        with patch.object(chat_business, "get_user_sessions", new_callable=AsyncMock) as mock_fn:
            mock_fn.return_value = mock_sessions
            resp = await client.get(self.ENDPOINT, headers=auth_headers)

        assert resp.status_code == 200
        assert len(resp.json()["sessions"]) == 2

    async def test_list_empty(self, client: AsyncClient, auth_headers):
        from app.business.chat_business import chat_business

        with patch.object(chat_business, "get_user_sessions", new_callable=AsyncMock) as mock_fn:
            mock_fn.return_value = []
            resp = await client.get(self.ENDPOINT, headers=auth_headers)

        assert resp.status_code == 200
        assert resp.json()["sessions"] == []

    async def test_list_unauthorized(self, client: AsyncClient):
        resp = await client.get(self.ENDPOINT)
        assert resp.status_code == 401


class TestGetSessionMessages:
    """GET /api/v1/chat/sessions/{id}/messages"""

    async def _create_session_for_auth(self, clean_db, session_id: str, test_user):
        """在 DB 中创建会话以供 _ensure_session_access 通过"""
        from app.database import db
        from bson import ObjectId
        from datetime import datetime
        await db.db["chat_sessions"].insert_one({
            "_id": ObjectId(session_id), "userId": str(test_user["_id"]),
            "title": "test", "updatedAt": datetime.now(),
        })

    async def test_get_messages(self, client: AsyncClient, auth_headers, clean_db, test_user):
        from app.business.chat_business import chat_business
        from bson import ObjectId

        session_oid = str(ObjectId())
        await self._create_session_for_auth(clean_db, session_oid, test_user)

        with patch.object(chat_business, "get_session_messages", new_callable=AsyncMock) as mock_fn:
            mock_fn.return_value = [{"_id": "m1", "role": "user", "content": "hi", "timestamp": "2024-01-01T00:00:00"}]
            resp = await client.get(
                f"/api/v1/chat/sessions/{session_oid}/messages", headers=auth_headers
            )

        assert resp.status_code == 200
        messages = resp.json()["messages"]
        assert len(messages) == 1

    async def test_get_messages_nonexistent(self, client: AsyncClient, auth_headers):
        from bson import ObjectId
        resp = await client.get(
            f"/api/v1/chat/sessions/{str(ObjectId())}/messages", headers=auth_headers
        )
        assert resp.status_code == 404

    async def test_get_messages_invalid_id(self, client: AsyncClient, auth_headers):
        resp = await client.get("/api/v1/chat/sessions/bad-id/messages", headers=auth_headers)
        assert resp.status_code == 400

    async def test_get_messages_negative_limit(self, client: AsyncClient, auth_headers):
        resp = await client.get(
            "/api/v1/chat/sessions/507f1f77bcf86cd799439011/messages?limit=-1", headers=auth_headers
        )
        assert resp.status_code == 400

    async def test_get_messages_zero_limit(self, client: AsyncClient, auth_headers):
        resp = await client.get(
            "/api/v1/chat/sessions/507f1f77bcf86cd799439011/messages?limit=0", headers=auth_headers
        )
        assert resp.status_code == 400

    async def test_get_messages_unauthorized(self, client: AsyncClient):
        resp = await client.get("/api/v1/chat/sessions/507f1f77bcf86cd799439011/messages")
        assert resp.status_code == 401


class TestUpdateMessage:
    """PATCH /api/v1/chat/messages/{id}"""

    async def _setup_msg(self, clean_db, test_user) -> tuple[str, str]:
        """创建 session 和 message，返回 (session_id, message_id)"""
        from app.database import db
        from bson import ObjectId
        from datetime import datetime

        session_oid = ObjectId()
        msg_oid = ObjectId()
        await db.db["chat_sessions"].insert_one({
            "_id": session_oid, "userId": str(test_user["_id"]),
            "title": "test", "updatedAt": datetime.now(),
        })
        await db.db["chat_messages"].insert_one({
            "_id": msg_oid, "sessionId": str(session_oid),
            "role": "ai", "content": "test", "timestamp": datetime.now(),
        })
        return str(session_oid), str(msg_oid)

    async def test_update_success(self, client: AsyncClient, auth_headers, clean_db, test_user):
        from app.business.chat_business import chat_business

        _, msg_id = await self._setup_msg(clean_db, test_user)

        with patch.object(chat_business, "update_message_interactive_state", new_callable=AsyncMock):
            resp = await client.patch(
                f"/api/v1/chat/messages/{msg_id}",
                json={"taskDecomposition": {"task": "done"}},
                headers=auth_headers,
            )

        assert resp.status_code == 200
        assert resp.json() == {"success": True}

    async def test_update_empty_body(self, client: AsyncClient, auth_headers):
        resp = await client.patch(
            "/api/v1/chat/messages/507f1f77bcf86cd799439011",
            json={}, headers=auth_headers,
        )
        assert resp.status_code == 400

    async def test_update_disallowed_field(self, client: AsyncClient, auth_headers):
        resp = await client.patch(
            "/api/v1/chat/messages/507f1f77bcf86cd799439011",
            json={"content": "new"}, headers=auth_headers,
        )
        assert resp.status_code == 400

    async def test_update_not_an_object(self, client: AsyncClient, auth_headers):
        resp = await client.patch(
            "/api/v1/chat/messages/507f1f77bcf86cd799439011",
            json=["not-object"], headers=auth_headers,
        )
        # FastAPI returns 422 when body can't be parsed as Dict
        assert resp.status_code == 422

    async def test_update_nonexistent_message(self, client: AsyncClient, auth_headers):
        from bson import ObjectId
        resp = await client.patch(
            f"/api/v1/chat/messages/{str(ObjectId())}",
            json={"taskDecomposition": None}, headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_update_unauthorized(self, client: AsyncClient):
        resp = await client.patch(
            "/api/v1/chat/messages/507f1f77bcf86cd799439011",
            json={"taskDecomposition": None},
        )
        assert resp.status_code == 401


class TestLLMTest:
    """POST /api/v1/chat/test"""

    ENDPOINT = "/api/v1/chat/test"

    async def test_connection_success(self, client: AsyncClient, auth_headers):
        from app.business.chat_business import chat_business

        with patch.object(chat_business, "test_connection", new_callable=AsyncMock) as mock_fn:
            mock_fn.return_value = {"success": True, "message": "连接成功"}
            resp = await client.post(
                self.ENDPOINT,
                json={"modelId": "deepseek-chat", "baseUrl": "https://api.deepseek.com", "apiKey": "sk-test"},
                headers=auth_headers,
            )

        assert resp.status_code == 200

    async def test_connection_invalid_url(self, client: AsyncClient, auth_headers):
        resp = await client.post(
            self.ENDPOINT,
            json={"modelId": "m", "baseUrl": "not-a-url", "apiKey": "sk-test"},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    async def test_connection_empty_model(self, client: AsyncClient, auth_headers):
        resp = await client.post(
            self.ENDPOINT,
            json={"modelId": "", "baseUrl": "https://api.example.com", "apiKey": "sk-test"},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    async def test_connection_unauthorized(self, client: AsyncClient):
        resp = await client.post(
            self.ENDPOINT,
            json={"modelId": "m", "baseUrl": "https://api.example.com", "apiKey": "sk-test"},
        )
        assert resp.status_code == 401
