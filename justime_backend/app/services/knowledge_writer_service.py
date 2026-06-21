"""Knowledge output writer service."""

import re
import yaml
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.models.evidence import EvidenceOut
from app.models.knowledge_output import KnowledgeFormat, KnowledgeOutputCreate
from app.models.task_process import TaskProcessOut

logger = logging.getLogger(__name__)


class KnowledgeWriterService:
    def _safe_name(self, value: str) -> str:
        sanitized = re.sub(r"[\\/:*?\"<>|]", "-", (value or "").strip())
        sanitized = re.sub(r"\s+", "-", sanitized)
        return sanitized.strip("-") or "untitled"

    def _build_frontmatter_custom(self, task: TaskProcessOut, output_format: KnowledgeFormat, tags: List[str], config: Optional[Any] = None) -> str:
        created = datetime.utcnow().date().isoformat()
        
        context = {
            "title": task.title,
            "task_title": task.title,
            "format": output_format,
            "obsidian_tags": tags,
            "created_at": created,
            "updated_at": created,
            "task_id": task.id,
            "category": task.category,
            "status": task.status,
        }
        
        template = None
        if config and hasattr(config, "frontmatter_template") and config.frontmatter_template:
            template = config.frontmatter_template
            
        if not template:
            template = {
                "title": "{{task_title}}",
                "tags": "{{obsidian_tags}}",
                "created": "{{created_at}}",
                "updated": "{{updated_at}}",
                "task_id": "{{task_id}}",
                "status": "completed"
            }
            
        rendered = {}
        for key, val in template.items():
            if isinstance(val, str):
                rendered_val = val
                for placeholder_key, placeholder_val in context.items():
                    placeholder = f"{{{{{placeholder_key}}}}}"
                    if placeholder in rendered_val:
                        if isinstance(placeholder_val, list):
                            if rendered_val == placeholder:
                                rendered_val = placeholder_val
                            else:
                                rendered_val = rendered_val.replace(placeholder, ", ".join(placeholder_val))
                        else:
                            rendered_val = rendered_val.replace(placeholder, str(placeholder_val))
                rendered[key] = rendered_val
            else:
                rendered[key] = val
                
        # Ensure title and tags are present
        rendered.setdefault("title", task.title)
        rendered.setdefault("tags", tags)
        
        yaml_str = yaml.safe_dump(rendered, allow_unicode=True, default_flow_style=False)
        return f"---\n{yaml_str}---"

    def _category_dir(self, task: TaskProcessOut) -> str:
        mapping = {
            "learning": "02-Knowledge",
            "development": "03-Projects",
            "writing": "02-Knowledge",
            "research": "02-Knowledge",
            "reading": "02-Knowledge",
            "project": "03-Projects",
            "practice": "02-Knowledge",
            "other": "00-Inbox",
        }
        return mapping.get(task.category, "00-Inbox")

    def _build_body(
        self,
        task: TaskProcessOut,
        evidences: List[EvidenceOut],
        output_format: KnowledgeFormat,
        additional_instructions: str,
    ) -> str:
        highlights = [
            f"- {item.title or item.type}: {item.content[:180]}"
            for item in evidences[:12]
        ]
        if not highlights:
            highlights = ["- 暂无 Evidence，当前知识输出基于任务目标和里程碑生成。"]

        milestone_lines = [f"- {item.title} ({item.status})" for item in task.milestones] or ["- 暂无里程碑"]
        next_steps = [
            f"- {item.content}" for item in task.ai_suggestions[:5]
        ] or ["- 后续可继续补充执行细节或形成 FAQ / cheatsheet。"]

        sections = [
            f"# {task.title}",
            "",
            "## 任务目标",
            task.goal,
            "",
            "## 任务概览",
            f"- 类别: {task.category}",
            f"- 阶段: {task.phase}",
            f"- 状态: {task.status}",
            f"- 输出格式: {output_format}",
            "",
            "## 里程碑",
            *milestone_lines,
            "",
            "## Evidence 摘要",
            *highlights,
            "",
            "## 复盘与后续",
            *next_steps,
        ]

        if additional_instructions.strip():
            sections.extend(["", "## 用户补充要求", additional_instructions.strip()])

        return "\n".join(sections).strip() + "\n"

    def _generate_wikilinks(self, body: str, other_titles: List[str]) -> tuple[str, List[str]]:
        # Sort titles by length descending so that we match longer titles first
        sorted_titles = sorted(list(set(other_titles)), key=len, reverse=True)
        links = []
        for title in sorted_titles:
            title_stripped = title.strip()
            if not title_stripped or len(title_stripped) < 2:
                continue
            # Match title as a whole word, not preceded by [[ and not followed by ]]
            pattern = re.compile(rf'(?<!\[\[)\b{re.escape(title_stripped)}\b(?!\]\])', re.IGNORECASE)
            if pattern.search(body):
                body = pattern.sub(f"[[{title_stripped}]]", body)
                links.append(title_stripped)
        return body, links

    async def build_output(
        self,
        task: TaskProcessOut,
        evidences: List[EvidenceOut],
        output_format: KnowledgeFormat,
        additional_instructions: str = "",
        include_evidence_ids: Optional[List[str]] = None,
    ) -> KnowledgeOutputCreate:
        if include_evidence_ids:
            allowed = set(include_evidence_ids)
            evidences = [item for item in evidences if item.id in allowed]

        tags = ["justime-task", task.category, *task.tags]
        tags = [tag for tag in tags if tag]
        file_name = f"{self._safe_name(task.title)}.md"
        relative_path = f"{self._category_dir(task)}/{file_name}"
        
        # 1. Fetch other titles to generate Wikilinks
        from app.database import db
        other_titles = []
        if db.db is not None:
            try:
                cursor = db.db.knowledge_outputs.find({"userId": task.userId}, {"title": 1})
                other_docs = await cursor.to_list(length=1000)
                other_titles = [doc["title"] for doc in other_docs if doc.get("title")]
            except Exception as e:
                logger.warning(f"Failed to query other knowledge output titles: {e}")
                
        # 2. Get user's VaultConfig
        from app.services.markdown_export_service import markdown_export_service
        config = None
        try:
            config = await markdown_export_service.get_vault_config(task.userId)
        except Exception as e:
            logger.warning(f"Failed to load user vault config: {e}")

        # 3. Try LLM generation for the body (knowledge mode)
        body = ""
        obsidian_links = []
        try:
            from app.services.task_agent_service import task_agent_service
            agent_result = await task_agent_service.run(
                task=task,
                mode="knowledge",
                user_input=additional_instructions,
                evidences=evidences
            )
            body = agent_result.get("markdown") or ""
        except Exception as exc:
            logger.warning(f"LLM knowledge generation failed, falling back to heuristic body: {exc}")
            
        if not body.strip():
            body = self._build_body(task, evidences, output_format, additional_instructions)
            
        # 4. Auto-generate Wikilinks (replace terms with [[Wikilinks]])
        body, obsidian_links = self._generate_wikilinks(body, other_titles)

        # 5. Build dynamic frontmatter
        frontmatter = self._build_frontmatter_custom(task, output_format, tags, config)
        markdown = f"{frontmatter}\n\n{body}".strip() + "\n"

        return KnowledgeOutputCreate(
            task_id=task.id,
            title=task.title,
            format=output_format,
            markdown=markdown,
            vault_relative_path=relative_path,
            source_evidence_ids=[item.id for item in evidences],
            obsidian_tags=tags,
            obsidian_links=obsidian_links,
        )


knowledge_writer_service = KnowledgeWriterService()
