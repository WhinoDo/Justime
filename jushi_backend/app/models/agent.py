"""
Agent 相关数据模型
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class AgentToolInfo(BaseModel):
    """工具信息模型"""
    name: str = Field(..., description="工具名称")
    description: str = Field(..., description="工具描述")


class AgentRunRequest(BaseModel):
    """Agent 执行请求"""
    task: str = Field(..., description="要执行的任务描述")
    tools: Optional[List[str]] = Field(default=None, description="要使用的工具列表")
    max_steps: Optional[int] = Field(default=10, description="最大执行步数")
    provider: Optional[str] = Field(default=None, description="LLM 提供者名称，不指定则使用默认")


class AgentStep(BaseModel):
    """Agent 执行步骤"""
    step_number: int = Field(..., description="步骤序号")
    thought: Optional[str] = Field(default=None, description="Agent 思考过程")
    action: Optional[str] = Field(default=None, description="执行的动作")
    observation: Optional[str] = Field(default=None, description="执行结果观察")


class AgentRunResponse(BaseModel):
    """Agent 执行响应"""
    success: bool = Field(..., description="执行是否成功")
    result: Optional[Any] = Field(default=None, description="执行结果")
    steps: Optional[List[AgentStep]] = Field(default=None, description="执行步骤列表")
    error: Optional[str] = Field(default=None, description="错误信息")
    provider: Optional[str] = Field(default=None, description="使用的 LLM 提供者")


class AgentStatusResponse(BaseModel):
    """Agent 状态响应"""
    available: bool = Field(..., description="Agent 服务是否可用")
    model: Optional[str] = Field(default=None, description="当前使用的模型")
    tools_count: int = Field(default=0, description="可用工具数量")
    message: str = Field(..., description="状态消息")


class AgentToolsResponse(BaseModel):
    """Agent 工具列表响应"""
    success: bool = Field(..., description="请求是否成功")
    tools: List[AgentToolInfo] = Field(default=[], description="可用工具列表")


class LLMProviderInfo(BaseModel):
    """LLM 提供者信息"""
    name: str = Field(..., description="提供者名称")
    model_id: str = Field(..., description="模型 ID")
    available: bool = Field(..., description="是否可用")


class AgentProvidersResponse(BaseModel):
    """LLM 提供者列表响应"""
    success: bool = Field(..., description="请求是否成功")
    providers: List[LLMProviderInfo] = Field(default=[], description="提供者列表")
    default_provider: str = Field(..., description="默认提供者")
