"""
书籍分析服务

负责：
- 保存书籍 PDF
- 提取章节草稿
- 调用 NotebookLM 对章节逐一分析
- 生成可离线阅读的 HTML
"""

import logging
import asyncio
import base64
import html
import json

logger = logging.getLogger(__name__)
import os
import re
import shutil
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from bson import ObjectId
from bson.errors import InvalidId
from pymongo.errors import PyMongoError
from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool

from app.core.config import settings
from app.database import db

from app.services.knowledge_paths import DOCS_DIR as RAG_DOCS_DIR

DOCS_DIR = Path(DOCUMENTS_DIR)
if not DOCS_DIR.is_absolute():
    DOCS_DIR = (Path(__file__).resolve().parents[2] / DOCS_DIR).resolve()
DOCS_DIR.mkdir(parents=True, exist_ok=True)

try:
    import fitz  # type: ignore
except ImportError:
    fitz = None


BOOK_ANALYSIS_COLLECTION = "book_analysis_projects"
BOOK_ANALYSIS_ROOT = DOCS_DIR / "book-analysis"


class BookAnalysisService:
    CHAPTER_HEADING_PATTERNS = [
        re.compile(r"^\s*第[一二三四五六七八九十百千万0-9]+章[\s：:.-]*(.+)?$"),
        re.compile(r"^\s*Chapter\s+\d+[\s:.-]*(.+)?$", re.IGNORECASE),
        re.compile(r"^\s*CHAPTER\s+\d+[\s:.-]*(.+)?$"),
    ]

    def __init__(self) -> None:
        self._running_tasks: Dict[str, asyncio.Task] = {}
        self._running_lock = threading.Lock()

    def register_task(self, project_id: str, task: asyncio.Task) -> None:
        with self._running_lock:
            self._running_tasks[project_id] = task

        def _cleanup(_: asyncio.Task) -> None:
            with self._running_lock:
                self._running_tasks.pop(project_id, None)

        task.add_done_callback(_cleanup)

    async def list_projects(self, *, user_id: str) -> List[Dict[str, Any]]:
        cursor = db.db[BOOK_ANALYSIS_COLLECTION].find({"userId": user_id}).sort("updatedAt", -1)
        docs = await cursor.to_list(length=100)
        return [self.serialize_project(doc) for doc in docs]

    async def get_project(self, *, project_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        oid = self._parse_object_id(project_id)
        if oid is None:
            return None
        return await db.db[BOOK_ANALYSIS_COLLECTION].find_one({"_id": oid, "userId": user_id})

    async def create_project(
        self,
        *,
        user_id: str,
        filename: str,
        content: bytes,
        title: Optional[str] = None,
    ) -> Dict[str, Any]:
        if fitz is None:
            raise HTTPException(status_code=500, detail="缺少 PyMuPDF（fitz），无法处理 PDF")

        if not filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="当前仅支持 PDF 文件")
        if not content:
            raise HTTPException(status_code=400, detail="PDF 文件内容为空")

        project_oid = ObjectId()
        project_id = str(project_oid)
        project_dir = BOOK_ANALYSIS_ROOT / user_id / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        original_path = project_dir / "original.pdf"
        original_path.write_bytes(content)

        inferred_title = (title or Path(filename).stem or "未命名书籍").strip()
        page_count, chapters = await run_in_threadpool(
            self._extract_page_count_and_chapters,
            original_path,
            inferred_title,
        )

        # 自动创建 category="reading" 的 TaskProcess
        from app.business.task_process_business import _task_process_business
        from app.models.task_process import TaskProcessCreate

        task_payload = TaskProcessCreate(
            title=f"阅读分析: {inferred_title}",
            description=f"书籍分析项目: {filename}",
            goal=f"精读并分析《{inferred_title}》的章节内容",
            category="reading",
            auto_plan=False
        )
        task_out = await _task_process_business.create_task_process(user_id, task_payload)

        # 将检测到的章节映射为任务的 milestones
        milestones = []
        for index, ch in enumerate(chapters):
            milestones.append({
                "id": f"ch_{index + 1}",
                "title": ch.get("title") or f"第 {index + 1} 部分",
                "description": f"分析第 {ch.get('startPage')} 页至第 {ch.get('endPage')} 页的内容",
                "order": index,
                "status": "pending",
                "target_date": None,
                "completed_at": None
            })
            
        await db.db.task_processes.update_one(
            {"_id": ObjectId(task_out.id)},
            {"$set": {"milestones": milestones, "status": "planned", "updatedAt": datetime.utcnow()}}
        )

        now = datetime.now(timezone.utc)
        source_rel_path = original_path.resolve().relative_to(DOCS_DIR.resolve()).as_posix()
        project_doc = {
            "_id": project_oid,
            "userId": user_id,
            "title": inferred_title,
            "originalFilename": filename,
            "sourcePath": source_rel_path,
            "pageCount": page_count,
            "notebookId": None,
            "status": "draft",
            "currentStage": "draft/chapters_detected",
            "currentChapterIndex": 0,
            "totalChapters": len(chapters),
            "progressPercent": 0,
            "error": None,
            "chapters": chapters,
            "exportHtmlPath": None,
            "createdAt": now,
            "updatedAt": now,
            "startedAt": None,
            "completedAt": None,
            "taskId": task_out.id,
        }
        await db.db[BOOK_ANALYSIS_COLLECTION].insert_one(project_doc)
        return self.serialize_project(project_doc)

    async def update_chapters(
        self,
        *,
        project_id: str,
        user_id: str,
        chapters_input: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        project = await self.get_project(project_id=project_id, user_id=user_id)
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")
        if project.get("status") == "running":
            raise HTTPException(status_code=409, detail="项目分析中，不能修改章节")

        normalized = self._normalize_chapter_inputs(chapters_input, int(project.get("pageCount") or 0))
        now = datetime.now(timezone.utc)
        project["chapters"] = normalized
        project["status"] = "draft"
        project["currentStage"] = "draft/chapters_saved"
        project["currentChapterIndex"] = 0
        project["totalChapters"] = len(normalized)
        project["progressPercent"] = 0
        project["error"] = None
        project["exportHtmlPath"] = None
        project["updatedAt"] = now
        project["completedAt"] = None

        task_id_str = project.get("taskId")
        if task_id_str:
            milestones = []
            for index, ch in enumerate(normalized):
                milestones.append({
                    "id": f"ch_{index + 1}",
                    "title": ch.get("title") or f"第 {index + 1} 部分",
                    "description": f"分析第 {ch.get('startPage')} 页至第 {ch.get('endPage')} 页的内容",
                    "order": index,
                    "status": "pending",
                    "target_date": None,
                    "completed_at": None
                })
            await db.db.task_processes.update_one(
                {"_id": ObjectId(task_id_str)},
                {"$set": {"milestones": milestones, "status": "planned", "updatedAt": datetime.utcnow()}}
            )

        await self._persist_project(project)
        return self.serialize_project(project)

    async def start_project(self, *, project_id: str, user_id: str) -> Dict[str, Any]:
        project = await self.get_project(project_id=project_id, user_id=user_id)
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")
        if project.get("status") == "running":
            raise HTTPException(status_code=409, detail="项目已在分析中")
        if not project.get("chapters"):
            raise HTTPException(status_code=400, detail="请先配置章节")

        await self._validate_runtime_dependencies()

        now = datetime.now(timezone.utc)
        project["status"] = "running"
        project["currentStage"] = "running/queued"
        project["currentChapterIndex"] = 0
        project["totalChapters"] = len(project.get("chapters") or [])
        project["progressPercent"] = 0
        project["error"] = None
        project["notebookId"] = None
        project["exportHtmlPath"] = None
        project["startedAt"] = now
        project["completedAt"] = None
        project["updatedAt"] = now
        for chapter in project.get("chapters", []):
            chapter["status"] = "draft"
            chapter["summary"] = ""
            chapter["keyPoints"] = []
            chapter["arguments"] = []
            chapter["examples"] = []
            chapter["evidence"] = []
            chapter["quotedEvidence"] = []
            chapter["openQuestions"] = []
            chapter["rawAnswer"] = ""
            chapter["error"] = None
        await self._persist_project(project)

        task = asyncio.create_task(self.process_project(project_id=project_id, user_id=user_id))
        self.register_task(project_id, task)

        # 启动任务进程：更新其状态为 active 且阶段为 during
        task_id_str = project.get("taskId")
        if task_id_str:
            try:
                from app.business.task_process_business import _task_process_business
                from app.models.task_process import TaskProcessUpdate
                await _task_process_business.update_task_process(
                    user_id,
                    task_id_str,
                    TaskProcessUpdate(status="active", phase="during")
                )
            except Exception as e:
                logger.warning(f"Failed to update TaskProcess status to active: {e}")

        return self.serialize_project(project)

    async def get_status(self, *, project_id: str, user_id: str) -> Dict[str, Any]:
        project = await self.get_project(project_id=project_id, user_id=user_id)
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")
        return {
            "id": str(project["_id"]),
            "status": project.get("status"),
            "currentStage": project.get("currentStage"),
            "currentChapterIndex": int(project.get("currentChapterIndex") or 0),
            "totalChapters": int(project.get("totalChapters") or 0),
            "progressPercent": int(project.get("progressPercent") or 0),
            "error": project.get("error"),
            "updatedAt": self._to_jsonable(project.get("updatedAt")),
        }

    async def process_project(self, *, project_id: str, user_id: str) -> None:
        project = await self.get_project(project_id=project_id, user_id=user_id)
        if not project:
            return

        try:
            notebook_payload = await self._run_notebooklm_json(["create", project["title"], "--json"])
            notebook_id = str(
                notebook_payload.get("id")
                or (notebook_payload.get("notebook") or {}).get("id")
                or ""
            ).strip()
            if not notebook_id:
                raise RuntimeError("NotebookLM 创建 notebook 返回缺少 id")
            project["notebookId"] = notebook_id
            project["currentStage"] = "running/notebook_created"
            project["updatedAt"] = datetime.now(timezone.utc)
            await self._persist_project(project)

            any_chapter_errors = False
            total = len(project.get("chapters") or [])
            for index, chapter in enumerate(project.get("chapters") or []):
                project["currentChapterIndex"] = index + 1
                project["progressPercent"] = int((index / max(total, 1)) * 100)
                chapter["status"] = "running"
                chapter["error"] = None
                project["currentStage"] = f"running/chapter_{index + 1}_preparing"
                project["updatedAt"] = datetime.now(timezone.utc)
                await self._persist_project(project)

                try:
                    chapter_path = await run_in_threadpool(
                        self._create_chapter_pdf,
                        user_id,
                        project_id,
                        int(chapter["startPage"]),
                        int(chapter["endPage"]),
                        index,
                    )

                    project["currentStage"] = f"running/chapter_{index + 1}_uploading"
                    project["updatedAt"] = datetime.now(timezone.utc)
                    await self._persist_project(project)
                    source_payload = await self._run_notebooklm_json(
                        [
                            "source",
                            "add",
                            str(chapter_path.resolve()),
                            "--type",
                            "file",
                            "--notebook",
                            notebook_id,
                            "--json",
                        ],
                        timeout_seconds=max(
                            60,
                            int(getattr(settings, "BOOK_ANALYSIS_SOURCE_ADD_TIMEOUT_SECONDS", 900)),
                        ),
                    )
                    source_id = str(
                        source_payload.get("source_id")
                        or source_payload.get("id")
                        or (source_payload.get("source") or {}).get("id")
                        or ""
                    ).strip()
                    if not source_id:
                        raise RuntimeError("NotebookLM 上传章节返回缺少 source_id")

                    project["currentStage"] = f"running/chapter_{index + 1}_waiting"
                    project["updatedAt"] = datetime.now(timezone.utc)
                    await self._persist_project(project)
                    await self._run_notebooklm_json(
                        [
                            "source",
                            "wait",
                            source_id,
                            "--notebook",
                            notebook_id,
                            "--timeout",
                            str(settings.BOOK_ANALYSIS_SOURCE_WAIT_TIMEOUT_SECONDS),
                            "--json",
                        ]
                    )

                    project["currentStage"] = f"running/chapter_{index + 1}_analyzing"
                    project["updatedAt"] = datetime.now(timezone.utc)
                    await self._persist_project(project)
                    prompt = self._build_chapter_prompt(
                        book_title=str(project.get("title") or ""),
                        chapter_title=str(chapter.get("title") or ""),
                        start_page=int(chapter.get("startPage") or 0),
                        end_page=int(chapter.get("endPage") or 0),
                    )
                    ask_payload = await self._run_notebooklm_json(
                        [
                            "ask",
                            prompt,
                            "--notebook",
                            notebook_id,
                            "--source",
                            source_id,
                            "--json",
                        ]
                    )
                    raw_answer = str(ask_payload.get("answer") or "").strip()
                    parsed = self._extract_structured_answer(raw_answer)
                    chapter["rawAnswer"] = raw_answer
                    if parsed is None:
                        chapter["status"] = "completed_with_errors"
                        chapter["error"] = "NotebookLM 返回内容不是有效 JSON，已保留原始回答"
                    else:
                        self._merge_chapter_analysis(chapter, parsed)
                        chapter["status"] = "completed"
                        chapter["error"] = None
                except Exception as exc:  # noqa: BLE001
                    any_chapter_errors = True
                    chapter["status"] = "completed_with_errors"
                    chapter["error"] = str(exc)
                finally:
                    try:
                        if "source_id" in locals() and source_id:
                            await self._run_notebooklm_text(
                                [
                                    "source",
                                    "delete",
                                    source_id,
                                    "--notebook",
                                    notebook_id,
                                    "--yes",
                                ]
                            )
                    except (OSError, subprocess.SubprocessError):
                        pass

                    # 更新关联的 TaskProcess 里程碑和生成 note Evidence
                    task_id_str = project.get("taskId")
                    if task_id_str:
                        try:
                            task_oid = ObjectId(task_id_str)
                            task_doc = await db.db.task_processes.find_one({"_id": task_oid, "userId": user_id})
                            if task_doc:
                                milestones = task_doc.get("milestones", [])
                                for ms in milestones:
                                    if ms.get("id") == f"ch_{index + 1}":
                                        ms["status"] = "completed"
                                        ms["completed_at"] = datetime.utcnow()
                                        break
                                await db.db.task_processes.update_one(
                                    {"_id": task_oid},
                                    {"$set": {"milestones": milestones, "updatedAt": datetime.utcnow()}}
                                )
                                
                            from app.models.evidence import EvidenceCreate
                            from app.business.task_process_business import _task_process_business
                            
                            summary_val = chapter.get("summary") or chapter.get("error") or "章节分析完成，未提取到有效摘要。"
                            key_points_val = "\n".join(f"- {pt}" for pt in chapter.get("keyPoints", [])) or "- 无关键观点"
                            summary_text = (
                                f"已完成第 {index + 1} 章节《{chapter.get('title')}》的分析。\n\n"
                                f"【摘要】\n{summary_val}\n\n"
                                f"【核心观点】\n{key_points_val}"
                            )
                            payload = EvidenceCreate(
                                task_id=task_id_str,
                                type="note",
                                title=f"章节分析: {chapter.get('title')}",
                                content=summary_text,
                                source="book_analysis",
                                milestone_id=f"ch_{index + 1}",
                                metadata={"chapter_index": index}
                            )
                            await _task_process_business.create_evidence(user_id, payload)
                        except Exception as e:
                            logger.warning(f"Failed to record Chapter milestone/evidence: {e}")

                    project["updatedAt"] = datetime.now(timezone.utc)
                    await self._persist_project(project)

            project["currentStage"] = "running/exporting"
            project["progressPercent"] = 100
            project["updatedAt"] = datetime.now(timezone.utc)
            await self._persist_project(project)

            export_path = await run_in_threadpool(self._generate_reader_html, project)
            project["exportHtmlPath"] = export_path.resolve().relative_to(DOCS_DIR.resolve()).as_posix()
            project["status"] = "completed_with_errors" if any_chapter_errors else "completed"
            project["currentStage"] = "completed/exported"
            project["completedAt"] = datetime.now(timezone.utc)
            project["updatedAt"] = datetime.now(timezone.utc)
            await self._persist_project(project)

            # 完成任务进程：更新其状态为 completed 且阶段为 after
            task_id_str = project.get("taskId")
            if task_id_str:
                try:
                    from app.business.task_process_business import _task_process_business
                    from app.models.task_process import TaskProcessUpdate
                    await _task_process_business.update_task_process(
                        user_id,
                        task_id_str,
                        TaskProcessUpdate(status="completed", phase="after")
                    )
                except Exception as e:
                    logger.warning(f"Failed to update TaskProcess to completed status: {e}")

        except Exception as exc:  # noqa: BLE001
            project["status"] = "failed"
            project["error"] = str(exc)
            project["currentStage"] = "failed/runtime_error"
            project["updatedAt"] = datetime.now(timezone.utc)
            project["completedAt"] = datetime.now(timezone.utc)
            await self._persist_project(project)

            # 任务进程阻塞：更新其状态为 blocked
            task_id_str = project.get("taskId")
            if task_id_str:
                try:
                    from app.business.task_process_business import _task_process_business
                    from app.models.task_process import TaskProcessUpdate
                    await _task_process_business.update_task_process(
                        user_id,
                        task_id_str,
                        TaskProcessUpdate(status="blocked")
                    )
                except Exception as e:
                    logger.warning(f"Failed to update TaskProcess to blocked status: {e}")

    def serialize_project(self, project: Dict[str, Any]) -> Dict[str, Any]:
        data = dict(project)
        data["id"] = str(data.pop("_id"))
        if data.get("sourcePath"):
            data["sourceRawUrl"] = f"/api/knowledge/raw?path={data['sourcePath']}"
        if data.get("exportHtmlPath"):
            data["exportHtmlUrl"] = f"/api/knowledge/raw?path={data['exportHtmlPath']}"
        return self._to_jsonable(data)

    async def _persist_project(self, project: Dict[str, Any]) -> None:
        await db.db[BOOK_ANALYSIS_COLLECTION].update_one(
            {"_id": project["_id"], "userId": project["userId"]},
            {
                "$set": {
                    "title": project.get("title"),
                    "originalFilename": project.get("originalFilename"),
                    "sourcePath": project.get("sourcePath"),
                    "pageCount": project.get("pageCount"),
                    "notebookId": project.get("notebookId"),
                    "status": project.get("status"),
                    "currentStage": project.get("currentStage"),
                    "currentChapterIndex": project.get("currentChapterIndex"),
                    "totalChapters": project.get("totalChapters"),
                    "progressPercent": project.get("progressPercent"),
                    "error": project.get("error"),
                    "chapters": project.get("chapters"),
                    "exportHtmlPath": project.get("exportHtmlPath"),
                    "updatedAt": project.get("updatedAt"),
                    "startedAt": project.get("startedAt"),
                    "completedAt": project.get("completedAt"),
                    "taskId": project.get("taskId"),
                }
            },
        )

    def _extract_page_count_and_chapters(self, pdf_path: Path, title: str) -> tuple[int, List[Dict[str, Any]]]:
        doc = fitz.open(str(pdf_path))
        try:
            page_count = len(doc)
            chapters = self._extract_toc_chapters(doc)
            if len(chapters) <= 1:
                chapters = self._extract_heading_chapters(doc)
            if not chapters:
                chapters = [self._make_chapter(title="全书内容", start_page=1, end_page=page_count)]
            return page_count, chapters
        finally:
            doc.close()

    def _extract_toc_chapters(self, doc: Any) -> List[Dict[str, Any]]:
        toc = doc.get_toc(simple=False) or []
        if not toc:
            return []

        min_level = min((int(item[0]) for item in toc if len(item) >= 3 and int(item[2]) > 0), default=1)
        entries: List[tuple[str, int]] = []
        seen_pages: set[int] = set()
        for item in toc:
            if len(item) < 3:
                continue
            level, raw_title, raw_page = int(item[0]), str(item[1]).strip(), int(item[2])
            if level != min_level or raw_page <= 0 or not raw_title:
                continue
            if raw_page in seen_pages:
                continue
            seen_pages.add(raw_page)
            entries.append((raw_title, raw_page))

        return self._build_chapters_from_entries(entries, len(doc))

    def _extract_heading_chapters(self, doc: Any) -> List[Dict[str, Any]]:
        entries: List[tuple[str, int]] = []
        seen_pages: set[int] = set()
        for page_index in range(len(doc)):
            text = (doc[page_index].get_text() or "").strip()
            if not text:
                continue
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            for line in lines[:8]:
                if any(pattern.match(line) for pattern in self.CHAPTER_HEADING_PATTERNS):
                    page_number = page_index + 1
                    if page_number in seen_pages:
                        break
                    seen_pages.add(page_number)
                    entries.append((line[:300], page_number))
                    break
        return self._build_chapters_from_entries(entries, len(doc))

    def _build_chapters_from_entries(self, entries: List[tuple[str, int]], page_count: int) -> List[Dict[str, Any]]:
        if not entries:
            return []
        entries = sorted(entries, key=lambda item: item[1])
        chapters: List[Dict[str, Any]] = []
        for index, (title, start_page) in enumerate(entries):
            next_page = entries[index + 1][1] if index + 1 < len(entries) else page_count + 1
            end_page = max(start_page, min(page_count, next_page - 1))
            chapters.append(self._make_chapter(title=title, start_page=start_page, end_page=end_page))
        return [chapter for chapter in chapters if chapter["startPage"] <= chapter["endPage"]]

    def _make_chapter(self, *, title: str, start_page: int, end_page: int) -> Dict[str, Any]:
        clean_title = title.strip() or f"章节 {start_page}"
        return {
            "id": uuid.uuid4().hex,
            "title": clean_title,
            "startPage": int(start_page),
            "endPage": int(end_page),
            "status": "draft",
            "summary": "",
            "keyPoints": [],
            "arguments": [],
            "examples": [],
            "evidence": [],
            "quotedEvidence": [],
            "openQuestions": [],
            "rawAnswer": "",
            "error": None,
        }

    def _normalize_chapter_inputs(
        self,
        chapters_input: List[Dict[str, Any]],
        page_count: int,
    ) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        previous_end = 0
        for item in chapters_input:
            title = str(item.get("title") or "").strip()
            start_page = int(item.get("startPage") or 0)
            end_page = int(item.get("endPage") or 0)
            if not title:
                raise HTTPException(status_code=400, detail="章节标题不能为空")
            if start_page < 1 or end_page < 1:
                raise HTTPException(status_code=400, detail="章节页码必须大于 0")
            if start_page > end_page:
                raise HTTPException(status_code=400, detail=f"章节《{title}》起始页不能大于结束页")
            if end_page > page_count:
                raise HTTPException(status_code=400, detail=f"章节《{title}》页码超出 PDF 总页数")
            if start_page <= previous_end:
                raise HTTPException(status_code=400, detail=f"章节《{title}》与前一章节页码重叠或顺序错误")
            normalized.append(self._make_chapter(title=title, start_page=start_page, end_page=end_page))
            previous_end = end_page
        return normalized

    def _create_chapter_pdf(
        self,
        user_id: str,
        project_id: str,
        start_page: int,
        end_page: int,
        chapter_index: int,
    ) -> Path:
        project_dir = BOOK_ANALYSIS_ROOT / user_id / project_id
        chapters_dir = project_dir / "chapters"
        chapters_dir.mkdir(parents=True, exist_ok=True)
        original_path = project_dir / "original.pdf"
        output_path = chapters_dir / f"chapter-{chapter_index + 1:03d}.pdf"
        source_doc = fitz.open(str(original_path))
        target_doc = fitz.open()
        try:
            target_doc.insert_pdf(source_doc, from_page=start_page - 1, to_page=end_page - 1)
            target_doc.save(str(output_path))
        finally:
            target_doc.close()
            source_doc.close()
        return output_path

    def _build_chapter_prompt(self, *, book_title: str, chapter_title: str, start_page: int, end_page: int) -> str:
        return (
            f"你正在分析书籍《{book_title}》的章节《{chapter_title}》，"
            f"页码范围为 {start_page}-{end_page}。"
            "请只基于这个章节的内容进行分析。"
            "你必须只返回一个 JSON 对象，禁止输出 Markdown、解释文字或代码块。"
            'JSON schema: {"chapterTitle": string, "summary": string, "keyPoints": string[], '
            '"arguments": string[], "examples": string[], "openQuestions": string[], '
            '"quotedEvidence": string[]}.'
            "如果某项没有内容，返回空字符串或空数组。"
        )

    def _extract_structured_answer(self, raw_answer: str) -> Optional[Dict[str, Any]]:
        if not raw_answer:
            return None
        raw_answer = raw_answer.strip()
        candidates = [raw_answer]

        fenced_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", raw_answer, re.DOTALL)
        if fenced_match:
            candidates.append(fenced_match.group(1))

        brace_match = re.search(r"(\{.*\})", raw_answer, re.DOTALL)
        if brace_match:
            candidates.append(brace_match.group(1))

        for candidate in candidates:
            try:
                parsed = json.loads(candidate)
            except (json.JSONDecodeError, TypeError):
                continue
            if isinstance(parsed, dict):
                return parsed
        return None

    def _merge_chapter_analysis(self, chapter: Dict[str, Any], parsed: Dict[str, Any]) -> None:
        chapter["title"] = str(parsed.get("chapterTitle") or chapter.get("title") or "").strip() or chapter["title"]
        chapter["summary"] = str(parsed.get("summary") or "").strip()
        chapter["keyPoints"] = self._ensure_string_list(parsed.get("keyPoints"))
        chapter["arguments"] = self._ensure_string_list(parsed.get("arguments"))
        chapter["examples"] = self._ensure_string_list(parsed.get("examples"))
        chapter["openQuestions"] = self._ensure_string_list(parsed.get("openQuestions"))
        chapter["quotedEvidence"] = self._ensure_string_list(parsed.get("quotedEvidence"))
        chapter["evidence"] = list(chapter["quotedEvidence"])

    def _generate_reader_html(self, project: Dict[str, Any]) -> Path:
        source_path = DOCS_DIR / str(project["sourcePath"])
        pdf_base64 = base64.b64encode(source_path.read_bytes()).decode("ascii")
        pdf_data_url = f"data:application/pdf;base64,{pdf_base64}"
        payload = {
            "title": project.get("title"),
            "status": project.get("status"),
            "createdAt": self._to_jsonable(project.get("createdAt")),
            "updatedAt": self._to_jsonable(project.get("updatedAt")),
            "chapters": project.get("chapters") or [],
            "pdfUrl": pdf_data_url,
        }
        json_payload = json.dumps(payload, ensure_ascii=False)
        html_content = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>{html.escape(str(project.get("title") or "书籍分析"))}</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #eef4f7;
      --panel: rgba(255,255,255,.78);
      --line: rgba(15,23,42,.10);
      --text: #102030;
      --muted: #587082;
      --accent: #0d9488;
      --accent-soft: rgba(13,148,136,.12);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: "PingFang SC","Noto Sans SC","Helvetica Neue",sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(13,148,136,.12), transparent 32%),
        radial-gradient(circle at top right, rgba(14,165,233,.10), transparent 30%),
        linear-gradient(180deg, #f7fbfc, var(--bg));
      min-height: 100vh;
    }}
    .shell {{
      padding: 20px;
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 16px;
      min-height: 100vh;
    }}
    .hero, .panel {{
      background: var(--panel);
      backdrop-filter: blur(18px);
      border: 1px solid var(--line);
      border-radius: 24px;
      box-shadow: 0 16px 60px rgba(15,23,42,.08);
    }}
    .hero {{
      padding: 24px 28px;
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 20px;
    }}
    .hero h1 {{ margin: 0 0 10px; font-size: 30px; }}
    .hero p {{ margin: 0; color: var(--muted); }}
    .badge {{
      display: inline-flex;
      padding: 8px 12px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 13px;
      font-weight: 600;
    }}
    .layout {{
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(380px, 1.2fr) minmax(320px, .9fr);
      gap: 16px;
    }}
    .pdf-panel {{ padding: 16px; }}
    .pdf-frame {{
      width: 100%;
      height: calc(100vh - 210px);
      border: 0;
      border-radius: 18px;
      background: #fff;
    }}
    .analysis-panel {{
      padding: 16px;
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 12px;
      min-height: 0;
    }}
    .chapter-list {{
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      overflow: auto;
      max-height: 160px;
    }}
    .chip {{
      border: 1px solid var(--line);
      background: rgba(255,255,255,.7);
      border-radius: 999px;
      padding: 10px 14px;
      cursor: pointer;
      font-size: 13px;
      transition: .2s ease;
    }}
    .chip.active {{
      background: var(--accent);
      border-color: var(--accent);
      color: white;
    }}
    .content {{
      overflow: auto;
      padding: 8px 4px 0;
    }}
    .section {{
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--line);
    }}
    .section:last-child {{ border-bottom: 0; }}
    .section h3 {{
      margin: 0 0 12px;
      font-size: 15px;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: var(--muted);
    }}
    .section p {{
      margin: 0;
      line-height: 1.8;
      white-space: pre-wrap;
    }}
    ul {{
      margin: 0;
      padding-left: 18px;
      line-height: 1.8;
    }}
    .error {{
      color: #b91c1c;
      background: rgba(239,68,68,.08);
      border: 1px solid rgba(239,68,68,.18);
      padding: 12px 14px;
      border-radius: 14px;
    }}
    @media (max-width: 960px) {{
      .layout {{ grid-template-columns: 1fr; }}
      .pdf-frame {{ height: 52vh; }}
    }}
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <div>
        <div class="badge">NotebookLM 逐章分析</div>
        <h1>{html.escape(str(project.get("title") or "书籍分析"))}</h1>
        <p>生成时间：{html.escape(str(self._to_jsonable(project.get("updatedAt")) or ""))}</p>
      </div>
      <div class="badge">{html.escape(str(project.get("status") or ""))}</div>
    </section>
    <section class="layout">
      <div class="panel pdf-panel">
        <iframe class="pdf-frame" src="{pdf_data_url}"></iframe>
      </div>
      <div class="panel analysis-panel">
        <div id="chapter-list" class="chapter-list"></div>
        <div id="chapter-content" class="content"></div>
      </div>
    </section>
  </div>
  <script>
    const payload = {json_payload};
    const chapterList = document.getElementById('chapter-list');
    const chapterContent = document.getElementById('chapter-content');
    const escapeHtml = (value) => String(value || '').replace(/[&<>"]/g, (char) => ({{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}}[char]));
    const renderList = (activeIndex) => {{
      chapterList.innerHTML = '';
      payload.chapters.forEach((chapter, index) => {{
        const button = document.createElement('button');
        button.className = 'chip' + (index === activeIndex ? ' active' : '');
        button.textContent = `${{index + 1}}. ${{chapter.title}}`;
        button.addEventListener('click', () => {{
          renderList(index);
          renderChapter(index);
        }});
        chapterList.appendChild(button);
      }});
    }};
    const renderSection = (title, body) => {{
      if (!body || (Array.isArray(body) && body.length === 0)) return '';
      if (Array.isArray(body)) {{
        return `<section class="section"><h3>${{title}}</h3><ul>${{body.map(item => `<li>${{escapeHtml(item)}}</li>`).join('')}}</ul></section>`;
      }}
      return `<section class="section"><h3>${{title}}</h3><p>${{escapeHtml(body)}}</p></section>`;
    }};
    const renderChapter = (index) => {{
      const chapter = payload.chapters[index];
      if (!chapter) {{
        chapterContent.innerHTML = '<p>暂无章节内容</p>';
        return;
      }}
      chapterContent.innerHTML = `
        <section class="section">
          <h2>${{escapeHtml(chapter.title)}}</h2>
          <p>页码：${{chapter.startPage}} - ${{chapter.endPage}}</p>
        </section>
        ${{chapter.error ? `<div class="error">${{escapeHtml(chapter.error)}}</div>` : ''}}
        ${{renderSection('章节摘要', chapter.summary)}}
        ${{renderSection('关键点', chapter.keyPoints)}}
        ${{renderSection('论点', chapter.arguments)}}
        ${{renderSection('例子', chapter.examples)}}
        ${{renderSection('开放问题', chapter.openQuestions)}}
        ${{renderSection('证据', chapter.quotedEvidence)}}
      `;
    }};
    renderList(0);
    renderChapter(0);
  </script>
</body>
</html>"""
        export_dir = BOOK_ANALYSIS_ROOT / str(project["userId"]) / str(project["_id"]) / "exports"
        export_dir.mkdir(parents=True, exist_ok=True)
        export_path = export_dir / "reader.html"
        export_path.write_text(html_content, encoding="utf-8")
        return export_path

    async def _validate_runtime_dependencies(self) -> None:
        cli_path = shutil.which(settings.NOTEBOOKLM_CLI_PATH)
        if cli_path is None:
            raise HTTPException(status_code=500, detail="未找到 notebooklm CLI，请先安装 notebooklm-py")
        storage_path = Path.home() / ".notebooklm" / "storage_state.json"
        if not os.getenv("NOTEBOOKLM_AUTH_JSON") and not storage_path.exists():
            raise HTTPException(status_code=500, detail="未检测到 NotebookLM 登录态，请先执行 notebooklm login")
        try:
            await self._run_notebooklm_text(["auth", "check"])
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=500, detail=f"NotebookLM 认证检查失败: {exc}") from exc

    async def _run_notebooklm_json(
        self,
        args: List[str],
        timeout_seconds: Optional[int] = None,
    ) -> Dict[str, Any]:
        stdout = await self._run_notebooklm_text(args, timeout_seconds=timeout_seconds)
        try:
            parsed = json.loads(stdout)
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(f"NotebookLM 返回非 JSON 输出: {stdout[:300]}") from exc
        if not isinstance(parsed, dict):
            raise RuntimeError("NotebookLM 返回 JSON 不是对象")
        return parsed

    async def _run_notebooklm_text(
        self,
        args: List[str],
        timeout_seconds: Optional[int] = None,
    ) -> str:
        env = os.environ.copy()
        process = await asyncio.create_subprocess_exec(
            settings.NOTEBOOKLM_CLI_PATH,
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=max(
                    30,
                    int(timeout_seconds or settings.BOOK_ANALYSIS_COMMAND_TIMEOUT_SECONDS),
                ),
            )
        except asyncio.TimeoutError as exc:
            process.kill()
            raise RuntimeError(f"NotebookLM 命令超时: {' '.join(args)}") from exc

        stdout_text = (stdout or b"").decode("utf-8", errors="ignore").strip()
        stderr_text = (stderr or b"").decode("utf-8", errors="ignore").strip()
        if process.returncode != 0:
            raise RuntimeError(stderr_text or stdout_text or f"NotebookLM 命令失败: {' '.join(args)}")
        return stdout_text

    def _parse_object_id(self, value: str) -> Optional[ObjectId]:
        try:
            return ObjectId(value)
        except (InvalidId, TypeError, ValueError):
            return None

    def _ensure_string_list(self, value: Any) -> List[str]:
        if not isinstance(value, list):
            return []
        result: List[str] = []
        for item in value:
            text = str(item or "").strip()
            if text:
                result.append(text)
        return result

    def _to_jsonable(self, value: Any) -> Any:
        if isinstance(value, ObjectId):
            return str(value)
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, Path):
            return str(value)
        if isinstance(value, dict):
            return {k: self._to_jsonable(v) for k, v in value.items()}
        if isinstance(value, list):
            return [self._to_jsonable(item) for item in value]
        return value


book_analysis_service = BookAnalysisService()
