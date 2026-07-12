"""Redis-backed SSE event log and producer single-flight coordination."""

import asyncio
import json
import logging
import re
import secrets
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, List, Optional

from app.core.redis_client import RedisClient
from app.database import db

logger = logging.getLogger(__name__)

SSE_STREAM_KEY_PREFIX = "sse:stream:"
SSE_PRODUCER_KEY_PREFIX = "sse:producer:"
SSE_STREAM_TTL = 300
SSE_PRODUCER_LEASE_TTL = 15
SSE_PRODUCER_HEARTBEAT_INTERVAL = 5.0
SSE_SUBSCRIBER_POLL_INTERVAL = 0.05

_STREAM_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")
_SEQUENCE_PATTERN = re.compile(r"^(?:0|[1-9][0-9]*)$")

_APPEND_EVENT_LUA = """
local key = KEYS[1]
local raw = redis.call('GET', key)
if not raw then
    return '__MISSING__'
end

local stream = cjson.decode(raw)
if stream['status'] == 'completed' or stream['status'] == 'error' then
    return '__TERMINAL__'
end

local seq = tonumber(stream['last_seq'] or 0) + 1
local event_id = stream['stream_id'] .. ':' .. tostring(seq)
local event_data = cjson.decode(ARGV[2])
local record = {
    seq = seq,
    id = event_id,
    event = ARGV[1],
    data = event_data
}

stream['events'][#stream['events'] + 1] = record
stream['last_seq'] = seq
stream['updated_at'] = ARGV[3]

if ARGV[1] == 'token' and type(event_data) == 'table' and event_data['content'] then
    stream['accumulated_content'] = (stream['accumulated_content'] or '') .. event_data['content']
end

if ARGV[1] == 'done' then
    stream['status'] = 'completed'
elseif ARGV[1] == 'error' then
    stream['status'] = 'error'
end

redis.call('SET', key, cjson.encode(stream), 'EX', tonumber(ARGV[4]))
return cjson.encode(record)
"""

_HEARTBEAT_LEASE_LUA = """
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
    return 0
end
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
if redis.call('EXISTS', KEYS[2]) == 1 then
    redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3]))
end
return 1
"""

_RELEASE_LEASE_LUA = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
end
return 0
"""


class SSEStreamError(Exception):
    """Sanitized stream error suitable for an SSE error code."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class SSEEventID:
    """Identity of one persisted event: ``<stream_id>:<sequence>``."""

    stream_id: str
    sequence: int

    def __str__(self) -> str:
        return f"{self.stream_id}:{self.sequence}"

    @classmethod
    def parse(cls, event_id_str: str) -> Optional["SSEEventID"]:
        if not event_id_str or ":" not in event_id_str:
            return None

        stream_id, raw_sequence = event_id_str.rsplit(":", 1)
        if not _STREAM_ID_PATTERN.fullmatch(stream_id):
            return None
        if not _SEQUENCE_PATTERN.fullmatch(raw_sequence):
            return None

        try:
            sequence = int(raw_sequence)
        except ValueError:
            return None
        return cls(stream_id=stream_id, sequence=sequence)


@dataclass(frozen=True)
class SSEEventRecord:
    seq: int
    id: str
    event: str
    data: Dict[str, Any]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SSEEventRecord":
        return cls(
            seq=int(data["seq"]),
            id=str(data["id"]),
            event=str(data["event"]),
            data=dict(data.get("data") or {}),
        )


@dataclass
class SSEStreamContext:
    stream_id: str
    session_id: str
    message_id: str
    user_id: str
    model_id: str = ""
    messages: List[Dict[str, str]] = field(default_factory=list)
    accumulated_content: str = ""
    first_seq: int = 1
    last_seq: int = 0
    status: str = "active"
    events: List[Dict[str, Any]] = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SSEStreamContext":
        if not isinstance(data, dict):
            raise ValueError("stream context must be an object")

        required_fields = ("stream_id", "session_id", "message_id", "user_id")
        for field_name in required_fields:
            if not isinstance(data.get(field_name), str) or not data[field_name]:
                raise ValueError(f"invalid stream context field: {field_name}")

        events = data.get("events", [])
        if not isinstance(events, list):
            raise ValueError("invalid stream event log")

        return cls(
            stream_id=data["stream_id"],
            session_id=data["session_id"],
            message_id=data["message_id"],
            user_id=data["user_id"],
            model_id=str(data.get("model_id") or ""),
            messages=list(data.get("messages") or []),
            accumulated_content=str(data.get("accumulated_content") or ""),
            first_seq=int(data.get("first_seq", 1)),
            last_seq=int(data.get("last_seq", 0)),
            status=str(data.get("status") or "active"),
            events=events,
            created_at=str(data.get("created_at") or ""),
            updated_at=str(data.get("updated_at") or ""),
        )


@dataclass(frozen=True)
class SSEResumeResult:
    context: Optional[SSEStreamContext]
    after_seq: int = 0
    error_code: Optional[str] = None


class SSEStreamService:
    """Append-only SSE storage with exact suffix replay and producer leases."""

    @staticmethod
    def _stream_key(stream_id: str) -> str:
        return f"{SSE_STREAM_KEY_PREFIX}{stream_id}"

    @staticmethod
    def _producer_key(stream_id: str) -> str:
        return f"{SSE_PRODUCER_KEY_PREFIX}{stream_id}"

    @staticmethod
    def parse_last_event_id(last_event_id: str) -> Optional[SSEEventID]:
        return SSEEventID.parse(last_event_id)

    @staticmethod
    def build_event_id(stream_id: str, sequence: int) -> str:
        return str(SSEEventID(stream_id=stream_id, sequence=sequence))

    @staticmethod
    async def create_stream(context: SSEStreamContext) -> bool:
        if not RedisClient.is_enabled():
            return False
        if not _STREAM_ID_PATTERN.fullmatch(context.stream_id):
            raise ValueError("invalid stream id")

        now = datetime.now(timezone.utc).isoformat()
        context.created_at = context.created_at or now
        context.updated_at = now
        payload = json.dumps(context.to_dict(), ensure_ascii=False, default=str)
        return bool(
            await RedisClient.set(
                SSEStreamService._stream_key(context.stream_id),
                payload,
                ex=SSE_STREAM_TTL,
                nx=True,
            )
        )

    @staticmethod
    async def load_stream(stream_id: str) -> Optional[SSEStreamContext]:
        client = RedisClient.get_client()
        if client is None:
            return None

        try:
            raw_data = await client.get(SSEStreamService._stream_key(stream_id))
        except Exception as exc:
            logger.warning("Failed to load SSE stream %s: %s", stream_id, exc)
            raise SSEStreamError("stream_storage_unavailable") from exc

        if raw_data is None:
            return None
        raw_data = SSEStreamService._decode_redis_result(raw_data)
        try:
            data = json.loads(raw_data) if isinstance(raw_data, str) else raw_data
            return SSEStreamContext.from_dict(data)
        except (json.JSONDecodeError, TypeError, ValueError) as exc:
            logger.warning("Invalid SSE stream context for %s: %s", stream_id, exc)
            return None

    @staticmethod
    def _decode_redis_result(value: Any) -> Any:
        return value.decode("utf-8") if isinstance(value, bytes) else value

    @staticmethod
    async def append_event(
        stream_id: str,
        event: str,
        data: Dict[str, Any],
    ) -> SSEEventRecord:
        client = RedisClient.get_client()
        if client is None:
            raise SSEStreamError("stream_storage_unavailable")

        try:
            raw_record = await client.eval(
                _APPEND_EVENT_LUA,
                1,
                SSEStreamService._stream_key(stream_id),
                event,
                json.dumps(data, ensure_ascii=False, default=str),
                datetime.now(timezone.utc).isoformat(),
                str(SSE_STREAM_TTL),
            )
        except Exception as exc:
            logger.warning("Failed to append SSE event for %s: %s", stream_id, exc)
            raise SSEStreamError("stream_storage_unavailable") from exc

        raw_record = SSEStreamService._decode_redis_result(raw_record)
        if raw_record == "__MISSING__":
            raise SSEStreamError("stream_expired")
        if raw_record == "__TERMINAL__":
            raise SSEStreamError("stream_already_terminal")
        return SSEEventRecord.from_dict(json.loads(raw_record))

    @staticmethod
    async def acquire_producer_lease(stream_id: str) -> Optional[str]:
        client = RedisClient.get_client()
        if client is None:
            raise SSEStreamError("stream_storage_unavailable")

        token = secrets.token_hex(16)
        try:
            acquired = await client.set(
                SSEStreamService._producer_key(stream_id),
                token,
                ex=SSE_PRODUCER_LEASE_TTL,
                nx=True,
            )
        except Exception as exc:
            logger.warning("Failed to acquire SSE producer lease for %s: %s", stream_id, exc)
            raise SSEStreamError("stream_storage_unavailable") from exc
        return token if acquired else None

    @staticmethod
    async def heartbeat_producer_lease(stream_id: str, token: str) -> bool:
        client = RedisClient.get_client()
        if client is None:
            return False
        try:
            result = await client.eval(
                _HEARTBEAT_LEASE_LUA,
                2,
                SSEStreamService._producer_key(stream_id),
                SSEStreamService._stream_key(stream_id),
                token,
                str(SSE_PRODUCER_LEASE_TTL),
                str(SSE_STREAM_TTL),
            )
            return int(SSEStreamService._decode_redis_result(result) or 0) == 1
        except Exception as exc:
            logger.warning("Failed to heartbeat SSE producer lease for %s: %s", stream_id, exc)
            return False

    @staticmethod
    async def release_producer_lease(stream_id: str, token: str) -> bool:
        client = RedisClient.get_client()
        if client is None:
            return False
        try:
            result = await client.eval(
                _RELEASE_LEASE_LUA,
                1,
                SSEStreamService._producer_key(stream_id),
                token,
            )
            return int(SSEStreamService._decode_redis_result(result) or 0) == 1
        except Exception as exc:
            logger.warning("Failed to release SSE producer lease for %s: %s", stream_id, exc)
            return False

    @staticmethod
    async def producer_is_active(stream_id: str) -> bool:
        client = RedisClient.get_client()
        if client is None:
            raise SSEStreamError("stream_storage_unavailable")
        try:
            return bool(await client.exists(SSEStreamService._producer_key(stream_id)))
        except Exception as exc:
            logger.warning("Failed to inspect SSE producer lease for %s: %s", stream_id, exc)
            raise SSEStreamError("stream_storage_unavailable") from exc

    @staticmethod
    async def _session_belongs_to_user(session_id: str, user_id: str) -> bool:
        try:
            from bson import ObjectId

            session = await db.db["chat_sessions"].find_one(
                {"_id": ObjectId(session_id), "userId": user_id},
                {"_id": 1},
            )
            return session is not None
        except Exception as exc:
            logger.warning("SSE session ownership verification failed: %s", exc)
            return False

    @staticmethod
    async def validate_resume(
        last_event_id: str,
        user_id: str,
        expected_session_id: Optional[str] = None,
    ) -> SSEResumeResult:
        parsed = SSEEventID.parse(last_event_id)
        if parsed is None:
            return SSEResumeResult(context=None, error_code="invalid_last_event_id")

        if not RedisClient.is_enabled():
            return SSEResumeResult(context=None, error_code="stream_storage_unavailable")

        try:
            context = await SSEStreamService.load_stream(parsed.stream_id)
        except SSEStreamError as exc:
            return SSEResumeResult(context=None, error_code=exc.code)
        if context is None:
            return SSEResumeResult(context=None, error_code="stream_expired")

        if context.user_id != user_id:
            return SSEResumeResult(context=None, error_code="foreign_stream")
        if expected_session_id and context.session_id != expected_session_id:
            return SSEResumeResult(context=None, error_code="foreign_stream")
        if not await SSEStreamService._session_belongs_to_user(context.session_id, user_id):
            return SSEResumeResult(context=None, error_code="foreign_stream")

        if parsed.sequence < context.first_seq - 1:
            return SSEResumeResult(context=None, error_code="event_log_compacted")
        if parsed.sequence > context.last_seq:
            return SSEResumeResult(context=None, error_code="invalid_last_event_id")

        return SSEResumeResult(context=context, after_seq=parsed.sequence)

    @staticmethod
    async def subscribe(
        stream_id: str,
        after_seq: int,
    ) -> AsyncGenerator[SSEEventRecord, None]:
        """Yield only persisted records strictly after ``after_seq``."""

        cursor = after_seq
        missing_lease_checks = 0
        while True:
            if not RedisClient.is_enabled():
                raise SSEStreamError("stream_storage_unavailable")
            context = await SSEStreamService.load_stream(stream_id)
            if context is None:
                raise SSEStreamError("stream_expired")

            records = [
                SSEEventRecord.from_dict(record)
                for record in context.events
                if int(record.get("seq", 0)) > cursor
            ]
            records.sort(key=lambda record: record.seq)
            for record in records:
                if record.seq <= cursor:
                    continue
                cursor = record.seq
                yield record

            if context.status in {"completed", "error"} and cursor >= context.last_seq:
                return

            if not await SSEStreamService.producer_is_active(stream_id):
                missing_lease_checks += 1
                if missing_lease_checks >= 2:
                    try:
                        await SSEStreamService.append_event(
                            stream_id,
                            "error",
                            {
                                "code": "producer_unavailable",
                                "message": "响应生成已中断，请重新发送消息",
                                "canResume": False,
                            },
                        )
                    except SSEStreamError as exc:
                        if exc.code not in {"stream_already_terminal"}:
                            raise
                    missing_lease_checks = 0
            else:
                missing_lease_checks = 0

            await asyncio.sleep(SSE_SUBSCRIBER_POLL_INTERVAL)


sse_stream_service = SSEStreamService()
