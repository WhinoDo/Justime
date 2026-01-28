"""
聊天历史记录数据模型
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

class ChatMessage(BaseModel):
    """聊天消息模型"""
    role: str = Field(..., description="角色 (user/ai)")
    content: str = Field(..., description="消息内容")
    timestamp: datetime = Field(default_factory=datetime.now, description="时间戳")

class ChatSession(BaseModel):
    """聊天会话模型"""
    id: str = Field(..., alias="_id", description="会话 ID")
    userId: str = Field(..., description="用户 ID")
    title: str = Field(..., description="会话标题")
    updatedAt: datetime = Field(..., description="最后更新时间")
    preview: Optional[str] = Field(None, description="最后一条消息预览")

class CreateSessionRequest(BaseModel):
    """创建会话请求"""
    title: Optional[str] = Field(None, description="会话标题")

class SessionListResponse(BaseModel):
    """会话列表响应"""
    sessions: List[ChatSession]

class MessageListResponse(BaseModel):
    """消息列表响应"""
    messages: List[ChatMessage]
