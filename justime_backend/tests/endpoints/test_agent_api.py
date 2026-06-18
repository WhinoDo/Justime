"""
Agent API 端点测试
测试 /api/v1/agent/* 端点的认证、正常响应和异常处理
"""
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

# 端点模块内：from app.business.agent_business import agent_business
# 因此在 app.api.v1.endpoints.agent 命名空间打补丁
AGENT_BUSINESS_PATCH = "app.api.v1.endpoints.agent.agent_business"


class TestAgentStatus:
    """GET /api/v1/agent/status 测试"""

    async def test_unauthorized(self, client: AsyncClient, clean_db):
        """未认证用户返回401"""
        response = await client.get("/api/v1/agent/status")
        assert response.status_code == 401

    async def test_service_available(
        self, client: AsyncClient, auth_headers, clean_db
    ):
        """Agent 服务可用时返回状态信息"""
        with patch(
            AGENT_BUSINESS_PATCH
        ) as mock_business:
            mock_business.get_status = AsyncMock(return_value={
                "available": True,
                "model": "gpt-4: gpt-4-turbo",
                "tools_count": 5,
                "message": "Agent 服务运行正常，使用模型: gpt-4: gpt-4-turbo",
            })

            response = await client.get(
                "/api/v1/agent/status", headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["available"] is True
            assert data["model"] is not None
            assert data["tools_count"] >= 0
            assert "message" in data

    async def test_service_unavailable(
        self, client: AsyncClient, auth_headers, clean_db
    ):
        """Agent 服务不可用时返回 available=False"""
        with patch(
            AGENT_BUSINESS_PATCH
        ) as mock_business:
            mock_business.get_status = AsyncMock(return_value={
                "available": False,
                "model": None,
                "tools_count": 0,
                "message": "LLM 提供者 'database' 不可用，请检查管理员模型配置",
            })

            response = await client.get(
                "/api/v1/agent/status", headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["available"] is False
            assert data["tools_count"] == 0

    async def test_with_provider(
        self, client: AsyncClient, auth_headers, clean_db
    ):
        """指定 provider 参数时传入正确查询参数"""
        with patch(
            AGENT_BUSINESS_PATCH
        ) as mock_business:
            mock_business.get_status = AsyncMock(return_value={
                "available": True,
                "model": "deepseek: deepseek-chat",
                "tools_count": 5,
                "message": "Agent 服务运行正常，使用模型: deepseek: deepseek-chat",
            })

            response = await client.get(
                "/api/v1/agent/status",
                params={"provider": "deepseek"},
                headers=auth_headers,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["available"] is True
            mock_business.get_status.assert_called_once_with("deepseek")

    async def test_business_exception(
        self, client: AsyncClient, auth_headers, clean_db
    ):
        """业务层异常时返回500"""
        with patch(
            AGENT_BUSINESS_PATCH
        ) as mock_business:
            mock_business.get_status = AsyncMock(
                side_effect=Exception("数据库连接失败")
            )

            response = await client.get(
                "/api/v1/agent/status", headers=auth_headers
            )
            assert response.status_code == 500
            data = response.json()
            assert data["success"] is False
            assert "error" in data


class TestAgentProviders:
    """GET /api/v1/agent/providers 测试"""

    async def test_unauthorized(self, client: AsyncClient, clean_db):
        """未认证用户返回401"""
        response = await client.get("/api/v1/agent/providers")
        assert response.status_code == 401

    async def test_success(
        self, client: AsyncClient, auth_headers, clean_db
    ):
        """成功获取提供者列表"""
        providers_data = [
            {"name": "provider-a", "model_id": "gpt-4", "available": True},
            {"name": "provider-b", "model_id": "deepseek-chat", "available": True},
        ]

        with patch(
            AGENT_BUSINESS_PATCH
        ) as mock_business:
            mock_business.get_providers = AsyncMock(return_value={
                "success": True,
                "providers": providers_data,
                "default_provider": "provider-a",
            })

            response = await client.get(
                "/api/v1/agent/providers", headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert len(data["providers"]) == 2
            assert data["default_provider"] == "provider-a"
            assert data["providers"][0]["name"] == "provider-a"
            assert data["providers"][1]["name"] == "provider-b"

    async def test_empty_providers(
        self, client: AsyncClient, auth_headers, clean_db
    ):
        """无可用提供者时返回空列表"""
        with patch(
            AGENT_BUSINESS_PATCH
        ) as mock_business:
            mock_business.get_providers = AsyncMock(return_value={
                "success": True,
                "providers": [],
                "default_provider": "database",
            })

            response = await client.get(
                "/api/v1/agent/providers", headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["providers"] == []
            assert data["default_provider"] == "database"

    async def test_business_exception(
        self, client: AsyncClient, auth_headers, clean_db
    ):
        """业务层异常时返回500"""
        with patch(
            AGENT_BUSINESS_PATCH
        ) as mock_business:
            mock_business.get_providers = AsyncMock(
                side_effect=Exception("获取提供者失败")
            )

            response = await client.get(
                "/api/v1/agent/providers", headers=auth_headers
            )
            assert response.status_code == 500
            data = response.json()
            assert data["success"] is False
            assert "error" in data


class TestAgentTools:
    """GET /api/v1/agent/tools 测试"""

    async def test_unauthorized(self, client: AsyncClient, clean_db):
        """未认证用户返回401"""
        response = await client.get("/api/v1/agent/tools")
        assert response.status_code == 401

    async def test_success(
        self, client: AsyncClient, auth_headers, clean_db
    ):
        """成功获取工具列表"""
        tools_data = [
            {"name": "web_search", "description": "Search the web"},
            {"name": "retrieve_knowledge", "description": "Retrieve knowledge base"},
        ]

        with patch(
            AGENT_BUSINESS_PATCH
        ) as mock_business:
            mock_business.get_tools.return_value = {
                "success": True,
                "tools": tools_data,
            }

            response = await client.get(
                "/api/v1/agent/tools", headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert len(data["tools"]) == 2
            assert data["tools"][0]["name"] == "web_search"
            assert data["tools"][1]["name"] == "retrieve_knowledge"

    async def test_empty_tools(
        self, client: AsyncClient, auth_headers, clean_db
    ):
        """无可用工具时返回空列表"""
        with patch(
            AGENT_BUSINESS_PATCH
        ) as mock_business:
            mock_business.get_tools.return_value = {
                "success": True,
                "tools": [],
            }

            response = await client.get(
                "/api/v1/agent/tools", headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["tools"] == []

    async def test_business_exception(
        self, client: AsyncClient, auth_headers, clean_db
    ):
        """业务层异常时返回500"""
        with patch(
            AGENT_BUSINESS_PATCH
        ) as mock_business:
            mock_business.get_tools.side_effect = Exception("获取工具列表失败")

            response = await client.get(
                "/api/v1/agent/tools", headers=auth_headers
            )
            assert response.status_code == 500
            data = response.json()
            assert data["success"] is False
            assert "error" in data


class TestAgentRun:
    """POST /api/v1/agent/run 测试"""

    async def test_unauthorized(self, client: AsyncClient, clean_db):
        """未认证用户返回401"""
        response = await client.post(
            "/api/v1/agent/run",
            json={"task": "test task"},
        )
        assert response.status_code == 401

    async def test_success(
        self, client: AsyncClient, auth_headers, clean_db
    ):
        """成功执行Agent任务"""
        with patch(
            AGENT_BUSINESS_PATCH
        ) as mock_business:
            mock_business.run_task = AsyncMock(return_value={
                "success": True,
                "result": "任务执行结果",
                "steps": [
                    {
                        "step_number": 1,
                        "thought": "分析任务",
                        "action": "调用搜索工具",
                        "observation": "找到相关信息",
                    }
                ],
                "provider": "gpt-4",
            })

            response = await client.post(
                "/api/v1/agent/run",
                json={"task": "查询今天的天气"},
                headers=auth_headers,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["result"] == "任务执行结果"
            assert len(data["steps"]) == 1
            assert data["steps"][0]["step_number"] == 1
            assert data["provider"] is not None

    async def test_with_all_fields(
        self, client: AsyncClient, auth_headers, clean_db
    ):
        """使用所有可选字段执行任务"""
        with patch(
            AGENT_BUSINESS_PATCH
        ) as mock_business:
            mock_business.run_task = AsyncMock(return_value={
                "success": True,
                "result": "完成",
                "provider": "deepseek-chat",
            })

            response = await client.post(
                "/api/v1/agent/run",
                json={
                    "task": "编写测试用例",
                    "tools": ["web_search"],
                    "max_steps": 5,
                    "provider": "deepseek-chat",
                },
                headers=auth_headers,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["provider"] == "deepseek-chat"

    async def test_no_steps_in_response(
        self, client: AsyncClient, auth_headers, clean_db
    ):
        """响应中steps为None也能正常处理"""
        with patch(
            AGENT_BUSINESS_PATCH
        ) as mock_business:
            mock_business.run_task = AsyncMock(return_value={
                "success": True,
                "result": "完成",
                "steps": None,
                "provider": "gpt-4",
            })

            response = await client.post(
                "/api/v1/agent/run",
                json={"task": "简单任务"},
                headers=auth_headers,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["steps"] is None

    async def test_validation_empty_task(
        self, client: AsyncClient, auth_headers, clean_db
    ):
        """空task会被Pydantic校验为422"""
        response = await client.post(
            "/api/v1/agent/run",
            json={"task": ""},
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_validation_missing_task(
        self, client: AsyncClient, auth_headers, clean_db
    ):
        """缺少task字段返回422"""
        response = await client.post(
            "/api/v1/agent/run",
            json={},
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_validation_invalid_max_steps(
        self, client: AsyncClient, auth_headers, clean_db
    ):
        """max_steps超出范围返回422"""
        response = await client.post(
            "/api/v1/agent/run",
            json={"task": "test", "max_steps": 0},
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_task_execution_failure(
        self, client: AsyncClient, auth_headers, clean_db
    ):
        """业务层异常时端点返回500"""
        with patch(
            AGENT_BUSINESS_PATCH
        ) as mock_business:
            mock_business.run_task = AsyncMock(
                side_effect=Exception("API Key 无效")
            )

            response = await client.post(
                "/api/v1/agent/run",
                json={"task": "test task"},
                headers=auth_headers,
            )
            assert response.status_code == 500
            data = response.json()
            assert data["success"] is False
            assert "error" in data
