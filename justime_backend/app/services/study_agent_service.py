"""
考研学习 Agent 服务层
统筹飞书 + NotebookLM + 学习计划，基于 Smolagents CodeAgent
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.database import db
from app.services.agent_service import agent_service
from app.services.feishu_service import feishu_service
from app.services.notebooklm_service import notebooklm_service

try:
    from app.tools.feishu_tools import FEISHU_TOOLS
except Exception:
    FEISHU_TOOLS = []

try:
    from app.tools.notebooklm_tools import NOTEBOOKLM_TOOLS
except Exception:
    NOTEBOOKLM_TOOLS = []

try:
    from app.tools.study_tools import STUDY_TOOLS
except Exception:
    STUDY_TOOLS = []

logger = logging.getLogger(__name__)

STUDY_AGENT_SYSTEM_PROMPT = """你是「矩时」考研学习助手，帮助用户高效备考。

## 核心能力
1. **学习计划制定** — 根据目标院校、考试科目、剩余时间制定个性化计划
2. **任务分配与提醒** — 将计划写入飞书日程，到期自动提醒
3. **知识库问答** — 从上传的学习资料中检索答案
4. **进度追踪** — 记录每日学习完成情况，动态调整计划
5. **复习调度** — 基于遗忘曲线安排复习节点
6. **真题趋势分析** — 分析历年真题高频考点和出题规律
7. **学习报告** — 生成周报/月报，给出改进建议
8. **考前冲刺** — 根据当前进度生成考前冲刺计划

## 工具使用规则
- 涉及日程安排 → 调用飞书日历工具
- 涉及知识点查询 → 调用 NotebookLM 工具
- 涉及计划制定 → 先查进度，再生成计划，最后写入日程
- 涉及进度查询 → 查询 MongoDB 学习记录
- 涉及真题分析 → 调用 analyze_exam_trends 工具
- 涉及学习报告 → 调用 generate_weekly_report 工具
- 涉及冲刺计划 → 调用 create_sprint_plan 工具

## 回复风格
- 简洁、有条理
- 给出可执行的建议，而非泛泛而谈
- 主动提醒关键时间节点
"""

_INTENT_PATTERNS = {
    "create_plan": ["制定计划", "学习计划", "帮我规划", "安排学习", "制定方案", "备考计划"],
    "daily_task": ["今日任务", "今天学什么", "今日安排", "今天的任务", "每天任务"],
    "query_progress": ["学习进度", "学了多久", "进度如何", "完成情况", "打卡记录"],
    "review": ["复习", "遗忘曲线", "间隔重复", "该复习了", "复习安排"],
    "knowledge_query": ["知识点", "这个概念", "解释一下", "什么是", "怎么理解"],
    "upload_material": ["上传资料", "添加资料", "导入文件", "上传PDF"],
    "exam_trends": ["真题趋势", "高频考点", "出题规律", "考点分析", "真题分析"],
    "weekly_report": ["周报", "本周报告", "学习报告", "周总结", "本周总结"],
    "sprint_plan": ["冲刺计划", "考前冲刺", "最后冲刺", "临考计划"],
}


class StudyAgentService:
    """考研学习 Agent 服务 - 统筹飞书 + NotebookLM + 学习计划"""

    def __init__(self):
        self._study_tools: List = []
        self._initialized = False

    def _ensure_tools(self) -> List:
        if self._initialized:
            return self._study_tools
        tools = []
        for t in STUDY_TOOLS:
            tools.append(t)
        for t in FEISHU_TOOLS:
            tools.append(t)
        for t in NOTEBOOKLM_TOOLS:
            tools.append(t)
        self._study_tools = tools
        self._initialized = True
        logger.info(f"StudyAgentService initialized with {len(tools)} tools")
        return self._study_tools

    async def create_study_plan(
        self,
        user_id: str,
        target_school: str,
        target_major: str,
        exam_date: str,
        subjects: list,
        daily_hours: float,
    ) -> dict:
        subjects_str = ",".join(subjects)
        task = (
            f"请为考研学生制定学习计划。目标院校: {target_school}，"
            f"目标专业: {target_major}，考试日期: {exam_date}，"
            f"考试科目: {subjects_str}，每天学习时长: {daily_hours}小时。"
            f"请调用 generate_study_plan 工具生成计划，"
            f"然后使用 create_feishu_event 工具将每日学习任务写入飞书日历。"
        )

        result = await agent_service.run_task(
            task=task,
            tools=self._ensure_tools(),
            system_prompt=STUDY_AGENT_SYSTEM_PROMPT,
            max_steps=15,
            request_id=f"study-plan-{user_id[:8]}",
            user_id=user_id,
        )
        return result

    async def daily_task_assignment(self, user_id: str) -> dict:
        profile = await self._get_profile(user_id)
        if not profile:
            return {"success": False, "error": "请先创建考研配置"}

        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        subjects_str = ",".join(profile.get("subjects", []))
        daily_hours = profile.get("dailyStudyHours", 8)

        task = (
            f"今天是 {today}，请根据以下信息分配今日学习任务。"
            f"考试科目: {subjects_str}，每日学习时长: {daily_hours}小时。"
            f"请先查询该用户在飞书日历上今天的安排（使用 query_feishu_events），"
            f"再合理安排今日学习任务。"
        )

        result = await agent_service.run_task(
            task=task,
            tools=self._ensure_tools(),
            system_prompt=STUDY_AGENT_SYSTEM_PROMPT,
            max_steps=10,
            request_id=f"study-daily-{user_id[:8]}",
            user_id=user_id,
        )
        return result

    async def query_progress(self, user_id: str) -> dict:
        now = datetime.now(timezone.utc)
        seven_days_ago = now - timedelta(days=7)

        cursor = db.db.study_progress.find(
            {"userId": user_id, "date": {"$gte": seven_days_ago.isoformat()}}
        ).sort("date", -1)
        records = await cursor.to_list(length=100)

        total_hours = sum(r.get("actualHours", 0) for r in records)
        subject_hours: Dict[str, float] = {}
        for r in records:
            subj = r.get("subject", "未知")
            subject_hours[subj] = subject_hours.get(subj, 0) + r.get("actualHours", 0)

        plan = await db.db.study_plans.find_one(
            {"userId": user_id}, sort=[("createdAt", -1)]
        )

        profile = await self._get_profile(user_id)

        return {
            "success": True,
            "data": {
                "recentRecords": [_serialize_doc(r) for r in records],
                "totalHoursLast7Days": round(total_hours, 1),
                "subjectBreakdown": subject_hours,
                "currentPlan": _serialize_doc(plan) if plan else None,
                "profile": _serialize_doc(profile) if profile else None,
            },
        }

    async def review_scheduling(self, user_id: str) -> dict:
        now = datetime.now(timezone.utc)

        pending = []
        cursor = db.db.review_schedules.find(
            {"userId": user_id, "nextReview": {"$lte": now.isoformat()}}
        ).sort("nextReview", 1)
        async for doc in cursor:
            pending.append(_serialize_doc(doc))

        upcoming = []
        cursor2 = db.db.review_schedules.find(
            {
                "userId": user_id,
                "nextReview": {"$gt": now.isoformat(), "$lte": (now + timedelta(days=7)).isoformat()},
            }
        ).sort("nextReview", 1)
        async for doc in cursor2:
            upcoming.append(_serialize_doc(doc))

        return {
            "success": True,
            "data": {
                "pendingReviews": pending,
                "upcomingReviews": upcoming,
                "pendingCount": len(pending),
                "upcomingCount": len(upcoming),
            },
        }

    async def handle_study_intent(self, user_id: str, message: str) -> str:
        intent = self._classify_intent(message)

        if intent == "create_plan":
            profile = await self._get_profile(user_id)
            if not profile:
                return "请先创建考研配置（目标院校、专业、考试日期等），我才能为您制定学习计划。"
            result = await self.create_study_plan(
                user_id=user_id,
                target_school=profile.get("targetSchool", ""),
                target_major=profile.get("targetMajor", ""),
                exam_date=profile.get("examDate", ""),
                subjects=profile.get("subjects", []),
                daily_hours=profile.get("dailyStudyHours", 8),
            )
            if result.get("success"):
                return str(result.get("result", "学习计划已生成"))
            return f"生成计划失败: {result.get('error', '未知错误')}"

        elif intent == "daily_task":
            result = await self.daily_task_assignment(user_id)
            if result.get("success"):
                return str(result.get("result", "今日任务已分配"))
            return f"分配任务失败: {result.get('error', '未知错误')}"

        elif intent == "query_progress":
            result = await self.query_progress(user_id)
            if result.get("success"):
                data = result["data"]
                lines = [f"近7天学习时长: {data['totalHoursLast7Days']}小时"]
                for subj, hrs in data.get("subjectBreakdown", {}).items():
                    lines.append(f"  - {subj}: {hrs}小时")
                return "\n".join(lines)
            return "查询进度失败"

        elif intent == "review":
            result = await self.review_scheduling(user_id)
            if result.get("success"):
                data = result["data"]
                return f"待复习知识点: {data['pendingCount']}个，近7天需复习: {data['upcomingCount']}个"
            return "查询复习安排失败"

        elif intent == "exam_trends":
            from app.services.exam_analysis_service import exam_analysis_service

            subject = self._extract_subject(message)
            result = await exam_analysis_service.analyze_exam_trends(user_id, subject)
            if result.get("success"):
                data = result.get("data", {})
                trends = data.get("trends", [])[:5]
                lines = [f"【{subject}真题趋势分析】"]
                for t in trends:
                    lines.append(f"  - {t['knowledgePoint']}: 出现{t['frequency']}次 ({','.join(str(y) for y in t.get('years', []))})")
                if data.get("llmAnalysis"):
                    lines.append(f"\n备考建议: {data['llmAnalysis'][:300]}")
                return "\n".join(lines)
            return result.get("error", "分析真题趋势失败")

        elif intent == "weekly_report":
            from app.services.study_report_service import study_report_service

            result = await study_report_service.generate_weekly_report(user_id)
            if result.get("success"):
                data = result.get("data", {})
                stats = data.get("stats", {})
                changes = data.get("changes", {})
                lines = [
                    f"【本周学习报告】",
                    f"总时长: {stats.get('totalHours', 0)}小时",
                    f"活跃天数: {stats.get('activeDays', 0)}天",
                    f"日均: {stats.get('avgDailyHours', 0)}小时",
                    f"较上周: {changes.get('totalHoursChange', 0):+.1f}%",
                ]
                if data.get("llmAnalysis"):
                    lines.append(f"\n分析建议: {data['llmAnalysis'][:300]}")
                return "\n".join(lines)
            return result.get("error", "生成周报失败")

        elif intent == "sprint_plan":
            from app.services.study_report_service import study_report_service

            profile = await self._get_profile(user_id)
            if not profile:
                return "请先创建考研配置，我才能为您制定冲刺计划。"
            exam_date_str = profile.get("examDate", "")
            try:
                exam_dt = datetime.fromisoformat(exam_date_str.replace("Z", "+00:00"))
                days_left = (exam_dt - datetime.now(timezone.utc)).days
            except (ValueError, TypeError):
                days_left = 30
            days_left = max(1, days_left)

            result = await study_report_service.generate_sprint_plan(user_id, days_left)
            if result.get("success"):
                data = result.get("data", {})
                weak = data.get("weakSubjects", [])
                synced = data.get("feishuSynced", False)
                lines = [
                    f"【考前{days_left}天冲刺计划】",
                    f"薄弱科目: {', '.join(weak) if weak else '暂无'}",
                    f"飞书日历同步: {'已同步' if synced else '未同步'}",
                ]
                return "\n".join(lines)
            return result.get("error", "生成冲刺计划失败")

        else:
            result = await agent_service.run_task(
                task=message,
                tools=self._ensure_tools(),
                system_prompt=STUDY_AGENT_SYSTEM_PROMPT,
                max_steps=10,
                request_id=f"study-chat-{user_id[:8]}",
                user_id=user_id,
            )
            if result.get("success"):
                return str(result.get("result", ""))
            return f"处理失败: {result.get('error', '未知错误')}"

    def _classify_intent(self, message: str) -> str:
        message_lower = message.lower()
        best_intent = "general"
        best_score = 0
        for intent, patterns in _INTENT_PATTERNS.items():
            score = sum(1 for p in patterns if p in message_lower)
            if score > best_score:
                best_score = score
                best_intent = intent
        return best_intent

    def _extract_subject(self, message: str) -> str:
        subject_map = {"数学": ["数学", "高数", "线代", "概率"], "英语": ["英语", "英语一", "英语二"], "政治": ["政治", "毛概", "马原"], "专业课": ["专业课", "408", "数据结构"]}
        for subject, keywords in subject_map.items():
            for kw in keywords:
                if kw in message:
                    return subject
        return "数学"

    async def _get_profile(self, user_id: str) -> Optional[dict]:
        doc = await db.db.study_profiles.find_one({"userId": user_id})
        return _serialize_doc(doc) if doc else None


def _serialize_doc(doc: dict) -> dict:
    if doc is None:
        return None
    data = dict(doc)
    if "_id" in data:
        data["id"] = str(data.pop("_id"))
    for key, value in data.items():
        if isinstance(value, datetime):
            data[key] = value.isoformat()
    return data


study_agent_service = StudyAgentService()
