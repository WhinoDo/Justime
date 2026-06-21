"""Chat prompt building service."""

import re
from datetime import datetime
from typing import Dict, Any

# Keyword definitions for intent detection
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


class ChatPromptBuilder:
    """Builds task prompts with context and timing information."""

    def detect_schedule_component_intent(self, user_message: str) -> Dict[str, bool]:
        """Detect whether to force returning calendar/task decomposition components."""
        text = (user_message or "").strip()
        lowered = text.lower()

        has_calendar_intent = any(kw in text for kw in CALENDAR_KEYWORDS)
        has_complex_task = any(kw in text for kw in COMPLEX_TASK_KEYWORDS)
        has_learning_plan = any(kw in text for kw in LEARNING_PLAN_KEYWORDS)
        has_short_learn_pattern = bool(re.search(r"(我要|我想|想要|打算)?学[\u4e00-\u9fa5A-Za-z0-9]{1,12}", text))

        is_schedule_related = has_calendar_intent or has_complex_task or has_learning_plan or has_short_learn_pattern
        prefer_decomposition = has_complex_task or has_learning_plan or has_short_learn_pattern
        prefer_calendar_event = has_calendar_intent and not prefer_decomposition

        # English supplement to avoid missing "study calculus" type queries
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
        """Detect whether the user expects private document context."""
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

    def build_enhanced_task(self, user_message: str, use_web_search: bool = False) -> str:
        """Build enhanced task prompt to help AI identify calendar and complex task needs."""
        now = datetime.now()
        weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
        current_time_str = f"{now.strftime('%Y年%m月%d日')} {weekdays[now.weekday()]} {now.strftime('%H:%M')}"

        intent_info = self.detect_schedule_component_intent(user_message)
        has_complex_task = intent_info["prefer_decomposition"]
        has_calendar_intent = intent_info["prefer_calendar_event"]
        has_knowledge_intent = self.detect_knowledge_intent(user_message)
        has_search_intent = use_web_search or any(kw in user_message for kw in SEARCH_KEYWORDS)

        if has_complex_task:
            return self._build_complex_task_prompt(user_message, current_time_str, now)
        elif has_calendar_intent:
            return self._build_calendar_task_prompt(user_message, current_time_str, now)
        elif has_search_intent:
            return self._build_search_task_prompt(user_message, current_time_str)
        elif has_knowledge_intent:
            return self._build_knowledge_task_prompt(user_message, current_time_str)
        else:
            return self._build_general_task_prompt(user_message, current_time_str)

    def _build_complex_task_prompt(self, user_message: str, current_time_str: str, now: datetime) -> str:
        """Build prompt for complex task decomposition."""
        return f"""当前时间：{current_time_str} (ISO: {now.isoformat()})

用户请求：{user_message}

【角色设定】
你是一位专业的项目管理专家（PMP认证）和高效的时间规划师。你的职责是运用科学的方法（如 WBS 工作分解结构、SMART 原则）将用户的复杂请求拆解为可执行的具体计划。

【任务目标】
使用 `suggest_task_decomposition` 工具为用户生成一份科学、严谨、可落地的任务分解方案。

【科学拆解指南 (WBS & SMART)】
1. **Specific (具体)**: 每个子任务必须有明确的产出物或行动。
2. **Measurable (可衡量)**: 描述中应隐含"如何定义完成"。
3. **Achievable (可实现)**: 任务粒度要合理，单个子任务建议 1-8 小时。如果超过 8 小时，请继续拆解。
4. **Relevant (相关)**: 所有子任务必须服务于最终目标。
5. **Time-bound (有时限)**: 必须估算合理的时间开销。

【思考路径】
1. 分析用户目标的"输入"与"输出"。
2. **资源准备**: 如果任务需要特定的学习资源、官方文档或工具平台，请先使用搜索工具获取准确的 URL地址。
3. 按照项目生命周期（启动 -> 规划 -> 执行 -> 收尾）或 逻辑依赖关系 进行拆解。
4. **关键**：严格遵守 `suggest_task_decomposition` 的参数格式要求，特别是 `subtasks` 必须是合法的 JSON 字符串。

【严禁事项】
- **严禁**直接在回复中用文字或Markdown列表列出计划。
- **严禁**询问用户"是否需要我为您生成..."，直接生成！
- **必须**编写 Python 代码调用 `suggest_task_decomposition` 工具。

【工具调用要求】
请务必调用 `suggest_task_decomposition` 工具，参数如下：
- `project_name`: 项目名称（专业、简洁）
- `start_date`: 开始日期（默认为 "{now.strftime('%Y-%m-%d')}"，除非用户指定）
- `total_days`: 根据子任务总时长合理估算（假设每天工作 6-8 小时）
- `subtasks`: **JSON 字符串**。
    - 格式示例：`[{{ "title":"调研","duration_hours":4,"order":1,"resources":[{{ "title":"Google","url":"https://google.com" }}] }}]`
    - **注意**：请确保 JSON 格式正确，使用双引号。如果包含 URL，请放入 `resources` 数组。

【语言要求】
- 默认使用中文回复和生成任务内容。
- 仅当用户明确要求使用英文或其他语言时，才使用对应语言。

请立即编写代码调用工具！"""

    def _build_calendar_task_prompt(self, user_message: str, current_time_str: str, now: datetime) -> str:
        """Build prompt for calendar event creation."""
        return f"""当前时间：{current_time_str} (ISO: {now.isoformat()})

用户请求：{user_message}

【角色设定】
你是一位贴心的智能日程助理。你的职责是准确、周全地帮助用户安排日程。

【执行步骤】
1. **时间获取**: 如果涉及相对时间（如"下周五"），请优先调用 `get_current_datetime` 确认准确日期。
2. **资源检索**: 如果任务涉及专业知识、特定网站或平台（如"学习React"、"在Coursera上课"），请主动使用搜索工具查找相关的官方/专业网站 URL。
3. **需求分析**: 识别事件的 5W1H (What, When, Where, Who, Why)。
4. **工具调用**: 使用 `suggest_calendar_event` 创建日程建议。

【工具参数规范】
- `start_time` / `end_time`: 必须是 ISO 8601 格式（如 "2026-01-27T14:00:00"）。
- `end_time`: 如未指定，默认设置为开始后 1 小时。
- `event_type`: 根据内容准确分类 ("meeting", "task", "reminder", "deadline")。
- `priority`: 根据紧急程度判断 ("low", "medium", "high", "urgent")。
- `description`: 事件的具体描述（**严禁包含 URL**）。
- `resources`: 相关资源列表（数组），格式为 `[{{ "title": "资源名称", "url": "URL地址" }}]`。
    - **关键**：所有涉及的网址、链接、文档地址 **必须** 提取到 `resources` 字段中。
    - **严禁** 将 URL 直接写在 `description` 中。

【语言要求】
- 默认使用中文回复。仅当用户明确要求使用其他语言时才切换。

请务必调用工具为用户创建日程！"""

    def _build_search_task_prompt(self, user_message: str, current_time_str: str) -> str:
        """Build prompt for search-related requests."""
        return f"""当前时间：{current_time_str}

用户请求：{user_message}

【角色设定】
你是一位知识渊博的智能助手，拥有实时访问互联网的能力。你的职责是利用搜索工具为用户提供准确、实时的信息。

【执行步骤】
1. **分析需求**: 理解用户问题的核心，确定需要搜索的关键信息。
2. **搜索工具**: 积极使用 `DuckDuckGoSearchTool` (web_search) 获取最新信息。不要编造事实。
3. **整合回答**: 基于搜索结果，综合整理出简洁、准确的回答，并注明信息来源。

【语言要求】
- 默认使用中文回复。仅当用户明确要求使用其他语言时才切换。

请务必在需要时使用搜索工具！"""

    def _build_knowledge_task_prompt(self, user_message: str, current_time_str: str) -> str:
        """Build prompt for knowledge retrieval requests."""
        return f"""当前时间：{current_time_str}

用户请求：{user_message}

【执行要求】
1. 当前没有知识库检索工具，不能声称已检索上传文档、PDF 或内部资料。
2. 如果用户要求根据知识库、上传文档、PDF 或内部资料回答，明确说明当前无法检索这些资料，并请用户粘贴相关内容。
3. 若问题不依赖用户私有资料，可以基于通用知识回答；需要实时信息时再考虑使用搜索工具。

【语言要求】
- 默认使用中文回复。仅当用户明确要求使用其他语言时才切换。

请直接给出可执行、简洁的回复。"""

    def _build_general_task_prompt(self, user_message: str, current_time_str: str) -> str:
        """Build prompt for general chat requests."""
        return f"""当前时间：{current_time_str}

用户请求：{user_message}

请用简洁友好的中文回复用户。仅当用户明确要求使用英文或其他语言时，才切换到对应语言。如果用户后续提到时间安排相关的需求，可以使用日历工具帮助他们。同时，你也可以使用搜索工具来回答需要实时信息的问题。"""

    def wrap_task_with_timing(
        self,
        enhanced_task: str,
        strategy: Dict[str, Any],
        context_text: str,
        user_habits_context: str = ""
    ) -> str:
        """Inject task scheduling strategy into execution prompt as constraints."""
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

    def build_user_habits_context(self, profile: Dict[str, Any]) -> str:
        """Format user habits profile as prompt context."""
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


# Singleton instance
chat_prompt_builder = ChatPromptBuilder()
