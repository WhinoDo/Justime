"""
API v1 路由聚合
"""

from fastapi import APIRouter
from app.api.v1.endpoints import health, feishu, llm, chat, database, auth

api_router = APIRouter()

# 注册各个模块的路由
api_router.include_router(health.router, prefix="/health", tags=["健康检查"])
api_router.include_router(feishu.router, prefix="/feishu", tags=["飞书集成"])
api_router.include_router(llm.router, prefix="/llm", tags=["大语言模型"])
api_router.include_router(chat.router, prefix="/chat", tags=["聊天"])
api_router.include_router(database.router, prefix="/database", tags=["数据库"])
api_router.include_router(auth.router, prefix="/auth", tags=["认证"])
