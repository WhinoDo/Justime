import logging
from typing import Dict, Any, List, Optional

from app.core.config import settings, LLMConfig
from app.core.normalizers import normalize_bool, normalize_capabilities
from app.services.user_service import UserService
from app.services.encryption_service import encryption_service
from app.business.chat_routing_service import chat_routing_service
from app.business.chat_prompt_builder import (
    chat_prompt_builder,
    COMPLEX_TASK_KEYWORDS,
)

logger = logging.getLogger(__name__)


class ChatRouter:
    async def get_user_llm_config(self, user_id: str) -> Dict[str, Any]:
        return await chat_routing_service.get_user_llm_config(user_id)

    def normalize_route_mode(self, route_mode: Optional[str]) -> str:
        return chat_routing_service.normalize_route_mode(route_mode)

    def runtime_to_llm_config(self, runtime_config: Dict[str, Any], timeout_override: Optional[float] = None) -> LLMConfig:
        return chat_routing_service.runtime_to_llm_config(runtime_config, timeout_override)

    def build_runtime_model_candidates(
        self,
        system_configs: List[Dict[str, Any]],
        active_id: Optional[str],
        active_config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        return chat_routing_service.build_runtime_model_candidates(system_configs, active_id, active_config)

    def detect_schedule_component_intent(self, user_message: str) -> Dict[str, bool]:
        return chat_prompt_builder.detect_schedule_component_intent(user_message)

    def detect_knowledge_intent(self, user_message: str) -> bool:
        return chat_prompt_builder.detect_knowledge_intent(user_message)

    def build_user_habits_context(self, profile: Dict[str, Any]) -> str:
        return chat_prompt_builder.build_user_habits_context(profile)

    def wrap_task_with_timing(
        self,
        enhanced_task: str,
        strategy: Dict[str, Any],
        context_text: str,
        user_habits_context: str = ""
    ) -> str:
        return chat_prompt_builder.wrap_task_with_timing(enhanced_task, strategy, context_text, user_habits_context)


chat_router = ChatRouter()
