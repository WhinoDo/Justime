from datetime import datetime, timedelta
from unittest.mock import AsyncMock

import pytest
from bson import ObjectId
from httpx import AsyncClient

from app.business.feishu_calendar import FeishuCalendarBusiness
from app.business.task_process_business import _task_process_business
from app.core.config import settings
from app.models.calendar import CalendarEventCreate, CalendarEventUpdate
from app.services.feishu_service import FeishuService


pytestmark = pytest.mark.asyncio


def _milestones() -> list[dict]:
    return [
        {
            "id": "target-ms",
            "title": "Same title",
            "description": "Target milestone",
            "order": 0,
            "status": "active",
            "target_date": None,
            "completed_at": None,
        },
        {
            "id": "other-ms",
            "title": "Same title",
            "description": "Same title, different exact ID",
            "order": 1,
            "status": "active",
            "target_date": None,
            "completed_at": None,
        },
    ]


async def _insert_task(clean_db, user_id: str, milestones: list[dict] | None = None) -> str:
    now = datetime.utcnow()
    result = await clean_db.task_processes.insert_one(
        {
            "userId": user_id,
            "title": "Calendar milestone sync",
            "description": "Verify exact ID synchronization.",
            "goal": "Keep Calendar and milestones synchronized.",
            "category": "development",
            "tags": ["calendar"],
            "priority": "medium",
            "status": "active",
            "phase": "during",
            "progress": 0.0,
            "progress_source": "manual",
            "actual_hours": 0.0,
            "materials": [],
            "preparation_items": [],
            "milestones": milestones or _milestones(),
            "blockers": [],
            "ai_suggestions": [],
            "related_chat_session_ids": [],
            "related_calendar_event_ids": [],
            "createdAt": now,
            "updatedAt": now,
        }
    )
    return str(result.inserted_id)


def _event_payload(**overrides) -> dict:
    start = datetime.utcnow() + timedelta(hours=1)
    payload = {
        "title": "Same title",
        "description": "Calendar completion evidence",
        "start": start.isoformat(),
        "end": (start + timedelta(hours=1)).isoformat(),
        "type": "task",
        "status": "pending",
    }
    payload.update(overrides)
    return payload


async def test_create_persists_exact_association_and_rejects_half_pair(
    client: AsyncClient,
    auth_headers: dict,
    clean_db,
    test_user,
):
    user_id = str(test_user["_id"])
    task_id = await _insert_task(clean_db, user_id)

    response = await client.post(
        "/api/v1/calendar/events",
        json=_event_payload(taskId=task_id, milestoneId="target-ms"),
        headers=auth_headers,
    )

    assert response.status_code == 200
    event = response.json()["data"]["event"]
    assert event["taskId"] == task_id
    assert event["milestoneId"] == "target-ms"
    stored = await clean_db.calendar_events.find_one({"_id": ObjectId(event["id"])})
    assert stored["taskId"] == task_id
    assert stored["milestoneId"] == "target-ms"

    half_pair = await client.post(
        "/api/v1/calendar/events",
        json=_event_payload(taskId=task_id),
        headers=auth_headers,
    )

    assert half_pair.status_code == 400
    assert await clean_db.calendar_events.count_documents({}) == 1


async def test_create_rejects_missing_task_and_wrong_milestone(
    client: AsyncClient,
    auth_headers: dict,
    clean_db,
    test_user,
):
    user_id = str(test_user["_id"])
    task_id = await _insert_task(clean_db, user_id)
    other_user_task_id = await _insert_task(clean_db, str(ObjectId()))

    missing_task = await client.post(
        "/api/v1/calendar/events",
        json=_event_payload(taskId=str(ObjectId()), milestoneId="target-ms"),
        headers=auth_headers,
    )
    other_user_task = await client.post(
        "/api/v1/calendar/events",
        json=_event_payload(taskId=other_user_task_id, milestoneId="target-ms"),
        headers=auth_headers,
    )
    wrong_milestone = await client.post(
        "/api/v1/calendar/events",
        json=_event_payload(taskId=task_id, milestoneId="missing-ms"),
        headers=auth_headers,
    )

    assert missing_task.status_code == 404
    assert other_user_task.status_code == 404
    assert wrong_milestone.status_code == 400
    assert await clean_db.calendar_events.count_documents({}) == 0


async def test_update_requires_pair_and_supports_replace_and_clear(
    client: AsyncClient,
    auth_headers: dict,
    clean_db,
    test_user,
):
    user_id = str(test_user["_id"])
    task_id = await _insert_task(clean_db, user_id)
    created = await client.post(
        "/api/v1/calendar/events",
        json=_event_payload(),
        headers=auth_headers,
    )
    event_id = created.json()["data"]["event"]["id"]

    half_pair = await client.put(
        f"/api/v1/calendar/events/{event_id}",
        json={"milestoneId": "target-ms"},
        headers=auth_headers,
    )
    assert half_pair.status_code == 400

    linked = await client.put(
        f"/api/v1/calendar/events/{event_id}",
        json={"taskId": task_id, "milestoneId": "target-ms"},
        headers=auth_headers,
    )
    assert linked.status_code == 200
    assert linked.json()["data"]["event"]["milestoneId"] == "target-ms"

    cleared = await client.put(
        f"/api/v1/calendar/events/{event_id}",
        json={"taskId": None, "milestoneId": None},
        headers=auth_headers,
    )
    assert cleared.status_code == 200
    assert cleared.json()["data"]["event"]["taskId"] is None
    assert cleared.json()["data"]["event"]["milestoneId"] is None


async def test_calendar_completion_uses_exact_id_and_idempotent_evidence(
    client: AsyncClient,
    auth_headers: dict,
    clean_db,
    test_user,
):
    user_id = str(test_user["_id"])
    task_id = await _insert_task(clean_db, user_id)
    target_response = await client.post(
        "/api/v1/calendar/events",
        json=_event_payload(taskId=task_id, milestoneId="target-ms"),
        headers=auth_headers,
    )
    other_response = await client.post(
        "/api/v1/calendar/events",
        json=_event_payload(taskId=task_id, milestoneId="other-ms"),
        headers=auth_headers,
    )
    target_event = target_response.json()["data"]["event"]
    other_event = other_response.json()["data"]["event"]

    completed = await client.put(
        f"/api/v1/calendar/events/{target_event['id']}",
        json={"status": "completed"},
        headers=auth_headers,
    )

    assert completed.status_code == 200
    task = await clean_db.task_processes.find_one({"_id": ObjectId(task_id)})
    milestones = {item["id"]: item for item in task["milestones"]}
    assert milestones["target-ms"]["status"] == "completed"
    assert milestones["other-ms"]["status"] == "active"
    unchanged = await clean_db.calendar_events.find_one({"_id": ObjectId(other_event["id"])})
    assert unchanged["status"] == "pending"

    evidence_filter = {
        "userId": user_id,
        "task_id": task_id,
        "type": "milestone_complete",
        "source_id": target_event["id"],
    }
    evidence = await clean_db.evidence.find_one(evidence_filter)
    assert evidence["source"] == "calendar"
    assert evidence["milestone_id"] == "target-ms"
    assert evidence["metadata"]["calendar_event_id"] == target_event["id"]

    await _task_process_business.handle_calendar_event_status_change(
        user_id,
        "pending",
        "completed",
        {
            "id": target_event["id"],
            "title": "Same title",
            "description": "Replayed hook",
            "taskId": task_id,
            "milestoneId": "target-ms",
        },
    )
    assert await clean_db.evidence.count_documents(evidence_filter) == 1


async def test_milestone_completion_updates_only_exact_local_events(
    client: AsyncClient,
    auth_headers: dict,
    clean_db,
    test_user,
):
    user_id = str(test_user["_id"])
    task_id = await _insert_task(clean_db, user_id)
    events = [
        {
            "_id": ObjectId(),
            "userId": user_id,
            "taskId": task_id,
            "milestoneId": "target-ms",
            "status": "pending",
        },
        {
            "_id": ObjectId(),
            "userId": user_id,
            "taskId": task_id,
            "milestoneId": "target-ms",
            "status": "confirmed",
        },
        {
            "_id": ObjectId(),
            "userId": user_id,
            "taskId": task_id,
            "milestoneId": "other-ms",
            "status": "pending",
        },
        {
            "_id": ObjectId(),
            "userId": user_id,
            "taskId": task_id,
            "milestoneId": "target-ms",
            "status": "completed",
        },
    ]
    await clean_db.calendar_events.insert_many(events)

    response = await client.patch(
        f"/api/v1/task-processes/{task_id}/milestones/target-ms",
        json={"status": "completed"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    stored = {
        event["_id"]: event
        async for event in clean_db.calendar_events.find({"userId": user_id})
    }
    assert stored[events[0]["_id"]]["status"] == "completed"
    assert stored[events[1]["_id"]]["status"] == "completed"
    assert stored[events[2]["_id"]]["status"] == "pending"
    assert stored[events[3]["_id"]]["status"] == "completed"


async def test_feishu_mapping_persists_internal_ids_without_remote_body(
    clean_db,
    test_user,
    monkeypatch,
):
    user_id = str(test_user["_id"])
    task_id = await _insert_task(clean_db, user_id)
    start = datetime.utcnow() + timedelta(hours=1)
    remote_event = {
        "event_id": "feishu-event-1",
        "summary": "Feishu event",
        "description": "Remote description",
        "start_time": {"date_time": start.isoformat()},
        "end_time": {"date_time": (start + timedelta(hours=1)).isoformat()},
    }
    create_mock = AsyncMock(return_value=remote_event)
    get_mock = AsyncMock(return_value=remote_event)
    update_mock = AsyncMock()
    monkeypatch.setattr(FeishuService, "create_event", create_mock, raising=False)
    monkeypatch.setattr(FeishuService, "get_event", get_mock, raising=False)
    monkeypatch.setattr(FeishuService, "update_event", update_mock, raising=False)

    created = await FeishuCalendarBusiness.create_event(
        user_id,
        CalendarEventCreate(
            title="Feishu event",
            description="Remote description",
            start=start,
            end=start + timedelta(hours=1),
            taskId=task_id,
            milestoneId="target-ms",
        ),
    )

    remote_payload = create_mock.await_args.args[0]
    assert "taskId" not in remote_payload
    assert "milestoneId" not in remote_payload
    assert created["taskId"] == task_id
    assert created["milestoneId"] == "target-ms"

    updated = await FeishuCalendarBusiness.update_event(
        user_id,
        "feishu-event-1",
        CalendarEventUpdate(taskId=task_id, milestoneId="other-ms"),
    )
    assert update_mock.await_count == 0
    assert updated["taskId"] == task_id
    assert updated["milestoneId"] == "other-ms"
    local = await clean_db.calendar_events.find_one({"_id": "feishu-event-1"})
    assert local["taskId"] == task_id
    assert local["milestoneId"] == "other-ms"


async def test_milestone_completion_uses_feishu_update_for_pending_events(
    clean_db,
    test_user,
    monkeypatch,
):
    user_id = str(test_user["_id"])
    task_id = await _insert_task(clean_db, user_id)
    await clean_db.calendar_events.insert_many(
        [
            {
                "_id": "feishu-target-1",
                "userId": user_id,
                "taskId": task_id,
                "milestoneId": "target-ms",
                "status": "pending",
            },
            {
                "_id": "feishu-other-1",
                "userId": user_id,
                "taskId": task_id,
                "milestoneId": "other-ms",
                "status": "pending",
            },
        ]
    )
    update_mock = AsyncMock(return_value={"id": "feishu-target-1", "status": "completed"})
    monkeypatch.setattr(settings, "FEISHU_INTEGRATION_ENABLED", True)
    monkeypatch.setattr(FeishuCalendarBusiness, "update_event", update_mock)

    await _task_process_business.update_milestone_status(
        user_id,
        task_id,
        "target-ms",
        "completed",
    )

    update_mock.assert_awaited_once()
    assert update_mock.await_args.args[:2] == (user_id, "feishu-target-1")
    assert update_mock.await_args.args[2].status == "completed"
    target = await clean_db.calendar_events.find_one({"_id": "feishu-target-1"})
    other = await clean_db.calendar_events.find_one({"_id": "feishu-other-1"})
    assert target["status"] == "completed"
    assert other["status"] == "pending"
