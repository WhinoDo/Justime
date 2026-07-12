from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.models.task_process import AIAssessment, AISuggestion


pytestmark = pytest.mark.asyncio


async def _create_task(client: AsyncClient, auth_headers: dict) -> str:
    response = await client.post(
        "/api/v1/task-processes",
        json={
            "title": "During workspace contract",
            "goal": "Verify evidence and agent state persistence.",
            "category": "development",
            "auto_plan": False,
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    return response.json()["data"]["task"]["id"]


async def test_evidence_source_id_is_idempotent(
    client: AsyncClient,
    auth_headers: dict,
    clean_db,
):
    task_id = await _create_task(client, auth_headers)
    payload = {
        "task_id": task_id,
        "type": "chat",
        "title": "User message",
        "content": "The same workspace message.",
        "source": "session-1",
        "source_id": "message-123",
        "metadata": {"role": "user"},
    }

    invalid_response = await client.post(
        f"/api/v1/task-processes/{task_id}/evidence",
        json={**payload, "source_id": "x" * 201},
        headers=auth_headers,
    )
    assert invalid_response.status_code == 422

    first_response = await client.post(
        f"/api/v1/task-processes/{task_id}/evidence",
        json=payload,
        headers=auth_headers,
    )
    second_response = await client.post(
        f"/api/v1/task-processes/{task_id}/evidence",
        json=payload,
        headers=auth_headers,
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    first = first_response.json()["data"]["evidence"]
    second = second_response.json()["data"]["evidence"]
    assert first["id"] == second["id"]
    assert first["source_id"] == "message-123"

    list_response = await client.get(
        f"/api/v1/task-processes/{task_id}/evidence",
        headers=auth_headers,
    )
    task_response = await client.get(
        f"/api/v1/task-processes/{task_id}",
        headers=auth_headers,
    )
    assert list_response.status_code == 200
    assert len(list_response.json()["data"]["items"]) == 1
    assert task_response.json()["data"]["task"]["evidence_count"] == 1


async def test_monitor_persists_deduplicated_blockers_and_blocked_status(
    client: AsyncClient,
    auth_headers: dict,
    clean_db,
):
    task_id = await _create_task(client, auth_headers)
    assessment = AIAssessment(
        progress=0.4,
        confidence=0.9,
        summary="Work is blocked.",
        blockers_identified=["Waiting for API access", "Waiting for API access", "  "],
        next_steps=["Request access"],
    )
    agent_run = AsyncMock(return_value={"assessment": assessment, "suggestions": []})

    with patch(
        "app.business.task_process_business.task_agent_service.run",
        agent_run,
    ):
        for _ in range(2):
            response = await client.post(
                f"/api/v1/task-processes/{task_id}/agent",
                json={"task_id": task_id, "mode": "monitor", "user_input": ""},
                headers=auth_headers,
            )
            assert response.status_code == 200

    task_response = await client.get(
        f"/api/v1/task-processes/{task_id}",
        headers=auth_headers,
    )
    task = task_response.json()["data"]["task"]
    assert task["status"] == "blocked"
    assert len(task["blockers"]) == 1
    assert task["blockers"][0]["description"] == "Waiting for API access"
    assert task["blockers"][0]["severity"] == "medium"
    assert task["blockers"][0]["resolved"] is False


async def test_coach_returns_and_persists_suggestions(
    client: AsyncClient,
    auth_headers: dict,
    clean_db,
):
    task_id = await _create_task(client, auth_headers)
    suggestions = [
        AISuggestion(
            id="coach-next-step",
            type="next_step",
            content="Break the API integration into a small verification step.",
        )
    ]
    assessment = AIAssessment(
        progress=0.25,
        confidence=0.8,
        summary="A smaller next step will help.",
        blockers_identified=[],
        next_steps=["Verify one API call"],
    )
    agent_run = AsyncMock(
        return_value={"assessment": assessment, "suggestions": suggestions}
    )

    with patch(
        "app.business.task_process_business.task_agent_service.run",
        agent_run,
    ):
        response = await client.post(
            f"/api/v1/task-processes/{task_id}/agent",
            json={"task_id": task_id, "mode": "coach", "user_input": "Help me proceed"},
            headers=auth_headers,
        )

    assert response.status_code == 200
    returned = response.json()["data"]["agent"]["suggestions"]
    assert returned[0]["id"] == "coach-next-step"
    assert returned[0]["content"] == suggestions[0].content

    task_response = await client.get(
        f"/api/v1/task-processes/{task_id}",
        headers=auth_headers,
    )
    persisted = task_response.json()["data"]["task"]["ai_suggestions"]
    assert persisted == returned
    assert agent_run.await_args.args[1] == "coach"
