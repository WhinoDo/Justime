"""Chat routing and model selection service."""

from typing import Dict, Any, List, Optional
from app.core.config import settings, LLMConfig
from app.services.user_service import UserService
from app.services.encryption_service import encryption_service


class ChatRoutingService:
    """Handles model routing and runtime configuration."""

    def normalize_capabilities(self, raw: Any) -> List[str]:
        """Normalize model capabilities list.

        Args:
            raw: Raw capabilities data

        Returns:
            List of normalized capability strings
        """
        if not isinstance(raw, list):
            return []
        caps: List[str] = []
        for item in raw:
            if not isinstance(item, str):
                continue
            normalized = item.strip().lower()
            if normalized and normalized not in caps:
                caps.append(normalized)
        return caps

    def normalize_route_mode(self, route_mode: Optional[str]) -> str:
        """Normalize route mode string.

        Args:
            route_mode: Raw route mode

        Returns:
            Normalized route mode ('auto', 'fast', 'balanced', or 'reasoning')
        """
        value = (route_mode or "auto").strip().lower()
        if value in {"auto", "fast", "balanced", "reasoning"}:
            return value
        return "auto"

    def normalize_enabled_flag(self, raw: Any) -> bool:
        """Normalize enabled flag from various input types.

        Args:
            raw: Raw enabled flag value

        Returns:
            Boolean enabled status
        """
        if isinstance(raw, bool):
            return raw
        if raw is None:
            return True
        if isinstance(raw, str):
            value = raw.strip().lower()
            if value in {"false", "0", "no", "n"}:
                return False
            if value in {"true", "1", "yes", "y"}:
                return True
        return bool(raw)

    def runtime_to_llm_config(
        self,
        runtime_config: Dict[str, Any],
        timeout_override: Optional[float] = None
    ) -> LLMConfig:
        """Convert runtime config to LLMConfig.

        Args:
            runtime_config: Runtime configuration dict
            timeout_override: Optional timeout override

        Returns:
            LLMConfig instance
        """
        timeout_value = int(timeout_override) if timeout_override is not None else int(runtime_config.get("timeout", 60))
        timeout_value = max(1, timeout_value)
        return LLMConfig(
            name=runtime_config.get("config_name") or "未命名配置",
            model_id=runtime_config.get("model_id") or "",
            api_key=runtime_config.get("api_key") or "",
            api_base=runtime_config.get("base_url"),
            timeout=timeout_value
        )

    def build_runtime_model_candidates(
        self,
        system_configs: List[Dict[str, Any]],
        active_id: Optional[str],
        active_config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Build runtime model candidate list from system configs.

        Args:
            system_configs: List of system model configurations
            active_id: Active model ID
            active_config: Active model configuration

        Returns:
            List of runtime model candidates
        """
        runtime_configs: List[Dict[str, Any]] = []

        for conf in system_configs:
            if not isinstance(conf, dict):
                continue
            encrypted_key = conf.get("api_key", "")
            plain_key = encryption_service.decrypt(encrypted_key) if encrypted_key else ""
            model_id = conf.get("model_id")
            base_url = conf.get("base_url")
            if not plain_key or not model_id or not base_url:
                continue
            runtime_configs.append({
                "config_id": conf.get("id") or "unknown",
                "config_name": conf.get("name") or "平台选项",
                "model_id": model_id,
                "api_key": plain_key,
                "base_url": base_url,
                "timeout": int(conf.get("timeout", 60)),
                "priority": conf.get("priority", 100),
                "enabled": self.normalize_enabled_flag(conf.get("enabled", True)),
                "capabilities": self.normalize_capabilities(conf.get("capabilities")),
                "is_active": bool(conf.get("id") and conf.get("id") == active_id),
            })

        # Ensure active config has at least one entry
        if active_config.get("api_key") and active_config.get("base_url") and active_config.get("model_id"):
            active_runtime_id = active_config.get("config_id") or ""
            exists = any(item.get("config_id") == active_runtime_id for item in runtime_configs)
            if not exists:
                runtime_configs.append({
                    "config_id": active_runtime_id or "active",
                    "config_name": active_config.get("config_name") or "平台默认配置",
                    "model_id": active_config.get("model_id"),
                    "api_key": active_config.get("api_key"),
                    "base_url": active_config.get("base_url"),
                    "timeout": int(active_config.get("timeout", 60)),
                    "priority": 100,
                    "enabled": True,
                    "capabilities": [],
                    "is_active": True,
                })

        return runtime_configs

    async def get_user_llm_config(self, user_id: str) -> Dict[str, Any]:
        """Get and decrypt user's LLM configuration.

        Automatically retrieves the current active configuration at system level.

        Args:
            user_id: User ID

        Returns:
            LLM configuration dict
        """
        system_configs = await UserService.get_available_models_for_user(user_id)
        active_id = await UserService.get_user_active_model_id(user_id)

        target_config = None

        # 1. Try to get active config
        if active_id and system_configs:
            target_config = next((c for c in system_configs if c.get("id") == active_id), None)

        # 2. If no active config, use first one
        if not target_config and system_configs:
            target_config = system_configs[0]

        if not target_config:
            # Return empty config when platform has no models configured
            return {
                "config_id": "",
                "config_name": "",
                "model_id": "",
                "api_key": "",
                "base_url": "",
                "timeout": 60
            }

        # Decrypt API Key
        encrypted_key = target_config.get("api_key", "")
        plain_key = encryption_service.decrypt(encrypted_key) if encrypted_key else ""

        return {
            "config_id": target_config.get("id") or "",
            "config_name": target_config.get("name") or "平台默认配置",
            "model_id": target_config.get("model_id"),
            "api_key": plain_key,
            "base_url": target_config.get("base_url"),
            "timeout": int(target_config.get("timeout", 60))
        }


# Singleton instance
chat_routing_service = ChatRoutingService()
