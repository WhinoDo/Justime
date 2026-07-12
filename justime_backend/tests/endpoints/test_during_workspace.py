import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from bson import ObjectId
from httpx import AsyncClient
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.business.task_process_business import TaskProcessBusiness
from app.models.evidence import EvidenceCreate
from app.models.task_process import AIAssessment, AISuggestion
from app.services.security_service import SecurityService
from app.services.user_service import UserService


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


async def test_evidence_source_id_is_concurrency_safe(
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

    responses = await asyncio.gather(
        *[
            client.post(
                f"/api/v1/task-processes/{task_id}/evidence",
                json=payload,
                headers=auth_headers,
            )
            for _ in range(50)
        ]
    )

    assert {response.status_code for response in responses} == {200}
    evidence_items = [response.json()["data"]["evidence"] for response in responses]
    assert len({item["id"] for item in evidence_items}) == 1
    assert {item["source_id"] for item in evidence_items} == {"message-123"}
    assert await clean_db.evidence.count_documents(
        {
            "userId": evidence_items[0]["userId"],
            "task_id": task_id,
            "type": "chat",
            "source_id": "message-123",
        }
    ) == 1

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


async def test_evidence_source_id_index_contract(clean_db):
    index = (await clean_db.evidence.index_information())[
        "uq_evidence_user_task_type_source_id"
    ]

    assert index["key"] == [
        ("userId", 1),
        ("task_id", 1),
        ("type", 1),
        ("source_id", 1),
    ]
    assert index["unique"] is True
    assert index["partialFilterExpression"] == {"source_id": {"$type": "string"}}


async def test_evidence_source_id_is_tenant_task_and_type_scoped(
    client: AsyncClient,
    auth_headers: dict,
    clean_db,
):
    first_task_id = await _create_task(client, auth_headers)
    second_task_id = await _create_task(client, auth_headers)
    source_id = "shared-source"

    second_user = await UserService.create_user(
        {
            "email": "second-user@example.com",
            "password": "SecondUserPassword123!",
            "username": "second-user",
            "displayName": "Second User",
            "role": "user",
        }
    )
    second_headers = {
        "Authorization": "Bearer "
        + SecurityService.create_access_token(data={"sub": str(second_user["_id"])})
    }
    second_user_task_id = await _create_task(client, second_headers)

    requests = [
        (first_task_id, "chat", auth_headers),
        (first_task_id, "note", auth_headers),
        (second_task_id, "chat", auth_headers),
        (second_user_task_id, "chat", second_headers),
    ]
    responses = []
    for task_id, evidence_type, headers in requests:
        responses.append(
            await client.post(
                f"/api/v1/task-processes/{task_id}/evidence",
                json={
                    "task_id": task_id,
                    "type": evidence_type,
                    "content": "Scoped evidence",
                    "source_id": source_id,
                },
                headers=headers,
            )
        )

    assert {response.status_code for response in responses} == {200}
    assert len(
        {
            response.json()["data"]["evidence"]["id"]
            for response in responses
        }
    ) == 4
    assert await clean_db.evidence.count_documents({"source_id": source_id}) == 4


async def test_evidence_without_source_id_remains_non_idempotent(
    client: AsyncClient,
    auth_headers: dict,
    clean_db,
):
    task_id = await _create_task(client, auth_headers)
    payload = {
        "task_id": task_id,
        "type": "manual",
        "content": "Manual evidence remains repeatable.",
        "source_id": "   ",
    }

    responses = [
        await client.post(
            f"/api/v1/task-processes/{task_id}/evidence",
            json=payload,
            headers=auth_headers,
        )
        for _ in range(2)
    ]

    assert {response.status_code for response in responses} == {200}
    assert len(
        {
            response.json()["data"]["evidence"]["id"]
            for response in responses
        }
    ) == 2
    assert await clean_db.evidence.count_documents({"task_id": task_id}) == 2
    assert await clean_db.evidence.count_documents(
        {"task_id": task_id, "source_id": {"$exists": True}}
    ) == 0


async def test_duplicate_key_race_returns_tenant_scoped_canonical_evidence():
    business = TaskProcessBusiness()
    collection = AsyncMock()
    collection.find_one_and_update.side_effect = DuplicateKeyError("race")
    canonical = {
        "_id": ObjectId(),
        "userId": "tenant-a",
        "task_id": "task-1",
        "type": "chat",
        "title": "",
        "content": "Canonical evidence",
        "source": "",
        "source_id": "message-1",
    }
    collection.find_one.return_value = canonical
    business.get_task_process = AsyncMock(return_value=object())
    business._evidence_collection = lambda: collection
    business._recalculate_task_metrics = AsyncMock()
    payload = EvidenceCreate(
        task_id="task-1",
        type="chat",
        content="Canonical evidence",
        source_id="message-1",
    )

    evidence = await business.create_evidence("tenant-a", payload)

    idempotency_filter = {
        "userId": "tenant-a",
        "task_id": "task-1",
        "type": "chat",
        "source_id": "message-1",
    }
    assert evidence.id == str(canonical["_id"])
    collection.find_one.assert_awaited_once_with(idempotency_filter)
    _, kwargs = collection.find_one_and_update.await_args
    assert collection.find_one_and_update.await_args.args[0] == idempotency_filter
    assert kwargs["upsert"] is True
    assert kwargs["return_document"] == ReturnDocument.AFTER


async def test_duplicate_key_race_without_canonical_evidence_is_reraised():
    business = TaskProcessBusiness()
    collection = AsyncMock()
    collection.find_one_and_update.side_effect = DuplicateKeyError("race")
    collection.find_one.return_value = None
    business.get_task_process = AsyncMock(return_value=object())
    business._evidence_collection = lambda: collection
    payload = EvidenceCreate(
        task_id="task-1",
        type="chat",
        content="Missing canonical evidence",
        source_id="message-1",
    )

    with pytest.raises(DuplicateKeyError):
        await business.create_evidence("tenant-a", payload)


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
