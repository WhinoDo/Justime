"""Chat response builder service."""

from typing import Dict, Any, Optional
from app.models.chat import ChatResponse, ChatResponseData
from app.core.config import settings


class ChatResponseBuilder:
    """Builds chat responses."""

    def build_no_model_response(
        self,
        session_id: str,
        timing_strategy: Dict[str, Any],
        routing_meta: Dict[str, Any]
    ) -> ChatResponse:
        """Build response when no model is available.

        Args:
            session_id: Session ID
            timing_strategy: Timing strategy dict
            routing_meta: Routing metadata

        Returns:
            ChatResponse instance
        """
        no_model_message = "平台尚未配置可用的 AI 模型，请联系管理员添加。"
        return ChatResponse(
            success=False,
            data=ChatResponseData(
                response=no_model_message,
                emotionScore=5,
                emotionTags=["neutral"],
                needsEmotionInput=False,
                sessionId=session_id,
                timingStrategy=timing_strategy,
                taskAnalysis=timing_strategy.get("analysisMeta") if timing_strategy else None,
                routingMeta=routing_meta if settings.ENABLE_ROUTING_META else None
            ).dict(),
            error={
                "message": no_model_message,
                "type": "no_model_configured"
            }
        )

    def build_model_denied_response(
        self,
        session_id: str,
        timing_strategy: Dict[str, Any],
        routing_meta: Dict[str, Any]
    ) -> ChatResponse:
        """Build response when model access is denied.

        Args:
            session_id: Session ID
            timing_strategy: Timing strategy dict
            routing_meta: Routing metadata

        Returns:
            ChatResponse instance
        """
        denied_message = "你当前无权访问该模型，请联系管理员分配模型权限。"
        return ChatResponse(
            success=False,
            data=ChatResponseData(
                response=denied_message,
                emotionScore=5,
                emotionTags=["neutral"],
                needsEmotionInput=False,
                sessionId=session_id,
                timingStrategy=timing_strategy,
                taskAnalysis=timing_strategy.get("analysisMeta") if timing_strategy else None,
                routingMeta=routing_meta if settings.ENABLE_ROUTING_META else None
            ).dict(),
            error={
                "message": denied_message,
                "type": "model_access_denied"
            }
        )

    def has_real_task_decomposition_output(self, task_result: Optional[Dict[str, Any]]) -> bool:
        """Check if task result contains real task decomposition tool output.

        Args:
            task_result: Task result dictionary

        Returns:
            True if real decomposition output exists
        """
        if not isinstance(task_result, dict):
            return False

        tool_outputs = task_result.get("tool_outputs", [])
        if not isinstance(tool_outputs, list):
            return False

        for output in tool_outputs:
            if not isinstance(output, dict):
                continue
            observation = output.get("observation")
            if not isinstance(observation, dict):
                continue
            if observation.get("type") != "task_decomposition_suggestion":
                continue
            if observation.get("success") is False:
                continue
            subtasks = observation.get("subtasks")
            if isinstance(subtasks, list) and len(subtasks) > 0:
                return True

        return False


# Singleton instance
chat_response_builder = ChatResponseBuilder()
