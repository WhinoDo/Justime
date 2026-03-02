"""
管理后台 API 端点
"""

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from app.models.admin import (
    AdminModel,
    AdminModelUpsertRequest,
    AdminUser,
    SystemStats,
    UserModelAccessUpdateRequest,
    UserRoleUpdateRequest,
    UserStatusUpdateRequest,
)
from app.business.admin_business import admin_business
from app.services.security_service import SecurityService

router = APIRouter()


def ensure_admin(current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)) -> Dict[str, Any]:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅管理员可访问")
    return current_user


@router.get("/users", response_model=List[AdminUser], summary="获取用户列表")
async def get_users(_: Dict[str, Any] = Depends(ensure_admin)) -> List[AdminUser]:
    """获取所有用户列表"""
    return await admin_business.get_all_users()


@router.put("/users/{user_id}/status", summary="更新用户状态")
async def update_user_status(
    user_id: str,
    payload: UserStatusUpdateRequest,
    _: Dict[str, Any] = Depends(ensure_admin)
) -> Dict[str, Any]:
    success = await admin_business.update_user_status(user_id, payload.status)
    if not success:
        raise HTTPException(status_code=404, detail="User not found or update failed")
    return {"success": True, "message": f"用户状态已更新为 {payload.status}"}


@router.put("/users/{user_id}/role", summary="更新用户角色")
async def update_user_role(
    user_id: str,
    payload: UserRoleUpdateRequest,
    _: Dict[str, Any] = Depends(ensure_admin)
) -> Dict[str, Any]:
    success = await admin_business.update_user_role(user_id, payload.role)
    if not success:
        raise HTTPException(status_code=404, detail="User not found or update failed")
    return {"success": True, "message": f"用户角色已更新为 {payload.role}"}


@router.put("/users/{user_id}/models", summary="更新用户模型访问权限")
async def update_user_model_access(
    user_id: str,
    payload: UserModelAccessUpdateRequest,
    _: Dict[str, Any] = Depends(ensure_admin)
) -> Dict[str, Any]:
    success = await admin_business.update_user_model_access(
        user_id=user_id,
        access_all_models=payload.access_all_models,
        allowed_model_ids=payload.allowed_model_ids,
    )
    if not success:
        raise HTTPException(status_code=404, detail="User not found or update failed")
    return {"success": True, "message": "用户模型权限更新成功"}


@router.delete("/users/{user_id}", summary="删除用户")
async def delete_user(user_id: str, _: Dict[str, Any] = Depends(ensure_admin)) -> Dict[str, Any]:
    """删除指定用户"""
    success = await admin_business.delete_user(user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found or delete failed")
    return {"success": True, "message": f"User {user_id} deleted"}


@router.get("/models", response_model=List[AdminModel], summary="获取系统模型配置")
async def get_models(_: Dict[str, Any] = Depends(ensure_admin)) -> List[AdminModel]:
    return await admin_business.get_all_models()


@router.post("/models", response_model=AdminModel, summary="新增系统模型配置")
async def create_model(
    payload: AdminModelUpsertRequest,
    _: Dict[str, Any] = Depends(ensure_admin)
) -> AdminModel:
    created = await admin_business.create_model(payload)
    if not created:
        raise HTTPException(status_code=500, detail="创建模型配置失败")
    return created


@router.put("/models/{model_id}", response_model=AdminModel, summary="更新系统模型配置")
async def update_model(
    model_id: str,
    payload: AdminModelUpsertRequest,
    _: Dict[str, Any] = Depends(ensure_admin)
) -> AdminModel:
    updated = await admin_business.update_model(model_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Model not found or update failed")
    return updated


@router.delete("/models/{model_id}", summary="删除系统模型配置")
async def delete_model(model_id: str, _: Dict[str, Any] = Depends(ensure_admin)) -> Dict[str, Any]:
    success = await admin_business.delete_model(model_id)
    if not success:
        raise HTTPException(status_code=404, detail="Model not found or delete failed")
    return {"success": True, "message": f"Model {model_id} deleted"}


@router.get("/stats", response_model=SystemStats, summary="获取系统统计")
async def get_stats(_: Dict[str, Any] = Depends(ensure_admin)) -> SystemStats:
    """获取系统运行统计信息"""
    return await admin_business.get_system_stats()
