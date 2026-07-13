"""
飞书 Open API 封装服务
通过 feishu_cli 子进程调用 lark-oapi SDK
"""

import json
import logging
import asyncio
import os
import shutil
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class FeishuService:
    """飞书 Open API 封装服务"""

    def __init__(self):
        self._cli_path = settings.FEISHU_CLI_PATH
        self._available: Optional[bool] = None

    @property
    def is_configured(self) -> bool:
        if self._available is None:
            self._available = self._check_configured()
        return self._available

    def _check_configured(self) -> bool:
        if not settings.FEISHU_APP_ID or not settings.FEISHU_APP_SECRET:
            logger.warning("FeishuService not configured: FEISHU_APP_ID or FEISHU_APP_SECRET is empty")
            return False
        resolved = shutil.which(self._cli_path)
        if resolved is None:
            logger.warning("FeishuService not configured: feishu_cli not found at '%s'", self._cli_path)
            return False
        self._cli_path = resolved
        return True

    async def _run_cli(self, args: list, timeout: int = 30) -> dict:
        """调用飞书 CLI 并解析 JSON 输出"""
        env = os.environ.copy()
        env["FEISHU_APP_ID"] = settings.FEISHU_APP_ID
        env["FEISHU_APP_SECRET"] = settings.FEISHU_APP_SECRET

        cmd = [self._cli_path] + args + ["--json"]
        logger.debug("Running feishu_cli: %s", " ".join(cmd))

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout,
            )
        except asyncio.TimeoutError:
            process.kill()
            raise RuntimeError(f"feishu_cli 命令超时: {' '.join(args)}")

        stdout_text = (stdout or b"").decode("utf-8", errors="ignore").strip()
        stderr_text = (stderr or b"").decode("utf-8", errors="ignore").strip()

        if process.returncode != 0:
            logger.error("feishu_cli failed: %s", stderr_text or stdout_text)
            raise RuntimeError(stderr_text or stdout_text or f"feishu_cli 命令失败: {' '.join(args)}")

        try:
            parsed = json.loads(stdout_text)
        except (json.JSONDecodeError, TypeError) as exc:
            raise RuntimeError(f"feishu_cli 返回非 JSON 输出: {stdout_text[:300]}") from exc

        if not isinstance(parsed, dict) and not isinstance(parsed, list):
            raise RuntimeError(f"feishu_cli 返回 JSON 不是对象或数组: {type(parsed)}")

        return parsed

    async def get_tenant_access_token(self) -> str:
        result = await self._run_cli(["auth", "token"])
        token = result.get("token", "")
        if not token:
            raise RuntimeError("feishu_cli auth token 返回空 token")
        return token

    async def create_calendar_event(
        self,
        calendar_id: str,
        summary: str,
        start_time: str,
        end_time: str,
        description: str = "",
    ) -> dict:
        if not self.is_configured:
            return {"success": False, "error": "FeishuService is not configured"}

        args = [
            "calendar", "create",
            "--calendar-id", calendar_id,
            "--summary", summary,
            "--start", start_time,
            "--end", end_time,
        ]
        if description:
            args.extend(["--description", description])

        try:
            return await self._run_cli(args)
        except Exception as e:
            logger.error("create_calendar_event failed: %s", e)
            return {"success": False, "error": str(e)}

    async def query_calendar_events(
        self,
        calendar_id: str,
        start_time: str,
        end_time: str,
    ) -> list:
        if not self.is_configured:
            return []

        try:
            result = await self._run_cli([
                "calendar", "query",
                "--calendar-id", calendar_id,
                "--start", start_time,
                "--end", end_time,
            ])
            if isinstance(result, list):
                return result
            return []
        except Exception as e:
            logger.error("query_calendar_events failed: %s", e)
            return []

    async def update_calendar_event(
        self,
        calendar_id: str,
        event_id: str,
        **kwargs,
    ) -> dict:
        if not self.is_configured:
            return {"success": False, "error": "FeishuService is not configured"}

        args = [
            "calendar", "update",
            "--calendar-id", calendar_id,
            "--event-id", event_id,
        ]
        if "summary" in kwargs:
            args.extend(["--summary", kwargs["summary"]])
        if "description" in kwargs:
            args.extend(["--description", kwargs["description"]])
        if "start_time" in kwargs:
            args.extend(["--start", kwargs["start_time"]])
        if "end_time" in kwargs:
            args.extend(["--end", kwargs["end_time"]])

        try:
            return await self._run_cli(args)
        except Exception as e:
            logger.error("update_calendar_event failed: %s", e)
            return {"success": False, "error": str(e)}

    async def delete_calendar_event(
        self,
        calendar_id: str,
        event_id: str,
    ) -> dict:
        if not self.is_configured:
            return {"success": False, "error": "FeishuService is not configured"}

        try:
            return await self._run_cli([
                "calendar", "delete",
                "--calendar-id", calendar_id,
                "--event-id", event_id,
            ])
        except Exception as e:
            logger.error("delete_calendar_event failed: %s", e)
            return {"success": False, "error": str(e)}

    async def send_message(
        self,
        receive_id: str,
        msg_type: str,
        content: str,
        receive_id_type: str = "open_id",
    ) -> dict:
        if not self.is_configured:
            return {"success": False, "error": "FeishuService is not configured"}

        try:
            return await self._run_cli([
                "message", "send",
                "--receive-id", receive_id,
                "--msg-type", msg_type,
                "--content", content,
                "--receive-id-type", receive_id_type,
            ])
        except Exception as e:
            logger.error("send_message failed: %s", e)
            return {"success": False, "error": str(e)}

    async def send_card_message(
        self,
        receive_id: str,
        card: dict,
        receive_id_type: str = "open_id",
    ) -> dict:
        if not self.is_configured:
            return {"success": False, "error": "FeishuService is not configured"}

        card_json = json.dumps(card, ensure_ascii=False)
        try:
            return await self._run_cli([
                "message", "card",
                "--receive-id", receive_id,
                "--card", card_json,
                "--receive-id-type", receive_id_type,
            ])
        except Exception as e:
            logger.error("send_card_message failed: %s", e)
            return {"success": False, "error": str(e)}

    async def handle_message_event(self, event: dict) -> None:
        """处理飞书消息事件"""
        sender = event.get("sender", {})
        sender_id = sender.get("sender_id", {})
        open_id = sender_id.get("open_id", "")
        if not open_id:
            logger.warning("handle_message_event: missing sender open_id")
            return

        message = event.get("message", {})
        msg_type = message.get("message_type", "text")
        chat_id = message.get("chat_id", "")
        message_id = message.get("message_id", "")

        if msg_type == "text":
            content_str = message.get("content", "{}")
            try:
                content_obj = json.loads(content_str) if isinstance(content_str, str) else content_str
                text = content_obj.get("text", "")
            except (json.JSONDecodeError, AttributeError):
                text = str(content_str)
        elif msg_type == "interactive":
            action = event.get("action", {})
            text = json.dumps(action, ensure_ascii=False)
        else:
            text = message.get("content", "")

        if not text.strip():
            logger.info("handle_message_event: empty text from %s", open_id)
            return

        user_id = await self._resolve_user_id(open_id)
        if not user_id:
            logger.warning("handle_message_event: cannot resolve open_id=%s", open_id)
            bind_text = (
                f"⚠️ 您尚未绑定 Justime 账号，无法使用 AI 日程与学习助手功能。\n\n"
                f"您的飞书 OpenID 为：\n{open_id}\n\n"
                f"👉 绑定方法：\n"
                f"1. 登录 Justime 网页端；\n"
                f"2. 前往「个人信息」->「飞书账号绑定」；\n"
                f"3. 填入上述 OpenID 并点击绑定即可。"
            )
            await self.send_message(
                receive_id=open_id,
                msg_type="text",
                content=json.dumps({"text": bind_text}, ensure_ascii=False),
            )
            return

        try:
            from app.business.chat_business import chat_business
            from app.models.chat import ChatRequest

            sessions = await chat_business.get_user_sessions(user_id)
            if sessions:
                session_id = sessions[0]["id"]
            else:
                session_id = await chat_business.create_session(user_id, "飞书助手对话")

            chat_req = ChatRequest(
                message=text,
                sessionId=session_id
            )
            chat_res = await chat_business.process_chat(chat_req, user_id)

            if chat_res.success:
                response_text = chat_res.data.get("response", "")
                await self.send_message(
                    receive_id=open_id,
                    msg_type="text",
                    content=json.dumps({"text": response_text}, ensure_ascii=False),
                )
            else:
                error_msg = (chat_res.error or {}).get("message", "处理失败，请稍后重试")
                await self.send_message(
                    receive_id=open_id,
                    msg_type="text",
                    content=json.dumps({"text": f"⚠️ {error_msg}"}, ensure_ascii=False),
                )
        except Exception as e:
            logger.error(f"Failed to process Feishu message via chat_business: {e}", exc_info=True)
            await self.send_message(
                receive_id=open_id,
                msg_type="text",
                content=json.dumps({"text": "⚠️ 处理消息时发生系统错误，请稍后重试"}, ensure_ascii=False),
            )

    async def handle_calendar_event(self, event: dict) -> None:
        """处理飞书日程变更事件"""
        from app.database import db
        from datetime import datetime, timezone

        calendar_id = event.get("calendar", {}).get("calendar_id", "")
        feishu_event_id = event.get("event", {}).get("event_id", "")
        action_type = event.get("action_type", "")

        if not feishu_event_id:
            logger.warning("handle_calendar_event: missing event_id")
            return

        now = datetime.now(timezone.utc)
        
        # 获取原有日程文档以对比状态
        existing = await db.db["calendar_events"].find_one({"_id": feishu_event_id})
        old_status = existing.get("status") if existing else None

        update_data = {"updatedAt": now}

        if action_type == "delete":
            update_data["status"] = "cancelled"
        else:
            status = event.get("event", {}).get("status")
            if status:
                update_data["status"] = status

        await db.db["calendar_events"].update_one(
            {"_id": feishu_event_id},
            {"$set": update_data},
            upsert=True
        )

        new_status = update_data.get("status")
        if new_status == "completed" and old_status != "completed" and existing:
            user_id = existing.get("userId")
            task_id = existing.get("taskId")
            if user_id and task_id:
                from app.business.task_process_business import _task_process_business
                updated_doc = await db.db["calendar_events"].find_one({"_id": feishu_event_id})
                await _task_process_business.handle_calendar_event_status_change(user_id, old_status, new_status, updated_doc)

        logger.info("handle_calendar_event: synced %s for event %s", action_type, feishu_event_id)

    async def _resolve_user_id(self, open_id: str) -> Optional[str]:
        """将飞书 open_id 映射到系统 user_id"""
        from app.database import db
        doc = await db.db.users.find_one({"feishuOpenId": open_id})
        if doc:
            return str(doc["_id"])
        return None

    def build_study_summary_card(self, progress: dict) -> dict:
        """构建学习进度周报卡片"""
        total_hours = progress.get("totalHoursLast7Days", 0)
        breakdown = progress.get("subjectBreakdown", {})

        elements = [
            {
                "tag": "div",
                "text": {
                    "tag": "lark_md",
                    "content": f"**近7天学习时长**: {total_hours}小时",
                },
            }
        ]

        if breakdown:
            subject_lines = []
            for subj, hrs in breakdown.items():
                subject_lines.append(f"- {subj}: {hrs}小时")
            elements.append({
                "tag": "div",
                "text": {
                    "tag": "lark_md",
                    "content": "**科目分布**:\n" + "\n".join(subject_lines),
                },
            })

        plan = progress.get("currentPlan")
        if plan:
            elements.append({
                "tag": "div",
                "text": {
                    "tag": "lark_md",
                    "content": f"**当前计划**: {plan.get('planName', '进行中')}",
                },
            })

        elements.append({"tag": "hr"})
        elements.append({
            "tag": "action",
            "actions": [
                {
                    "tag": "button",
                    "text": {"tag": "plain_text", "content": "查看详细进度"},
                    "type": "primary",
                    "value": {"action": "view_progress"},
                }
            ],
        })

        return {
            "header": {
                "title": {"tag": "plain_text", "content": "📚 学习周报"},
            },
            "elements": elements,
        }

    def build_task_confirm_card(self, task: dict) -> dict:
        """构建任务完成确认卡片"""
        subject = task.get("subject", "")
        title = task.get("title", "")
        scheduled = task.get("scheduledDate", "")

        return {
            "header": {
                "title": {"tag": "plain_text", "content": f"✅ 任务完成确认"},
            },
            "elements": [
                {
                    "tag": "div",
                    "text": {
                        "tag": "lark_md",
                        "content": f"**科目**: {subject}\n**任务**: {title}\n**计划时间**: {scheduled}",
                    },
                },
                {"tag": "hr"},
                {
                    "tag": "action",
                    "actions": [
                        {
                            "tag": "button",
                            "text": {"tag": "plain_text", "content": "已完成"},
                            "type": "primary",
                            "value": {"action": "task_done", "taskId": str(task.get("id", ""))},
                        },
                        {
                            "tag": "button",
                            "text": {"tag": "plain_text", "content": "跳过"},
                            "type": "default",
                            "value": {"action": "task_skip", "taskId": str(task.get("id", ""))},
                        },
                    ],
                },
            ],
        }

    def build_plan_confirm_card(self, plan: dict) -> dict:
        """构建计划确认卡片"""
        plan_name = plan.get("planName", "学习计划")
        phases = plan.get("phases", [])

        elements = [
            {
                "tag": "div",
                "text": {
                    "tag": "lark_md",
                    "content": f"**计划名称**: {plan_name}",
                },
            }
        ]

        for i, phase in enumerate(phases[:5], 1):
            name = phase.get("phaseName", f"阶段{i}")
            goals = phase.get("goals", [])
            goal_str = "、".join(goals[:3]) if goals else ""
            elements.append({
                "tag": "div",
                "text": {
                    "tag": "lark_md",
                    "content": f"**{name}**: {goal_str}",
                },
            })

        elements.append({"tag": "hr"})
        elements.append({
            "tag": "action",
            "actions": [
                {
                    "tag": "button",
                    "text": {"tag": "plain_text", "content": "确认计划"},
                    "type": "primary",
                    "value": {"action": "plan_confirm", "planId": str(plan.get("id", ""))},
                },
                {
                    "tag": "button",
                    "text": {"tag": "plain_text", "content": "重新生成"},
                    "type": "default",
                    "value": {"action": "plan_regenerate"},
                },
            ],
        })

        return {
            "header": {
                "title": {"tag": "plain_text", "content": "📋 学习计划确认"},
            },
            "elements": elements,
        }


feishu_service = FeishuService()
