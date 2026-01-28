"""
管理后台 API 端点
"""

from fastapi import APIRouter, HTTPException
from typing import List
from app.models.admin import AdminUser, SystemStats
from app.business.admin_business import admin_business

router = APIRouter()


@router.get("/users", response_model=List[AdminUser], summary="获取用户列表")
async def get_users() -> List[AdminUser]:
    """获取所有用户列表"""
    return await admin_business.get_all_users()


@router.delete("/users/{user_id}", summary="删除用户")
async def delete_user(user_id: str):
    """删除指定用户"""
    success = await admin_business.delete_user(user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found or delete failed")
    return {"success": True, "message": f"User {user_id} deleted"}


@router.get("/stats", response_model=SystemStats, summary="获取系统统计")
async def get_stats() -> SystemStats:
    """获取系统运行统计信息"""
    return await admin_business.get_system_stats()
