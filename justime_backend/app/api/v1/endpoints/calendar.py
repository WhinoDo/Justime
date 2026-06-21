"""
日历事件 API 端点
"""

import logging
import asyncio
from datetime import datetime
from typing import Any, Optional

from bson import ObjectId
from pymongo import ReturnDocument
from fastapi import APIRouter, HTTPException, Query, status

from app.core.config import settings
from app.api.deps import parse_object_id, CurrentUser
from app.database import db
from app.models.calendar import (
    CalendarEventCreate,
    CalendarEventUpdate,
    YouTubeSummaryJobCreate,
)
from app.services.youtube_summary_service import youtube_summary_service
from app.business.feishu_calendar import FeishuCalendarBusiness

logger = logging.getLogger(__name__)
router = APIRouter()


def _serialize_event(doc: dict) -> dict:
    """MongoDB 文档序列化为可返回的 JSON"""
    data = dict(doc)
    if "_id" in data:
        data["id"] = str(data.pop("_id"))
    return _to_jsonable(data)


def _to_jsonable(value: Any) -> Any:
    """递归将 Mongo 类型转换为 FastAPI 可序列化类型。"""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _to_jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_jsonable(item) for item in value]
    if isinstance(value, tuple):
        return [_to_jsonable(item) for item in value]
    return value


@router.get("/events", summary="获取日历事件列表")
async def list_events(
    current_user: CurrentUser,
    startDate: Optional[str] = Query(None, description="开始日期 ISO 8601"),
    endDate: Optional[str] = Query(None, description="结束日期 ISO 8601"),
    type: Optional[str] = Query(None, description="事件类型"),
):
    user_id = str(current_user["_id"])

    if settings.FEISHU_INTEGRATION_ENABLED:
        try:
            events = await FeishuCalendarBusiness.list_events(
                user_id=user_id,
                start_date=startDate,
                end_date=endDate
            )
            if type:
                events = [e for e in events if e.get("type") == type]
            return {
                "success": True,
                "data": {
                    "events": events
                }
            }
        except Exception as e:
            logger.error(f"Feishu list_events failed: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"飞书日历拉取失败: {e}")

    query = {
        "userId": user_id,
        "status": {"$ne": "cancelled"}
    }

    # 日期范围过滤
    if startDate and endDate:
        try:
            start_dt = datetime.fromisoformat(startDate.replace("Z", "+00:00"))
            end_dt = datetime.fromisoformat(endDate.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式错误，请使用 ISO 8601")

        query["$or"] = [
            {"start": {"$gte": start_dt, "$lte": end_dt}},
            {"end": {"$gte": start_dt, "$lte": end_dt}},
            {"start": {"$lte": start_dt}, "end": {"$gte": end_dt}}
        ]

    if type:
        query["type"] = type

    cursor = db.db["calendar_events"].find(query).sort("start", 1)
    events = await cursor.to_list(length=1000)

    return {
        "success": True,
        "data": {
            "events": [_serialize_event(e) for e in events]
        }
    }


@router.get("/events/{event_id}", summary="获取日历事件详情")
async def get_event(
    event_id: str,
    current_user: CurrentUser
):
    user_id = str(current_user["_id"])

    if settings.FEISHU_INTEGRATION_ENABLED:
        try:
            event = await FeishuCalendarBusiness.get_event(user_id, event_id)
            if not event:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="事件不存在")
            return {"success": True, "data": {"event": event}}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Feishu get_event failed: {e}")
            raise HTTPException(status_code=500, detail=f"获取飞书日程详情失败: {e}")

    # 使用验证器验证 ObjectId
    oid = parse_object_id(event_id, "事件ID")

    event = await db.db["calendar_events"].find_one({"_id": oid, "userId": user_id})
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="事件不存在")

    return {"success": True, "data": {"event": _serialize_event(event)}}


@router.post("/events", summary="创建日历事件")
async def create_event(
    payload: CalendarEventCreate,
    current_user: CurrentUser
):
    if payload.start >= payload.end:
        raise HTTPException(status_code=400, detail="结束时间必须晚于开始时间")

    user_id = str(current_user["_id"])

    if settings.FEISHU_INTEGRATION_ENABLED:
        try:
            event = await FeishuCalendarBusiness.create_event(user_id, payload)
            return {
                "success": True,
                "data": {"event": event},
                "message": "飞书日程同步创建成功"
            }
        except Exception as e:
            logger.error(f"Feishu create_event failed: {e}")
            raise HTTPException(status_code=500, detail=f"飞书日程创建失败: {e}")

    event_doc = payload.dict()
    event_doc["userId"] = user_id
    event_doc["createdAt"] = datetime.utcnow()
    event_doc["updatedAt"] = datetime.utcnow()

    result = await db.db["calendar_events"].insert_one(event_doc)
    event_doc["_id"] = result.inserted_id

    return {
        "success": True,
        "data": {"event": _serialize_event(event_doc)},
        "message": "事件创建成功"
    }


@router.put("/events/{event_id}", summary="更新日历事件")
async def update_event(
    event_id: str,
    payload: CalendarEventUpdate,
    current_user: CurrentUser
):
    user_id = str(current_user["_id"])

    if settings.FEISHU_INTEGRATION_ENABLED:
        try:
            event = await FeishuCalendarBusiness.update_event(user_id, event_id, payload)
            return {
                "success": True,
                "data": {"event": event},
                "message": "飞书日程同步更新成功"
            }
        except Exception as e:
            logger.error(f"Feishu update_event failed: {e}")
            raise HTTPException(status_code=500, detail=f"飞书日程更新失败: {e}")

    # 使用验证器验证 ObjectId
    oid = parse_object_id(event_id, "事件ID")

    update_data = payload.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="没有可更新的字段")

    existing = await db.db["calendar_events"].find_one({"_id": oid, "userId": user_id})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="事件不存在")
    old_status = existing.get("status")

    # 若更新了时间，进行校验
    if "start" in update_data or "end" in update_data:
        new_start = update_data.get("start", existing.get("start"))
        new_end = update_data.get("end", existing.get("end"))
        if new_start >= new_end:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="结束时间必须晚于开始时间")

    update_data["updatedAt"] = datetime.utcnow()

    result = await db.db["calendar_events"].find_one_and_update(
        {"_id": oid, "userId": user_id},
        {"$set": update_data},
        return_document=ReturnDocument.AFTER
    )

    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="事件不存在")

    new_status = result.get("status")
    if new_status == "completed" and old_status != "completed" and result.get("taskId"):
        from app.business.task_process_business import _task_process_business
        await _task_process_business.handle_calendar_event_status_change(user_id, old_status, new_status, result)

    return {
        "success": True,
        "data": {"event": _serialize_event(result)},
        "message": "事件更新成功"
    }


@router.delete("/events/{event_id}", summary="删除日历事件")
async def delete_event(
    event_id: str,
    current_user: CurrentUser
):
    user_id = str(current_user["_id"])

    if settings.FEISHU_INTEGRATION_ENABLED:
        try:
            await FeishuCalendarBusiness.delete_event(user_id, event_id)
            return {"success": True, "message": "飞书日程删除成功"}
        except Exception as e:
            logger.error(f"Feishu delete_event failed: {e}")
            raise HTTPException(status_code=500, detail=f"飞书日程删除失败: {e}")

    # 使用验证器验证 ObjectId
    oid = parse_object_id(event_id, "事件ID")

    result = await db.db["calendar_events"].delete_one({"_id": oid, "userId": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="事件不存在")

    return {"success": True, "message": "事件删除成功"}


@router.post(
    "/events/{event_id}/youtube-summary/jobs",
    summary="创建 YouTube 资源解析任务",
    status_code=202,
)
async def create_youtube_summary_job(
    event_id: str,
    current_user: CurrentUser,
    payload: Optional[YouTubeSummaryJobCreate] = None,
):
    user_id = str(current_user["_id"])
    # 使用验证器验证 ObjectId
    event_oid = parse_object_id(event_id, "事件ID")

    event = await db.db["calendar_events"].find_one({"_id": event_oid, "userId": user_id})
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="事件不存在")

    if await youtube_summary_service.has_active_job(event_id=event_id, user_id=user_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="当前事件已有进行中的解析任务")

    # 验证资源索引
    resource_indexes = None
    if payload and payload.resourceIndexes:
        # 验证索引值
        for idx in payload.resourceIndexes:
            if not isinstance(idx, int) or idx < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="资源索引必须是非负整数"
                )
        resource_indexes = payload.resourceIndexes

    youtube_resources = youtube_summary_service.extract_youtube_resources(
        resources=event.get("resources"),
        resource_indexes=resource_indexes,
    )
    if not youtube_resources:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="相关资源中未找到 YouTube 链接")

    job_id = await youtube_summary_service.create_job(
        event_id=event_id,
        user_id=user_id,
        resources=youtube_resources,
    )

    task = asyncio.create_task(
        youtube_summary_service.process_job(job_id=job_id, user_id=user_id, event_id=event_id)
    )
    youtube_summary_service.register_task(job_id, task)

    return {
        "success": True,
        "data": {
            "jobId": job_id,
            "status": "queued",
            "totalUrls": len(youtube_resources),
            "documentEventId": event_id,
        },
        "message": "解析任务已创建",
    }


@router.get(
    "/events/{event_id}/youtube-summary/jobs/{job_id}",
    summary="查询 YouTube 资源解析任务状态",
)
async def get_youtube_summary_job_status(
    event_id: str,
    job_id: str,
    current_user: CurrentUser,
):
    user_id = str(current_user["_id"])
    # 验证 event_id 和 job_id
    parse_object_id(event_id, "事件ID")
    validated_job_id = parse_object_id(job_id, "任务ID")

    job = await youtube_summary_service.get_job(
        job_id=str(validated_job_id),
        event_id=event_id,
        user_id=user_id,
    )
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")

    processed = int(job.get("processedUrls") or 0)
    total = int(job.get("totalUrls") or 0)
    progress = 0.0 if total <= 0 else round(processed / total, 4)

    return {
        "success": True,
        "data": {
            "jobId": str(job["_id"]),
            "status": job.get("status"),
            "currentStage": job.get("currentStage"),
            "processedUrls": processed,
            "totalUrls": total,
            "progress": progress,
            "error": job.get("error"),
            "items": _to_jsonable(job.get("items") or []),
            "documentEventId": job.get("documentEventId") or event_id,
            "createdAt": _to_jsonable(job.get("createdAt")),
            "startedAt": _to_jsonable(job.get("startedAt")),
            "completedAt": _to_jsonable(job.get("completedAt")),
        },
    }


@router.get("/feishu/config-status", summary="查询飞书日历映射集成状态")
async def get_feishu_config_status(current_user: CurrentUser):
    if not settings.FEISHU_INTEGRATION_ENABLED:
        return {
            "success": True,
            "data": {
                "enabled": False,
                "status": "disabled",
                "appId": "",
                "calendarId": "",
                "message": "飞书集成已在后端关闭",
            }
        }

    try:
        from app.services.feishu_service import FeishuService
        await FeishuService.get_tenant_access_token()
        return {
            "success": True,
            "data": {
                "enabled": True,
                "status": "connected",
                "appId": settings.FEISHU_APP_ID,
                "calendarId": settings.FEISHU_CALENDAR_ID or "默认主日历",
                "message": "已成功连通飞书开放平台",
            }
        }
    except Exception as e:
        return {
            "success": True,
            "data": {
                "enabled": True,
                "status": "error",
                "appId": settings.FEISHU_APP_ID,
                "calendarId": settings.FEISHU_CALENDAR_ID or "默认主日历",
                "message": f"连通失败: {e}",
            }
        }
