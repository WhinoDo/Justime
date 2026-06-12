"""
飞书日历与 MongoDB 双源融合业务编排层
提供日历数据的双向转换、数据合并与 CRUD 融合逻辑
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId

from app.database import db
from app.services.feishu_service import FeishuService
from app.models.calendar import CalendarEventCreate, CalendarEventUpdate

logger = logging.getLogger(__name__)


class FeishuCalendarBusiness:
    
    @classmethod
    def _parse_iso_to_timestamp(cls, iso_str: Optional[str]) -> Optional[int]:
        """将 ISO 8601 日期字符串转换为秒级 Unix 时间戳"""
        if not iso_str:
            return None
        try:
            # 格式兼容 Z 转换为 +00:00
            iso_clean = iso_str.replace("Z", "+00:00")
            dt = datetime.fromisoformat(iso_clean)
            return int(dt.timestamp())
        except Exception as e:
            logger.warning(f"Error parsing date string {iso_str}: {e}")
            return None

    @classmethod
    def _to_rfc3339(cls, dt: datetime) -> str:
        """将 datetime 转换为 RFC3339 带时区格式字符串 (飞书 API 友好型)"""
        if dt.tzinfo is None:
            # 若无时区，默认填充 UTC 并转换为 +00:00
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    @classmethod
    def feishu_to_justime_event(
        cls, 
        feishu_event: Dict[str, Any], 
        local_extra: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        飞书日历事件转为 Justime 兼容格式
        进行时间格式清洗和字段重命名映射
        """
        event_id = feishu_event.get("event_id", "")
        local_extra = local_extra or {}
        
        # 1. 解析飞书起止时间 (支持带时区解析并统一返回 iso format 字符串)
        start_time_obj = feishu_event.get("start_time", {})
        end_time_obj = feishu_event.get("end_time", {})
        
        start_iso = start_time_obj.get("date_time", "")
        end_iso = end_time_obj.get("date_time", "")
        
        # 2. 地点提取
        location_obj = feishu_event.get("location", {})
        location_name = location_obj.get("name", "")
        
        # 3. 构造基础映射字典 (保留 _id / id，供前端 CRUD 匹配使用)
        justime_event = {
            "id": event_id,
            "_id": event_id,
            "title": feishu_event.get("summary", "无标题日程"),
            "description": feishu_event.get("description", ""),
            "start": start_iso,
            "end": end_iso,
            "allDay": feishu_event.get("is_all_day", False),
            "location": location_name,
            
            # 4. 融合本地 MongoDB 中的专属高级属性 (若无则取缺省值)
            "type": local_extra.get("type", "other"),
            "priority": local_extra.get("priority", "medium"),
            "status": local_extra.get("status", "confirmed"),
            "color": local_extra.get("color", "#3b82f6"),
            "resources": local_extra.get("resources", []),
            "reminders": local_extra.get("reminders", []),
            "emotionScore": local_extra.get("emotionScore", None),
            "aiGenerated": local_extra.get("aiGenerated", False),
            "taskId": local_extra.get("taskId", None),
            "userId": local_extra.get("userId", "")
        }
        
        return justime_event

    @classmethod
    def justime_to_feishu_event(cls, justime_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        将 Justime 结构适配为飞书创建/更新 API 输入结构
        """
        start = justime_data.get("start")
        end = justime_data.get("end")
        
        # 支持 datetime 转化
        start_iso = cls._to_rfc3339(start) if isinstance(start, datetime) else str(start)
        end_iso = cls._to_rfc3339(end) if isinstance(end, datetime) else str(end)
        
        feishu_event = {
            "summary": justime_data.get("title", ""),
            "description": justime_data.get("description", ""),
            "start_time": {
                "date_time": start_iso
            },
            "end_time": {
                "date_time": end_iso
            }
        }
        
        # 处理全天事件
        if justime_data.get("allDay"):
            feishu_event["is_all_day"] = True
            
        # 处理地点
        location = justime_data.get("location")
        if location:
            feishu_event["location"] = {"name": location}
            
        return feishu_event

    @classmethod
    async def list_events(
        cls,
        user_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        飞书日程列表与本地额外信息融合
        """
        # 1. 时间戳转换
        start_seconds = cls._parse_iso_to_timestamp(start_date)
        end_seconds = cls._parse_iso_to_timestamp(end_date)
        
        # 2. 调用飞书 API 拉取飞书日程
        feishu_events = await FeishuService.list_events(start_seconds, end_seconds)
        if not feishu_events:
            return []
            
        # 3. 提取全部飞书 event_id 去 MongoDB 批量查询额外字段
        feishu_event_ids = [e.get("event_id") for e in feishu_events if e.get("event_id")]
        
        local_extras = {}
        if feishu_event_ids:
            cursor = db.db["calendar_events"].find({
                "_id": {"$in": feishu_event_ids},
                "userId": user_id
            })
            extras_list = await cursor.to_list(length=len(feishu_event_ids))
            local_extras = {str(extra["_id"]): extra for extra in extras_list}
            
        # 4. 双向字段融合
        merged_events = []
        for fe_event in feishu_events:
            ev_id = fe_event.get("event_id")
            extra = local_extras.get(ev_id)
            merged = cls.feishu_to_justime_event(fe_event, extra)
            merged["userId"] = user_id
            merged_events.append(merged)
            
        return merged_events

    @classmethod
    async def get_event(cls, user_id: str, event_id: str) -> Optional[Dict[str, Any]]:
        """
        获取单个飞书日程并融合本地信息
        """
        # 1. 飞书拉取日程
        feishu_event = await FeishuService.get_event(event_id)
        if not feishu_event:
            return None
            
        # 2. 从本地 MongoDB 读取附加属性
        local_extra = await db.db["calendar_events"].find_one({
            "_id": event_id,
            "userId": user_id
        })
        
        merged = cls.feishu_to_justime_event(feishu_event, local_extra)
        merged["userId"] = user_id
        return merged

    @classmethod
    async def create_event(cls, user_id: str, payload: CalendarEventCreate) -> Dict[str, Any]:
        """
        在飞书与本地双端创建日程并关联
        """
        event_dict = payload.dict()
        
        # 1. 转化为飞书日程并调用飞书接口创建
        feishu_payload = cls.justime_to_feishu_event(event_dict)
        fe_event = await FeishuService.create_event(feishu_payload)
        
        event_id = fe_event.get("event_id")
        if not event_id:
            raise ValueError("飞书日程创建成功，但返回的日程中缺少 event_id")
            
        # 2. 本地 MongoDB 冗余补充数据 (以 event_id 作为 MongoDB 的 _id 主键，实现 1 对 1 精确映射)
        mongo_doc = {
            "_id": event_id,
            "userId": user_id,
            "type": event_dict.get("type", "other"),
            "priority": event_dict.get("priority", "medium"),
            "status": event_dict.get("status", "confirmed"),
            "color": event_dict.get("color", "#3b82f6"),
            "resources": event_dict.get("resources") or [],
            "reminders": event_dict.get("reminders") or [],
            "emotionScore": event_dict.get("emotionScore"),
            "aiGenerated": event_dict.get("aiGenerated", False),
            "taskId": event_dict.get("taskId"),
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        await db.db["calendar_events"].insert_one(mongo_doc)
        
        # 3. 最终组装回 Justime 格式返回给前端
        return cls.feishu_to_justime_event(fe_event, mongo_doc)

    @classmethod
    async def update_event(
        cls, 
        user_id: str, 
        event_id: str, 
        payload: CalendarEventUpdate
    ) -> Dict[str, Any]:
        """
        在飞书与本地双端同步更新日程
        """
        # 1. 校验日程是否存在
        feishu_event = await FeishuService.get_event(event_id)
        if not feishu_event:
            raise ValueError("飞书日历事件不存在")
            
        update_dict = payload.dict(exclude_unset=True)
        
        # 2. 同步 Patch 更新飞书
        fe_update_payload = cls.justime_to_feishu_event(update_dict)
        if fe_update_payload:
            fe_event = await FeishuService.update_event(event_id, fe_update_payload)
        else:
            fe_event = feishu_event
            
        # 3. 同步更新本地 MongoDB 的附加信息
        mongo_update = {}
        for key in ["type", "priority", "status", "color", "resources", "reminders", "emotionScore", "aiGenerated", "taskId"]:
            if key in update_dict:
                mongo_update[key] = update_dict[key]
                
        if mongo_update:
            mongo_update["updatedAt"] = datetime.utcnow()
            await db.db["calendar_events"].find_one_and_update(
                {"_id": event_id, "userId": user_id},
                {"$set": mongo_update},
                upsert=True  # 若 MongoDB 中没有该飞书日程的补充记录，则自动插入
            )
            
        # 4. 获取合并后的最新数据并返回
        local_extra = await db.db["calendar_events"].find_one({
            "_id": event_id,
            "userId": user_id
        })
        
        return cls.feishu_to_justime_event(fe_event, local_extra)

    @classmethod
    async def delete_event(cls, user_id: str, event_id: str) -> None:
        """
        双端物理擦除日程
        """
        # 1. 飞书删除日程
        await FeishuService.delete_event(event_id)
        
        # 2. 本地 MongoDB 擦除记录
        await db.db["calendar_events"].delete_one({
            "_id": event_id,
            "userId": user_id
        })
