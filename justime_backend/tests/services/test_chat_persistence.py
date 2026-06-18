"""
Chat 持久化层测试 - 需要 MongoDB
测试 ChatPersistence 的 CRUD 操作
"""

import pytest
from datetime import datetime, timezone
from bson import ObjectId

pytestmark = pytest.mark.asyncio


class TestCreateSession:
    async def test_create_session_success(self, clean_db):
        from app.business.chat_persistence import chat_persistence

        user_id = str(ObjectId())
        session_id = await chat_persistence.create_session(user_id, "测试会话")

        assert session_id is not None
        assert len(session_id) == 24  # ObjectId hex length

        doc = await clean_db["chat_sessions"].find_one({"_id": ObjectId(session_id)})
        assert doc is not None
        assert doc["userId"] == user_id
        assert doc["title"] == "测试会话"
        assert "createdAt" in doc
        assert "updatedAt" in doc

    async def test_create_session_empty_title(self, clean_db):
        from app.business.chat_persistence import chat_persistence

        session_id = await chat_persistence.create_session(str(ObjectId()), "")
        doc = await clean_db["chat_sessions"].find_one({"_id": ObjectId(session_id)})
        assert doc is not None
        assert doc["title"] == ""


class TestSaveAndGetMessages:
    async def test_save_message(self, clean_db):
        from app.business.chat_persistence import chat_persistence

        session_id = await chat_persistence.create_session(str(ObjectId()), "test")
        message_id = await chat_persistence.save_message(session_id, "user", "你好")

        msg = await clean_db["chat_messages"].find_one({"_id": ObjectId(message_id)})
        assert msg["role"] == "user"
        assert msg["content"] == "你好"
        assert msg["sessionId"] == session_id

    async def test_save_message_with_optional_fields(self, clean_db):
        from app.business.chat_persistence import chat_persistence

        session_id = await chat_persistence.create_session(str(ObjectId()), "test")
        task_decomp = {"task": "test", "steps": [1, 2]}
        message_id = await chat_persistence.save_message(
            session_id, "ai", "AI回复", taskDecomposition=task_decomp,
            suggestedEvents=[{"title": "Meeting"}],
        )

        msg = await clean_db["chat_messages"].find_one({"_id": ObjectId(message_id)})
        assert msg["taskDecomposition"] == task_decomp
        assert msg["suggestedEvents"] == [{"title": "Meeting"}]

    async def test_save_message_updates_session_preview(self, clean_db):
        from app.business.chat_persistence import chat_persistence

        session_id = await chat_persistence.create_session(str(ObjectId()), "test")
        long_content = "很长" * 30
        await chat_persistence.save_message(session_id, "user", long_content)

        session = await clean_db["chat_sessions"].find_one({"_id": ObjectId(session_id)})
        assert session["preview"].endswith("...")

    async def test_get_messages(self, clean_db):
        from app.business.chat_persistence import chat_persistence

        session_id = await chat_persistence.create_session(str(ObjectId()), "test")
        await chat_persistence.save_message(session_id, "user", "你好")
        await chat_persistence.save_message(session_id, "ai", "你好！")

        messages = await chat_persistence.get_session_messages(session_id)
        assert len(messages) == 2
        contents = [m["content"] for m in messages]
        assert "你好" in contents
        assert "你好！" in contents

    async def test_get_messages_with_limit(self, clean_db):
        from app.business.chat_persistence import chat_persistence

        session_id = await chat_persistence.create_session(str(ObjectId()), "test")
        for i in range(10):
            await chat_persistence.save_message(session_id, "user", f"msg{i}")

        messages = await chat_persistence.get_session_messages(session_id, limit=3)
        assert len(messages) == 3

    async def test_get_messages_empty(self, clean_db):
        from app.business.chat_persistence import chat_persistence

        session_id = await chat_persistence.create_session(str(ObjectId()), "test")
        assert await chat_persistence.get_session_messages(session_id) == []


class TestGetUserSessions:
    async def test_get_sessions(self, clean_db):
        from app.business.chat_persistence import chat_persistence

        user_id = str(ObjectId())
        await chat_persistence.create_session(user_id, "会话1")
        await chat_persistence.create_session(user_id, "会话2")

        sessions = await chat_persistence.get_user_sessions(user_id)
        assert len(sessions) == 2

    async def test_sessions_ordered_by_update(self, clean_db):
        from app.business.chat_persistence import chat_persistence

        user_id = str(ObjectId())
        s1 = await chat_persistence.create_session(user_id, "会话1")
        s2 = await chat_persistence.create_session(user_id, "会话2")
        await chat_persistence.save_message(s2, "user", "new")

        sessions = await chat_persistence.get_user_sessions(user_id)
        assert sessions[0]["title"] == "会话2"

    async def test_sessions_empty(self, clean_db):
        from app.business.chat_persistence import chat_persistence
        assert await chat_persistence.get_user_sessions(str(ObjectId())) == []

    async def test_sessions_isolated_per_user(self, clean_db):
        from app.business.chat_persistence import chat_persistence

        await chat_persistence.create_session(str(ObjectId()), "A")
        await chat_persistence.create_session(str(ObjectId()), "B")

        sessions_a = await chat_persistence.get_user_sessions(str(ObjectId()))
        assert len(sessions_a) == 0


class TestUpdateMessage:
    async def test_update_interactive_state(self, clean_db):
        from app.business.chat_persistence import chat_persistence
        from bson import ObjectId

        session_id = await chat_persistence.create_session(str(ObjectId()), "test")
        message_id = await chat_persistence.save_message(session_id, "ai", "你好")

        await chat_persistence.update_message_interactive_state(
            message_id, {"taskDecomposition": {"task": "done"}}
        )

        msg = await clean_db["chat_messages"].find_one({"_id": ObjectId(message_id)})
        assert msg["taskDecomposition"] == {"task": "done"}

    async def test_update_empty_id_no_error(self, clean_db):
        from app.business.chat_persistence import chat_persistence
        await chat_persistence.update_message_interactive_state("", {"taskDecomposition": {}})

    async def test_update_only_allowed_fields(self, clean_db):
        from app.business.chat_persistence import chat_persistence
        from bson import ObjectId

        session_id = await chat_persistence.create_session(str(ObjectId()), "test")
        message_id = await chat_persistence.save_message(session_id, "ai", "你好")

        await chat_persistence.update_message_interactive_state(
            message_id, {"taskDecomposition": {"step": 1}, "invalidField": "ignored"}
        )

        msg = await clean_db["chat_messages"].find_one({"_id": ObjectId(message_id)})
        assert msg["taskDecomposition"] == {"step": 1}
        assert "invalidField" not in msg


class TestBuildRecentContext:
    async def test_build_context(self, clean_db):
        from app.business.chat_persistence import chat_persistence

        session_id = await chat_persistence.create_session(str(ObjectId()), "test")
        await chat_persistence.save_message(session_id, "user", "你好")
        await chat_persistence.save_message(session_id, "ai", "你好！有什么可以帮助你的？")

        context = await chat_persistence.build_recent_context(session_id, 5)
        assert "用户: 你好" in context
        assert "助手: 你好！有什么可以帮助你的？" in context

    async def test_context_window_size(self, clean_db):
        from app.business.chat_persistence import chat_persistence

        session_id = await chat_persistence.create_session(str(ObjectId()), "test")
        for i in range(10):
            await chat_persistence.save_message(session_id, "user", f"消息{i}")

        context = await chat_persistence.build_recent_context(session_id, 3)
        assert "消息9" in context
        assert "消息8" in context
        assert "消息7" in context
        assert "消息6" not in context

    async def test_context_empty_session(self, clean_db):
        from app.business.chat_persistence import chat_persistence

        session_id = await chat_persistence.create_session(str(ObjectId()), "test")
        assert await chat_persistence.build_recent_context(session_id, 5) == ""

    async def test_context_invalid_params(self, clean_db):
        from app.business.chat_persistence import chat_persistence

        assert await chat_persistence.build_recent_context("", 5) == ""
        assert await chat_persistence.build_recent_context("abc", 0) == ""
