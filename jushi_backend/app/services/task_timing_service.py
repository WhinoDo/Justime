"""
任务时间调度服务
根据任务类型与难度，动态分配对话时长、触发频率与 Agent 执行参数。
"""

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from app.database import db


class TaskTimingService:
    """任务时间调度服务"""

    RECITATION_KEYWORDS = [
        "背诵", "记忆", "记单词", "默写", "复习", "刷词", "朗读", "巩固", "抄写"
    ]
    THINKING_KEYWORDS = [
        "思考", "分析", "推理", "方案", "设计", "架构", "研究", "论证", "优化", "策略", "计划", "规划",
        "plan", "planning", "research", "analyze", "analysis", "design", "architecture", "strategy", "roadmap"
    ]
    HIGH_URGENCY_KEYWORDS = [
        "马上", "立刻", "紧急", "尽快", "今天", "现在", "deadline", "ddl"
    ]
    LOW_URGENCY_KEYWORDS = [
        "以后", "有空", "慢慢", "长期", "长期规划", "不着急"
    ]

    def _clamp(self, value: int, min_value: int, max_value: int) -> int:
        return max(min_value, min(max_value, value))

    def _build_profile_key(
        self,
        session_id: Optional[str],
        task_id: Optional[str],
        message: str
    ) -> str:
        if task_id:
            return f"task:{task_id}"
        if session_id:
            return f"session:{session_id}"
        raw = message.strip().lower()[:120]
        digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]
        return f"msg:{digest}"

    def _normalize_task_type(self, task_type: Optional[str]) -> Optional[str]:
        if not task_type:
            return None
        value = task_type.strip().lower()
        if value in {"recitation", "memory", "memorization"}:
            return "recitation"
        if value in {"thinking", "analysis", "reasoning", "deep_thinking"}:
            return "thinking"
        if value in {"general", "normal"}:
            return "general"
        return None

    def _infer_task_type(self, message: str, use_web_search: bool) -> str:
        lowered = message.lower()
        if any(kw in message for kw in self.RECITATION_KEYWORDS):
            return "recitation"
        if any(kw in message for kw in self.THINKING_KEYWORDS):
            return "thinking"
        if any(kw in lowered for kw in ["plan", "planning", "research", "analyze", "strategy"]): # Backup for lowered match
             return "thinking"
        if use_web_search and len(lowered) >= 40:
            return "thinking"
        if len(lowered) >= 120:
            return "thinking"
        return "general"

    def _infer_difficulty(self, message: str, task_type: str) -> int:
        text = message.strip()
        score = 3

        if len(text) >= 120:
            score += 1
        if "并且" in text or "同时" in text or "步骤" in text:
            score += 1
        if "简单" in text or "快速" in text:
            score -= 1

        if task_type == "recitation" and ("单词" in text or "公式" in text):
            score = max(score, 2)
        if task_type == "thinking" and ("架构" in text or "方案" in text or "研究" in text):
            score += 1

        return self._clamp(score, 1, 5)

    def _normalize_urgency(self, urgency: Optional[str]) -> Optional[str]:
        if not urgency:
            return None
        value = urgency.strip().lower()
        if value in {"low", "medium", "high"}:
            return value
        return None

    def _infer_urgency(self, message: str) -> str:
        lowered = message.lower()
        if any(kw in lowered for kw in self.HIGH_URGENCY_KEYWORDS):
            return "high"
        if any(kw in lowered for kw in self.LOW_URGENCY_KEYWORDS):
            return "low"
        return "medium"

    def _build_strategy(self, task_type: str, difficulty_level: int, urgency: str) -> Dict[str, int]:
        urgency_boost = {"low": -1, "medium": 0, "high": 1}.get(urgency, 0)

        if task_type == "recitation":
            interaction_duration = self._clamp(
                60 + (difficulty_level - 3) * 12 + urgency_boost * 8,
                30,
                120
            )
            interval_seconds = self._clamp(
                1500 - (difficulty_level - 1) * 210 - urgency_boost * 240,
                300,
                2400
            )
            max_steps = self._clamp(4 + difficulty_level // 2, 4, 8)
            timeout_seconds = self._clamp(120 + difficulty_level * 10 + urgency_boost * 10, 60, 290)
            context_window_messages = self._clamp(4 + difficulty_level // 2, 4, 8)
        elif task_type == "thinking":
            interaction_duration = self._clamp(
                900 + (difficulty_level - 3) * 240 + urgency_boost * 120,
                420,
                2400
            )
            interval_seconds = self._clamp(
                43200 - (difficulty_level - 1) * 4200 - urgency_boost * 3600,
                10800,
                172800
            )
            max_steps = self._clamp(10 + difficulty_level * 2, 10, 22)
            # Increased base timeout for thinking tasks (was 300, now 400) and max clamp (was 600, now 1200)
            # Capped at 290s to avoid 502/504 errors from frontend/gateway (default 300s)
            timeout_seconds = self._clamp(400 + difficulty_level * 40 + urgency_boost * 30, 240, 290)
            context_window_messages = self._clamp(8 + difficulty_level * 2, 8, 18)
        else:
            interaction_duration = self._clamp(
                300 + (difficulty_level - 3) * 60 + urgency_boost * 30,
                120,
                900
            )
            interval_seconds = self._clamp(
                21600 - (difficulty_level - 1) * 1800 - urgency_boost * 2400,
                3600,
                86400
            )
            max_steps = self._clamp(7 + difficulty_level, 7, 14)
            # Increased base timeout for general tasks (was 180, now 240) and max clamp (was 480, now 900)
            # Capped at 290s to avoid frontend timeout
            timeout_seconds = self._clamp(240 + difficulty_level * 30 + urgency_boost * 20, 180, 290)
            context_window_messages = self._clamp(6 + difficulty_level, 6, 12)

        return {
            "interactionDurationSeconds": interaction_duration,
            "intervalSeconds": interval_seconds,
            "maxSteps": max_steps,
            "timeoutSeconds": timeout_seconds,
            "contextWindowMessages": context_window_messages
        }

    async def resolve_strategy(
        self,
        user_id: str,
        message: str,
        session_id: Optional[str] = None,
        task_id: Optional[str] = None,
        use_web_search: bool = False,
        task_type: Optional[str] = None,
        difficulty_level: Optional[int] = None,
        urgency: Optional[str] = None,
        strategy_source: Optional[str] = None,
        analysis_meta: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)

        normalized_task_type = self._normalize_task_type(task_type)
        normalized_urgency = self._normalize_urgency(urgency)

        final_task_type = normalized_task_type or self._infer_task_type(message, use_web_search)
        parsed_difficulty: Optional[int] = None
        if difficulty_level is not None:
            try:
                parsed_difficulty = self._clamp(int(difficulty_level), 1, 5)
            except Exception:
                parsed_difficulty = None
        final_difficulty = parsed_difficulty if parsed_difficulty is not None else self._infer_difficulty(message, final_task_type)
        final_urgency = normalized_urgency or self._infer_urgency(message)

        profile_key = self._build_profile_key(session_id, task_id, message)
        strategy = self._build_strategy(final_task_type, final_difficulty, final_urgency)
        next_suggested_at = now + timedelta(seconds=strategy["intervalSeconds"])

        resolved_strategy_source = strategy_source
        if not resolved_strategy_source:
            resolved_strategy_source = "explicit" if (task_type or difficulty_level is not None or urgency) else "heuristic"

        payload = {
            "profileKey": profile_key,
            "taskType": final_task_type,
            "difficultyLevel": final_difficulty,
            "urgency": final_urgency,
            "nextSuggestedAt": next_suggested_at.isoformat(),
            "strategySource": resolved_strategy_source,
            **strategy
        }
        if analysis_meta:
            payload["analysisMeta"] = analysis_meta

        if db.db is None:
            return payload

        try:
            await db.db["task_timing_profiles"].update_one(
                {"userId": user_id, "profileKey": profile_key},
                {
                    "$set": {
                        "userId": user_id,
                        "sessionId": session_id,
                        "taskId": task_id,
                        "taskType": final_task_type,
                        "difficultyLevel": final_difficulty,
                        "urgency": final_urgency,
                        "strategySource": resolved_strategy_source,
                        "schedule": strategy,
                        "nextSuggestedAt": next_suggested_at,
                        "analysisMeta": analysis_meta,
                        "updatedAt": now
                    },
                    "$setOnInsert": {"createdAt": now},
                    "$inc": {"stats.totalInteractions": 1}
                },
                upsert=True
            )

            await db.db["task_timing_events"].insert_one(
                {
                    "userId": user_id,
                    "profileKey": profile_key,
                    "sessionId": session_id,
                    "taskId": task_id,
                    "eventType": "strategy_resolved",
                    "payload": payload,
                    "createdAt": now
                }
            )
        except Exception as exc:
            print(f"⚠️ 保存任务时间策略失败: {exc}")

        return payload

    async def record_execution(
        self,
        user_id: str,
        profile_key: str,
        duration_ms: int,
        success: bool
    ) -> None:
        if db.db is None:
            return

        now = datetime.now(timezone.utc)
        try:
            await db.db["task_timing_profiles"].update_one(
                {"userId": user_id, "profileKey": profile_key},
                {
                    "$set": {
                        "stats.lastExecutionMs": int(duration_ms),
                        "stats.lastExecutionAt": now,
                        "updatedAt": now
                    },
                    "$inc": {
                        "stats.successCount": 1 if success else 0,
                        "stats.failureCount": 0 if success else 1
                    }
                }
            )

            await db.db["task_timing_events"].insert_one(
                {
                    "userId": user_id,
                    "profileKey": profile_key,
                    "eventType": "execution_recorded",
                    "payload": {
                        "durationMs": int(duration_ms),
                        "success": bool(success)
                    },
                    "createdAt": now
                }
            )
        except Exception as exc:
            print(f"⚠️ 记录任务执行统计失败: {exc}")


task_timing_service = TaskTimingService()
