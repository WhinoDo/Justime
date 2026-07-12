import json
from typing import Any, Dict
from unittest.mock import AsyncMock

import pytest

from app.core.redis_client import RedisClient
from app.services.sse_stream_service import (
    SSEEventID,
    SSEStreamContext,
    SSEStreamError,
    SSEStreamService,
)

pytestmark = pytest.mark.asyncio


class InMemoryRedis:
    def __init__(self) -> None:
        self.values: Dict[str, str] = {}
        self.expirations: Dict[str, int] = {}

    async def get(self, key: str) -> Any:
        return self.values.get(key)

    async def set(
        self,
        key: str,
        value: str,
        ex: int = None,
        px: int = None,
        nx: bool = False,
        xx: bool = False,
    ) -> bool:
        if nx and key in self.values:
            return False
        if xx and key not in self.values:
            return False
        self.values[key] = value
        if ex is not None:
            self.expirations[key] = int(ex)
        return True

    async def delete(self, *keys: str) -> int:
        deleted = 0
        for key in keys:
            if key in self.values:
                deleted += 1
                del self.values[key]
                self.expirations.pop(key, None)
        return deleted

    async def exists(self, *keys: str) -> int:
        return sum(key in self.values for key in keys)

    async def expire(self, key: str, seconds: int) -> bool:
        if key not in self.values:
            return False
        self.expirations[key] = int(seconds)
        return True

    async def eval(self, script: str, numkeys: int, *args: str) -> Any:
        keys = args[:numkeys]
        argv = args[numkeys:]

        if "local event_id" in script:
            key = keys[0]
            raw = self.values.get(key)
            if raw is None:
                return b"__MISSING__"
            stream = json.loads(raw)
            if stream["status"] in {"completed", "error"}:
                return b"__TERMINAL__"

            sequence = int(stream.get("last_seq", 0)) + 1
            data = json.loads(argv[1])
            record = {
                "seq": sequence,
                "id": f"{stream['stream_id']}:{sequence}",
                "event": argv[0],
                "data": data,
            }
            stream["events"].append(record)
            stream["last_seq"] = sequence
            stream["updated_at"] = argv[2]
            if argv[0] == "token":
                stream["accumulated_content"] += data.get("content", "")
            if argv[0] == "done":
                stream["status"] = "completed"
            elif argv[0] == "error":
                stream["status"] = "error"
            self.values[key] = json.dumps(stream)
            self.expirations[key] = int(argv[3])
            return json.dumps(record).encode()

        if "redis.call('EXPIRE', KEYS[1]" in script:
            producer_key, stream_key = keys
            if self.values.get(producer_key) != argv[0]:
                return b"0"
            self.expirations[producer_key] = int(argv[1])
            if stream_key in self.values:
                self.expirations[stream_key] = int(argv[2])
            return b"1"

        if "redis.call('DEL', KEYS[1])" in script:
            key = keys[0]
            if self.values.get(key) != argv[0]:
                return b"0"
            await self.delete(key)
            return b"1"

        raise AssertionError("unexpected Lua script")


@pytest.fixture
def fake_redis(monkeypatch):
    fake = InMemoryRedis()
    monkeypatch.setattr(RedisClient, "_client", fake)
    monkeypatch.setattr(RedisClient, "_enabled", True)
    monkeypatch.setattr(RedisClient, "_initialized", True)
    return fake


def make_context(stream_id: str = "stream_1") -> SSEStreamContext:
    return SSEStreamContext(
        stream_id=stream_id,
        session_id="sess_owner",
        message_id=stream_id,
        user_id="user-1",
        model_id="model-1",
    )


async def test_append_is_atomic_monotonic_and_exact(fake_redis):
    assert await SSEStreamService.create_stream(make_context()) is True

    first = await SSEStreamService.append_event("stream_1", "metadata", {"model": "m"})
    second = await SSEStreamService.append_event("stream_1", "token", {"content": "hello"})
    third = await SSEStreamService.append_event("stream_1", "done", {"status": "ok"})

    assert [first.id, second.id, third.id] == ["stream_1:1", "stream_1:2", "stream_1:3"]
    context = await SSEStreamService.load_stream("stream_1")
    assert context is not None
    assert context.last_seq == 3
    assert context.accumulated_content == "hello"
    assert context.status == "completed"
    assert context.events == [
        {"seq": 1, "id": "stream_1:1", "event": "metadata", "data": {"model": "m"}},
        {"seq": 2, "id": "stream_1:2", "event": "token", "data": {"content": "hello"}},
        {"seq": 3, "id": "stream_1:3", "event": "done", "data": {"status": "ok"}},
    ]

    with pytest.raises(SSEStreamError, match="stream_already_terminal"):
        await SSEStreamService.append_event("stream_1", "token", {"content": "late"})


async def test_completed_subscription_replays_only_exact_suffix(fake_redis):
    await SSEStreamService.create_stream(make_context())
    for event, data in [
        ("metadata", {"n": 1}),
        ("token", {"content": "a"}),
        ("token", {"content": "b"}),
        ("done", {"n": 4}),
    ]:
        await SSEStreamService.append_event("stream_1", event, data)

    records = [record async for record in SSEStreamService.subscribe("stream_1", 2)]
    assert [record.id for record in records] == ["stream_1:3", "stream_1:4"]
    assert [record.event for record in records] == ["token", "done"]
    assert records[0].data == {"content": "b"}


async def test_resume_validation_returns_explicit_codes(fake_redis, monkeypatch):
    monkeypatch.setattr(SSEStreamService, "_session_belongs_to_user", staticmethod(lambda *_: _true()))

    invalid = await SSEStreamService.validate_resume("bad", "user-1")
    assert invalid.error_code == "invalid_last_event_id"

    expired = await SSEStreamService.validate_resume("missing:1", "user-1")
    assert expired.error_code == "stream_expired"

    await SSEStreamService.create_stream(make_context())
    await SSEStreamService.append_event("stream_1", "metadata", {})

    foreign = await SSEStreamService.validate_resume("stream_1:1", "user-2")
    assert foreign.error_code == "foreign_stream"

    context = await SSEStreamService.load_stream("stream_1")
    context.first_seq = 3
    context.last_seq = 3
    context.events = [{"seq": 3, "id": "stream_1:3", "event": "done", "data": {}}]
    context.status = "completed"
    fake_redis.values[SSEStreamService._stream_key("stream_1")] = json.dumps(context.to_dict())
    compacted = await SSEStreamService.validate_resume("stream_1:1", "user-1")
    assert compacted.error_code == "event_log_compacted"

    ahead = await SSEStreamService.validate_resume("stream_1:4", "user-1")
    assert ahead.error_code == "invalid_last_event_id"


@pytest.mark.parametrize("event_id", ["stream:0", "stream:1", "stream:10"])
async def test_event_id_parser_accepts_canonical_sequences(event_id):
    parsed = SSEEventID.parse(event_id)
    assert parsed is not None
    assert str(parsed) == event_id


@pytest.mark.parametrize(
    "event_id",
    [
        "stream:+1",
        "stream:01",
        "stream: 1",
        "stream:\t1",
        "stream:1 ",
        "stream:-0",
        "stream:-1",
        "stream:",
        "stream:not-a-number",
        "missing-separator",
    ],
)
async def test_event_id_parser_rejects_noncanonical_sequences(event_id):
    assert SSEEventID.parse(event_id) is None
    result = await SSEStreamService.validate_resume(event_id, "user-1")
    assert result.error_code == "invalid_last_event_id"


async def test_event_id_parser_rejects_sequence_over_integer_conversion_limit():
    event_id = "stream:" + ("9" * 5000)

    assert SSEEventID.parse(event_id) is None
    result = await SSEStreamService.validate_resume(event_id, "user-1")
    assert result.error_code == "invalid_last_event_id"


@pytest.mark.parametrize("redis_error", [ConnectionError("redis down"), TimeoutError("redis timeout")])
async def test_resume_reports_storage_unavailable_when_redis_get_fails(
    fake_redis,
    monkeypatch,
    redis_error,
):
    monkeypatch.setattr(fake_redis, "get", AsyncMock(side_effect=redis_error))

    result = await SSEStreamService.validate_resume("stream_1:1", "user-1")

    assert result.error_code == "stream_storage_unavailable"


@pytest.mark.parametrize("redis_error", [ConnectionError("redis down"), TimeoutError("redis timeout")])
async def test_producer_lease_reports_storage_unavailable_when_redis_set_fails(
    fake_redis,
    monkeypatch,
    redis_error,
):
    monkeypatch.setattr(fake_redis, "set", AsyncMock(side_effect=redis_error))

    with pytest.raises(SSEStreamError, match="stream_storage_unavailable"):
        await SSEStreamService.acquire_producer_lease("stream_1")


async def _true() -> bool:
    return True


async def test_producer_lease_is_single_flight_and_token_safe(fake_redis):
    await SSEStreamService.create_stream(make_context())

    owner_token = await SSEStreamService.acquire_producer_lease("stream_1")
    assert owner_token
    assert await SSEStreamService.acquire_producer_lease("stream_1") is None
    assert await SSEStreamService.heartbeat_producer_lease("stream_1", owner_token) is True
    assert await SSEStreamService.heartbeat_producer_lease("stream_1", "foreign-token") is False
    assert await SSEStreamService.release_producer_lease("stream_1", "foreign-token") is False
    assert await SSEStreamService.producer_is_active("stream_1") is True
    assert await SSEStreamService.release_producer_lease("stream_1", owner_token) is True
    assert await SSEStreamService.producer_is_active("stream_1") is False
