"""
知识库工具
使用 RAG 技术从本地文档检索信息
"""

import threading
from typing import Dict, List, Optional

try:
    from smolagents import tool
except Exception:
    def tool(func):
        return func

try:
    from app.services.rag_service import rag_service, set_current_user_context, clear_current_user_context
except Exception:
    rag_service = None

    def set_current_user_context(user_id: str):
        return None

    def clear_current_user_context():
        return None

_pending_rag_references: Dict[str, List[dict]] = {}
_rag_lock = threading.Lock()
_request_local = threading.local()


def _get_current_request_id() -> str:
    request_id = getattr(_request_local, "request_id", None)
    return request_id or "default"


def set_current_request_context(request_id: str, user_id: Optional[str] = None):
    _request_local.request_id = request_id
    if user_id:
        set_current_user_context(user_id)


def clear_current_request_context():
    _request_local.request_id = None
    clear_current_user_context()


def get_pending_rag_references(request_id: Optional[str] = None) -> List[dict]:
    key = request_id or _get_current_request_id()
    with _rag_lock:
        return list(_pending_rag_references.get(key, []))


def clear_pending_rag_references(request_id: Optional[str] = None):
    key = request_id or _get_current_request_id()
    with _rag_lock:
        _pending_rag_references.pop(key, None)


def _store_rag_references(observation: dict):
    request_id = _get_current_request_id()
    with _rag_lock:
        bucket = _pending_rag_references.get(request_id)
        if bucket is None:
            bucket = []
            _pending_rag_references[request_id] = bucket
        bucket.append(observation)


@tool
def retrieve_knowledge(query: str) -> str:
    """
    检索知识库中的文档以回答问题。当无法通过常规知识回答，或者用户问及特定的项目文档、内部资料、上传的文件内容时，使用此工具。
    
    Args:
        query: 检索问题或关键词
        
    Returns:
        基于文档内容的回答或相关片段
    """
    try:
        from app.services.rag_service import rag_service
    except Exception as exc:
        return f"知识库功能当前不可用：{exc}"

    result = rag_service.query_with_references(query)
    references = result.get("references") if isinstance(result, dict) else []
    if isinstance(references, list) and references:
        _store_rag_references(
            {
                "type": "rag_references",
                "query": query,
                "references": references,
            }
        )
    return str(result.get("answer", "")) if isinstance(result, dict) else rag_service.query(query)
