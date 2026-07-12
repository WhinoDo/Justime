from copy import deepcopy
from datetime import datetime

import pytest
from bson import ObjectId
from httpx import AsyncClient

from app.services.security_service import SecurityService
from app.services.user_service import UserService


pytestmark = pytest.mark.asyncio


async def _insert_task(clean_db, user_id: str, milestones: list[dict]) -> str:
    now = datetime.utcnow()
    result = await clean_db.task_processes.insert_one(
        {
            "userId": user_id,
            "title": "Milestone status contract",
            "description": "Verify exact milestone status persistence.",
            "goal": "Update one milestone without replacing the array.",
            "category": "development",
            "tags": ["milestone"],
            "priority": "medium",
            "status": "active",
            "phase": "during",
            "progress": 0.0,
            "progress_source": "manual",
            "actual_hours": 0.0,
            "materials": [],
            "preparation_items": [],
            "milestones": deepcopy(milestones),
            "blockers": [],
            "ai_suggestions": [],
            "related_chat_session_ids": [],
            "related_calendar_event_ids": [],
            "createdAt": now,
            "updatedAt": now,
        }
    )
    return str(result.inserted_id)


def _milestones(*, first_status: str, first_completed_at=None) -> list[dict]:
    return [
        {
            "id": "prepare",
            "title": "Prepare",
            "description": "Keep all non-status fields unchanged.",
            "order": 0,
            "status": first_status,
            "target_date": None,
            "completed_at": first_completed_at,
        },
        {
            "id": "review",
            "title": "Review",
            "description": "This milestone must remain unchanged.",
            "order": 1,
            "status": "pending",
            "target_date": None,
            "completed_at": None,
        },
    ]


async def _stored_milestones(clean_db, task_id: str) -> list[dict]:
    task = await clean_db.task_processes.find_one({"_id": ObjectId(task_id)})
    return task["milestones"]


async def test_pending_to_active_updates_only_target_milestone(
    client: AsyncClient,
    auth_headers: dict,
    clean_db,
    test_user,
):
    original = _milestones(
        first_status="pending",
        first_completed_at=datetime(2026, 7, 12, 12, 0, 0),
    )
    task_id = await _insert_task(clean_db, str(test_user["_id"]), original)

    response = await client.patch(
        f"/api/v1/task-processes/{task_id}/milestones/prepare",
        json={"status": "active"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    task = response.json()["data"]["task"]
    assert task["milestones"][0] == {
        **original[0],
        "status": "active",
        "completed_at": None,
    }
    assert task["milestones"][1] == original[1]
    assert await _stored_milestones(clean_db, task_id) == task["milestones"]


async def test_active_to_completed_sets_timestamp_and_matches_reread(
    client: AsyncClient,
    auth_headers: dict,
    clean_db,
    test_user,
):
    original = _milestones(first_status="active")
    task_id = await _insert_task(clean_db, str(test_user["_id"]), original)

    response = await client.patch(
        f"/api/v1/task-processes/{task_id}/milestones/prepare",
        json={"status": "completed"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    updated = response.json()["data"]["task"]
    target = updated["milestones"][0]
    assert target["status"] == "completed"
    assert target["completed_at"] is not None
    assert updated["milestones"][1] == original[1]

    reread = await client.get(f"/api/v1/task-processes/{task_id}", headers=auth_headers)
    assert reread.status_code == 200
    assert reread.json()["data"]["task"]["milestones"] == updated["milestones"]


async def test_completed_to_active_clears_timestamp(
    client: AsyncClient,
    auth_headers: dict,
    clean_db,
    test_user,
):
    completed_at = datetime(2026, 7, 12, 12, 0, 0)
    original = _milestones(first_status="completed", first_completed_at=completed_at)
    task_id = await _insert_task(clean_db, str(test_user["_id"]), original)

    response = await client.patch(
        f"/api/v1/task-processes/{task_id}/milestones/prepare",
        json={"status": "active"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    target = response.json()["data"]["task"]["milestones"][0]
    assert target["status"] == "active"
    assert target["completed_at"] is None
    assert (await _stored_milestones(clean_db, task_id))[0]["completed_at"] is None


async def test_unknown_milestone_returns_400_without_mutation(
    client: AsyncClient,
    auth_headers: dict,
    clean_db,
    test_user,
):
    original = _milestones(first_status="active")
    task_id = await _insert_task(clean_db, str(test_user["_id"]), original)

    response = await client.patch(
        f"/api/v1/task-processes/{task_id}/milestones/missing",
        json={"status": "completed"},
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert response.json()["error"] == "里程碑不存在"
    assert await _stored_milestones(clean_db, task_id) == original


async def test_cross_user_task_returns_404_without_leaking_or_mutating(
    client: AsyncClient,
    clean_db,
    test_user,
):
    original = _milestones(first_status="active")
    task_id = await _insert_task(clean_db, str(test_user["_id"]), original)
    other_user = await UserService.create_user(
        {
            "email": "milestone-other@example.com",
            "password": "OtherPassword123!",
            "username": "milestone-other",
            "displayName": "Milestone Other",
            "role": "user",
        }
    )
    token = SecurityService.create_access_token(data={"sub": str(other_user["_id"])})

    response = await client.patch(
        f"/api/v1/task-processes/{task_id}/milestones/prepare",
        json={"status": "completed"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
    assert response.json()["error"] == "任务不存在"
    assert "prepare" not in response.text
    assert await _stored_milestones(clean_db, task_id) == original


async def test_nonexistent_task_returns_404(
    client: AsyncClient,
    auth_headers: dict,
    clean_db,
):
    response = await client.patch(
        f"/api/v1/task-processes/{ObjectId()}/milestones/prepare",
        json={"status": "completed"},
        headers=auth_headers,
    )

    assert response.status_code == 404
    assert response.json()["error"] == "任务不存在"
    assert await clean_db.task_processes.count_documents({}) == 0


async def test_request_rejects_full_milestone_replacement_fields(
    client: AsyncClient,
    auth_headers: dict,
    clean_db,
    test_user,
):
    original = _milestones(first_status="pending")
    task_id = await _insert_task(clean_db, str(test_user["_id"]), original)

    response = await client.patch(
        f"/api/v1/task-processes/{task_id}/milestones/prepare",
        json={"status": "active", "title": "Client overwrite"},
        headers=auth_headers,
    )

    assert response.status_code == 422
    assert await _stored_milestones(clean_db, task_id) == original
