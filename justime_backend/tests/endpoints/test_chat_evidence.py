import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.business.chat_business import ChatBusiness
from app.business.chat_persistence import chat_persistence
from app.business.chat_router import chat_router
from app.business.task_process_business import _task_process_business
from app.core.redis_client import RedisClient
from app.models.chat import ChatStreamRequest
from app.models.task_process import TaskProcessCreate
from app.services.llm_service import llm_service
from app.services.sse_stream_service import SSEStreamService
from app.services.user_service import UserService
from tests.services.test_sse_stream_service import InMemoryRedis


pytestmark = pytest.mark.asyncio


def _parse_sse(raw: str):
    event = None
    event_id = None
    data = None
    for line in raw.strip().splitlines():
        if line.startswith("event: "):
            event = line[7:]
        elif line.startswith("id: "):
            event_id = line[4:]
        elif line.startswith("data: "):
            data = json.loads(line[6:])
    return {"event": event, "id": event_id, "data": data}


async def _collect_stream(generator):
    return [_parse_sse(item) async for item in generator]


@pytest.fixture
def configured_business(monkeypatch):
    fake_redis = InMemoryRedis()
    monkeypatch.setattr(RedisClient, "_client", fake_redis)
    monkeypatch.setattr(RedisClient, "_enabled", True)
    monkeypatch.setattr(RedisClient, "_initialized", True)

    business = ChatBusiness()
    business._record_usage_event = AsyncMock()
    business._get_user_llm_config = AsyncMock(return_value={})

    monkeypatch.setattr(
        UserService,
        "get_available_models_for_user",
        AsyncMock(
            return_value=[
                {
                    "config_id": "cfg-1",
                    "config_name": "Primary",
                    "model_id": "model-1",
                    "is_active": True,
                }
            ]
        ),
    )
    monkeypatch.setattr(
        UserService,
        "get_user_active_model_id",
        AsyncMock(return_value="cfg-1"),
    )
    monkeypatch.setattr(
        chat_router,
        "build_runtime_model_candidates",
        lambda *_: [
            {
                "config_id": "cfg-1",
                "config_name": "Primary",
                "model_id": "model-1",
                "is_active": True,
            }
        ],
    )
    monkeypatch.setattr(
        chat_router,
        "runtime_to_llm_config",
        lambda *_args, **_kwargs: SimpleNamespace(
            model_id="model-1",
            api_key="test-key",
            api_base="https://llm.invalid/v1",
        ),
    )
    monkeypatch.setattr(
        SSEStreamService,
        "_session_belongs_to_user",
        staticmethod(AsyncMock(return_value=True)),
    )
    return business


async def _create_task(user_id: str) -> str:
    task = await _task_process_business.create_task_process(
        user_id,
        TaskProcessCreate(
            title="Chat Evidence",
            goal="Persist chat messages as Evidence.",
            auto_plan=False,
        ),
    )
    return task.id


async def test_bound_reconnect_creates_two_idempotent_role_distinct_evidence(
    clean_db,
    configured_business,
    monkeypatch,
):
    provider_started = asyncio.Event()
    release_provider = asyncio.Event()
    first_token_seen = asyncio.Event()
    provider_calls = 0

    async def provider(**_kwargs):
        nonlocal provider_calls
        provider_calls += 1
        provider_started.set()
        yield {"choices": [{"delta": {"content": "hello"}}]}
        await release_provider.wait()
        yield {"choices": [{"delta": {"content": " world"}}]}

    monkeypatch.setattr(llm_service, "chat_completion_stream", provider)
    user_id = "user-1"
    task_id = await _create_task(user_id)
    session_id = await chat_persistence.create_session(user_id, "Bound chat")
    request = ChatStreamRequest(
        message="hi",
        taskId=task_id,
        sessionId=session_id,
    )
    initial_events = []

    async def consume_initial():
        async for raw in configured_business.process_chat_stream(request, user_id):
            event = _parse_sse(raw)
            initial_events.append(event)
            if event["event"] == "token":
                first_token_seen.set()

    initial_task = asyncio.create_task(consume_initial())
    await asyncio.wait_for(provider_started.wait(), timeout=1)
    await asyncio.wait_for(first_token_seen.wait(), timeout=1)

    metadata_id = initial_events[0]["id"]
    reconnect_one = asyncio.create_task(
        _collect_stream(
            configured_business.process_chat_stream(request, user_id, metadata_id)
        )
    )
    reconnect_two = asyncio.create_task(
        _collect_stream(
            configured_business.process_chat_stream(request, user_id, metadata_id)
        )
    )
    release_provider.set()

    first_suffix, second_suffix = await asyncio.gather(reconnect_one, reconnect_two)
    await initial_task

    assert provider_calls == 1
    assert first_suffix == second_suffix == initial_events[1:]
    assert [event["event"] for event in initial_events] == [
        "metadata",
        "token",
        "token",
        "usage",
        "done",
    ]

    messages = await clean_db.chat_messages.find(
        {"sessionId": session_id}
    ).sort("timestamp", 1).to_list(length=10)
    evidence = await clean_db.evidence.find(
        {"task_id": task_id, "type": "chat"}
    ).sort("createdAt", 1).to_list(length=10)

    assert len(messages) == 2
    assert len(evidence) == 2
    assert [item["source"] for item in evidence] == [
        "chat:user",
        "chat:assistant",
    ]
    assert [item["source_id"] for item in evidence] == [
        str(messages[0]["_id"]),
        str(messages[1]["_id"]),
    ]
    assert [item["content"] for item in evidence] == ["hi", "hello world"]
    assert all(item["ai_extracted"] is False for item in evidence)
    assert all(item["confidence"] == 1.0 for item in evidence)

    original_evidence_ids = [item["_id"] for item in evidence]
    await configured_business._sync_task_evidence_from_chat(
        user_id=user_id,
        task_id=task_id,
        session_id=session_id,
        role="user",
        message_id=str(messages[0]["_id"]),
        content="hi",
    )
    await configured_business._sync_task_evidence_from_chat(
        user_id=user_id,
        task_id=task_id,
        session_id=session_id,
        role="assistant",
        message_id=str(messages[1]["_id"]),
        content="hello world",
    )

    repeated = await clean_db.evidence.find(
        {"task_id": task_id, "type": "chat"}
    ).sort("createdAt", 1).to_list(length=10)
    assert [item["_id"] for item in repeated] == original_evidence_ids


async def test_unbound_stream_succeeds_without_evidence(
    clean_db,
    configured_business,
    monkeypatch,
):
    provider_calls = 0

    async def provider(**_kwargs):
        nonlocal provider_calls
        provider_calls += 1
        yield {"choices": [{"delta": {"content": "unbound response"}}]}

    monkeypatch.setattr(llm_service, "chat_completion_stream", provider)
    user_id = "user-1"
    session_id = await chat_persistence.create_session(user_id, "Unbound chat")

    events = await _collect_stream(
        configured_business.process_chat_stream(
            ChatStreamRequest(message="hi", sessionId=session_id),
            user_id,
        )
    )

    assert provider_calls == 1
    assert events[-1]["event"] == "done"
    assert await clean_db.chat_messages.count_documents({"sessionId": session_id}) == 2
    assert await clean_db.evidence.count_documents({}) == 0


async def test_oversized_assistant_response_preserves_terminal_sequence_and_truncates_evidence(
    clean_db,
    configured_business,
    monkeypatch,
):
    provider_calls = 0
    oversized_response = "a" * 50000 + "z"

    async def provider(**_kwargs):
        nonlocal provider_calls
        provider_calls += 1
        yield {"choices": [{"delta": {"content": oversized_response}}]}

    monkeypatch.setattr(llm_service, "chat_completion_stream", provider)
    user_id = "user-1"
    task_id = await _create_task(user_id)
    session_id = await chat_persistence.create_session(user_id, "Oversized response")
    request = ChatStreamRequest(
        message="hi",
        taskId=task_id,
        sessionId=session_id,
    )

    events = await _collect_stream(
        configured_business.process_chat_stream(request, user_id)
    )

    assert provider_calls == 1
    assert [event["event"] for event in events] == [
        "metadata",
        "token",
        "usage",
        "done",
    ]

    messages = await clean_db.chat_messages.find(
        {"sessionId": session_id}
    ).sort("timestamp", 1).to_list(length=10)
    evidence = await clean_db.evidence.find(
        {"task_id": task_id, "type": "chat"}
    ).sort("createdAt", 1).to_list(length=10)

    assert len(messages) == 2
    assert messages[1]["content"] == oversized_response
    assert len(evidence) == 2
    assert evidence[1]["source"] == "chat:assistant"
    assert evidence[1]["source_id"] == str(messages[1]["_id"])
    assert evidence[1]["content"] == oversized_response[:50000]
    assert len(evidence[1]["content"]) == 50000

    original_evidence_ids = [item["_id"] for item in evidence]
    await configured_business._sync_task_evidence_from_chat(
        user_id=user_id,
        task_id=task_id,
        session_id=session_id,
        role="assistant",
        message_id=str(messages[1]["_id"]),
        content=oversized_response,
    )

    repeated = await clean_db.evidence.find(
        {"task_id": task_id, "type": "chat"}
    ).sort("createdAt", 1).to_list(length=10)
    assert [item["_id"] for item in repeated] == original_evidence_ids
    assert repeated[1]["content"] == oversized_response[:50000]


async def test_unauthorized_task_binding_preserves_business_error(
    clean_db,
    configured_business,
):
    task_id = await _create_task("task-owner")

    with pytest.raises(ValueError, match="任务不存在"):
        await configured_business._sync_task_evidence_from_chat(
            user_id="other-user",
            task_id=task_id,
            session_id="persisted-session-id",
            role="user",
            message_id="persisted-message-id",
            content="Do not attach this message.",
        )

    assert await clean_db.evidence.count_documents({}) == 0
