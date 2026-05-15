"""Chat retry service for handling model fallback and retries."""

from time import perf_counter
from typing import Dict, Any, Optional
from app.services.agent_service import agent_service
from app.services.user_service import UserService

# Retry limits
DECOMPOSITION_TOOL_RETRY_LIMIT = 2
KNOWLEDGE_TOOL_RETRY_LIMIT = 1


class ChatRetryService:
    """Handles retry logic for model execution."""

    def __init__(self):
        """Initialize the retry service."""
        self.runtime_to_llm_config = None  # Will be set by ChatBusiness

    async def run_with_fallback(
        self,
        timed_task: str,
        main_runtime: Dict[str, Any],
        fallback_runtime: Optional[Dict[str, Any]],
        agent_max_steps: int,
        main_timeout: float,
        fallback_timeout: float,
        session_id: str,
        user_id: str,
        routing_meta: Dict[str, Any]
    ) -> tuple:
        """Execute main model, fallback to backup model on failure.

        Args:
            timed_task: Task to execute
            main_runtime: Main runtime config
            fallback_runtime: Fallback runtime config (optional)
            agent_max_steps: Max agent steps
            main_timeout: Main model timeout
            fallback_timeout: Fallback model timeout
            session_id: Session ID
            user_id: User ID
            routing_meta: Routing metadata dict

        Returns:
            Tuple of (task_result, used_runtime)
        """
        task_result = None
        used_runtime = main_runtime

        main_started = perf_counter()
        task_result = await agent_service.run_task(
            task=timed_task,
            llm_config=self.runtime_to_llm_config(main_runtime, timeout_override=main_timeout),
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
                task_result, used_runtime = await self._try_fallback(
                    timed_task, fallback_runtime, agent_max_steps, fallback_timeout,
                    session_id, user_id, routing_meta, task_result
                )

        return task_result, used_runtime

    async def _try_fallback(
        self,
        timed_task: str,
        fallback_runtime: Dict[str, Any],
        agent_max_steps: int,
        fallback_timeout: float,
        session_id: str,
        user_id: str,
        routing_meta: Dict[str, Any],
        main_result: Optional[Dict[str, Any]]
    ) -> tuple:
        """Try executing with fallback model.

        Args:
            timed_task: Task to execute
            fallback_runtime: Fallback runtime config
            agent_max_steps: Max agent steps
            fallback_timeout: Fallback timeout
            session_id: Session ID
            user_id: User ID
            routing_meta: Routing metadata
            main_result: Result from main model (if any)

        Returns:
            Tuple of (result, used_runtime)
        """
        fallback_started = perf_counter()
        fallback_result = await agent_service.run_task(
            task=timed_task,
            llm_config=self.runtime_to_llm_config(fallback_runtime, timeout_override=fallback_timeout),
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
            routing_meta["fallbackUsed"] = True
            return fallback_result, fallback_runtime
        return main_result, fallback_runtime

    async def retry_decomposition_call(
        self,
        timed_task: str,
        task_result: Dict[str, Any],
        used_runtime: Dict[str, Any],
        fallback_runtime: Optional[Dict[str, Any]],
        agent_max_steps: int,
        main_timeout: float,
        fallback_timeout: float,
        session_id: str,
        user_id: str,
        routing_meta: Dict[str, Any],
        has_real_decomposition_output_func
    ) -> Dict[str, Any]:
        """Retry task decomposition tool call.

        Args:
            timed_task: Original task
            task_result: Previous task result
            used_runtime: Runtime that was used
            fallback_runtime: Fallback runtime config
            agent_max_steps: Max agent steps
            main_timeout: Main timeout
            fallback_timeout: Fallback timeout
            session_id: Session ID
            user_id: User ID
            routing_meta: Routing metadata
            has_real_decomposition_output_func: Function to check for real decomposition output

        Returns:
            Successful task result

        Raises:
            Exception: If retry fails
        """
        print("⚠️ 首轮未检测到 suggest_task_decomposition 真实输出，开始自动重试。")
        retry_task = (
            f"{timed_task}\n\n"
            "【硬性约束（必须遵守）】\n"
            "你上一次没有成功调用 suggest_task_decomposition。\n"
            "本次必须编写 Python 代码并实际调用 suggest_task_decomposition 工具。\n"
            "禁止只输出文字计划；subtasks 必须是合法 JSON 字符串。\n"
            "若不调用工具则视为失败。"
        )
        for retry_idx in range(DECOMPOSITION_TOOL_RETRY_LIMIT):
            retry_runtime, retry_timeout = self._pick_retry_runtime(
                retry_idx, used_runtime, fallback_runtime, main_timeout, fallback_timeout
            )
            if retry_runtime != used_runtime:
                routing_meta["fallbackUsed"] = True

            retry_result = await self._execute_retry(
                retry_task, retry_runtime, retry_timeout, agent_max_steps,
                session_id, user_id, routing_meta, retry_idx, "decomp"
            )
            if retry_result and retry_result.get("success"):
                if has_real_decomposition_output_func(retry_result):
                    print(f"✅ 任务分解工具调用在第 {retry_idx + 1} 次重试成功。")
                    return retry_result
            print(f"⚠️ 任务分解工具调用重试第 {retry_idx + 1} 次失败。")

        raise Exception("任务分解请求未成功调用 suggest_task_decomposition 工具，请重试。")

    async def retry_knowledge_call(
        self,
        timed_task: str,
        task_result: Dict[str, Any],
        used_runtime: Dict[str, Any],
        fallback_runtime: Optional[Dict[str, Any]],
        agent_max_steps: int,
        main_timeout: float,
        fallback_timeout: float,
        session_id: str,
        user_id: str,
        routing_meta: Dict[str, Any],
        has_retrieve_knowledge_output_func
    ) -> Dict[str, Any]:
        """Retry knowledge retrieval tool call.

        Args:
            timed_task: Original task
            task_result: Previous task result
            used_runtime: Runtime that was used
            fallback_runtime: Fallback runtime config
            agent_max_steps: Max agent steps
            main_timeout: Main timeout
            fallback_timeout: Fallback timeout
            session_id: Session ID
            user_id: User ID
            routing_meta: Routing metadata
            has_retrieve_knowledge_output_func: Function to check for knowledge retrieval output

        Returns:
            Task result (successful retry or original)
        """
        print("⚠️ 首轮未检测到 retrieve_knowledge 调用，开始自动重试。")
        retry_task = (
            f"{timed_task}\n\n"
            "【硬性约束（必须遵守）】\n"
            "你上一次没有调用 retrieve_knowledge。\n"
            "本次必须先调用 retrieve_knowledge 工具，再给出 final_answer。\n"
            "若知识库无结果，请明确说明；不要跳过工具直接回答。"
        )
        for retry_idx in range(KNOWLEDGE_TOOL_RETRY_LIMIT):
            retry_runtime, retry_timeout = self._pick_retry_runtime(
                retry_idx, used_runtime, fallback_runtime, main_timeout, fallback_timeout
            )
            retry_result = await self._execute_retry(
                retry_task, retry_runtime, retry_timeout, agent_max_steps,
                session_id, user_id, routing_meta, retry_idx, "knowledge"
            )
            if retry_result and retry_result.get("success"):
                if has_retrieve_knowledge_output_func(retry_result):
                    print(f"✅ 知识检索工具在第 {retry_idx + 1} 次重试成功调用。")
                    return retry_result

        return task_result

    def _pick_retry_runtime(
        self,
        retry_idx: int,
        used_runtime: Dict[str, Any],
        fallback_runtime: Optional[Dict[str, Any]],
        main_timeout: float,
        fallback_timeout: float
    ) -> tuple:
        """Choose runtime config for retry.

        Args:
            retry_idx: Current retry index
            used_runtime: Currently used runtime
            fallback_runtime: Fallback runtime config
            main_timeout: Main timeout
            fallback_timeout: Fallback timeout

        Returns:
            Tuple of (retry_runtime, retry_timeout)
        """
        retry_runtime = used_runtime
        retry_timeout = main_timeout
        if (
            retry_idx >= 1 and
            fallback_runtime and
            used_runtime.get("config_id") != fallback_runtime.get("config_id")
        ):
            retry_runtime = fallback_runtime
            retry_timeout = fallback_timeout
        return retry_runtime, retry_timeout

    async def _execute_retry(
        self,
        retry_task: str,
        retry_runtime: Dict[str, Any],
        retry_timeout: float,
        agent_max_steps: int,
        session_id: str,
        user_id: str,
        routing_meta: Dict[str, Any],
        retry_idx: int,
        retry_type: str
    ) -> Optional[Dict[str, Any]]:
        """Execute a single retry attempt.

        Args:
            retry_task: Task to retry
            retry_runtime: Runtime config for retry
            retry_timeout: Timeout for retry
            agent_max_steps: Max agent steps
            session_id: Session ID
            user_id: User ID
            routing_meta: Routing metadata
            retry_idx: Current retry index
            retry_type: Type of retry ('decomp' or 'knowledge')

        Returns:
            Task result or None
        """
        retry_result = await agent_service.run_task(
            task=retry_task,
            llm_config=self.runtime_to_llm_config(retry_runtime, timeout_override=retry_timeout),
            max_steps=agent_max_steps,
            timeout_seconds=retry_timeout,
            request_id=f"chat-{session_id}-{retry_type}-retry-{retry_idx + 1}",
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
        return retry_result

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
        """Record usage event; if usage is missing, only record missing count.

        Args:
            user_id: User ID
            session_id: Session ID
            config_id: Config ID
            model_id: Model ID
            config_name: Config name
            path_type: Path type (main/fallback/classifier/shadow)
            is_primary: Whether this is primary usage
            usage: Usage dict
            message_id: Optional message ID
        """
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
            print(f"⚠️ 记录模型 token 使用量失败: {exc}")


# Singleton instance
chat_retry_service = ChatRetryService()
