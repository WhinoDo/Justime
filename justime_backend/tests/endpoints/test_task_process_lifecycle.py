from unittest.mock import AsyncMock, patch

import pytest
from bson import ObjectId
from httpx import AsyncClient

from app.models.task_process import AISuggestion, Milestone


pytestmark = pytest.mark.asyncio


async def test_task_process_full_lifecycle(
    client: AsyncClient,
    auth_headers: dict,
    clean_db,
    tmp_path,
):
    async def deterministic_agent_run(task, mode, user_input, evidences):
        if mode == "plan":
            return {
                "plan": {"summary": "Deterministic test plan"},
                "milestones": [
                    Milestone(id="prepare", title="Prepare", order=0),
                    Milestone(id="implement", title="Implement", order=1),
                    Milestone(id="review", title="Review", order=2),
                ],
                "suggestions": [
                    AISuggestion(
                        id="next-step",
                        type="next_step",
                        content="Start with the deterministic plan.",
                    )
                ],
            }
        if mode == "knowledge":
            return {"markdown": "# Deterministic Knowledge\n\nLifecycle evidence summary."}
        raise AssertionError(f"Unexpected task agent mode: {mode}")

    agent_run = AsyncMock(side_effect=deterministic_agent_run)
    with patch(
        "app.business.task_process_business.task_agent_service.run",
        agent_run,
    ):
        create_response = await client.post(
            "/api/v1/task-processes",
            json={
                "title": "Core lifecycle contract",
                "description": "Exercise task, evidence, knowledge, and Vault behavior.",
                "goal": "Verify the complete backend lifecycle without a real LLM.",
                "category": "development",
                "tags": ["integration", "contract"],
                "auto_plan": True,
            },
            headers=auth_headers,
        )

        assert create_response.status_code == 200
        task = create_response.json()["data"]["task"]
        task_id = task["id"]
        assert task["phase"] == "before"
        assert task["status"] == "planned"
        assert [item["id"] for item in task["milestones"]] == [
            "prepare",
            "implement",
            "review",
        ]

        evidence_response = await client.post(
            f"/api/v1/task-processes/{task_id}/evidence",
            json={
                "task_id": task_id,
                "type": "note",
                "title": "Implementation note",
                "content": "The deterministic integration path is running.",
                "source": "pytest",
            },
            headers=auth_headers,
        )
        assert evidence_response.status_code == 200

        time_log_response = await client.post(
            f"/api/v1/task-processes/{task_id}/evidence/time-log",
            json={
                "task_id": task_id,
                "hours": 1.5,
                "notes": "Executed the core lifecycle contract.",
            },
            headers=auth_headers,
        )
        assert time_log_response.status_code == 200
        assert time_log_response.json()["data"]["evidence"]["metadata"]["hours"] == 1.5

        during_response = await client.get(
            f"/api/v1/task-processes/{task_id}",
            headers=auth_headers,
        )
        assert during_response.status_code == 200
        during = during_response.json()["data"]["task"]
        assert during["phase"] == "during"
        assert during["status"] == "active"
        assert during["actual_hours"] == 1.5
        assert during["evidence_count"] == 2

        after_response = await client.patch(
            f"/api/v1/task-processes/{task_id}",
            json={"phase": "after", "status": "completed"},
            headers=auth_headers,
        )
        assert after_response.status_code == 200
        assert after_response.json()["data"]["task"]["phase"] == "after"

        rollback_phase_response = await client.patch(
            f"/api/v1/task-processes/{task_id}",
            json={"phase": "before"},
            headers=auth_headers,
        )
        assert rollback_phase_response.status_code == 400
        assert "不能回退" in rollback_phase_response.json()["error"]

        generate_response = await client.post(
            f"/api/v1/task-processes/{task_id}/knowledge-outputs/generate",
            json={
                "task_id": task_id,
                "format": "summary",
                "additional_instructions": "Use only deterministic fixture content.",
            },
            headers=auth_headers,
        )
        assert generate_response.status_code == 200
        output_v1 = generate_response.json()["data"]["knowledge_output"]
        output_id = output_v1["id"]
        assert output_v1["version"] == 1
        assert "# Deterministic Knowledge" in output_v1["markdown"]

        update_response = await client.patch(
            f"/api/v1/task-processes/knowledge-outputs/{output_id}",
            json={"markdown": "# Version 2\n\nUpdated integration knowledge."},
            headers=auth_headers,
        )
        assert update_response.status_code == 200
        assert update_response.json()["data"]["knowledge_output"]["version"] == 2

        rollback_output_response = await client.post(
            f"/api/v1/task-processes/knowledge-outputs/{output_id}/rollback",
            json={"version": 1},
            headers=auth_headers,
        )
        assert rollback_output_response.status_code == 200
        rolled_back = rollback_output_response.json()["data"]["knowledge_output"]
        assert rolled_back["version"] == 3
        assert rolled_back["markdown"] == output_v1["markdown"]

        vault_root = tmp_path / "vault"
        vault_response = await client.put(
            "/api/v1/task-processes/vault-config",
            json={
                "vault_root_path": str(vault_root),
                "conflict_policy": "overwrite",
            },
            headers=auth_headers,
        )
        assert vault_response.status_code == 200

        publish_response = await client.post(
            f"/api/v1/task-processes/knowledge-outputs/{output_id}/publish",
            headers=auth_headers,
        )
        assert publish_response.status_code == 200
        published = publish_response.json()["data"]["knowledge_output"]
        published_path = vault_root / published["vault_relative_path"]
        assert published_path.read_text(encoding="utf-8") == output_v1["markdown"]

        boundary_create_response = await client.post(
            f"/api/v1/task-processes/{task_id}/knowledge-outputs",
            json={
                "task_id": task_id,
                "title": "Vault boundary contract",
                "format": "summary",
                "markdown": "# Must stay inside the Vault",
                "vault_relative_path": "00-Inbox/boundary.md",
            },
            headers=auth_headers,
        )
        assert boundary_create_response.status_code == 200
        boundary_output_id = boundary_create_response.json()["data"]["knowledge_output"]["id"]

        outside_path = tmp_path / "outside.md"
        await clean_db.knowledge_outputs.update_one(
            {"_id": ObjectId(boundary_output_id)},
            {"$set": {"vault_relative_path": "../outside.md"}},
        )
        boundary_publish_response = await client.post(
            f"/api/v1/task-processes/knowledge-outputs/{boundary_output_id}/publish",
            headers=auth_headers,
        )

        assert boundary_publish_response.status_code == 400
        assert "路径" in boundary_publish_response.json()["error"]
        assert not outside_path.exists()

    called_modes = [
        call.kwargs.get("mode", call.args[1] if len(call.args) > 1 else None)
        for call in agent_run.await_args_list
    ]
    assert called_modes == ["plan", "knowledge"]
