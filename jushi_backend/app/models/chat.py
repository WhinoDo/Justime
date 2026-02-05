"""
聊天相关数据模型
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class SuggestedCalendarEvent(BaseModel):
    """AI 建议的日历事件"""
    title: str = Field(..., description="事件标题")
    description: str = Field("", description="事件描述")
    start: str = Field(..., description="开始时间 ISO 8601")
    end: str = Field(..., description="结束时间 ISO 8601")
    type: str = Field("other", description="事件类型")
    priority: str = Field("medium", description="优先级")
    location: str = Field("", description="地点")
    allDay: bool = Field(False, description="是否全天事件")
    aiGenerated: bool = Field(True, description="是否由AI生成")


class ChatRequest(BaseModel):
    """聊天请求"""
    message: str = Field(..., description="用户消息")
    taskId: Optional[str] = Field(None, description="任务 ID")
    sessionId: Optional[str] = Field(None, description="会话 ID")
    useWebSearch: bool = Field(False, description="是否启用网页搜索")


class ChatResponseData(BaseModel):
    """聊天响应数据"""
    response: str = Field("", description="AI 回复内容")
    emotionScore: int = Field(5, description="情绪分数")
    emotionTags: List[str] = Field(default_factory=list, description="情绪标签")
    needsEmotionInput: bool = Field(False, description="是否需要情绪输入")
    suggestedEvents: List[SuggestedCalendarEvent] = Field(default_factory=list, description="AI 建议的日程")
    taskResult: Optional[Dict[str, Any]] = Field(None, description="任务结果")
    taskDecomposition: Optional[Dict[str, Any]] = Field(None, description="单个任务分解 (Legacy)")
    multiTaskDecompositions: Optional[List[Dict[str, Any]]] = Field(None, description="多模型任务分解结果")


class ChatResponse(BaseModel):
    """聊天响应"""
    success: bool = Field(..., description="是否成功")
    data: Dict[str, Any] = Field(..., description="响应数据")
    error: Optional[Dict[str, Any]] = Field(None, description="错误信息")


class LLMTestRequest(BaseModel):
    """LLM 连接测试请求"""
    modelId: str = Field(..., description="模型 ID")
    baseUrl: str = Field(..., description="API 基础 URL")
    apiKey: str = Field(..., description="API 密钥")
    timeout: Optional[int] = Field(60, description="超时时间（秒）")

