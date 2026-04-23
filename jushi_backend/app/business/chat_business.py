import asyncio
import hashlib
import json
import logging
from datetime import datetime, timezone
from time import perf_counter
import re
from typing import Dict, Any, List, Optional
from bson import ObjectId
from functools import wraps

# 配置日志
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# 重试装饰器
def retry_on_failure(max_retries: int = 3, delay: float = 1.0, exceptions: tuple = (Exception,)):
    """重试装饰器，用于处理临时性故障"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        logger.warning(f"操作失败，第{attempt + 1}次重试: {str(e)}")
                        await asyncio.sleep(delay * (attempt + 1))
                    else:
                        logger.error(f"操作失败，已达到最大重试次数{max_retries}: {str(e)}")
            raise last_exception
        return wrapper
    return decorator
from app.services.llm_service import llm_service
from app.services.agent_service import agent_service
from app.services.task_timing_service import task_timing_service
from app.services.task_classifier_service import task_classifier_service
from app.services.model_router_service import model_router_service
from app.services.openclaw_service import openclaw_service
from app.core.config import settings, LLMConfig
from app.models.chat import ChatRequest, ChatResponse, LLMTestRequest, ChatResponseData
from app.models.history import ChatSession, ChatMessage
from app.database import db

from app.services.user_service import UserService
from app.services.encryption_service import encryption_service
from app.core.normalizers import normalize_bool, normalize_capabilities

# ... (keywords definitions remain same) ...
CALENDAR_KEYWORDS = [
    "日程", "日历", "安排", "提醒", "会议", "约会", "预约", "截止",
    "明天", "后天", "下周", "下个月", "今天", "周一", "周二", "周三", "周四", "周五", "周六", "周日",
    "上午", "下午", "早上", "晚上", "中午", "点钟", "点半",
    "开会", "见面", "面试", "聚会", "培训", "活动", "deadline", "meeting",
    "添加事件", "创建事件", "新建日程", "记录", "备忘"
]

COMPLEX_TASK_KEYWORDS = [
    "项目", "开发", "系统", "计划", "方案", "准备", "设计", "实现",
    "学习", "完成", "制定", "规划", "论文", "报告", "研究",
    "网站", "应用", "App", "软件", "平台", "程序",
    "帮我做", "帮我制定", "怎么安排", "如何完成",
    "分解", "拆分", "步骤", "阶段", "里程碑"
]

SEARCH_KEYWORDS = [
    "搜索", "查找", "查询", "百度", "谷歌", "Google", "search", "find", 
    "查一下", "搜一下", "who is", "what is", "when is", "latest", "news",
    "最新", "新闻"
]

LEARNING_PLAN_KEYWORDS = [
    "学习", "复习", "备考", "刷题", "课程", "训练计划", "学习计划", "路线图",
    "我要学", "想学", "怎么学", "如何学", "学会", "入门"
]

DECOMPOSITION_TOOL_RETRY_LIMIT = 2
KNOWLEDGE_TOOL_RETRY_LIMIT = 1


class ChatBusiness:
    async def create_session(self, user_id: str, title: str) -> str:
        """创建新会话"""
        session_doc = {
            "userId": user_id,
            "title": title,
            "updatedAt": datetime.now(timezone.utc),
            "createdAt": datetime.now(timezone.utc)
        }
        result = await db.db["chat_sessions"].insert_one(session_doc)
        return str(result.inserted_id)

    async def save_message(self, session_id: str, role: str, content: str, **kwargs) -> str:
        """保存消息"""
        message_doc = {
            "sessionId": session_id,
            "role": role,
            "content": content,
            "timestamp": datetime.now(timezone.utc)
        }
        
        # Add optional fields if present
        if kwargs.get("taskDecomposition"):
            message_doc["taskDecomposition"] = kwargs["taskDecomposition"]
        if kwargs.get("multiTaskDecompositions"):
            message_doc["multiTaskDecompositions"] = kwargs["multiTaskDecompositions"]
        if kwargs.get("suggestedEvents"):
            message_doc["suggestedEvents"] = kwargs["suggestedEvents"]
        if kwargs.get("timingStrategy"):
            message_doc["timingStrategy"] = kwargs["timingStrategy"]
        if kwargs.get("taskAnalysis"):
            message_doc["taskAnalysis"] = kwargs["taskAnalysis"]
        if kwargs.get("ragReferences"):
            message_doc["ragReferences"] = kwargs["ragReferences"]
            
        result = await db.db["chat_messages"].insert_one(message_doc)

        # 更新会话最后更新时间和预览
        await db.db["chat_sessions"].update_one(
            {"_id": ObjectId(session_id)},
            {
                "$set": {
                    "updatedAt": datetime.now(timezone.utc),
                    "preview": content[:50] + "..." if len(content) > 50 else content
                }
            }
        )
        return str(result.inserted_id)

    async def update_message_interactive_state(self, message_id: str, updates: Dict[str, Any]):
        """更新消息的交互状态（如清除任务分解数据）"""
        if not message_id:
            return
            
        update_fields = {}
        # Only allow updating specific interactive fields to prevent abuse
        allowed_fields = ["taskDecomposition", "multiTaskDecompositions", "suggestedEvents"]
        
        for field in allowed_fields:
            if field in updates:
                update_fields[field] = updates[field]
                
        if update_fields:
            await db.db["chat_messages"].update_one(
                {"_id": ObjectId(message_id)},
                {"$set": update_fields}
            )

    def _should_use_openclaw(self, request: ChatRequest) -> bool:
        return bool(request.useOpenClaw)

    async def _build_openclaw_response(
        self,
        *,
        request: ChatRequest,
        user_id: str,
        session_id: str,
        started_at: datetime,
        routing_meta: Dict[str, Any],
    ) -> ChatResponse:
        openclaw_result = await openclaw_service.run_special_task(
            message=request.message,
            session_id=session_id,
            user_id=user_id,
            task_type=request.taskType,
            use_web_search=bool(request.useWebSearch),
        )

        ai_message_id = await self.save_message(
            session_id,
            "ai",
            openclaw_result.text,
            taskAnalysis={
                "source": "openclaw",
                "taskType": request.taskType or "general",
            },
        )

        routing_meta["mainModel"] = "openclaw/embedded"
        routing_meta["routeReason"] = "explicit_openclaw"
        routing_meta["fallbackModel"] = None
        routing_meta["fallbackUsed"] = False
        routing_meta["timing"]["totalMs"] = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)

        return ChatResponse(
            success=True,
            data={
                "response": openclaw_result.text,
                "messageId": ai_message_id,
                "emotionScore": 7,
                "emotionTags": ["helpful", "openclaw"],
                "needsEmotionInput": False,
                "suggestedEvents": [],
                "taskResult": {
                    "hasTasks": False,
                    "tasks": [],
                    "provider": "openclaw",
                },
                "sessionId": session_id,
                "timingStrategy": None,
                "taskAnalysis": {
                    "source": "openclaw",
                    "taskType": request.taskType or "general",
                },
                "ragReferences": [],
                "routingMeta": routing_meta if settings.ENABLE_ROUTING_META else None,
            },
        )

    async def get_user_sessions(self, user_id: str) -> List[dict]:
        """获取用户会话列表"""
        cursor = db.db["chat_sessions"].find({"userId": user_id}).sort("updatedAt", -1)
        sessions = await cursor.to_list(length=100)
        # Convert ObjectId to str
        for s in sessions:
            s["_id"] = str(s["_id"])
        return sessions

    async def get_session_messages(self, session_id: str, limit: int = 200) -> List[dict]:
        """获取会话消息"""
        safe_limit = max(1, min(int(limit or 200), 1000))
        cursor = db.db["chat_messages"].find({"sessionId": session_id}).sort("timestamp", 1)
        messages = await cursor.to_list(length=safe_limit)
        # Convert ObjectId to str
        for m in messages:
            m["_id"] = str(m["_id"])
        return messages

    async def _record_usage_event(
        self,
        user_id: str,
        session_id: str,
        config_id: str,
        model_id: str,
        config_name: str,
        path_type: str,
        is_primary: bool,
        usage: Optional[Dict[str, Any]],
        message_id: Optional[str] = None
    ) -> None:
        """记录真实 usage 事件；若 usage 缺失则仅记录缺失计数。"""
        if not isinstance(usage, dict):
            return

        try:
            prompt_tokens = max(0, int(usage.get("promptTokens", 0) or 0))
            completion_tokens = max(0, int(usage.get("completionTokens", 0) or 0))
            request_count = max(
                1,
                int(
                    usage.get("totalRequests")
                    or usage.get("requestsWithUsage")
                    or usage.get("requestCount")
                    or 1
                ),
            )
            missing_usage_requests = int(
                usage.get("missingUsageRequests", 0)
                or (1 if usage.get("usageMissing") else 0)
            )
            usage_missing = bool(usage.get("usageMissing")) or (
                (prompt_tokens + completion_tokens) <= 0 and missing_usage_requests > 0
            )
            if (prompt_tokens + completion_tokens) <= 0 and not usage_missing and missing_usage_requests <= 0:
                return

            await UserService.record_llm_usage_event(
                user_id=user_id,
                session_id=session_id,
                config_id=config_id,
                model_id=model_id,
                config_name=config_name,
                path_type=path_type,
                is_primary=is_primary,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                usage_missing=usage_missing,
                request_count=request_count,
                missing_usage_requests=missing_usage_requests,
                provider_request_ids=usage.get("providerRequestIds") if isinstance(usage.get("providerRequestIds"), list) else [],
                message_id=message_id,
                usage_raw=usage.get("usageRaw") if isinstance(usage.get("usageRaw"), dict) else None
            )
        except Exception as exc:
            logger.warning(f"记录模型 token 使用量失败: {exc}")

    async def _build_recent_context(self, session_id: str, window_size: int) -> str:
        """按窗口读取最近会话上下文，用于思考类任务的长上下文输入"""
        if not session_id or window_size <= 0:
            return ""
        try:
            cursor = db.db["chat_messages"].find({"sessionId": session_id}).sort("timestamp", -1)
            recent_messages = await cursor.to_list(length=window_size)
            if not recent_messages:
                return ""

            recent_messages.reverse()
            rendered = []
            for msg in recent_messages:
                role = "用户" if msg.get("role") == "user" else "助手"
                content = (msg.get("content") or "").strip().replace("\n", " ")
                if len(content) > 240:
                    content = content[:240] + "..."
                rendered.append(f"{role}: {content}")
            return "\n".join(rendered)
        except Exception as e:
            logger.warning(f"读取会话上下文失败: {e}")
            return ""

    def _wrap_task_with_timing(
        self,
        enhanced_task: str,
        strategy: Dict[str, Any],
        context_text: str,
        user_habits_context: str = ""
    ) -> str:
        """将任务调度策略注入到实际执行提示词中，形成可执行约束"""
        task_type = strategy.get("taskType", "general")
        duration_sec = strategy.get("interactionDurationSeconds", 300)
        interval_sec = strategy.get("intervalSeconds", 21600)
        max_steps = strategy.get("maxSteps", 10)
        timeout_sec = strategy.get("timeoutSeconds", 290)
        difficulty = strategy.get("difficultyLevel", 3)
        urgency = strategy.get("urgency", "medium")
        analysis_meta = strategy.get("analysisMeta") if isinstance(strategy.get("analysisMeta"), dict) else None

        if task_type == "recitation":
            mode_instruction = (
                "当前任务是背诵/记忆型任务，目标是短时高频。"
                "请快速给出可执行的记忆训练结果，并保持回复简洁。"
            )
        elif task_type == "thinking":
            mode_instruction = (
                "当前任务是思考/分析型任务，目标是长时低频。"
                "请进行结构化分析，允许更充分推理，再给出结论。"
            )
        else:
            mode_instruction = (
                "当前任务是通用任务，平衡效率与完整性，输出明确可执行答案。"
            )

        sections = [
            enhanced_task,
            "",
            "【任务调度约束】",
            mode_instruction,
            f"- task_type: {task_type}",
            f"- difficulty_level: {difficulty}",
            f"- urgency: {urgency}",
            f"- expected_interaction_duration_seconds: {duration_sec}",
            f"- next_interval_seconds: {interval_sec}",
            f"- execution_max_steps: {max_steps}",
            f"- execution_timeout_seconds: {timeout_sec}",
        ]
        if analysis_meta:
            sections.extend([
                f"- classifier_source: {analysis_meta.get('source', 'unknown')}",
                f"- classifier_confidence: {analysis_meta.get('confidence', 0)}",
                f"- classifier_reason: {analysis_meta.get('reason', '')}"
            ])

        if user_habits_context:
            sections.extend([
                "",
                "【用户工作与学习习惯】",
                user_habits_context,
                "",
                "【排程要求】",
                "- 创建日程或拆解任务时优先使用用户高效时段。",
                "- 避开低效时段和不可用时间段。",
                "- 单次专注时长优先贴合 preferred_focus_minutes；需要更长任务时拆分并安排休息。",
                "- 每日深度任务数量不要超过 max_focus_sessions_per_day。"
            ])

        if context_text:
            sections.extend([
                "",
                "【最近上下文（按调度窗口裁剪）】",
                context_text
            ])

        return "\n".join(sections)

    def _build_user_habits_context(self, profile: Dict[str, Any]) -> str:
        """格式化用户习惯画像为提示词上下文"""
        if not isinstance(profile, dict):
            return ""

        habits = profile.get("habits")
        if not isinstance(habits, dict) or not habits:
            return ""

        lines = []
        if habits.get("occupation"):
            lines.append(f"- occupation: {habits.get('occupation')}")
        if habits.get("currentStudyFocus"):
            lines.append(f"- current_study_focus: {habits.get('currentStudyFocus')}")

        high_eff = habits.get("highEfficiencyPeriods")
        if isinstance(high_eff, list) and high_eff:
            lines.append(f"- high_efficiency_periods: {', '.join([str(x) for x in high_eff[:6]])}")

        low_eff = habits.get("lowEfficiencyPeriods")
        if isinstance(low_eff, list) and low_eff:
            lines.append(f"- low_efficiency_periods: {', '.join([str(x) for x in low_eff[:6]])}")

        unavailable = habits.get("weeklyUnavailableSlots")
        if isinstance(unavailable, list) and unavailable:
            lines.append(f"- weekly_unavailable_slots: {', '.join([str(x) for x in unavailable[:6]])}")

        if habits.get("preferredFocusMinutes") is not None:
            lines.append(f"- preferred_focus_minutes: {habits.get('preferredFocusMinutes')}")
        if habits.get("preferredBreakMinutes") is not None:
            lines.append(f"- preferred_break_minutes: {habits.get('preferredBreakMinutes')}")
        if habits.get("maxFocusSessionsPerDay") is not None:
            lines.append(f"- max_focus_sessions_per_day: {habits.get('maxFocusSessionsPerDay')}")

        if habits.get("planningPreference"):
            lines.append(f"- planning_preference: {habits.get('planningPreference')}")
        if habits.get("notes"):
            lines.append(f"- notes: {str(habits.get('notes'))[:160]}")

        return "\n".join(lines)

    def _detect_schedule_component_intent(self, user_message: str) -> Dict[str, bool]:
        """识别是否应强制返回日程/任务分解组件。"""
        text = (user_message or "").strip()
        lowered = text.lower()

        has_calendar_intent = any(kw in text for kw in CALENDAR_KEYWORDS)
        has_complex_task = any(kw in text for kw in COMPLEX_TASK_KEYWORDS)
        has_learning_plan = any(kw in text for kw in LEARNING_PLAN_KEYWORDS)
        has_short_learn_pattern = bool(re.search(r"(我要|我想|想要|打算)?学[\u4e00-\u9fa5A-Za-z0-9]{1,12}", text))

        is_schedule_related = has_calendar_intent or has_complex_task or has_learning_plan or has_short_learn_pattern
        prefer_decomposition = has_complex_task or has_learning_plan or has_short_learn_pattern
        prefer_calendar_event = has_calendar_intent and not prefer_decomposition

        # 英文简单补充，避免 “study calculus” 一类漏检
        if not is_schedule_related and any(x in lowered for x in ["study plan", "learning plan", "schedule", "deadline"]):
            is_schedule_related = True
            prefer_decomposition = "plan" in lowered or "study" in lowered
            prefer_calendar_event = not prefer_decomposition

        return {
            "is_schedule_related": is_schedule_related,
            "prefer_decomposition": prefer_decomposition,
            "prefer_calendar_event": prefer_calendar_event,
        }

    def _has_real_task_decomposition_output(self, task_result: Optional[Dict[str, Any]]) -> bool:
        """判断是否产生了真实的任务分解工具输出。"""
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

    def _has_retrieve_knowledge_output(self, task_result: Optional[Dict[str, Any]]) -> bool:
        """判断是否产生了真实的知识检索工具输出。"""
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

    def _detect_knowledge_intent(self, user_message: str) -> bool:
        """识别是否应该优先调用知识库检索。"""
        text = (user_message or "").strip()
        lowered = text.lower()
        if not text:
            return False

        hard_keywords = [
            "知识库", "文档", "资料", "pdf", "文件", "上传", "根据文档", "根据资料",
            "这份文档", "这份资料", "串.pdf", "readme"
        ]
        if any(kw in text or kw in lowered for kw in hard_keywords):
            return True

        # 对定义/概念类短问句优先走知识检索，提升“回答-引用”一致性
        if len(text) <= 40 and re.search(r"(什么是|定义|概念|含义|是什么意思|是啥|是什么)", text):
            return True

        return False

    def _extract_rag_references(self, tool_outputs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """从工具输出中聚合 RAG 引用，按文档去重合并片段。"""
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

            # 兼容某些工具层会再包一层 observation 的情况
            nested = observation_obj.get("observation")
            if isinstance(nested, dict):
                observation_obj = nested

            obs_type = str(observation_obj.get("type") or "").strip()
            if obs_type == "rag_references":
                return observation_obj

            # 当 tool_name 已是 retrieve_knowledge 时，允许无 type 但带 references 的 payload
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

    # ... (rest of methods) ...

    def _build_enhanced_task(self, user_message: str, use_web_search: bool = False) -> str:
        # ... (same as before) ...
        """构建增强任务提示，帮助 AI 识别日历需求和复杂任务"""
        # 获取当前时间信息（使用UTC时间）
        now = datetime.now(timezone.utc)
        weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
        current_time_str = f"{now.strftime('%Y年%m月%d日')} {weekdays[now.weekday()]} {now.strftime('%H:%M')}"
        
        intent_info = self._detect_schedule_component_intent(user_message)
        has_complex_task = intent_info["prefer_decomposition"]
        has_calendar_intent = intent_info["prefer_calendar_event"]
        has_knowledge_intent = self._detect_knowledge_intent(user_message)
        # 检测是否包含搜索关键词
        has_search_intent = use_web_search or any(kw in user_message for kw in SEARCH_KEYWORDS)
        
        if has_complex_task:
            # 复杂任务 - 使用任务分解工具
            enhanced_task = f"""当前时间：{current_time_str} (ISO: {now.isoformat()})

用户请求：{user_message}

【角色设定】
你是一位专业的项目管理专家（PMP认证）和高效的时间规划师。你的职责是运用科学的方法（如 WBS 工作分解结构、SMART 原则）将用户的复杂请求拆解为可执行的具体计划。

【任务目标】
使用 `suggest_task_decomposition` 工具为用户生成一份科学、严谨、可落地的任务分解方案。

【科学拆解指南 (WBS & SMART)】
1. **Specific (具体)**: 每个子任务必须有明确的产出物或行动。
2. **Measurable (可衡量)**: 描述中应隐含"如何定义完成"。
3. **Achievable (可实现)**: 任务粒度要合理，单个子任务建议 1-8 小时。如果超过 8 小时，请继续拆解。
4. **Relevant (相关)**: 所有子任务必须服务于最终目标。
5. **Time-bound (有时限)**: 必须估算合理的时间开销。

【思考路径】
1. 分析用户目标的"输入"与"输出"。
2. **资源准备**: 如果任务需要特定的学习资源、官方文档或工具平台，请先使用搜索工具获取准确的 URL地址。
3. 按照项目生命周期（启动 -> 规划 -> 执行 -> 收尾）或 逻辑依赖关系 进行拆解。
4. **关键**：严格遵守 `suggest_task_decomposition` 的参数格式要求，特别是 `subtasks` 必须是合法的 JSON 字符串。

【严禁事项】
- **严禁**直接在回复中用文字或Markdown列表列出计划。
- **严禁**询问用户"是否需要我为您生成..."，直接生成！
- **必须**编写 Python 代码调用 `suggest_task_decomposition` 工具。

【工具调用要求】
请务必调用 `suggest_task_decomposition` 工具，参数如下：
- `project_name`: 项目名称（专业、简洁）
- `start_date`: 开始日期（默认为 "{now.strftime('%Y-%m-%d')}"，除非用户指定）
- `total_days`: 根据子任务总时长合理估算（假设每天工作 6-8 小时）
- `subtasks`: **JSON 字符串**。
    - 格式示例：`[{{ "title":"调研","duration_hours":4,"order":1,"resources":[{{ "title":"Google","url":"https://google.com" }}] }}]`
    - **注意**：请确保 JSON 格式正确，使用双引号。如果包含 URL，请放入 `resources` 数组。

【语言要求】
- 默认使用中文回复和生成任务内容。
- 仅当用户明确要求使用英文或其他语言时，才使用对应语言。

请立即编写代码调用工具！"""

        elif has_calendar_intent:
            # 日历相关请求 - 提供明确的工具使用指导
            enhanced_task = f"""当前时间：{current_time_str} (ISO: {now.isoformat()})

用户请求：{user_message}

【角色设定】
你是一位贴心的智能日程助理。你的职责是准确、周全地帮助用户安排日程。

【执行步骤】
1. **时间获取**: 如果涉及相对时间（如"下周五"），请优先调用 `get_current_datetime` 确认准确日期。
2. **资源检索**: 如果任务涉及专业知识、特定网站或平台（如"学习React"、"在Coursera上课"），请主动使用搜索工具查找相关的官方/专业网站 URL。
3. **需求分析**: 识别事件的 5W1H (What, When, Where, Who, Why)。
4. **工具调用**: 使用 `suggest_calendar_event` 创建日程建议。

【工具参数规范】
- `start_time` / `end_time`: 必须是 ISO 8601 格式（如 "2026-01-27T14:00:00"）。
- `end_time`: 如未指定，默认设置为开始后 1 小时。
- `event_type`: 根据内容准确分类 ("meeting", "task", "reminder", "deadline")。
- `priority`: 根据紧急程度判断 ("low", "medium", "high", "urgent")。
- `description`: 事件的具体描述（**严禁包含 URL**）。
- `resources`: 相关资源列表（数组），格式为 `[{{ "title": "资源名称", "url": "URL地址" }}]`。
    - **关键**：所有涉及的网址、链接、文档地址 **必须** 提取到 `resources` 字段中。
    - **严禁** 将 URL 直接写在 `description` 中。

【语言要求】
- 默认使用中文回复。仅当用户明确要求使用其他语言时才切换。

请务必调用工具为用户创建日程！"""
        elif has_search_intent:
            # 搜索相关请求
            enhanced_task = f"""当前时间：{current_time_str}
            
用户请求：{user_message}

【角色设定】
你是一位知识渊博的智能助手，拥有实时访问互联网的能力。你的职责是利用搜索工具为用户提供准确、实时的信息。

【执行步骤】
1. **分析需求**: 理解用户问题的核心，确定需要搜索的关键信息。
2. **搜索工具**: 积极使用 `DuckDuckGoSearchTool` (web_search) 获取最新信息。不要编造事实。
3. **整合回答**: 基于搜索结果，综合整理出简洁、准确的回答，并注明信息来源。

【语言要求】
- 默认使用中文回复。仅当用户明确要求使用其他语言时才切换。

请务必在需要时使用搜索工具！"""
        elif has_knowledge_intent:
            enhanced_task = f"""当前时间：{current_time_str}

用户请求：{user_message}

【执行要求】
1. 你必须先调用 `retrieve_knowledge` 工具进行检索，再基于检索结果回答。
2. 如果知识库未检索到内容，可以明确说明“未检索到相关文档内容”。
3. 仅在知识库无结果且用户问题需要外部知识时，再考虑使用搜索工具补充。

【语言要求】
- 默认使用中文回复。仅当用户明确要求使用其他语言时才切换。

请先调用 `retrieve_knowledge`，不要直接 final_answer。"""

        else:
            # 普通对话请求
            enhanced_task = f"""当前时间：{current_time_str}

用户请求：{user_message}

请用简洁友好的中文回复用户。仅当用户明确要求使用英文或其他语言时，才切换到对应语言。如果用户后续提到时间安排相关的需求，可以使用日历工具帮助他们。同时，你也可以使用搜索工具来回答需要实时信息的问题。"""
        
        return enhanced_task


    async def _get_user_llm_config(self, user_id: str) -> Dict[str, Any]:
        """获取并解密用户的 LLM 配置 (自动获取系统级平台的当前激活配置)"""
        system_configs = await UserService.get_available_models_for_user(user_id)
        active_id = await UserService.get_user_active_model_id(user_id)
        
        target_config = None
        
        # 1. 尝试获取激活的配置
        if active_id and system_configs:
            target_config = next((c for c in system_configs if c.get("id") == active_id), None)
            
        # 2. 如果没有激活的，尝试使用第一个
        if not target_config and system_configs:
            target_config = system_configs[0]
            
        if not target_config:
            # 平台未配置模型时返回空配置，由调用方做明确提示
            return {
                "config_id": "",
                "config_name": "",
                "model_id": "",
                "api_key": "",
                "base_url": "",
                "timeout": 60
            }
        
        # 解密 API Key
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

    def _normalize_route_mode(self, route_mode: Optional[str]) -> str:
        value = (route_mode or "auto").strip().lower()
        if value in {"auto", "fast", "balanced", "reasoning"}:
            return value
        return "auto"

    def _runtime_to_llm_config(self, runtime_config: Dict[str, Any], timeout_override: Optional[float] = None) -> LLMConfig:
        timeout_value = int(timeout_override) if timeout_override is not None else int(runtime_config.get("timeout", 60))
        timeout_value = max(1, timeout_value)
        return LLMConfig(
            name=runtime_config.get("config_name") or "未命名配置",
            model_id=runtime_config.get("model_id") or "",
            api_key=runtime_config.get("api_key") or "",
            api_base=runtime_config.get("base_url"),
            timeout=timeout_value
        )

    def _build_runtime_model_candidates(
        self,
        system_configs: List[Dict[str, Any]],
        active_id: Optional[str],
        active_config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
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
                "enabled": normalize_bool(conf.get("enabled", True), default=True),
                "capabilities": normalize_capabilities(conf.get("capabilities")),
                "is_active": bool(conf.get("id") and conf.get("id") == active_id),
            })

        # 保证激活配置至少可用一条
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

    async def _run_shadow_ensemble(
        self,
        user_id: str,
        session_id: str,
        timed_task: str,
        runtime_configs: List[Dict[str, Any]],
        skip_config_id: Optional[str],
        max_steps: int,
        timeout_seconds: float
    ) -> None:
        """后台并行执行，不阻塞主响应，仅用于观测和统计。"""
        try:
            shadow_candidates = [
                c for c in runtime_configs
                if c.get("config_id") != skip_config_id and c.get("enabled", True)
            ][:3]
            if len(shadow_candidates) < 1:
                return

            llm_configs = [self._runtime_to_llm_config(c, timeout_override=timeout_seconds) for c in shadow_candidates]
            shadow_result = await agent_service.run_parallel_task(
                task=timed_task,
                llm_configs=llm_configs,
                max_steps=max_steps,
                timeout_seconds=timeout_seconds,
                request_id_prefix=f"shadow-{session_id}",
                user_id=user_id,
            )
            if not isinstance(shadow_result, dict) or not shadow_result.get("success"):
                return

            for idx, res in enumerate(shadow_result.get("results", [])):
                if not isinstance(res, dict) or not res.get("success"):
                    continue
                conf = shadow_candidates[idx] if idx < len(shadow_candidates) else {}
                await self._record_usage_event(
                    user_id=user_id,
                    session_id=session_id,
                    config_id=conf.get("config_id", "unknown"),
                    model_id=conf.get("model_id") or res.get("model") or "",
                    config_name=conf.get("config_name", "未命名配置"),
                    path_type="shadow",
                    is_primary=False,
                    usage=res.get("usage")
                )
            logger.debug(f"Shadow ensemble completed with {len(shadow_candidates)} models.")
        except Exception as exc:
            logger.warning(f"Shadow ensemble failed: {exc}")

    async def process_chat(self, request: ChatRequest, user_id: str) -> ChatResponse:
        started_at = datetime.now(timezone.utc)
        timing_strategy: Dict[str, Any] = {}
        routing_meta: Dict[str, Any] = {
            "routeMode": self._normalize_route_mode(request.routeMode),
            "routerEnabled": bool(settings.ROUTER_ENABLED),
            "classifierModel": None,
            "mainModel": None,
            "fallbackModel": None,
            "fallbackUsed": False,
            "routeReason": "",
            "retryCount": 0,
            "timing": {}
        }

        config_dict = await self._get_user_llm_config(user_id)
        system_configs = await UserService.get_available_models_for_user(user_id)
        active_id = await UserService.get_user_active_model_id(user_id)
        runtime_configs = self._build_runtime_model_candidates(system_configs, active_id, config_dict)

        # 1. 处理会话 (创建或使用现有)
        session_id = request.sessionId
        if not session_id:
            title = request.message[:20]
            session_id = await self.create_session(user_id, title)

        # 2. 保存用户消息
        try:
            await self.save_message(session_id, "user", request.message)
        except Exception as e:
            logger.error(f"Failed to save user message: {e}")

        if self._should_use_openclaw(request):
            try:
                return await self._build_openclaw_response(
                    request=request,
                    user_id=user_id,
                    session_id=session_id,
                    started_at=started_at,
                    routing_meta=routing_meta,
                )
            except Exception as exc:
                print(f"OpenClaw Chat Error: {exc}")
                return ChatResponse(
                    success=False,
                    data=ChatResponseData(
                        response="OpenClaw 特殊任务链路执行失败，请检查部署配置后重试。",
                        emotionScore=5,
                        emotionTags=["neutral"],
                        needsEmotionInput=False,
                        sessionId=session_id,
                        timingStrategy=timing_strategy,
                        taskAnalysis={
                            "source": "openclaw",
                            "reason": str(exc),
                            "taskType": request.taskType or "general",
                        },
                        routingMeta=routing_meta if settings.ENABLE_ROUTING_META else None,
                    ).dict(),
                    error={
                        "message": str(exc),
                        "type": "openclaw_error",
                    },
                )

        has_explicit_profile = (
            bool(request.taskType) or
            request.difficultyLevel is not None or
            bool(request.urgency)
        )

        if not runtime_configs:
            timing_strategy = await task_timing_service.resolve_strategy(
                user_id=user_id,
                message=request.message,
                session_id=session_id,
                task_id=request.taskId,
                use_web_search=request.useWebSearch,
                task_type=request.taskType,
                difficulty_level=request.difficultyLevel,
                urgency=request.urgency,
                strategy_source="explicit" if has_explicit_profile else "heuristic"
            )
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

        if request.runtimeModelId:
            requested_model = str(request.runtimeModelId).strip()
            allowed = any(
                str(item.get("model_id") or "").strip() == requested_model
                for item in runtime_configs
            )
            if not allowed:
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

        try:
            route_mode = self._normalize_route_mode(request.routeMode)
            allow_reasoning_fallback = True if request.allowReasoningFallback is None else bool(request.allowReasoningFallback)

            # 3. 自动分析任务类型/难度/紧急度（低置信度回退启发式）
            classifier_started = perf_counter()
            classifier_runtime = None
            if settings.ROUTER_ENABLED:
                classifier_runtime = model_router_service.pick_classifier_config(runtime_configs, active_id)
            if not classifier_runtime:
                classifier_runtime = next((c for c in runtime_configs if c.get("is_active")), runtime_configs[0])

            classifier_timeout = max(1, int(settings.ROUTER_CLASSIFIER_TIMEOUT_SECONDS))
            classifier_llm_config = self._runtime_to_llm_config(classifier_runtime, timeout_override=classifier_timeout)
            routing_meta["classifierModel"] = classifier_llm_config.model_id

            task_analysis = await task_classifier_service.classify_task(
                message=request.message,
                use_web_search=request.useWebSearch,
                llm_config=classifier_llm_config
            )
            routing_meta["timing"]["classifierMs"] = int((perf_counter() - classifier_started) * 1000)

            classifier_usage_payload = None
            if isinstance(task_analysis, dict) and (
                isinstance(task_analysis.get("usage"), dict) or "usageMissing" in task_analysis
            ):
                classifier_usage_payload = {
                    "promptTokens": int((task_analysis.get("usage") or {}).get("promptTokens", 0))
                    if isinstance(task_analysis.get("usage"), dict) else 0,
                    "completionTokens": int((task_analysis.get("usage") or {}).get("completionTokens", 0))
                    if isinstance(task_analysis.get("usage"), dict) else 0,
                    "totalTokens": int((task_analysis.get("usage") or {}).get("totalTokens", 0))
                    if isinstance(task_analysis.get("usage"), dict) else 0,
                    "requestCount": int(task_analysis.get("requestCount", 1) or 1),
                    "missingUsageRequests": int(task_analysis.get("missingUsageRequests", 0) or 0),
                    "usageMissing": bool(task_analysis.get("usageMissing", False)),
                }
            await self._record_usage_event(
                user_id=user_id,
                session_id=session_id,
                config_id=classifier_runtime.get("config_id") or "legacy-default",
                model_id=classifier_llm_config.model_id,
                config_name=classifier_runtime.get("config_name") or "默认配置",
                path_type="classifier",
                is_primary=True,
                usage=classifier_usage_payload,
            )

            classifier_confidence = float(task_analysis.get("confidence") or 0.0)
            use_classifier = (task_analysis.get("source") == "llm") and classifier_confidence >= 0.55

            inferred_task_type = task_analysis.get("taskType") if use_classifier else None
            inferred_difficulty = task_analysis.get("difficultyLevel") if use_classifier else None
            inferred_urgency = task_analysis.get("urgency") if use_classifier else None

            if has_explicit_profile:
                strategy_source = "explicit"
            elif use_classifier:
                strategy_source = "llm_classifier"
            else:
                strategy_source = "heuristic_fallback"

            timing_strategy = await task_timing_service.resolve_strategy(
                user_id=user_id,
                message=request.message,
                session_id=session_id,
                task_id=request.taskId,
                use_web_search=request.useWebSearch,
                task_type=request.taskType or inferred_task_type,
                difficulty_level=request.difficultyLevel if request.difficultyLevel is not None else inferred_difficulty,
                urgency=request.urgency or inferred_urgency,
                strategy_source=strategy_source,
                analysis_meta=task_analysis
            )

            # 构造任务提示
            user_profile = await UserService.get_user_profile(user_id)
            user_habits_context = self._build_user_habits_context(user_profile)
            enhanced_task = self._build_enhanced_task(request.message, request.useWebSearch)
            context_window = int(timing_strategy.get("contextWindowMessages", 8))
            recent_context = await self._build_recent_context(session_id, context_window)
            timed_task = self._wrap_task_with_timing(
                enhanced_task,
                timing_strategy,
                recent_context,
                user_habits_context=user_habits_context
            )

            task_type = timing_strategy.get("taskType")
            difficulty_level = int(timing_strategy.get("difficultyLevel", 3))
            agent_max_steps = int(timing_strategy.get("maxSteps", 10))
            base_timeout = float(timing_strategy.get("timeoutSeconds", 290))
            main_timeout = float(min(base_timeout, max(1, int(settings.ROUTER_MAIN_TIMEOUT_SECONDS))))
            fallback_timeout = float(min(base_timeout, max(1, int(settings.ROUTER_FALLBACK_TIMEOUT_SECONDS))))
            intent_info = self._detect_schedule_component_intent(request.message)
            require_real_decomposition_call = bool(intent_info.get("prefer_decomposition"))
            require_knowledge_retrieval_call = (
                self._detect_knowledge_intent(request.message)
                and not require_real_decomposition_call
                and not bool(intent_info.get("prefer_calendar_event"))
            )

            # 路由选择主模型和回退模型
            if request.runtimeModelId:
                requested_model = str(request.runtimeModelId).strip()
                main_runtime = next((c for c in runtime_configs if c.get("model_id") == requested_model), None)
                if not main_runtime:
                     # fallback if the requested model doesn't exist
                     main_runtime = next((c for c in runtime_configs if c.get("is_active")), runtime_configs[0])
            elif settings.ROUTER_ENABLED:
                main_runtime = model_router_service.pick_main_config(
                    task_type=task_type,
                    difficulty_level=difficulty_level,
                    route_mode=route_mode,
                    configs=runtime_configs,
                    active_id=active_id
                )
            else:
                main_runtime = next((c for c in runtime_configs if c.get("is_active")), runtime_configs[0])

            if not main_runtime:
                raise Exception("无可用主模型配置")

            fallback_runtime = None
            if allow_reasoning_fallback and settings.ROUTER_ENABLED:
                fallback_runtime = model_router_service.pick_fallback_config(
                    main_config=main_runtime,
                    configs=runtime_configs,
                    prefer_reasoning=True
                )

            routing_meta["mainModel"] = main_runtime.get("model_id")
            routing_meta["fallbackModel"] = fallback_runtime.get("model_id") if fallback_runtime else None
            routing_meta["routeReason"] = f"mode={route_mode}, taskType={task_type}, difficulty={difficulty_level}"

            # 可选后台并行观测，不阻塞主流程
            has_complex_task = (
                any(kw in request.message for kw in COMPLEX_TASK_KEYWORDS) or
                (task_type == "thinking" and difficulty_level >= 4)
            )
            if settings.ENABLE_PARALLEL_ENSEMBLE and has_complex_task and len(runtime_configs) > 1:
                asyncio.create_task(
                    self._run_shadow_ensemble(
                        user_id=user_id,
                        session_id=session_id,
                        timed_task=timed_task,
                        runtime_configs=runtime_configs,
                        skip_config_id=main_runtime.get("config_id"),
                        max_steps=agent_max_steps,
                        timeout_seconds=main_timeout
                    )
                )

            task_result = None
            multi_task_decompositions: List[Dict[str, Any]] = []
            used_runtime = main_runtime

            # 主模型执行
            main_started = perf_counter()
            task_result = await agent_service.run_task(
                task=timed_task,
                llm_config=self._runtime_to_llm_config(main_runtime, timeout_override=main_timeout),
                max_steps=agent_max_steps,
                timeout_seconds=main_timeout,
                request_id=f"chat-{session_id}-main",
                user_id=user_id,
            )
            routing_meta["timing"]["mainMs"] = int((perf_counter() - main_started) * 1000)
            await self._record_usage_event(
                user_id=user_id,
                session_id=session_id,
                config_id=main_runtime.get("config_id") or "legacy-default",
                model_id=main_runtime.get("model_id") or "",
                config_name=main_runtime.get("config_name") or "默认配置",
                path_type="main",
                is_primary=True,
                usage=task_result.get("usage") if isinstance(task_result, dict) else None,
            )

            if not task_result or not task_result.get("success"):
                if fallback_runtime:
                    fallback_started = perf_counter()
                    fallback_result = await agent_service.run_task(
                        task=timed_task,
                        llm_config=self._runtime_to_llm_config(fallback_runtime, timeout_override=fallback_timeout),
                        max_steps=agent_max_steps,
                        timeout_seconds=fallback_timeout,
                        request_id=f"chat-{session_id}-fallback",
                        user_id=user_id,
                    )
                    routing_meta["timing"]["fallbackMs"] = int((perf_counter() - fallback_started) * 1000)
                    await self._record_usage_event(
                        user_id=user_id,
                        session_id=session_id,
                        config_id=fallback_runtime.get("config_id") or "legacy-default",
                        model_id=fallback_runtime.get("model_id") or "",
                        config_name=fallback_runtime.get("config_name") or "默认配置",
                        path_type="fallback",
                        is_primary=True,
                        usage=fallback_result.get("usage") if isinstance(fallback_result, dict) else None,
                    )
                    if fallback_result and fallback_result.get("success"):
                        task_result = fallback_result
                        used_runtime = fallback_runtime
                        routing_meta["fallbackUsed"] = True
                if not task_result or not task_result.get("success"):
                    raise Exception(task_result.get("error", "Agent execution failed") if task_result else "Unknown error")

            # 强约束：任务分解意图必须有真实工具调用；若未调用则自动重试，不做伪兜底
            if require_real_decomposition_call and not self._has_real_task_decomposition_output(task_result):
                logger.warning("⚠️ 首轮未检测到 suggest_task_decomposition 真实输出，开始自动重试。")
                retry_task = (
                    f"{timed_task}\n\n"
                    "【硬性约束（必须遵守）】\n"
                    "你上一次没有成功调用 suggest_task_decomposition。\n"
                    "本次必须编写 Python 代码并实际调用 suggest_task_decomposition 工具。\n"
                    "禁止只输出文字计划；subtasks 必须是合法 JSON 字符串。\n"
                    "若不调用工具则视为失败。"
                )
                for retry_idx in range(DECOMPOSITION_TOOL_RETRY_LIMIT):
                    retry_runtime = used_runtime
                    if (
                        retry_idx >= 1 and
                        fallback_runtime and
                        used_runtime.get("config_id") != fallback_runtime.get("config_id")
                    ):
                        retry_runtime = fallback_runtime
                        routing_meta["fallbackUsed"] = True

                    retry_timeout = fallback_timeout if retry_runtime.get("config_id") == (fallback_runtime or {}).get("config_id") else main_timeout
                    retry_result = await agent_service.run_task(
                        task=retry_task,
                        llm_config=self._runtime_to_llm_config(retry_runtime, timeout_override=retry_timeout),
                        max_steps=agent_max_steps,
                        timeout_seconds=retry_timeout,
                        request_id=f"chat-{session_id}-decomp-retry-{retry_idx + 1}",
                        user_id=user_id,
                    )
                    await self._record_usage_event(
                        user_id=user_id,
                        session_id=session_id,
                        config_id=retry_runtime.get("config_id") or "legacy-default",
                        model_id=retry_runtime.get("model_id") or "",
                        config_name=retry_runtime.get("config_name") or "默认配置",
                        path_type="fallback" if fallback_runtime and retry_runtime.get("config_id") == fallback_runtime.get("config_id") else "main",
                        is_primary=True,
                        usage=retry_result.get("usage") if isinstance(retry_result, dict) else None,
                    )
                    routing_meta["retryCount"] = retry_idx + 1
                    if not retry_result or not retry_result.get("success"):
                        logger.warning(f"⚠️ 任务分解工具调用重试第 {retry_idx + 1} 次失败。")
                        continue
                    task_result = retry_result
                    used_runtime = retry_runtime
                    if self._has_real_task_decomposition_output(task_result):
                        logger.info(f"✅ 任务分解工具调用在第 {retry_idx + 1} 次重试成功。")
                        break

                if not self._has_real_task_decomposition_output(task_result):
                    raise Exception("任务分解请求未成功调用 suggest_task_decomposition 工具，请重试。")

            if require_knowledge_retrieval_call and not self._has_retrieve_knowledge_output(task_result):
                logger.warning("⚠️ 首轮未检测到 retrieve_knowledge 调用，开始自动重试。")
                retry_task = (
                    f"{timed_task}\n\n"
                    "【硬性约束（必须遵守）】\n"
                    "你上一次没有调用 retrieve_knowledge。\n"
                    "本次必须先调用 retrieve_knowledge 工具，再给出 final_answer。\n"
                    "若知识库无结果，请明确说明；不要跳过工具直接回答。"
                )
                for retry_idx in range(KNOWLEDGE_TOOL_RETRY_LIMIT):
                    retry_runtime = used_runtime
                    retry_timeout = (
                        fallback_timeout
                        if fallback_runtime and retry_runtime.get("config_id") == fallback_runtime.get("config_id")
                        else main_timeout
                    )
                    retry_result = await agent_service.run_task(
                        task=retry_task,
                        llm_config=self._runtime_to_llm_config(retry_runtime, timeout_override=retry_timeout),
                        max_steps=agent_max_steps,
                        timeout_seconds=retry_timeout,
                        request_id=f"chat-{session_id}-knowledge-retry-{retry_idx + 1}",
                        user_id=user_id,
                    )
                    await self._record_usage_event(
                        user_id=user_id,
                        session_id=session_id,
                        config_id=retry_runtime.get("config_id") or "legacy-default",
                        model_id=retry_runtime.get("model_id") or "",
                        config_name=retry_runtime.get("config_name") or "默认配置",
                        path_type="main",
                        is_primary=True,
                        usage=retry_result.get("usage") if isinstance(retry_result, dict) else None,
                    )
                    routing_meta["retryCount"] = max(int(routing_meta.get("retryCount") or 0), retry_idx + 1)
                    if not retry_result or not retry_result.get("success"):
                        logger.warning(f"⚠️ 知识检索工具调用重试第 {retry_idx + 1} 次失败。")
                        continue
                    task_result = retry_result
                    if self._has_retrieve_knowledge_output(task_result):
                        logger.info(f"✅ 知识检索工具在第 {retry_idx + 1} 次重试成功调用。")
                        break

            # 解析 Agent 返回结果 (Main Result)
            agent_result = task_result["result"]
            steps = task_result.get("steps", [])
            tool_outputs = task_result.get("tool_outputs", [])
            ai_content = str(agent_result) if agent_result else ""
            suggested_events = []
            task_decomposition = None
            batch_events = None
            rag_references = []

            logger.debug(f"DEBUG: raw agent_result: {agent_result}")
            logger.debug(f"DEBUG: tool_outputs: {tool_outputs}")
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
                    logger.debug(f"DEBUG: Found task_decomposition via tool_outputs: {task_decomposition.get('project', {}).get('name')}")
                elif suggestion_type == "batch_calendar_events":
                    batch_events = suggestion
                    for event in suggestion.get("events", []):
                        suggested_events.append(event)
                    ai_content = suggestion.get("message", ai_content)

            rag_references = self._extract_rag_references(tool_outputs)

            # 如果 agent 的 final_answer 直接返回了 dict (而没有写进 tool_outputs里)，尝试从中解析
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
                # 尝试解析可能被 stringify 的 json
                try:
                    import json
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

            if suggested_events:
                try:
                    for event in suggested_events:
                        start_str = event.get("start")
                        end_str = event.get("end")
                        if not start_str or not end_str:
                            continue
                        try:
                            start_dt = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
                            end_dt = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
                            if start_dt.tzinfo is None:
                                start_dt = start_dt.astimezone().astimezone(timezone.utc)
                            else:
                                start_dt = start_dt.astimezone(timezone.utc)
                            if end_dt.tzinfo is None:
                                end_dt = end_dt.astimezone().astimezone(timezone.utc)
                            else:
                                end_dt = end_dt.astimezone(timezone.utc)
                        except ValueError:
                            continue

                        query = {
                            "userId": user_id,
                            "status": {"$ne": "cancelled"},
                            "$or": [
                                {"start": {"$lt": end_dt}, "end": {"$gt": start_dt}},
                            ]
                        }

                        conflicts_cursor = db.db["calendar_events"].find(query)
                        conflicting_events = []
                        async for conflict in conflicts_cursor:
                            conflict["_id"] = str(conflict["_id"])
                            if isinstance(conflict.get("start"), datetime):
                                conflict["start"] = conflict["start"].isoformat()
                            if isinstance(conflict.get("end"), datetime):
                                conflict["end"] = conflict["end"].isoformat()
                            conflicting_events.append(conflict)

                        if conflicting_events:
                            event["conflicts"] = conflicting_events
                            logger.warning(f"⚠️ Found {len(conflicting_events)} conflicts for event '{event.get('title')}'")
                except Exception as e:
                    logger.error(f"❌ Conflict check failed: {e}")

            if not suggested_events and not task_decomposition and agent_result:
                ai_content = str(agent_result)

            ai_message_id = None
            try:
                save_kwargs = {}
                if task_decomposition:
                    save_kwargs["taskDecomposition"] = task_decomposition
                if multi_task_decompositions:
                    save_kwargs["multiTaskDecompositions"] = multi_task_decompositions
                if suggested_events:
                    save_kwargs["suggestedEvents"] = suggested_events
                if timing_strategy:
                    save_kwargs["timingStrategy"] = timing_strategy
                if timing_strategy.get("analysisMeta"):
                    save_kwargs["taskAnalysis"] = timing_strategy.get("analysisMeta")
                if rag_references:
                    save_kwargs["ragReferences"] = rag_references

                ai_message_id = await self.save_message(session_id, "ai", ai_content, **save_kwargs)
            except Exception as e:
                logger.error(f"Failed to save AI message: {e}")

            logger.info(f"日程建议数量: {len(suggested_events)}")
            logger.info(f"任务分解: {'有' if task_decomposition else '无'}")
            logger.info(f"Agent 步骤数: {len(steps)}")
            routing_meta["timing"]["totalMs"] = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)

            response_data = {
                "response": ai_content,
                "messageId": ai_message_id,
                "emotionScore": 7,
                "emotionTags": ["helpful"],
                "needsEmotionInput": False,
                "suggestedEvents": suggested_events,
                "taskResult": {
                    "hasTasks": len(suggested_events) > 0,
                    "tasks": []
                },
                "sessionId": session_id,
                "multiTaskDecompositions": multi_task_decompositions if multi_task_decompositions else None,
                "timingStrategy": timing_strategy,
                "taskAnalysis": timing_strategy.get("analysisMeta") if timing_strategy else None,
                "ragReferences": rag_references,
                "routingMeta": routing_meta if settings.ENABLE_ROUTING_META else None
            }

            if task_decomposition:
                response_data["taskDecomposition"] = task_decomposition
            if batch_events:
                response_data["batchEvents"] = batch_events

            if timing_strategy.get("profileKey"):
                elapsed_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
                await task_timing_service.record_execution(
                    user_id=user_id,
                    profile_key=timing_strategy["profileKey"],
                    duration_ms=elapsed_ms,
                    success=True
                )

            return ChatResponse(success=True, data=response_data)

        except Exception as e:
            logger.error(f"Chat Error: {e}")
            routing_meta["timing"]["totalMs"] = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
            error_text = str(e) if e else ""
            if "suggest_task_decomposition" in error_text:
                user_facing_message = "抱歉，本次未成功调用任务分解工具。系统已自动重试，请再发送一次，我会继续重试并确保生成任务分解卡片。"
            else:
                user_facing_message = "抱歉，发生了一些错误。"

            if timing_strategy.get("profileKey"):
                elapsed_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
                await task_timing_service.record_execution(
                    user_id=user_id,
                    profile_key=timing_strategy["profileKey"],
                    duration_ms=elapsed_ms,
                    success=False
                )
            return ChatResponse(
                success=False,
                data=ChatResponseData(
                    response=user_facing_message,
                    sessionId=session_id,
                    timingStrategy=timing_strategy if timing_strategy else None,
                    taskAnalysis=timing_strategy.get("analysisMeta") if timing_strategy else None,
                    routingMeta=routing_meta if settings.ENABLE_ROUTING_META else None
                ).dict(),
                error={
                    "message": f"处理请求错误: {str(e)}",
                    "type": "unknown"
                }
            )

    async def test_connection(self, config: LLMTestRequest, user_id: str) -> Dict[str, Any]:
        try:
            # Handle masked API key for testing
            target_api_key = config.apiKey
            if target_api_key and "******" in target_api_key:
                # If masked, try to use the stored API key from user config
                user_conf = await self._get_user_llm_config(user_id)
                target_api_key = user_conf["api_key"]
                
            messages = [{"role": "user", "content": "Hello"}]
            result = await llm_service.chat_completion(
                messages=messages,
                model=config.modelId,
                api_key=target_api_key,
                api_base=config.baseUrl,
                timeout=float(config.timeout or 60),
                max_tokens=10
            )
            
            if not result or "choices" not in result or not result["choices"]:
                raise Exception("LLM returned unexpected response format")
                
            return {
                "success": True, 
                "message": "连接测试成功", 
                "model": config.modelId,
                "baseUrl": config.baseUrl,
                "response": result["choices"][0]["message"]["content"],
                "responseLength": len(result["choices"][0]["message"]["content"])
            }
        except Exception as e:
            return {
                "success": False, 
                "error": str(e),
                "errorType": "connection",
                "details": str(e)
            }

chat_business = ChatBusiness()
