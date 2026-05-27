import importlib.util
import sys
import types
import unittest
from pathlib import Path
from types import SimpleNamespace


CHAT_ENDPOINT_PATH = (
    Path(__file__).resolve().parents[2]
    / "app"
    / "api"
    / "v1"
    / "endpoints"
    / "chat.py"
)


class HTTPException(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class APIRouter:
    def get(self, *args, **kwargs):
        def decorator(fn):
            return fn
        return decorator

    def post(self, *args, **kwargs):
        def decorator(fn):
            return fn
        return decorator

    def patch(self, *args, **kwargs):
        def decorator(fn):
            return fn
        return decorator


class FakeObjectId(str):
    def __new__(cls, value):
        raw = str(value)
        if len(raw) != 24:
            raise ValueError("invalid ObjectId")
        return str.__new__(cls, raw)


class FakeCollection:
    def __init__(self, result):
        self._result = result
        self.calls = []

    async def find_one(self, query, projection=None):
        self.calls.append((query, projection))
        return self._result


class FakeDBHandle:
    def __init__(self, session_result, message_result=None):
        self._session_collection = FakeCollection(session_result)
        self._message_collection = FakeCollection(message_result)
        self.db = {
            "chat_sessions": self._session_collection,
            "chat_messages": self._message_collection,
        }


class FakeChatBusiness:
    def __init__(self):
        self.called = False
        self.update_called = False
        self.chat_called = False
        self.last_limit = None

    async def get_session_messages(self, session_id, limit=200):
        self.called = True
        self.last_limit = limit
        return [{"sessionId": session_id, "content": "ok"}]

    async def update_message_interactive_state(self, message_id, updates):
        self.update_called = True
        return {"messageId": message_id, "updates": updates}

    async def process_chat(self, request, user_id):
        self.chat_called = True
        return {"success": True, "data": {"sessionId": getattr(request, "sessionId", None), "userId": user_id}}


def load_endpoint_module(session_result, message_result=None):
    fake_fastapi = types.ModuleType("fastapi")
    fake_fastapi.APIRouter = APIRouter
    fake_fastapi.Depends = lambda dep: dep
    fake_fastapi.HTTPException = HTTPException
    sys.modules["fastapi"] = fake_fastapi

    fake_bson = types.ModuleType("bson")
    fake_bson.ObjectId = FakeObjectId
    sys.modules["bson"] = fake_bson

    sys.modules.setdefault("app", types.ModuleType("app"))
    sys.modules.setdefault("app.models", types.ModuleType("app.models"))
    sys.modules.setdefault("app.business", types.ModuleType("app.business"))
    sys.modules.setdefault("app.services", types.ModuleType("app.services"))

    fake_chat_models = types.ModuleType("app.models.chat")
    fake_chat_models.ChatRequest = dict
    fake_chat_models.ChatResponse = dict
    fake_chat_models.LLMTestRequest = dict
    sys.modules["app.models.chat"] = fake_chat_models

    fake_history_models = types.ModuleType("app.models.history")
    fake_history_models.SessionListResponse = dict
    fake_history_models.MessageListResponse = dict
    fake_history_models.CreateSessionRequest = dict
    sys.modules["app.models.history"] = fake_history_models

    fake_business_module = types.ModuleType("app.business.chat_business")
    fake_chat_business = FakeChatBusiness()
    fake_business_module.chat_business = fake_chat_business
    sys.modules["app.business.chat_business"] = fake_business_module

    fake_security_module = types.ModuleType("app.services.security_service")
    fake_security_module.SecurityService = types.SimpleNamespace(get_current_user=lambda: None)
    sys.modules["app.services.security_service"] = fake_security_module

    fake_db_module = types.ModuleType("app.database")
    fake_db = FakeDBHandle(session_result, message_result)
    fake_db_module.db = fake_db
    sys.modules["app.database"] = fake_db_module

    spec = importlib.util.spec_from_file_location("chat_endpoint_under_test", CHAT_ENDPOINT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module, fake_chat_business, fake_db


class ChatEndpointSessionAuthTest(unittest.IsolatedAsyncioTestCase):
    async def test_chat_blocks_non_owner_session(self):
        module, fake_chat_business, _ = load_endpoint_module(session_result=None)

        with self.assertRaises(HTTPException) as ctx:
            await module.chat(
                request=SimpleNamespace(sessionId="0123456789abcdef01234567", message="hi"),
                current_user={"_id": "user-a"},
            )

        self.assertEqual(ctx.exception.status_code, 404)
        self.assertFalse(fake_chat_business.chat_called)

    async def test_chat_allows_owner_session(self):
        module, fake_chat_business, _ = load_endpoint_module(
            session_result={"_id": "0123456789abcdef01234567"}
        )

        result = await module.chat(
            request=SimpleNamespace(sessionId="0123456789abcdef01234567", message="hi"),
            current_user={"_id": "user-a"},
        )

        self.assertTrue(fake_chat_business.chat_called)
        self.assertEqual(result["success"], True)

    async def test_get_session_messages_blocks_non_owner(self):
        module, fake_chat_business, _ = load_endpoint_module(session_result=None)

        with self.assertRaises(HTTPException) as ctx:
            await module.get_session_messages(
                session_id="0123456789abcdef01234567",
                current_user={"_id": "user-a"},
            )

        self.assertEqual(ctx.exception.status_code, 404)
        self.assertFalse(fake_chat_business.called)

    async def test_get_session_messages_allows_owner(self):
        module, fake_chat_business, _ = load_endpoint_module(
            session_result={"_id": "0123456789abcdef01234567"}
        )

        result = await module.get_session_messages(
            session_id="0123456789abcdef01234567",
            current_user={"_id": "user-a"},
        )

        self.assertTrue(fake_chat_business.called)
        self.assertEqual(result["messages"][0]["content"], "ok")
        self.assertEqual(fake_chat_business.last_limit, module.DEFAULT_SESSION_MESSAGES_LIMIT)

    async def test_get_session_messages_caps_limit_for_performance(self):
        module, fake_chat_business, _ = load_endpoint_module(
            session_result={"_id": "0123456789abcdef01234567"}
        )

        await module.get_session_messages(
            session_id="0123456789abcdef01234567",
            limit=5000,
            current_user={"_id": "user-a"},
        )

        self.assertTrue(fake_chat_business.called)
        self.assertEqual(fake_chat_business.last_limit, module.MAX_SESSION_MESSAGES_LIMIT)

    async def test_get_session_messages_rejects_non_positive_limit(self):
        module, fake_chat_business, _ = load_endpoint_module(
            session_result={"_id": "0123456789abcdef01234567"}
        )

        with self.assertRaises(HTTPException) as ctx:
            await module.get_session_messages(
                session_id="0123456789abcdef01234567",
                limit=0,
                current_user={"_id": "user-a"},
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("limit", ctx.exception.detail)
        self.assertFalse(fake_chat_business.called)

    async def test_update_message_blocks_non_owner(self):
        module, fake_chat_business, _ = load_endpoint_module(
            session_result=None,
            message_result={"sessionId": "0123456789abcdef01234567"},
        )

        with self.assertRaises(HTTPException) as ctx:
            await module.update_message(
                message_id="0123456789abcdef01234567",
                updates={"taskDecomposition": None},
                current_user={"_id": "user-a"},
            )

        self.assertEqual(ctx.exception.status_code, 404)
        self.assertFalse(fake_chat_business.update_called)

    async def test_update_message_allows_owner(self):
        module, fake_chat_business, _ = load_endpoint_module(
            session_result={"_id": "0123456789abcdef01234567"},
            message_result={"sessionId": "0123456789abcdef01234567"},
        )

        result = await module.update_message(
            message_id="0123456789abcdef01234567",
            updates={"taskDecomposition": None},
            current_user={"_id": "user-a"},
        )

        self.assertTrue(fake_chat_business.update_called)
        self.assertEqual(result, {"success": True})

    async def test_update_message_rejects_disallowed_fields(self):
        module, fake_chat_business, _ = load_endpoint_module(
            session_result={"_id": "0123456789abcdef01234567"},
            message_result={"sessionId": "0123456789abcdef01234567"},
        )

        with self.assertRaises(HTTPException) as ctx:
            await module.update_message(
                message_id="0123456789abcdef01234567",
                updates={"unexpectedField": True},
                current_user={"_id": "user-a"},
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertFalse(fake_chat_business.update_called)

    async def test_update_message_rejects_non_object_payload(self):
        module, fake_chat_business, _ = load_endpoint_module(
            session_result={"_id": "0123456789abcdef01234567"},
            message_result={"sessionId": "0123456789abcdef01234567"},
        )

        with self.assertRaises(HTTPException) as ctx:
            await module.update_message(
                message_id="0123456789abcdef01234567",
                updates=["not-an-object"],
                current_user={"_id": "user-a"},
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail, "更新内容必须是对象")
        self.assertFalse(fake_chat_business.update_called)

    async def test_update_message_rejects_invalid_field_value_type(self):
        module, fake_chat_business, _ = load_endpoint_module(
            session_result={"_id": "0123456789abcdef01234567"},
            message_result={"sessionId": "0123456789abcdef01234567"},
        )

        with self.assertRaises(HTTPException) as ctx:
            await module.update_message(
                message_id="0123456789abcdef01234567",
                updates={"taskDecomposition": "bad-type"},
                current_user={"_id": "user-a"},
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertFalse(fake_chat_business.update_called)

    async def test_update_message_rejects_non_object_items_in_list_fields(self):
        module, fake_chat_business, _ = load_endpoint_module(
            session_result={"_id": "0123456789abcdef01234567"},
            message_result={"sessionId": "0123456789abcdef01234567"},
        )

        with self.assertRaises(HTTPException) as ctx:
            await module.update_message(
                message_id="0123456789abcdef01234567",
                updates={"suggestedEvents": [1, 2]},
                current_user={"_id": "user-a"},
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertFalse(fake_chat_business.update_called)

    async def test_update_message_rejects_oversized_list_fields(self):
        module, fake_chat_business, _ = load_endpoint_module(
            session_result={"_id": "0123456789abcdef01234567"},
            message_result={"sessionId": "0123456789abcdef01234567"},
        )

        with self.assertRaises(HTTPException) as ctx:
            await module.update_message(
                message_id="0123456789abcdef01234567",
                updates={"suggestedEvents": [{"title": "e"} for _ in range(101)]},
                current_user={"_id": "user-a"},
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("最多支持 100 项", ctx.exception.detail)
        self.assertFalse(fake_chat_business.update_called)

    async def test_update_message_rejects_forbidden_mongo_keys(self):
        module, fake_chat_business, _ = load_endpoint_module(
            session_result={"_id": "0123456789abcdef01234567"},
            message_result={"sessionId": "0123456789abcdef01234567"},
        )

        with self.assertRaises(HTTPException) as ctx:
            await module.update_message(
                message_id="0123456789abcdef01234567",
                updates={"taskDecomposition": {"$bad": 1}},
                current_user={"_id": "user-a"},
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("字段名不合法", ctx.exception.detail)
        self.assertFalse(fake_chat_business.update_called)

    async def test_update_message_rejects_too_deep_nested_payload(self):
        module, fake_chat_business, _ = load_endpoint_module(
            session_result={"_id": "0123456789abcdef01234567"},
            message_result={"sessionId": "0123456789abcdef01234567"},
        )
        nested = {}
        cursor = nested
        for _ in range(70):
            cursor["child"] = {}
            cursor = cursor["child"]

        with self.assertRaises(HTTPException) as ctx:
            await module.update_message(
                message_id="0123456789abcdef01234567",
                updates={"taskDecomposition": nested},
                current_user={"_id": "user-a"},
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("嵌套层级过深", ctx.exception.detail)
        self.assertFalse(fake_chat_business.update_called)

    async def test_update_message_with_orphan_session_id_returns_not_found(self):
        module, fake_chat_business, _ = load_endpoint_module(
            session_result=None,
            message_result={"sessionId": None},
        )

        with self.assertRaises(HTTPException) as ctx:
            await module.update_message(
                message_id="0123456789abcdef01234567",
                updates={"taskDecomposition": None},
                current_user={"_id": "user-a"},
            )

        self.assertEqual(ctx.exception.status_code, 404)
        self.assertFalse(fake_chat_business.update_called)


if __name__ == "__main__":
    unittest.main()
