"""
日历事件相关数据模型
"""

from datetime import datetime
from typing import List, Optional, Literal

from pydantic import BaseModel, Field

EventType = Literal["task", "meeting", "reminder", "deadline", "other"]
EventPriority = Literal["low", "medium", "high", "urgent"]
EventStatus = Literal["pending", "confirmed", "completed", "cancelled"]


class Reminder(BaseModel):
    """提醒设置"""
    minutes: int = Field(..., ge=0, description="提前多少分钟提醒")
    sent: bool = Field(False, description="是否已发送")


class CalendarEventBase(BaseModel):
    """日历事件基础字段"""
    title: str = Field(..., max_length=200, description="事件标题")
    description: str = Field("", max_length=1000, description="事件描述")
    start: datetime = Field(..., description="开始时间")
    end: datetime = Field(..., description="结束时间")
    allDay: bool = Field(False, description="是否全天事件")
    type: EventType = Field("other", description="事件类型")
    priority: EventPriority = Field("medium", description="优先级")
    status: EventStatus = Field("pending", description="事件状态")
    color: Optional[str] = Field(None, description="事件颜色")
    location: Optional[str] = Field(None, max_length=200, description="地点")
    reminders: Optional[List[Reminder]] = Field(None, description="提醒设置")
    emotionScore: Optional[int] = Field(None, ge=0, le=10, description="创建时情绪分数")
    aiGenerated: bool = Field(False, description="是否由AI生成")
    taskId: Optional[str] = Field(None, description="关联任务ID")


class CalendarEventCreate(CalendarEventBase):
    """创建日历事件请求"""
    pass


class CalendarEventUpdate(BaseModel):
    """更新日历事件请求"""
    title: Optional[str] = None
    description: Optional[str] = None
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    allDay: Optional[bool] = None
    type: Optional[EventType] = None
    priority: Optional[EventPriority] = None
    status: Optional[EventStatus] = None
    color: Optional[str] = None
    location: Optional[str] = None
    reminders: Optional[List[Reminder]] = None
    emotionScore: Optional[int] = Field(None, ge=0, le=10)
    aiGenerated: Optional[bool] = None
    taskId: Optional[str] = None


class CalendarEventOut(CalendarEventBase):
    """日历事件响应"""
    id: str
    userId: str
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
