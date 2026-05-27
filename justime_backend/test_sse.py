#!/usr/bin/env python3
"""
SSE Endpoint Test Script

Tests the SSE streaming endpoint for:
1. Connection establishment
2. Token streaming
3. Heartbeat detection
4. Timeout handling
5. Last-Event-ID resume support
"""

import asyncio
import json
import time
import argparse
from datetime import datetime
from typing import Optional
import httpx


class SSETestClient:
    """SSE test client for validating streaming endpoint."""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip("/")
        self.timeout = 300.0  # 5 minutes for streaming
        self.heartbeat_interval = 15.0  # Expected heartbeat interval
        self.last_heartbeat: Optional[float] = None
        self.token_count = 0
        self.last_event_id: Optional[str] = None
        self.events_received = []

    async def test_health(self) -> bool:
        """Test basic health endpoint."""
        print("\n🔍 Testing health endpoint...")
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{self.base_url}/api/v1/health")
                if resp.status_code == 200:
                    print("✅ Health check passed")
                    return True
                print(f"❌ Health check failed: {resp.status_code}")
                return False
        except Exception as e:
            print(f"❌ Health check error: {e}")
            return False

    async def test_sse_stream(
        self,
        message: str = "你好，请介绍一下自己",
        session_id: Optional[str] = None,
        last_event_id: Optional[str] = None,
        token: Optional[str] = None,
    ) -> dict:
        """
        Test SSE streaming endpoint.

        Returns:
            dict with test results including:
            - tokens_received: int
            - heartbeats_received: int
            - errors: list
            - duration_ms: int
            - last_event_id: str
        """
        print(f"\n🚀 Starting SSE stream test...")
        print(f"   Message: {message[:50]}...")
        print(f"   Session ID: {session_id or 'auto-create'}")
        if last_event_id:
            print(f"   Resume from: {last_event_id}")

        results = {
            "tokens_received": 0,
            "heartbeats_received": 0,
            "metadata_events": 0,
            "usage_events": 0,
            "errors": [],
            "duration_ms": 0,
            "last_event_id": None,
            "full_content": "",
        }

        start_time = time.time()
        self.last_heartbeat = time.time()

        headers = {
            "Accept": "text/event-stream",
            "Cache-Control": "no-cache",
        }

        if token:
            headers["Authorization"] = f"Bearer {token}"

        if last_event_id:
            headers["Last-Event-ID"] = last_event_id

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

                    async for line in response.aiter_lines():
                        line = line.strip()

                        if not line:
                            continue

                        # Handle SSE comments (heartbeats)
                        if line.startswith(":"):
                            if "heartbeat" in line:
                                results["heartbeats_received"] += 1
                                heartbeat_ts = time.time()
                                interval = heartbeat_ts - self.last_heartbeat if self.last_heartbeat else 0
                                self.last_heartbeat = heartbeat_ts
                                ts_str = line.split()[-1] if len(line.split()) > 1 else ""
                                print(f"   💓 [Heartbeat] {line} (interval: {interval:.1f}s)")
                            continue

                        # Handle SSE data lines
                        if line.startswith("data:"):
                            data_str = line[5:].strip()
                            if not data_str:
                                continue

                            try:
                                event = json.loads(data_str)
                                event_type = event.get("type", "unknown")

                                if event_type == "token":
                                    results["tokens_received"] += 1
                                    token_content = event.get("content", "")
                                    results["full_content"] += token_content
                                    print(f"   📝 [Token #{results['tokens_received']}] {token_content}")

                                elif event_type == "metadata":
                                    results["metadata_events"] += 1
                                    print(f"   📋 [Metadata] {json.dumps(event.get('data', {}), ensure_ascii=False)[:100]}...")

                                elif event_type == "usage":
                                    results["usage_events"] += 1
                                    usage = event.get("data", {})
                                    print(f"   📊 [Usage] prompt={usage.get('promptTokens', 0)}, completion={usage.get('completionTokens', 0)}")

                                elif event_type == "done":
                                    results["last_event_id"] = event.get("eventId")
                                    print(f"   ✅ [Done] Stream completed")

                                elif event_type == "error":
                                    error_msg = event.get("message", "Unknown error")
                                    results["errors"].append(error_msg)
                                    print(f"   ❌ [Error] {error_msg}")

                                elif event_type == "stream_completed":
                                    # Custom event type for stream completion marker
                                    print(f"   🏁 [Stream Completed] {line}")

                                else:
                                    print(f"   ❓ [Unknown: {event_type}] {data_str[:50]}...")

                                self.events_received.append(event)

                            except json.JSONDecodeError as e:
                                results["errors"].append(f"JSON parse error: {e}")
                                print(f"   ⚠️  [Parse Error] {data_str[:50]}...")

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

    async def test_heartbeat_reliability(self, duration_seconds: int = 60) -> dict:
        """
        Test heartbeat reliability over extended period.

        This test validates that heartbeats are sent at expected intervals
        and helps identify connection stability issues.
        """
        print(f"\n💓 Testing heartbeat reliability for {duration_seconds}s...")

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
                    headers={"Accept": "text/event-stream"},
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

    async def test_resume_logic(
        self,
        message: str = "请写一个关于人工智能的长篇文章",
        interrupt_after_tokens: int = 50,
    ) -> dict:
        """
        Test Last-Event-ID resume functionality.

        This simulates:
        1. Starting a stream
        2. Interrupting after N tokens
        3. Reconnecting with Last-Event-ID
        4. Verifying content continuity
        """
        print(f"\n🔄 Testing resume logic...")
        print(f"   Will interrupt after {interrupt_after_tokens} tokens")

        results = {
            "first_stream_tokens": 0,
            "first_stream_content": "",
            "resume_stream_tokens": 0,
            "resume_stream_content": "",
            "content_gaps": [],
            "success": False,
            "errors": [],
        }

        session_id = None
        last_event_id = None

        # First stream - partial
        print("\n📡 First stream (partial)...")
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/v1/chat/stream",
                    json={"message": message},
                    headers={"Accept": "text/event-stream"},
                ) as response:
                    if response.status_code != 200:
                        results["errors"].append(f"First stream failed: {response.status_code}")
                        return results

                    async for line in response.aiter_lines():
                        line = line.strip()

                        if line.startswith("data:"):
                            data_str = line[5:].strip()
                            try:
                                event = json.loads(data_str)
                                if event.get("type") == "token":
                                    results["first_stream_tokens"] += 1
                                    results["first_stream_content"] += event.get("content", "")

                                    # Capture session_id from first token event
                                    if not session_id:
                                        session_id = event.get("sessionId")

                                    # Simulate interrupt
                                    if results["first_stream_tokens"] >= interrupt_after_tokens:
                                        last_event_id = event.get("eventId") or f"token-{results['first_stream_tokens']}"
                                        print(f"   ⏸️ Interrupting at token #{interrupt_after_tokens}")
                                        break
                            except json.JSONDecodeError:
                                pass

        except Exception as e:
            results["errors"].append(f"First stream error: {e}")
            return results

        # Wait a moment before resume
        print("   ⏳ Waiting 2 seconds before resume...")
        await asyncio.sleep(2)

        # Second stream - resume
        print("\n📡 Second stream (resume)...")
        if not session_id:
            results["errors"].append("No session_id from first stream")
            return results

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/v1/chat/stream",
                    json={
                        "message": message,
                        "sessionId": session_id,
                    },
                    headers={
                        "Accept": "text/event-stream",
                        "Last-Event-ID": last_event_id,
                    },
                ) as response:
                    if response.status_code != 200:
                        results["errors"].append(f"Resume stream failed: {response.status_code}")
                        return results

                    async for line in response.aiter_lines():
                        line = line.strip()

                        if line.startswith("data:"):
                            data_str = line[5:].strip()
                            try:
                                event = json.loads(data_str)
                                if event.get("type") == "token":
                                    results["resume_stream_tokens"] += 1
                                    results["resume_stream_content"] += event.get("content", "")
                                elif event.get("type") == "done":
                                    break
                            except json.JSONDecodeError:
                                pass

        except Exception as e:
            results["errors"].append(f"Resume stream error: {e}")
            return results

        # Check content continuity
        total_content = results["first_stream_content"] + results["resume_stream_content"]
        print(f"\n📊 Results:")
        print(f"   First stream: {results['first_stream_tokens']} tokens")
        print(f"   Resume stream: {results['resume_stream_tokens']} tokens")
        print(f"   Total content length: {len(total_content)} chars")

        # Check for obvious gaps (simplified check)
        if len(results["resume_stream_content"]) > 0:
            results["success"] = True
            print("   ✅ Resume test passed!")
        else:
            results["errors"].append("No content received after resume")
            print("   ❌ Resume test failed!")

        return results


def print_summary(results: dict):
    """Print test summary."""
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
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
    parser = argparse.ArgumentParser(description="SSE Endpoint Test Script")
    parser.add_argument(
        "--url",
        default="http://localhost:8000",
        help="Base URL for API (default: http://localhost:8000)",
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
        help="Test type: basic, heartbeat, resume, all (default: basic)",
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=60,
        help="Duration for heartbeat test in seconds (default: 60)",
    )
    parser.add_argument(
        "--token",
        help="Authorization token (optional)",
    )

    args = parser.parse_args()

    client = SSETestClient(base_url=args.url)

    print("=" * 60)
    print("🧪 SSE ENDPOINT TEST SUITE")
    print("=" * 60)
    print(f"Target: {args.url}")
    print(f"Test: {args.test}")
    print(f"Time: {datetime.now().isoformat()}")

    # Health check first
    if not await client.test_health():
        print("\n⚠️ Server not responding. Make sure backend is running.")
        return

    if args.test == "basic":
        results = await client.test_sse_stream(
            message=args.message,
            token=args.token,
        )
        print_summary(results)

    elif args.test == "heartbeat":
        results = await client.test_heartbeat_reliability(
            duration_seconds=args.duration,
        )
        print("\n" + "=" * 60)
        print("💓 HEARTBEAT TEST SUMMARY")
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
        results = await client.test_resume_logic(
            message=args.message,
            interrupt_after_tokens=30,
        )
        print("\n" + "=" * 60)
        print("🔄 RESUME TEST SUMMARY")
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
        print("Running all tests...\n")

        # Basic test
        print("1️⃣ Basic Stream Test")
        basic_results = await client.test_sse_stream(
            message=args.message,
            token=args.token,
        )
        print_summary(basic_results)

        # Heartbeat test
        print("\n2️⃣ Heartbeat Reliability Test")
        heartbeat_results = await client.test_heartbeat_reliability(
            duration_seconds=min(args.duration, 30),  # Limit to 30s for all test
        )

        # Resume test
        print("\n3️⃣ Resume Logic Test")
        resume_results = await client.test_resume_logic(
            message=args.message,
            interrupt_after_tokens=20,
        )

        # Overall summary
        print("\n" + "=" * 60)
        print("📊 OVERALL TEST SUMMARY")
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
