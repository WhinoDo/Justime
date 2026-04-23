"""
聊天相关数据模型
"""

import re
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator, model_validator


class SuggestedCalendarEvent(BaseModel):
    """AI 建议的日历事件"""
    title: str = Field(..., max_length=200, description="事件标题")
    description: str = Field("", max_length=2000, description="事件描述")
    start: str = Field(..., description="开始时间 ISO 8601")
    end: str = Field(..., description="结束时间 ISO 8601")
    type: str = Field("other", description="事件类型")
    priority: str = Field("medium", description="优先级")
    location: str = Field("", max_length=500, description="地点")
    allDay: bool = Field(False, description="是否全天事件")
    aiGenerated: bool = Field(True, description="是否由AI生成")

    @field_validator('title')
    @classmethod
    def validate_title(cls, v: str) -> str:
        """验证标题不能为空白"""
        if not v or not v.strip():
            raise ValueError('事件标题不能为空')
        return v.strip()

    @field_validator('type')
    @classmethod
    def validate_type(cls, v: str) -> str:
        """验证事件类型"""
        allowed_types = ['task', 'meeting', 'reminder', 'deadline', 'other']
        if v not in allowed_types:
            raise ValueError(f'事件类型必须是: {", ".join(allowed_types)}')
        return v

    @field_validator('priority')
    @classmethod
    def validate_priority(cls, v: str) -> str:
        """验证优先级"""
        allowed_priorities = ['low', 'medium', 'high', 'urgent']
        if v not in allowed_priorities:
            raise ValueError(f'优先级必须是: {", ".join(allowed_priorities)}')
        return v


# 会话ID验证正则表达式
SESSION_ID_PATTERN = re.compile(r'^[a-fA-F0-9]{24}$|^sess_[a-zA-Z0-9_-]+$')


class ChatRequest(BaseModel):
    """聊天请求"""
    message: str = Field(..., min_length=1, max_length=50000, description="用户消息")
    taskId: Optional[str] = Field(None, max_length=100, description="任务 ID")
    sessionId: Optional[str] = Field(None, max_length=100, description="会话 ID")
    useWebSearch: bool = Field(False, description="是否启用网页搜索")
    useOpenClaw: bool = Field(False, description="是否显式启用 OpenClaw 特殊任务链路")
    taskType: Optional[str] = Field(None, description="任务类型: recitation/thinking/general")
    difficultyLevel: Optional[int] = Field(None, ge=1, le=5, description="任务难度: 1-5")
    urgency: Optional[str] = Field(None, description="紧急程度: low/medium/high")
    routeMode: Optional[str] = Field(
        "auto",
        max_length=20,
        description="路由模式: auto/fast/balanced/reasoning"
    )
    allowReasoningFallback: Optional[bool] = Field(
        True,
        description="主模型失败时是否允许回退到推理模型"
    )
    runtimeModelId: Optional[str] = Field(
        None,
        max_length=100,
        description="运行时指定的优先模型ID（例如从UI下拉列表选取）"
    )

    @field_validator('message')
    @classmethod
    def validate_message(cls, v: str) -> str:
        """验证消息内容"""
        if not v or not v.strip():
            raise ValueError('消息内容不能为空')
        # 去除首尾空白，保留内部格式
        return v.strip()

    @field_validator('sessionId')
    @classmethod
    def validate_session_id(cls, v: Optional[str]) -> Optional[str]:
        """验证会话ID格式"""
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        # 允许 ObjectId 格式或 sess_ 前缀格式
        if not SESSION_ID_PATTERN.match(v):
            raise ValueError('会话ID格式无效')
        return v

    @field_validator('taskType')
    @classmethod
    def validate_task_type(cls, v: Optional[str]) -> Optional[str]:
        """验证任务类型"""
        if v is None:
            return v
        allowed_types = ['recitation', 'thinking', 'general']
        if v not in allowed_types:
            raise ValueError(f'任务类型必须是: {", ".join(allowed_types)}')
        return v

    @field_validator('urgency')
    @classmethod
    def validate_urgency(cls, v: Optional[str]) -> Optional[str]:
        """验证紧急程度"""
        if v is None:
            return v
        allowed_urgencies = ['low', 'medium', 'high']
        if v not in allowed_urgencies:
            raise ValueError(f'紧急程度必须是: {", ".join(allowed_urgencies)}')
        return v

    @field_validator('routeMode')
    @classmethod
    def validate_route_mode(cls, v: Optional[str]) -> Optional[str]:
        """验证路由模式"""
        if v is None:
            return 'auto'
        allowed_modes = ['auto', 'fast', 'balanced', 'reasoning']
        if v not in allowed_modes:
            raise ValueError(f'路由模式必须是: {", ".join(allowed_modes)}')
        return v

    @field_validator('taskId', 'runtimeModelId')
    @classmethod
    def validate_id_fields(cls, v: Optional[str]) -> Optional[str]:
        """验证ID字段，防止注入"""
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        # ID字段只允许字母、数字、下划线、短横线
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('ID格式无效，只允许字母、数字、下划线和短横线')
        return v

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
    timingStrategy: Optional[Dict[str, Any]] = Field(None, description="任务时间调度策略")
    taskAnalysis: Optional[Dict[str, Any]] = Field(None, description="任务分析结果")
    ragReferences: Optional[List[Dict[str, Any]]] = Field(None, description="RAG 引用文档")
    routingMeta: Optional[Dict[str, Any]] = Field(None, description="模型路由元信息")


class ChatResponse(BaseModel):
    """聊天响应"""
    success: bool = Field(..., description="是否成功")
    data: Dict[str, Any] = Field(..., description="响应数据")
    error: Optional[Dict[str, Any]] = Field(None, description="错误信息")


class LLMTestRequest(BaseModel):
    """LLM 连接测试请求"""
    modelId: str = Field(..., min_length=1, max_length=200, description="模型 ID")
    baseUrl: str = Field(..., min_length=1, max_length=500, description="API 基础 URL")
    apiKey: str = Field(..., min_length=1, max_length=500, description="API 密钥")
    timeout: Optional[int] = Field(60, ge=5, le=600, description="超时时间（秒）")

    @field_validator('modelId')
    @classmethod
    def validate_model_id(cls, v: str) -> str:
        """验证模型ID"""
        if not v or not v.strip():
            raise ValueError('模型ID不能为空')
        return v.strip()

    @field_validator('baseUrl')
    @classmethod
    def validate_base_url(cls, v: str) -> str:
        """验证API基础URL"""
        if not v or not v.strip():
            raise ValueError('API基础URL不能为空')
        v = v.strip()
        # 基本URL格式验证
        if not v.startswith(('http://', 'https://')):
            raise ValueError('API基础URL必须以 http:// 或 https:// 开头')
        return v.rstrip('/')  # 移除末尾斜杠

    @field_validator('apiKey')
    @classmethod
    def validate_api_key(cls, v: str) -> str:
        """验证API密钥"""
        if not v or not v.strip():
            raise ValueError('API密钥不能为空')
        return v.strip()
