"""
聊天历史记录数据模型
"""

import re
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator
from datetime import datetime


class ChatMessage(BaseModel):
    """聊天消息模型"""
    id: str = Field(..., alias="_id", description="消息 ID")
    role: str = Field(..., description="角色 (user/ai)")
    content: str = Field(..., max_length=100000, description="消息内容")
    timestamp: datetime = Field(default_factory=datetime.now, description="时间戳")
    taskDecomposition: Optional[Dict[str, Any]] = Field(None, description="任务分解数据")
    multiTaskDecompositions: Optional[List[Dict[str, Any]]] = Field(None, description="多任务分解方案")
    suggestedEvents: Optional[List[Dict[str, Any]]] = Field(None, description="建议的日程事件")
    timingStrategy: Optional[Dict[str, Any]] = Field(None, description="任务调度策略")
    taskAnalysis: Optional[Dict[str, Any]] = Field(None, description="任务分析数据")
    ragReferences: Optional[List[Dict[str, Any]]] = Field(None, description="历史文档引用")

    @field_validator('role')
    @classmethod
    def validate_role(cls, v: str) -> str:
        """验证角色"""
        allowed_roles = ['user', 'ai', 'assistant', 'system']
        if v not in allowed_roles:
            raise ValueError(f'角色必须是: {", ".join(allowed_roles)}')
        return v

    @field_validator('id')
    @classmethod
    def validate_id(cls, v: str) -> str:
        """验证消息ID格式"""
        if not v or not v.strip():
            raise ValueError('消息ID不能为空')
        return v.strip()


class ChatSession(BaseModel):
    """聊天会话模型"""
    id: str = Field(..., alias="_id", description="会话 ID")
    userId: str = Field(..., description="用户 ID")
    title: str = Field(..., max_length=200, description="会话标题")
    updatedAt: datetime = Field(..., description="最后更新时间")
    preview: Optional[str] = Field(None, max_length=500, description="最后一条消息预览")

    @field_validator('id')
    @classmethod
    def validate_session_id(cls, v: str) -> str:
        """验证会话ID格式"""
        if not v or not v.strip():
            raise ValueError('会话ID不能为空')
        return v.strip()

    @field_validator('userId')
    @classmethod
    def validate_user_id(cls, v: str) -> str:
        """验证用户ID"""
        if not v or not v.strip():
            raise ValueError('用户ID不能为空')
        return v.strip()

    @field_validator('title')
    @classmethod
    def validate_title(cls, v: str) -> str:
        """验证会话标题"""
        if not v or not v.strip():
            raise ValueError('会话标题不能为空')
        return v.strip()


class CreateSessionRequest(BaseModel):
    """创建会话请求"""
    title: Optional[str] = Field(None, max_length=200, description="会话标题")

    @field_validator('title')
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        """验证并清理会话标题"""
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        return v


class SessionListResponse(BaseModel):
    """会话列表响应"""
    sessions: List[ChatSession]


class MessageListResponse(BaseModel):
    """消息列表响应"""
    messages: List[ChatMessage]
