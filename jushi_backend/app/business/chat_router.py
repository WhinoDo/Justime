import re
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from app.core.config import settings, LLMConfig
from app.services.user_service import UserService
from app.services.encryption_service import encryption_service
from app.core.normalizers import normalize_bool, normalize_capabilities

logger = logging.getLogger(__name__)

CALENDAR_KEYWORDS = [
    "日程", "日历", "安排", "提醒", "会议", "约会", "预约", "截止",
    "明天", "后天", "下周", "下个月", "今天", "周一", "周二", "周三", "周四", "周五", "周六", "周日",
    "上午", "下午", "早上", "晚上", "中午", "点钟", "点半",
    "开会", "见面", "面试", "聚会", "培训", "活动", "deadline", "meeting",
    "添加事件", "创建事件", "新建日程", "记录", "备忘"
]

COMPLEX_TASK_KEYWORDS = [
    "项目", "开发", "系统", "计划", "方案", "准备", "设计", "实现",
    "学习", "完成", "制定", "规划", "论文", "报告", "研究",
    "网站", "应用", "App", "软件", "平台", "程序",
    "帮我做", "帮我制定", "怎么安排", "如何完成",
    "分解", "拆分", "步骤", "阶段", "里程碑"
]

SEARCH_KEYWORDS = [
    "搜索", "查找", "查询", "百度", "谷歌", "Google", "search", "find", 
    "查一下", "搜一下", "who is", "what is", "when is", "latest", "news",
    "最新", "新闻"
]

LEARNING_PLAN_KEYWORDS = [
    "学习", "复习", "备考", "刷题", "课程", "训练计划", "学习计划", "路线图",
    "我要学", "想学", "怎么学", "如何学", "学会", "入门"
]


class ChatRouter:
    async def get_user_llm_config(self, user_id: str) -> Dict[str, Any]:
        system_configs = await UserService.get_available_models_for_user(user_id)
        active_id = await UserService.get_user_active_model_id(user_id)
        
        target_config = None
        
        if active_id and system_configs:
            target_config = next((c for c in system_configs if c.get("id") == active_id), None)
            
        if not target_config and system_configs:
            target_config = system_configs[0]
            
        if not target_config:
            return {
                "config_id": "",
                "config_name": "",
                "model_id": "",
                "api_key": "",
                "base_url": "",
                "timeout": 60
            }
        
        encrypted_key = target_config.get("api_key", "")
        plain_key = encryption_service.decrypt(encrypted_key) if encrypted_key else ""
        
        return {
            "config_id": target_config.get("id") or "",
            "config_name": target_config.get("name") or "平台默认配置",
            "model_id": target_config.get("model_id"),
            "api_key": plain_key,
            "base_url": target_config.get("base_url"),
            "timeout": int(target_config.get("timeout", 60))
        }

    def normalize_route_mode(self, route_mode: Optional[str]) -> str:
        value = (route_mode or "auto").strip().lower()
        if value in {"auto", "fast", "balanced", "reasoning"}:
            return value
        return "auto"

    def runtime_to_llm_config(self, runtime_config: Dict[str, Any], timeout_override: Optional[float] = None) -> LLMConfig:
        timeout_value = int(timeout_override) if timeout_override is not None else int(runtime_config.get("timeout", 60))
        timeout_value = max(1, timeout_value)
        return LLMConfig(
            name=runtime_config.get("config_name") or "未命名配置",
            model_id=runtime_config.get("model_id") or "",
            api_key=runtime_config.get("api_key") or "",
            api_base=runtime_config.get("base_url"),
            timeout=timeout_value
        )

    def build_runtime_model_candidates(
        self,
        system_configs: List[Dict[str, Any]],
        active_id: Optional[str],
        active_config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        runtime_configs: List[Dict[str, Any]] = []

        for conf in system_configs:
            if not isinstance(conf, dict):
                continue
            encrypted_key = conf.get("api_key", "")
            plain_key = encryption_service.decrypt(encrypted_key) if encrypted_key else ""
            model_id = conf.get("model_id")
            base_url = conf.get("base_url")
            if not plain_key or not model_id or not base_url:
                continue
            runtime_configs.append({
                "config_id": conf.get("id") or "unknown",
                "config_name": conf.get("name") or "平台选项",
                "model_id": model_id,
                "api_key": plain_key,
                "base_url": base_url,
                "timeout": int(conf.get("timeout", 60)),
                "priority": conf.get("priority", 100),
                "enabled": normalize_bool(conf.get("enabled", True), default=True),
                "capabilities": normalize_capabilities(conf.get("capabilities")),
                "is_active": bool(conf.get("id") and conf.get("id") == active_id),
            })

        if active_config.get("api_key") and active_config.get("base_url") and active_config.get("model_id"):
            active_runtime_id = active_config.get("config_id") or ""
            exists = any(item.get("config_id") == active_runtime_id for item in runtime_configs)
            if not exists:
                runtime_configs.append({
                    "config_id": active_runtime_id or "active",
                    "config_name": active_config.get("config_name") or "平台默认配置",
                    "model_id": active_config.get("model_id"),
                    "api_key": active_config.get("api_key"),
                    "base_url": active_config.get("base_url"),
                    "timeout": int(active_config.get("timeout", 60)),
                    "priority": 100,
                    "enabled": True,
                    "capabilities": [],
                    "is_active": True,
                })

        return runtime_configs

    def detect_schedule_component_intent(self, user_message: str) -> Dict[str, bool]:
        text = (user_message or "").strip()
        lowered = text.lower()

        has_calendar_intent = any(kw in text for kw in CALENDAR_KEYWORDS)
        has_complex_task = any(kw in text for kw in COMPLEX_TASK_KEYWORDS)
        has_learning_plan = any(kw in text for kw in LEARNING_PLAN_KEYWORDS)
        has_short_learn_pattern = bool(re.search(r"(我要|我想|想要|打算)?学[\u4e00-\u9fa5A-Za-z0-9]{1,12}", text))

        is_schedule_related = has_calendar_intent or has_complex_task or has_learning_plan or has_short_learn_pattern
        prefer_decomposition = has_complex_task or has_learning_plan or has_short_learn_pattern
        prefer_calendar_event = has_calendar_intent and not prefer_decomposition

        if not is_schedule_related and any(x in lowered for x in ["study plan", "learning plan", "schedule", "deadline"]):
            is_schedule_related = True
            prefer_decomposition = "plan" in lowered or "study" in lowered
            prefer_calendar_event = not prefer_decomposition

        return {
            "is_schedule_related": is_schedule_related,
            "prefer_decomposition": prefer_decomposition,
            "prefer_calendar_event": prefer_calendar_event,
        }

    def detect_knowledge_intent(self, user_message: str) -> bool:
        text = (user_message or "").strip()
        lowered = text.lower()
        if not text:
            return False

        hard_keywords = [
            "知识库", "文档", "资料", "pdf", "文件", "上传", "根据文档", "根据资料",
            "这份文档", "这份资料", "串.pdf", "readme"
        ]
        if any(kw in text or kw in lowered for kw in hard_keywords):
            return True

        if len(text) <= 40 and re.search(r"(什么是|定义|概念|含义|是什么意思|是啥|是什么)", text):
            return True

        return False

    def build_user_habits_context(self, profile: Dict[str, Any]) -> str:
        if not isinstance(profile, dict):
            return ""

        habits = profile.get("habits")
        if not isinstance(habits, dict) or not habits:
            return ""

        lines = []
        if habits.get("occupation"):
            lines.append(f"- occupation: {habits.get('occupation')}")
        if habits.get("currentStudyFocus"):
            lines.append(f"- current_study_focus: {habits.get('currentStudyFocus')}")

        high_eff = habits.get("highEfficiencyPeriods")
        if isinstance(high_eff, list) and high_eff:
            lines.append(f"- high_efficiency_periods: {', '.join([str(x) for x in high_eff[:6]])}")

        low_eff = habits.get("lowEfficiencyPeriods")
        if isinstance(low_eff, list) and low_eff:
            lines.append(f"- low_efficiency_periods: {', '.join([str(x) for x in low_eff[:6]])}")

        unavailable = habits.get("weeklyUnavailableSlots")
        if isinstance(unavailable, list) and unavailable:
            lines.append(f"- weekly_unavailable_slots: {', '.join([str(x) for x in unavailable[:6]])}")

        if habits.get("preferredFocusMinutes") is not None:
            lines.append(f"- preferred_focus_minutes: {habits.get('preferredFocusMinutes')}")
        if habits.get("preferredBreakMinutes") is not None:
            lines.append(f"- preferred_break_minutes: {habits.get('preferredBreakMinutes')}")
        if habits.get("maxFocusSessionsPerDay") is not None:
            lines.append(f"- max_focus_sessions_per_day: {habits.get('maxFocusSessionsPerDay')}")

        if habits.get("planningPreference"):
            lines.append(f"- planning_preference: {habits.get('planningPreference')}")
        if habits.get("notes"):
            lines.append(f"- notes: {str(habits.get('notes'))[:160]}")

        return "\n".join(lines)

    def wrap_task_with_timing(
        self,
        enhanced_task: str,
        strategy: Dict[str, Any],
        context_text: str,
        user_habits_context: str = ""
    ) -> str:
        task_type = strategy.get("taskType", "general")
        duration_sec = strategy.get("interactionDurationSeconds", 300)
        interval_sec = strategy.get("intervalSeconds", 21600)
        max_steps = strategy.get("maxSteps", 10)
        timeout_sec = strategy.get("timeoutSeconds", 290)
        difficulty = strategy.get("difficultyLevel", 3)
        urgency = strategy.get("urgency", "medium")
        analysis_meta = strategy.get("analysisMeta") if isinstance(strategy.get("analysisMeta"), dict) else None

        if task_type == "recitation":
            mode_instruction = (
                "当前任务是背诵/记忆型任务，目标是短时高频。"
                "请快速给出可执行的记忆训练结果，并保持回复简洁。"
            )
        elif task_type == "thinking":
            mode_instruction = (
                "当前任务是思考/分析型任务，目标是长时低频。"
                "请进行结构化分析，允许更充分推理，再给出结论。"
            )
        else:
            mode_instruction = (
                "当前任务是通用任务，平衡效率与完整性，输出明确可执行答案。"
            )

        sections = [
            enhanced_task,
            "",
            "【任务调度约束】",
            mode_instruction,
            f"- task_type: {task_type}",
            f"- difficulty_level: {difficulty}",
            f"- urgency: {urgency}",
            f"- expected_interaction_duration_seconds: {duration_sec}",
            f"- next_interval_seconds: {interval_sec}",
            f"- execution_max_steps: {max_steps}",
            f"- execution_timeout_seconds: {timeout_sec}",
        ]
        if analysis_meta:
            sections.extend([
                f"- classifier_source: {analysis_meta.get('source', 'unknown')}",
                f"- classifier_confidence: {analysis_meta.get('confidence', 0)}",
                f"- classifier_reason: {analysis_meta.get('reason', '')}"
            ])

        if user_habits_context:
            sections.extend([
                "",
                "【用户工作与学习习惯】",
                user_habits_context,
                "",
                "【排程要求】",
                "- 创建日程或拆解任务时优先使用用户高效时段。",
                "- 避开低效时段和不可用时间段。",
                "- 单次专注时长优先贴合 preferred_focus_minutes；需要更长任务时拆分并安排休息。",
                "- 每日深度任务数量不要超过 max_focus_sessions_per_day。"
            ])

        if context_text:
            sections.extend([
                "",
                "【最近上下文（按调度窗口裁剪）】",
                context_text
            ])

        return "\n".join(sections)


chat_router = ChatRouter()
