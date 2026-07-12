"""
TaskProcess data models.

TaskProcess is the core lifecycle entity for Justime:
before -> during -> after.
"""

import re
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


TaskStatus = Literal[
    "draft",
    "planned",
    "active",
    "paused",
    "blocked",
    "completed",
    "archived",
]

TaskPhase = Literal["before", "during", "after"]
TaskPriority = Literal["low", "medium", "high", "critical"]
TaskCategory = Literal[
    "learning",
    "development",
    "writing",
    "research",
    "reading",
    "project",
    "practice",
    "other",
]
ProgressSource = Literal["manual", "ai", "evidence"]
MilestoneStatus = Literal["pending", "active", "completed", "skipped"]
AgentMode = Literal["plan", "research", "monitor", "coach", "summarize", "knowledge"]


def _validate_loose_id(value: str, field_name: str) -> str:
    value = (value or "").strip()
    if not value:
        raise ValueError(f"{field_name}不能为空")
    if not re.match(r"^[a-zA-Z0-9_-]+$", value):
        raise ValueError(f"{field_name}格式无效")
    return value


class Milestone(BaseModel):
    id: str = Field(..., max_length=50)
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field("", max_length=2000)
    order: int = Field(0, ge=0)
    status: MilestoneStatus = "pending"
    target_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        return _validate_loose_id(value, "里程碑ID")

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("里程碑标题不能为空")
        return value


class MilestoneStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: MilestoneStatus


class LearningMaterial(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    url: Optional[str] = Field(None, max_length=2000)
    summary: str = Field(..., min_length=1, max_length=2000)
    source: str = Field(..., min_length=1, max_length=200)

    @field_validator("title", "summary", "source")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("学习资料字段不能为空")
        return value

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return value.strip() or None


class PreparationItem(BaseModel):
    id: str = Field(..., max_length=50)
    title: str = Field(..., min_length=1, max_length=200)
    done: bool = False
    order: int = Field(0, ge=0)

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        return _validate_loose_id(value, "准备项ID")

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("准备项标题不能为空")
        return value


class Blocker(BaseModel):
    id: str = Field(..., max_length=50)
    description: str = Field(..., min_length=1, max_length=2000)
    severity: Literal["low", "medium", "high"] = "medium"
    resolved: bool = False
    resolution: Optional[str] = Field(None, max_length=2000)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        return _validate_loose_id(value, "阻塞点ID")

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("阻塞描述不能为空")
        return value


class AISuggestion(BaseModel):
    id: str = Field(..., max_length=50)
    type: Literal["next_step", "resource", "review", "alert", "optimization"]
    content: str = Field(..., min_length=1, max_length=5000)
    accepted: Optional[bool] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        return _validate_loose_id(value, "建议ID")


class AIAssessment(BaseModel):
    progress: float = Field(..., ge=0.0, le=1.0)
    confidence: float = Field(..., ge=0.0, le=1.0)
    summary: str = Field("", max_length=2000)
    blockers_identified: List[str] = Field(default_factory=list)
    next_steps: List[str] = Field(default_factory=list)
    assessed_at: datetime = Field(default_factory=datetime.utcnow)


class TaskProcessBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field("", max_length=5000)
    goal: str = Field(..., min_length=1, max_length=2000)
    category: TaskCategory = "other"
    tags: List[str] = Field(default_factory=list)
    priority: TaskPriority = "medium"
    estimated_hours: Optional[float] = Field(None, ge=0.0, le=10000)
    deadline: Optional[datetime] = None
    materials: List[LearningMaterial] = Field(default_factory=list)
    preparation_items: List[PreparationItem] = Field(default_factory=list)

    @field_validator("title", "goal")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("必填字段不能为空")
        return value

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str) -> str:
        return (value or "").strip()

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: List[str]) -> List[str]:
        cleaned = [tag.strip() for tag in (value or []) if tag and tag.strip()]
        if len(cleaned) > 20:
            raise ValueError("标签数量不能超过20个")
        return cleaned


class TaskProcessCreate(TaskProcessBase):
    initial_chat_session_id: Optional[str] = Field(None, max_length=100)
    initial_calendar_event_id: Optional[str] = Field(None, max_length=100)
    auto_plan: bool = True


class TaskProcessUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    goal: Optional[str] = Field(None, min_length=1, max_length=2000)
    category: Optional[TaskCategory] = None
    tags: Optional[List[str]] = None
    status: Optional[TaskStatus] = None
    phase: Optional[TaskPhase] = None
    priority: Optional[TaskPriority] = None
    progress: Optional[float] = Field(None, ge=0.0, le=1.0)
    estimated_hours: Optional[float] = Field(None, ge=0.0, le=10000)
    deadline: Optional[datetime] = None
    materials: List[LearningMaterial] = Field(default_factory=list)
    preparation_items: List[PreparationItem] = Field(default_factory=list)

    @field_validator("title", "goal", "description")
    @classmethod
    def validate_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("字段不能为空字符串")
        return value

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is None:
            return value
        cleaned = [tag.strip() for tag in value if tag and tag.strip()]
        if len(cleaned) > 20:
            raise ValueError("标签数量不能超过20个")
        return cleaned


class TaskProcessOut(TaskProcessBase):
    id: str
    userId: str
    status: TaskStatus = "draft"
    phase: TaskPhase = "before"
    progress: float = Field(0.0, ge=0.0, le=1.0)
    progress_source: ProgressSource = "manual"
    actual_hours: float = 0.0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    milestones: List[Milestone] = Field(default_factory=list)
    blockers: List[Blocker] = Field(default_factory=list)
    ai_suggestions: List[AISuggestion] = Field(default_factory=list)
    ai_last_assessment: Optional[AIAssessment] = None
    ai_plan: Optional[Dict[str, Any]] = None
    parent_task_id: Optional[str] = None
    related_chat_session_ids: List[str] = Field(default_factory=list)
    related_calendar_event_ids: List[str] = Field(default_factory=list)
    evidence_count: int = 0
    knowledge_output_count: int = 0
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


class MilestoneCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field("", max_length=2000)
    target_date: Optional[datetime] = None
    order: int = Field(0, ge=0)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("里程碑标题不能为空")
        return value


class MilestoneUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    status: Optional[MilestoneStatus] = None
    target_date: Optional[datetime] = None
    order: Optional[int] = Field(None, ge=0)


class BlockerCreate(BaseModel):
    description: str = Field(..., min_length=1, max_length=2000)
    severity: Literal["low", "medium", "high"] = "medium"

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("阻塞描述不能为空")
        return value


class BlockerResolve(BaseModel):
    resolution: str = Field(..., min_length=1, max_length=2000)

    @field_validator("resolution")
    @classmethod
    def validate_resolution(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("解决方案不能为空")
        return value


class TaskAgentRequest(BaseModel):
    task_id: str = Field(..., max_length=100)
    mode: AgentMode
    user_input: str = Field("", max_length=10000)
    context: Optional[Dict[str, Any]] = None

    @field_validator("task_id")
    @classmethod
    def validate_task_id(cls, value: str) -> str:
        return _validate_loose_id(value, "任务ID")


class TaskAgentResponse(BaseModel):
    success: bool
    mode: AgentMode
    result: Optional[Dict[str, Any]] = None
    suggestions: List[AISuggestion] = Field(default_factory=list)
    assessment: Optional[AIAssessment] = None
    error: Optional[str] = None


class TaskProcessListQuery(BaseModel):
    status: Optional[TaskStatus] = None
    phase: Optional[TaskPhase] = None
    category: Optional[TaskCategory] = None
    priority: Optional[TaskPriority] = None
    search: Optional[str] = Field(None, max_length=200)
    sort_by: Literal["createdAt", "updatedAt", "deadline", "priority", "progress"] = "updatedAt"
    sort_order: Literal["asc", "desc"] = "desc"
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)
