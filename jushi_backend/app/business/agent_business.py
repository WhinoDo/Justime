"""
Agent 业务逻辑层
处理 Agent 相关的业务逻辑，支持多 LLM 提供者
"""

from fastapi import HTTPException, status
from typing import Optional, List, Dict, Any

from app.services.agent_service import agent_service
from app.models.agent import (
    AgentRunRequest,
    AgentRunResponse,
    AgentStep,
    AgentStatusResponse,
    AgentToolsResponse,
    AgentToolInfo,
    AgentProvidersResponse,
    LLMProviderInfo
)


class AgentBusiness:
    """Agent 业务逻辑类"""
    
    def __init__(self):
        self.service = agent_service
    
    async def get_status(self, provider: Optional[str] = None) -> AgentStatusResponse:
        """获取 Agent 服务状态"""
        available = await self.service.is_available(provider)
        model = await self.service.get_model_info(provider)
        tools = self.service.get_available_tools()
        
        if available:
            message = f"Agent 服务运行正常，使用模型: {model}"
        else:
            message = f"LLM 提供者 '{provider or 'database'}' 不可用，请检查管理员模型配置"
        
        return AgentStatusResponse(
            available=available,
            model=model,
            tools_count=len(tools),
            message=message
        )
    
    def get_tools(self) -> AgentToolsResponse:
        """获取可用工具列表"""
        tools_data = self.service.get_available_tools()
        
        tools = [
            AgentToolInfo(name=t["name"], description=t["description"])
            for t in tools_data
        ]
        
        return AgentToolsResponse(
            success=True,
            tools=tools
        )
    
    async def get_providers(self) -> AgentProvidersResponse:
        """获取所有 LLM 提供者列表"""
        providers_data = await self.service.get_available_providers()
        
        providers = [
            LLMProviderInfo(
                name=p["name"],
                model_id=p["model_id"],
                available=p["available"]
            )
            for p in providers_data
        ]
        
        return AgentProvidersResponse(
            success=True,
            providers=providers,
            default_provider=providers[0].name if providers else "database"
        )
    
    async def run_task(self, request: AgentRunRequest) -> AgentRunResponse:
        """
        执行 Agent 任务
        
        Args:
            request: Agent 执行请求
            
        Returns:
            Agent 执行响应
        """
        if not request.task or not request.task.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="任务描述不能为空"
            )
        
        result = await self.service.run_task(
            task=request.task,
            max_steps=request.max_steps or 10,
            provider=request.provider
        )
        
        if not result.get("success"):
            error_msg = result.get("error", "Agent 任务执行失败")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )
        
        steps = None
        if result.get("steps"):
            steps = [
                AgentStep(
                    step_number=s["step_number"],
                    thought=s.get("thought"),
                    action=s.get("action"),
                    observation=s.get("observation")
                )
                for s in result["steps"]
            ]
        
        return AgentRunResponse(
            success=True,
            result=result["result"],
            steps=steps,
            provider=result.get("provider")
        )


# 创建全局业务实例
agent_business = AgentBusiness()
