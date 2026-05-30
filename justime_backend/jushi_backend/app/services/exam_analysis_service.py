"""
考研真题解析服务
上传真题 PDF 到 NotebookLM，分析趋势，生成练习题
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.database import db
from app.services.notebooklm_service import notebooklm_service
from app.services.llm_service import llm_service
from app.services.user_service import UserService
from app.services.encryption_service import encryption_service
from app.core.config import LLMConfig, settings

logger = logging.getLogger(__name__)


class ExamAnalysisService:

    async def upload_exam_paper(
        self, user_id: str, subject: str, file_path: str, year: int
    ) -> dict:
        try:
            path = Path(file_path)
            if not path.exists():
                return {"success": False, "error": f"文件不存在: {file_path}"}

            notebook_id = await self._get_or_create_subject_notebook(user_id, subject)

            result = await notebooklm_service._run_cli_json([
                "source", "add", str(path),
                "--notebook", notebook_id,
            ], timeout=settings.BOOK_ANALYSIS_SOURCE_ADD_TIMEOUT_SECONDS)

            source_id = result.get("id") or result.get("source_id", "")
            if source_id:
                try:
                    await notebooklm_service._run_cli_text(
                        ["source", "wait", source_id, "--notebook", notebook_id],
                        timeout=settings.BOOK_ANALYSIS_SOURCE_WAIT_TIMEOUT_SECONDS,
                    )
                except Exception as e:
                    logger.warning(f"Source wait failed for {source_id}: {e}")

            source_title = result.get("title") or result.get("source_title", path.name)

            source_record = {
                "filename": path.name,
                "source_id": source_id,
                "source_title": source_title,
                "year": year,
                "subject": subject,
                "synced_at": datetime.now(timezone.utc).isoformat(),
            }

            await db.db.study_notebooks.update_one(
                {"user_id": user_id, "subject": subject},
                {"$push": {"sources": source_record}},
            )

            exam_doc = {
                "userId": user_id,
                "subject": subject,
                "year": year,
                "filename": path.name,
                "notebookSourceId": source_id,
                "notebookId": notebook_id,
                "uploadedAt": datetime.now(timezone.utc),
                "analysisStatus": "pending",
            }
            result = await db.db.exam_papers.insert_one(exam_doc)
            exam_id = str(result.inserted_id)

            knowledge_points = await self._extract_knowledge_points(
                user_id, subject, notebook_id
            )

            if knowledge_points:
                await db.db.exam_papers.update_one(
                    {"_id": result.inserted_id},
                    {
                        "$set": {
                            "knowledgePoints": knowledge_points,
                            "analysisStatus": "completed",
                            "analyzedAt": datetime.now(timezone.utc),
                        }
                    },
                )

            return {
                "success": True,
                "data": {
                    "examId": exam_id,
                    "subject": subject,
                    "year": year,
                    "filename": path.name,
                    "notebookSourceId": source_id,
                    "knowledgePoints": knowledge_points,
                },
            }
        except Exception as e:
            logger.error(f"upload_exam_paper failed: {e}")
            return {"success": False, "error": str(e)}

    async def analyze_exam_trends(self, user_id: str, subject: str) -> dict:
        try:
            cursor = db.db.exam_papers.find(
                {"userId": user_id, "subject": subject}
            ).sort("year", -1)
            papers = await cursor.to_list(length=50)

            if not papers:
                return {"success": False, "error": f"未找到 {subject} 的真题记录，请先上传真题"}

            all_knowledge_points: List[dict] = []
            for paper in papers:
                for kp in paper.get("knowledgePoints", []):
                    kp["year"] = paper.get("year")
                    all_knowledge_points.append(kp)

            frequency_map: Dict[str, int] = {}
            year_map: Dict[str, List[int]] = {}
            for kp in all_knowledge_points:
                name = kp.get("name", "")
                if not name:
                    continue
                frequency_map[name] = frequency_map.get(name, 0) + 1
                if name not in year_map:
                    year_map[name] = []
                if kp.get("year"):
                    year_map[name].append(kp["year"])

            high_frequency = sorted(
                frequency_map.items(), key=lambda x: x[1], reverse=True
            )[:20]

            trends = []
            for name, count in high_frequency:
                trends.append(
                    {
                        "knowledgePoint": name,
                        "frequency": count,
                        "years": sorted(year_map.get(name, []), reverse=True),
                    }
                )

            llm_analysis = await self._llm_analyze_trends(subject, trends)

            trend_doc = {
                "userId": user_id,
                "subject": subject,
                "trends": trends,
                "llmAnalysis": llm_analysis,
                "paperCount": len(papers),
                "analyzedAt": datetime.now(timezone.utc),
            }
            await db.db.exam_trends.insert_one(trend_doc)

            return {
                "success": True,
                "data": {
                    "subject": subject,
                    "paperCount": len(papers),
                    "trends": trends,
                    "llmAnalysis": llm_analysis,
                },
            }
        except Exception as e:
            logger.error(f"analyze_exam_trends failed: {e}")
            return {"success": False, "error": str(e)}

    async def generate_practice_questions(
        self,
        user_id: str,
        subject: str,
        knowledge_point: str,
        count: int = 5,
    ) -> dict:
        try:
            cursor = db.db.exam_papers.find(
                {"userId": user_id, "subject": subject}
            ).sort("year", -1)
            papers = await cursor.to_list(length=20)

            relevant_context = ""
            for paper in papers:
                for kp in paper.get("knowledgePoints", []):
                    if knowledge_point.lower() in kp.get("name", "").lower():
                        relevant_context += kp.get("content", "") + "\n"

            if not relevant_context:
                notebook_id = await self._get_or_create_subject_notebook(user_id, subject)
                try:
                    answer_result = await notebooklm_service.ask(
                        user_id, f"关于{knowledge_point}的真题题型和考点有哪些？"
                    )
                    relevant_context = answer_result.get("answer", "")
                except Exception:
                    pass

            questions = await self._llm_generate_questions(
                subject, knowledge_point, relevant_context, count
            )

            practice_doc = {
                "userId": user_id,
                "subject": subject,
                "knowledgePoint": knowledge_point,
                "questions": questions,
                "generatedAt": datetime.now(timezone.utc),
            }
            result = await db.db.practice_questions.insert_one(practice_doc)

            return {
                "success": True,
                "data": {
                    "practiceId": str(result.inserted_id),
                    "subject": subject,
                    "knowledgePoint": knowledge_point,
                    "questions": questions,
                },
            }
        except Exception as e:
            logger.error(f"generate_practice_questions failed: {e}")
            return {"success": False, "error": str(e)}

    async def _get_or_create_subject_notebook(
        self, user_id: str, subject: str
    ) -> str:
        mapping = await db.db.study_notebooks.find_one(
            {"user_id": user_id, "subject": subject}
        )
        if mapping and mapping.get("notebook_id"):
            return mapping["notebook_id"]

        from app.services.notebooklm_service import notebooklm_service
        result = await notebooklm_service._run_cli_json([
            "create", f"考研-{subject}-{user_id[:8]}",
        ])
        notebook_id = result.get("id") or result.get("notebook_id", "")
        if not notebook_id:
            raise RuntimeError(f"创建科目 Notebook 失败: {result}")

        await db.db.study_notebooks.update_one(
            {"user_id": user_id, "subject": subject},
            {
                "$set": {
                    "notebook_id": notebook_id,
                    "updated_at": datetime.now(timezone.utc),
                },
                "$setOnInsert": {
                    "sources": [],
                    "created_at": datetime.now(timezone.utc),
                },
            },
            upsert=True,
        )
        logger.info(
            f"Created subject notebook {notebook_id} for {subject}, user {user_id[:8]}"
        )
        return notebook_id

    async def _extract_knowledge_points(
        self, user_id: str, subject: str, notebook_id: str
    ) -> List[dict]:
        try:
            answer = await notebooklm_service.ask(
                user_id,
                f"请列出这份{subject}真题中涉及的所有知识点和题型，按重要程度排列。",
            )
            raw = answer.get("answer", "")

            config = await self._get_llm_config()
            if not config:
                return [{"name": "提取完成", "content": raw[:500]}]

            messages = [
                {
                    "role": "system",
                    "content": "你是一个考研真题分析专家。请将以下内容解析为结构化的知识点列表，每个知识点包含 name 和 content 字段。以 JSON 数组格式返回。",
                },
                {"role": "user", "content": raw},
            ]
            resp = await llm_service.chat_completion(
                messages=messages,
                model=config.model_id,
                api_key=config.api_key,
                api_base=config.api_base,
                temperature=0.3,
                max_tokens=2000,
            )
            content = resp.get("choices", [{}])[0].get("message", {}).get("content", "")

            try:
                start = content.find("[")
                end = content.rfind("]") + 1
                if start >= 0 and end > start:
                    return json.loads(content[start:end])
            except json.JSONDecodeError:
                pass

            return [{"name": f"{subject}真题分析", "content": content[:500]}]
        except Exception as e:
            logger.error(f"_extract_knowledge_points failed: {e}")
            return []

    async def _llm_analyze_trends(self, subject: str, trends: List[dict]) -> str:
        try:
            config = await self._get_llm_config()
            if not config:
                return "LLM 不可用，无法生成趋势分析"

            trends_text = json.dumps(trends, ensure_ascii=False, indent=2)
            messages = [
                {
                    "role": "system",
                    "content": f"你是一个考研{subject}真题分析专家。根据高频考点数据，给出备考建议和趋势分析。用中文回复，简洁有条理。",
                },
                {
                    "role": "user",
                    "content": f"以下是{subject}历年真题的高频考点统计:\n{trends_text}\n\n请分析趋势并给出备考建议。",
                },
            ]
            resp = await llm_service.chat_completion(
                messages=messages,
                model=config.model_id,
                api_key=config.api_key,
                api_base=config.api_base,
                temperature=0.7,
                max_tokens=1500,
            )
            return resp.get("choices", [{}])[0].get("message", {}).get("content", "")
        except Exception as e:
            logger.error(f"_llm_analyze_trends failed: {e}")
            return f"趋势分析生成失败: {e}"

    async def _llm_generate_questions(
        self,
        subject: str,
        knowledge_point: str,
        context: str,
        count: int,
    ) -> list:
        try:
            config = await self._get_llm_config()
            if not config:
                return []

            messages = [
                {
                    "role": "system",
                    "content": f"你是一个考研{subject}出题专家。请根据知识点和真题背景生成练习题。每道题包含 question、options(如有)、answer、explanation 字段。以 JSON 数组格式返回。",
                },
                {
                    "role": "user",
                    "content": (
                        f"知识点: {knowledge_point}\n"
                        f"真题背景: {context[:2000]}\n\n"
                        f"请生成 {count} 道练习题。"
                    ),
                },
            ]
            resp = await llm_service.chat_completion(
                messages=messages,
                model=config.model_id,
                api_key=config.api_key,
                api_base=config.api_base,
                temperature=0.8,
                max_tokens=3000,
            )
            content = resp.get("choices", [{}])[0].get("message", {}).get("content", "")

            try:
                start = content.find("[")
                end = content.rfind("]") + 1
                if start >= 0 and end > start:
                    return json.loads(content[start:end])
            except json.JSONDecodeError:
                pass

            return [
                {
                    "question": content[:300],
                    "answer": "请参考解析",
                    "explanation": content,
                }
            ]
        except Exception as e:
            logger.error(f"_llm_generate_questions failed: {e}")
            return []

    async def _get_llm_config(self) -> Optional[LLMConfig]:
        try:
            rows = await UserService.get_system_llm_configs()
            for row in rows:
                if not isinstance(row, dict):
                    continue
                if row.get("enabled") is False:
                    continue
                encrypted_key = row.get("api_key", "")
                api_key = encryption_service.decrypt(encrypted_key) if encrypted_key else ""
                model_id = str(row.get("model_id") or "").strip()
                base_url = str(row.get("base_url") or "").strip()
                provider_name = str(
                    row.get("id") or row.get("model_id") or row.get("name") or ""
                ).strip()
                if not provider_name or not model_id or not base_url or not api_key:
                    continue
                return LLMConfig(
                    name=str(row.get("name") or provider_name),
                    model_id=model_id,
                    api_key=api_key,
                    api_base=base_url,
                    timeout=60,
                )
        except Exception as e:
            logger.error(f"_get_llm_config failed: {e}")
        return None


exam_analysis_service = ExamAnalysisService()
