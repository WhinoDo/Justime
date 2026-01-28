"""
API v1 路由聚合
"""

from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, chat, admin, agent, knowledge

api_router = APIRouter()

# 注册各个模块的路由
api_router.include_router(health.router, prefix="/health", tags=["健康检查"])
api_router.include_router(auth.router, prefix="/auth", tags=["认证"])
api_router.include_router(chat.router, prefix="/chat", tags=["AI对话"])
api_router.include_router(admin.router, prefix="/admin", tags=["后台管理"])
api_router.include_router(agent.router, prefix="/agent", tags=["AI Agent"])
api_router.include_router(knowledge.router, prefix="/knowledge", tags=["知识库管理"])

