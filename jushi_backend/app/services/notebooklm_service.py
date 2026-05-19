"""
NotebookLM 服务层
封装 notebooklm-py 客户端，提供统一异步接口，用于替代本地 LlamaIndex RAG 的检索/问答能力。
每个用户对应独立的 NotebookLM Notebook，文档同步上传到 Google NotebookLM 云端。
"""

import asyncio
import hashlib
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.database import db
from bson.errors import InvalidId

logger = logging.getLogger(__name__)

try:
    from notebooklm import NotebookLMClient, RPCError
except ImportError:
    NotebookLMClient = None
    RPCError = Exception
    logger.warning("notebooklm-py not installed, NotebookLM features will be unavailable")

# 客户端单例，在首次调用时惰性初始化
_client: Optional[Any] = None
_client_lock = asyncio.Lock()


async def _get_client() -> "NotebookLMClient":
    """获取或创建 NotebookLM 客户端单例（带 keepalive 保持 Cookie 刷新）。"""
    global _client
    if _client is not None and _client.is_connected:
        return _client

    async with _client_lock:
        if _client is not None and _client.is_connected:
            return _client

        if NotebookLMClient is None:
            raise RuntimeError("notebooklm-py 未安装，请运行 pip install 'notebooklm-py[browser]'")

        storage_path = settings.NOTEBOOKLM_STORAGE_PATH or None
        profile = settings.NOTEBOOKLM_PROFILE or None

        client = await NotebookLMClient.from_storage(
            path=storage_path,
            profile=profile,
            keepalive=300.0,
        )
        await client.__aenter__()
        _client = client
        logger.info("NotebookLM client initialized successfully")
        return _client


async def close_client() -> None:
    """关闭 NotebookLM 客户端。应用关闭时调用。"""
    global _client
    if _client is not None:
        try:
            await _client.__aexit__(None, None, None)
        except Exception as e:
            logger.warning(f"Error closing NotebookLM client: {e}")
        _client = None


class NotebookLMService:
    """封装 NotebookLM 操作，每用户独立 Notebook。"""

    # ── Notebook 生命周期 ──────────────────────────────────────

    async def get_or_create_notebook(self, user_id: str) -> str:
        """获取用户对应的 Notebook ID，不存在则创建并持久化映射到 MongoDB。"""
        user = await db.db.users.find_one({"_id": _to_object_id(user_id)})
        notebook_id = (user or {}).get("notebooklm_notebook_id")

        if notebook_id:
            try:
                client = await _get_client()
                await client.notebooks.get(notebook_id)
                return notebook_id
            except (RPCError, ValueError, TypeError) as e:
                logger.warning(f"Notebook {notebook_id} not found, will create a new one: {e}")

        client = await _get_client()
        nb = await client.notebooks.create(f"Jushi-{user_id[:8]}")
        notebook_id = nb.id

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

    # ── Source 管理 ────────────────────────────────────────────

    async def upload_source(self, user_id: str, file_path: Path) -> Dict[str, Any]:
        """将本地文件作为 source 添加到用户的 Notebook。"""
        notebook_id = await self.get_or_create_notebook(user_id)
        client = await _get_client()

        try:
            source = await client.sources.add_file(notebook_id, file_path)
        except RPCError as e:
            logger.error(f"Failed to upload source to NotebookLM: {e}")
            raise RuntimeError(f"NotebookLM 上传失败: {e}") from e

        source_record = {
            "filename": file_path.name,
            "source_id": source.id,
            "source_title": source.title,
            "synced_at": datetime.now(timezone.utc).isoformat(),
        }

        await db.db.users.update_one(
            {"_id": _to_object_id(user_id)},
            {"$push": {"notebooklm_sources": source_record}},
        )
        logger.info(f"Uploaded source {file_path.name} → {source.id} for user {user_id[:8]}")
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

        client = await _get_client()
        try:
            await client.sources.delete(notebook_id, target["source_id"])
        except RPCError as e:
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
        client = await _get_client()
        sources = await client.sources.list(notebook_id)
        return [
            {
                "source_id": s.id,
                "title": s.title,
                "kind": str(s.kind),
                "is_ready": s.is_ready,
            }
            for s in sources
        ]

    async def sync_all_sources(self, user_id: str, docs_dir: Path) -> str:
        """将本地文档目录的所有文件同步到 NotebookLM（用于重建索引场景）。"""
        notebook_id = await self.get_or_create_notebook(user_id)
        client = await _get_client()

        # 清除 Notebook 中的旧 source
        existing_sources = await client.sources.list(notebook_id)
        for src in existing_sources:
            try:
                await client.sources.delete(notebook_id, src.id)
            except Exception as e:
                logger.warning(f"Failed to delete old source {src.id}: {e}")

        # 上传目录下所有文件
        new_records = []
        if docs_dir.exists():
            for file_path in docs_dir.iterdir():
                if file_path.is_file() and not file_path.name.startswith("."):
                    try:
                        source = await client.sources.add_file(notebook_id, file_path)
                        new_records.append({
                            "filename": file_path.name,
                            "source_id": source.id,
                            "source_title": source.title,
                            "synced_at": datetime.now(timezone.utc).isoformat(),
                        })
                    except Exception as e:
                        logger.warning(f"Failed to upload {file_path.name}: {e}")

        await db.db.users.update_one(
            {"_id": _to_object_id(user_id)},
            {"$set": {"notebooklm_sources": new_records}},
        )
        return f"已同步 {len(new_records)} 个文件到 NotebookLM"

    # ── 问答 ──────────────────────────────────────────────────

    async def ask(self, user_id: str, question: str) -> Dict[str, Any]:
        """向用户 Notebook 提问，返回 answer + 结构化引用。"""
        notebook_id = await self.get_or_create_notebook(user_id)
        client = await _get_client()

        try:
            result = await client.chat.ask(notebook_id, question)
        except RPCError as e:
            logger.error(f"NotebookLM ask failed: {e}")
            return {"answer": f"NotebookLM 查询出错: {e}", "references": []}

        # 转换引用为项目统一格式
        references = []
        user = await db.db.users.find_one({"_id": _to_object_id(user_id)})
        source_map = {
            s.get("source_id"): s
            for s in (user or {}).get("notebooklm_sources", [])
        }

        for ref in (result.references or []):
            source_info = source_map.get(ref.source_id, {})
            filename = source_info.get("filename", ref.source_id)
            snippet = (ref.cited_text or "").strip()
            reference_seed = f"{filename}|{ref.source_id}"
            reference_id = hashlib.sha1(reference_seed.encode("utf-8")).hexdigest()

            # 合并到已有文件引用或新增
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
            "answer": result.answer,
            "references": references,
        }

    # ── 高级能力（音频/视频/摘要等）────────────────────────────

    async def generate_audio(self, user_id: str, instructions: str = "") -> Dict[str, Any]:
        """生成音频概览（播客）。"""
        notebook_id = await self.get_or_create_notebook(user_id)
        client = await _get_client()
        status = await client.artifacts.generate_audio(notebook_id, instructions=instructions)
        final = await client.artifacts.wait_for_completion(notebook_id, status.task_id, timeout=600)
        return {
            "task_id": status.task_id,
            "is_complete": final.is_complete,
            "url": final.url,
            "status": final.status,
        }

    async def get_notebook_summary(self, user_id: str) -> str:
        """获取 Notebook 的 AI 生成摘要。"""
        notebook_id = await self.get_or_create_notebook(user_id)
        client = await _get_client()
        return await client.notebooks.get_summary(notebook_id)


# ── 工具函数 ──────────────────────────────────────────────────

def _to_object_id(user_id: str):
    """将字符串 user_id 转为 MongoDB ObjectId。"""
    from bson import ObjectId
    try:
        return ObjectId(user_id)
    except (InvalidId, TypeError, ValueError):
        return user_id


# 全局实例
notebooklm_service = NotebookLMService()
