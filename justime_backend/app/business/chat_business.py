import asyncio
import logging
import json
from datetime import datetime, timezone
from time import perf_counter
from typing import Dict, Any, List, Optional, AsyncGenerator, Set

from fastapi import HTTPException, status

from app.models.chat import ChatRequest, ChatResponse, ChatResponseData, LLMTestRequest, ChatStreamRequest
from app.models.history import ChatSession, ChatMessage
from app.database import db
from app.services.user_service import UserService
from app.services.task_timing_service import task_timing_service
from app.services.task_classifier_service import task_classifier_service
from app.services.model_router_service import model_router_service
from app.services.openclaw_service import openclaw_service
from app.services.llm_service import llm_service, STREAM_READ_TIMEOUT, STREAM_TOTAL_TIMEOUT
from app.services.sse_stream_service import (
    sse_stream_service,
    SSEStreamContext,
    SSEEventRecord,
    SSEStreamError,
    SSE_PRODUCER_HEARTBEAT_INTERVAL,
)
from app.core.config import settings

from app.business.chat_persistence import chat_persistence
from app.business.chat_router import chat_router, COMPLEX_TASK_KEYWORDS
from app.business.chat_assembler import chat_assembler
from app.business.chat_executor import chat_executor

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


class ChatBusiness:
    _producer_tasks: Set[asyncio.Task] = set()

    async def create_session(self, user_id: str, title: str) -> str:
        return await chat_persistence.create_session(user_id, title)

    async def save_message(self, session_id: str, role: str, content: str, **kwargs) -> str:
        return await chat_persistence.save_message(session_id, role, content, **kwargs)

    async def _sync_task_evidence_from_chat(
        self,
        *,
        user_id: str,
        task_id: Optional[str],
        session_id: str,
        role: str,
        message_id: str,
        content: str,
    ) -> None:
        if not task_id or not content.strip():
            logger.debug("Skipping chat Evidence for unbound or empty %s message", role)
            return

        from app.business.task_process_business import _task_process_business
        from app.models.evidence import EvidenceCreate

        source_by_role = {
            "user": "chat:user",
            "assistant": "chat:assistant",
        }
        if role not in source_by_role:
            raise ValueError(f"Unsupported chat Evidence role: {role}")

        payload = EvidenceCreate(
            task_id=task_id,
            type="chat",
            title="用户对话" if role == "user" else "AI 回复",
            content=content,
            source=source_by_role[role],
            source_id=message_id,
            metadata={"role": role},
        )
        await _task_process_business.create_evidence(
            user_id,
            payload,
            ai_extracted=False,
        )
        await db.db.task_processes.update_one(
            {
                "_id": _task_process_business._ensure_object_id(task_id, "任务ID"),
                "userId": user_id,
            },
            {
                "$addToSet": {"related_chat_session_ids": session_id},
                "$set": {"updatedAt": datetime.now(timezone.utc)},
            },
        )

    async def update_message_interactive_state(self, message_id: str, updates: Dict[str, Any]):
        return await chat_persistence.update_message_interactive_state(message_id, updates)

    async def get_user_sessions(self, user_id: str) -> List[dict]:
        return await chat_persistence.get_user_sessions(user_id)

    async def get_session_messages(self, session_id: str, limit: int = 200) -> List[dict]:
        return await chat_persistence.get_session_messages(session_id, limit)

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
            taskId=request.taskId,
            taskAnalysis={
                "source": "openclaw",
                "taskType": request.taskType or "general",
            },
        )
        await self._sync_task_evidence_from_chat(
            user_id=user_id,
            task_id=request.taskId,
            session_id=session_id,
            role="assistant",
            message_id=ai_message_id,
            content=openclaw_result.text,
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
                "routingMeta": routing_meta if settings.ENABLE_ROUTING_META else None,
            },
        )

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
        await chat_executor.record_usage_event(
            user_id=user_id,
            session_id=session_id,
            config_id=config_id,
            model_id=model_id,
            config_name=config_name,
            path_type=path_type,
            is_primary=is_primary,
            usage=usage,
            message_id=message_id
        )

    async def _get_user_llm_config(self, user_id: str) -> Dict[str, Any]:
        return await chat_router.get_user_llm_config(user_id)

    async def process_chat(self, request: ChatRequest, user_id: str) -> ChatResponse:
        started_at = datetime.now(timezone.utc)
        timing_strategy: Dict[str, Any] = {}
        routing_meta: Dict[str, Any] = {
            "routeMode": chat_router.normalize_route_mode(request.routeMode),
            "routerEnabled": bool(settings.ROUTER_ENABLED),
            "classifierModel": None,
            "mainModel": None,
            "fallbackModel": None,
            "fallbackUsed": False,
            "routeReason": "",
            "retryCount": 0,
            "timing": {}
        }

        config_dict, system_configs, active_id = await asyncio.gather(
            self._get_user_llm_config(user_id),
            UserService.get_available_models_for_user(user_id),
            UserService.get_user_active_model_id(user_id),
        )
        runtime_configs = chat_router.build_runtime_model_candidates(system_configs, active_id, config_dict)

        session_id = request.sessionId
        if not session_id:
            title = request.message[:20]
            session_id = await self.create_session(user_id, title)

        try:
            user_message_id = await self.save_message(
                session_id,
                "user",
                request.message,
                taskId=request.taskId,
            )
        except Exception as e:
            logger.error(f"Failed to save user message: {e}")
        else:
            await self._sync_task_evidence_from_chat(
                user_id=user_id,
                task_id=request.taskId,
                session_id=session_id,
                role="user",
                message_id=user_message_id,
                content=request.message,
            )

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
                logger.error(f"OpenClaw Chat Error: {exc}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="OpenClaw 特殊任务链路执行失败，请检查部署配置后重试"
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
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="平台尚未配置可用的 AI 模型，请联系管理员添加"
            )

        if request.runtimeModelId:
            requested_model = str(request.runtimeModelId).strip()
            allowed = any(
                str(item.get("model_id") or "").strip() == requested_model
                for item in runtime_configs
            )
            if not allowed:
                denied_message = "你当前无权访问该模型，请联系管理员分配模型权限。"
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=denied_message
                )

        try:
            route_mode = chat_router.normalize_route_mode(request.routeMode)
            allow_reasoning_fallback = True if request.allowReasoningFallback is None else bool(request.allowReasoningFallback)

            classifier_started = perf_counter()
            classifier_runtime = None
            if settings.ROUTER_ENABLED:
                classifier_runtime = model_router_service.pick_classifier_config(runtime_configs, active_id)
            if not classifier_runtime:
                classifier_runtime = next((c for c in runtime_configs if c.get("is_active")), runtime_configs[0])

            classifier_timeout = max(1, int(settings.ROUTER_CLASSIFIER_TIMEOUT_SECONDS))
            classifier_llm_config = chat_router.runtime_to_llm_config(classifier_runtime, timeout_override=classifier_timeout)
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

            user_profile = await UserService.get_user_profile(user_id)
            user_habits_context = chat_router.build_user_habits_context(user_profile)
            enhanced_task = chat_assembler.build_enhanced_task(request.message, request.useWebSearch)
            context_window = int(timing_strategy.get("contextWindowMessages", 8))
            recent_context = await chat_persistence.build_recent_context(session_id, context_window)
            timed_task = chat_router.wrap_task_with_timing(
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
            intent_info = chat_router.detect_schedule_component_intent(request.message)
            require_real_decomposition_call = bool(intent_info.get("prefer_decomposition"))
            require_knowledge_retrieval_call = False

            if request.runtimeModelId:
                requested_model = str(request.runtimeModelId).strip()
                main_runtime = next((c for c in runtime_configs if c.get("model_id") == requested_model), None)
                if not main_runtime:
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

            has_complex_task = (
                any(kw in request.message for kw in COMPLEX_TASK_KEYWORDS) or
                (task_type == "thinking" and difficulty_level >= 4)
            )
            if settings.ENABLE_PARALLEL_ENSEMBLE and has_complex_task and len(runtime_configs) > 1:
                asyncio.create_task(
                    chat_executor.run_shadow_ensemble(
                        user_id=user_id,
                        session_id=session_id,
                        timed_task=timed_task,
                        runtime_configs=runtime_configs,
                        skip_config_id=main_runtime.get("config_id"),
                        max_steps=agent_max_steps,
                        timeout_seconds=main_timeout,
                        runtime_to_llm_config_fn=chat_router.runtime_to_llm_config
                    )
                )

            task_result = None
            multi_task_decompositions: List[Dict[str, Any]] = []
            used_runtime = main_runtime

            main_result = await chat_executor.execute_main_task(
                timed_task=timed_task,
                session_id=session_id,
                user_id=user_id,
                main_runtime=main_runtime,
                main_timeout=main_timeout,
                agent_max_steps=agent_max_steps,
                runtime_to_llm_config_fn=chat_router.runtime_to_llm_config
            )
            task_result = main_result["task_result"]
            routing_meta["timing"]["mainMs"] = main_result["main_ms"]
            
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
                    fallback_result = await chat_executor.execute_fallback_task(
                        timed_task=timed_task,
                        session_id=session_id,
                        user_id=user_id,
                        fallback_runtime=fallback_runtime,
                        fallback_timeout=fallback_timeout,
                        agent_max_steps=agent_max_steps,
                        runtime_to_llm_config_fn=chat_router.runtime_to_llm_config
                    )
                    routing_meta["timing"]["fallbackMs"] = fallback_result["fallback_ms"]
                    await self._record_usage_event(
                        user_id=user_id,
                        session_id=session_id,
                        config_id=fallback_runtime.get("config_id") or "legacy-default",
                        model_id=fallback_runtime.get("model_id") or "",
                        config_name=fallback_runtime.get("config_name") or "默认配置",
                        path_type="fallback",
                        is_primary=True,
                        usage=fallback_result["task_result"].get("usage") if isinstance(fallback_result.get("task_result"), dict) else None,
                    )
                    if fallback_result["task_result"] and fallback_result["task_result"].get("success"):
                        task_result = fallback_result["task_result"]
                        used_runtime = fallback_runtime
                        routing_meta["fallbackUsed"] = True
                if not task_result or not task_result.get("success"):
                    raise Exception(task_result.get("error", "Agent execution failed") if task_result else "Unknown error")

            if require_real_decomposition_call and not chat_assembler.has_real_task_decomposition_output(task_result):
                logger.warning("⚠️ 首轮未检测到 suggest_task_decomposition 真实输出，开始自动重试。")
                retry_result = await chat_executor.execute_decomposition_retry(
                    timed_task=timed_task,
                    session_id=session_id,
                    user_id=user_id,
                    used_runtime=used_runtime,
                    fallback_runtime=fallback_runtime,
                    main_timeout=main_timeout,
                    fallback_timeout=fallback_timeout,
                    agent_max_steps=agent_max_steps,
                    runtime_to_llm_config_fn=chat_router.runtime_to_llm_config,
                    has_real_decomposition_fn=chat_assembler.has_real_task_decomposition_output
                )
                
                if retry_result["task_result"]:
                    await self._record_usage_event(
                        user_id=user_id,
                        session_id=session_id,
                        config_id=retry_result["used_runtime"].get("config_id") or "legacy-default",
                        model_id=retry_result["used_runtime"].get("model_id") or "",
                        config_name=retry_result["used_runtime"].get("config_name") or "默认配置",
                        path_type="fallback" if fallback_runtime and retry_result["used_runtime"].get("config_id") == fallback_runtime.get("config_id") else "main",
                        is_primary=True,
                        usage=retry_result["task_result"].get("usage") if isinstance(retry_result["task_result"], dict) else None,
                    )
                    routing_meta["retryCount"] = retry_result["retry_count"]
                    task_result = retry_result["task_result"]
                    used_runtime = retry_result["used_runtime"]
                    if fallback_runtime and retry_result["used_runtime"].get("config_id") == fallback_runtime.get("config_id"):
                        routing_meta["fallbackUsed"] = True

                if not chat_assembler.has_real_task_decomposition_output(task_result):
                    raise Exception("任务分解请求未成功调用 suggest_task_decomposition 工具，请重试。")

            agent_result = task_result["result"]
            steps = task_result.get("steps", [])
            tool_outputs = task_result.get("tool_outputs", [])
            
            parsed = chat_assembler.parse_agent_result(agent_result, tool_outputs)
            ai_content = parsed["ai_content"]
            suggested_events = parsed["suggested_events"]
            task_decomposition = parsed["task_decomposition"]
            batch_events = parsed["batch_events"]
            
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
                save_kwargs["taskId"] = request.taskId
                ai_message_id = await self.save_message(session_id, "ai", ai_content, **save_kwargs)
            except Exception as e:
                logger.error(f"Failed to save AI message: {e}")
            else:
                await self._sync_task_evidence_from_chat(
                    user_id=user_id,
                    task_id=request.taskId,
                    session_id=session_id,
                    role="assistant",
                    message_id=ai_message_id,
                    content=ai_content,
                )

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

            if timing_strategy.get("profileKey"):
                elapsed_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
                await task_timing_service.record_execution(
                    user_id=user_id,
                    profile_key=timing_strategy["profileKey"],
                    duration_ms=elapsed_ms,
                    success=False
                )
            
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"处理请求错误: {error_text}"
            )

    async def process_chat_stream(
        self,
        request: ChatStreamRequest,
        user_id: str,
        last_event_id: str = "",
    ) -> AsyncGenerator[str, None]:
        """Stream persisted SSE records, resuming strictly after the supplied ID."""
        if last_event_id:
            resume = await sse_stream_service.validate_resume(
                last_event_id,
                user_id,
                request.sessionId,
            )
            if resume.error_code or resume.context is None:
                yield self._format_sse_event(
                    "error",
                    self._stream_error_payload(resume.error_code or "stream_expired"),
                )
                return

            async for event in self._subscribe_to_stream(
                resume.context.stream_id,
                resume.after_seq,
            ):
                yield event
            return

        started_at = datetime.now(timezone.utc)
        session_id = request.sessionId
        try:
            if not session_id:
                session_id = await self.create_session(user_id, request.message[:20])

            config_dict, system_configs, active_id = await asyncio.gather(
                self._get_user_llm_config(user_id),
                UserService.get_available_models_for_user(user_id),
                UserService.get_user_active_model_id(user_id),
            )
            runtime_configs = chat_router.build_runtime_model_candidates(system_configs, active_id, config_dict)

            if not runtime_configs:
                yield self._format_sse_event(
                    "error",
                    {
                        "code": "model_unavailable",
                        "message": "平台尚未配置可用的 AI 模型，请联系管理员添加",
                        "canResume": False,
                    },
                )
                return

            runtime_config = None
            if request.runtimeModelId:
                requested_model = str(request.runtimeModelId).strip()
                runtime_config = next(
                    (c for c in runtime_configs if c.get("model_id") == requested_model),
                    None
                )
            if not runtime_config:
                runtime_config = next(
                    (c for c in runtime_configs if c.get("is_active")),
                    runtime_configs[0]
                )

            llm_config = chat_router.runtime_to_llm_config(
                runtime_config,
                timeout_override=STREAM_TOTAL_TIMEOUT
            )

            recent_context = await chat_persistence.build_recent_context(session_id, 8)
            user_message_id = await self.save_message(
                session_id,
                "user",
                request.message,
                taskId=request.taskId,
            )
            await self._sync_task_evidence_from_chat(
                user_id=user_id,
                task_id=request.taskId,
                session_id=session_id,
                role="user",
                message_id=user_message_id,
                content=request.message,
            )

            messages: List[Dict[str, str]] = []
            if recent_context:
                messages.append({"role": "system", "content": f"Recent conversation:\n{recent_context}"})
            messages.append({"role": "user", "content": request.message})

            from bson import ObjectId
            stream_id = str(ObjectId())
            stream_context = SSEStreamContext(
                stream_id=stream_id,
                session_id=session_id,
                message_id=stream_id,
                user_id=user_id,
                model_id=llm_config.model_id,
                messages=messages,
                created_at=started_at.isoformat(),
            )
            if not await sse_stream_service.create_stream(stream_context):
                yield self._format_sse_event(
                    "error",
                    self._stream_error_payload("stream_storage_unavailable"),
                )
                return

            lease_token = await sse_stream_service.acquire_producer_lease(stream_id)
            if not lease_token:
                await sse_stream_service.append_event(
                    stream_id,
                    "error",
                    self._stream_error_payload("producer_unavailable"),
                )
            else:
                await sse_stream_service.append_event(
                    stream_id,
                    "metadata",
                    {
                        "sessionId": session_id,
                        "messageId": stream_id,
                        "model": llm_config.model_id,
                        "resumed": False,
                        "resumedTokenIndex": 0,
                    },
                )
                self._start_stream_producer(
                    request=request,
                    user_id=user_id,
                    session_id=session_id,
                    stream_id=stream_id,
                    messages=messages,
                    runtime_config=runtime_config,
                    llm_config=llm_config,
                    lease_token=lease_token,
                    started_at=started_at,
                )

            async for event in self._subscribe_to_stream(stream_id, 0):
                yield event
        except SSEStreamError as exc:
            yield self._format_sse_event("error", self._stream_error_payload(exc.code))
        except Exception as exc:
            logger.error("Failed to initialize SSE stream: %s", exc, exc_info=True)
            yield self._format_sse_event(
                "error",
                self._stream_error_payload("stream_initialization_failed"),
            )

    def _start_stream_producer(
        self,
        **kwargs: Any,
    ) -> None:
        task = asyncio.create_task(self._run_stream_producer(**kwargs))
        self._producer_tasks.add(task)
        task.add_done_callback(self._producer_tasks.discard)

    async def _subscribe_to_stream(
        self,
        stream_id: str,
        after_seq: int,
    ) -> AsyncGenerator[str, None]:
        try:
            async for record in sse_stream_service.subscribe(stream_id, after_seq):
                yield self._format_persisted_sse_event(record)
        except SSEStreamError as exc:
            yield self._format_sse_event("error", self._stream_error_payload(exc.code))

    async def _run_stream_producer(
        self,
        *,
        request: ChatStreamRequest,
        user_id: str,
        session_id: str,
        stream_id: str,
        messages: List[Dict[str, str]],
        runtime_config: Dict[str, Any],
        llm_config: Any,
        lease_token: str,
        started_at: datetime,
    ) -> None:
        accumulated_content = ""
        token_count = 0
        usage_stats = {"promptTokens": 0, "completionTokens": 0, "totalTokens": 0}
        lease_lost = asyncio.Event()
        heartbeat_task = asyncio.create_task(
            self._heartbeat_stream_producer(stream_id, lease_token, lease_lost)
        )

        try:
            async for chunk in llm_service.chat_completion_stream(
                messages=messages,
                model=llm_config.model_id,
                api_key=llm_config.api_key,
                api_base=llm_config.api_base,
                temperature=0.7,
                read_timeout=STREAM_READ_TIMEOUT,
                total_timeout=STREAM_TOTAL_TIMEOUT,
            ):
                if lease_lost.is_set():
                    raise SSEStreamError("producer_lease_lost")

                content_delta = self._extract_stream_content(chunk)
                if content_delta:
                    await sse_stream_service.append_event(
                        stream_id,
                        "token",
                        {"content": content_delta},
                    )
                    accumulated_content += content_delta
                    token_count += 1

                usage = self._extract_stream_usage(chunk)
                if usage:
                    usage_stats = usage

            if lease_lost.is_set():
                raise SSEStreamError("producer_lease_lost")

            ai_message_id = await self.save_message(
                session_id,
                "ai",
                accumulated_content,
                taskId=request.taskId,
            )
            await self._sync_task_evidence_from_chat(
                user_id=user_id,
                task_id=request.taskId,
                session_id=session_id,
                role="assistant",
                message_id=ai_message_id,
                content=accumulated_content,
            )

            try:
                await self._record_usage_event(
                    user_id=user_id,
                    session_id=session_id,
                    config_id=runtime_config.get("config_id") or "stream-default",
                    model_id=llm_config.model_id,
                    config_name=runtime_config.get("config_name") or "流式配置",
                    path_type="stream",
                    is_primary=True,
                    usage=usage_stats,
                    message_id=ai_message_id,
                )
            except Exception as exc:
                logger.warning("Failed to record stream usage: %s", exc)

            await sse_stream_service.append_event(stream_id, "usage", usage_stats)
            await sse_stream_service.append_event(
                stream_id,
                "done",
                {
                    "messageId": ai_message_id,
                    "totalMs": int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000),
                    "totalTokens": token_count,
                },
            )
        except asyncio.TimeoutError:
            await self._append_stream_error(stream_id, "stream_timeout")
        except SSEStreamError as exc:
            if exc.code != "producer_lease_lost":
                logger.warning("SSE producer storage failure for %s: %s", stream_id, exc.code)
        except Exception as exc:
            logger.error("SSE provider failed for %s: %s", stream_id, exc, exc_info=True)
            await self._append_stream_error(stream_id, "provider_stream_failed")
        finally:
            heartbeat_task.cancel()
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass
            await sse_stream_service.release_producer_lease(stream_id, lease_token)

    async def _heartbeat_stream_producer(
        self,
        stream_id: str,
        lease_token: str,
        lease_lost: asyncio.Event,
    ) -> None:
        while True:
            await asyncio.sleep(SSE_PRODUCER_HEARTBEAT_INTERVAL)
            if not await sse_stream_service.heartbeat_producer_lease(stream_id, lease_token):
                lease_lost.set()
                return

    async def _append_stream_error(self, stream_id: str, code: str) -> None:
        try:
            await sse_stream_service.append_event(
                stream_id,
                "error",
                self._stream_error_payload(code),
            )
        except SSEStreamError as exc:
            logger.warning("Unable to persist terminal SSE error for %s: %s", stream_id, exc.code)

    @staticmethod
    def _format_persisted_sse_event(record: SSEEventRecord) -> str:
        return ChatBusiness._format_sse_event(record.event, record.data, record.id)

    @staticmethod
    def _stream_error_payload(code: str) -> Dict[str, Any]:
        messages = {
            "invalid_last_event_id": "断点标识无效，请重新发送消息",
            "stream_expired": "断点记录已过期，请重新发送消息",
            "foreign_stream": "无权恢复该响应流",
            "event_log_compacted": "断点记录已被清理，请重新发送消息",
            "stream_storage_unavailable": "响应续传服务暂不可用，请稍后重试",
            "producer_unavailable": "响应生成已中断，请重新发送消息",
            "producer_lease_lost": "响应生成协调已中断，请重新发送消息",
            "stream_timeout": "响应超时，请重新发送消息",
            "provider_stream_failed": "模型响应失败，请稍后重试",
            "stream_initialization_failed": "无法启动响应流，请稍后重试",
        }
        return {
            "code": code,
            "message": messages.get(code, "响应流发生错误，请重新发送消息"),
            "canResume": False,
        }

    @staticmethod
    def _format_sse_event(
        event: str,
        data: Dict[str, Any],
        event_id: Optional[str] = None
    ) -> str:
        """
        格式化SSE事件

        Args:
            event: 事件类型
            data: 事件数据
            event_id: 可选的事件ID，用于断点续传

        Returns:
            格式化的SSE事件字符串
        """
        lines = [f"event: {event}"]
        if event_id:
            lines.append(f"id: {event_id}")
        lines.append(f"data: {json.dumps(data, ensure_ascii=False)}")
        return "\n".join(lines) + "\n\n"

    @staticmethod
    def _extract_stream_content(chunk: Dict[str, Any]) -> Optional[str]:
        """从流式chunk中提取内容"""
        try:
            choices = chunk.get("choices", [])
            if choices:
                delta = choices[0].get("delta", {})
                return delta.get("content")
        except Exception:
            logger.warning("Failed to extract stream content from chunk", exc_info=True)
        return None

    @staticmethod
    def _extract_stream_usage(chunk: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """从流式chunk中提取usage信息"""
        try:
            usage = chunk.get("usage")
            if usage:
                return {
                    "promptTokens": usage.get("prompt_tokens", 0),
                    "completionTokens": usage.get("completion_tokens", 0),
                    "totalTokens": usage.get("total_tokens", 0),
                }
        except Exception:
            logger.warning("Failed to extract stream usage from chunk", exc_info=True)
        return None

    async def test_connection(self, config: LLMTestRequest, user_id: str) -> Dict[str, Any]:
        try:
            result = await chat_executor.test_connection(
                model_id=config.modelId,
                api_key=config.apiKey,
                base_url=config.baseUrl,
                timeout=config.timeout or 60,
                user_id=user_id,
                get_user_llm_config_fn=self._get_user_llm_config
            )
            if not result.get("success"):
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=result.get("error", "LLM 连接测试失败")
                )
            return result
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"LLM 连接测试失败: {str(e)}"
            )


chat_business = ChatBusiness()
