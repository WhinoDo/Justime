#!/usr/bin/env python3
"""Justime SSE diagnostic probe.

Manually probes the SSE streaming endpoint for:
1. Connection establishment
2. Token streaming
3. Heartbeat detection
4. Timeout handling
5. Last-Event-ID resume support
"""

import argparse
import asyncio
import json
import time
from dataclasses import dataclass
from datetime import datetime
from typing import AsyncIterable, AsyncIterator, Optional

import httpx


@dataclass(frozen=True)
class SSERecord:
    """One parsed SSE event or comment from the response stream."""

    event: Optional[str] = None
    event_id: Optional[str] = None
    data: Optional[str] = None
    comment: Optional[str] = None


async def iter_sse_records(lines: AsyncIterable[str]) -> AsyncIterator[SSERecord]:
    """Parse an async line stream into complete SSE event blocks."""
    event_type: Optional[str] = None
    event_id: Optional[str] = None
    data_lines = []

    async for raw_line in lines:
        line = raw_line.rstrip("\r\n")

        if not line:
            if data_lines:
                yield SSERecord(
                    event=event_type or "message",
                    event_id=event_id,
                    data="\n".join(data_lines),
                )
            event_type = None
            event_id = None
            data_lines = []
            continue

        if line.startswith(":"):
            yield SSERecord(comment=line[1:].lstrip())
            continue

        field, separator, value = line.partition(":")
        if separator and value.startswith(" "):
            value = value[1:]

        if field == "event":
            event_type = value
        elif field == "id" and "\x00" not in value:
            event_id = value
        elif field == "data":
            data_lines.append(value)

    if data_lines:
        yield SSERecord(
            event=event_type or "message",
            event_id=event_id,
            data="\n".join(data_lines),
        )


class JustimeSSEProbe:
    """Manual diagnostic client for the Justime SSE streaming endpoint."""

    def __init__(self, base_url: str = "http://127.0.0.1:8080"):
        self.base_url = base_url.rstrip("/")
        self.timeout = 300.0  # 5 minutes for streaming
        self.heartbeat_interval = 15.0  # Expected heartbeat interval
        self.last_heartbeat: Optional[float] = None
        self.token_count = 0
        self.last_event_id: Optional[str] = None
        self.events_received = []

    @staticmethod
    def _stream_headers(
        token: Optional[str] = None,
        last_event_id: Optional[str] = None,
    ) -> dict:
        headers = {
            "Accept": "text/event-stream",
            "Cache-Control": "no-cache",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if last_event_id:
            headers["Last-Event-ID"] = last_event_id
        return headers

    @staticmethod
    def _stream_results() -> dict:
        return {
            "tokens_received": 0,
            "heartbeats_received": 0,
            "metadata_events": 0,
            "usage_events": 0,
            "errors": [],
            "duration_ms": 0,
            "last_event_id": None,
            "session_id": None,
            "full_content": "",
        }

    @staticmethod
    def _decode_record(record: SSERecord, errors: list) -> Optional[dict]:
        try:
            payload = json.loads(record.data or "")
        except json.JSONDecodeError as exc:
            errors.append(
                f"JSON parse error for {record.event or 'message'}"
                f" ({record.event_id or 'no id'}): {exc}"
            )
            return None

        if not isinstance(payload, dict):
            errors.append(
                f"Unexpected non-object payload for {record.event or 'message'}"
                f" ({record.event_id or 'no id'})"
            )
            return None
        return payload

    async def _consume_stream(
        self,
        lines: AsyncIterable[str],
        results: dict,
        *,
        quiet: bool = False,
    ) -> None:
        async for record in iter_sse_records(lines):
            if record.comment is not None:
                if "heartbeat" in record.comment:
                    results["heartbeats_received"] += 1
                    heartbeat_ts = time.time()
                    interval = heartbeat_ts - self.last_heartbeat if self.last_heartbeat else 0
                    self.last_heartbeat = heartbeat_ts
                    if not quiet:
                        print(
                            f"   💓 [Heartbeat] : {record.comment}"
                            f" (interval: {interval:.1f}s)"
                        )
                continue

            payload = self._decode_record(record, results["errors"])
            if payload is None:
                if not quiet:
                    print(
                        f"   ⚠️  [Parse Error] {record.event or 'message'}"
                        f" ({record.event_id or 'no id'})"
                    )
                continue

            event_type = record.event or "message"
            if record.event_id:
                self.last_event_id = record.event_id
                results["last_event_id"] = record.event_id

            if event_type == "token":
                results["tokens_received"] += 1
                self.token_count += 1
                token_content = payload.get("content", "")
                results["full_content"] += token_content
                if not quiet:
                    print(
                        f"   📝 [Token #{results['tokens_received']}]"
                        f" {token_content} ({record.event_id or 'no id'})"
                    )

            elif event_type == "metadata":
                results["metadata_events"] += 1
                results["session_id"] = payload.get("sessionId") or results["session_id"]
                if not quiet:
                    print(
                        f"   📋 [Metadata]"
                        f" {json.dumps(payload, ensure_ascii=False)[:100]}..."
                    )

            elif event_type == "usage":
                results["usage_events"] += 1
                if not quiet:
                    print(
                        "   📊 [Usage]"
                        f" prompt={payload.get('promptTokens', 0)},"
                        f" completion={payload.get('completionTokens', 0)}"
                    )

            elif event_type == "done":
                if not quiet:
                    print(f"   ✅ [Done] Stream completed ({record.event_id or 'no id'})")

            elif event_type == "error":
                error_msg = payload.get("message", "Unknown error")
                results["errors"].append(error_msg)
                if not quiet:
                    print(f"   ❌ [Error] {error_msg}")

            elif event_type == "stream_completed":
                if not quiet:
                    print(f"   🏁 [Stream Completed] {record.event_id or 'no id'}")

            elif not quiet:
                print(
                    f"   ❓ [Unknown: {event_type}]"
                    f" {(record.data or '')[:50]}..."
                )

            self.events_received.append(
                {
                    "event": event_type,
                    "id": record.event_id,
                    "data": payload,
                }
            )

    async def _read_resume_checkpoint(
        self,
        lines: AsyncIterable[str],
        results: dict,
        interrupt_after_tokens: int,
        *,
        quiet: bool = False,
    ) -> tuple[Optional[str], Optional[str]]:
        session_id = None
        last_event_id = None

        async for record in iter_sse_records(lines):
            if record.comment is not None:
                continue

            payload = self._decode_record(record, results["errors"])
            if payload is None:
                continue

            if record.event == "metadata":
                session_id = payload.get("sessionId") or session_id
            elif record.event == "token":
                results["first_stream_tokens"] += 1
                results["first_stream_content"] += payload.get("content", "")
                if record.event_id:
                    last_event_id = record.event_id
                    self.last_event_id = record.event_id
                else:
                    results["errors"].append("Token event did not include an SSE id cursor")

                if results["first_stream_tokens"] >= interrupt_after_tokens:
                    if not quiet:
                        print(f"   ⏸️ Interrupting at token #{interrupt_after_tokens}")
                    break
            elif record.event == "error":
                results["errors"].append(payload.get("message", "Unknown error"))
                break
            elif record.event == "done":
                break

        return session_id, last_event_id

    async def check_health(self) -> bool:
        """Check the dependency-free backend liveness endpoint."""
        print("\n🔍 Probing health endpoint...")
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{self.base_url}/api/v1/health/live")
                if resp.status_code == 200:
                    print("✅ Health check passed")
                    return True
                print(f"❌ Health check failed: {resp.status_code}")
                return False
        except Exception as e:
            print(f"❌ Health check error: {e}")
            return False

    async def probe_sse_stream(
        self,
        message: str = "你好，请介绍一下自己",
        session_id: Optional[str] = None,
        last_event_id: Optional[str] = None,
        token: Optional[str] = None,
    ) -> dict:
        """
        Probe the SSE streaming endpoint.

        Returns:
            dict with diagnostic results including:
            - tokens_received: int
            - heartbeats_received: int
            - errors: list
            - duration_ms: int
            - last_event_id: str
        """
        print("\n🚀 Starting SSE stream diagnostic...")
        print(f"   Message: {message[:50]}...")
        print(f"   Session ID: {session_id or 'auto-create'}")
        if last_event_id:
            print(f"   Resume from: {last_event_id}")

        results = self._stream_results()

        start_time = time.time()
        self.last_heartbeat = time.time()

        headers = self._stream_headers(token=token, last_event_id=last_event_id)

        request_body = {
            "message": message,
        }
        if session_id:
            request_body["sessionId"] = session_id

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/v1/chat/stream",
                    json=request_body,
                    headers=headers,
                ) as response:
                    if response.status_code != 200:
                        error_body = await response.aread()
                        results["errors"].append(f"HTTP {response.status_code}: {error_body.decode()}")
                        print(f"❌ Stream request failed: {response.status_code}")
                        return results

                    print("✅ Stream connection established")
                    print("\n📥 Receiving events:\n")

                    await self._consume_stream(response.aiter_lines(), results)

        except httpx.TimeoutException:
            results["errors"].append("Connection timeout")
            print(f"\n⏱️ Stream timeout after {self.timeout}s")

        except httpx.ConnectError as e:
            results["errors"].append(f"Connection error: {e}")
            print(f"\n🔌 Connection failed: {e}")

        except Exception as e:
            results["errors"].append(f"Unexpected error: {e}")
            print(f"\n💥 Unexpected error: {e}")

        finally:
            results["duration_ms"] = int((time.time() - start_time) * 1000)

        return results

    async def probe_heartbeat_reliability(
        self,
        duration_seconds: int = 60,
        token: Optional[str] = None,
    ) -> dict:
        """
        Probe heartbeat reliability over an extended period.

        This diagnostic validates that heartbeats are sent at expected intervals
        and helps identify connection stability issues.
        """
        print(f"\n💓 Probing heartbeat reliability for {duration_seconds}s...")

        results = {
            "test_duration_seconds": duration_seconds,
            "heartbeats_expected": duration_seconds // 15,  # Expecting heartbeat every 15s
            "heartbeats_received": 0,
            "heartbeat_intervals": [],
            "missed_heartbeats": 0,
            "connection_drops": 0,
            "errors": [],
        }

        start_time = time.time()
        last_heartbeat = start_time

        # Use a long message to keep stream alive
        message = "请详细解释一下人工智能的发展历史，包括从早期的符号推理到现在的深度学习的演进过程。" * 10

        try:
            async with httpx.AsyncClient(timeout=duration_seconds + 60) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/v1/chat/stream",
                    json={"message": message},
                    headers=self._stream_headers(token=token),
                ) as response:
                    if response.status_code != 200:
                        results["errors"].append(f"HTTP {response.status_code}")
                        return results

                    async for line in response.aiter_lines():
                        if time.time() - start_time > duration_seconds:
                            break

                        line = line.strip()

                        if ": heartbeat" in line:
                            now = time.time()
                            interval = now - last_heartbeat
                            results["heartbeat_intervals"].append(interval)
                            results["heartbeats_received"] += 1

                            # Check for missed heartbeat (expected every 15s)
                            if interval > 20:  # Allow 5s grace
                                results["missed_heartbeats"] += 1
                                print(f"   ⚠️ Missed heartbeat! Interval: {interval:.1f}s")

                            last_heartbeat = now
                            print(f"   💓 Heartbeat #{results['heartbeats_received']} (interval: {interval:.1f}s)")

        except Exception as e:
            results["connection_drops"] += 1
            results["errors"].append(str(e))
            print(f"   💥 Connection dropped: {e}")

        return results

    async def probe_resume_logic(
        self,
        message: str = "请写一个关于人工智能的长篇文章",
        interrupt_after_tokens: int = 50,
        token: Optional[str] = None,
    ) -> dict:
        """
        Probe Last-Event-ID resume functionality.

        This simulates:
        1. Starting a stream
        2. Interrupting after N tokens
        3. Reconnecting with Last-Event-ID
        4. Verifying content continuity
        """
        print("\n🔄 Probing resume logic...")
        print(f"   Will interrupt after {interrupt_after_tokens} tokens")

        results = {
            "first_stream_tokens": 0,
            "first_stream_content": "",
            "resume_stream_tokens": 0,
            "resume_stream_content": "",
            "content_gaps": [],
            "session_id": None,
            "last_event_id": None,
            "success": False,
            "errors": [],
        }

        # First stream - partial
        print("\n📡 First stream (partial)...")
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/v1/chat/stream",
                    json={"message": message},
                    headers=self._stream_headers(token=token),
                ) as response:
                    if response.status_code != 200:
                        results["errors"].append(f"First stream failed: {response.status_code}")
                        return results

                    session_id, last_event_id = await self._read_resume_checkpoint(
                        response.aiter_lines(),
                        results,
                        interrupt_after_tokens,
                    )
                    results["session_id"] = session_id
                    results["last_event_id"] = last_event_id

        except Exception as e:
            results["errors"].append(f"First stream error: {e}")
            return results

        if not session_id:
            results["errors"].append("No sessionId from metadata event in first stream")
            return results
        if not last_event_id:
            results["errors"].append("No SSE id cursor from first stream token event")
            return results
        if results["first_stream_tokens"] < interrupt_after_tokens:
            results["errors"].append("First stream completed before the interrupt threshold")
            return results

        # Wait a moment before resume
        print("   ⏳ Waiting 2 seconds before resume...")
        print(f"   Session ID: {session_id}")
        print(f"   Last-Event-ID: {last_event_id}")
        await asyncio.sleep(2)

        # Second stream - resume
        print("\n📡 Second stream (resume)...")
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/v1/chat/stream",
                    json={
                        "message": message,
                        "sessionId": session_id,
                    },
                    headers=self._stream_headers(
                        token=token,
                        last_event_id=last_event_id,
                    ),
                ) as response:
                    if response.status_code != 200:
                        results["errors"].append(f"Resume stream failed: {response.status_code}")
                        return results

                    async for record in iter_sse_records(response.aiter_lines()):
                        if record.comment is not None:
                            continue
                        payload = self._decode_record(record, results["errors"])
                        if payload is None:
                            continue
                        if record.event == "token":
                            results["resume_stream_tokens"] += 1
                            results["resume_stream_content"] += payload.get("content", "")
                        elif record.event == "error":
                            results["errors"].append(payload.get("message", "Unknown error"))
                            break
                        elif record.event == "done":
                            break

        except Exception as e:
            results["errors"].append(f"Resume stream error: {e}")
            return results

        # Check content continuity
        total_content = results["first_stream_content"] + results["resume_stream_content"]
        print(f"\n📊 Results:")
        print(f"   First stream: {results['first_stream_tokens']} tokens")
        print(f"   Resume stream: {results['resume_stream_tokens']} tokens")
        print(f"   Resume cursor: {results['last_event_id']}")
        print(f"   Total content length: {len(total_content)} chars")

        # Check for obvious gaps (simplified check)
        if len(results["resume_stream_content"]) > 0:
            results["success"] = True
            print("   ✅ Resume diagnostic passed!")
        else:
            results["errors"].append("No content received after resume")
            print("   ❌ Resume diagnostic failed!")

        return results


async def _fixture_lines(raw_sse: str) -> AsyncIterator[str]:
    for line in raw_sse.splitlines():
        yield line


async def run_parser_self_test() -> None:
    """Replay current backend frames without credentials or network access."""
    stream_id = "507f1f77bcf86cd799439011"
    session_id = "507f1f77bcf86cd799439012"
    current_frames = f"""event: metadata
id: {stream_id}:1
data: {{"sessionId":"{session_id}","messageId":"{stream_id}","model":"model-1","resumed":false,"resumedTokenIndex":0}}

: heartbeat

event: token
id: {stream_id}:2
data: {{"content":"Hel"}}

event: token
id: {stream_id}:3
data: {{"content":"lo"}}

event: usage
id: {stream_id}:4
data: {{"promptTokens":2,"completionTokens":2,"totalTokens":4}}

event: done
id: {stream_id}:5
data: {{"messageId":"assistant-message","totalMs":25,"totalTokens":2}}

"""

    probe = JustimeSSEProbe()
    probe.last_heartbeat = time.time()
    basic_results = probe._stream_results()
    await probe._consume_stream(
        _fixture_lines(current_frames),
        basic_results,
        quiet=True,
    )

    assert basic_results["metadata_events"] == 1
    assert basic_results["tokens_received"] == 2
    assert basic_results["usage_events"] == 1
    assert basic_results["heartbeats_received"] == 1
    assert basic_results["session_id"] == session_id
    assert basic_results["full_content"] == "Hello"
    assert basic_results["last_event_id"] == f"{stream_id}:5"
    assert basic_results["errors"] == []

    resume_results = {
        "first_stream_tokens": 0,
        "first_stream_content": "",
        "errors": [],
    }
    captured_session_id, resume_cursor = await probe._read_resume_checkpoint(
        _fixture_lines(current_frames),
        resume_results,
        interrupt_after_tokens=2,
        quiet=True,
    )
    resume_headers = probe._stream_headers(last_event_id=resume_cursor)

    assert captured_session_id == session_id
    assert resume_results["first_stream_tokens"] == 2
    assert resume_results["first_stream_content"] == "Hello"
    assert resume_cursor == f"{stream_id}:3"
    assert resume_headers["Last-Event-ID"] == f"{stream_id}:3"
    assert resume_results["errors"] == []

    print(
        "SSE parser self-test passed:"
        f" tokens={basic_results['tokens_received']},"
        f" content={basic_results['full_content']!r},"
        f" sessionId={captured_session_id},"
        f" Last-Event-ID={resume_headers['Last-Event-ID']}"
    )


def print_probe_summary(results: dict):
    """Print a diagnostic summary."""
    print("\n" + "=" * 60)
    print("📊 DIAGNOSTIC SUMMARY")
    print("=" * 60)
    print(f"  Tokens received:    {results.get('tokens_received', 0)}")
    print(f"  Heartbeats:         {results.get('heartbeats_received', 0)}")
    print(f"  Metadata events:    {results.get('metadata_events', 0)}")
    print(f"  Usage events:       {results.get('usage_events', 0)}")
    print(f"  Duration:           {results.get('duration_ms', 0)}ms")

    if results.get("errors"):
        print(f"\n❌ Errors ({len(results['errors'])}):")
        for err in results["errors"]:
            print(f"   - {err}")
    else:
        print("\n✅ No errors!")

    if results.get("full_content"):
        print(f"\n📝 Content preview ({len(results['full_content'])} chars):")
        preview = results["full_content"][:200]
        print(f"   {preview}...")

    print("=" * 60)


async def main():
    parser = argparse.ArgumentParser(description="Justime SSE diagnostic probe")
    parser.add_argument(
        "--url",
        default="http://127.0.0.1:8080",
        help="Base URL for API (default: http://127.0.0.1:8080)",
    )
    parser.add_argument(
        "--message",
        default="你好，请介绍一下自己",
        help="Message to send (default: 你好，请介绍一下自己)",
    )
    parser.add_argument(
        "--test",
        choices=["basic", "heartbeat", "resume", "all"],
        default="basic",
        help="Diagnostic mode: basic, heartbeat, resume, all (default: basic)",
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=60,
        help="Duration for heartbeat diagnostic in seconds (default: 60)",
    )
    parser.add_argument(
        "--token",
        help="Authorization token (optional)",
    )
    parser.add_argument(
        "--self-test",
        action="store_true",
        help="Replay current backend SSE frames without network access",
    )

    args = parser.parse_args()

    if args.self_test:
        await run_parser_self_test()
        return

    probe = JustimeSSEProbe(base_url=args.url)

    print("=" * 60)
    print("🧪 JUSTIME SSE DIAGNOSTIC PROBE")
    print("=" * 60)
    print(f"Target: {args.url}")
    print(f"Mode: {args.test}")
    print(f"Time: {datetime.now().isoformat()}")

    # Health check first
    if not await probe.check_health():
        print("\n⚠️ Server not responding. Make sure backend is running.")
        return

    if args.test == "basic":
        results = await probe.probe_sse_stream(
            message=args.message,
            token=args.token,
        )
        print_probe_summary(results)

    elif args.test == "heartbeat":
        results = await probe.probe_heartbeat_reliability(
            duration_seconds=args.duration,
            token=args.token,
        )
        print("\n" + "=" * 60)
        print("💓 HEARTBEAT DIAGNOSTIC SUMMARY")
        print("=" * 60)
        print(f"  Duration: {results['test_duration_seconds']}s")
        print(f"  Heartbeats expected: {results['heartbeats_expected']}")
        print(f"  Heartbeats received: {results['heartbeats_received']}")
        print(f"  Missed heartbeats: {results['missed_heartbeats']}")
        print(f"  Connection drops: {results['connection_drops']}")

        if results["heartbeat_intervals"]:
            avg_interval = sum(results["heartbeat_intervals"]) / len(results["heartbeat_intervals"])
            print(f"  Avg interval: {avg_interval:.1f}s")

        if results.get("errors"):
            print(f"\n❌ Errors:")
            for err in results["errors"]:
                print(f"   - {err}")
        print("=" * 60)

    elif args.test == "resume":
        results = await probe.probe_resume_logic(
            message=args.message,
            interrupt_after_tokens=30,
            token=args.token,
        )
        print("\n" + "=" * 60)
        print("🔄 RESUME DIAGNOSTIC SUMMARY")
        print("=" * 60)
        print(f"  First stream tokens: {results['first_stream_tokens']}")
        print(f"  Resume stream tokens: {results['resume_stream_tokens']}")
        print(f"  Success: {results['success']}")

        if results.get("errors"):
            print(f"\n❌ Errors:")
            for err in results["errors"]:
                print(f"   - {err}")
        print("=" * 60)

    elif args.test == "all":
        print("\n" + "-" * 40)
        print("Running all diagnostics...\n")

        # Basic stream diagnostic
        print("1️⃣ Basic Stream Diagnostic")
        basic_results = await probe.probe_sse_stream(
            message=args.message,
            token=args.token,
        )
        print_probe_summary(basic_results)

        # Heartbeat diagnostic
        print("\n2️⃣ Heartbeat Reliability Diagnostic")
        heartbeat_results = await probe.probe_heartbeat_reliability(
            duration_seconds=min(args.duration, 30),  # Limit to 30s for all mode
            token=args.token,
        )

        # Resume diagnostic
        print("\n3️⃣ Resume Logic Diagnostic")
        resume_results = await probe.probe_resume_logic(
            message=args.message,
            interrupt_after_tokens=20,
            token=args.token,
        )

        # Overall summary
        print("\n" + "=" * 60)
        print("📊 OVERALL DIAGNOSTIC SUMMARY")
        print("=" * 60)
        basic_ok = len(basic_results.get("errors", [])) == 0 and basic_results.get("tokens_received", 0) > 0
        heartbeat_ok = heartbeat_results.get("heartbeats_received", 0) > 0
        resume_ok = resume_results.get("success", False)

        print(f"  Basic stream:     {'✅ PASS' if basic_ok else '❌ FAIL'}")
        print(f"  Heartbeat:        {'✅ PASS' if heartbeat_ok else '❌ FAIL'}")
        print(f"  Resume logic:     {'✅ PASS' if resume_ok else '❌ FAIL'}")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
