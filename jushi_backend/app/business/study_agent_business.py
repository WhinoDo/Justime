"""
学习 Agent 业务编排层
协调 StudyAgentService + FeishuService + 数据持久化
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.database import db
from app.services.study_agent_service import study_agent_service, STUDY_AGENT_SYSTEM_PROMPT
from app.services.feishu_service import feishu_service
from app.services.agent_service import agent_service

try:
    from app.tools.study_tools import (
        get_pending_study_outputs,
        clear_pending_study_outputs,
        set_current_request_context as set_study_request_context,
        clear_current_request_context as clear_study_request_context,
    )
except Exception:
    def get_pending_study_outputs(request_id=None):
        return []

    def clear_pending_study_outputs(request_id=None):
        return None

    def set_study_request_context(request_id, user_id=None):
        return None

    def clear_study_request_context():
        return None

logger = logging.getLogger(__name__)


class StudyAgentBusiness:
    """学习 Agent 业务编排层"""

    def __init__(self):
        self.study_agent = study_agent_service

    async def create_profile(self, user_id: str, profile_data: dict) -> dict:
        now = datetime.now(timezone.utc)
        doc = {
            "userId": user_id,
            "targetSchool": profile_data.get("targetSchool", ""),
            "targetMajor": profile_data.get("targetMajor", ""),
            "examDate": profile_data.get("examDate", ""),
            "subjects": profile_data.get("subjects", []),
            "dailyStudyHours": profile_data.get("dailyStudyHours", 8.0),
            "createdAt": now,
            "updatedAt": now,
        }

        existing = await db.db.study_profiles.find_one({"userId": user_id})
        if existing:
            update = {k: v for k, v in doc.items() if k != "createdAt"}
            update["updatedAt"] = now
            await db.db.study_profiles.update_one(
                {"userId": user_id}, {"$set": update}
            )
            doc.update(update)
            doc["id"] = str(existing["_id"])
        else:
            result = await db.db.study_profiles.insert_one(doc)
            doc["id"] = str(result.inserted_id)

        return _serialize_doc(doc)

    async def get_profile(self, user_id: str) -> Optional[dict]:
        doc = await db.db.study_profiles.find_one({"userId": user_id})
        return _serialize_doc(doc) if doc else None

    async def process_study_request(self, user_id: str, message: str) -> dict:
        try:
            response_text = await self.study_agent.handle_study_intent(user_id, message)
            return {
                "success": True,
                "data": {
                    "response": response_text,
                    "userId": user_id,
                },
            }
        except Exception as e:
            logger.error(f"process_study_request failed: {e}")
            return {"success": False, "error": str(e)}

    async def generate_and_sync_plan(self, user_id: str, profile_data: dict) -> dict:
        profile = await self.get_profile(user_id)
        if not profile:
            profile = await self.create_profile(user_id, profile_data)
        else:
            profile = await self.create_profile(user_id, profile_data)

        target_school = profile.get("targetSchool", "")
        target_major = profile.get("targetMajor", "")
        exam_date = profile.get("examDate", "")
        subjects = profile.get("subjects", [])
        daily_hours = float(profile.get("dailyStudyHours", 8))

        agent_result = await self.study_agent.create_study_plan(
            user_id=user_id,
            target_school=target_school,
            target_major=target_major,
            exam_date=exam_date,
            subjects=subjects,
            daily_hours=daily_hours,
        )

        plan_data = None
        tool_outputs = agent_result.get("tool_outputs", [])
        for output in tool_outputs:
            obs = output.get("observation", {})
            if isinstance(obs, dict) and obs.get("type") == "study_plan_generated":
                plan_data = obs
                break

        feishu_synced = False
        if plan_data and feishu_service.is_configured:
            try:
                feishu_synced = await self._sync_plan_to_feishu(
                    user_id, plan_data
                )
            except Exception as e:
                logger.error(f"Feishu sync failed: {e}")

        return {
            "success": agent_result.get("success", False),
            "data": {
                "plan": plan_data,
                "agentResult": agent_result.get("result", ""),
                "feishuSynced": feishu_synced,
            },
        }

    async def get_plan(self, user_id: str) -> Optional[dict]:
        doc = await db.db.study_plans.find_one(
            {"userId": user_id}, sort=[("createdAt", -1)]
        )
        return _serialize_doc(doc) if doc else None

    async def get_tasks(
        self, user_id: str, date: Optional[str] = None
    ) -> List[dict]:
        query = {"userId": user_id}
        if date:
            try:
                dt = datetime.fromisoformat(date.replace("Z", "+00:00"))
                next_day = dt + timedelta(days=1)
                query["scheduledDate"] = {"$gte": dt, "$lt": next_day}
            except ValueError:
                pass

        cursor = db.db.study_tasks.find(query).sort("scheduledDate", 1)
        tasks = await cursor.to_list(length=200)
        return [_serialize_doc(t) for t in tasks]

    async def update_task(self, user_id: str, task_id: str, updates: dict) -> Optional[dict]:
        from bson import ObjectId

        try:
            oid = ObjectId(task_id)
        except Exception:
            return None

        updates["updatedAt"] = datetime.now(timezone.utc)
        result = await db.db.study_tasks.find_one_and_update(
            {"_id": oid, "userId": user_id},
            {"$set": updates},
        )
        if not result:
            return None

        updated = await db.db.study_tasks.find_one({"_id": oid})
        return _serialize_doc(updated) if updated else None

    async def get_progress(self, user_id: str) -> dict:
        return await self.study_agent.query_progress(user_id)

    async def _sync_plan_to_feishu(self, user_id: str, plan_data: dict) -> bool:
        from app.core.config import settings

        calendar_id = settings.FEISHU_CALENDAR_ID
        if not calendar_id:
            logger.warning("FEISHU_CALENDAR_ID not configured")
            return False

        phases = plan_data.get("phases", [])
        synced_count = 0

        for phase in phases:
            summary = f"考研-{phase.get('phaseName', '学习阶段')}"
            description = f"目标: {', '.join(phase.get('goals', []))}"

            start_str = phase.get("startDate", "")
            end_str = phase.get("endDate", "")
            if not start_str or not end_str:
                continue

            try:
                result = await feishu_service.create_calendar_event(
                    calendar_id=calendar_id,
                    summary=summary,
                    start_time=start_str[:19],
                    end_time=end_str[:19],
                    description=description,
                )
                if result.get("success"):
                    synced_count += 1
            except Exception as e:
                logger.error(f"Failed to sync phase to Feishu: {e}")

        logger.info(f"Synced {synced_count}/{len(phases)} phases to Feishu for user {user_id[:8]}")
        return synced_count > 0


def _serialize_doc(doc: dict) -> dict:
    if doc is None:
        return None
    data = dict(doc)
    if "_id" in data:
        data["id"] = str(data.pop("_id"))
    for key, value in data.items():
        if isinstance(value, datetime):
            data[key] = value.isoformat()
    return data


study_agent_business = StudyAgentBusiness()
