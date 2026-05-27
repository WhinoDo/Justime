"""
知识库异步任务服务
支持异步索引重建，避免阻塞 API
"""

import asyncio
import logging
import time
import uuid
from typing import Any, Dict, Optional
from pathlib import Path

from app.core.redis_client import RedisClient

logger = logging.getLogger(__name__)

TASK_STATUS_PREFIX = "knowledge_task:"
TASK_TTL_SECONDS = 3600


class KnowledgeTaskService:
    def __init__(self):
        self._running_tasks: Dict[str, asyncio.Task] = {}

    def _task_key(self, task_id: str) -> str:
        return f"{TASK_STATUS_PREFIX}{task_id}"

    async def create_task_status(self, task_id: str, user_id: str) -> bool:
        status_data = {
            "task_id": task_id,
            "user_id": user_id,
            "status": "pending",
            "message": "索引重建任务已创建，等待执行",
            "created_at": time.time(),
            "started_at": None,
            "completed_at": None,
            "error": None,
        }
        return await RedisClient.set_json(self._task_key(task_id), status_data, ex=TASK_TTL_SECONDS)

    async def update_task_status(
        self,
        task_id: str,
        status: str,
        message: Optional[str] = None,
        error: Optional[str] = None,
    ) -> bool:
        existing = await RedisClient.get_json(self._task_key(task_id))
        if not existing:
            return False

        now = time.time()
        updates = {
            "status": status,
            "message": message or existing.get("message", ""),
            "error": error,
        }

        if status == "running" and existing.get("started_at") is None:
            updates["started_at"] = now
        elif status in ("completed", "failed"):
            updates["completed_at"] = now

        existing.update(updates)
        return await RedisClient.set_json(self._task_key(task_id), existing, ex=TASK_TTL_SECONDS)

    async def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        return await RedisClient.get_json(self._task_key(task_id))

    async def delete_task_status(self, task_id: str) -> int:
        return await RedisClient.delete(self._task_key(task_id))

    async def _execute_rebuild_async(
        self,
        task_id: str,
        user_id: str,
        docs_dir: Path,
    ):
        from app.services.rag_service import (
            rag_service,
            set_current_user_context,
            clear_current_user_context,
        )

        try:
            await self.update_task_status(task_id, "running", "正在重建索引...")

            loop = asyncio.get_event_loop()
            set_current_user_context(user_id)
            try:
                result = await loop.run_in_executor(
                    None,
                    rag_service.rebuild_index,
                    docs_dir,
                    False,
                )
            finally:
                clear_current_user_context()

            if result.startswith("重建索引失败") or result.startswith("文档目录"):
                await self.update_task_status(
                    task_id,
                    "failed",
                    result,
                    error=result,
                )
            else:
                await self.update_task_status(
                    task_id,
                    "completed",
                    result,
                )
        except Exception as e:
            error_msg = f"索引重建异常: {str(e)}"
            logger.error(error_msg)
            await self.update_task_status(
                task_id,
                "failed",
                error_msg,
                error=str(e),
            )
        finally:
            if task_id in self._running_tasks:
                del self._running_tasks[task_id]

    async def start_rebuild_task(
        self,
        user_id: str,
        docs_dir: Path,
    ) -> str:
        task_id = str(uuid.uuid4())
        await self.create_task_status(task_id, user_id)

        task = asyncio.create_task(
            self._execute_rebuild_async(task_id, user_id, docs_dir)
        )
        self._running_tasks[task_id] = task

        logger.info(f"Started async rebuild task {task_id} for user {user_id}")
        return task_id

    def is_task_running(self, task_id: str) -> bool:
        task = self._running_tasks.get(task_id)
        if task is None:
            return False
        return not task.done()

    async def cancel_task(self, task_id: str) -> bool:
        task = self._running_tasks.get(task_id)
        if task is None:
            return False

        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

        await self.update_task_status(
            task_id,
            "cancelled",
            "任务已被取消",
            error="User cancelled",
        )

        if task_id in self._running_tasks:
            del self._running_tasks[task_id]

        return True


knowledge_task_service = KnowledgeTaskService()