import asyncio
import sys

import pytest

from scripts.diagnostics import justime_sse_probe
from scripts.diagnostics.justime_sse_probe import JustimeSSEProbe, iter_sse_records


STREAM_ID = "507f1f77bcf86cd799439011"
SESSION_ID = "507f1f77bcf86cd799439012"
CURRENT_BACKEND_FRAMES = f"""event: metadata
id: {STREAM_ID}:1
data: {{"sessionId":
data: "{SESSION_ID}","messageId":"{STREAM_ID}","resumed":false}}

: heartbeat

event: token
id: {STREAM_ID}:2
data: {{"content":"Hel"}}

event: token
id: {STREAM_ID}:3
data: {{"content":"lo"}}

event: done
id: {STREAM_ID}:4
data: {{"messageId":"assistant-message","totalMs":25,"totalTokens":2}}

"""


async def frame_lines(raw_sse: str = CURRENT_BACKEND_FRAMES):
    for line in raw_sse.splitlines():
        yield line


@pytest.mark.asyncio
async def test_parser_preserves_current_backend_event_blocks():
    records = [record async for record in iter_sse_records(frame_lines())]

    assert records[0].event == "metadata"
    assert records[0].event_id == f"{STREAM_ID}:1"
    assert "\n" in records[0].data
    assert records[1].comment == "heartbeat"
    assert [(record.event, record.event_id) for record in records[2:]] == [
        ("token", f"{STREAM_ID}:2"),
        ("token", f"{STREAM_ID}:3"),
        ("done", f"{STREAM_ID}:4"),
    ]


@pytest.mark.asyncio
async def test_basic_summary_uses_event_and_id_fields():
    probe = JustimeSSEProbe()
    results = probe._stream_results()

    await probe._consume_stream(frame_lines(), results, quiet=True)

    assert results["metadata_events"] == 1
    assert results["tokens_received"] == 2
    assert results["session_id"] == SESSION_ID
    assert results["full_content"] == "Hello"
    assert results["last_event_id"] == f"{STREAM_ID}:4"
    assert results["errors"] == []


@pytest.mark.asyncio
async def test_resume_checkpoint_sets_real_last_event_id_header():
    probe = JustimeSSEProbe()
    results = {
        "first_stream_tokens": 0,
        "first_stream_content": "",
        "errors": [],
    }

    session_id, cursor = await probe._read_resume_checkpoint(
        frame_lines(),
        results,
        interrupt_after_tokens=2,
        quiet=True,
    )
    headers = probe._stream_headers(last_event_id=cursor)

    assert session_id == SESSION_ID
    assert results["first_stream_tokens"] == 2
    assert results["first_stream_content"] == "Hello"
    assert cursor == f"{STREAM_ID}:3"
    assert headers["Last-Event-ID"] == f"{STREAM_ID}:3"
    assert results["errors"] == []


def test_help_does_not_construct_http_client(monkeypatch):
    class NoNetworkClient:
        def __init__(self, *args, **kwargs):
            raise AssertionError("HTTP client constructed during --help")

    monkeypatch.setattr(justime_sse_probe.httpx, "AsyncClient", NoNetworkClient)
    monkeypatch.setattr(sys, "argv", ["justime_sse_probe.py", "--help"])

    with pytest.raises(SystemExit, match="0"):
        asyncio.run(justime_sse_probe.main())
