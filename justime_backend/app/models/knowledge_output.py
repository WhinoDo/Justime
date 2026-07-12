"""
Knowledge output data models.
"""

import re
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


KnowledgeFormat = Literal[
    "summary",
    "tutorial",
    "faq",
    "cheatsheet",
    "debug_log",
    "mindmap",
    "glossary",
    "timeline",
    "comparison",
    "review",
    "notes",
]

KnowledgeStatus = Literal["draft", "reviewed", "published", "archived"]


def _validate_task_id(value: str) -> str:
    value = (value or "").strip()
    if not value:
        raise ValueError("任务ID不能为空")
    if not re.match(r"^[a-zA-Z0-9_-]+$", value):
        raise ValueError("任务ID格式无效")
    return value


class KnowledgeOutputVersion(BaseModel):
    version: int = Field(..., ge=0)
    title: str = Field(..., min_length=1, max_length=200)
    markdown: str = Field(..., min_length=1, max_length=500000)
    vault_relative_path: str = Field(..., max_length=500)
    status: KnowledgeStatus = "draft"
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    published_at: Optional[datetime] = None


class KnowledgeOutputBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    format: KnowledgeFormat
    markdown: str = Field(..., min_length=1, max_length=500000)
    vault_relative_path: str = Field(..., max_length=500)
    obsidian_tags: List[str] = Field(default_factory=list)
    obsidian_links: List[str] = Field(default_factory=list)

    @field_validator("title", "markdown")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("必填字段不能为空")
        return value

    @field_validator("vault_relative_path")
    @classmethod
    def validate_vault_path(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("Vault路径不能为空")
        if ".." in value or value.startswith("/") or value.startswith("\\"):
            raise ValueError("Vault路径不允许路径遍历或绝对路径")
        if not value.endswith(".md"):
            value = f"{value}.md"
        return value

    @field_validator("obsidian_tags")
    @classmethod
    def validate_tags(cls, value: List[str]) -> List[str]:
        cleaned = [tag.strip().lstrip("#") for tag in value if tag and tag.strip()]
        if len(cleaned) > 30:
            raise ValueError("标签数量不能超过30个")
        return cleaned

    @field_validator("obsidian_links")
    @classmethod
    def validate_links(cls, value: List[str]) -> List[str]:
        cleaned = [link.strip().strip("[]") for link in value if link and link.strip()]
        if len(cleaned) > 50:
            raise ValueError("双链数量不能超过50个")
        return cleaned


class KnowledgeOutputCreate(KnowledgeOutputBase):
    task_id: str = Field(..., max_length=100)
    source_evidence_ids: List[str] = Field(default_factory=list, max_length=100)

    @field_validator("task_id")
    @classmethod
    def validate_task_id(cls, value: str) -> str:
        return _validate_task_id(value)


class KnowledgeOutputUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    markdown: Optional[str] = Field(None, min_length=1, max_length=500000)
    format: Optional[KnowledgeFormat] = None
    status: Optional[KnowledgeStatus] = None
    vault_relative_path: Optional[str] = Field(None, max_length=500)
    obsidian_tags: Optional[List[str]] = None
    obsidian_links: Optional[List[str]] = None

    @field_validator("vault_relative_path")
    @classmethod
    def validate_vault_path(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        if not value:
            return None
        if ".." in value or value.startswith("/") or value.startswith("\\"):
            raise ValueError("Vault路径不允许路径遍历或绝对路径")
        if not value.endswith(".md"):
            value = f"{value}.md"
        return value


class KnowledgeOutputOut(KnowledgeOutputBase):
    id: str
    task_id: str
    userId: str
    status: KnowledgeStatus = "draft"
    source_evidence_ids: List[str] = Field(default_factory=list)
    absolute_path: Optional[str] = None
    published_at: Optional[datetime] = None
    indexing_status: Literal[
        "not_requested", "pending", "success", "failed", "skipped"
    ] = "not_requested"
    indexing_error_code: Optional[str] = None
    indexing_retryable: bool = False
    indexed_at: Optional[datetime] = None
    word_count: int = 0
    version: int = 1
    previous_version_id: Optional[str] = None
    version_history: List[KnowledgeOutputVersion] = Field(default_factory=list)
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


class GenerateKnowledgeRequest(BaseModel):
    task_id: str = Field(..., max_length=100)
    format: KnowledgeFormat = "summary"
    additional_instructions: str = Field("", max_length=2000)
    include_evidence_ids: Optional[List[str]] = None

    @field_validator("task_id")
    @classmethod
    def validate_task_id(cls, value: str) -> str:
        return _validate_task_id(value)


class KnowledgeRollbackRequest(BaseModel):
    version: int = Field(..., ge=0)


class VaultConfig(BaseModel):
    vault_root_path: str = Field(..., max_length=1000)
    auto_publish: bool = False
    conflict_policy: Literal["overwrite", "backup", "rename", "skip"] = "overwrite"
    default_category_mapping: Dict[str, str] = Field(
        default_factory=lambda: {
            "learning": "02-Knowledge",
            "development": "03-Projects",
            "writing": "02-Knowledge",
            "research": "02-Knowledge",
            "reading": "02-Knowledge",
            "project": "03-Projects",
            "practice": "02-Knowledge",
            "other": "00-Inbox",
        }
    )
    frontmatter_template: Dict[str, Any] = Field(
        default_factory=lambda: {
            "source": "justime",
            "type": "{{format}}",
            "tags": "{{obsidian_tags}}",
            "created": "{{created_at}}",
            "task_id": "{{task_id}}",
        }
    )

    @field_validator("vault_root_path")
    @classmethod
    def validate_vault_root(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("Vault根目录不能为空")
        if not value.startswith("/") and not re.match(r"^[A-Z]:\\", value):
            raise ValueError("Vault根目录必须是绝对路径")
        return value.rstrip("/").rstrip("\\")


class VaultConfigUpdate(BaseModel):
    vault_root_path: Optional[str] = Field(None, max_length=1000)
    auto_publish: Optional[bool] = None
    conflict_policy: Optional[Literal["overwrite", "backup", "rename", "skip"]] = None
    default_category_mapping: Optional[Dict[str, str]] = None

    @field_validator("vault_root_path")
    @classmethod
    def validate_vault_root(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        if not value:
            return None
        if not value.startswith("/") and not re.match(r"^[A-Z]:\\", value):
            raise ValueError("Vault根目录必须是绝对路径")
        return value.rstrip("/").rstrip("\\")


class KnowledgeOutputListQuery(BaseModel):
    task_id: Optional[str] = Field(None, max_length=100)
    format: Optional[KnowledgeFormat] = None
    status: Optional[KnowledgeStatus] = None
    search: Optional[str] = Field(None, max_length=200)
    sort_by: Literal["createdAt", "updatedAt", "title"] = "updatedAt"
    sort_order: Literal["asc", "desc"] = "desc"
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)

    @field_validator("task_id")
    @classmethod
    def validate_optional_task_id(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return _validate_task_id(value)
