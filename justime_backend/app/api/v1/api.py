"""
API v1 路由聚合
"""

import logging

from fastapi import APIRouter
from app.api.v1.endpoints import (
    admin,
    admin_apikeys,
    agent,
    auth,
    book_analysis,
    calendar,
    documents,
    evidence,
    feishu_webhook,
    health,
    knowledge_outputs,
    study,
    task_process,
    chat,
)

logger = logging.getLogger(__name__)

api_router = APIRouter()

# 注册各个模块的路由
api_router.include_router(health.router, prefix="/health", tags=["健康检查"])
api_router.include_router(auth.router, prefix="/auth", tags=["认证"])
api_router.include_router(chat.router, prefix="/chat", tags=["AI对话"])
api_router.include_router(admin.router, prefix="/admin", tags=["后台管理"])
api_router.include_router(admin_apikeys.router, prefix="/admin", tags=["后台管理/API Key"])
api_router.include_router(agent.router, prefix="/agent", tags=["AI Agent"])
api_router.include_router(calendar.router, prefix="/calendar", tags=["日历管理"])
api_router.include_router(documents.router, prefix="/documents", tags=["工作文档"])
api_router.include_router(book_analysis.router, prefix="/book-analysis", tags=["书籍分析"])
api_router.include_router(feishu_webhook.router, prefix="/feishu", tags=["飞书Webhook"])
api_router.include_router(study.router, prefix="/study", tags=["学习兼容"])
api_router.include_router(task_process.router, prefix="/task-processes", tags=["任务进程"])
api_router.include_router(evidence.router, prefix="/task-processes", tags=["任务证据"])
api_router.include_router(knowledge_outputs.router, prefix="/task-processes", tags=["知识产出"])

# 知识库路由 — 可选依赖，导入失败时不阻断启动
knowledge_available = False
try:
    from app.api.v1.endpoints import knowledge
except ImportError as exc:
    logger.warning(
        "知识库模块依赖未安装，知识库路由已禁用。若要启用，请安装可选依赖。",
        exc_info=True,
    )
except Exception as exc:
    logger.error(
        "导入知识库模块时发生意外错误，知识库路由已禁用: %s",
        exc,
        exc_info=True,
    )
else:
    api_router.include_router(knowledge.router, prefix="/knowledge", tags=["知识库管理"])
    knowledge_available = True
