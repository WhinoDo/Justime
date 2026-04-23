"""
Agent 相关数据模型
"""

import re
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class AgentToolInfo(BaseModel):
    """工具信息模型"""
    name: str = Field(..., min_length=1, max_length=100, description="工具名称")
    description: str = Field(..., max_length=1000, description="工具描述")

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        """验证工具名称"""
        if not v or not v.strip():
            raise ValueError('工具名称不能为空')
        # 工具名称只允许字母、数字、下划线
        if not re.match(r'^[a-zA-Z0-9_]+$', v.strip()):
            raise ValueError('工具名称只能包含字母、数字和下划线')
        return v.strip()


class AgentRunRequest(BaseModel):
    """Agent 执行请求"""
    task: str = Field(..., min_length=1, max_length=10000, description="要执行的任务描述")
    tools: Optional[List[str]] = Field(default=None, max_length=50, description="要使用的工具列表")
    max_steps: Optional[int] = Field(default=10, ge=1, le=100, description="最大执行步数")
    provider: Optional[str] = Field(default=None, max_length=100, description="LLM 提供者名称，不指定则使用默认")

    @field_validator('task')
    @classmethod
    def validate_task(cls, v: str) -> str:
        """验证任务描述"""
        if not v or not v.strip():
            raise ValueError('任务描述不能为空')
        return v.strip()

    @field_validator('tools')
    @classmethod
    def validate_tools(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """验证工具列表"""
        if v is None:
            return v
        if len(v) > 50:
            raise ValueError('工具数量不能超过50个')
        # 验证每个工具名称
        validated_tools = []
        for tool in v:
            if not isinstance(tool, str):
                raise ValueError('工具名称必须是字符串')
            tool = tool.strip()
            if not tool:
                continue
            if not re.match(r'^[a-zA-Z0-9_]+$', tool):
                raise ValueError(f'工具名称格式无效: {tool}')
            validated_tools.append(tool)
        return validated_tools if validated_tools else None

    @field_validator('provider')
    @classmethod
    def validate_provider(cls, v: Optional[str]) -> Optional[str]:
        """验证提供者名称"""
        if v is None or not v.strip():
            return None
        v = v.strip()
        # 提供者名称只允许字母、数字、下划线、短横线
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('提供者名称格式无效')
        return v


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
