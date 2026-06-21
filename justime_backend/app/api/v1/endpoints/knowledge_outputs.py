"""Knowledge output endpoints."""

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser
from app.business.task_process_business import _task_process_business
from app.models.knowledge_output import (
    GenerateKnowledgeRequest,
    KnowledgeOutputCreate,
    KnowledgeOutputUpdate,
    KnowledgeRollbackRequest,
    VaultConfigUpdate,
)

router = APIRouter()


@router.get("/vault-config", summary="获取 Vault 配置")
async def get_vault_config(current_user: CurrentUser):
    config = await _task_process_business.get_vault_config(str(current_user["_id"]))
    return {"success": True, "data": {"config": config}}


@router.put("/vault-config", summary="更新 Vault 配置")
async def update_vault_config(payload: VaultConfigUpdate, current_user: CurrentUser):
    config = await _task_process_business.update_vault_config(str(current_user["_id"]), payload)
    return {"success": True, "data": {"config": config}}


@router.get("/{task_id}/knowledge-outputs", summary="获取任务知识产出列表")
async def list_knowledge_outputs(task_id: str, current_user: CurrentUser):
    items = await _task_process_business.list_knowledge_outputs(str(current_user["_id"]), task_id)
    return {"success": True, "data": {"items": items}}


@router.post("/{task_id}/knowledge-outputs", summary="创建任务知识产出")
async def create_knowledge_output(task_id: str, payload: KnowledgeOutputCreate, current_user: CurrentUser):
    if payload.task_id != task_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="路径 task_id 与请求体不一致")
    try:
        item = await _task_process_business.create_knowledge_output(str(current_user["_id"]), payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"success": True, "data": {"knowledge_output": item}}


@router.post("/{task_id}/knowledge-outputs/generate", summary="生成任务知识产出")
async def generate_knowledge_output(task_id: str, payload: GenerateKnowledgeRequest, current_user: CurrentUser):
    if payload.task_id != task_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="路径 task_id 与请求体不一致")
    try:
        item = await _task_process_business.generate_knowledge_output(str(current_user["_id"]), payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"success": True, "data": {"knowledge_output": item}}


@router.patch("/knowledge-outputs/{output_id}", summary="更新知识产出")
async def update_knowledge_output(output_id: str, payload: KnowledgeOutputUpdate, current_user: CurrentUser):
    item = await _task_process_business.update_knowledge_output(str(current_user["_id"]), output_id, payload)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识产出不存在或没有可更新字段")
    return {"success": True, "data": {"knowledge_output": item}}


@router.post("/knowledge-outputs/{output_id}/publish", summary="发布知识产出到 Vault")
async def publish_knowledge_output(output_id: str, current_user: CurrentUser):
    try:
        item = await _task_process_business.publish_knowledge_output(str(current_user["_id"]), output_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识产出不存在")
    return {"success": True, "data": {"knowledge_output": item}}


@router.post("/knowledge-outputs/{output_id}/rollback", summary="回滚知识产出到指定版本")
async def rollback_knowledge_output(output_id: str, payload: KnowledgeRollbackRequest, current_user: CurrentUser):
    try:
        item = await _task_process_business.rollback_knowledge_output(str(current_user["_id"]), output_id, payload.version)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识产出不存在")
    return {"success": True, "data": {"knowledge_output": item}}
