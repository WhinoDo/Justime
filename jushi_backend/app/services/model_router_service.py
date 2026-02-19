"""
模型路由服务
根据任务属性、请求模式和模型能力标签选择分类/主执行/回退模型。
"""

from typing import Any, Dict, List, Optional, Set


class ModelRouterService:
    _KNOWN_CAPABILITIES = {"fast", "reasoning", "classifier", "tool_call"}

    def _parse_capabilities(self, config: Dict[str, Any]) -> Set[str]:
        raw = config.get("capabilities")
        result: Set[str] = set()
        if isinstance(raw, list):
            for item in raw:
                if not isinstance(item, str):
                    continue
                normalized = item.strip().lower()
                if normalized in self._KNOWN_CAPABILITIES:
                    result.add(normalized)

        model_id = str(config.get("model_id") or "").lower()
        if "reasoner" in model_id or "r1" in model_id or "o1" in model_id or "o3" in model_id:
            result.add("reasoning")
        if "chat" in model_id or "mini" in model_id or "turbo" in model_id or "flash" in model_id:
            result.add("fast")

        return result

    def _priority(self, config: Dict[str, Any]) -> int:
        try:
            return int(config.get("priority", 100))
        except Exception:
            return 100

    def _enabled(self, config: Dict[str, Any]) -> bool:
        value = config.get("enabled", True)
        if isinstance(value, bool):
            return value
        if value is None:
            return True
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {"false", "0", "no", "n"}:
                return False
            if lowered in {"true", "1", "yes", "y"}:
                return True
        return bool(value)

    def _sorted_candidates(self, configs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        valid = [c for c in configs if self._enabled(c) and c.get("api_key") and c.get("base_url") and c.get("model_id")]
        return sorted(
            valid,
            key=lambda c: (
                self._priority(c),
                0 if c.get("is_active") else 1,
                str(c.get("config_name") or "")
            )
        )

    def _find_first_with_capability(self, configs: List[Dict[str, Any]], capability: str) -> Optional[Dict[str, Any]]:
        for config in configs:
            if capability in self._parse_capabilities(config):
                return config
        return None

    def _find_active(self, configs: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        for config in configs:
            if config.get("is_active"):
                return config
        return configs[0] if configs else None

    def pick_classifier_config(self, configs: List[Dict[str, Any]], active_id: Optional[str]) -> Optional[Dict[str, Any]]:
        candidates = self._sorted_candidates(configs)
        if not candidates:
            return None

        classifier = self._find_first_with_capability(candidates, "classifier")
        if classifier:
            return classifier

        fast = self._find_first_with_capability(candidates, "fast")
        if fast:
            return fast

        if active_id:
            active_match = next((c for c in candidates if c.get("config_id") == active_id), None)
            if active_match:
                return active_match

        return self._find_active(candidates)

    def pick_main_config(
        self,
        task_type: Optional[str],
        difficulty_level: Optional[int],
        route_mode: Optional[str],
        configs: List[Dict[str, Any]],
        active_id: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        candidates = self._sorted_candidates(configs)
        if not candidates:
            return None

        mode = (route_mode or "auto").strip().lower()
        task = (task_type or "general").strip().lower()
        difficulty = difficulty_level or 3

        if mode == "fast":
            return self._find_first_with_capability(candidates, "fast") or self._find_active(candidates)

        if mode == "reasoning":
            return self._find_first_with_capability(candidates, "reasoning") or self._find_active(candidates)

        if mode == "balanced":
            if task == "thinking" and difficulty >= 4:
                return self._find_first_with_capability(candidates, "reasoning") or self._find_active(candidates)
            return self._find_first_with_capability(candidates, "fast") or self._find_active(candidates)

        # auto
        if task == "thinking" and difficulty >= 4:
            reasoning = self._find_first_with_capability(candidates, "reasoning")
            if reasoning:
                return reasoning
        fast = self._find_first_with_capability(candidates, "fast")
        if fast:
            return fast

        if active_id:
            active_match = next((c for c in candidates if c.get("config_id") == active_id), None)
            if active_match:
                return active_match
        return self._find_active(candidates)

    def pick_fallback_config(
        self,
        main_config: Optional[Dict[str, Any]],
        configs: List[Dict[str, Any]],
        prefer_reasoning: bool = True
    ) -> Optional[Dict[str, Any]]:
        candidates = self._sorted_candidates(configs)
        if not candidates:
            return None

        main_id = (main_config or {}).get("config_id")
        fallback_pool = [c for c in candidates if c.get("config_id") != main_id]
        if not fallback_pool:
            return None

        if prefer_reasoning:
            reasoning = self._find_first_with_capability(fallback_pool, "reasoning")
            if reasoning:
                return reasoning

        fast = self._find_first_with_capability(fallback_pool, "fast")
        if fast:
            return fast

        return fallback_pool[0]


model_router_service = ModelRouterService()
