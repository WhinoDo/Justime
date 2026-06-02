"""
考研学习 API 端点
"""

from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import parse_object_id
from app.business.study_agent_business import study_agent_business
from app.models.study import (
    StudyProfileCreate,
    StudyProfileUpdate,
    StudyTaskUpdate,
)
from app.services.security_service import SecurityService
from app.services.exam_analysis_service import exam_analysis_service
from app.services.study_report_service import study_report_service

router = APIRouter()


@router.post("/profile", summary="创建/更新考研配置")
async def create_or_update_profile(
    payload: StudyProfileCreate,
    current_user: dict = Depends(SecurityService.get_current_user),
):
    user_id = str(current_user["_id"])
    profile = await study_agent_business.create_profile(user_id, payload.dict())
    return {"success": True, "data": {"profile": profile}}


@router.get("/profile", summary="获取考研配置")
async def get_profile(
    current_user: dict = Depends(SecurityService.get_current_user),
):
    user_id = str(current_user["_id"])
    profile = await study_agent_business.get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="尚未创建考研配置")
    return {"success": True, "data": {"profile": profile}}


@router.post("/plan", summary="生成学习计划")
async def generate_plan(
    payload: Optional[Dict[str, Any]] = None,
    current_user: dict = Depends(SecurityService.get_current_user),
):
    user_id = str(current_user["_id"])
    profile_data = payload or {}
    result = await study_agent_business.generate_and_sync_plan(user_id, profile_data)
    if not result.get("success"):
        error_detail = result.get("error", "生成计划失败")
        status_code = 400 if any(k in error_detail for k in ["配置", "科目", "日期"]) else 500
        raise HTTPException(status_code=status_code, detail=error_detail)
    return {"success": True, "data": result.get("data", {})}


@router.get("/plan", summary="获取当前计划")
async def get_plan(
    current_user: dict = Depends(SecurityService.get_current_user),
):
    user_id = str(current_user["_id"])
    plan = await study_agent_business.get_plan(user_id)
    if not plan:
        raise HTTPException(status_code=404, detail="尚未生成学习计划")
    return {"success": True, "data": {"plan": plan}}


@router.get("/tasks", summary="获取任务列表")
async def get_tasks(
    date: Optional[str] = Query(None, description="日期过滤，格式 YYYY-MM-DD"),
    current_user: dict = Depends(SecurityService.get_current_user),
):
    user_id = str(current_user["_id"])
    tasks = await study_agent_business.get_tasks(user_id, date=date)
    return {"success": True, "data": {"tasks": tasks}}


@router.patch("/tasks/{task_id}", summary="更新任务状态")
async def update_task(
    task_id: str,
    payload: StudyTaskUpdate,
    current_user: dict = Depends(SecurityService.get_current_user),
):
    user_id = str(current_user["_id"])
    updates = payload.dict(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="没有可更新的字段")

    result = await study_agent_business.update_task(user_id, task_id, updates)
    if not result:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"success": True, "data": {"task": result}}


@router.get("/progress", summary="获取学习进度")
async def get_progress(
    current_user: dict = Depends(SecurityService.get_current_user),
):
    user_id = str(current_user["_id"])
    result = await study_agent_business.get_progress(user_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "查询进度失败"))
    return {"success": True, "data": result.get("data", {})}


@router.post("/chat", summary="学习场景对话（走 Agent）")
async def study_chat(
    payload: Dict[str, Any],
    current_user: dict = Depends(SecurityService.get_current_user),
):
    user_id = str(current_user["_id"])
    message = payload.get("message", "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="消息不能为空")

    result = await study_agent_business.process_study_request(user_id, message)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "处理请求失败"))
    return {"success": True, "data": result.get("data", {})}


@router.get("/report/weekly", summary="获取周度学习报告")
async def get_weekly_report(
    current_user: dict = Depends(SecurityService.get_current_user),
):
    user_id = str(current_user["_id"])
    result = await study_report_service.generate_weekly_report(user_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "生成周报失败"))
    return {"success": True, "data": result.get("data", {})}


@router.get("/report/monthly", summary="获取月度学习报告")
async def get_monthly_report(
    current_user: dict = Depends(SecurityService.get_current_user),
):
    user_id = str(current_user["_id"])
    result = await study_report_service.generate_monthly_report(user_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "生成月报失败"))
    return {"success": True, "data": result.get("data", {})}


@router.post("/exam/analyze", summary="分析真题趋势")
async def analyze_exam(
    payload: Dict[str, Any],
    current_user: dict = Depends(SecurityService.get_current_user),
):
    user_id = str(current_user["_id"])
    subject = payload.get("subject", "").strip()
    if not subject:
        raise HTTPException(status_code=400, detail="科目不能为空")

    result = await exam_analysis_service.analyze_exam_trends(user_id, subject)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "分析真题趋势失败"))
    return {"success": True, "data": result.get("data", {})}


@router.post("/sprint-plan", summary="生成考前冲刺计划")
async def create_sprint_plan(
    payload: Dict[str, Any],
    current_user: dict = Depends(SecurityService.get_current_user),
):
    user_id = str(current_user["_id"])
    days_before_exam = payload.get("daysBeforeExam")
    if days_before_exam is None:
        profile = await study_agent_business.get_profile(user_id)
        if profile and profile.get("examDate"):
            from datetime import timezone
            try:
                exam_dt = datetime.fromisoformat(profile["examDate"].replace("Z", "+00:00"))
                days_before_exam = (exam_dt - datetime.now(timezone.utc)).days
            except (ValueError, TypeError):
                days_before_exam = 30
        else:
            days_before_exam = 30

    try:
        days_before_exam = max(1, int(days_before_exam))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="天数格式错误")

    result = await study_report_service.generate_sprint_plan(user_id, days_before_exam)
    if not result.get("success"):
        error_detail = result.get("error", "生成冲刺计划失败")
        status_code = 400 if "配置" in error_detail else 500
        raise HTTPException(status_code=status_code, detail=error_detail)
    return {"success": True, "data": result.get("data", {})}
