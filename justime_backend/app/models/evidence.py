"""
Evidence data models.
"""

import re
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


EvidenceType = Literal[
    "note",
    "file",
    "chat",
    "code_commit",
    "link",
    "time_log",
    "quiz_result",
    "review",
    "milestone_complete",
    "manual",
]

EvidenceSentiment = Literal["positive", "neutral", "negative", "blocked"]


def _validate_id(value: str, field_name: str) -> str:
    value = (value or "").strip()
    if not value:
        raise ValueError(f"{field_name}不能为空")
    if not re.match(r"^[a-zA-Z0-9_-]+$", value):
        raise ValueError(f"{field_name}格式无效")
    return value


class EvidenceBase(BaseModel):
    type: EvidenceType
    title: str = Field("", max_length=200)
    content: str = Field(..., min_length=1, max_length=50000)
    source: str = Field("", max_length=500)
    source_id: Optional[str] = Field(None, max_length=200)
    milestone_id: Optional[str] = Field(None, max_length=50)
    metadata: Optional[Dict[str, Any]] = None

    @field_validator("title", "source")
    @classmethod
    def validate_loose_text(cls, value: str) -> str:
        return (value or "").strip()

    @field_validator("source_id", mode="before")
    @classmethod
    def validate_source_id(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("Evidence内容不能为空")
        return value

    @field_validator("milestone_id")
    @classmethod
    def validate_milestone_id(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return _validate_id(value, "里程碑ID")


class EvidenceCreate(EvidenceBase):
    task_id: str = Field(..., max_length=100)

    @field_validator("task_id")
    @classmethod
    def validate_task_id(cls, value: str) -> str:
        return _validate_id(value, "任务ID")


class EvidenceUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    content: Optional[str] = Field(None, min_length=1, max_length=50000)
    milestone_id: Optional[str] = Field(None, max_length=50)
    metadata: Optional[Dict[str, Any]] = None


class EvidenceOut(EvidenceBase):
    id: str
    task_id: str
    userId: str
    ai_extracted: bool = False
    sentiment: Optional[EvidenceSentiment] = None
    confidence: float = Field(1.0, ge=0.0, le=1.0)
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


class EvidenceBatchCreate(BaseModel):
    task_id: str = Field(..., max_length=100)
    items: List[EvidenceBase] = Field(..., min_length=1, max_length=50)

    @field_validator("task_id")
    @classmethod
    def validate_task_id(cls, value: str) -> str:
        return _validate_id(value, "任务ID")


class EvidenceListQuery(BaseModel):
    task_id: str = Field(..., max_length=100)
    type: Optional[EvidenceType] = None
    milestone_id: Optional[str] = None
    ai_extracted: Optional[bool] = None
    sort_by: Literal["createdAt", "type"] = "createdAt"
    sort_order: Literal["asc", "desc"] = "desc"
    page: int = Field(1, ge=1)
    page_size: int = Field(50, ge=1, le=200)

    @field_validator("task_id")
    @classmethod
    def validate_task_id(cls, value: str) -> str:
        return _validate_id(value, "任务ID")


class TimeLogCreate(BaseModel):
    task_id: str = Field(..., max_length=100)
    hours: float = Field(..., gt=0, le=24)
    date: Optional[datetime] = None
    notes: str = Field("", max_length=2000)
    milestone_id: Optional[str] = Field(None, max_length=50)

    @field_validator("task_id")
    @classmethod
    def validate_task_id(cls, value: str) -> str:
        return _validate_id(value, "任务ID")
