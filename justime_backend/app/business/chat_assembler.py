import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from app.business.chat_prompt_builder import (
    chat_prompt_builder,
    CALENDAR_KEYWORDS,
    COMPLEX_TASK_KEYWORDS,
    SEARCH_KEYWORDS,
    LEARNING_PLAN_KEYWORDS,
)

logger = logging.getLogger(__name__)


class ChatAssembler:
    def build_enhanced_task(self, user_message: str, use_web_search: bool = False) -> str:
        return chat_prompt_builder.build_enhanced_task(user_message, use_web_search)

    def extract_rag_references(self, tool_outputs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
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

            nested = observation_obj.get("observation")
            if isinstance(nested, dict):
                observation_obj = nested

            obs_type = str(observation_obj.get("type") or "").strip()
            if obs_type == "rag_references":
                return observation_obj

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

    def parse_agent_result(
        self,
        agent_result: Any,
        tool_outputs: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        ai_content = str(agent_result) if agent_result else ""
        suggested_events = []
        task_decomposition = None
        batch_events = None

        for output in tool_outputs:
            suggestion = output.get("observation")
            if not isinstance(suggestion, dict):
                continue

            suggestion_type = suggestion.get("type")
            if suggestion_type == "calendar_event_suggestion":
                event_data = suggestion.get("event", {})
                if event_data:
                    suggested_events.append(event_data)
                    ai_content = suggestion.get("message", ai_content)
            elif suggestion_type == "task_decomposition_suggestion":
                task_decomposition = suggestion
                ai_content = suggestion.get("message", ai_content)
            elif suggestion_type == "batch_calendar_events":
                batch_events = suggestion
                for event in suggestion.get("events", []):
                    suggested_events.append(event)
                ai_content = suggestion.get("message", ai_content)

        if isinstance(agent_result, dict):
            suggestion_type = agent_result.get("type")
            if suggestion_type == "calendar_event_suggestion" and not suggested_events:
                event_data = agent_result.get("event", {})
                if event_data:
                    suggested_events.append(event_data)
                    ai_content = agent_result.get("message", ai_content)
            elif suggestion_type == "task_decomposition_suggestion" and not task_decomposition:
                task_decomposition = agent_result
                ai_content = agent_result.get("message", ai_content)
            elif suggestion_type == "batch_calendar_events" and not batch_events:
                batch_events = agent_result
                for event in agent_result.get("events", []):
                    suggested_events.append(event)
                ai_content = agent_result.get("message", ai_content)
        elif isinstance(agent_result, str) and not task_decomposition and not suggested_events:
            try:
                parsed_result = json.loads(agent_result)
                if isinstance(parsed_result, dict):
                    suggestion_type = parsed_result.get("type")
                    if suggestion_type == "task_decomposition_suggestion":
                        task_decomposition = parsed_result
                        ai_content = parsed_result.get("message", ai_content)
                    elif suggestion_type == "calendar_event_suggestion":
                        event_data = parsed_result.get("event", {})
                        if event_data:
                            suggested_events.append(event_data)
                            ai_content = parsed_result.get("message", ai_content)
                    elif suggestion_type == "batch_calendar_events":
                        batch_events = parsed_result
                        for event in parsed_result.get("events", []):
                            suggested_events.append(event)
                        ai_content = parsed_result.get("message", ai_content)
            except Exception:
                pass

        return {
            "ai_content": ai_content,
            "suggested_events": suggested_events,
            "task_decomposition": task_decomposition,
            "batch_events": batch_events,
        }


chat_assembler = ChatAssembler()
