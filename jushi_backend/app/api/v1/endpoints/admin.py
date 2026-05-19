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
from app.api.deps import parse_object_id, require_admin
from app.business.admin_business import admin_business
from app.services.cache_service import CacheService
from app.core.redis_client import RedisClient

router = APIRouter()


@router.get("/users", response_model=List[AdminUser], summary="获取用户列表")
async def get_users(_: Dict[str, Any] = Depends(require_admin)) -> List[AdminUser]:
    """获取所有用户列表"""
    return await admin_business.get_all_users()


@router.put("/users/{user_id}/status", summary="更新用户状态")
async def update_user_status(
    user_id: str,
    payload: UserStatusUpdateRequest,
    _: Dict[str, Any] = Depends(require_admin)
) -> Dict[str, Any]:
    # 验证 user_id 格式
    validated_user_id = parse_object_id(user_id, "用户ID")

    success = await admin_business.update_user_status(str(validated_user_id), payload.status)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在或更新失败")
    return {"success": True, "message": f"用户状态已更新为 {payload.status}"}


@router.put("/users/{user_id}/role", summary="更新用户角色")
async def update_user_role(
    user_id: str,
    payload: UserRoleUpdateRequest,
    _: Dict[str, Any] = Depends(require_admin)
) -> Dict[str, Any]:
    # 验证 user_id 格式
    validated_user_id = parse_object_id(user_id, "用户ID")

    success = await admin_business.update_user_role(str(validated_user_id), payload.role)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在或更新失败")
    return {"success": True, "message": f"用户角色已更新为 {payload.role}"}


@router.put("/users/{user_id}/models", summary="更新用户模型访问权限")
async def update_user_model_access(
    user_id: str,
    payload: UserModelAccessUpdateRequest,
    _: Dict[str, Any] = Depends(require_admin)
) -> Dict[str, Any]:
    # 验证 user_id 格式
    validated_user_id = parse_object_id(user_id, "用户ID")

    # 验证 allowed_model_ids 中的每个 ID
    if payload.allowed_model_ids:
        for model_id in payload.allowed_model_ids:
            if not model_id or not model_id.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="模型ID不能为空"
                )

    success = await admin_business.update_user_model_access(
        user_id=str(validated_user_id),
        access_all_models=payload.access_all_models,
        allowed_model_ids=payload.allowed_model_ids,
    )
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在或更新失败")
    return {"success": True, "message": "用户模型权限更新成功"}


@router.delete("/users/{user_id}", summary="删除用户")
async def delete_user(user_id: str, _: Dict[str, Any] = Depends(require_admin)) -> Dict[str, Any]:
    """删除指定用户"""
    # 验证 user_id 格式
    validated_user_id = parse_object_id(user_id, "用户ID")

    success = await admin_business.delete_user(str(validated_user_id))
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在或删除失败")
    return {"success": True, "message": f"用户 {user_id} 已删除"}


@router.get("/models", response_model=List[AdminModel], summary="获取系统模型配置")
async def get_models(_: Dict[str, Any] = Depends(require_admin)) -> List[AdminModel]:
    return await admin_business.get_all_models()


@router.post("/models", response_model=AdminModel, summary="新增系统模型配置")
async def create_model(
    payload: AdminModelUpsertRequest,
    _: Dict[str, Any] = Depends(require_admin)
) -> AdminModel:
    created = await admin_business.create_model(payload)
    if not created:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建模型配置失败")
    return created


@router.put("/models/{model_id}", response_model=AdminModel, summary="更新系统模型配置")
async def update_model(
    model_id: str,
    payload: AdminModelUpsertRequest,
    _: Dict[str, Any] = Depends(require_admin)
) -> AdminModel:
    # 验证 model_id 格式（可以是自定义ID或ObjectId）
    if not model_id or not model_id.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="模型ID不能为空")

    updated = await admin_business.update_model(model_id.strip(), payload)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="模型不存在或更新失败")
    return updated


@router.delete("/models/{model_id}", summary="删除系统模型配置")
async def delete_model(model_id: str, _: Dict[str, Any] = Depends(require_admin)) -> Dict[str, Any]:
    # 验证 model_id 格式
    if not model_id or not model_id.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="模型ID不能为空")

    success = await admin_business.delete_model(model_id.strip())
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="模型不存在或删除失败")
    return {"success": True, "message": f"模型 {model_id} 已删除"}


@router.get("/stats", response_model=SystemStats, summary="获取系统统计")
async def get_stats(_: Dict[str, Any] = Depends(require_admin)) -> SystemStats:
    """获取系统运行统计信息"""
    return await admin_business.get_system_stats()


@router.get("/cache/stats", summary="获取缓存统计")
async def get_cache_stats(_: Dict[str, Any] = Depends(require_admin)) -> Dict[str, Any]:
    """获取缓存命中率和统计信息"""
    stats = CacheService.get_cache_stats()
    return {
        "redis_enabled": RedisClient.is_enabled(),
        "cache_stats": stats,
        "summary": {
            "total_hits": sum(s.get("hits", 0) for s in stats.values()),
            "total_misses": sum(s.get("misses", 0) for s in stats.values()),
        }
    }


@router.post("/cache/invalidate", summary="使所有缓存失效")
async def invalidate_all_cache(_: Dict[str, Any] = Depends(require_admin)) -> Dict[str, Any]:
    """使所有缓存失效（慎用）"""
    # 获取所有缓存键的模式匹配
    if RedisClient.is_enabled():
        # 重新初始化统计
        CacheService.reset_cache_stats()
        return {"success": True, "message": "缓存统计已重置，Redis 缓存将按 TTL 自然过期"}
    return {"success": False, "message": "Redis 未启用"}
