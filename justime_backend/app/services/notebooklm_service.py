"""
NotebookLM 服务层
通过 notebooklm CLI 子进程调用 Google NotebookLM，提供统一异步接口。
每个用户对应独立的 NotebookLM Notebook，文档同步上传到 Google NotebookLM 云端。
"""

import asyncio
import hashlib
import json
import logging
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.database import db

logger = logging.getLogger(__name__)


class NotebookLMService:
    """封装 NotebookLM 操作，通过 CLI 子进程调用。"""

    async def _validate_cli(self) -> None:
        """验证 CLI 是否可用。"""
        cli_path = shutil.which(settings.NOTEBOOKLM_CLI_PATH)
        if cli_path is None:
            raise RuntimeError("未找到 notebooklm CLI，请先安装 notebooklm-py")
        storage_path = Path.home() / ".notebooklm" / "storage_state.json"
        if not os.getenv("NOTEBOOKLM_AUTH_JSON") and not storage_path.exists():
            raise RuntimeError("未检测到 NotebookLM 登录态，请先执行 notebooklm login")
        try:
            await self._run_cli_text(["auth", "check"])
        except Exception as exc:
            raise RuntimeError(f"NotebookLM 认证检查失败: {exc}") from exc

    async def _run_cli_json(
        self,
        args: List[str],
        timeout: int = 60,
    ) -> Dict[str, Any]:
        """调用 notebooklm CLI (带 --json) 并解析 JSON 输出。"""
        json_args = list(args) + ["--json"]
        stdout = await self._run_cli_text(json_args, timeout=timeout)
        try:
            parsed = json.loads(stdout)
        except Exception as exc:
            raise RuntimeError(f"NotebookLM 返回非 JSON 输出: {stdout[:300]}") from exc
        if not isinstance(parsed, dict):
            raise RuntimeError("NotebookLM 返回 JSON 不是对象")
        return parsed

    async def _run_cli_text(
        self,
        args: List[str],
        timeout: int = 60,
    ) -> str:
        """调用 notebooklm CLI 并返回文本输出。"""
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
                timeout=max(30, timeout),
            )
        except asyncio.TimeoutError as exc:
            process.kill()
            raise RuntimeError(f"NotebookLM 命令超时: {' '.join(args)}") from exc

        stdout_text = (stdout or b"").decode("utf-8", errors="ignore").strip()
        stderr_text = (stderr or b"").decode("utf-8", errors="ignore").strip()
        if process.returncode != 0:
            raise RuntimeError(stderr_text or stdout_text or f"NotebookLM 命令失败: {' '.join(args)}")
        return stdout_text

    async def get_or_create_notebook(self, user_id: str) -> str:
        """获取用户对应的 Notebook ID，不存在则创建并持久化映射到 MongoDB。"""
        user = await db.db.users.find_one({"_id": _to_object_id(user_id)})
        notebook_id = (user or {}).get("notebooklm_notebook_id")

        if notebook_id:
            try:
                result = await self._run_cli_json(["list"])
                notebooks = result.get("notebooks", [])
                for nb in notebooks:
                    if nb.get("id") == notebook_id:
                        return notebook_id
                logger.warning(f"Notebook {notebook_id} not found in list, will create a new one")
            except Exception:
                logger.warning(f"Notebook list check failed, assuming {notebook_id} still exists")
                return notebook_id

        result = await self._run_cli_json([
            "create", f"Justime-{user_id[:8]}",
        ])
        nb_data = result.get("notebook", {})
        notebook_id = nb_data.get("id") or result.get("id") or result.get("notebook_id", "")
        if not notebook_id:
            raise RuntimeError(f"创建 Notebook 失败，CLI 返回: {result}")

        await db.db.users.update_one(
            {"_id": _to_object_id(user_id)},
            {
                "$set": {
                    "notebooklm_notebook_id": notebook_id,
                    "notebooklm_sources": [],
                }
            },
        )
        logger.info(f"Created NotebookLM notebook {notebook_id} for user {user_id[:8]}")
        return notebook_id

    async def upload_source(self, user_id: str, file_path: Path) -> Dict[str, Any]:
        """将本地文件作为 source 添加到用户的 Notebook。"""
        notebook_id = await self.get_or_create_notebook(user_id)

        result = await self._run_cli_json([
            "source", "add", str(file_path),
            "--type", "file",
            "-n", notebook_id,
        ], timeout=settings.BOOK_ANALYSIS_SOURCE_ADD_TIMEOUT_SECONDS)

        src_data = result.get("source", {})
        source_id = src_data.get("id") or result.get("id") or result.get("source_id", "")
        source_title = src_data.get("title") or result.get("title", file_path.name)

        if source_id:
            try:
                await self._run_cli_json(
                    ["source", "wait", source_id,
                     "-n", notebook_id,
                     "--timeout", str(settings.BOOK_ANALYSIS_SOURCE_WAIT_TIMEOUT_SECONDS)],
                    timeout=settings.BOOK_ANALYSIS_SOURCE_WAIT_TIMEOUT_SECONDS,
                )
            except Exception as e:
                logger.warning(f"Source wait failed for {source_id}: {e}")

        source_record = {
            "filename": file_path.name,
            "source_id": source_id,
            "source_title": source_title,
            "synced_at": datetime.now(timezone.utc).isoformat(),
        }

        await db.db.users.update_one(
            {"_id": _to_object_id(user_id)},
            {"$push": {"notebooklm_sources": source_record}},
        )
        logger.info(f"Uploaded source {file_path.name} → {source_id} for user {user_id[:8]}")
        return source_record

    async def remove_source(self, user_id: str, filename: str) -> bool:
        """从 Notebook 中移除对应文件名的 source。"""
        user = await db.db.users.find_one({"_id": _to_object_id(user_id)})
        sources = (user or {}).get("notebooklm_sources", [])
        target = next((s for s in sources if s.get("filename") == filename), None)
        if not target:
            logger.warning(f"No NotebookLM source mapping found for {filename}")
            return False

        notebook_id = (user or {}).get("notebooklm_notebook_id")
        if not notebook_id:
            return False

        source_id = target.get("source_id", "")
        if source_id:
            try:
                await self._run_cli_text([
                    "source", "delete", source_id,
                    "-n", notebook_id,
                    "-y",
                ])
            except Exception as e:
                logger.warning(f"Failed to delete source from NotebookLM: {e}")

        await db.db.users.update_one(
            {"_id": _to_object_id(user_id)},
            {"$pull": {"notebooklm_sources": {"filename": filename}}},
        )
        logger.info(f"Removed source {filename} from NotebookLM for user {user_id[:8]}")
        return True

    async def list_sources(self, user_id: str) -> List[Dict[str, Any]]:
        """列出 Notebook 中所有 source。"""
        notebook_id = await self.get_or_create_notebook(user_id)
        result = await self._run_cli_json([
            "source", "list", "-n", notebook_id,
        ])

        raw_sources = result.get("sources", [])
        if isinstance(raw_sources, dict):
            raw_sources = [raw_sources]

        return [
            {
                "source_id": s.get("id", ""),
                "title": s.get("title", ""),
                "kind": str(s.get("type", "")),
                "is_ready": s.get("status") == "ready",
            }
            for s in raw_sources
        ]

    async def sync_all_sources(self, user_id: str, docs_dir: Path) -> str:
        """将本地文档目录的所有文件同步到 NotebookLM（用于重建索引场景）。"""
        notebook_id = await self.get_or_create_notebook(user_id)

        existing = await self.list_sources(user_id)
        for src in existing:
            source_id = src.get("source_id", "")
            if source_id:
                try:
                    await self._run_cli_text([
                        "source", "delete", source_id,
                        "-n", notebook_id,
                        "-y",
                    ])
                except Exception as e:
                    logger.warning(f"Failed to delete old source {source_id}: {e}")

        new_records = []
        if docs_dir.exists():
            for file_path in docs_dir.iterdir():
                if file_path.is_file() and not file_path.name.startswith("."):
                    try:
                        result = await self._run_cli_json([
                            "source", "add", str(file_path),
                            "--type", "file",
                            "-n", notebook_id,
                        ], timeout=settings.BOOK_ANALYSIS_SOURCE_ADD_TIMEOUT_SECONDS)

                        src_data = result.get("source", {})
                        source_id = src_data.get("id") or result.get("id") or result.get("source_id", "")
                        source_title = src_data.get("title") or result.get("title", file_path.name)

                        if source_id:
                            try:
                                await self._run_cli_json(
                                    ["source", "wait", source_id,
                                     "-n", notebook_id,
                                     "--timeout", str(settings.BOOK_ANALYSIS_SOURCE_WAIT_TIMEOUT_SECONDS)],
                                    timeout=settings.BOOK_ANALYSIS_SOURCE_WAIT_TIMEOUT_SECONDS,
                                )
                            except Exception as e:
                                logger.warning(f"Source wait failed for {source_id}: {e}")

                        new_records.append({
                            "filename": file_path.name,
                            "source_id": source_id,
                            "source_title": source_title,
                            "synced_at": datetime.now(timezone.utc).isoformat(),
                        })
                    except Exception as e:
                        logger.warning(f"Failed to upload {file_path.name}: {e}")

        await db.db.users.update_one(
            {"_id": _to_object_id(user_id)},
            {"$set": {"notebooklm_sources": new_records}},
        )
        return f"已同步 {len(new_records)} 个文件到 NotebookLM"

    async def ask(self, user_id: str, question: str) -> Dict[str, Any]:
        """向用户 Notebook 提问，返回 answer + 结构化引用。"""
        notebook_id = await self.get_or_create_notebook(user_id)

        try:
            result = await self._run_cli_json([
                "ask", question, "-n", notebook_id,
            ])
        except Exception as e:
            logger.error(f"NotebookLM ask failed: {e}")
            return {"answer": f"NotebookLM 查询出错: {e}", "references": []}

        answer = result.get("answer", "")
        raw_references = result.get("references", [])

        references = []
        user = await db.db.users.find_one({"_id": _to_object_id(user_id)})
        source_map = {
            s.get("source_id"): s
            for s in (user or {}).get("notebooklm_sources", [])
        }

        for ref in raw_references:
            if isinstance(ref, str):
                continue
            if not isinstance(ref, dict):
                continue
            ref_source_id = ref.get("source_id", "")
            source_info = source_map.get(ref_source_id, {})
            filename = source_info.get("filename", ref_source_id)
            snippet = (ref.get("cited_text") or ref.get("text") or "").strip()
            reference_seed = f"{filename}|{ref_source_id}"
            reference_id = hashlib.sha1(reference_seed.encode("utf-8")).hexdigest()

            existing = next((r for r in references if r["fileName"] == filename), None)
            if existing:
                existing["score"] = max(existing["score"], 1.0)
                if snippet and snippet not in existing["snippets"]:
                    existing["snippets"].append(snippet)
            else:
                references.append({
                    "referenceId": reference_id,
                    "docPath": filename,
                    "fileName": filename,
                    "score": 1.0,
                    "snippets": [snippet] if snippet else [],
                    "queries": [question],
                })

        return {
            "answer": answer,
            "references": references,
        }

    async def generate_audio(self, user_id: str, instructions: str = "") -> Dict[str, Any]:
        """生成音频概览（播客）。"""
        notebook_id = await self.get_or_create_notebook(user_id)
        args = ["generate", "audio"]
        if instructions:
            args.append(instructions)
        args.extend(["-n", notebook_id, "--wait"])

        result = await self._run_cli_json(args, timeout=600)

        return {
            "task_id": result.get("task_id", ""),
            "is_complete": result.get("status") == "completed",
            "url": result.get("url", ""),
            "status": result.get("status", "pending"),
        }

    async def get_notebook_summary(self, user_id: str) -> str:
        """获取 Notebook 的 AI 生成摘要。"""
        notebook_id = await self.get_or_create_notebook(user_id)
        result = await self._run_cli_json([
            "generate", "report",
            "--format", "study-guide",
            "-n", notebook_id,
            "--wait",
        ], timeout=300)
        return result.get("content") or result.get("text") or result.get("summary", "")


def _to_object_id(user_id: str):
    """将字符串 user_id 转为 MongoDB ObjectId。"""
    from bson import ObjectId
    try:
        return ObjectId(user_id)
    except Exception:
        return user_id


notebooklm_service = NotebookLMService()
