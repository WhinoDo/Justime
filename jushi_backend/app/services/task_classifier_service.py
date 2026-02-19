"""
任务分类服务
使用 LLM 自动分析任务类型、难度和紧急度，并提供置信度与理由。
"""

import json
import re
from typing import Any, Dict, Optional

from app.core.config import LLMConfig
from app.services.llm_service import llm_service


class TaskClassifierService:
    """任务分类服务"""

    _VALID_TASK_TYPES = {"recitation", "thinking", "general"}
    _VALID_URGENCY = {"low", "medium", "high"}

    def _extract_usage(self, result: Dict[str, Any]) -> Dict[str, int]:
        usage = result.get("usage") if isinstance(result, dict) else None
        if not isinstance(usage, dict):
            return {}

        prompt_tokens = int(usage.get("prompt_tokens") or usage.get("promptTokens") or 0)
        completion_tokens = int(usage.get("completion_tokens") or usage.get("completionTokens") or 0)
        total_tokens = int(usage.get("total_tokens") or usage.get("totalTokens") or (prompt_tokens + completion_tokens))
        if total_tokens > 0 and (prompt_tokens + completion_tokens) == 0:
            prompt_tokens = total_tokens

        if total_tokens <= 0:
            return {}

        return {
            "promptTokens": max(prompt_tokens, 0),
            "completionTokens": max(completion_tokens, 0),
            "totalTokens": max(total_tokens, 0),
        }

    def _build_usage_meta(self, result: Dict[str, Any]) -> Dict[str, Any]:
        usage_info = self._extract_usage(result)
        has_usage = bool(usage_info)
        return {
            "usage": usage_info if has_usage else None,
            "usageMissing": not has_usage,
            "requestCount": 1,
            "missingUsageRequests": 0 if has_usage else 1,
        }

    def _extract_json_block(self, content: str) -> Optional[Dict[str, Any]]:
        text = (content or "").strip()
        if not text:
            return None

        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            return None

        candidate = match.group(0)
        try:
            data = json.loads(candidate)
            return data if isinstance(data, dict) else None
        except Exception:
            return None

    def _normalize_result(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        task_type = str(data.get("task_type", "")).strip().lower()
        urgency = str(data.get("urgency", "")).strip().lower()

        try:
            difficulty_level = int(data.get("difficulty_level", 3))
        except Exception:
            difficulty_level = 3

        try:
            confidence = float(data.get("confidence", 0.5))
        except Exception:
            confidence = 0.5

        if task_type not in self._VALID_TASK_TYPES:
            return None
        if urgency not in self._VALID_URGENCY:
            return None

        difficulty_level = max(1, min(5, difficulty_level))
        confidence = max(0.0, min(1.0, confidence))
        reason = str(data.get("reason", "")).strip()

        return {
            "taskType": task_type,
            "difficultyLevel": difficulty_level,
            "urgency": urgency,
            "confidence": confidence,
            "reason": reason[:120]
        }

    async def classify_task(
        self,
        message: str,
        use_web_search: bool,
        llm_config: LLMConfig
    ) -> Dict[str, Any]:
        """调用 LLM 自动分类任务属性"""
        if not llm_config.api_key or not llm_config.api_base:
            return {
                "source": "heuristic",
                "confidence": 0.0,
                "reason": "llm_config_missing"
            }

        system_prompt = (
            "你是任务分析器。请只输出 JSON，不要输出任何额外文本。"
            "必须包含字段: task_type, difficulty_level, urgency, confidence, reason。"
            "task_type 只能是 recitation/thinking/general。"
            "difficulty_level 只能是 1-5 的整数。"
            "urgency 只能是 low/medium/high。"
            "confidence 只能是 0-1 的数字。"
            "reason 用一句中文解释，不超过30字。"
        )

        user_prompt = (
            f"用户消息:\n{message}\n\n"
            f"use_web_search={str(use_web_search).lower()}\n\n"
            "判断规则:\n"
            "- 背诵/记忆/默写等重复训练任务 -> recitation\n"
            "- 需要推理、分析、设计、方案论证 -> thinking\n"
            "- 普通问答或执行型小任务 -> general\n"
            "- use_web_search 只是辅助信号，不能单独决定 thinking\n"
        )

        try:
            result = await llm_service.chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                model=llm_config.model_id,
                api_key=llm_config.api_key,
                api_base=llm_config.api_base,
                temperature=0.1,
                max_tokens=180,
                timeout=min(float(llm_config.timeout), 25.0)
            )
            usage_meta = self._build_usage_meta(result)

            choices = result.get("choices", [])
            if not choices:
                response = {
                    "source": "heuristic",
                    "confidence": 0.0,
                    "reason": "empty_llm_response"
                }
                response.update(usage_meta)
                return response

            content = choices[0].get("message", {}).get("content", "")
            parsed = self._extract_json_block(content)
            if not parsed:
                response = {
                    "source": "heuristic",
                    "confidence": 0.0,
                    "reason": "json_parse_failed"
                }
                response.update(usage_meta)
                return response

            normalized = self._normalize_result(parsed)
            if not normalized:
                response = {
                    "source": "heuristic",
                    "confidence": 0.0,
                    "reason": "json_invalid_schema"
                }
                response.update(usage_meta)
                return response

            normalized["source"] = "llm"
            normalized.update(usage_meta)
            return normalized
        except Exception as exc:
            print(f"⚠️ 任务分类模型调用失败: {exc}")
            return {
                "source": "heuristic",
                "confidence": 0.0,
                "reason": "llm_call_failed"
            }


task_classifier_service = TaskClassifierService()
