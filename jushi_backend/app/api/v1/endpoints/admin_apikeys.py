"""
管理后台 API Key 管理端点
"""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import parse_object_id, require_admin
from app.business.admin_apikey_business import admin_apikey_business
from app.models.admin_apikey import AdminApiKey, AdminApiKeyUpsertRequest

router = APIRouter()


@router.get("/apikeys", response_model=List[AdminApiKey], summary="获取系统 API Key 列表")
async def get_apikeys(_: Dict[str, Any] = Depends(require_admin)) -> List[AdminApiKey]:
    return await admin_apikey_business.get_all_apikeys()


@router.post("/apikeys", response_model=AdminApiKey, summary="新增系统 API Key")
async def create_apikey(
    payload: AdminApiKeyUpsertRequest,
    _: Dict[str, Any] = Depends(require_admin),
) -> AdminApiKey:
    created = await admin_apikey_business.create_apikey(payload)
    if not created:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建 API Key 失败")
    return created


@router.put("/apikeys/{key_id}", response_model=AdminApiKey, summary="更新系统 API Key")
async def update_apikey(
    key_id: str,
    payload: AdminApiKeyUpsertRequest,
    _: Dict[str, Any] = Depends(require_admin),
) -> AdminApiKey:
    # 验证 key_id 格式
    validated_key_id = parse_object_id(key_id, "API Key ID")

    updated = await admin_apikey_business.update_apikey(str(validated_key_id), payload)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API Key 不存在或更新失败")
    return updated


@router.delete("/apikeys/{key_id}", summary="删除系统 API Key")
async def delete_apikey(
    key_id: str,
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    # 验证 key_id 格式
    validated_key_id = parse_object_id(key_id, "API Key ID")

    success = await admin_apikey_business.delete_apikey(str(validated_key_id))
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API Key 不存在或删除失败")
    return {"success": True, "message": f"API Key {key_id} 已删除"}
