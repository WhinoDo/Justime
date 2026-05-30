"""
考研学习 Agent 工具
为 Smolagents 注册学习计划、进度追踪、复习调度工具
"""

import asyncio
import json
import logging
import threading
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

try:
    from smolagents import tool
except Exception:
    def tool(func):
        return func

logger = logging.getLogger(__name__)

_pending_study_outputs: Dict[str, List[dict]] = {}
_outputs_lock = threading.Lock()
_request_local = threading.local()


def _get_current_request_id() -> str:
    request_id = getattr(_request_local, "request_id", None)
    return request_id or "default"


def set_current_request_context(request_id: str, user_id: Optional[str] = None):
    _request_local.request_id = request_id
    if user_id:
        _request_local.user_id = user_id


def clear_current_request_context():
    _request_local.request_id = None
    _request_local.user_id = None


def get_current_user_id() -> Optional[str]:
    return getattr(_request_local, "user_id", None)


def get_pending_study_outputs(request_id: Optional[str] = None) -> List[dict]:
    key = request_id or _get_current_request_id()
    with _outputs_lock:
        return list(_pending_study_outputs.get(key, []))


def clear_pending_study_outputs(request_id: Optional[str] = None):
    key = request_id or _get_current_request_id()
    with _outputs_lock:
        _pending_study_outputs.pop(key, None)


def _store_output(output: dict):
    request_id = _get_current_request_id()
    with _outputs_lock:
        bucket = _pending_study_outputs.get(request_id)
        if bucket is None:
            bucket = []
            _pending_study_outputs[request_id] = bucket
        bucket.append(output)


def _run_async(coro):
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(asyncio.run, coro)
            return future.result(timeout=300)
    else:
        return asyncio.run(coro)


async def _generate_study_plan_async(
    user_id: str, subjects: str, exam_date: str, daily_hours: str
) -> str:
    from app.database import db

    subject_list = [s.strip() for s in subjects.split(",") if s.strip()]
    try:
        exam_dt = datetime.fromisoformat(exam_date)
    except ValueError:
        return f"考试日期格式错误: {exam_date}，请使用 YYYY-MM-DD 格式"

    try:
        daily = float(daily_hours)
    except ValueError:
        return f"每日学习时长格式错误: {daily_hours}"

    now = datetime.now(timezone.utc)
    days_until_exam = (exam_dt - now).days
    if days_until_exam <= 0:
        return "考试日期已过，请检查日期"

    hours_per_subject = round(daily / max(len(subject_list), 1), 1)

    phases = []
    total_weeks = max(1, days_until_exam // 7)
    phase_count = min(3, max(1, total_weeks // 4))
    weeks_per_phase = total_weeks // phase_count

    phase_names = ["基础阶段", "强化阶段", "冲刺阶段"]

    for i in range(phase_count):
        phase_start = now + timedelta(weeks=i * weeks_per_phase)
        phase_end = now + timedelta(weeks=(i + 1) * weeks_per_phase)
        if i == phase_count - 1:
            phase_end = exam_dt

        phases.append({
            "phaseName": phase_names[i] if i < len(phase_names) else f"阶段{i + 1}",
            "startDate": phase_start.isoformat(),
            "endDate": phase_end.isoformat(),
            "subjects": subject_list,
            "goals": [f"完成{subj}{phase_names[i] if i < len(phase_names) else f'阶段{i + 1}'}学习" for subj in subject_list],
        })

    plan_doc = {
        "userId": user_id,
        "planName": f"考研计划-{exam_date}",
        "startDate": now.isoformat(),
        "endDate": exam_dt.isoformat(),
        "phases": phases,
        "dailyHours": daily,
        "subjects": subject_list,
        "hoursPerSubject": hours_per_subject,
        "createdAt": now.isoformat(),
    }

    result = await db.db.study_plans.insert_one(plan_doc)
    plan_id = str(result.inserted_id)

    output = {
        "type": "study_plan_generated",
        "planId": plan_id,
        "subjects": subject_list,
        "examDate": exam_date,
        "dailyHours": daily,
        "daysUntilExam": days_until_exam,
        "phases": phases,
        "hoursPerSubject": hours_per_subject,
    }
    _store_output(output)
    return json.dumps(output, ensure_ascii=False)


async def _record_study_progress_async(
    user_id: str, subject: str, hours: str, notes: str
) -> str:
    from app.database import db

    try:
        hours_val = float(hours)
    except ValueError:
        return f"学习时长格式错误: {hours}"

    now = datetime.now(timezone.utc)

    progress_doc = {
        "userId": user_id,
        "date": now.isoformat(),
        "subject": subject,
        "plannedHours": 0.0,
        "actualHours": hours_val,
        "completionRate": 0.0,
        "notes": notes,
        "createdAt": now.isoformat(),
    }

    result = await db.db.study_progress.insert_one(progress_doc)
    progress_id = str(result.inserted_id)

    output = {
        "type": "study_progress_recorded",
        "progressId": progress_id,
        "subject": subject,
        "hours": hours_val,
        "notes": notes,
        "date": now.isoformat(),
    }
    _store_output(output)
    return json.dumps(output, ensure_ascii=False)


async def _schedule_review_async(
    user_id: str, knowledge_point: str, subject: str
) -> str:
    from app.database import db

    now = datetime.now(timezone.utc)

    existing = await db.db.review_schedules.find_one(
        {"userId": user_id, "knowledgePoint": knowledge_point, "subject": subject}
    )

    if existing:
        review_count = existing.get("reviewCount", 0) + 1
        ease_factor = existing.get("easeFactor", 2.5)
        interval_days = max(1, int(ease_factor ** review_count))
        next_review = now + timedelta(days=interval_days)

        await db.db.review_schedules.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "lastReviewed": now.isoformat(),
                    "nextReview": next_review.isoformat(),
                    "reviewCount": review_count,
                }
            },
        )
        schedule_id = str(existing["_id"])
    else:
        next_review = now + timedelta(days=1)
        review_count = 0
        ease_factor = 2.5

        doc = {
            "userId": user_id,
            "knowledgePoint": knowledge_point,
            "subject": subject,
            "lastReviewed": now.isoformat(),
            "nextReview": next_review.isoformat(),
            "reviewCount": review_count,
            "easeFactor": ease_factor,
            "createdAt": now.isoformat(),
        }
        result = await db.db.review_schedules.insert_one(doc)
        schedule_id = str(result.inserted_id)

    output = {
        "type": "review_scheduled",
        "scheduleId": schedule_id,
        "knowledgePoint": knowledge_point,
        "subject": subject,
        "nextReview": next_review.isoformat(),
        "reviewCount": review_count,
    }
    _store_output(output)
    return json.dumps(output, ensure_ascii=False)


@tool
def generate_study_plan(subjects: str, exam_date: str, daily_hours: str) -> str:
    """根据考试科目和日期生成学习计划。当用户需要制定考研学习计划、安排复习进度时使用此工具。

    Args:
        subjects: 考试科目列表，逗号分隔，如"数学,英语,政治"
        exam_date: 考试日期，格式 YYYY-MM-DD
        daily_hours: 每天可用学习小时数
    """
    user_id = get_current_user_id()
    if not user_id:
        return "无法获取用户信息，请重新登录后再试。"
    try:
        return _run_async(_generate_study_plan_async(user_id, subjects, exam_date, daily_hours))
    except Exception as e:
        logger.error(f"generate_study_plan failed: {e}")
        return f"生成学习计划失败: {e}"


@tool
def record_study_progress(subject: str, hours: str, notes: str) -> str:
    """记录今日学习进度。当用户汇报今天学了什么、学了多少小时时使用此工具。

    Args:
        subject: 科目名称
        hours: 实际学习小时数
        notes: 学习笔记
    """
    user_id = get_current_user_id()
    if not user_id:
        return "无法获取用户信息，请重新登录后再试。"
    try:
        return _run_async(_record_study_progress_async(user_id, subject, hours, notes))
    except Exception as e:
        logger.error(f"record_study_progress failed: {e}")
        return f"记录进度失败: {e}"


@tool
def schedule_review(knowledge_point: str, subject: str) -> str:
    """安排知识点复习（基于间隔重复算法）。当用户学完某个知识点需要安排后续复习时使用此工具。

    Args:
        knowledge_point: 知识点名称
        subject: 所属科目
    """
    user_id = get_current_user_id()
    if not user_id:
        return "无法获取用户信息，请重新登录后再试。"
    try:
        return _run_async(_schedule_review_async(user_id, knowledge_point, subject))
    except Exception as e:
        logger.error(f"schedule_review failed: {e}")
        return f"安排复习失败: {e}"


async def _analyze_exam_trends_async(user_id: str, subject: str) -> str:
    from app.services.exam_analysis_service import exam_analysis_service

    result = await exam_analysis_service.analyze_exam_trends(user_id, subject)
    if not result.get("success"):
        return result.get("error", "分析真题趋势失败")

    output = {
        "type": "exam_trends_analyzed",
        "subject": subject,
        "trends": result.get("data", {}).get("trends", []),
        "llmAnalysis": result.get("data", {}).get("llmAnalysis", ""),
    }
    _store_output(output)
    return json.dumps(output, ensure_ascii=False)


async def _generate_weekly_report_async(user_id: str) -> str:
    from app.services.study_report_service import study_report_service

    result = await study_report_service.generate_weekly_report(user_id)
    if not result.get("success"):
        return result.get("error", "生成周报失败")

    output = {
        "type": "weekly_report_generated",
        "reportId": result.get("data", {}).get("reportId", ""),
        "stats": result.get("data", {}).get("stats", {}),
        "changes": result.get("data", {}).get("changes", {}),
        "completionRates": result.get("data", {}).get("completionRates", {}),
        "llmAnalysis": result.get("data", {}).get("llmAnalysis", ""),
    }
    _store_output(output)
    return json.dumps(output, ensure_ascii=False)


async def _create_sprint_plan_async(user_id: str, days_before_exam: str) -> str:
    from app.services.study_report_service import study_report_service

    try:
        days = int(days_before_exam)
    except ValueError:
        return f"天数格式错误: {days_before_exam}"

    result = await study_report_service.generate_sprint_plan(user_id, days)
    if not result.get("success"):
        return result.get("error", "生成冲刺计划失败")

    output = {
        "type": "sprint_plan_generated",
        "daysBeforeExam": days,
        "sprintPlan": result.get("data", {}).get("sprintPlan", {}),
        "weakSubjects": result.get("data", {}).get("weakSubjects", []),
        "feishuSynced": result.get("data", {}).get("feishuSynced", False),
    }
    _store_output(output)
    return json.dumps(output, ensure_ascii=False)


@tool
def analyze_exam_trends(subject: str) -> str:
    """分析指定科目的真题趋势和高频考点。当用户想了解某科目历年真题的出题规律、高频考点时使用此工具。

    Args:
        subject: 科目名称，如"数学"、"英语"
    """
    user_id = get_current_user_id()
    if not user_id:
        return "无法获取用户信息，请重新登录后再试。"
    try:
        return _run_async(_analyze_exam_trends_async(user_id, subject))
    except Exception as e:
        logger.error(f"analyze_exam_trends failed: {e}")
        return f"分析真题趋势失败: {e}"


@tool
def generate_weekly_report() -> str:
    """生成本周学习报告。当用户想查看本周学习总结、进度分析、改进建议时使用此工具。"""
    user_id = get_current_user_id()
    if not user_id:
        return "无法获取用户信息，请重新登录后再试。"
    try:
        return _run_async(_generate_weekly_report_async(user_id))
    except Exception as e:
        logger.error(f"generate_weekly_report failed: {e}")
        return f"生成周报失败: {e}"


@tool
def create_sprint_plan(days_before_exam: str) -> str:
    """生成考前冲刺计划。当用户临近考试需要制定最后的冲刺方案时使用此工具。

    Args:
        days_before_exam: 距离考试的天数
    """
    user_id = get_current_user_id()
    if not user_id:
        return "无法获取用户信息，请重新登录后再试。"
    try:
        return _run_async(_create_sprint_plan_async(user_id, days_before_exam))
    except Exception as e:
        logger.error(f"create_sprint_plan failed: {e}")
        return f"生成冲刺计划失败: {e}"


STUDY_TOOLS = [
    generate_study_plan,
    record_study_progress,
    schedule_review,
    analyze_exam_trends,
    generate_weekly_report,
    create_sprint_plan,
]
