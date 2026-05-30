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
        """每日 22:00 发送当日学习统计"""
        logger.info("send_daily_summary triggered")
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        cursor = db.db.study_profiles.find({"feishuOpenId": {"$exists": True, "$ne": ""}})
        async for profile in cursor:
            open_id = profile.get("feishuOpenId", "")
            user_id = profile.get("userId", "")
            if not open_id or not user_id:
                continue

            try:
                progress_cursor = db.db.study_progress.find({
                    "userId": user_id,
                    "date": {"$gte": f"{today}T00:00:00"},
                })
                records = await progress_cursor.to_list(length=100)
                total_hours = sum(r.get("actualHours", 0) for r in records)

                tasks_done = await db.db.study_tasks.count_documents({
                    "userId": user_id,
                    "status": "completed",
                    "completedAt": {"$gte": f"{today}T00:00:00"},
                })
                tasks_total = await db.db.study_tasks.count_documents({
                    "userId": user_id,
                    "scheduledDate": {
                        "$gte": f"{today}T00:00:00",
                        "$lt": f"{today}T23:59:59",
                    },
                })

                card = {
                    "header": {
                        "title": {"tag": "plain_text", "content": "🌙 今日学习总结"},
                    },
                    "elements": [
                        {
                            "tag": "div",
                            "text": {
                                "tag": "lark_md",
                                "content": (
                                    f"**学习时长**: {total_hours:.1f}小时\n"
                                    f"**任务完成**: {tasks_done}/{tasks_total}"
                                ),
                            },
                        },
                    ],
                }
                await feishu_service.send_card_message(open_id, card)
            except Exception as e:
                logger.error("send_daily_summary error for user %s: %s", user_id[:8], e)

    async def send_weekly_report(self):
        """每周日 20:00 发送周度学习报告"""
        logger.info("send_weekly_report triggered")
        from app.business.study_agent_business import study_agent_business

        cursor = db.db.study_profiles.find({"feishuOpenId": {"$exists": True, "$ne": ""}})
        async for profile in cursor:
            open_id = profile.get("feishuOpenId", "")
            user_id = profile.get("userId", "")
            if not open_id or not user_id:
                continue

            try:
                progress = await study_agent_business.get_progress(user_id)
                card = feishu_service.build_study_summary_card(progress.get("data", {}))
                await feishu_service.send_card_message(open_id, card)
            except Exception as e:
                logger.error("send_weekly_report error for user %s: %s", user_id[:8], e)


scheduler_service = SchedulerService()
