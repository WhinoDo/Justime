"""Evidence endpoints."""

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser
from app.business.task_process_business import _task_process_business
from app.models.evidence import EvidenceCreate, EvidenceUpdate, TimeLogCreate

router = APIRouter()


@router.get("/{task_id}/evidence", summary="获取任务 Evidence 列表")
async def list_task_evidence(task_id: str, current_user: CurrentUser):
    items = await _task_process_business.list_evidence(str(current_user["_id"]), task_id)
    return {"success": True, "data": {"items": items}}


@router.post("/{task_id}/evidence", summary="新增任务 Evidence")
async def create_task_evidence(task_id: str, payload: EvidenceCreate, current_user: CurrentUser):
    if payload.task_id != task_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="路径 task_id 与请求体不一致")
    try:
        item = await _task_process_business.create_evidence(str(current_user["_id"]), payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"success": True, "data": {"evidence": item}}


@router.post("/{task_id}/evidence/time-log", summary="快捷记录时间日志")
async def create_time_log(task_id: str, payload: TimeLogCreate, current_user: CurrentUser):
    if payload.task_id != task_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="路径 task_id 与请求体不一致")
    try:
        item = await _task_process_business.create_time_log(str(current_user["_id"]), payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"success": True, "data": {"evidence": item}}


@router.patch("/evidence/{evidence_id}", summary="更新 Evidence")
async def update_evidence(evidence_id: str, payload: EvidenceUpdate, current_user: CurrentUser):
    item = await _task_process_business.update_evidence(str(current_user["_id"]), evidence_id, payload)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence 不存在或没有可更新字段")
    return {"success": True, "data": {"evidence": item}}
