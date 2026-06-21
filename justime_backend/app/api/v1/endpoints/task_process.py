"""TaskProcess endpoints."""

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser
from app.business.task_process_business import _task_process_business
from app.models.task_process import TaskAgentRequest, TaskProcessCreate, TaskProcessListQuery, TaskProcessUpdate

router = APIRouter()


@router.post("", summary="创建任务进程")
async def create_task_process(payload: TaskProcessCreate, current_user: CurrentUser):
    task = await _task_process_business.create_task_process(str(current_user["_id"]), payload)
    return {"success": True, "data": {"task": task}}


@router.get("", summary="获取任务进程列表")
async def list_task_processes(
    current_user: CurrentUser,
    status_value: str | None = Query(None, alias="status"),
    phase: str | None = Query(None),
    category: str | None = Query(None),
    priority: str | None = Query(None),
    search: str | None = Query(None),
    sort_by: str = Query("updatedAt"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    query = TaskProcessListQuery(
        status=status_value,
        phase=phase,
        category=category,
        priority=priority,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )
    result = await _task_process_business.list_task_processes(str(current_user["_id"]), query)
    return {"success": True, "data": result}


@router.get("/{task_id}", summary="获取任务进程详情")
async def get_task_process(task_id: str, current_user: CurrentUser):
    task = await _task_process_business.get_task_process(str(current_user["_id"]), task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")
    return {"success": True, "data": {"task": task}}


@router.patch("/{task_id}", summary="更新任务进程")
async def update_task_process(task_id: str, payload: TaskProcessUpdate, current_user: CurrentUser):
    try:
        task = await _task_process_business.update_task_process(str(current_user["_id"]), task_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")
    return {"success": True, "data": {"task": task}}


@router.post("/{task_id}/agent", summary="运行任务 Agent")
async def run_task_agent(task_id: str, payload: TaskAgentRequest, current_user: CurrentUser):
    if payload.task_id != task_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="路径 task_id 与请求体不一致")
    result = await _task_process_business.run_task_agent(str(current_user["_id"]), task_id, payload.mode, payload.user_input)
    if not result.success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result.error or "任务不存在")
    return {"success": True, "data": {"agent": result}}
