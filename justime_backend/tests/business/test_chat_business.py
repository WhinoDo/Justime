"""
Chat 业务逻辑单元测试
测试 ChatBusiness 中的静态工具方法，无需 MongoDB
"""

import os
os.environ["ALLOWED_ORIGINS"] = '["http://localhost:3000"]'
os.environ["JWT_SECRET"] = "test-jwt-secret-key-at-least-32-characters-long!"

import pytest

pytestmark = pytest.mark.asyncio


class TestFormatSSEEvent:
    """测试 _format_sse_event 静态方法"""

    def test_basic_event(self):
        from app.business.chat_business import ChatBusiness
        result = ChatBusiness._format_sse_event("done", {"status": "ok"})
        assert result == "event: done\ndata: {\"status\": \"ok\"}\n\n"

    def test_event_with_id(self):
        from app.business.chat_business import ChatBusiness
        result = ChatBusiness._format_sse_event("token", {"content": "hi"}, event_id="s1:m1:1")
        assert "event: token" in result
        assert "id: s1:m1:1" in result
        assert result.endswith("\n\n")

    def test_unicode_content(self):
        from app.business.chat_business import ChatBusiness
        result = ChatBusiness._format_sse_event("token", {"content": "你好世界"})
        assert "你好世界" in result

    def test_error_event(self):
        from app.business.chat_business import ChatBusiness
        result = ChatBusiness._format_sse_event("error", {"message": "出错"})
        assert result.startswith("event: error")
        assert "出错" in result


class TestExtractStreamContent:
    """测试 _extract_stream_content"""

    def test_valid_content(self):
        from app.business.chat_business import ChatBusiness
        chunk = {"choices": [{"delta": {"content": "Hello"}}]}
        assert ChatBusiness._extract_stream_content(chunk) == "Hello"

    def test_empty_delta(self):
        from app.business.chat_business import ChatBusiness
        assert ChatBusiness._extract_stream_content({"choices": [{"delta": {}}]}) is None

    def test_no_choices(self):
        from app.business.chat_business import ChatBusiness
        assert ChatBusiness._extract_stream_content({"id": "123"}) is None

    def test_empty_choices_list(self):
        from app.business.chat_business import ChatBusiness
        assert ChatBusiness._extract_stream_content({"choices": []}) is None


class TestExtractStreamUsage:
    """测试 _extract_stream_usage"""

    def test_valid_usage(self):
        from app.business.chat_business import ChatBusiness
        chunk = {"usage": {"prompt_tokens": 50, "completion_tokens": 100, "total_tokens": 150}}
        result = ChatBusiness._extract_stream_usage(chunk)
        assert result == {"promptTokens": 50, "completionTokens": 100, "totalTokens": 150}

    def test_no_usage(self):
        from app.business.chat_business import ChatBusiness
        assert ChatBusiness._extract_stream_usage({"choices": [{"delta": {"content": "hi"}}]}) is None

    def test_partial_usage(self):
        from app.business.chat_business import ChatBusiness
        result = ChatBusiness._extract_stream_usage({"usage": {"prompt_tokens": 10}})
        assert result == {"promptTokens": 10, "completionTokens": 0, "totalTokens": 0}


class TestShouldUseOpenClaw:
    """测试 _should_use_openclaw"""

    def test_enabled(self):
        from app.business.chat_business import ChatBusiness
        from app.models.chat import ChatRequest
        assert ChatBusiness()._should_use_openclaw(ChatRequest(message="hi", useOpenClaw=True)) is True

    def test_disabled(self):
        from app.business.chat_business import ChatBusiness
        from app.models.chat import ChatRequest
        assert ChatBusiness()._should_use_openclaw(ChatRequest(message="hi", useOpenClaw=False)) is False

    def test_default(self):
        from app.business.chat_business import ChatBusiness
        from app.models.chat import ChatRequest
        assert ChatBusiness()._should_use_openclaw(ChatRequest(message="hi")) is False


class TestEndpointValidation:
    """测试 chat.py 端点的验证逻辑"""

    async def test_chat_rejects_overlong_message(self):
        from app.api.v1.endpoints.chat import chat, MAX_MESSAGE_LENGTH
        from unittest.mock import AsyncMock, patch
        from fastapi import HTTPException
        import pytest

        class MockRequest:
            message = "a" * (MAX_MESSAGE_LENGTH + 1)
            sessionId = None

        with patch("app.api.v1.endpoints.chat.chat_business") as mock_biz:
            mock_biz.process_chat = AsyncMock()

            with pytest.raises(HTTPException) as exc:
                await chat(MockRequest(), current_user={"_id": "test_user"})
            assert exc.value.status_code == 400
            mock_biz.process_chat.assert_not_called()

    async def test_chat_stream_rejects_overlong_message(self):
        from app.api.v1.endpoints.chat import chat_stream, MAX_MESSAGE_LENGTH
        from unittest.mock import AsyncMock, patch, MagicMock
        from fastapi import HTTPException
        import pytest

        class MockRequest:
            message = "a" * (MAX_MESSAGE_LENGTH + 1)
            sessionId = None
            runtimeModelId = None
            resumeMessageId = None

        mock_req = MagicMock()
        mock_req.headers = {}
        mock_req.method = "POST"

        with patch("app.api.v1.endpoints.chat.chat_business") as mock_biz:
            mock_biz.process_chat_stream.return_value = AsyncMock()

            with pytest.raises(HTTPException) as exc:
                await chat_stream(MockRequest(), mock_req, current_user={"_id": "test_user"})
            assert exc.value.status_code == 400
