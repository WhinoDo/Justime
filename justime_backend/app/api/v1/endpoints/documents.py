"""
工作文档 API 端点
"""

from datetime import datetime
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, HTTPException, status

from app.api.deps import parse_object_id, CurrentUser
from app.database import db
from app.models.document import WorkDocumentUpdate

router = APIRouter()


def _serialize_doc(doc: dict) -> dict:
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


@router.get("", summary="获取工作文档")
async def get_document(
    eventId: str,
    current_user: CurrentUser,
):
    user_id = str(current_user["_id"])
    event_oid = parse_object_id(eventId, "事件ID")

    event = await db.db["calendar_events"].find_one(
        {"_id": event_oid, "userId": user_id}
    )
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="未找到相关日程或无权访问"
        )

    document = await db.db["work_documents"].find_one(
        {"eventId": eventId, "userId": user_id}
    )

    if not document:
        return {
            "success": True,
            "data": {
                "document": {
                    "eventId": eventId,
                    "userId": user_id,
                    "content": "",
                    "version": 0,
                }
            },
        }

    return {"success": True, "data": {"document": _serialize_doc(document)}}


@router.post("", summary="保存工作文档")
async def save_document(
    payload: WorkDocumentUpdate,
    current_user: CurrentUser,
):
    user_id = str(current_user["_id"])

    body = payload.dict()
    content = body["content"]
    event_id = body.get("eventId")

    if not event_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="缺少必需字段 eventId"
        )

    event_oid = parse_object_id(event_id, "事件ID")

    event = await db.db["calendar_events"].find_one(
        {"_id": event_oid, "userId": user_id}
    )
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="未找到相关日程或无权访问"
        )

    now = datetime.utcnow()

    result = await db.db["work_documents"].find_one_and_update(
        {"eventId": event_id, "userId": user_id},
        {
            "$set": {
                "content": content,
                "lastSavedAt": now,
                "updatedAt": now,
            },
            "$inc": {"version": 1},
        },
        upsert=True,
        return_document=True,
    )

    if not result:
        doc = {
            "eventId": event_id,
            "userId": user_id,
            "content": content,
            "version": 1,
            "lastSavedAt": now,
            "createdAt": now,
            "updatedAt": now,
        }
        await db.db["work_documents"].insert_one(doc)
        result = doc

    return {
        "success": True,
        "data": {"document": _serialize_doc(result)},
        "message": "文档保存成功",
    }
