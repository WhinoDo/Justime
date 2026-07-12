import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.business.chat_business import ChatBusiness
from app.business.chat_persistence import chat_persistence
from app.business.chat_router import chat_router
from app.core.redis_client import RedisClient
from app.models.chat import ChatStreamRequest
from app.services.llm_service import llm_service
from app.services.sse_stream_service import SSEStreamContext, SSEStreamService
from app.services.user_service import UserService
from tests.services.test_sse_stream_service import InMemoryRedis

pytestmark = pytest.mark.asyncio


def parse_sse(raw: str):
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


async def collect_stream(generator):
    return [parse_sse(item) async for item in generator]


@pytest.fixture
def fake_redis(monkeypatch):
    fake = InMemoryRedis()
    monkeypatch.setattr(RedisClient, "_client", fake)
    monkeypatch.setattr(RedisClient, "_enabled", True)
    monkeypatch.setattr(RedisClient, "_initialized", True)
    return fake


@pytest.fixture
def configured_business(monkeypatch, fake_redis):
    business = ChatBusiness()
    business.save_message = AsyncMock(side_effect=["user-db-id", "assistant-db-id"])
    business._sync_task_evidence_from_chat = AsyncMock()
    business._record_usage_event = AsyncMock()
    business._get_user_llm_config = AsyncMock(return_value={})

    monkeypatch.setattr(
        UserService,
        "get_available_models_for_user",
        AsyncMock(return_value=[{"config_id": "cfg-1", "model_id": "model-1", "is_active": True}]),
    )
    monkeypatch.setattr(UserService, "get_user_active_model_id", AsyncMock(return_value="cfg-1"))
    monkeypatch.setattr(chat_router, "build_runtime_model_candidates", lambda *_: [
        {"config_id": "cfg-1", "config_name": "Primary", "model_id": "model-1", "is_active": True}
    ])
    monkeypatch.setattr(
        chat_router,
        "runtime_to_llm_config",
        lambda *_args, **_kwargs: SimpleNamespace(
            model_id="model-1",
            api_key="test-key",
            api_base="https://llm.invalid/v1",
        ),
    )
    monkeypatch.setattr(chat_persistence, "build_recent_context", AsyncMock(return_value=""))
    monkeypatch.setattr(
        SSEStreamService,
        "_session_belongs_to_user",
        staticmethod(AsyncMock(return_value=True)),
    )
    return business


async def test_active_reconnects_share_one_provider_and_receive_identical_suffix(
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
        yield {"usage": {"prompt_tokens": 2, "completion_tokens": 2, "total_tokens": 4}}

    monkeypatch.setattr(llm_service, "chat_completion_stream", provider)
    request = ChatStreamRequest(message="hi", sessionId="sess_owner")
    initial_events = []

    async def consume_initial():
        async for raw in configured_business.process_chat_stream(request, "user-1"):
            event = parse_sse(raw)
            initial_events.append(event)
            if event["event"] == "token":
                first_token_seen.set()

    initial_task = asyncio.create_task(consume_initial())
    await asyncio.wait_for(provider_started.wait(), timeout=1)
    await asyncio.wait_for(first_token_seen.wait(), timeout=1)

    metadata_id = initial_events[0]["id"]
    reconnect_one = asyncio.create_task(
        collect_stream(configured_business.process_chat_stream(request, "user-1", metadata_id))
    )
    reconnect_two = asyncio.create_task(
        collect_stream(configured_business.process_chat_stream(request, "user-1", metadata_id))
    )
    release_provider.set()

    first_suffix, second_suffix = await asyncio.gather(reconnect_one, reconnect_two)
    await initial_task

    assert provider_calls == 1
    assert [event["event"] for event in initial_events] == [
        "metadata", "token", "token", "usage", "done"
    ]
    assert [event["id"] for event in initial_events] == [
        f"{metadata_id.rsplit(':', 1)[0]}:{sequence}" for sequence in range(1, 6)
    ]
    expected_suffix = initial_events[1:]
    assert first_suffix == expected_suffix
    assert second_suffix == expected_suffix
    assert first_suffix[-1]["event"] == "done"
    assert [event["data"].get("content") for event in first_suffix if event["event"] == "token"] == [
        "hello", " world"
    ]


async def test_completed_resume_replays_through_done_without_provider(
    configured_business,
    monkeypatch,
):
    provider_calls = 0

    async def provider(**_kwargs):
        nonlocal provider_calls
        provider_calls += 1
        yield {"choices": [{"delta": {"content": "one"}}]}
        yield {"choices": [{"delta": {"content": "two"}}]}

    monkeypatch.setattr(llm_service, "chat_completion_stream", provider)
    request = ChatStreamRequest(message="hi", sessionId="sess_owner")
    initial = await collect_stream(configured_business.process_chat_stream(request, "user-1"))
    calls_after_completion = provider_calls

    resumed = await collect_stream(
        configured_business.process_chat_stream(request, "user-1", initial[1]["id"])
    )

    assert calls_after_completion == 1
    assert provider_calls == calls_after_completion
    assert resumed == initial[2:]
    assert resumed[-1]["event"] == "done"


@pytest.mark.parametrize(
    ("last_event_id", "expected_code"),
    [
        ("malformed", "invalid_last_event_id"),
        ("missing_stream:1", "stream_expired"),
    ],
)
async def test_invalid_resume_returns_explicit_error_without_provider(
    configured_business,
    monkeypatch,
    last_event_id,
    expected_code,
):
    provider = AsyncMock()
    monkeypatch.setattr(llm_service, "chat_completion_stream", provider)

    events = await collect_stream(
        configured_business.process_chat_stream(
            ChatStreamRequest(message="hi", sessionId="sess_owner"),
            "user-1",
            last_event_id,
        )
    )

    assert events == [{
        "event": "error",
        "id": None,
        "data": {
            "code": expected_code,
            "message": ChatBusiness._stream_error_payload(expected_code)["message"],
            "canResume": False,
        },
    }]
    provider.assert_not_called()


async def test_foreign_resume_returns_explicit_error_without_provider(
    configured_business,
    monkeypatch,
):
    provider = AsyncMock()
    monkeypatch.setattr(llm_service, "chat_completion_stream", provider)
    context = SSEStreamContext(
        stream_id="foreign_stream",
        session_id="sess_owner",
        message_id="foreign_stream",
        user_id="other-user",
    )
    await SSEStreamService.create_stream(context)
    await SSEStreamService.append_event("foreign_stream", "metadata", {})

    events = await collect_stream(
        configured_business.process_chat_stream(
            ChatStreamRequest(message="hi", sessionId="sess_owner"),
            "user-1",
            "foreign_stream:1",
        )
    )

    assert events[0]["event"] == "error"
    assert events[0]["data"]["code"] == "foreign_stream"
    provider.assert_not_called()


async def test_resume_redis_outage_returns_storage_error_without_provider(
    configured_business,
    fake_redis,
    monkeypatch,
):
    provider = AsyncMock()
    monkeypatch.setattr(llm_service, "chat_completion_stream", provider)
    monkeypatch.setattr(fake_redis, "get", AsyncMock(side_effect=ConnectionError("redis down")))

    events = await collect_stream(
        configured_business.process_chat_stream(
            ChatStreamRequest(message="hi", sessionId="sess_owner"),
            "user-1",
            "stream_1:1",
        )
    )

    assert events[0]["event"] == "error"
    assert events[0]["data"]["code"] == "stream_storage_unavailable"
    provider.assert_not_called()


async def test_producer_lease_redis_outage_returns_storage_error_without_provider(
    configured_business,
    fake_redis,
    monkeypatch,
):
    provider = AsyncMock()
    monkeypatch.setattr(llm_service, "chat_completion_stream", provider)
    original_set = fake_redis.set

    async def fail_producer_lease(key, *args, **kwargs):
        if key.startswith("sse:producer:"):
            raise ConnectionError("redis down")
        return await original_set(key, *args, **kwargs)

    monkeypatch.setattr(fake_redis, "set", fail_producer_lease)

    events = await collect_stream(
        configured_business.process_chat_stream(
            ChatStreamRequest(message="hi", sessionId="sess_owner"),
            "user-1",
        )
    )

    assert events[0]["event"] == "error"
    assert events[0]["data"]["code"] == "stream_storage_unavailable"
    provider.assert_not_called()
