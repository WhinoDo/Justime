"""Compatibility endpoints for the retired study module.

The old study-specific model has been folded into TaskProcess. These endpoints
keep legacy callers working while returning data from task_processes where
possible.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser
from app.business.chat_business import chat_business
from app.business.task_process_business import _task_process_business
from app.database import db
from app.models.chat import ChatRequest
from app.models.task_process import TaskProcessCreate, TaskProcessListQuery, TaskProcessOut, TaskProcessUpdate

router = APIRouter()

LEARNING_CATEGORIES = ("learning", "reading", "practice", "research")
PROFILE_COLLECTION = "study_profiles_compat"


def _task_to_study_task(task: TaskProcessOut) -> Dict[str, Any]:
    return {
        "id": task.id,
        "taskProcessId": task.id,
        "title": task.title,
        "description": task.description,
        "subject": task.category,
        "taskType": "study" if task.category == "learning" else task.category,
        "status": task.status,
        "phase": task.phase,
        "plannedDate": task.deadline,
        "estimatedHours": task.estimated_hours,
        "actualHours": task.actual_hours,
        "completionRate": round(task.progress * 100, 2),
        "tags": task.tags,
        "evidenceCount": task.evidence_count,
        "knowledgeOutputCount": task.knowledge_output_count,
        "createdAt": task.createdAt,
        "updatedAt": task.updatedAt,
        "migrationSource": "task_processes",
    }


async def _list_learning_tasks(user_id: str) -> List[TaskProcessOut]:
    result = await _task_process_business.list_task_processes(
        user_id,
        TaskProcessListQuery(page=1, page_size=100, sort_by="updatedAt", sort_order="desc"),
    )
    return [task for task in result["items"] if task.category in LEARNING_CATEGORIES]


@router.post("/profile", summary="创建/更新学习兼容配置")
async def create_or_update_profile(payload: Dict[str, Any], current_user: CurrentUser):
    user_id = str(current_user["_id"])
    now = datetime.utcnow()
    doc = {
        **payload,
        "userId": user_id,
        "updatedAt": now,
        "migrationSource": "study_compat",
    }
    await db.db[PROFILE_COLLECTION].update_one(
        {"userId": user_id},
        {"$set": doc, "$setOnInsert": {"createdAt": now}},
        upsert=True,
    )
    saved = await db.db[PROFILE_COLLECTION].find_one({"userId": user_id}, {"_id": 0})
    return {"success": True, "data": {"profile": saved}}


@router.get("/profile", summary="获取学习兼容配置")
async def get_profile(current_user: CurrentUser):
    profile = await db.db[PROFILE_COLLECTION].find_one({"userId": str(current_user["_id"])}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="尚未创建考研配置")
    return {"success": True, "data": {"profile": profile}}


@router.post("/plan", summary="生成学习计划兼容响应")
async def generate_plan(current_user: CurrentUser, payload: Optional[Dict[str, Any]] = None):
    user_id = str(current_user["_id"])
    profile = await db.db[PROFILE_COLLECTION].find_one({"userId": user_id}, {"_id": 0})
    profile_data = payload or profile or {}
    subjects = profile_data.get("subjects") or profile_data.get("tags") or []
    if not subjects and not profile_data.get("title") and not profile_data.get("goal"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="缺少学习配置或科目信息")

    title = profile_data.get("title") or f"{profile_data.get('targetMajor') or '学习'}计划"
    goal = profile_data.get("goal") or f"推进 {', '.join(subjects) if subjects else title} 学习任务"
    task = await _task_process_business.create_task_process(
        user_id,
        TaskProcessCreate(
            title=title,
            description=profile_data.get("description", ""),
            goal=goal,
            category="learning",
            tags=[str(item) for item in subjects],
            priority="medium",
            auto_plan=True,
        ),
    )
    plan = {
        "type": "task_process_generated",
        "taskProcessId": task.id,
        "title": task.title,
        "milestones": [item.model_dump(mode="json") for item in task.milestones],
        "migrationSource": "task_processes",
    }
    return {"success": True, "data": {"plan": plan, "agentResult": "已创建学习类 TaskProcess。"}}


@router.get("/plan", summary="获取当前学习计划兼容响应")
async def get_plan(current_user: CurrentUser):
    tasks = await _list_learning_tasks(str(current_user["_id"]))
    if not tasks:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="尚未生成学习计划")
    return {
        "success": True,
        "data": {
            "plan": {
                "type": "task_processes",
                "tasks": [_task_to_study_task(task) for task in tasks],
            }
        },
    }


@router.get("/tasks", summary="获取学习任务兼容列表")
async def get_tasks(
    current_user: CurrentUser,
    date: Optional[str] = Query(None, description="日期过滤，格式 YYYY-MM-DD"),
):
    tasks = await _list_learning_tasks(str(current_user["_id"]))
    if date:
        tasks = [task for task in tasks if not task.deadline or str(task.deadline).startswith(date)]
    return {"success": True, "data": {"tasks": [_task_to_study_task(task) for task in tasks]}}


@router.patch("/tasks/{task_id}", summary="更新学习任务兼容状态")
async def update_task(task_id: str, payload: Dict[str, Any], current_user: CurrentUser):
    updates: Dict[str, Any] = {}
    if "status" in payload:
        updates["status"] = payload["status"]
        if payload["status"] == "completed":
            updates["phase"] = "after"
            updates["progress"] = 1.0
        elif payload["status"] in {"active", "in_progress"}:
            updates["status"] = "active"
            updates["phase"] = "during"
    if "completionRate" in payload:
        updates["progress"] = max(0.0, min(float(payload["completionRate"]) / 100, 1.0))
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="没有可更新的字段")

    try:
        task = await _task_process_business.update_task_process(
            str(current_user["_id"]),
            task_id,
            TaskProcessUpdate(**updates),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")
    return {"success": True, "data": {"task": _task_to_study_task(task)}}


@router.get("/progress", summary="获取学习进度兼容统计")
async def get_progress(current_user: CurrentUser):
    tasks = await _list_learning_tasks(str(current_user["_id"]))
    recent_cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    recent_tasks = [
        task for task in tasks
        if task.updatedAt and task.updatedAt.replace(tzinfo=timezone.utc) >= recent_cutoff
    ]
    return {
        "success": True,
        "data": {
            "recentRecords": [_task_to_study_task(task) for task in recent_tasks],
            "totalHoursLast7Days": round(sum(task.actual_hours for task in recent_tasks), 2),
            "totalHours": round(sum(task.actual_hours for task in tasks), 2),
            "completedTasks": len([task for task in tasks if task.status == "completed"]),
            "activeTasks": len([task for task in tasks if task.status in {"active", "blocked"}]),
            "migrationSource": "task_processes",
        },
    }


@router.post("/chat", summary="学习场景对话兼容入口")
async def study_chat(payload: Dict[str, Any], current_user: CurrentUser):
    message = str(payload.get("message", "")).strip()
    if not message:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="消息不能为空")
    request = ChatRequest(
        message=message,
        taskId=payload.get("taskId"),
        sessionId=payload.get("sessionId"),
        useWebSearch=bool(payload.get("useWebSearch", False)),
        routeMode=payload.get("routeMode") or "auto",
        runtimeModelId=payload.get("runtimeModelId"),
    )
    return await chat_business.process_chat(request, str(current_user["_id"]))


@router.get("/report/weekly", summary="获取周度学习报告兼容响应")
async def get_weekly_report(current_user: CurrentUser):
    progress = await get_progress(current_user)
    return {"success": True, "data": {"period": "weekly", "stats": progress["data"], "migrationSource": "task_processes"}}


@router.get("/report/monthly", summary="获取月度学习报告兼容响应")
async def get_monthly_report(current_user: CurrentUser):
    progress = await get_progress(current_user)
    return {"success": True, "data": {"period": "monthly", "stats": progress["data"], "migrationSource": "task_processes"}}


@router.post("/exam/analyze", summary="真题分析兼容提示")
async def analyze_exam(payload: Dict[str, Any], current_user: CurrentUser):
    subject = str(payload.get("subject", "")).strip()
    if not subject:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="科目不能为空")
    raise HTTPException(status_code=status.HTTP_410_GONE, detail="study 真题分析已迁移，请使用 reading/research TaskProcess 记录资料与 Evidence")


@router.post("/sprint-plan", summary="冲刺计划兼容响应")
async def create_sprint_plan(payload: Dict[str, Any], current_user: CurrentUser):
    days_before_exam = payload.get("daysBeforeExam", 30)
    try:
        days = max(1, int(days_before_exam))
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="天数格式错误")
    tasks = await _list_learning_tasks(str(current_user["_id"]))
    return {
        "success": True,
        "data": {
            "daysBeforeExam": days,
            "tasks": [_task_to_study_task(task) for task in tasks[:10]],
            "migrationSource": "task_processes",
        },
    }
