"""
知识库路径共享模块
提供 DOCS_DIR、get_user_docs_dir 等路径工具，不依赖本地 RAG 引擎。
"""

import logging
import os
import threading
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DOCS_DIR = Path(os.getenv("RAG_DOCS_DIR", "app/data/documents"))
SUPPORTED_DOC_EXTENSIONS = [".txt", ".md", ".pdf", ".docx", ".csv"]

_thread_local = threading.local()


def set_current_user_context(user_id: str):
    _thread_local.user_id = str(user_id or "").strip()


def clear_current_user_context():
    _thread_local.user_id = None


def get_current_user_context() -> Optional[str]:
    user_id = getattr(_thread_local, "user_id", None)
    if isinstance(user_id, str) and user_id.strip():
        return user_id.strip()
    return None


def _ensure_directory(path: Path) -> Path:
    try:
        path.mkdir(parents=True, exist_ok=True)
    except PermissionError as exc:
        raise RuntimeError(f"目录无权限访问: {path}") from exc
    except OSError as exc:
        raise RuntimeError(f"目录初始化失败: {path} ({exc})") from exc
    return path


def get_user_docs_dir(user_id: str) -> Path:
    target_user = str(user_id or "").strip()
    if not target_user:
        raise ValueError("user_id 不能为空")
    _ensure_directory(DOCS_DIR)
    target_dir = DOCS_DIR / target_user
    return _ensure_directory(target_dir)
