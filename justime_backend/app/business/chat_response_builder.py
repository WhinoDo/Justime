"""Chat response builder service."""

import hashlib
import json
from typing import Dict, Any, List, Optional
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

    def extract_rag_references(self, tool_outputs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract and aggregate RAG references from tool outputs, deduplicating by document.

        Args:
            tool_outputs: List of tool output dictionaries

        Returns:
            List of aggregated RAG references
        """
        if not isinstance(tool_outputs, list):
            return []

        def _normalize_observation(raw_observation: Any, tool_name: str) -> Optional[Dict[str, Any]]:
            observation_obj = raw_observation
            if isinstance(observation_obj, str):
                stripped = observation_obj.strip()
                if stripped.startswith("{") or stripped.startswith("["):
                    try:
                        parsed = json.loads(stripped)
                        if isinstance(parsed, dict):
                            observation_obj = parsed
                    except Exception:
                        return None
                else:
                    return None

            if not isinstance(observation_obj, dict):
                return None

            # Handle nested observation
            nested = observation_obj.get("observation")
            if isinstance(nested, dict):
                observation_obj = nested

            obs_type = str(observation_obj.get("type") or "").strip()
            if obs_type == "rag_references":
                return observation_obj

            # For retrieve_knowledge tool, allow payload without type but with references
            references = observation_obj.get("references")
            if tool_name == "retrieve_knowledge" and isinstance(references, list):
                payload = dict(observation_obj)
                payload["type"] = "rag_references"
                return payload
            return None

        def _normalize_reference(reference: Dict[str, Any]) -> Dict[str, Any]:
            doc_path = str(
                reference.get("docPath")
                or reference.get("doc_path")
                or ""
            ).strip()
            file_name = str(
                reference.get("fileName")
                or reference.get("file_name")
                or ""
            ).strip()
            reference_id = str(
                reference.get("referenceId")
                or reference.get("reference_id")
                or ""
            ).strip()

            snippets_raw = reference.get("snippets")
            if not isinstance(snippets_raw, list):
                snippets_raw = []
            snippets = [str(item or "").strip() for item in snippets_raw if str(item or "").strip()]

            queries_raw = reference.get("queries")
            if not isinstance(queries_raw, list):
                queries_raw = []
            queries = [str(item or "").strip() for item in queries_raw if str(item or "").strip()]

            score = 0.0
            try:
                score = float(reference.get("score", 0.0) or 0.0)
            except Exception:
                score = 0.0

            return {
                "referenceId": reference_id,
                "docPath": doc_path,
                "fileName": file_name,
                "score": score,
                "snippets": snippets,
                "queries": queries,
            }

        merged: Dict[str, Dict[str, Any]] = {}
        for output in tool_outputs:
            if not isinstance(output, dict):
                continue

            tool_name = str(output.get("tool_name") or "").strip()
            observation = _normalize_observation(output.get("observation"), tool_name)
            if not observation:
                continue

            observation_query = str(observation.get("query") or "").strip()
            references = observation.get("references")
            if not isinstance(references, list):
                continue

            for reference_raw in references:
                if not isinstance(reference_raw, dict):
                    continue
                reference = _normalize_reference(reference_raw)
                doc_path = reference["docPath"]
                file_name = reference["fileName"]
                group_key = doc_path or file_name
                if not group_key:
                    continue

                if group_key not in merged:
                    seed = f"{doc_path}|{file_name}" if (doc_path or file_name) else group_key
                    reference_id = str(reference["referenceId"] or hashlib.sha1(seed.encode("utf-8")).hexdigest())
                    merged[group_key] = {
                        "referenceId": reference_id,
                        "docPath": doc_path,
                        "fileName": file_name or (doc_path.split("/")[-1] if doc_path else "未知文档"),
                        "score": 0.0,
                        "snippets": [],
                        "queries": [],
                    }

                current = merged[group_key]
                reference_score = float(reference.get("score", 0.0) or 0.0)
                current["score"] = max(float(current.get("score", 0.0) or 0.0), reference_score)

                for snippet_text in reference.get("snippets", []):
                    if snippet_text not in current["snippets"]:
                        current["snippets"].append(snippet_text)

                reference_queries = reference.get("queries", [])
                if observation_query:
                    reference_queries.append(observation_query)
                for query_text in reference_queries:
                    query_str = str(query_text or "").strip()
                    if query_str and query_str not in current["queries"]:
                        current["queries"].append(query_str)

        return sorted(
            merged.values(),
            key=lambda item: float(item.get("score", 0.0) or 0.0),
            reverse=True,
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

    def has_retrieve_knowledge_output(self, task_result: Optional[Dict[str, Any]]) -> bool:
        """Check if task result contains real knowledge retrieval tool output.

        Args:
            task_result: Task result dictionary

        Returns:
            True if knowledge retrieval output exists
        """
        if not isinstance(task_result, dict):
            return False

        tool_outputs = task_result.get("tool_outputs", [])
        if not isinstance(tool_outputs, list):
            return False

        for output in tool_outputs:
            if not isinstance(output, dict):
                continue
            tool_name = str(output.get("tool_name") or "").strip()
            observation = output.get("observation")
            if tool_name == "retrieve_knowledge":
                return True
            if isinstance(observation, dict) and observation.get("type") == "rag_references":
                return True
        return False


# Singleton instance
chat_response_builder = ChatResponseBuilder()
