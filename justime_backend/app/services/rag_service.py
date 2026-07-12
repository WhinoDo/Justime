"""
云 RAG 服务
通过 NotebookLM 等云服务提供文档检索和问答能力。
不再使用本地 LlamaIndex / HuggingFace 嵌入/向量索引。
"""

import asyncio
import logging
import re
from pathlib import Path
from typing import Any, Dict, Literal, Optional, TypedDict

logger = logging.getLogger(__name__)

RAGMode = Literal["cloud", "unavailable"]
RAGProvider = Literal["notebooklm", "none"]
RAGStatus = Literal["ready", "degraded", "unavailable", "error"]

PROVIDER_NOT_CONFIGURED = "PROVIDER_NOT_CONFIGURED"
PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE"
USER_CONTEXT_REQUIRED = "USER_CONTEXT_REQUIRED"


class RAGAvailabilityState(TypedDict):
    mode: RAGMode
    provider: RAGProvider
    status: RAGStatus
    retryable: bool
    error_code: Optional[str]


class RAGResult(dict):
    """Structured result that keeps legacy string checks working."""

    def startswith(self, prefix: str, *args: Any) -> bool:
        return str(self.get("message", "")).startswith(prefix, *args)

    def __str__(self) -> str:
        return str(self.get("message", super().__str__()))


def build_rag_state(
    *,
    mode: RAGMode,
    provider: RAGProvider,
    status: RAGStatus,
    retryable: bool,
    error_code: Optional[str],
) -> RAGAvailabilityState:
    return {
        "mode": mode,
        "provider": provider,
        "status": status,
        "retryable": retryable,
        "error_code": error_code,
    }


def provider_not_configured_state() -> RAGAvailabilityState:
    return build_rag_state(
        mode="unavailable",
        provider="none",
        status="degraded",
        retryable=False,
        error_code=PROVIDER_NOT_CONFIGURED,
    )


def provider_pending_state() -> RAGAvailabilityState:
    return build_rag_state(
        mode="cloud",
        provider="notebooklm",
        status="degraded",
        retryable=False,
        error_code=None,
    )


def provider_ready_state() -> RAGAvailabilityState:
    return build_rag_state(
        mode="cloud",
        provider="notebooklm",
        status="ready",
        retryable=False,
        error_code=None,
    )


def provider_unavailable_state() -> RAGAvailabilityState:
    return build_rag_state(
        mode="cloud",
        provider="notebooklm",
        status="unavailable",
        retryable=True,
        error_code=PROVIDER_UNAVAILABLE,
    )


def user_context_required_state() -> RAGAvailabilityState:
    return build_rag_state(
        mode="cloud",
        provider="notebooklm",
        status="error",
        retryable=False,
        error_code=USER_CONTEXT_REQUIRED,
    )

# 共享路径工具（不依赖本地 RAG 引擎）
from app.services.knowledge_paths import (
    DOCS_DIR,
    get_user_docs_dir,
    get_current_user_context,
)

try:
    from app.core.config import settings
except Exception:
    settings = None

# 惰性加载 NotebookLM 服务（import 时不触发 IO）
_notebooklm_available = False
_notebooklm_service = None

try:
    from app.services.notebooklm_service import notebooklm_service as _nbs
    _notebooklm_service = _nbs
    _notebooklm_available = bool(
        settings is not None and getattr(settings, "NOTEBOOKLM_ENABLED", False)
    )
except Exception:
    logger.info("NotebookLM 服务不可用，知识库将使用结构化降级状态")


def _run_async(coro, timeout: int = 300):
    """在同步上下文中运行异步协程（适配 run_in_executor 调用场景）。"""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            future = asyncio.run_coroutine_threadsafe(coro, loop)
            return future.result(timeout=timeout)
    except RuntimeError:
        pass
    return asyncio.run(coro)


_SYNC_RESULT_PATTERN = re.compile(r"^已同步 (\d+) 个文件到 NotebookLM$")


def _user_id_from_docs_dir(docs_dir: Optional[Path]) -> Optional[str]:
    """Recover only the direct user directory identity below DOCS_DIR."""
    if docs_dir is None:
        return None

    try:
        docs_root = Path(DOCS_DIR).expanduser().resolve()
        resolved_docs_dir = Path(docs_dir).expanduser().resolve()
    except (OSError, RuntimeError, TypeError, ValueError):
        return None

    if resolved_docs_dir.parent != docs_root:
        return None

    user_id = resolved_docs_dir.name.strip()
    return user_id or None


def _eligible_source_count(docs_dir: Path) -> int:
    """Match NotebookLMService.sync_all_sources file selection exactly."""
    if not docs_dir.exists():
        return 0
    return sum(
        1
        for file_path in docs_dir.iterdir()
        if file_path.is_file() and not file_path.name.startswith(".")
    )


def _complete_sync_count(result: Any, expected_count: int) -> Optional[int]:
    if not isinstance(result, str):
        return None
    match = _SYNC_RESULT_PATTERN.fullmatch(result)
    if match is None:
        return None
    synced_count = int(match.group(1))
    return synced_count if synced_count == expected_count else None


async def _sync_sources_with_evidence(
    provider: Any,
    user_id: str,
    docs_dir: Path,
) -> tuple[Any, Any]:
    sync_result = await provider.sync_all_sources(user_id, docs_dir)
    sources = await provider.list_sources(user_id)
    return sync_result, sources


def _all_sources_ready(sources: Any, expected_count: int) -> bool:
    return (
        isinstance(sources, list)
        and len(sources) == expected_count
        and all(
            isinstance(source, dict) and source.get("is_ready") is True
            for source in sources
        )
    )


class RAGService:
    """云 RAG 服务 — 保持对外方法签名向后兼容。"""

    def __init__(self):
        # 不再触发任何本地模型加载或网络 IO
        pass

    def get_availability_state(self) -> RAGAvailabilityState:
        if not _notebooklm_available or _notebooklm_service is None:
            return provider_not_configured_state()
        return provider_pending_state()

    @staticmethod
    def build_state(
        *,
        mode: RAGMode,
        provider: RAGProvider,
        status: RAGStatus,
        retryable: bool,
        error_code: Optional[str],
    ) -> RAGAvailabilityState:
        return build_rag_state(
            mode=mode,
            provider=provider,
            status=status,
            retryable=retryable,
            error_code=error_code,
        )

    @staticmethod
    def pending_state() -> RAGAvailabilityState:
        return provider_pending_state()

    @staticmethod
    def ready_state() -> RAGAvailabilityState:
        return provider_ready_state()

    @staticmethod
    def unavailable_state() -> RAGAvailabilityState:
        return provider_unavailable_state()

    def rebuild_index(
        self,
        docs_dir: Optional[Path] = None,
        persist: bool = True,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """同步文档到云端 RAG（语义从"本地重建索引"改为"云同步"）。

        保持签名向后兼容：docs_dir 指定文档目录，persist 参数保留但不再有实际意义。
        """
        if not _notebooklm_available or _notebooklm_service is None:
            return RAGResult({
                "success": False,
                "message": "重建索引失败：云 RAG 服务未配置",
                **provider_not_configured_state(),
            })

        explicit_user_id = str(user_id or "").strip() or None
        target_user_id = (
            explicit_user_id
            or get_current_user_context()
            or _user_id_from_docs_dir(docs_dir)
        )
        if not target_user_id:
            return RAGResult({
                "success": False,
                "message": "重建索引失败：需要用户上下文",
                **user_context_required_state(),
            })

        try:
            target_docs_dir = docs_dir or get_user_docs_dir(target_user_id)
            resolved_docs_root = Path(DOCS_DIR).expanduser().resolve()
            resolved_target_docs_dir = Path(target_docs_dir).expanduser().resolve()
            expected_docs_dir = Path(get_user_docs_dir(target_user_id)).expanduser().resolve()
            if (
                resolved_target_docs_dir != expected_docs_dir
                or resolved_target_docs_dir.parent != resolved_docs_root
            ):
                return RAGResult({
                    "success": False,
                    "message": "重建索引失败：需要用户上下文",
                    **user_context_required_state(),
                })

            expected_count = _eligible_source_count(resolved_target_docs_dir)
            result, sources = _run_async(
                _sync_sources_with_evidence(
                    _notebooklm_service,
                    target_user_id,
                    resolved_target_docs_dir,
                ),
                timeout=600,
            )
            synced_count = _complete_sync_count(result, expected_count)
            if synced_count is None or not _all_sources_ready(
                sources,
                expected_count,
            ):
                return RAGResult({
                    "success": False,
                    "message": "重建索引失败：云 RAG 服务暂时不可用",
                    **provider_unavailable_state(),
                })

            return RAGResult({
                "success": True,
                "message": f"已同步 {synced_count} 个文件到 NotebookLM",
                **provider_ready_state(),
            })
        except Exception:
            logger.warning("Cloud index rebuild failed")
            return RAGResult({
                "success": False,
                "message": "重建索引失败：云 RAG 服务暂时不可用",
                **provider_unavailable_state(),
            })

    def query_with_references(
        self, question: str, allow_auto_rebuild: bool = True
    ) -> Dict[str, Any]:
        """查询知识库并返回结构化引用。

        返回结构保持向后兼容：{"answer": str, "references": list}。
        """
        if not _notebooklm_available or _notebooklm_service is None:
            return {
                "answer": "知识库暂不可用：云 RAG 服务未配置",
                "references": [],
                **provider_not_configured_state(),
            }

        target_user_id = get_current_user_context()
        if not target_user_id:
            return {
                "answer": "知识库查询需要用户上下文",
                "references": [],
                **user_context_required_state(),
            }

        try:
            result = _run_async(
                _notebooklm_service.ask(target_user_id, question), timeout=120
            )
            if not isinstance(result, dict):
                raise RuntimeError("invalid provider response")

            answer = result.get("answer", "")
            references = result.get("references", [])
            if not isinstance(answer, str) or not isinstance(references, list):
                raise RuntimeError("invalid provider response")
            if answer.startswith("NotebookLM 查询出错:"):
                raise RuntimeError("provider returned an error response")

            return {
                **result,
                "answer": answer,
                "references": references,
                **provider_ready_state(),
            }
        except Exception:
            logger.warning("Cloud RAG query failed")
            return {
                "answer": "知识库查询暂时不可用，请稍后重试",
                "references": [],
                **provider_unavailable_state(),
            }

    def query(self, question: str) -> str:
        """查询知识库（纯文本返回，向后兼容）。"""
        return str(self.query_with_references(question).get("answer", ""))


# 全局实例（import 时不触发任何 IO 或模型加载）
rag_service = RAGService()
