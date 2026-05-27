"""
工作文档相关数据模型
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class WorkDocumentBase(BaseModel):
    """工作文档基础字段"""
    eventId: str = Field(..., description="关联的日程事件ID")
    content: str = Field("", description="Markdown内容")


class WorkDocumentCreate(WorkDocumentBase):
    """创建工作文档请求"""
    pass


class WorkDocumentUpdate(BaseModel):
    """更新工作文档请求"""
    content: str = Field(..., description="Markdown内容")


class WorkDocumentOut(WorkDocumentBase):
    """工作文档响应"""
    id: str
    userId: str
    version: int = 0
    lastSavedAt: Optional[datetime] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
