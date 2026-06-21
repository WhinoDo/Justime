import logging
import math
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

from bson import ObjectId
from pymongo import ReturnDocument

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
    Milestone,
    TaskAgentResponse,
    TaskProcessCreate,
    TaskProcessListQuery,
    TaskProcessOut,
    TaskProcessUpdate,
)
from app.services.knowledge_writer_service import knowledge_writer_service
from app.services.markdown_export_service import markdown_export_service
from app.services.task_agent_service import task_agent_service


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

        items: List[TaskProcessOut] = []
        for doc in docs:
            task_id = str(doc["_id"])
            counts = await self._task_counts(task_id)
            items.append(self._serialize_task(doc, counts["evidence"], counts["knowledge"]))

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

    async def run_task_agent(self, user_id: str, task_id: str, mode: str, user_input: str = "") -> TaskAgentResponse:
        task = await self.get_task_process(user_id, task_id)
        if not task:
            return TaskAgentResponse(success=False, mode=mode, error="任务不存在")
        evidences = await self.list_evidence(user_id, task_id)
        result = await task_agent_service.run(task, mode, user_input, evidences)

        updates: Dict[str, Any] = {"updatedAt": datetime.utcnow()}
        assessment = result.get("assessment")
        suggestions = result.get("suggestions") or []
        if mode == "plan" and result.get("milestones"):
            updates["milestones"] = [item.model_dump(mode="json") for item in result["milestones"]]
            updates["ai_plan"] = result.get("plan")
            updates["status"] = "planned"
        if assessment:
            updates["ai_last_assessment"] = assessment.model_dump(mode="json")
            updates["progress"] = assessment.progress
            updates["progress_source"] = "ai"
        if suggestions:
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
        if new_status != "completed":
            return

        task_id_str = event_doc.get("taskId")
        if not task_id_str:
            return

        try:
            task_oid = self._ensure_object_id(task_id_str, "任务ID")
        except ValueError:
            logger.warning(f"Invalid taskId format in calendar event: {task_id_str}")
            return

        task_doc = await self._task_collection().find_one({"_id": task_oid, "userId": user_id})
        if not task_doc:
            logger.warning(f"TaskProcess not found: {task_id_str} for user {user_id}")
            return

        event_id_str = str(event_doc.get("_id") or event_doc.get("id") or "")
        if not event_id_str:
            return

        existing_evidence = await self._evidence_collection().find_one({
            "task_id": task_id_str,
            "metadata.calendar_event_id": event_id_str
        })
        if existing_evidence:
            return

        matched_milestone_id = None
        task_milestones = task_doc.get("milestones", [])
        event_title = event_doc.get("title", "")
        
        for ms in task_milestones:
            ms_title = ms.get("title", "")
            if ms_title and event_title and (ms_title == event_title or ms_title in event_title or event_title in ms_title):
                matched_milestone_id = ms.get("id")
                ms["status"] = "completed"
                ms["completed_at"] = datetime.utcnow()
                break

        if matched_milestone_id:
            await self._task_collection().update_one(
                {"_id": task_oid},
                {"$set": {"milestones": task_milestones, "updatedAt": datetime.utcnow()}}
            )

        payload = EvidenceCreate(
            task_id=task_id_str,
            type="milestone_complete",
            title=f"完成日程: {event_title}",
            content=f"已完成关联日程: {event_title}\n描述: {event_doc.get('description', '')}",
            source="calendar",
            milestone_id=matched_milestone_id,
            metadata={"calendar_event_id": event_id_str, "completed_at": datetime.utcnow().isoformat()}
        )
        await self.create_evidence(user_id, payload)

    async def create_evidence(self, user_id: str, payload: EvidenceCreate, ai_extracted: bool = False) -> EvidenceOut:
        task = await self.get_task_process(user_id, payload.task_id)
        if not task:
            raise ValueError("任务不存在")
        now = datetime.utcnow()
        doc = payload.model_dump()
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
        result = await self._evidence_collection().insert_one(doc)
        saved = await self._evidence_collection().find_one({"_id": result.inserted_id})
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
        return self._serialize_knowledge_output(saved)

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
