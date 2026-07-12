import asyncio
import hashlib
import logging
import math
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.database import db
from app.models.evidence import EvidenceCreate, EvidenceOut, EvidenceUpdate, TimeLogCreate
from app.models.knowledge_output import (
    GenerateKnowledgeRequest,
    KnowledgeOutputCreate,
    KnowledgeOutputOut,
    KnowledgeOutputUpdate,
    KnowledgeOutputVersion,
    VaultConfig,
    VaultConfigUpdate,
)
from app.models.task_process import (
    AIAssessment,
    AISuggestion,
    Blocker,
    LearningMaterial,
    Milestone,
    MilestoneStatus,
    PreparationItem,
    TaskAgentResponse,
    TaskProcessCreate,
    TaskProcessListQuery,
    TaskProcessOut,
    TaskProcessUpdate,
)
from app.services.knowledge_writer_service import knowledge_writer_service
from app.services.markdown_export_service import markdown_export_service
from app.services.rag_service import (
    PROVIDER_NOT_CONFIGURED,
    PROVIDER_UNAVAILABLE,
    USER_CONTEXT_REQUIRED,
    rag_service,
)
from app.services.task_agent_service import task_agent_service


INDEXING_INTERNAL_ERROR = "INDEXING_INTERNAL_ERROR"
_SANITIZED_INDEXING_ERROR_CODES = {
    PROVIDER_NOT_CONFIGURED,
    PROVIDER_UNAVAILABLE,
    USER_CONTEXT_REQUIRED,
}


class KnowledgeOutputIndexConflict(ValueError):
    """The output is not eligible for an indexing retry."""


class TaskProcessBusiness:
    phase_order = {"before": 0, "during": 1, "after": 2}

    def _task_collection(self):
        return db.db.task_processes

    def _evidence_collection(self):
        return db.db.evidence

    def _knowledge_collection(self):
        return db.db.knowledge_outputs

    def _ensure_object_id(self, value: str, field_name: str) -> ObjectId:
        try:
            return ObjectId(value)
        except Exception as exc:
            raise ValueError(f"{field_name}格式无效") from exc

    def _serialize_task(self, doc: Dict[str, Any], evidence_count: int = 0, knowledge_output_count: int = 0) -> TaskProcessOut:
        return TaskProcessOut(
            id=str(doc["_id"]),
            userId=str(doc.get("userId", "")),
            title=doc.get("title", ""),
            description=doc.get("description", ""),
            goal=doc.get("goal", ""),
            category=doc.get("category", "other"),
            tags=doc.get("tags", []),
            status=doc.get("status", "draft"),
            phase=doc.get("phase", "before"),
            priority=doc.get("priority", "medium"),
            progress=float(doc.get("progress", 0.0) or 0.0),
            progress_source=doc.get("progress_source", "manual"),
            estimated_hours=doc.get("estimated_hours"),
            actual_hours=float(doc.get("actual_hours", 0.0) or 0.0),
            started_at=doc.get("started_at"),
            completed_at=doc.get("completed_at"),
            deadline=doc.get("deadline"),
            materials=[LearningMaterial(**item) for item in doc.get("materials", [])],
            preparation_items=[PreparationItem(**item) for item in doc.get("preparation_items", [])],
            milestones=[Milestone(**item) for item in doc.get("milestones", [])],
            blockers=[Blocker(**item) for item in doc.get("blockers", [])],
            ai_suggestions=[AISuggestion(**item) for item in doc.get("ai_suggestions", [])],
            ai_last_assessment=AIAssessment(**doc["ai_last_assessment"]) if doc.get("ai_last_assessment") else None,
            ai_plan=doc.get("ai_plan"),
            parent_task_id=doc.get("parent_task_id"),
            related_chat_session_ids=doc.get("related_chat_session_ids", []),
            related_calendar_event_ids=doc.get("related_calendar_event_ids", []),
            evidence_count=evidence_count,
            knowledge_output_count=knowledge_output_count,
            createdAt=doc.get("createdAt"),
            updatedAt=doc.get("updatedAt"),
        )

    def _serialize_evidence(self, doc: Dict[str, Any]) -> EvidenceOut:
        return EvidenceOut(
            id=str(doc["_id"]),
            task_id=str(doc.get("task_id", "")),
            userId=str(doc.get("userId", "")),
            type=doc.get("type", "manual"),
            title=doc.get("title", ""),
            content=doc.get("content", ""),
            source=doc.get("source", ""),
            source_id=doc.get("source_id"),
            milestone_id=doc.get("milestone_id"),
            metadata=doc.get("metadata"),
            ai_extracted=bool(doc.get("ai_extracted", False)),
            sentiment=doc.get("sentiment"),
            confidence=float(doc.get("confidence", 1.0) or 1.0),
            createdAt=doc.get("createdAt"),
            updatedAt=doc.get("updatedAt"),
        )

    def _serialize_knowledge_output(self, doc: Dict[str, Any]) -> KnowledgeOutputOut:
        return KnowledgeOutputOut(
            id=str(doc["_id"]),
            task_id=str(doc.get("task_id", "")),
            userId=str(doc.get("userId", "")),
            title=doc.get("title", ""),
            format=doc.get("format", "summary"),
            markdown=doc.get("markdown", ""),
            vault_relative_path=doc.get("vault_relative_path", ""),
            obsidian_tags=doc.get("obsidian_tags", []),
            obsidian_links=doc.get("obsidian_links", []),
            status=doc.get("status", "draft"),
            source_evidence_ids=doc.get("source_evidence_ids", []),
            absolute_path=doc.get("absolute_path"),
            published_at=doc.get("published_at"),
            indexing_status=doc.get("indexing_status", "not_requested"),
            indexing_error_code=doc.get("indexing_error_code"),
            indexing_retryable=bool(doc.get("indexing_retryable", False)),
            indexed_at=doc.get("indexed_at"),
            word_count=int(doc.get("word_count", 0) or 0),
            version=int(doc.get("version", 1) or 1),
            previous_version_id=doc.get("previous_version_id"),
            version_history=[KnowledgeOutputVersion(**item) for item in doc.get("version_history", [])],
            createdAt=doc.get("createdAt"),
            updatedAt=doc.get("updatedAt"),
        )

    async def _task_counts(self, task_id: str) -> Dict[str, int]:
        evidence_count = await self._evidence_collection().count_documents({"task_id": task_id})
        knowledge_count = await self._knowledge_collection().count_documents({"task_id": task_id})
        return {"evidence": evidence_count, "knowledge": knowledge_count}

    async def _page_task_counts(self, task_ids: List[str]) -> Tuple[Dict[str, int], Dict[str, int]]:
        if not task_ids:
            return {}, {}

        pipeline = [
            {"$match": {"task_id": {"$in": task_ids}}},
            {"$group": {"_id": "$task_id", "count": {"$sum": 1}}},
        ]
        evidence_rows = await self._evidence_collection().aggregate(pipeline).to_list(length=None)
        knowledge_rows = await self._knowledge_collection().aggregate(pipeline).to_list(length=None)
        evidence_counts = {row["_id"]: int(row["count"]) for row in evidence_rows}
        knowledge_counts = {row["_id"]: int(row["count"]) for row in knowledge_rows}
        return evidence_counts, knowledge_counts

    def _validate_phase_transition(self, current_phase: str, next_phase: str) -> None:
        if self.phase_order[next_phase] < self.phase_order[current_phase]:
            raise ValueError("任务阶段只允许单向推进，不能回退")

    async def _recalculate_task_metrics(self, user_id: str, task_id: str) -> Optional[TaskProcessOut]:
        task_doc = await self._task_collection().find_one({"_id": self._ensure_object_id(task_id, "任务ID"), "userId": user_id})
        if not task_doc:
            return None

        evidences = await self.list_evidence(user_id, task_id)
        milestones = [Milestone(**item) for item in task_doc.get("milestones", [])]
        total_milestones = len(milestones)
        completed_milestones = len([item for item in milestones if item.status == "completed"])
        total_hours = 0.0
        for evidence in evidences:
            if evidence.type == "time_log":
                total_hours += float((evidence.metadata or {}).get("hours", 0) or 0)

        if total_milestones > 0:
            progress = completed_milestones / total_milestones
        else:
            progress = 0.0
        if evidences:
            progress = max(progress, min(0.15 + len(evidences) * 0.1, 0.95))
        progress = round(min(max(progress, 0.0), 1.0), 4)

        status = task_doc.get("status", "draft")
        phase = task_doc.get("phase", "before")
        now = datetime.utcnow()
        updates: Dict[str, Any] = {
            "progress": progress,
            "progress_source": "evidence" if evidences else task_doc.get("progress_source", "manual"),
            "actual_hours": round(total_hours, 2),
            "updatedAt": now,
        }
        if progress > 0 and not task_doc.get("started_at"):
            updates["started_at"] = now
        if progress >= 1.0 and status != "completed":
            updates["status"] = "completed"
            updates["phase"] = "after"
            updates["completed_at"] = now
        elif evidences and phase == "before":
            updates["phase"] = "during"
            if status in {"draft", "planned"}:
                updates["status"] = "active"

        doc = await self._task_collection().find_one_and_update(
            {"_id": task_doc["_id"]},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
        counts = await self._task_counts(task_id)
        return self._serialize_task(doc, counts["evidence"], counts["knowledge"])

    async def create_task_process(self, user_id: str, payload: TaskProcessCreate) -> TaskProcessOut:
        now = datetime.utcnow()
        doc = payload.model_dump()
        initial_chat_session_id = doc.pop("initial_chat_session_id", None)
        initial_calendar_event_id = doc.pop("initial_calendar_event_id", None)
        auto_plan = bool(doc.pop("auto_plan", True))
        doc.update(
            {
                "userId": user_id,
                "status": "draft",
                "phase": "before",
                "progress": 0.0,
                "progress_source": "manual",
                "actual_hours": 0.0,
                "started_at": None,
                "completed_at": None,
                "milestones": [],
                "blockers": [],
                "ai_suggestions": [],
                "ai_last_assessment": None,
                "ai_plan": None,
                "parent_task_id": None,
                "related_chat_session_ids": [initial_chat_session_id] if initial_chat_session_id else [],
                "related_calendar_event_ids": [initial_calendar_event_id] if initial_calendar_event_id else [],
                "createdAt": now,
                "updatedAt": now,
            }
        )
        result = await self._task_collection().insert_one(doc)
        task_doc = await self._task_collection().find_one({"_id": result.inserted_id})
        task = self._serialize_task(task_doc)
        if auto_plan:
            agent_result = await task_agent_service.run(task, "plan", "", [])
            updates = {
                "milestones": [item.model_dump(mode="json") for item in agent_result.get("milestones", [])],
                "materials": [item.model_dump(mode="json") for item in agent_result.get("materials", [])],
                "preparation_items": [
                    item.model_dump(mode="json") for item in agent_result.get("preparation_items", [])
                ],
                "ai_plan": agent_result.get("plan"),
                "ai_suggestions": [item.model_dump(mode="json") for item in agent_result.get("suggestions", [])],
                "status": "planned",
                "updatedAt": datetime.utcnow(),
            }
            task_doc = await self._task_collection().find_one_and_update(
                {"_id": result.inserted_id},
                {"$set": updates},
                return_document=ReturnDocument.AFTER,
            )
            task = self._serialize_task(task_doc)
        return task

    async def list_task_processes(self, user_id: str, query: TaskProcessListQuery) -> Dict[str, Any]:
        filters: Dict[str, Any] = {"userId": user_id}
        if query.status:
            filters["status"] = query.status
        if query.phase:
            filters["phase"] = query.phase
        if query.category:
            filters["category"] = query.category
        if query.priority:
            filters["priority"] = query.priority
        if query.search:
            filters["$or"] = [
                {"title": {"$regex": query.search, "$options": "i"}},
                {"description": {"$regex": query.search, "$options": "i"}},
                {"goal": {"$regex": query.search, "$options": "i"}},
            ]

        sort_direction = -1 if query.sort_order == "desc" else 1
        cursor = self._task_collection().find(filters).sort(query.sort_by, sort_direction).skip((query.page - 1) * query.page_size).limit(query.page_size)
        docs = await cursor.to_list(length=query.page_size)
        total = await self._task_collection().count_documents(filters)

        task_ids = [str(doc["_id"]) for doc in docs]
        evidence_counts, knowledge_counts = await self._page_task_counts(task_ids)
        items: List[TaskProcessOut] = []
        for doc, task_id in zip(docs, task_ids):
            items.append(
                self._serialize_task(
                    doc,
                    evidence_counts.get(task_id, 0),
                    knowledge_counts.get(task_id, 0),
                )
            )

        return {
            "items": items,
            "total": total,
            "page": query.page,
            "page_size": query.page_size,
            "total_pages": math.ceil(total / query.page_size) if query.page_size else 1,
        }

    async def get_task_process(self, user_id: str, task_id: str) -> Optional[TaskProcessOut]:
        doc = await self._task_collection().find_one({"_id": self._ensure_object_id(task_id, "任务ID"), "userId": user_id})
        if not doc:
            return None
        counts = await self._task_counts(task_id)
        return self._serialize_task(doc, counts["evidence"], counts["knowledge"])

    async def update_task_process(self, user_id: str, task_id: str, payload: TaskProcessUpdate) -> Optional[TaskProcessOut]:
        existing = await self.get_task_process(user_id, task_id)
        if not existing:
            return None
        updates = payload.model_dump(exclude_unset=True)
        if "phase" in updates:
            self._validate_phase_transition(existing.phase, updates["phase"])
        if updates.get("status") == "completed":
            updates.setdefault("phase", "after")
            updates["completed_at"] = datetime.utcnow()
        if updates.get("phase") == "during" and not existing.started_at:
            updates["started_at"] = datetime.utcnow()
        updates["updatedAt"] = datetime.utcnow()
        doc = await self._task_collection().find_one_and_update(
            {"_id": self._ensure_object_id(task_id, "任务ID"), "userId": user_id},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
        if not doc:
            return None
        counts = await self._task_counts(task_id)
        return self._serialize_task(doc, counts["evidence"], counts["knowledge"])

    async def update_milestone_status(
        self,
        user_id: str,
        task_id: str,
        milestone_id: str,
        status: MilestoneStatus,
    ) -> Optional[TaskProcessOut]:
        task_oid = self._ensure_object_id(task_id, "任务ID")
        task_doc = await self._task_collection().find_one({"_id": task_oid, "userId": user_id})
        if not task_doc:
            return None

        milestone = next(
            (item for item in task_doc.get("milestones", []) if item.get("id") == milestone_id),
            None,
        )
        if milestone is None:
            raise ValueError("里程碑不存在")

        now = datetime.utcnow()
        updates: Dict[str, Any] = {
            "milestones.$[milestone].status": status,
            "updatedAt": now,
        }
        if status == "completed":
            updates["milestones.$[milestone].completed_at"] = now
        else:
            updates["milestones.$[milestone].completed_at"] = None

        doc = await self._task_collection().find_one_and_update(
            {"_id": task_oid, "userId": user_id, "milestones.id": milestone_id},
            {"$set": updates},
            array_filters=[{"milestone.id": milestone_id}],
            return_document=ReturnDocument.AFTER,
        )
        if not doc:
            raise ValueError("里程碑不存在")
        if status == "completed":
            await self._complete_linked_calendar_events(user_id, task_id, milestone_id)
        counts = await self._task_counts(task_id)
        return self._serialize_task(doc, counts["evidence"], counts["knowledge"])

    async def _complete_linked_calendar_events(
        self,
        user_id: str,
        task_id: str,
        milestone_id: str,
    ) -> None:
        query = {
            "userId": user_id,
            "taskId": task_id,
            "milestoneId": milestone_id,
            "status": {"$ne": "completed"},
        }
        now = datetime.utcnow()

        from app.core.config import settings

        if not settings.FEISHU_INTEGRATION_ENABLED:
            await db.db["calendar_events"].update_many(
                query,
                {"$set": {"status": "completed", "updatedAt": now}},
            )
            return

        from app.business.feishu_calendar import FeishuCalendarBusiness
        from app.models.calendar import CalendarEventUpdate

        cursor = db.db["calendar_events"].find(query)
        events = await cursor.to_list(length=None)
        for event in events:
            event_filter = {
                "_id": event["_id"],
                "userId": user_id,
                "status": {"$ne": "completed"},
            }
            updated = await db.db["calendar_events"].update_one(
                event_filter,
                {"$set": {"status": "completed", "updatedAt": now}},
            )
            if updated.modified_count == 0:
                continue
            try:
                await FeishuCalendarBusiness.update_event(
                    user_id,
                    str(event["_id"]),
                    CalendarEventUpdate(status="completed"),
                )
            except Exception:
                rollback = {
                    "status": event.get("status"),
                    "updatedAt": event.get("updatedAt"),
                }
                await db.db["calendar_events"].update_one(
                    {"_id": event["_id"], "userId": user_id, "updatedAt": now},
                    {"$set": rollback},
                )
                raise

    async def run_task_agent(self, user_id: str, task_id: str, mode: str, user_input: str = "") -> TaskAgentResponse:
        task = await self.get_task_process(user_id, task_id)
        if not task:
            return TaskAgentResponse(success=False, mode=mode, error="任务不存在")
        evidences = await self.list_evidence(user_id, task_id)
        result = await task_agent_service.run(task, mode, user_input, evidences)

        updates: Dict[str, Any] = {"updatedAt": datetime.utcnow()}
        assessment = result.get("assessment")
        suggestions = result.get("suggestions") or []
        if mode == "plan":
            updates["materials"] = [item.model_dump(mode="json") for item in result.get("materials", [])]
            updates["preparation_items"] = [
                item.model_dump(mode="json") for item in result.get("preparation_items", [])
            ]
            if result.get("milestones"):
                updates["milestones"] = [item.model_dump(mode="json") for item in result["milestones"]]
                updates["ai_plan"] = result.get("plan")
                updates["status"] = "planned"
        if assessment:
            updates["ai_last_assessment"] = assessment.model_dump(mode="json")
            updates["progress"] = assessment.progress
            updates["progress_source"] = "ai"
        if mode == "monitor" and assessment:
            blockers = [item.model_dump(mode="json") for item in task.blockers]
            known_descriptions = {item["description"].strip() for item in blockers}
            identified_blocker = False
            for description in assessment.blockers_identified:
                normalized_description = description.strip()
                if not normalized_description:
                    continue
                identified_blocker = True
                if normalized_description in known_descriptions:
                    continue
                blocker = Blocker(
                    id=f"blocker-{hashlib.sha256(normalized_description.encode('utf-8')).hexdigest()[:16]}",
                    description=normalized_description,
                )
                blockers.append(blocker.model_dump(mode="json"))
                known_descriptions.add(normalized_description)
            if len(blockers) > len(task.blockers):
                updates["blockers"] = blockers
            if identified_blocker:
                updates["status"] = "blocked"
        if mode == "coach":
            updates["ai_suggestions"] = [item.model_dump(mode="json") for item in suggestions]
        elif suggestions:
            updates["ai_suggestions"] = [item.model_dump(mode="json") for item in suggestions]

        await self._task_collection().update_one(
            {"_id": self._ensure_object_id(task_id, "任务ID"), "userId": user_id},
            {"$set": updates},
        )
        await self._recalculate_task_metrics(user_id, task_id)

        return TaskAgentResponse(
            success=True,
            mode=mode,
            result=result.get("plan") or result.get("summary") or result,
            suggestions=suggestions,
            assessment=assessment,
        )

    async def handle_calendar_event_status_change(
        self, user_id: str, old_status: str, new_status: str, event_doc: Dict[str, Any]
    ) -> None:
        if new_status != "completed" or old_status == "completed":
            return

        task_id_str = event_doc.get("taskId")
        milestone_id = event_doc.get("milestoneId")
        if not task_id_str or not milestone_id:
            return

        event_id_str = str(event_doc.get("_id") or event_doc.get("id") or "")
        if not event_id_str:
            return

        try:
            task = await self.update_milestone_status(
                user_id,
                task_id_str,
                milestone_id,
                "completed",
            )
        except ValueError as exc:
            logger.warning(
                "Calendar event %s has an invalid milestone association: %s",
                event_id_str,
                exc,
            )
            return
        if not task:
            logger.warning("TaskProcess not found: %s for user %s", task_id_str, user_id)
            return

        event_title = event_doc.get("title", "")
        payload = EvidenceCreate(
            task_id=task_id_str,
            type="milestone_complete",
            title=f"完成日程: {event_title}",
            content=f"已完成关联日程: {event_title}\n描述: {event_doc.get('description', '')}",
            source="calendar",
            source_id=event_id_str,
            milestone_id=milestone_id,
            metadata={
                "calendar_event_id": event_id_str,
                "completed_at": datetime.utcnow().isoformat(),
            },
        )
        await self.create_evidence(user_id, payload)

    async def create_evidence(self, user_id: str, payload: EvidenceCreate, ai_extracted: bool = False) -> EvidenceOut:
        task = await self.get_task_process(user_id, payload.task_id)
        if not task:
            raise ValueError("任务不存在")
        now = datetime.utcnow()
        doc = payload.model_dump()
        if payload.source_id is None:
            doc.pop("source_id", None)
        doc.update(
            {
                "userId": user_id,
                "ai_extracted": ai_extracted,
                "sentiment": "blocked" if any(word in payload.content.lower() for word in ["blocked", "卡住", "报错", "失败", "无法"]) else None,
                "confidence": 1.0,
                "createdAt": now,
                "updatedAt": now,
            }
        )
        collection = self._evidence_collection()
        if payload.source_id:
            idempotency_filter = {
                "userId": user_id,
                "task_id": payload.task_id,
                "type": payload.type,
                "source_id": payload.source_id,
            }
            try:
                saved = await collection.find_one_and_update(
                    idempotency_filter,
                    {"$setOnInsert": doc},
                    upsert=True,
                    return_document=ReturnDocument.AFTER,
                )
            except DuplicateKeyError:
                saved = await collection.find_one(idempotency_filter)
                if saved is None:
                    raise
        else:
            result = await collection.insert_one(doc)
            saved = await collection.find_one({"_id": result.inserted_id})
        evidence = self._serialize_evidence(saved)
        await self._recalculate_task_metrics(user_id, payload.task_id)
        return evidence

    async def create_time_log(self, user_id: str, payload: TimeLogCreate) -> EvidenceOut:
        create_payload = EvidenceCreate(
            task_id=payload.task_id,
            type="time_log",
            title="时间记录",
            content=payload.notes or f"记录投入 {payload.hours} 小时",
            source="manual",
            milestone_id=payload.milestone_id,
            metadata={
                "hours": payload.hours,
                "date": (payload.date or datetime.utcnow()).isoformat(),
            },
        )
        return await self.create_evidence(user_id, create_payload)

    async def list_evidence(self, user_id: str, task_id: str) -> List[EvidenceOut]:
        cursor = self._evidence_collection().find({"task_id": task_id, "userId": user_id}).sort("createdAt", -1)
        docs = await cursor.to_list(length=None)
        return [self._serialize_evidence(doc) for doc in docs]

    async def update_evidence(self, user_id: str, evidence_id: str, payload: EvidenceUpdate) -> Optional[EvidenceOut]:
        updates = payload.model_dump(exclude_unset=True)
        if not updates:
            return None
        updates["updatedAt"] = datetime.utcnow()
        doc = await self._evidence_collection().find_one_and_update(
            {"_id": self._ensure_object_id(evidence_id, "Evidence ID"), "userId": user_id},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
        if not doc:
            return None
        await self._recalculate_task_metrics(user_id, str(doc["task_id"]))
        return self._serialize_evidence(doc)

    async def create_knowledge_output(self, user_id: str, payload: KnowledgeOutputCreate) -> KnowledgeOutputOut:
        task = await self.get_task_process(user_id, payload.task_id)
        if not task:
            raise ValueError("任务不存在")
        now = datetime.utcnow()
        doc = payload.model_dump()
        doc.update(
            {
                "userId": user_id,
                "status": "draft",
                "absolute_path": None,
                "published_at": None,
                "indexing_status": "not_requested",
                "indexing_error_code": None,
                "indexing_retryable": False,
                "indexed_at": None,
                "word_count": len(payload.markdown.split()),
                "version": 1,
                "previous_version_id": None,
                "version_history": [],
                "createdAt": now,
                "updatedAt": now,
            }
        )
        result = await self._knowledge_collection().insert_one(doc)
        saved = await self._knowledge_collection().find_one({"_id": result.inserted_id})
        out = self._serialize_knowledge_output(saved)
        return out

    async def list_knowledge_outputs(self, user_id: str, task_id: str) -> List[KnowledgeOutputOut]:
        cursor = self._knowledge_collection().find({"task_id": task_id, "userId": user_id}).sort("updatedAt", -1)
        docs = await cursor.to_list(length=None)
        return [self._serialize_knowledge_output(doc) for doc in docs]

    async def update_knowledge_output(self, user_id: str, output_id: str, payload: KnowledgeOutputUpdate) -> Optional[KnowledgeOutputOut]:
        updates = payload.model_dump(exclude_unset=True)
        if not updates:
            return None
        existing = await self._knowledge_collection().find_one(
            {"_id": self._ensure_object_id(output_id, "KnowledgeOutput ID"), "userId": user_id}
        )
        if not existing:
            return None
        history = list(existing.get("version_history", []))
        snapshot_fields = {"title", "markdown", "vault_relative_path", "status", "published_at"}
        if any(field in updates for field in snapshot_fields):
            history.append(
                KnowledgeOutputVersion(
                    version=int(existing.get("version", 1) or 1),
                    title=existing.get("title", ""),
                    markdown=existing.get("markdown", ""),
                    vault_relative_path=existing.get("vault_relative_path", ""),
                    status=existing.get("status", "draft"),
                    updated_at=existing.get("updatedAt") or datetime.utcnow(),
                    published_at=existing.get("published_at"),
                ).model_dump(mode="json")
            )
            updates["version_history"] = history
            updates["version"] = int(existing.get("version", 1) or 1) + 1
        updates["updatedAt"] = datetime.utcnow()
        if "markdown" in updates:
            updates["word_count"] = len(updates["markdown"].split())
        doc = await self._knowledge_collection().find_one_and_update(
            {"_id": self._ensure_object_id(output_id, "KnowledgeOutput ID"), "userId": user_id},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
        if not doc:
            return None
        out = self._serialize_knowledge_output(doc)
        return out

    async def generate_knowledge_output(self, user_id: str, payload: GenerateKnowledgeRequest) -> KnowledgeOutputOut:
        task = await self.get_task_process(user_id, payload.task_id)
        if not task:
            raise ValueError("任务不存在")
        evidences = await self.list_evidence(user_id, payload.task_id)
        output = await knowledge_writer_service.build_output(
            task=task,
            evidences=evidences,
            output_format=payload.format,
            additional_instructions=payload.additional_instructions,
            include_evidence_ids=payload.include_evidence_ids,
        )
        return await self.create_knowledge_output(user_id, output)

    async def publish_knowledge_output(self, user_id: str, output_id: str) -> Optional[KnowledgeOutputOut]:
        doc = await self._knowledge_collection().find_one({"_id": self._ensure_object_id(output_id, "KnowledgeOutput ID"), "userId": user_id})
        if not doc:
            return None
        output = self._serialize_knowledge_output(doc)
        absolute_path = await markdown_export_service.publish(user_id, output)
        saved = await self._knowledge_collection().find_one_and_update(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "absolute_path": absolute_path,
                    "status": "published",
                    "published_at": datetime.utcnow(),
                    "updatedAt": datetime.utcnow(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        indexing_attempt_id = str(ObjectId())
        pending = await self._knowledge_collection().find_one_and_update(
            {"_id": doc["_id"], "userId": user_id, "status": "published"},
            {
                "$set": {
                    "indexing_status": "pending",
                    "indexing_attempt_id": indexing_attempt_id,
                    "indexing_error_code": None,
                    "indexing_retryable": False,
                    "indexed_at": None,
                    "updatedAt": datetime.utcnow(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        return await self._index_published_output(user_id, pending or saved)

    async def _validated_published_path(self, user_id: str, doc: Dict[str, Any]) -> Path:
        config = await markdown_export_service.get_vault_config(user_id)
        raw_path = doc.get("absolute_path")
        if not config or not isinstance(raw_path, str) or not raw_path.strip():
            raise KnowledgeOutputIndexConflict("知识产出没有有效的已发布文件")
        try:
            vault_root = Path(config.vault_root_path).expanduser().resolve(strict=True)
            published_path = Path(raw_path).expanduser()
            if not published_path.is_absolute():
                raise ValueError("published path must be absolute")
            published_path = published_path.resolve(strict=True)
            published_path.relative_to(vault_root)
            if not published_path.is_file():
                raise ValueError("published path must be a file")
        except (OSError, RuntimeError, TypeError, ValueError) as exc:
            raise KnowledgeOutputIndexConflict("知识产出没有有效的已发布文件") from exc
        return published_path

    def _indexing_outcome(self, result: Dict[str, Any]) -> Dict[str, Any]:
        if result.get("success") is True and result.get("status") == "ready":
            return {
                "indexing_status": "success",
                "indexing_error_code": None,
                "indexing_retryable": False,
                "indexed_at": datetime.utcnow(),
            }

        error_code = result.get("error_code")
        if error_code == PROVIDER_NOT_CONFIGURED:
            return {
                "indexing_status": "skipped",
                "indexing_error_code": PROVIDER_NOT_CONFIGURED,
                "indexing_retryable": False,
                "indexed_at": None,
            }
        if error_code not in _SANITIZED_INDEXING_ERROR_CODES:
            return {
                "indexing_status": "failed",
                "indexing_error_code": INDEXING_INTERNAL_ERROR,
                "indexing_retryable": True,
                "indexed_at": None,
            }
        return {
            "indexing_status": "failed",
            "indexing_error_code": error_code,
            "indexing_retryable": bool(result.get("retryable", False)),
            "indexed_at": None,
        }

    async def _index_published_output(
        self,
        user_id: str,
        doc: Dict[str, Any],
    ) -> KnowledgeOutputOut:
        try:
            published_path = await self._validated_published_path(user_id, doc)
            result = await asyncio.to_thread(
                rag_service.index_published_output,
                user_id=user_id,
                published_path=published_path,
            )
            outcome = self._indexing_outcome(result)
        except Exception:
            logger.warning("KnowledgeOutput incremental indexing failed")
            outcome = {
                "indexing_status": "failed",
                "indexing_error_code": INDEXING_INTERNAL_ERROR,
                "indexing_retryable": True,
                "indexed_at": None,
            }
        outcome["updatedAt"] = datetime.utcnow()
        indexing_attempt_id = doc.get("indexing_attempt_id")
        saved = await self._knowledge_collection().find_one_and_update(
            {
                "_id": doc["_id"],
                "userId": user_id,
                "status": "published",
                "indexing_status": "pending",
                "indexing_attempt_id": indexing_attempt_id,
            },
            {"$set": {**outcome, "indexing_attempt_id": None}},
            return_document=ReturnDocument.AFTER,
        )
        if saved:
            return self._serialize_knowledge_output(saved)
        current = await self._knowledge_collection().find_one(
            {"_id": doc["_id"], "userId": user_id}
        )
        return self._serialize_knowledge_output(current or doc)

    async def reindex_knowledge_output(self, user_id: str, output_id: str) -> Optional[KnowledgeOutputOut]:
        doc = await self._knowledge_collection().find_one(
            {"_id": self._ensure_object_id(output_id, "KnowledgeOutput ID"), "userId": user_id}
        )
        if not doc:
            return None
        if (
            doc.get("status") != "published"
            or doc.get("indexing_status", "not_requested") != "failed"
            or doc.get("indexing_retryable") is not True
        ):
            raise KnowledgeOutputIndexConflict("当前知识产出不可重试索引")

        await self._validated_published_path(user_id, doc)
        indexing_attempt_id = str(ObjectId())
        pending = await self._knowledge_collection().find_one_and_update(
            {
                "_id": doc["_id"],
                "userId": user_id,
                "status": "published",
                "indexing_status": "failed",
                "indexing_retryable": True,
                "absolute_path": doc.get("absolute_path"),
            },
            {
                "$set": {
                    "indexing_status": "pending",
                    "indexing_attempt_id": indexing_attempt_id,
                    "indexing_error_code": None,
                    "indexing_retryable": False,
                    "indexed_at": None,
                    "updatedAt": datetime.utcnow(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        if not pending:
            raise KnowledgeOutputIndexConflict("当前知识产出不可重试索引")
        return await self._index_published_output(user_id, pending)

    async def rollback_knowledge_output(self, user_id: str, output_id: str, version: int) -> Optional[KnowledgeOutputOut]:
        doc = await self._knowledge_collection().find_one({"_id": self._ensure_object_id(output_id, "KnowledgeOutput ID"), "userId": user_id})
        if not doc:
            return None

        history = list(doc.get("version_history", []))
        target = next((item for item in history if int(item.get("version", -1)) == version), None)
        if not target:
            raise ValueError("目标版本不存在")

        current_snapshot = KnowledgeOutputVersion(
            version=int(doc.get("version", 1) or 1),
            title=doc.get("title", ""),
            markdown=doc.get("markdown", ""),
            vault_relative_path=doc.get("vault_relative_path", ""),
            status=doc.get("status", "draft"),
            updated_at=doc.get("updatedAt") or datetime.utcnow(),
            published_at=doc.get("published_at"),
        ).model_dump(mode="json")
        history.append(current_snapshot)

        saved = await self._knowledge_collection().find_one_and_update(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "title": target.get("title", doc.get("title", "")),
                    "markdown": target.get("markdown", doc.get("markdown", "")),
                    "vault_relative_path": target.get("vault_relative_path", doc.get("vault_relative_path", "")),
                    "status": "draft",
                    "published_at": None,
                    "version": int(doc.get("version", 1) or 1) + 1,
                    "word_count": len(str(target.get("markdown", "")).split()),
                    "version_history": history,
                    "updatedAt": datetime.utcnow(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        return self._serialize_knowledge_output(saved)

    async def get_vault_config(self, user_id: str) -> Optional[VaultConfig]:
        return await markdown_export_service.get_vault_config(user_id)

    async def update_vault_config(self, user_id: str, payload: VaultConfigUpdate) -> VaultConfig:
        return await markdown_export_service.upsert_vault_config(user_id, payload)


_task_process_business = TaskProcessBusiness()
