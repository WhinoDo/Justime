"""
考研学习 API 端点测试
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_profile_not_found(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/study/profile", headers=auth_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "尚未创建考研配置"


@pytest.mark.asyncio
async def test_create_profile_success(client: AsyncClient, auth_headers: dict):
    payload = {
        "targetSchool": "清华大学",
        "targetMajor": "计算机科学与技术",
        "examDate": "2026-12-25T00:00:00Z",
        "subjects": ["数学", "英语", "政治", "专业课"],
        "dailyStudyHours": 8.5
    }
    response = await client.post("/api/v1/study/profile", json=payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["profile"]["targetSchool"] == "清华大学"
    assert data["data"]["profile"]["targetMajor"] == "计算机科学与技术"
    assert data["data"]["profile"]["dailyStudyHours"] == 8.5


@pytest.mark.asyncio
async def test_generate_plan_missing_profile_and_payload(client: AsyncClient, auth_headers: dict):
    # Testing our robust handling: empty payload and no profile should raise 400 instead of crashing/500
    response = await client.post("/api/v1/study/plan", json={}, headers=auth_headers)
    assert response.status_code == 400
    assert "配置" in response.json()["detail"] or "科目" in response.json()["detail"]


@pytest.mark.asyncio
async def test_generate_plan_success(client: AsyncClient, auth_headers: dict):
    # Create profile first
    profile_payload = {
        "targetSchool": "北京大学",
        "targetMajor": "电子信息",
        "examDate": "2026-12-25T00:00:00Z",
        "subjects": ["数学", "英语"],
        "dailyStudyHours": 8.0
    }
    await client.post("/api/v1/study/profile", json=profile_payload, headers=auth_headers)

    mock_agent_result = {
        "success": True,
        "result": "已成功制定学习计划并同步至日程！",
        "tool_outputs": [
            {
                "observation": {
                    "type": "study_plan_generated",
                    "phases": [
                        {
                            "phaseName": "基础巩固阶段",
                            "startDate": "2026-06-01T00:00:00",
                            "endDate": "2026-08-31T00:00:00",
                            "goals": ["夯实基础知识"],
                            "subjects": ["数学", "英语"]
                        }
                    ]
                }
            }
        ]
    }

    with patch("app.business.study_agent_business.study_agent_business.study_agent.create_study_plan", new_callable=AsyncMock) as mock_create_plan:
        mock_create_plan.return_value = mock_agent_result
        
        # Test generation
        response = await client.post("/api/v1/study/plan", json={}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["plan"]["type"] == "study_plan_generated"
        assert data["data"]["agentResult"] == "已成功制定学习计划并同步至日程！"


@pytest.mark.asyncio
async def test_get_plan_not_found(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/study/plan", headers=auth_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "尚未生成学习计划"


@pytest.mark.asyncio
async def test_get_tasks_empty(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/study/tasks", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["data"]["tasks"] == []


@pytest.mark.asyncio
async def test_get_progress_success(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/study/progress", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "recentRecords" in data["data"]
    assert data["data"]["totalHoursLast7Days"] == 0.0


@pytest.mark.asyncio
async def test_study_chat_empty_message(client: AsyncClient, auth_headers: dict):
    response = await client.post("/api/v1/study/chat", json={"message": "   "}, headers=auth_headers)
    assert response.status_code == 400
    assert "不能为空" in response.json()["detail"]


@pytest.mark.asyncio
async def test_study_chat_success(client: AsyncClient, auth_headers: dict):
    with patch("app.business.study_agent_business.study_agent_business.process_study_request", new_callable=AsyncMock) as mock_process:
        mock_process.return_value = {
            "success": True,
            "data": {
                "response": "根据你的备考计划，今天建议复习数学微积分部分。",
                "userId": "some-user-id"
            }
        }
        response = await client.post("/api/v1/study/chat", json={"message": "今天学什么"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["response"] == "根据你的备考计划，今天建议复习数学微积分部分。"


@pytest.mark.asyncio
async def test_get_weekly_report_success(client: AsyncClient, auth_headers: dict):
    with patch("app.services.study_report_service.study_report_service.generate_weekly_report", new_callable=AsyncMock) as mock_report:
        mock_report.return_value = {
            "success": True,
            "data": {
                "reportId": "report123",
                "stats": {"totalHours": 10.0},
                "llmAnalysis": "本周表现良好"
            }
        }
        response = await client.get("/api/v1/study/report/weekly", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["stats"]["totalHours"] == 10.0


@pytest.mark.asyncio
async def test_get_monthly_report_success(client: AsyncClient, auth_headers: dict):
    with patch("app.services.study_report_service.study_report_service.generate_monthly_report", new_callable=AsyncMock) as mock_report:
        mock_report.return_value = {
            "success": True,
            "data": {
                "reportId": "report456",
                "stats": {"totalHours": 45.0},
                "llmAnalysis": "本月学习平稳"
            }
        }
        response = await client.get("/api/v1/study/report/monthly", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["stats"]["totalHours"] == 45.0


@pytest.mark.asyncio
async def test_exam_analyze_empty_subject(client: AsyncClient, auth_headers: dict):
    response = await client.post("/api/v1/study/exam/analyze", json={"subject": "   "}, headers=auth_headers)
    assert response.status_code == 400
    assert "科目" in response.json()["detail"]


@pytest.mark.asyncio
async def test_exam_analyze_no_papers_error(client: AsyncClient, auth_headers: dict):
    # If no papers have been uploaded, it should return 500 with descriptive error
    response = await client.post("/api/v1/study/exam/analyze", json={"subject": "数学"}, headers=auth_headers)
    assert response.status_code == 500
    assert "请先上传真题" in response.json()["detail"]


@pytest.mark.asyncio
async def test_sprint_plan_missing_profile_error(client: AsyncClient, auth_headers: dict):
    # Testing our robust handling: empty profile should return 400 bad request instead of 500
    response = await client.post("/api/v1/study/sprint-plan", json={}, headers=auth_headers)
    assert response.status_code == 400
    assert "请先创建考研配置" in response.json()["detail"]
