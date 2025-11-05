"""
API v1 路由聚合
"""

from fastapi import APIRouter
from app.api.v1.endpoints import health, feishu

api_router = APIRouter()

# 注册各个模块的路由
api_router.include_router(health.router, prefix="/health", tags=["健康检查"])
api_router.include_router(feishu.router, prefix="/feishu", tags=["飞书集成"])
