"""
书籍 PDF -> NotebookLM 分析相关数据模型
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


ProjectStatus = Literal["draft", "running", "completed", "failed", "completed_with_errors"]
ChapterStatus = Literal["draft", "running", "completed", "failed", "completed_with_errors"]


class BookAnalysisChapterInput(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    startPage: int = Field(..., ge=1)
    endPage: int = Field(..., ge=1)


class BookAnalysisChapterUpdateRequest(BaseModel):
    chapters: List[BookAnalysisChapterInput] = Field(..., min_length=1)


class BookAnalysisChapter(BaseModel):
    id: str
    title: str
    startPage: int
    endPage: int
    status: ChapterStatus = "draft"
    summary: str = ""
    keyPoints: List[str] = Field(default_factory=list)
    arguments: List[str] = Field(default_factory=list)
    examples: List[str] = Field(default_factory=list)
    evidence: List[str] = Field(default_factory=list)
    quotedEvidence: List[str] = Field(default_factory=list)
    openQuestions: List[str] = Field(default_factory=list)
    rawAnswer: str = ""
    error: Optional[str] = None


class BookAnalysisCreateResponse(BaseModel):
    project: dict

