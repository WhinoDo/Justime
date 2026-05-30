"""
学习报告生成服务
周报/月报/考前冲刺计划，聚合 study_progress 数据并利用 LLM 生成分析建议
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.database import db
from app.services.llm_service import llm_service
from app.services.feishu_service import feishu_service
from app.services.user_service import UserService
from app.services.encryption_service import encryption_service
from app.core.config import LLMConfig, settings

logger = logging.getLogger(__name__)


class StudyReportService:

    async def generate_weekly_report(self, user_id: str) -> dict:
        try:
            now = datetime.now(timezone.utc)
            week_ago = now - timedelta(days=7)
            two_weeks_ago = now - timedelta(days=14)

            current_records = await self._get_progress_records(
                user_id, week_ago, now
            )
            previous_records = await self._get_progress_records(
                user_id, two_weeks_ago, week_ago
            )

            current_stats = self._aggregate_records(current_records)
            previous_stats = self._aggregate_records(previous_records)

            completion_rates = await self._get_completion_rates(user_id, week_ago, now)

            changes = self._compute_changes(current_stats, previous_stats)

            llm_analysis = await self._llm_generate_report(
                user_id,
                period="本周",
                current_stats=current_stats,
                previous_stats=previous_stats,
                changes=changes,
                completion_rates=completion_rates,
            )

            report_doc = {
                "userId": user_id,
                "reportType": "weekly",
                "periodStart": week_ago.isoformat(),
                "periodEnd": now.isoformat(),
                "stats": current_stats,
                "changes": changes,
                "completionRates": completion_rates,
                "llmAnalysis": llm_analysis,
                "generatedAt": now,
            }
            result = await db.db.study_reports.insert_one(report_doc)

            return {
                "success": True,
                "data": {
                    "reportId": str(result.inserted_id),
                    "reportType": "weekly",
                    "periodStart": week_ago.isoformat(),
                    "periodEnd": now.isoformat(),
                    "stats": current_stats,
                    "changes": changes,
                    "completionRates": completion_rates,
                    "llmAnalysis": llm_analysis,
                },
            }
        except Exception as e:
            logger.error(f"generate_weekly_report failed: {e}")
            return {"success": False, "error": str(e)}

    async def generate_monthly_report(self, user_id: str) -> dict:
        try:
            now = datetime.now(timezone.utc)
            month_ago = now - timedelta(days=30)
            two_months_ago = now - timedelta(days=60)

            current_records = await self._get_progress_records(
                user_id, month_ago, now
            )
            previous_records = await self._get_progress_records(
                user_id, two_months_ago, month_ago
            )

            current_stats = self._aggregate_records(current_records)
            previous_stats = self._aggregate_records(previous_records)

            completion_rates = await self._get_completion_rates(user_id, month_ago, now)

            weekly_trend = await self._compute_weekly_trend(user_id, month_ago, now)

            changes = self._compute_changes(current_stats, previous_stats)

            llm_analysis = await self._llm_generate_report(
                user_id,
                period="本月",
                current_stats=current_stats,
                previous_stats=previous_stats,
                changes=changes,
                completion_rates=completion_rates,
                weekly_trend=weekly_trend,
            )

            report_doc = {
                "userId": user_id,
                "reportType": "monthly",
                "periodStart": month_ago.isoformat(),
                "periodEnd": now.isoformat(),
                "stats": current_stats,
                "changes": changes,
                "completionRates": completion_rates,
                "weeklyTrend": weekly_trend,
                "llmAnalysis": llm_analysis,
                "generatedAt": now,
            }
            result = await db.db.study_reports.insert_one(report_doc)

            return {
                "success": True,
                "data": {
                    "reportId": str(result.inserted_id),
                    "reportType": "monthly",
                    "periodStart": month_ago.isoformat(),
                    "periodEnd": now.isoformat(),
                    "stats": current_stats,
                    "changes": changes,
                    "completionRates": completion_rates,
                    "weeklyTrend": weekly_trend,
                    "llmAnalysis": llm_analysis,
                },
            }
        except Exception as e:
            logger.error(f"generate_monthly_report failed: {e}")
            return {"success": False, "error": str(e)}

    async def generate_sprint_plan(
        self, user_id: str, days_before_exam: int
    ) -> dict:
        try:
            profile = await db.db.study_profiles.find_one({"userId": user_id})
            if not profile:
                return {"success": False, "error": "请先创建考研配置"}

            exam_date = profile.get("examDate")
            subjects = profile.get("subjects", [])
            daily_hours = float(profile.get("dailyStudyHours", 8))

            now = datetime.now(timezone.utc)
            start_date = now
            end_date = now + timedelta(days=days_before_exam)

            progress_records = await self._get_progress_records(
                user_id, now - timedelta(days=30), now
            )
            subject_stats = self._aggregate_records(progress_records)

            weak_subjects = self._identify_weak_subjects(subject_stats, completion_threshold=0.6)

            pending_reviews = []
            cursor = db.db.review_schedules.find(
                {"userId": user_id, "nextReview": {"$lte": end_date.isoformat()}}
            ).sort("nextReview", 1)
            async for doc in cursor:
                pending_reviews.append(self._serialize(doc))

            sprint_plan = await self._llm_generate_sprint(
                user_id=user_id,
                subjects=subjects,
                weak_subjects=weak_subjects,
                days_before_exam=days_before_exam,
                daily_hours=daily_hours,
                subject_stats=subject_stats,
                pending_reviews=pending_reviews,
            )

            plan_doc = {
                "userId": user_id,
                "planType": "sprint",
                "daysBeforeExam": days_before_exam,
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat(),
                "subjects": subjects,
                "weakSubjects": weak_subjects,
                "sprintPlan": sprint_plan,
                "generatedAt": now,
            }
            result = await db.db.study_reports.insert_one(plan_doc)

            feishu_synced = False
            if sprint_plan and feishu_service.is_configured:
                feishu_synced = await self._sync_sprint_to_feishu(
                    user_id, sprint_plan
                )

            return {
                "success": True,
                "data": {
                    "reportId": str(result.inserted_id),
                    "planType": "sprint",
                    "daysBeforeExam": days_before_exam,
                    "startDate": start_date.isoformat(),
                    "endDate": end_date.isoformat(),
                    "weakSubjects": weak_subjects,
                    "sprintPlan": sprint_plan,
                    "feishuSynced": feishu_synced,
                },
            }
        except Exception as e:
            logger.error(f"generate_sprint_plan failed: {e}")
            return {"success": False, "error": str(e)}

    async def _get_progress_records(
        self, user_id: str, start: datetime, end: datetime
    ) -> List[dict]:
        cursor = db.db.study_progress.find(
            {
                "userId": user_id,
                "date": {"$gte": start.isoformat(), "$lt": end.isoformat()},
            }
        ).sort("date", -1)
        return await cursor.to_list(length=500)

    def _aggregate_records(self, records: List[dict]) -> dict:
        total_hours = 0.0
        subject_hours: Dict[str, float] = {}
        subject_count: Dict[str, int] = {}
        daily_hours: Dict[str, float] = {}

        for r in records:
            hours = float(r.get("actualHours", 0))
            subj = r.get("subject", "未知")
            date_str = r.get("date", "")[:10]

            total_hours += hours
            subject_hours[subj] = subject_hours.get(subj, 0) + hours
            subject_count[subj] = subject_count.get(subj, 0) + 1
            daily_hours[date_str] = daily_hours.get(date_str, 0) + hours

        active_days = len(daily_hours)
        avg_daily = round(total_hours / max(active_days, 1), 1)

        return {
            "totalHours": round(total_hours, 1),
            "activeDays": active_days,
            "avgDailyHours": avg_daily,
            "subjectHours": subject_hours,
            "subjectCount": subject_count,
            "dailyHours": daily_hours,
        }

    async def _get_completion_rates(
        self, user_id: str, start: datetime, end: datetime
    ) -> Dict[str, float]:
        pipeline = [
            {
                "$match": {
                    "userId": user_id,
                    "date": {"$gte": start.isoformat(), "$lt": end.isoformat()},
                }
            },
            {
                "$group": {
                    "_id": "$subject",
                    "plannedHours": {"$sum": "$plannedHours"},
                    "actualHours": {"$sum": "$actualHours"},
                }
            },
        ]
        results = await db.db.study_progress.aggregate(pipeline).to_list(length=20)

        rates = {}
        for r in results:
            subj = r["_id"] or "未知"
            planned = float(r.get("plannedHours", 0))
            actual = float(r.get("actualHours", 0))
            rate = actual / planned if planned > 0 else 0.0
            rates[subj] = round(min(rate, 1.0), 2)

        return rates

    def _compute_changes(self, current: dict, previous: dict) -> dict:
        def _pct_change(cur, prev):
            if prev == 0:
                return 0.0 if cur == 0 else 100.0
            return round((cur - prev) / prev * 100, 1)

        return {
            "totalHoursChange": _pct_change(
                current.get("totalHours", 0), previous.get("totalHours", 0)
            ),
            "activeDaysChange": current.get("activeDays", 0)
            - previous.get("activeDays", 0),
            "avgDailyHoursChange": round(
                current.get("avgDailyHours", 0) - previous.get("avgDailyHours", 0), 1
            ),
        }

    async def _compute_weekly_trend(
        self, user_id: str, start: datetime, end: datetime
    ) -> List[dict]:
        weeks = []
        current = start
        while current < end:
            week_end = min(current + timedelta(days=7), end)
            records = await self._get_progress_records(user_id, current, week_end)
            stats = self._aggregate_records(records)
            weeks.append(
                {
                    "weekStart": current.isoformat(),
                    "weekEnd": week_end.isoformat(),
                    "totalHours": stats["totalHours"],
                    "activeDays": stats["activeDays"],
                }
            )
            current = week_end
        return weeks

    def _identify_weak_subjects(
        self, stats: dict, completion_threshold: float = 0.6
    ) -> List[str]:
        weak = []
        subject_hours = stats.get("subjectHours", {})
        total_hours = stats.get("totalHours", 0)
        if total_hours == 0:
            return weak

        for subj, hours in subject_hours.items():
            ratio = hours / total_hours
            if ratio < (1.0 / max(len(subject_hours), 1)) * completion_threshold:
                weak.append(subj)
        return weak

    async def _llm_generate_report(
        self,
        user_id: str,
        period: str,
        current_stats: dict,
        previous_stats: dict,
        changes: dict,
        completion_rates: dict,
        weekly_trend: Optional[List[dict]] = None,
    ) -> str:
        try:
            config = await self._get_llm_config()
            if not config:
                return "LLM 不可用，无法生成分析"

            stats_text = json.dumps(
                {
                    "currentStats": current_stats,
                    "previousStats": previous_stats,
                    "changes": changes,
                    "completionRates": completion_rates,
                    "weeklyTrend": weekly_trend,
                },
                ensure_ascii=False,
                indent=2,
            )

            messages = [
                {
                    "role": "system",
                    "content": "你是考研学习分析专家。根据学习数据给出简洁、可执行的分析建议。用中文回复。",
                },
                {
                    "role": "user",
                    "content": f"以下是{period}学习数据:\n{stats_text}\n\n请给出分析建议，包括: 1.总体评价 2.各科目表现 3.改进建议",
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
            logger.error(f"_llm_generate_report failed: {e}")
            return f"报告分析生成失败: {e}"

    async def _llm_generate_sprint(
        self,
        user_id: str,
        subjects: list,
        weak_subjects: list,
        days_before_exam: int,
        daily_hours: float,
        subject_stats: dict,
        pending_reviews: list,
    ) -> dict:
        try:
            config = await self._get_llm_config()
            if not config:
                return {
                    "daily_plan": f"考前{days_before_exam}天冲刺计划",
                    "notes": "LLM 不可用，请手动安排",
                }

            context = json.dumps(
                {
                    "subjects": subjects,
                    "weakSubjects": weak_subjects,
                    "daysBeforeExam": days_before_exam,
                    "dailyHours": daily_hours,
                    "recentStats": subject_stats,
                    "pendingReviews": pending_reviews[:20],
                },
                ensure_ascii=False,
            )

            messages = [
                {
                    "role": "system",
                    "content": "你是考研冲刺规划专家。根据学生当前状态生成考前冲刺计划。以 JSON 格式返回，包含 daily_schedule (按天安排) 和 key_tips (关键建议) 字段。",
                },
                {
                    "role": "user",
                    "content": f"请生成考前{days_before_exam}天冲刺计划:\n{context}",
                },
            ]
            resp = await llm_service.chat_completion(
                messages=messages,
                model=config.model_id,
                api_key=config.api_key,
                api_base=config.api_base,
                temperature=0.7,
                max_tokens=3000,
            )
            content = resp.get("choices", [{}])[0].get("message", {}).get("content", "")

            try:
                start = content.find("{")
                end = content.rfind("}") + 1
                if start >= 0 and end > start:
                    return json.loads(content[start:end])
            except json.JSONDecodeError:
                pass

            return {
                "daily_plan": f"考前{days_before_exam}天冲刺计划",
                "raw_content": content[:2000],
            }
        except Exception as e:
            logger.error(f"_llm_generate_sprint failed: {e}")
            return {"error": str(e)}

    async def _sync_sprint_to_feishu(self, user_id: str, sprint_plan: dict) -> bool:
        calendar_id = settings.FEISHU_CALENDAR_ID
        if not calendar_id:
            return False

        daily_schedule = sprint_plan.get("daily_schedule", [])
        synced = 0

        for day_plan in daily_schedule[:14]:
            date_str = day_plan.get("date", "")
            summary = day_plan.get("summary", "考研冲刺")
            if not date_str:
                continue

            try:
                start_time = f"{date_str}T08:00:00"
                end_time = f"{date_str}T22:00:00"
                description = day_plan.get("detail", "")

                result = await feishu_service.create_calendar_event(
                    calendar_id=calendar_id,
                    summary=f"冲刺-{summary}",
                    start_time=start_time,
                    end_time=end_time,
                    description=description,
                )
                if result.get("success"):
                    synced += 1
            except Exception as e:
                logger.error(f"Failed to sync sprint day to Feishu: {e}")

        return synced > 0

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

    def _serialize(self, doc: dict) -> dict:
        if doc is None:
            return None
        data = dict(doc)
        if "_id" in data:
            data["id"] = str(data.pop("_id"))
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
        return data


study_report_service = StudyReportService()
