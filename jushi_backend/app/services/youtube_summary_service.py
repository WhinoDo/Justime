"""
YouTube 资源解析服务

负责:
- 解析并筛选日程资源中的 YouTube 链接
- 异步执行下载/提取音频/OSS 上传/Paraformer 转写/DeepSeek 总结
- 将结果按 URL 去重写入 work_documents
- 持久化任务状态到 youtube_summary_jobs
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
import shutil
import subprocess
import textwrap
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import httpx
from bson import ObjectId

from app.core.config import settings
from app.database import db
from app.services.encryption_service import encryption_service
from app.services.llm_service import llm_service


JOB_COLLECTION = "youtube_summary_jobs"
EVENT_COLLECTION = "calendar_events"
WORK_DOCUMENT_COLLECTION = "work_documents"


class YouTubeSummaryService:
    SUMMARY_MODEL = "deepseek-reasoner"
    TRANSCRIBE_MODEL = "paraformer-v2"
    ASR_TASK_POLL_INTERVAL_SECONDS = 2
    SECTION_HEADER = "## 参考资料解析"
    ALLOWED_YOUTUBE_DOMAINS = {
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "youtu.be",
        "www.youtu.be",
    }

    def __init__(self) -> None:
        self._running_tasks: Dict[str, asyncio.Task] = {}
        self._running_lock = threading.Lock()

    def register_task(self, job_id: str, task: asyncio.Task) -> None:
        with self._running_lock:
            self._running_tasks[job_id] = task

        def _cleanup(_: asyncio.Task) -> None:
            with self._running_lock:
                self._running_tasks.pop(job_id, None)

        task.add_done_callback(_cleanup)

    def is_youtube_url(self, url: str) -> bool:
        try:
            parsed = urlparse(url.strip())
        except Exception:
            return False
        if parsed.scheme not in {"http", "https"}:
            return False
        return parsed.netloc.lower() in self.ALLOWED_YOUTUBE_DOMAINS

    def extract_youtube_resources(
        self,
        resources: Optional[List[Dict[str, Any]]],
        resource_indexes: Optional[List[int]] = None,
    ) -> List[Dict[str, str]]:
        resources = resources or []
        selected: List[Dict[str, Any]] = []

        if resource_indexes is None:
            selected = resources
        else:
            for idx in resource_indexes:
                if isinstance(idx, int) and 0 <= idx < len(resources):
                    selected.append(resources[idx])

        result: List[Dict[str, str]] = []
        seen: set[str] = set()
        for item in selected:
            url = str((item or {}).get("url") or "").strip()
            if not url or not self.is_youtube_url(url):
                continue
            if url in seen:
                continue
            seen.add(url)
            title = str((item or {}).get("title") or "").strip() or "YouTube 资源"
            result.append({"url": url, "title": title})
        return result

    async def create_job(
        self,
        *,
        event_id: str,
        user_id: str,
        resources: List[Dict[str, str]],
    ) -> str:
        now = datetime.now(timezone.utc)
        job_doc = {
            "eventId": event_id,
            "userId": user_id,
            "status": "queued",
            "currentStage": "queued",
            "processedUrls": 0,
            "totalUrls": len(resources),
            "items": [
                {
                    "url": item["url"],
                    "title": item["title"],
                    "status": "queued",
                    "error": None,
                    "summarySectionMarkdown": None,
                }
                for item in resources
            ],
            "error": None,
            "documentEventId": event_id,
            "createdAt": now,
            "updatedAt": now,
            "startedAt": None,
            "completedAt": None,
        }
        insert_result = await db.db[JOB_COLLECTION].insert_one(job_doc)
        return str(insert_result.inserted_id)

    async def get_job(
        self,
        *,
        job_id: str,
        event_id: str,
        user_id: str,
    ) -> Optional[Dict[str, Any]]:
        try:
            oid = ObjectId(job_id)
        except Exception:
            return None
        return await db.db[JOB_COLLECTION].find_one(
            {"_id": oid, "eventId": event_id, "userId": user_id}
        )

    async def has_active_job(self, *, event_id: str, user_id: str) -> bool:
        doc = await db.db[JOB_COLLECTION].find_one(
            {
                "eventId": event_id,
                "userId": user_id,
                "status": {"$in": ["queued", "running"]},
            }
        )
        return doc is not None

    async def process_job(
        self,
        *,
        job_id: str,
        user_id: str,
        event_id: str,
    ) -> None:
        timeout_seconds = max(60, int(settings.YOUTUBE_JOB_TIMEOUT_SECONDS))
        try:
            await asyncio.wait_for(
                self._process_job_inner(job_id=job_id, user_id=user_id, event_id=event_id),
                timeout=timeout_seconds,
            )
        except asyncio.TimeoutError:
            await self._mark_job_failed(job_id, f"任务超时（超过 {timeout_seconds}s）")
        except Exception as exc:  # noqa: BLE001
            await self._mark_job_failed(job_id, f"任务执行失败: {exc}")

    async def _process_job_inner(self, *, job_id: str, user_id: str, event_id: str) -> None:
        job = await self.get_job(job_id=job_id, event_id=event_id, user_id=user_id)
        if not job:
            return

        summary_config = await self._resolve_summary_llm_config()
        asr_config = self._resolve_asr_config()
        oss_config = self._resolve_oss_config()
        await self._validate_runtime_dependencies(summary_config, asr_config, oss_config)

        await self._update_job(
            job_id,
            {
                "status": "running",
                "currentStage": "running/downloading",
                "startedAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc),
            },
        )

        output_root = Path(settings.YOUTUBE_SUMMARY_OUTPUT_DIR).expanduser().resolve()
        output_root.mkdir(parents=True, exist_ok=True)
        job_dir = output_root / job_id
        job_dir.mkdir(parents=True, exist_ok=True)

        total = int(job.get("totalUrls") or 0)
        success_count = 0
        fail_count = 0
        section_blocks: List[str] = []

        for idx, item in enumerate(job.get("items", [])):
            item_url = str(item.get("url") or "")
            item_title = str(item.get("title") or "YouTube 资源")
            item_dir = job_dir / f"url_{idx + 1}"
            item_dir.mkdir(parents=True, exist_ok=True)

            try:
                await self._set_item_status(job_id, idx, "running", None)
                await self._update_job(
                    job_id,
                    {"currentStage": "running/downloading", "updatedAt": datetime.now(timezone.utc)},
                )
                video_path = await self._download_video(item_url, item_dir)

                await self._update_job(
                    job_id,
                    {"currentStage": "running/extracting_audio", "updatedAt": datetime.now(timezone.utc)},
                )
                audio_path = item_dir / "audio.wav"
                await self._extract_audio(video_path, audio_path)
                if video_path.exists():
                    video_path.unlink(missing_ok=True)

                await self._update_job(
                    job_id,
                    {"currentStage": "running/uploading_audio", "updatedAt": datetime.now(timezone.utc)},
                )
                transcript = await self._transcribe_audio(
                    audio_path=audio_path,
                    job_id=job_id,
                    item_index=idx,
                    asr_config=asr_config,
                    oss_config=oss_config,
                )
                if audio_path.exists():
                    audio_path.unlink(missing_ok=True)

                await self._update_job(
                    job_id,
                    {"currentStage": "running/summarizing", "updatedAt": datetime.now(timezone.utc)},
                )
                summary_markdown = await self._summarize_transcript(
                    transcript,
                    item_title,
                    item_url,
                    summary_config,
                )

                section_block = self._build_summary_block(
                    url=item_url,
                    title=item_title,
                    summary_markdown=summary_markdown,
                    summary_model=summary_config["model_id"],
                )
                section_blocks.append(section_block)

                await self._set_item_summary(job_id, idx, section_block)
                await self._set_item_status(job_id, idx, "completed", None)
                success_count += 1
            except Exception as exc:  # noqa: BLE001
                fail_count += 1
                await self._set_item_status(job_id, idx, "failed", str(exc))
            finally:
                processed = success_count + fail_count
                await self._update_job(
                    job_id,
                    {
                        "processedUrls": processed,
                        "updatedAt": datetime.now(timezone.utc),
                    },
                )

        if section_blocks:
            await self._update_job(
                job_id,
                {"currentStage": "running/writing_document", "updatedAt": datetime.now(timezone.utc)},
            )
            await self._write_summary_to_work_document(
                user_id=user_id,
                event_id=event_id,
                blocks=section_blocks,
            )

        final_status = "completed"
        if success_count == 0 and total > 0:
            final_status = "failed"
        elif fail_count > 0:
            final_status = "completed_with_errors"

        await self._update_job(
            job_id,
            {
                "status": final_status,
                "currentStage": final_status,
                "completedAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc),
                "error": None if final_status != "failed" else "所有资源解析失败",
            },
        )

    async def _validate_runtime_dependencies(
        self,
        summary_config: Dict[str, str],
        asr_config: Dict[str, Any],
        oss_config: Dict[str, Any],
    ) -> None:
        missing = []
        if shutil.which("yt-dlp") is None:
            missing.append("yt-dlp")
        if shutil.which("ffmpeg") is None:
            missing.append("ffmpeg")
        try:
            import oss2  # type: ignore # noqa: F401
        except Exception:
            missing.append("oss2")

        if not asr_config.get("api_key"):
            missing.append("dashscope_api_key")
        if not asr_config.get("base_url"):
            missing.append("dashscope_base_url")
        if not asr_config.get("model_id"):
            missing.append("dashscope_asr_model")

        if not oss_config.get("endpoint"):
            missing.append("aliyun_oss_endpoint")
        if not oss_config.get("bucket"):
            missing.append("aliyun_oss_bucket")
        if not oss_config.get("access_key_id"):
            missing.append("aliyun_oss_access_key_id")
        if not oss_config.get("access_key_secret"):
            missing.append("aliyun_oss_access_key_secret")

        if not summary_config.get("api_key"):
            missing.append("summary_api_key")
        if not summary_config.get("base_url"):
            missing.append("summary_base_url")
        if not summary_config.get("model_id"):
            missing.append("summary_model_id")
        if missing:
            raise RuntimeError(f"运行依赖缺失: {', '.join(missing)}")

    async def _download_video(self, url: str, output_dir: Path) -> Path:
        output_template = str(output_dir / "video.%(ext)s")
        stdout = await self._run_command(
            [
                "yt-dlp",
                "--no-playlist",
                "--merge-output-format",
                "mp4",
                "-f",
                "bestvideo*+bestaudio/best",
                "-o",
                output_template,
                "--print",
                "after_move:filepath",
                url,
            ],
            timeout=900,
        )
        lines = [line.strip() for line in stdout.splitlines() if line.strip()]
        if not lines:
            raise RuntimeError("下载视频失败：未返回输出文件路径")
        video_path = Path(lines[-1]).expanduser().resolve()
        if not video_path.exists():
            raise RuntimeError("下载视频失败：输出文件不存在")
        return video_path

    async def _extract_audio(self, video_path: Path, audio_path: Path) -> None:
        await self._run_command(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(video_path),
                "-vn",
                "-ac",
                "1",
                "-ar",
                "16000",
                "-c:a",
                "pcm_s16le",
                "-f",
                "wav",
                str(audio_path),
            ],
            timeout=900,
        )
        if not audio_path.exists():
            raise RuntimeError("提取音频失败：音频文件未生成")

    async def _transcribe_audio(
        self,
        *,
        audio_path: Path,
        job_id: str,
        item_index: int,
        asr_config: Dict[str, Any],
        oss_config: Dict[str, Any],
    ) -> str:
        object_key = self._build_oss_object_key(job_id, item_index)
        signed_url = ""
        try:
            signed_url = await self._upload_audio_and_get_signed_url(
                audio_path=audio_path,
                object_key=object_key,
                oss_config=oss_config,
            )
            await self._update_job(
                job_id,
                {"currentStage": "running/asr_submitting", "updatedAt": datetime.now(timezone.utc)},
            )
            task_id = await self._submit_paraformer_task(
                file_urls=[signed_url],
                asr_config=asr_config,
            )

            await self._update_job(
                job_id,
                {"currentStage": "running/asr_polling", "updatedAt": datetime.now(timezone.utc)},
            )
            transcript = await self._poll_paraformer_result(task_id=task_id, asr_config=asr_config)
            if not transcript:
                raise RuntimeError("转写失败：文本为空")
            return transcript
        finally:
            # 解析链路使用临时对象，任务结束后立即清理。
            await self._delete_oss_object(object_key=object_key, oss_config=oss_config)

    async def _summarize_transcript(
        self,
        transcript: str,
        title: str,
        url: str,
        summary_config: Dict[str, str],
    ) -> str:
        chunks = self._split_text(transcript, max_chars=12000)
        chunk_notes: List[str] = []

        for chunk in chunks:
            response = await llm_service.chat_completion(
                messages=[
                    {
                        "role": "system",
                        "content": "你是内容分析助手。请用中文输出结构化结论。",
                    },
                    {
                        "role": "user",
                        "content": (
                            "请对下面转写片段做结构化整理，输出三部分：\n"
                            "1) 摘要（3-5条）\n"
                            "2) 重点内容解析（3-8条）\n"
                            "3) 行动项（2-5条）\n\n"
                            f"转写片段:\n{chunk}"
                        ),
                    },
                ],
                model=summary_config["model_id"],
                api_key=summary_config["api_key"],
                api_base=summary_config["base_url"],
                temperature=0.2,
                timeout=120,
            )
            content = self._extract_llm_text(response).strip()
            if not content:
                raise RuntimeError("总结失败：分段总结返回为空")
            chunk_notes.append(content)

        merged_notes = "\n\n".join(
            f"片段{i + 1}总结:\n{note}" for i, note in enumerate(chunk_notes)
        )

        final_resp = await llm_service.chat_completion(
            messages=[
                {
                    "role": "system",
                    "content": "你是内容分析助手。请用中文输出结构化 Markdown。",
                },
                {
                    "role": "user",
                    "content": (
                        "基于下面分段总结，生成最终内容。必须包含以下 markdown 三级标题:\n"
                        "### 摘要\n"
                        "### 重点内容解析\n"
                        "### 行动项\n\n"
                        f"资源标题: {title}\n"
                        f"资源链接: {url}\n\n"
                        f"{merged_notes}"
                    ),
                },
            ],
            model=summary_config["model_id"],
            api_key=summary_config["api_key"],
            api_base=summary_config["base_url"],
            temperature=0.2,
            timeout=120,
        )
        final_text = self._extract_llm_text(final_resp).strip()
        if not final_text:
            raise RuntimeError("总结失败：最终总结返回为空")
        return final_text

    def _build_summary_block(
        self,
        *,
        url: str,
        title: str,
        summary_markdown: str,
        summary_model: str,
    ) -> str:
        block_id = self._url_hash(url)
        timestamp = datetime.now(timezone.utc).isoformat()
        return textwrap.dedent(
            f"""
            <!-- YT_SUMMARY:{block_id} -->
            ### [{title}]({url})

            - 解析时间: {timestamp}
            - 总结模型: {summary_model}
            - 转写模型: {self.TRANSCRIBE_MODEL} (DashScope ASR)

            {summary_markdown}
            <!-- /YT_SUMMARY:{block_id} -->
            """
        ).strip()

    async def _write_summary_to_work_document(
        self,
        *,
        user_id: str,
        event_id: str,
        blocks: List[str],
    ) -> None:
        existing = await db.db[WORK_DOCUMENT_COLLECTION].find_one(
            {"eventId": event_id, "userId": user_id}
        )
        current_content = str((existing or {}).get("content") or "").strip()
        next_content = self._ensure_section_header(current_content)
        for block in blocks:
            next_content = self._upsert_block(next_content, block)

        now = datetime.now(timezone.utc)
        update_doc = {
            "$set": {
                "content": next_content,
                "lastSavedAt": now,
                "updatedAt": now,
            },
            "$setOnInsert": {
                "eventId": event_id,
                "userId": user_id,
                "createdAt": now,
            },
            "$inc": {"version": 1},
        }
        await db.db[WORK_DOCUMENT_COLLECTION].update_one(
            {"eventId": event_id, "userId": user_id},
            update_doc,
            upsert=True,
        )

    async def _set_item_status(
        self, job_id: str, index: int, status: str, error: Optional[str]
    ) -> None:
        await self._update_job(
            job_id,
            {
                f"items.{index}.status": status,
                f"items.{index}.error": error,
                "updatedAt": datetime.now(timezone.utc),
            },
        )

    async def _set_item_summary(self, job_id: str, index: int, markdown: str) -> None:
        await self._update_job(
            job_id,
            {
                f"items.{index}.summarySectionMarkdown": markdown,
                "updatedAt": datetime.now(timezone.utc),
            },
        )

    async def _mark_job_failed(self, job_id: str, error: str) -> None:
        await self._update_job(
            job_id,
            {
                "status": "failed",
                "currentStage": "failed",
                "error": str(error),
                "completedAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc),
            },
        )

    async def _update_job(self, job_id: str, set_fields: Dict[str, Any]) -> None:
        try:
            oid = ObjectId(job_id)
        except Exception:
            return
        await db.db[JOB_COLLECTION].update_one({"_id": oid}, {"$set": set_fields})

    async def _run_command(self, args: List[str], timeout: int) -> str:
        return await asyncio.to_thread(self._run_command_sync, args, timeout)

    def _run_command_sync(self, args: List[str], timeout: int) -> str:
        proc = subprocess.run(
            args,
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if proc.returncode != 0:
            stderr = (proc.stderr or proc.stdout or "").strip()
            raise RuntimeError(f"命令执行失败: {' '.join(args)}; 错误: {stderr[:500]}")
        return (proc.stdout or "").strip()

    def _ensure_section_header(self, content: str) -> str:
        stripped = content.strip()
        if self.SECTION_HEADER in stripped:
            return stripped
        if not stripped:
            return f"{self.SECTION_HEADER}\n"
        return f"{stripped}\n\n{self.SECTION_HEADER}\n"

    def _upsert_block(self, content: str, block: str) -> str:
        block_id = self._extract_block_id(block)
        if not block_id:
            return content

        start_marker = f"<!-- YT_SUMMARY:{block_id} -->"
        end_marker = f"<!-- /YT_SUMMARY:{block_id} -->"
        pattern = re.compile(
            rf"{re.escape(start_marker)}.*?{re.escape(end_marker)}",
            flags=re.DOTALL,
        )

        if pattern.search(content):
            return pattern.sub(block, content)

        if self.SECTION_HEADER not in content:
            return f"{content.rstrip()}\n\n{self.SECTION_HEADER}\n\n{block}\n"

        section_start = content.find(self.SECTION_HEADER)
        section_body_start = section_start + len(self.SECTION_HEADER)
        next_heading_match = re.search(r"\n##\s+", content[section_body_start:])
        if next_heading_match:
            insert_pos = section_body_start + next_heading_match.start()
            return (
                content[:insert_pos].rstrip()
                + "\n\n"
                + block
                + "\n\n"
                + content[insert_pos:].lstrip()
            )
        return f"{content.rstrip()}\n\n{block}\n"

    def _extract_block_id(self, block: str) -> Optional[str]:
        match = re.search(r"<!--\s*YT_SUMMARY:([a-f0-9]{40})\s*-->", block)
        if not match:
            return None
        return match.group(1)

    def _url_hash(self, url: str) -> str:
        return hashlib.sha1(url.encode("utf-8")).hexdigest()

    def _split_text(self, text: str, max_chars: int = 12000) -> List[str]:
        paragraphs = [line.strip() for line in text.splitlines() if line.strip()]
        if not paragraphs:
            return [text]
        chunks: List[str] = []
        current: List[str] = []
        current_len = 0
        for para in paragraphs:
            plus = len(para) + 1
            if current and current_len + plus > max_chars:
                chunks.append("\n".join(current))
                current = [para]
                current_len = len(para)
                continue
            current.append(para)
            current_len += plus
        if current:
            chunks.append("\n".join(current))
        return chunks

    def _extract_llm_text(self, response: Dict[str, Any]) -> str:
        choices = response.get("choices") or []
        if not choices:
            return ""
        message = choices[0].get("message") or {}
        content = message.get("content")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = []
            for part in content:
                if isinstance(part, dict) and part.get("type") == "text":
                    parts.append(str(part.get("text") or ""))
            return "\n".join(parts)
        return ""

    async def _resolve_summary_llm_config(self) -> Dict[str, str]:
        """
        优先从后台管理模型(system_llm_configs)读取 deepseek-reasoner；
        找不到时回退到环境变量。
        """
        rows = await db.db["system_llm_configs"].find({}).to_list(length=None)
        candidates: List[Dict[str, Any]] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            if row.get("enabled") is False:
                continue
            model_id = str(row.get("model_id") or "").strip()
            base_url = str(row.get("base_url") or "").strip()
            encrypted_key = str(row.get("api_key") or "").strip()
            api_key = encryption_service.decrypt(encrypted_key) if encrypted_key else ""
            if not model_id or not base_url or not api_key:
                continue
            candidates.append(
                {
                    "model_id": model_id,
                    "base_url": base_url,
                    "api_key": api_key,
                    "is_active": bool(row.get("is_active", False)),
                    "priority": int(row.get("priority", 100) or 100),
                }
            )

        reasoner_candidates = [
            c for c in candidates if str(c.get("model_id", "")).strip().lower() == self.SUMMARY_MODEL
        ]
        reasoner_candidates.sort(
            key=lambda c: (
                0 if c.get("is_active") else 1,
                int(c.get("priority", 100)),
            )
        )
        if reasoner_candidates:
            top = reasoner_candidates[0]
            return {
                "model_id": str(top["model_id"]),
                "base_url": str(top["base_url"]).rstrip("/"),
                "api_key": str(top["api_key"]),
            }

        # 环境变量兜底（固定 deepseek-reasoner）
        if settings.DEEPSEEK_API_KEY:
            return {
                "model_id": self.SUMMARY_MODEL,
                "base_url": settings.DEEPSEEK_BASE_URL.rstrip("/"),
                "api_key": settings.DEEPSEEK_API_KEY,
            }

        return {"model_id": "", "base_url": "", "api_key": ""}

    def _resolve_asr_config(self) -> Dict[str, Any]:
        return {
            "api_key": settings.DASHSCOPE_API_KEY,
            "base_url": settings.DASHSCOPE_BASE_URL.rstrip("/"),
            "model_id": settings.DASHSCOPE_ASR_MODEL or self.TRANSCRIBE_MODEL,
            "timeout_seconds": max(60, int(settings.DASHSCOPE_ASR_TIMEOUT_SECONDS)),
        }

    def _resolve_oss_config(self) -> Dict[str, Any]:
        endpoint = (settings.ALIYUN_OSS_ENDPOINT or "").strip()
        if endpoint and not endpoint.startswith(("http://", "https://")):
            endpoint = f"https://{endpoint}"
        return {
            "endpoint": endpoint.rstrip("/"),
            "bucket": (settings.ALIYUN_OSS_BUCKET or "").strip(),
            "access_key_id": (settings.ALIYUN_OSS_ACCESS_KEY_ID or "").strip(),
            "access_key_secret": (settings.ALIYUN_OSS_ACCESS_KEY_SECRET or "").strip(),
            "prefix": (settings.ALIYUN_OSS_PREFIX or "youtube-summary-temp").strip("/"),
            "signed_url_expires_seconds": max(60, int(settings.ALIYUN_OSS_SIGNED_URL_EXPIRES_SECONDS)),
        }

    def _build_oss_object_key(self, job_id: str, item_index: int) -> str:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
        unique = uuid.uuid4().hex[:8]
        return f"{job_id}/item_{item_index + 1}_{timestamp}_{unique}.wav"

    async def _upload_audio_and_get_signed_url(
        self,
        *,
        audio_path: Path,
        object_key: str,
        oss_config: Dict[str, Any],
    ) -> str:
        return await asyncio.to_thread(
            self._upload_audio_and_get_signed_url_sync,
            audio_path,
            object_key,
            oss_config,
        )

    def _upload_audio_and_get_signed_url_sync(
        self,
        audio_path: Path,
        object_key: str,
        oss_config: Dict[str, Any],
    ) -> str:
        import oss2  # type: ignore

        auth = oss2.Auth(oss_config["access_key_id"], oss_config["access_key_secret"])
        bucket = oss2.Bucket(auth, oss_config["endpoint"], oss_config["bucket"])
        prefix = oss_config["prefix"]
        oss_key = f"{prefix}/{object_key}" if prefix else object_key
        bucket.put_object_from_file(oss_key, str(audio_path))
        signed_url = bucket.sign_url("GET", oss_key, oss_config["signed_url_expires_seconds"])
        if not signed_url:
            raise RuntimeError("上传 OSS 成功但签名 URL 生成失败")
        return signed_url

    async def _delete_oss_object(self, *, object_key: str, oss_config: Dict[str, Any]) -> None:
        try:
            await asyncio.to_thread(self._delete_oss_object_sync, object_key, oss_config)
        except Exception:
            # 清理失败不影响主流程结果，避免覆盖原始业务错误。
            return

    def _delete_oss_object_sync(self, object_key: str, oss_config: Dict[str, Any]) -> None:
        import oss2  # type: ignore

        auth = oss2.Auth(oss_config["access_key_id"], oss_config["access_key_secret"])
        bucket = oss2.Bucket(auth, oss_config["endpoint"], oss_config["bucket"])
        prefix = oss_config["prefix"]
        oss_key = f"{prefix}/{object_key}" if prefix else object_key
        bucket.delete_object(oss_key)

    async def _submit_paraformer_task(self, *, file_urls: List[str], asr_config: Dict[str, Any]) -> str:
        payload = {
            "model": asr_config["model_id"],
            "input": {"file_urls": file_urls},
            "parameters": {"language_hints": ["zh", "en"]},
        }
        response = await self._http_post_json(
            url=f"{asr_config['base_url']}/services/audio/asr/transcription",
            headers={
                "Authorization": f"Bearer {asr_config['api_key']}",
                "Content-Type": "application/json",
            },
            payload=payload,
            timeout=min(60, asr_config["timeout_seconds"]),
        )
        task_id = self._extract_task_id(response)
        if not task_id:
            raise RuntimeError("提交 paraformer 任务失败：响应缺少 task_id")
        return task_id

    async def _poll_paraformer_result(self, *, task_id: str, asr_config: Dict[str, Any]) -> str:
        timeout_seconds = int(asr_config["timeout_seconds"])
        started = time.monotonic()

        while True:
            if time.monotonic() - started > timeout_seconds:
                raise RuntimeError(f"paraformer 任务超时（超过 {timeout_seconds}s）")

            response = await self._http_get_json(
                url=f"{asr_config['base_url']}/tasks/{task_id}",
                headers={
                    "Authorization": f"Bearer {asr_config['api_key']}",
                    "Content-Type": "application/json",
                },
                timeout=min(60, timeout_seconds),
            )
            status = self._extract_task_status(response)
            if status in {"SUCCEEDED", "SUCCESS"}:
                transcript = await self._extract_transcript_from_task_response(response)
                if not transcript:
                    raise RuntimeError("paraformer 转写成功但内容为空")
                return transcript
            if status in {"FAILED", "CANCELED", "CANCELLED"}:
                last_error = self._extract_task_error(response) or "未知错误"
                raise RuntimeError(f"paraformer 任务失败: {last_error}")

            await asyncio.sleep(self.ASR_TASK_POLL_INTERVAL_SECONDS)

    async def _extract_transcript_from_task_response(self, response: Dict[str, Any]) -> str:
        transcript_url = self._extract_transcription_url(response)
        if transcript_url:
            payload = await self._http_get_text_or_json(url=transcript_url, headers=None, timeout=60)
            return self._parse_asr_payload_text(payload)
        return self._parse_asr_payload_text(response)

    def _parse_asr_payload_text(self, payload: Any) -> str:
        texts = self._collect_candidate_texts(payload)
        # 去重并保持顺序，避免嵌套结构重复拼接。
        seen: set[str] = set()
        ordered: List[str] = []
        for item in texts:
            line = item.strip()
            if not line or line in seen:
                continue
            seen.add(line)
            ordered.append(line)
        return "\n".join(ordered).strip()

    def _collect_candidate_texts(self, payload: Any) -> List[str]:
        if isinstance(payload, str):
            stripped = payload.strip()
            if not stripped:
                return []
            if (stripped.startswith("{") and stripped.endswith("}")) or (
                stripped.startswith("[") and stripped.endswith("]")
            ):
                try:
                    parsed = json.loads(stripped)
                    return self._collect_candidate_texts(parsed)
                except Exception:
                    return [stripped]
            return [stripped]
        if isinstance(payload, list):
            result: List[str] = []
            for item in payload:
                result.extend(self._collect_candidate_texts(item))
            return result
        if not isinstance(payload, dict):
            return []

        result: List[str] = []
        for key in ("text", "transcript", "sentence"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                result.append(value.strip())

        for key in ("sentences", "segments", "results", "output", "data", "result", "transcription"):
            value = payload.get(key)
            if value is not None:
                result.extend(self._collect_candidate_texts(value))
        return result

    def _extract_task_id(self, payload: Dict[str, Any]) -> str:
        candidates = [
            payload.get("task_id"),
            (payload.get("output") or {}).get("task_id") if isinstance(payload.get("output"), dict) else None,
            (payload.get("data") or {}).get("task_id") if isinstance(payload.get("data"), dict) else None,
        ]
        for value in candidates:
            task_id = str(value or "").strip()
            if task_id:
                return task_id
        return ""

    def _extract_task_status(self, payload: Dict[str, Any]) -> str:
        output = payload.get("output") if isinstance(payload.get("output"), dict) else {}
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        raw = (
            payload.get("task_status")
            or payload.get("status")
            or output.get("task_status")
            or output.get("status")
            or data.get("task_status")
            or data.get("status")
        )
        return str(raw or "").strip().upper()

    def _extract_task_error(self, payload: Dict[str, Any]) -> str:
        for key in ("message", "error", "error_message"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        output = payload.get("output")
        if isinstance(output, dict):
            for key in ("message", "error", "error_message"):
                value = output.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
        return ""

    def _extract_transcription_url(self, payload: Dict[str, Any]) -> str:
        candidates: List[str] = []

        output = payload.get("output")
        if isinstance(output, dict):
            for key in ("transcription_url", "url"):
                value = output.get(key)
                if isinstance(value, str):
                    candidates.append(value)
            results = output.get("results")
            if isinstance(results, list):
                for item in results:
                    if isinstance(item, dict):
                        for key in ("transcription_url", "url"):
                            value = item.get(key)
                            if isinstance(value, str):
                                candidates.append(value)

        for candidate in candidates:
            value = candidate.strip()
            if value.startswith("http://") or value.startswith("https://"):
                return value
        return ""

    async def _http_post_json(
        self,
        *,
        url: str,
        headers: Dict[str, str],
        payload: Dict[str, Any],
        timeout: int,
    ) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            return resp.json()

    async def _http_get_json(
        self,
        *,
        url: str,
        headers: Dict[str, str],
        timeout: int,
    ) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            return resp.json()

    async def _http_get_text_or_json(
        self,
        *,
        url: str,
        headers: Optional[Dict[str, str]],
        timeout: int,
    ) -> Any:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            content_type = str(resp.headers.get("content-type") or "").lower()
            if "application/json" in content_type:
                return resp.json()
            text = (resp.text or "").strip()
            if not text:
                return ""
            try:
                return resp.json()
            except Exception:
                return text


youtube_summary_service = YouTubeSummaryService()
