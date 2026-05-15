"""
Agent API 端点
提供 Agent 相关的 RESTful API，支持多 LLM 提供者
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional, Dict, Any

from app.business.agent_business import agent_business
from app.models.agent import (
    AgentRunRequest,
    AgentRunResponse,
    AgentStatusResponse,
    AgentToolsResponse,
    AgentProvidersResponse
)
from app.services.security_service import SecurityService

router = APIRouter()


@router.get("/status", response_model=AgentStatusResponse)
async def get_agent_status(
    provider: Optional[str] = Query(None, description="LLM 提供者名称"),
    current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)
):
    """
    获取 Agent 服务状态
    
    返回 Agent 服务的可用性、当前模型和工具数量
    
    - **provider**: LLM 提供者名称（可选，不指定则使用默认）
    """
    _ = current_user
    try:
        return await agent_business.get_status(provider)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取状态失败: {str(e)}")


@router.get("/providers", response_model=AgentProvidersResponse)
async def get_agent_providers(
    current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)
):
    """
    获取所有 LLM 提供者列表
    
    返回所有配置的 LLM 提供者及其可用状态
    """
    _ = current_user
    try:
        return await agent_business.get_providers()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取提供者列表失败: {str(e)}")


@router.get("/tools", response_model=AgentToolsResponse)
async def get_agent_tools(
    current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)
):
    """
    获取可用工具列表
    
    返回 Agent 可以使用的所有工具信息
    """
    _ = current_user
    try:
        return agent_business.get_tools()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取工具列表失败: {str(e)}")


@router.post("/run", response_model=AgentRunResponse)
async def run_agent_task(
    request: AgentRunRequest,
    current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)
):
    """
    执行 Agent 任务
    
    根据任务描述，Agent 会自动规划和执行步骤来完成任务
    
    - **task**: 任务描述（必填）
    - **tools**: 要使用的工具列表（可选）
    - **max_steps**: 最大执行步数（可选，默认 10）
    - **provider**: LLM 提供者名称（可选，不指定则使用默认）
    """
    _ = current_user
    try:
        result = await agent_business.run_task(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"任务执行失败: {str(e)}")
