"""
API v1 路由聚合
"""

import logging

from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, chat, admin, admin_apikeys, agent, calendar, speech, book_analysis, documents

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
api_router.include_router(speech.router, prefix="/speech", tags=["语音服务"])

try:
    from app.api.v1.endpoints import knowledge
except Exception as exc:
    logger.warning(f"Knowledge routes disabled during startup: {exc}")
else:
    api_router.include_router(knowledge.router, prefix="/knowledge", tags=["知识库管理"])
