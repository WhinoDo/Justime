import asyncio
import logging
from datetime import datetime, timezone
from time import perf_counter
from functools import wraps
from typing import Dict, Any, List, Optional

from app.services.agent_service import agent_service
from app.services.llm_service import llm_service
from app.services.user_service import UserService
from app.business.chat_retry_service import (
    chat_retry_service,
    DECOMPOSITION_TOOL_RETRY_LIMIT,
    KNOWLEDGE_TOOL_RETRY_LIMIT,
)

logger = logging.getLogger(__name__)


def retry_on_failure(max_retries: int = 3, delay: float = 1.0, exceptions: tuple = (Exception,)):
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


class ChatExecutor:
    async def record_usage_event(
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
        await chat_retry_service._record_usage_event(
            user_id=user_id,
            session_id=session_id,
            config_id=config_id,
            model_id=model_id,
            config_name=config_name,
            path_type=path_type,
            is_primary=is_primary,
            usage=usage,
            message_id=message_id,
        )

    async def run_shadow_ensemble(
        self,
        user_id: str,
        session_id: str,
        timed_task: str,
        runtime_configs: List[Dict[str, Any]],
        skip_config_id: Optional[str],
        max_steps: int,
        timeout_seconds: float,
        runtime_to_llm_config_fn
    ) -> None:
        try:
            shadow_candidates = [
                c for c in runtime_configs
                if c.get("config_id") != skip_config_id and c.get("enabled", True)
            ][:3]
            if len(shadow_candidates) < 1:
                return

            llm_configs = [runtime_to_llm_config_fn(c, timeout_override=timeout_seconds) for c in shadow_candidates]
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
                await self.record_usage_event(
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

    async def execute_main_task(
        self,
        timed_task: str,
        session_id: str,
        user_id: str,
        main_runtime: Dict[str, Any],
        main_timeout: float,
        agent_max_steps: int,
        runtime_to_llm_config_fn
    ) -> Dict[str, Any]:
        main_started = perf_counter()
        task_result = await agent_service.run_task(
            task=timed_task,
            llm_config=runtime_to_llm_config_fn(main_runtime, timeout_override=main_timeout),
            max_steps=agent_max_steps,
            timeout_seconds=main_timeout,
            request_id=f"chat-{session_id}-main",
            user_id=user_id,
        )
        main_ms = int((perf_counter() - main_started) * 1000)
        return {
            "task_result": task_result,
            "main_ms": main_ms
        }

    async def execute_fallback_task(
        self,
        timed_task: str,
        session_id: str,
        user_id: str,
        fallback_runtime: Dict[str, Any],
        fallback_timeout: float,
        agent_max_steps: int,
        runtime_to_llm_config_fn
    ) -> Dict[str, Any]:
        fallback_started = perf_counter()
        fallback_result = await agent_service.run_task(
            task=timed_task,
            llm_config=runtime_to_llm_config_fn(fallback_runtime, timeout_override=fallback_timeout),
            max_steps=agent_max_steps,
            timeout_seconds=fallback_timeout,
            request_id=f"chat-{session_id}-fallback",
            user_id=user_id,
        )
        fallback_ms = int((perf_counter() - fallback_started) * 1000)
        return {
            "task_result": fallback_result,
            "fallback_ms": fallback_ms
        }

    async def execute_decomposition_retry(
        self,
        timed_task: str,
        session_id: str,
        user_id: str,
        used_runtime: Dict[str, Any],
        fallback_runtime: Optional[Dict[str, Any]],
        main_timeout: float,
        fallback_timeout: float,
        agent_max_steps: int,
        runtime_to_llm_config_fn,
        has_real_decomposition_fn
    ) -> Dict[str, Any]:
        retry_task = (
            f"{timed_task}\n\n"
            "【硬性约束（必须遵守）】\n"
            "你上一次没有成功调用 suggest_task_decomposition。\n"
            "本次必须编写 Python 代码并实际调用 suggest_task_decomposition 工具。\n"
            "禁止只输出文字计划；subtasks 必须是合法 JSON 字符串。\n"
            "若不调用工具则视为失败。"
        )
        
        task_result = None
        used_runtime_result = used_runtime
        retry_count = 0
        success = False

        for retry_idx in range(DECOMPOSITION_TOOL_RETRY_LIMIT):
            retry_runtime = used_runtime
            if (
                retry_idx >= 1 and
                fallback_runtime and
                used_runtime.get("config_id") != fallback_runtime.get("config_id")
            ):
                retry_runtime = fallback_runtime

            retry_timeout = fallback_timeout if retry_runtime.get("config_id") == (fallback_runtime or {}).get("config_id") else main_timeout
            retry_result = await agent_service.run_task(
                task=retry_task,
                llm_config=runtime_to_llm_config_fn(retry_runtime, timeout_override=retry_timeout),
                max_steps=agent_max_steps,
                timeout_seconds=retry_timeout,
                request_id=f"chat-{session_id}-decomp-retry-{retry_idx + 1}",
                user_id=user_id,
            )
            
            retry_count = retry_idx + 1
            
            if not retry_result or not retry_result.get("success"):
                logger.warning(f"⚠️ 任务分解工具调用重试第 {retry_idx + 1} 次失败。")
                continue
            
            task_result = retry_result
            used_runtime_result = retry_runtime
            
            if has_real_decomposition_fn(task_result):
                logger.info(f"✅ 任务分解工具调用在第 {retry_idx + 1} 次重试成功。")
                success = True
                break

        return {
            "task_result": task_result,
            "used_runtime": used_runtime_result,
            "retry_count": retry_count,
            "success": success
        }

    async def execute_knowledge_retry(
        self,
        timed_task: str,
        session_id: str,
        user_id: str,
        used_runtime: Dict[str, Any],
        fallback_runtime: Optional[Dict[str, Any]],
        main_timeout: float,
        fallback_timeout: float,
        agent_max_steps: int,
        runtime_to_llm_config_fn,
        has_knowledge_output_fn
    ) -> Dict[str, Any]:
        retry_task = (
            f"{timed_task}\n\n"
            "【硬性约束（必须遵守）】\n"
            "你上一次没有调用 retrieve_knowledge。\n"
            "本次必须先调用 retrieve_knowledge 工具，再给出 final_answer。\n"
            "若知识库无结果，请明确说明；不要跳过工具直接回答。"
        )
        
        task_result = None
        retry_count = 0
        success = False

        for retry_idx in range(KNOWLEDGE_TOOL_RETRY_LIMIT):
            retry_runtime = used_runtime
            retry_timeout = (
                fallback_timeout
                if fallback_runtime and retry_runtime.get("config_id") == fallback_runtime.get("config_id")
                else main_timeout
            )
            retry_result = await agent_service.run_task(
                task=retry_task,
                llm_config=runtime_to_llm_config_fn(retry_runtime, timeout_override=retry_timeout),
                max_steps=agent_max_steps,
                timeout_seconds=retry_timeout,
                request_id=f"chat-{session_id}-knowledge-retry-{retry_idx + 1}",
                user_id=user_id,
            )
            
            retry_count = retry_idx + 1
            
            if not retry_result or not retry_result.get("success"):
                logger.warning(f"⚠️ 知识检索工具调用重试第 {retry_idx + 1} 次失败。")
                continue
            
            task_result = retry_result
            
            if has_knowledge_output_fn(task_result):
                logger.info(f"✅ 知识检索工具在第 {retry_idx + 1} 次重试成功调用。")
                success = True
                break

        return {
            "task_result": task_result,
            "retry_count": retry_count,
            "success": success
        }

    async def test_connection(
        self,
        model_id: str,
        api_key: str,
        base_url: str,
        timeout: int,
        user_id: str,
        get_user_llm_config_fn
    ) -> Dict[str, Any]:
        try:
            target_api_key = api_key
            if target_api_key and "******" in target_api_key:
                user_conf = await get_user_llm_config_fn(user_id)
                target_api_key = user_conf["api_key"]
                
            messages = [{"role": "user", "content": "Hello"}]
            result = await llm_service.chat_completion(
                messages=messages,
                model=model_id,
                api_key=target_api_key,
                api_base=base_url,
                timeout=float(timeout or 60),
                max_tokens=10
            )
            
            if not result or "choices" not in result or not result["choices"]:
                raise Exception("LLM returned unexpected response format")
                
            return {
                "success": True, 
                "message": "连接测试成功", 
                "model": model_id,
                "baseUrl": base_url,
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


chat_executor = ChatExecutor()
