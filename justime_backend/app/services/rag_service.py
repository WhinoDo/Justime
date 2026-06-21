"""
云 RAG 服务
通过 NotebookLM 等云服务提供文档检索和问答能力。
不再使用本地 LlamaIndex / HuggingFace 嵌入/向量索引。
"""

import asyncio
import logging
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# 共享路径工具（不依赖本地 RAG 引擎）
from app.services.knowledge_paths import (
    DOCS_DIR,
    SUPPORTED_DOC_EXTENSIONS,
    _ensure_directory,
    get_user_docs_dir,
    set_current_user_context,
    clear_current_user_context,
    get_current_user_context,
)

# 惰性加载 NotebookLM 服务（import 时不触发 IO）
_notebooklm_available = False
_notebooklm_service = None

try:
    from app.services.notebooklm_service import notebooklm_service as _nbs
    _notebooklm_service = _nbs
    _notebooklm_available = True
except Exception as exc:
    logger.info(
        "NotebookLM 服务不可用，知识库将降级为 unavailable 模式: %s", exc
    )


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


class RAGService:
    """云 RAG 服务 — 保持对外方法签名向后兼容。"""

    def __init__(self):
        # 不再触发任何本地模型加载或网络 IO
        pass

    def rebuild_index(self, docs_dir: Optional[Path] = None, persist: bool = True) -> str:
        """同步文档到云端 RAG（语义从"本地重建索引"改为"云同步"）。

        保持签名向后兼容：docs_dir 指定文档目录，persist 参数保留但不再有实际意义。
        """
        if not _notebooklm_available:
            return "云 RAG 服务不可用 (NotebookLM 未配置)"

        target_user_id = get_current_user_context()
        if not target_user_id:
            return "无法重建索引：未设置用户上下文"

        try:
            target_docs_dir = docs_dir or get_user_docs_dir(target_user_id)
            result = _run_async(
                _notebooklm_service.sync_all_sources(target_user_id, target_docs_dir),
                timeout=600,
            )
            return result
        except Exception as e:
            logger.error("Cloud index rebuild failed: %s", e)
            return f"重建索引失败: {str(e)}"

    def query_with_references(
        self, question: str, allow_auto_rebuild: bool = True
    ) -> Dict[str, Any]:
        """查询知识库并返回结构化引用。

        返回结构保持向后兼容：{"answer": str, "references": list}。
        """
        if not _notebooklm_available:
            return {
                "answer": "知识库暂不可用（NotebookLM 未配置）",
                "references": [],
            }

        target_user_id = get_current_user_context()
        if not target_user_id:
            return {
                "answer": "知识库暂不可用：未设置用户上下文",
                "references": [],
            }

        try:
            result = _run_async(
                _notebooklm_service.ask(target_user_id, question), timeout=120
            )
            return result
        except Exception as e:
            logger.error("Cloud RAG query failed: %s", e)
            return {"answer": f"查询出错: {str(e)}", "references": []}

    def query(self, question: str) -> str:
        """查询知识库（纯文本返回，向后兼容）。"""
        return str(self.query_with_references(question).get("answer", ""))


# 全局实例（import 时不触发任何 IO 或模型加载）
rag_service = RAGService()
