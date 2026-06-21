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
