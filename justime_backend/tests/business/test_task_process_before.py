import json
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.models.task_process import (
    AISuggestion,
    LearningMaterial,
    Milestone,
    PreparationItem,
    TaskProcessCreate,
    TaskProcessOut,
    TaskProcessUpdate,
)
from app.services.task_agent_service import task_agent_service


pytestmark = pytest.mark.asyncio


def _task(title: str = "Prepare a backend contract") -> TaskProcessOut:
    return TaskProcessOut(
        id="task-1",
        userId="user-1",
        title=title,
        goal="Persist deterministic Before phase data.",
    )


async def test_before_model_defaults_are_backward_compatible_and_isolated():
    first = TaskProcessCreate(title="First", goal="First goal")
    second = TaskProcessCreate(title="Second", goal="Second goal")
    output = _task()
    update = TaskProcessUpdate()

    assert first.materials == []
    assert first.preparation_items == []
    assert output.materials == []
    assert output.preparation_items == []
    assert update.materials == []
    assert update.preparation_items == []
    assert update.model_dump(exclude_unset=True) == {}

    first.materials.append(
        LearningMaterial(
            title="FastAPI documentation",
            url="https://fastapi.tiangolo.com/",
            summary="Framework reference.",
            source="FastAPI",
        )
    )
    first.preparation_items.append(
        PreparationItem(id="prep-1", title="Read the contract", done=False, order=0)
    )

    assert second.materials == []
    assert second.preparation_items == []


async def test_plan_provider_output_normalizes_before_contract():
    provider_payload = {
        "plan": {"summary": "Provider plan"},
        "milestones": [{"title": "Implement", "description": "Write the backend change."}],
        "materials": [
            {
                "title": " Pydantic models ",
                "url": "https://docs.pydantic.dev/",
                "summary": " Nested model reference. ",
                "source": " Pydantic ",
            },
            {"title": "Invalid because required fields are absent"},
        ],
        "preparation_items": [
            {"id": "provider-random-id", "title": " Inspect the current contract ", "done": False},
            {"title": "Add focused tests", "done": True},
        ],
        "suggestions": [],
    }
    model_config = {
        "model_id": "test-model",
        "api_key": "encrypted-test-key",
        "base_url": "https://provider.invalid/v1",
    }

    with (
        patch(
            "app.services.task_agent_service.UserService.get_system_llm_configs",
            new=AsyncMock(return_value=[model_config]),
        ),
        patch(
            "app.services.task_agent_service.model_router_service.pick_main_config",
            return_value=model_config,
        ),
        patch("app.services.task_agent_service.encryption_service.decrypt", return_value="test-key"),
        patch(
            "app.services.task_agent_service.llm_service.chat_completion",
            new=AsyncMock(
                return_value={"choices": [{"message": {"content": json.dumps(provider_payload)}}]}
            ),
        ),
    ):
        result = await task_agent_service.run(_task(), "plan", "", [])

    assert result["plan"] == {"summary": "Provider plan"}
    assert [item.title for item in result["milestones"]] == ["Implement"]
    assert result["materials"] == [
        LearningMaterial(
            title="Pydantic models",
            url="https://docs.pydantic.dev/",
            summary="Nested model reference.",
            source="Pydantic",
        )
    ]
    assert [item.title for item in result["preparation_items"]] == [
        "Inspect the current contract",
        "Add focused tests",
    ]
    assert [item.order for item in result["preparation_items"]] == [0, 1]
    assert [item.done for item in result["preparation_items"]] == [False, True]
    assert result["preparation_items"][0].id != "provider-random-id"


async def test_no_provider_uses_deterministic_title_derived_preparation_fallback():
    task = _task("中文任务标题")
    with (
        patch(
            "app.services.task_agent_service.UserService.get_system_llm_configs",
            new=AsyncMock(return_value=[]),
        ),
        patch(
            "app.services.task_agent_service.llm_service.chat_completion",
            new=AsyncMock(),
        ) as chat_completion,
    ):
        first = await task_agent_service.run(task, "plan", "", [])
        second = await task_agent_service.run(task, "plan", "", [])

    assert first["materials"] == []
    assert first["preparation_items"] == second["preparation_items"]
    assert first["preparation_items"][0].title == "确认《中文任务标题》的目标、范围与开始条件"
    assert first["preparation_items"][0].id.startswith("prep-1-")
    chat_completion.assert_not_awaited()


async def test_invalid_provider_before_lists_use_deterministic_defaults():
    task = _task("Invalid provider output")

    assert task_agent_service._normalize_materials({"unexpected": "object"}) == []
    assert task_agent_service._normalize_materials([{"title": "Incomplete"}]) == []
    assert task_agent_service._normalize_preparation_items(task, "invalid") == (
        task_agent_service._build_preparation_fallback(task)
    )
    assert task_agent_service._normalize_preparation_items(task, [{"done": "invalid"}]) == (
        task_agent_service._build_preparation_fallback(task)
    )


async def test_create_and_update_persist_before_fields_without_mutating_existing_contract(
    client: AsyncClient,
    auth_headers: dict,
    clean_db,
):
    material = LearningMaterial(
        title="Motor async guide",
        url="https://motor.readthedocs.io/",
        summary="Async MongoDB persistence reference.",
        source="Motor",
    )
    preparation_item = PreparationItem(
        id="prep-1-contract",
        title="Confirm the persistence contract",
        done=False,
        order=0,
    )
    milestone = Milestone(id="implement", title="Implement", order=0, status="active")
    suggestion = AISuggestion(id="next-step", type="next_step", content="Implement the scoped change.")
    agent_run = AsyncMock(
        return_value={
            "plan": {"summary": "Persisted provider plan"},
            "milestones": [milestone],
            "materials": [material],
            "preparation_items": [preparation_item],
            "suggestions": [suggestion],
        }
    )

    with patch("app.business.task_process_business.task_agent_service.run", agent_run):
        create_response = await client.post(
            "/api/v1/task-processes",
            json={
                "title": "Before persistence",
                "goal": "Persist preparation data through TaskProcessBusiness.",
                "category": "development",
                "auto_plan": True,
            },
            headers=auth_headers,
        )

    assert create_response.status_code == 200
    created = create_response.json()["data"]["task"]
    task_id = created["id"]
    assert created["materials"] == [material.model_dump(mode="json")]
    assert created["preparation_items"] == [preparation_item.model_dump(mode="json")]

    reread_response = await client.get(f"/api/v1/task-processes/{task_id}", headers=auth_headers)
    assert reread_response.status_code == 200
    before_update = reread_response.json()["data"]["task"]

    updated_preparation = [{**before_update["preparation_items"][0], "done": True}]
    update_response = await client.patch(
        f"/api/v1/task-processes/{task_id}",
        json={"preparation_items": updated_preparation},
        headers=auth_headers,
    )

    assert update_response.status_code == 200
    updated = update_response.json()["data"]["task"]
    assert updated["preparation_items"][0]["done"] is True
    assert updated["phase"] == "before"
    assert updated["milestones"] == before_update["milestones"]
    assert updated["ai_plan"] == before_update["ai_plan"]
    assert updated["blockers"] == before_update["blockers"]
    assert updated["ai_suggestions"] == before_update["ai_suggestions"]

    final_response = await client.get(f"/api/v1/task-processes/{task_id}", headers=auth_headers)
    assert final_response.status_code == 200
    assert final_response.json()["data"]["task"] == updated


async def test_create_without_before_fields_returns_compatible_empty_lists(
    client: AsyncClient,
    auth_headers: dict,
    clean_db,
):
    response = await client.post(
        "/api/v1/task-processes",
        json={
            "title": "Legacy client payload",
            "goal": "Create without newly added fields.",
            "auto_plan": False,
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    task = response.json()["data"]["task"]
    assert task["materials"] == []
    assert task["preparation_items"] == []


async def test_create_body_persists_explicit_before_fields(
    client: AsyncClient,
    auth_headers: dict,
    clean_db,
):
    payload = {
        "title": "Explicit Before payload",
        "goal": "Persist client-provided Before fields.",
        "auto_plan": False,
        "materials": [
            {
                "title": "Motor docs",
                "url": "https://motor.readthedocs.io/",
                "summary": "Async MongoDB reference.",
                "source": "Motor",
            }
        ],
        "preparation_items": [
            {
                "id": "prep-explicit",
                "title": "Confirm MongoDB is available",
                "done": False,
                "order": 0,
            }
        ],
    }

    create_response = await client.post(
        "/api/v1/task-processes",
        json=payload,
        headers=auth_headers,
    )

    assert create_response.status_code == 200
    task_id = create_response.json()["data"]["task"]["id"]
    reread_response = await client.get(f"/api/v1/task-processes/{task_id}", headers=auth_headers)
    assert reread_response.status_code == 200
    task = reread_response.json()["data"]["task"]
    assert task["materials"] == payload["materials"]
    assert task["preparation_items"] == payload["preparation_items"]
