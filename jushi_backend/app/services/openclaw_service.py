"""
OpenClaw 特殊任务服务
通过本机/容器内 openclaw CLI 的 embedded 模式执行显式特殊任务。
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from app.core.config import settings


@dataclass
class OpenClawResult:
    text: str
    payloads: List[Dict[str, Any]]
    raw: Dict[str, Any]


class OpenClawService:
    def is_enabled(self) -> bool:
        return bool(settings.OPENCLAW_ENABLED)

    async def run_special_task(
        self,
        *,
        message: str,
        session_id: str,
        user_id: str,
        task_type: Optional[str] = None,
        use_web_search: bool = False,
    ) -> OpenClawResult:
        if not self.is_enabled():
            raise RuntimeError("OpenClaw 特殊任务链路未启用")

        prompt = self._build_prompt(
            message=message,
            user_id=user_id,
            session_id=session_id,
            task_type=task_type,
            use_web_search=use_web_search,
        )
        command = [
            "openclaw",
            "agent",
            "--local",
            "--json",
            "--session-id",
            self._build_session_id(session_id),
            "--message",
            prompt,
            "--timeout",
            str(max(30, int(settings.OPENCLAW_TIMEOUT_SECONDS))),
        ]

        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        stdout_text = stdout.decode("utf-8", errors="replace").strip()
        stderr_text = stderr.decode("utf-8", errors="replace").strip()

        if process.returncode != 0:
            detail = stderr_text or stdout_text or "unknown openclaw error"
            raise RuntimeError(f"OpenClaw 执行失败: {detail}")

        if not stdout_text:
            raise RuntimeError("OpenClaw 未返回任何内容")

        try:
            payload = json.loads(stdout_text)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"OpenClaw 返回了不可解析的 JSON: {stdout_text[:400]}") from exc

        result = payload.get("result") if isinstance(payload, dict) else None
        payloads = result.get("payloads") if isinstance(result, dict) else None
        if not isinstance(payloads, list):
            payloads = []

        text_parts: List[str] = []
        for item in payloads:
            if not isinstance(item, dict):
                continue
            text = str(item.get("text") or "").strip()
            if text:
                text_parts.append(text)

        summary = str(payload.get("summary") or "").strip() if isinstance(payload, dict) else ""
        final_text = "\n\n".join(text_parts).strip() or summary
        if not final_text:
            raise RuntimeError("OpenClaw 未返回可用文本结果")

        return OpenClawResult(text=final_text, payloads=payloads, raw=payload)

    def _build_session_id(self, session_id: str) -> str:
        safe_session_id = (session_id or "default").strip()
        return f"{settings.OPENCLAW_SESSION_PREFIX}-{safe_session_id}"

    def _build_prompt(
        self,
        *,
        message: str,
        user_id: str,
        session_id: str,
        task_type: Optional[str],
        use_web_search: bool,
    ) -> str:
        prompt_lines = [
            settings.OPENCLAW_EXTRA_SYSTEM_PROMPT.strip(),
            "",
            f"用户ID: {user_id}",
            f"会话ID: {session_id}",
            f"任务类型: {task_type or 'general'}",
            f"允许网页搜索: {'yes' if use_web_search else 'no'}",
            "",
            "请直接完成以下特殊任务，并输出最终结果：",
            message.strip(),
        ]
        return "\n".join(line for line in prompt_lines if line is not None).strip()


openclaw_service = OpenClawService()
