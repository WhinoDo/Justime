"""
管理后台 API Key 管理端点
"""

from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, status

from app.api.deps import parse_object_id, AdminUser as AdminDep
from app.business.admin_apikey_business import admin_apikey_business
from app.models.admin_apikey import AdminApiKey, AdminApiKeyCreated, AdminApiKeyUpsertRequest

router = APIRouter()


@router.get("/apikeys", response_model=List[AdminApiKey], summary="获取系统 API Key 列表")
async def get_apikeys(_: AdminDep) -> List[AdminApiKey]:
    return await admin_apikey_business.get_all_apikeys()


@router.post("/apikeys", response_model=AdminApiKeyCreated, summary="新增系统 API Key")
async def create_apikey(
    payload: AdminApiKeyUpsertRequest,
    _: AdminDep,
) -> AdminApiKeyCreated:
    created = await admin_apikey_business.create_apikey(payload)
    if not created:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建 API Key 失败")
    return created


@router.put("/apikeys/{key_id}", response_model=AdminApiKey, summary="更新系统 API Key")
async def update_apikey(
    key_id: str,
    payload: AdminApiKeyUpsertRequest,
    _: AdminDep,
) -> AdminApiKey:
    if not key_id or not key_id.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="API Key ID 不能为空")

    updated = await admin_apikey_business.update_apikey(key_id.strip(), payload)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API Key 不存在或更新失败")
    return updated


@router.delete("/apikeys/{key_id}", summary="删除系统 API Key")
async def delete_apikey(
    key_id: str,
    _: AdminDep,
) -> Dict[str, Any]:
    if not key_id or not key_id.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="API Key ID 不能为空")

    success = await admin_apikey_business.delete_apikey(key_id.strip())
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API Key 不存在或删除失败")
    return {"success": True, "message": f"API Key {key_id} 已删除"}
