"""
NotebookLM Agent 工具
将 NotebookLM 服务封装为 Smolagents @tool，支持按科目管理 Notebook。
"""

import asyncio
import json
import logging
import threading
from typing import Dict, List, Optional

try:
    from smolagents import tool
except Exception:
    def tool(func):
        return func

logger = logging.getLogger(__name__)

_pending_notebooklm_outputs: Dict[str, List[dict]] = {}
_outputs_lock = threading.Lock()
_request_local = threading.local()

_DEFAULT_SUBJECTS = ["数学", "英语", "政治", "专业课"]


def _get_current_request_id() -> str:
    request_id = getattr(_request_local, "request_id", None)
    return request_id or "default"


def set_current_request_context(request_id: str, user_id: Optional[str] = None):
    _request_local.request_id = request_id
    if user_id:
        _request_local.user_id = user_id


def clear_current_request_context():
    _request_local.request_id = None
    _request_local.user_id = None


def get_current_user_id() -> Optional[str]:
    return getattr(_request_local, "user_id", None)


def get_pending_notebooklm_outputs(request_id: Optional[str] = None) -> List[dict]:
    key = request_id or _get_current_request_id()
    with _outputs_lock:
        return list(_pending_notebooklm_outputs.get(key, []))


def clear_pending_notebooklm_outputs(request_id: Optional[str] = None):
    key = request_id or _get_current_request_id()
    with _outputs_lock:
        _pending_notebooklm_outputs.pop(key, None)


def _store_output(output: dict):
    request_id = _get_current_request_id()
    with _outputs_lock:
        bucket = _pending_notebooklm_outputs.get(request_id)
        if bucket is None:
            bucket = []
            _pending_notebooklm_outputs[request_id] = bucket
        bucket.append(output)


async def _get_or_create_subject_notebook(user_id: str, notebook_name: str) -> str:
    """获取或创建科目对应的 Notebook ID，持久化到 MongoDB study_notebooks 集合。"""
    from app.database import db

    record = await db.db.study_notebooks.find_one(
        {"user_id": user_id, "subject": notebook_name}
    )
    if record and record.get("notebook_id"):
        return record["notebook_id"]

    from app.services.notebooklm_service import notebooklm_service

    notebook_id = await notebooklm_service.get_or_create_notebook(user_id)

    await db.db.study_notebooks.update_one(
        {"user_id": user_id, "subject": notebook_name},
        {
            "$set": {
                "user_id": user_id,
                "subject": notebook_name,
                "notebook_id": notebook_id,
            }
        },
        upsert=True,
    )
    logger.info(f"Created subject notebook mapping: {notebook_name} → {notebook_id} for user {user_id[:8]}")
    return notebook_id


async def _resolve_notebook_id(user_id: str, notebook_name: str) -> Optional[str]:
    """根据科目名查找对应的 Notebook ID。"""
    from app.database import db

    record = await db.db.study_notebooks.find_one(
        {"user_id": user_id, "subject": notebook_name}
    )
    return record.get("notebook_id") if record else None


async def _query_knowledge_async(user_id: str, notebook_name: str, question: str) -> str:
    notebook_id = await _resolve_notebook_id(user_id, notebook_name)
    if not notebook_id:
        available = await _list_available_subjects(user_id)
        return f"未找到科目「{notebook_name}」的 Notebook。当前可用科目: {available}。请先使用 upload_study_material 上传资料。"

    from app.services.notebooklm_service import notebooklm_service

    result = await notebooklm_service.ask(user_id, question)

    output = {
        "type": "notebooklm_query",
        "subject": notebook_name,
        "question": question,
        "answer": result.get("answer", ""),
        "references": result.get("references", []),
    }
    _store_output(output)
    return json.dumps(output, ensure_ascii=False)


async def _upload_study_material_async(user_id: str, notebook_name: str, file_path: str) -> str:
    await _get_or_create_subject_notebook(user_id, notebook_name)

    from pathlib import Path
    from app.services.notebooklm_service import notebooklm_service

    path = Path(file_path)
    if not path.exists():
        return f"文件不存在: {file_path}"

    result = await notebooklm_service.upload_source(user_id, path)

    output = {
        "type": "notebooklm_upload",
        "subject": notebook_name,
        "filename": result.get("filename", path.name),
        "source_id": result.get("source_id", ""),
        "source_title": result.get("source_title", ""),
    }
    _store_output(output)
    return json.dumps(output, ensure_ascii=False)


async def _generate_study_summary_async(user_id: str, notebook_name: str) -> str:
    notebook_id = await _resolve_notebook_id(user_id, notebook_name)
    if not notebook_id:
        return f"未找到科目「{notebook_name}」的 Notebook，请先上传学习资料。"

    from app.services.notebooklm_service import notebooklm_service

    summary = await notebooklm_service.get_notebook_summary(user_id)

    output = {
        "type": "notebooklm_summary",
        "subject": notebook_name,
        "summary": summary,
    }
    _store_output(output)
    return json.dumps(output, ensure_ascii=False)


async def _generate_review_podcast_async(user_id: str, notebook_name: str, instructions: str) -> str:
    notebook_id = await _resolve_notebook_id(user_id, notebook_name)
    if not notebook_id:
        return f"未找到科目「{notebook_name}」的 Notebook，请先上传学习资料。"

    from app.services.notebooklm_service import notebooklm_service

    result = await notebooklm_service.generate_audio(user_id, instructions=instructions)

    output = {
        "type": "notebooklm_podcast",
        "subject": notebook_name,
        "url": result.get("url", ""),
        "task_id": result.get("task_id", ""),
        "status": result.get("status", ""),
    }
    _store_output(output)
    return json.dumps(output, ensure_ascii=False)


async def _list_study_sources_async(user_id: str, notebook_name: str) -> str:
    notebook_id = await _resolve_notebook_id(user_id, notebook_name)
    if not notebook_id:
        return f"未找到科目「{notebook_name}」的 Notebook，请先上传学习资料。"

    from app.services.notebooklm_service import notebooklm_service

    sources = await notebooklm_service.list_sources(user_id)

    output = {
        "type": "notebooklm_sources",
        "subject": notebook_name,
        "sources": sources,
        "count": len(sources),
    }
    _store_output(output)
    return json.dumps(output, ensure_ascii=False)


async def _list_available_subjects(user_id: str) -> str:
    from app.database import db

    cursor = db.db.study_notebooks.find({"user_id": user_id}, {"subject": 1})
    records = await cursor.to_list(length=100)
    subjects = [r["subject"] for r in records if "subject" in r]
    if not subjects:
        return "（暂无，请先上传资料）"
    return "、".join(subjects)


def _run_async(coro):
    """在同步工具函数中运行异步协程。"""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(asyncio.run, coro)
            return future.result(timeout=300)
    else:
        return asyncio.run(coro)


@tool
def query_knowledge(notebook_name: str, question: str) -> str:
    """向指定科目的 Notebook 提问。当用户问及某个科目的知识点、需要查阅学习资料时使用此工具。

    Args:
        notebook_name: 科目名称，如"数学"、"英语"、"政治"、"专业课"
        question: 要提问的问题

    Returns:
        基于该科目学习资料的回答
    """
    user_id = get_current_user_id()
    if not user_id:
        return "无法获取用户信息，请重新登录后再试。"
    try:
        return _run_async(_query_knowledge_async(user_id, notebook_name, question))
    except Exception as e:
        logger.error(f"query_knowledge failed: {e}")
        return f"查询失败: {e}"


@tool
def upload_study_material(notebook_name: str, file_path: str) -> str:
    """上传学习资料到对应科目的 Notebook。当用户想添加新的学习资料（PDF、文档等）到某个科目时使用此工具。

    Args:
        notebook_name: 科目名称，如"数学"、"英语"、"政治"、"专业课"
        file_path: 文件路径

    Returns:
        上传结果
    """
    user_id = get_current_user_id()
    if not user_id:
        return "无法获取用户信息，请重新登录后再试。"
    try:
        return _run_async(_upload_study_material_async(user_id, notebook_name, file_path))
    except Exception as e:
        logger.error(f"upload_study_material failed: {e}")
        return f"上传失败: {e}"


@tool
def generate_study_summary(notebook_name: str) -> str:
    """生成指定科目的学习摘要。当用户想复习某个科目的重点内容、需要概览时使用此工具。

    Args:
        notebook_name: 科目名称，如"数学"、"英语"、"政治"、"专业课"

    Returns:
        该科目的学习摘要
    """
    user_id = get_current_user_id()
    if not user_id:
        return "无法获取用户信息，请重新登录后再试。"
    try:
        return _run_async(_generate_study_summary_async(user_id, notebook_name))
    except Exception as e:
        logger.error(f"generate_study_summary failed: {e}")
        return f"生成摘要失败: {e}"


@tool
def generate_review_podcast(notebook_name: str, instructions: str = "") -> str:
    """生成复习播客音频。当用户想用听的方式复习某个科目时使用此工具，会生成一段 AI 对话形式的音频。

    Args:
        notebook_name: 科目名称，如"数学"、"英语"、"政治"、"专业课"
        instructions: 播客生成的额外指令，如"重点关注线性代数"（可选）

    Returns:
        播客音频信息
    """
    user_id = get_current_user_id()
    if not user_id:
        return "无法获取用户信息，请重新登录后再试。"
    try:
        return _run_async(_generate_review_podcast_async(user_id, notebook_name, instructions))
    except Exception as e:
        logger.error(f"generate_review_podcast failed: {e}")
        return f"生成播客失败: {e}"


@tool
def list_study_sources(notebook_name: str) -> str:
    """查看已上传的学习资料列表。当用户想知道某个科目已有哪些学习资料时使用此工具。

    Args:
        notebook_name: 科目名称，如"数学"、"英语"、"政治"、"专业课"

    Returns:
        该科目已上传的资料列表
    """
    user_id = get_current_user_id()
    if not user_id:
        return "无法获取用户信息，请重新登录后再试。"
    try:
        return _run_async(_list_study_sources_async(user_id, notebook_name))
    except Exception as e:
        logger.error(f"list_study_sources failed: {e}")
        return f"查询资料列表失败: {e}"


NOTEBOOKLM_TOOLS = [
    query_knowledge,
    upload_study_material,
    generate_study_summary,
    generate_review_podcast,
    list_study_sources,
]
