"""API v1 endpoints package.

只在这里声明实际存在的端点模块，避免循环导入和导入不存在的模块。
"""

from . import (
    admin,
    admin_apikeys,
    agent,
    auth,
    book_analysis,
    calendar,
    chat,
    documents,
    evidence,
    feishu_webhook,
    health,
    knowledge,
    knowledge_outputs,
    task_process,
)

__all__ = [
    "admin",
    "admin_apikeys",
    "agent",
    "auth",
    "book_analysis",
    "calendar",
    "chat",
    "documents",
    "evidence",
    "feishu_webhook",
    "health",
    "knowledge",
    "knowledge_outputs",
    "task_process",
]
