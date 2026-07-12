"""Task agent service for TaskProcess workflows with active LLM routing."""

import hashlib
import re
import uuid
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.models.task_process import (
    AIAssessment,
    AISuggestion,
    LearningMaterial,
    Milestone,
    PreparationItem,
    TaskProcessOut,
)
from app.models.evidence import EvidenceOut
from app.services.user_service import UserService
from app.services.model_router_service import model_router_service
from app.services.encryption_service import encryption_service
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)


class TaskAgentService:
    """Task Agent supporting active LLMs and deterministic heuristics fallbacks."""

    def _slug(self, text: str, fallback: str) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
        return slug or fallback

    def _split_goal(self, task: TaskProcessOut, user_input: str = "") -> List[str]:
        raw = user_input.strip() or task.goal.strip() or task.description.strip()
        parts = [p.strip(" -\n\t") for p in re.split(r"[\n;；。.!?]+", raw) if p.strip(" -\n\t")]
        if len(parts) >= 3:
            return parts[:5]
        return [
            f"明确范围与完成标准：{task.title}",
            f"执行核心工作并沉淀证据：{task.goal}",
            "整理结果、复盘问题并输出知识文档",
        ]

    def _build_milestones_fallback(self, task: TaskProcessOut, user_input: str = "") -> List[Milestone]:
        steps = self._split_goal(task, user_input)
        milestones: List[Milestone] = []
        for index, step in enumerate(steps, start=1):
            milestone_id = f"ms-{index}-{self._slug(step, str(index))[:16]}"
            milestones.append(
                Milestone(
                    id=milestone_id,
                    title=step[:200],
                    description="",
                    order=index - 1,
                    status="pending" if index > 1 else "active",
                )
            )
        return milestones

    def _preparation_id(self, task_title: str, item_title: str, index: int) -> str:
        digest = hashlib.sha256(f"{task_title}\0{item_title}\0{index}".encode("utf-8")).hexdigest()[:12]
        return f"prep-{index + 1}-{digest}"

    def _build_preparation_fallback(self, task: TaskProcessOut) -> List[PreparationItem]:
        title = f"确认《{task.title}》的目标、范围与开始条件"[:200]
        return [
            PreparationItem(
                id=self._preparation_id(task.title, title, 0),
                title=title,
                done=False,
                order=0,
            )
        ]

    def _normalize_materials(self, raw_materials: Any) -> List[LearningMaterial]:
        if not isinstance(raw_materials, list):
            return []

        materials: List[LearningMaterial] = []
        for item in raw_materials:
            if not isinstance(item, dict):
                continue
            try:
                materials.append(
                    LearningMaterial(
                        title=str(item.get("title") or "")[:200],
                        url=str(item["url"])[:2000] if item.get("url") else None,
                        summary=str(item.get("summary") or "")[:2000],
                        source=str(item.get("source") or "")[:200],
                    )
                )
            except (TypeError, ValueError):
                continue
        return materials

    def _normalize_preparation_items(self, task: TaskProcessOut, raw_items: Any) -> List[PreparationItem]:
        if not isinstance(raw_items, list):
            return self._build_preparation_fallback(task)

        preparation_items: List[PreparationItem] = []
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or "")[:200]
            index = len(preparation_items)
            try:
                preparation_items.append(
                    PreparationItem(
                        id=self._preparation_id(task.title, title, index),
                        title=title,
                        done=item.get("done", False),
                        order=index,
                    )
                )
            except (TypeError, ValueError):
                continue

        return preparation_items or self._build_preparation_fallback(task)

    def _summarize_evidence_fallback(self, evidences: List[EvidenceOut]) -> Dict[str, Any]:
        total_hours = 0.0
        blocker_signals: List[str] = []
        evidence_types: Dict[str, int] = {}

        for evidence in evidences:
            evidence_types[evidence.type] = evidence_types.get(evidence.type, 0) + 1
            if evidence.type == "time_log":
                total_hours += float((evidence.metadata or {}).get("hours", 0) or 0)
            text = f"{evidence.title}\n{evidence.content}".lower()
            if evidence.sentiment == "blocked" or any(word in text for word in ["blocked", "卡住", "报错", "失败", "无法"]):
                blocker_signals.append(evidence.title or evidence.content[:80])

        return {
            "total_hours": round(total_hours, 2),
            "blocker_signals": blocker_signals[:5],
            "evidence_types": evidence_types,
        }

    def _run_heuristic_fallback(
        self,
        task: TaskProcessOut,
        mode: str,
        user_input: str,
        evidences: List[EvidenceOut],
    ) -> Dict[str, Any]:
        """Deterministic fallback implementation."""
        if mode == "plan":
            milestones = self._build_milestones_fallback(task, user_input)
            preparation_items = self._build_preparation_fallback(task)
            suggestions = [
                AISuggestion(
                    id=f"sug-{uuid.uuid4().hex[:8]}",
                    type="next_step",
                    content="先确认完成标准，再按里程碑逐个产出可验证的 Evidence。",
                )
            ]
            return {
                "plan": {
                    "summary": f"已为任务《{task.title}》生成 {len(milestones)} 个里程碑。",
                    "milestones": [item.model_dump(mode="json") for item in milestones],
                },
                "milestones": milestones,
                "materials": [],
                "preparation_items": preparation_items,
                "suggestions": suggestions,
            }

        evidence_summary = self._summarize_evidence_fallback(evidences)
        milestone_total = max(len(task.milestones), 1)
        completed_count = len([item for item in task.milestones if item.status == "completed"])
        progress = min(1.0, max(task.progress, completed_count / milestone_total))
        if evidences:
            progress = min(1.0, max(progress, min(len(evidences) / max(milestone_total * 2, 1), 1.0)))

        blockers = evidence_summary["blocker_signals"]
        next_steps = []
        active_milestones = [item for item in task.milestones if item.status in {"active", "pending"}]
        if active_milestones:
            next_steps.append(f"优先推进里程碑：{active_milestones[0].title}")
        if blockers:
            next_steps.append("先处理阻塞点，再继续扩展执行范围")
        if not next_steps:
            next_steps.append("补充新的执行证据，并在完成后推进下一阶段")

        assessment = AIAssessment(
            progress=round(progress, 4),
            confidence=0.72 if evidences else 0.45,
            summary=f"当前已记录 {len(evidences)} 条 Evidence，累计投入 {evidence_summary['total_hours']} 小时。",
            blockers_identified=blockers,
            next_steps=next_steps,
            assessed_at=datetime.utcnow(),
        )

        suggestions = [
            AISuggestion(
                id=f"sug-{uuid.uuid4().hex[:8]}",
                type="alert" if blockers else "next_step",
                content=next_steps[0],
            )
        ]

        if mode in {"monitor", "coach", "research"}:
            return {
                "assessment": assessment,
                "suggestions": suggestions,
            }

        # summarize / knowledge mode fallback
        summary_points = []
        for evidence in evidences[:12]:
            label = evidence.title or evidence.type
            summary_points.append(f"- {label}: {evidence.content[:140]}")

        return {
            "assessment": assessment,
            "suggestions": suggestions,
            "summary": {
                "title": task.title,
                "goal": task.goal,
                "progress": assessment.progress,
                "evidence_points": summary_points,
            },
        }

    async def run(
        self,
        task: TaskProcessOut,
        mode: str,
        user_input: str,
        evidences: List[EvidenceOut],
    ) -> Dict[str, Any]:
        """Runs the TaskAgent workflows, using LLM if configured, otherwise falls back to heuristics."""
        try:
            configs = await UserService.get_system_llm_configs()
            main_config = model_router_service.pick_main_config(
                task_type="thinking",
                difficulty_level=4,
                route_mode="auto",
                configs=configs,
                active_id=None
            )
            if not main_config:
                logger.info("No active model configs found. Falling back to heuristic TaskAgent.")
                return self._run_heuristic_fallback(task, mode, user_input, evidences)

            # Build System & User Prompts
            system_prompt = ""
            user_prompt = ""

            evidences_text = "\n".join(
                f"- [{ev.type}] {ev.title or '未命名证据'}: {ev.content[:500]}"
                for ev in evidences
            )
            milestones_text = "\n".join(
                f"- {ms.title} (状态: {ms.status})"
                for ms in task.milestones
            )

            if mode == "plan":
                system_prompt = (
                    "你是一个专业的任务规划 AI Agent。\n"
                    "请根据任务的标题、目标与描述，以及用户输入，将其拆解成 3-8 个具体的、可验证的里程碑（Milestones）。\n"
                    "你必须返回一个 JSON 对象，且仅返回 JSON 格式，不要包含任何 markdown 代码块格式（如 ```json 等），返回格式为：\n"
                    "{\n"
                    '  "plan": {\n'
                    '    "summary": "对计划的整体性概括汇总描述"\n'
                    "  },\n"
                    '  "milestones": [\n'
                    "    {\n"
                    '      "title": "里程碑标题",\n'
                    '      "description": "里程碑的具体执行步骤或验证标准"\n'
                    "    }\n"
                    "  ],\n"
                    '  "materials": [\n'
                    "    {\n"
                    '      "title": "资料标题",\n'
                    '      "url": "可选的资料链接",\n'
                    '      "summary": "资料摘要",\n'
                    '      "source": "资料来源"\n'
                    "    }\n"
                    "  ],\n"
                    '  "preparation_items": [\n'
                    "    {\n"
                    '      "title": "开始任务前需要完成的准备事项",\n'
                    '      "done": false\n'
                    "    }\n"
                    "  ],\n"
                    '  "suggestions": [\n'
                    "    {\n"
                    '      "type": "next_step",\n'
                    '      "content": "具体的行动建议"\n'
                    "    }\n"
                    "  ]\n"
                    "}\n"
                    "建议的 type 必须在以下范围中选择：'next_step', 'resource', 'review', 'alert', 'optimization'。"
                )
                user_prompt = (
                    f"任务标题: {task.title}\n"
                    f"任务目标: {task.goal}\n"
                    f"任务描述: {task.description}\n"
                    f"用户输入: {user_input}"
                )

            elif mode in {"monitor", "coach", "research"}:
                system_prompt = (
                    "你是一个精细的任务进度监控与辅导 AI Agent。\n"
                    "请分析任务的目标、里程碑以及当前提交的全部客观证据（Evidence），评估任务的进度（0.0 至 1.0），并识别是否存在卡点（Blocker）、提出下一步建议。\n"
                    "你必须返回一个 JSON 对象，且仅返回 JSON 格式，不要包含任何 markdown 格式，返回格式为：\n"
                    "{\n"
                    '  "progress": 0.35,\n'
                    '  "confidence": 0.85,\n'
                    '  "summary": "当前的进展概述（包含对已记录证据的反馈）",\n'
                    '  "blockers_identified": ["阻塞点描述1", "阻塞点描述2"],\n'
                    '  "next_steps": ["下一步行动建议1", "下一步行动建议2"],\n'
                    '  "suggestions": [\n'
                    "    {\n"
                    '      "type": "alert",\n'
                    '      "content": "针对卡点的警告或优化建议"\n'
                    "    }\n"
                    "  ]\n"
                    "}\n"
                    "建议的 type 必须在以下范围中选择：'next_step', 'resource', 'review', 'alert', 'optimization'。"
                )
                user_prompt = (
                    f"任务标题: {task.title}\n"
                    f"任务目标: {task.goal}\n"
                    f"当前里程碑计划:\n{milestones_text}\n"
                    f"当前提交的所有证据:\n{evidences_text}\n"
                    f"用户输入: {user_input}"
                )

            elif mode == "summarize":
                system_prompt = (
                    "你是一个任务复盘与总结 AI Agent。\n"
                    "请针对当前完成的任务，分析任务目标和全部客观执行证据（Evidence），做一次深度的复盘和回顾总结。\n"
                    "你必须返回一个 JSON 对象，且仅返回 JSON 格式，返回格式为：\n"
                    "{\n"
                    '  "progress": 1.0,\n'
                    '  "confidence": 0.95,\n'
                    '  "summary": "深度的任务复盘总结内容，总结任务的达成情况与核心收获",\n'
                    '  "blockers_identified": [],\n'
                    '  "next_steps": [],\n'
                    '  "suggestions": [\n'
                    "    {\n"
                    '      "type": "review",\n'
                    '      "content": "总结性复盘建议"\n'
                    "    }\n"
                    "  ]\n"
                    "}\n"
                )
                user_prompt = (
                    f"任务标题: {task.title}\n"
                    f"任务目标: {task.goal}\n"
                    f"执行的所有客观证据:\n{evidences_text}"
                )

            elif mode == "knowledge":
                system_prompt = (
                    "你是一个知识库文档沉淀 AI Agent。\n"
                    "请针对该任务，整合其目标、执行的客观证据（Evidence）、复盘结论，输出一篇结构化、排版精美、可读性极强的 Obsidian 兼容 Markdown 格式知识文档。\n"
                    "你需要自动识别与该任务关联的其他知识/任务概念，并在 Markdown 中适当的位置自动加上 [[文件名]] 双链格式，以便在 Obsidian 中自动建立双链连接。\n"
                    "你必须直接输出 Markdown 文本，不要用 JSON 包装，且不要包含最外层的 YAML Frontmatter（将在外部生成并添加）。直接以 `# 任务标题` 开头。"
                )
                user_prompt = (
                    f"任务标题: {task.title}\n"
                    f"任务目标: {task.goal}\n"
                    f"任务描述: {task.description}\n"
                    f"已执行 of 证据列表:\n{evidences_text}\n"
                    f"用户要求: {user_input}"
                )

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]

            api_key = encryption_service.decrypt(main_config["api_key"]) if main_config.get("api_key") else ""
            response = await llm_service.chat_completion(
                messages=messages,
                model=main_config["model_id"],
                api_key=api_key,
                api_base=main_config["base_url"],
                temperature=0.3
            )
            content = str(response["choices"][0]["message"]["content"]).strip()

            if mode == "knowledge":
                # Knowledge mode returns raw markdown directly
                return {"markdown": content}

            # JSON Parsing
            clean_content = content
            if clean_content.startswith("```json"):
                clean_content = clean_content[7:]
            elif clean_content.startswith("```"):
                clean_content = clean_content[3:]
            if clean_content.endswith("```"):
                clean_content = clean_content[:-3]
            clean_content = clean_content.strip()

            parsed = json.loads(clean_content)

            if mode == "plan":
                milestones: List[Milestone] = []
                for idx, item in enumerate(parsed.get("milestones") or []):
                    title = item.get("title", f"里程碑 {idx + 1}")
                    milestone_id = f"ms-{idx + 1}-{self._slug(title, str(idx + 1))[:16]}"
                    milestones.append(
                        Milestone(
                            id=milestone_id,
                            title=title[:200],
                            description=item.get("description", "")[:2000],
                            order=idx,
                            status="pending" if idx > 0 else "active",
                        )
                    )
                materials = self._normalize_materials(parsed.get("materials"))
                preparation_items = self._normalize_preparation_items(task, parsed.get("preparation_items"))
                suggestions = [
                    AISuggestion(
                        id=f"sug-{uuid.uuid4().hex[:8]}",
                        type=item.get("type", "next_step"),
                        content=item.get("content", "")[:5000],
                    )
                    for item in parsed.get("suggestions") or []
                ]
                return {
                    "plan": parsed.get("plan") or {"summary": f"已为任务《{task.title}》生成 {len(milestones)} 个里程碑。"},
                    "milestones": milestones,
                    "materials": materials,
                    "preparation_items": preparation_items,
                    "suggestions": suggestions,
                }

            # monitor / coach / research / summarize
            progress = float(parsed.get("progress", 0.0) or 0.0)
            confidence = float(parsed.get("confidence", 0.8) or 0.8)
            summary = parsed.get("summary") or ""
            blockers = parsed.get("blockers_identified") or []
            next_steps = parsed.get("next_steps") or []

            assessment = AIAssessment(
                progress=round(min(max(progress, 0.0), 1.0), 4),
                confidence=round(min(max(confidence, 0.0), 1.0), 4),
                summary=summary[:2000],
                blockers_identified=[str(b)[:2000] for b in blockers],
                next_steps=[str(n)[:2000] for n in next_steps],
                assessed_at=datetime.utcnow(),
            )

            suggestions = [
                AISuggestion(
                    id=f"sug-{uuid.uuid4().hex[:8]}",
                    type=item.get("type", "next_step"),
                    content=item.get("content", "")[:5000],
                )
                for item in parsed.get("suggestions") or []
            ]

            if mode in {"monitor", "coach", "research"}:
                return {
                    "assessment": assessment,
                    "suggestions": suggestions,
                }

            return {
                "assessment": assessment,
                "suggestions": suggestions,
                "summary": {
                    "title": task.title,
                    "goal": task.goal,
                    "progress": assessment.progress,
                    "summary_text": summary,
                },
            }

        except Exception as e:
            logger.warning(f"Error during TaskAgent execution: {e}. Falling back to heuristic.")
            return self._run_heuristic_fallback(task, mode, user_input, evidences)


task_agent_service = TaskAgentService()
