"""
日历事件 API 端点
"""

from datetime import datetime
from typing import Any, Optional

from bson import ObjectId
from pymongo import ReturnDocument
from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import db
from app.models.calendar import CalendarEventCreate, CalendarEventUpdate
from app.services.security_service import SecurityService

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
    startDate: Optional[str] = Query(None, description="开始日期 ISO 8601"),
    endDate: Optional[str] = Query(None, description="结束日期 ISO 8601"),
    type: Optional[str] = Query(None, description="事件类型"),
    current_user: dict = Depends(SecurityService.get_current_user)
):
    user_id = str(current_user["_id"])

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
    current_user: dict = Depends(SecurityService.get_current_user)
):
    user_id = str(current_user["_id"])
    try:
        oid = ObjectId(event_id)
    except Exception:
        raise HTTPException(status_code=400, detail="无效的事件ID")

    event = await db.db["calendar_events"].find_one({"_id": oid, "userId": user_id})
    if not event:
        raise HTTPException(status_code=404, detail="事件不存在")

    return {"success": True, "data": {"event": _serialize_event(event)}}


@router.post("/events", summary="创建日历事件")
async def create_event(
    payload: CalendarEventCreate,
    current_user: dict = Depends(SecurityService.get_current_user)
):
    if payload.start >= payload.end:
        raise HTTPException(status_code=400, detail="结束时间必须晚于开始时间")

    user_id = str(current_user["_id"])
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
    current_user: dict = Depends(SecurityService.get_current_user)
):
    user_id = str(current_user["_id"])
    try:
        oid = ObjectId(event_id)
    except Exception:
        raise HTTPException(status_code=400, detail="无效的事件ID")

    update_data = payload.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="没有可更新的字段")

    # 若更新了时间，进行校验
    if "start" in update_data or "end" in update_data:
        existing = await db.db["calendar_events"].find_one({"_id": oid, "userId": user_id})
        if not existing:
            raise HTTPException(status_code=404, detail="事件不存在")

        new_start = update_data.get("start", existing.get("start"))
        new_end = update_data.get("end", existing.get("end"))
        if new_start >= new_end:
            raise HTTPException(status_code=400, detail="结束时间必须晚于开始时间")

    update_data["updatedAt"] = datetime.utcnow()

    result = await db.db["calendar_events"].find_one_and_update(
        {"_id": oid, "userId": user_id},
        {"$set": update_data},
        return_document=ReturnDocument.AFTER
    )

    if not result:
        raise HTTPException(status_code=404, detail="事件不存在")

    return {
        "success": True,
        "data": {"event": _serialize_event(result)},
        "message": "事件更新成功"
    }


@router.delete("/events/{event_id}", summary="删除日历事件")
async def delete_event(
    event_id: str,
    current_user: dict = Depends(SecurityService.get_current_user)
):
    user_id = str(current_user["_id"])
    try:
        oid = ObjectId(event_id)
    except Exception:
        raise HTTPException(status_code=400, detail="无效的事件ID")

    result = await db.db["calendar_events"].delete_one({"_id": oid, "userId": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="事件不存在")

    return {"success": True, "message": "事件删除成功"}
