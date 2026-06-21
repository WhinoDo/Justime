"""
定时任务调度服务
每日学习提醒 + 复习提醒 + 周报
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import settings
from app.database import db
from app.services.feishu_service import feishu_service

logger = logging.getLogger(__name__)


class SchedulerService:
    """定时任务调度服务"""

    def __init__(self):
        self.scheduler = AsyncIOScheduler(timezone="Asia/Shanghai")
        self._started = False

    def start(self):
        if self._started:
            return
        if not feishu_service.is_configured:
            logger.info("SchedulerService skipped: Feishu not configured")
            return

        self.scheduler.add_job(
            self.send_daily_reminder,
            CronTrigger(hour=8, minute=0),
            id="daily_reminder",
            replace_existing=True,
        )
        self.scheduler.add_job(
            self.send_review_reminder,
            CronTrigger(hour=10, minute=0),
            id="review_reminder",
            replace_existing=True,
        )
        self.scheduler.add_job(
            self.send_daily_summary,
            CronTrigger(hour=22, minute=0),
            id="daily_summary",
            replace_existing=True,
        )
        self.scheduler.add_job(
            self.send_weekly_report,
            CronTrigger(day_of_week="sun", hour=20, minute=0),
            id="weekly_report",
            replace_existing=True,
        )

        self.scheduler.start()
        self._started = True
        logger.info("SchedulerService started with 4 jobs")

    def shutdown(self):
        if self._started:
            self.scheduler.shutdown(wait=False)
            self._started = False
            logger.info("SchedulerService shutdown")

    async def send_daily_reminder(self):
        """每日 8:00 发送今日学习任务提醒"""
        logger.info("send_daily_reminder triggered")
        cursor = db.db.study_profiles.find({"feishuOpenId": {"$exists": True, "$ne": ""}})
        async for profile in cursor:
            open_id = profile.get("feishuOpenId", "")
            user_id = profile.get("userId", "")
            if not open_id or not user_id:
                continue

            try:
                today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                tasks_cursor = db.db.study_tasks.find({
                    "userId": user_id,
                    "scheduledDate": {
                        "$gte": f"{today}T00:00:00",
                        "$lt": f"{today}T23:59:59",
                    },
                    "status": {"$ne": "completed"},
                }).sort("scheduledDate", 1)
                tasks = await tasks_cursor.to_list(length=20)

                if not tasks:
                    continue

                task_lines = []
                for t in tasks:
                    subj = t.get("subject", "")
                    title = t.get("title", "")
                    task_lines.append(f"- {subj}: {title}")

                card = {
                    "header": {
                        "title": {"tag": "plain_text", "content": "☀️ 今日学习任务"},
                    },
                    "elements": [
                        {
                            "tag": "div",
                            "text": {
                                "tag": "lark_md",
                                "content": "\n".join(task_lines),
                            },
                        },
                        {"tag": "hr"},
                        {
                            "tag": "action",
                            "actions": [
                                {
                                    "tag": "button",
                                    "text": {"tag": "plain_text", "content": "开始学习"},
                                    "type": "primary",
                                    "value": {"action": "start_study"},
                                }
                            ],
                        },
                    ],
                }
                await feishu_service.send_card_message(open_id, card)
            except Exception as e:
                logger.error("send_daily_reminder error for user %s: %s", user_id[:8], e)

    async def send_review_reminder(self):
        """每日 10:00 发送复习提醒（遗忘曲线）"""
        logger.info("send_review_reminder triggered")
        now = datetime.now(timezone.utc)
        cursor = db.db.review_schedules.find({
            "nextReview": {"$lte": now.isoformat()},
            "status": {"$ne": "completed"},
        })

        reminded_users = set()
        async for review in cursor:
            user_id = review.get("userId", "")
            if user_id in reminded_users:
                continue

            profile = await db.db.study_profiles.find_one({"userId": user_id})
            open_id = profile.get("feishuOpenId", "") if profile else ""
            if not open_id:
                continue

            pending_cursor = db.db.review_schedules.find({
                "userId": user_id,
                "nextReview": {"$lte": now.isoformat()},
                "status": {"$ne": "completed"},
            })
            pending = await pending_cursor.to_list(length=20)
            if not pending:
                continue

            lines = []
            for r in pending:
                subj = r.get("subject", "")
                topic = r.get("topic", "")
                lines.append(f"- {subj}: {topic}")

            try:
                card = {
                    "header": {
                        "title": {"tag": "plain_text", "content": "🔄 复习提醒"},
                    },
                    "elements": [
                        {
                            "tag": "div",
                            "text": {
                                "tag": "lark_md",
                                "content": f"你有 **{len(pending)}** 个知识点待复习:\n" + "\n".join(lines),
                            },
                        },
                        {"tag": "hr"},
                        {
                            "tag": "action",
                            "actions": [
                                {
                                    "tag": "button",
                                    "text": {"tag": "plain_text", "content": "开始复习"},
                                    "type": "primary",
                                    "value": {"action": "start_review"},
                                }
                            ],
                        },
                    ],
                }
                await feishu_service.send_card_message(open_id, card)
                reminded_users.add(user_id)
            except Exception as e:
                logger.error("send_review_reminder error for user %s: %s", user_id[:8], e)

    async def send_daily_summary(self):
        """每日 22:00 发送当日任务总结"""
        logger.info("send_daily_summary triggered")
        start_of_today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        cursor = db.db.users.find({"feishuOpenId": {"$exists": True, "$ne": ""}})
        async for user in cursor:
            open_id = user.get("feishuOpenId", "")
            user_id = str(user.get("_id", ""))
            if not open_id or not user_id:
                continue

            try:
                # 统计今日投入时长
                time_logs_cursor = db.db.evidence.find({
                    "userId": user_id,
                    "type": "time_log",
                    "createdAt": {"$gte": start_of_today}
                })
                total_hours = 0.0
                async for r in time_logs_cursor:
                    total_hours += float((r.get("metadata") or {}).get("hours") or 0.0)

                # 统计今日完成的里程碑数量
                milestones_done = await db.db.evidence.count_documents({
                    "userId": user_id,
                    "type": "milestone_complete",
                    "createdAt": {"$gte": start_of_today}
                })

                card = {
                    "header": {
                        "title": {"tag": "plain_text", "content": "🌙 今日任务进程总结"},
                    },
                    "elements": [
                        {
                            "tag": "div",
                            "text": {
                                "tag": "lark_md",
                                "content": (
                                    f"**时间投入**: {total_hours:.1f} 小时\n"
                                    f"**完成里程碑**: {milestones_done} 个"
                                ),
                            },
                        },
                    ],
                }
                await feishu_service.send_card_message(open_id, card)
            except Exception as e:
                logger.error("send_daily_summary error for user %s: %s", user_id[:8], e)

    async def send_weekly_report(self):
        """每周日 20:00 发送周度任务报告"""
        logger.info("send_weekly_report triggered")
        from datetime import timedelta
        start_of_week = datetime.utcnow() - timedelta(days=7)

        cursor = db.db.users.find({"feishuOpenId": {"$exists": True, "$ne": ""}})
        async for user in cursor:
            open_id = user.get("feishuOpenId", "")
            user_id = str(user.get("_id", ""))
            if not open_id or not user_id:
                continue

            try:
                # 统计过去 7 天投入时长
                time_logs_cursor = db.db.evidence.find({
                    "userId": user_id,
                    "type": "time_log",
                    "createdAt": {"$gte": start_of_week}
                })
                total_hours = 0.0
                async for r in time_logs_cursor:
                    total_hours += float((r.get("metadata") or {}).get("hours") or 0.0)

                # 统计过去 7 天完成的里程碑数量
                milestones_done = await db.db.evidence.count_documents({
                    "userId": user_id,
                    "type": "milestone_complete",
                    "createdAt": {"$gte": start_of_week}
                })

                # 统计新生成的知识产出数量
                knowledge_done = await db.db.knowledge_outputs.count_documents({
                    "userId": user_id,
                    "createdAt": {"$gte": start_of_week}
                })

                card = {
                    "header": {
                        "title": {"tag": "plain_text", "content": "📊 本周任务进程周报"},
                    },
                    "elements": [
                        {
                            "tag": "div",
                            "text": {
                                "tag": "lark_md",
                                "content": (
                                    f"**过去 7 天总投入时间**: {total_hours:.1f} 小时\n"
                                    f"**完成里程碑**: {milestones_done} 个\n"
                                    f"**沉淀知识库产出**: {knowledge_done} 篇"
                                ),
                            },
                        },
                    ],
                }
                await feishu_service.send_card_message(open_id, card)
            except Exception as e:
                logger.error("send_weekly_report error for user %s: %s", user_id[:8], e)


scheduler_service = SchedulerService()
