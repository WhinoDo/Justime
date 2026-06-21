import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_task_process_lifecycle_flow(client: AsyncClient, auth_headers: dict, clean_db, tmp_path):
    create_payload = {
        "title": "学习 Python 虚拟环境",
        "description": "把 venv、依赖安装和常见问题跑通",
        "goal": "完成 Python 虚拟环境学习并沉淀为知识笔记",
        "category": "learning",
        "tags": ["python", "venv"],
        "auto_plan": True,
    }

    create_response = await client.post("/api/v1/task-processes", json=create_payload, headers=auth_headers)
    assert create_response.status_code == 200
    created_task = create_response.json()["data"]["task"]
    task_id = created_task["id"]
    assert created_task["status"] == "planned"
    assert len(created_task["milestones"]) >= 3

    list_response = await client.get("/api/v1/task-processes", headers=auth_headers)
    assert list_response.status_code == 200
    assert list_response.json()["data"]["total"] == 1

    time_log_payload = {
        "task_id": task_id,
        "hours": 2.5,
        "notes": "创建了 venv，安装了 requests，解决了激活失败问题",
    }
    log_response = await client.post(
        f"/api/v1/task-processes/{task_id}/evidence/time-log",
        json=time_log_payload,
        headers=auth_headers,
    )
    assert log_response.status_code == 200
    evidence = log_response.json()["data"]["evidence"]
    assert evidence["type"] == "time_log"
    assert evidence["metadata"]["hours"] == 2.5

    task_detail_response = await client.get(f"/api/v1/task-processes/{task_id}", headers=auth_headers)
    assert task_detail_response.status_code == 200
    task_detail = task_detail_response.json()["data"]["task"]
    assert task_detail["phase"] == "during"
    assert task_detail["status"] == "active"
    assert task_detail["actual_hours"] == 2.5
    assert task_detail["evidence_count"] == 1

    generate_payload = {
        "task_id": task_id,
        "format": "summary",
        "additional_instructions": "强调 venv 的使用场景和常见坑。",
    }
    generate_response = await client.post(
        f"/api/v1/task-processes/{task_id}/knowledge-outputs/generate",
        json=generate_payload,
        headers=auth_headers,
    )
    assert generate_response.status_code == 200
    knowledge_output = generate_response.json()["data"]["knowledge_output"]
    output_id = knowledge_output["id"]
    assert knowledge_output["status"] == "draft"
    assert knowledge_output["vault_relative_path"].endswith(".md")
    assert knowledge_output["markdown"].startswith("---\n")
    assert "# 学习 Python 虚拟环境" in knowledge_output["markdown"]

    vault_response = await client.put(
        "/api/v1/task-processes/vault-config",
        json={"vault_root_path": str(tmp_path)},
        headers=auth_headers,
    )
    assert vault_response.status_code == 200
    assert vault_response.json()["data"]["config"]["vault_root_path"] == str(tmp_path)

    publish_response = await client.post(
        f"/api/v1/task-processes/knowledge-outputs/{output_id}/publish",
        headers=auth_headers,
    )
    assert publish_response.status_code == 200
    published = publish_response.json()["data"]["knowledge_output"]
    assert published["status"] == "published"
    assert published["absolute_path"]
    assert tmp_path.joinpath(published["vault_relative_path"]).exists()


@pytest.mark.asyncio
async def test_task_process_phase_cannot_roll_back(client: AsyncClient, auth_headers: dict, clean_db):
    create_response = await client.post(
        "/api/v1/task-processes",
        json={
            "title": "实现一个小工具",
            "goal": "完成开发与总结",
            "category": "development",
            "auto_plan": False,
        },
        headers=auth_headers,
    )
    assert create_response.status_code == 200
    task_id = create_response.json()["data"]["task"]["id"]

    move_forward = await client.patch(
        f"/api/v1/task-processes/{task_id}",
        json={"phase": "during", "status": "active"},
        headers=auth_headers,
    )
    assert move_forward.status_code == 200

    move_back = await client.patch(
        f"/api/v1/task-processes/{task_id}",
        json={"phase": "before"},
        headers=auth_headers,
    )
    assert move_back.status_code == 400
    assert "不能回退" in move_back.json()["error"]


@pytest.mark.asyncio
async def test_rollback_knowledge_output(client: AsyncClient, auth_headers: dict, clean_db):
    # 1. 创建任务
    create_response = await client.post(
        "/api/v1/task-processes",
        json={
            "title": "测试回滚任务",
            "goal": "完成测试回滚",
            "category": "development",
            "auto_plan": False,
        },
        headers=auth_headers,
    )
    assert create_response.status_code == 200
    task_id = create_response.json()["data"]["task"]["id"]

    # 2. 生成知识产出 (V1)
    gen_response = await client.post(
        f"/api/v1/task-processes/{task_id}/knowledge-outputs/generate",
        json={"task_id": task_id, "format": "summary"},
        headers=auth_headers,
    )
    assert gen_response.status_code == 200
    ko = gen_response.json()["data"]["knowledge_output"]
    ko_id = ko["id"]
    assert ko["version"] == 1
    v1_markdown = ko["markdown"]

    # 3. 更新知识产出 (生成 V2)
    update_response = await client.patch(
        f"/api/v1/task-processes/knowledge-outputs/{ko_id}",
        json={"markdown": "# V2 Markdown 内容"},
        headers=auth_headers,
    )
    assert update_response.status_code == 200
    ko_v2 = update_response.json()["data"]["knowledge_output"]
    assert ko_v2["version"] == 2
    assert ko_v2["markdown"] == "# V2 Markdown 内容"

    # 4. 回滚到 V1
    rollback_response = await client.post(
        f"/api/v1/task-processes/knowledge-outputs/{ko_id}/rollback",
        json={"version": 1},
        headers=auth_headers,
    )
    assert rollback_response.status_code == 200
    ko_rolled = rollback_response.json()["data"]["knowledge_output"]
    # 回滚会新建一个版本 V3，其内容同 V1
    assert ko_rolled["version"] == 3
    assert ko_rolled["markdown"] == v1_markdown


@pytest.mark.asyncio
async def test_vault_conflict_policies(client: AsyncClient, auth_headers: dict, clean_db, tmp_path):
    # 1. 创建任务
    create_response = await client.post(
        "/api/v1/task-processes",
        json={
            "title": "测试冲突任务",
            "goal": "完成冲突测试",
            "category": "development",
            "auto_plan": False,
        },
        headers=auth_headers,
    )
    assert create_response.status_code == 200
    task_id = create_response.json()["data"]["task"]["id"]

    # 2. 生成知识产出
    gen_response = await client.post(
        f"/api/v1/task-processes/{task_id}/knowledge-outputs/generate",
        json={"task_id": task_id, "format": "summary"},
        headers=auth_headers,
    )
    assert gen_response.status_code == 200
    ko = gen_response.json()["data"]["knowledge_output"]
    ko_id = ko["id"]

    # 3. 设置 Vault 配置，policy = skip
    vault_response = await client.put(
        "/api/v1/task-processes/vault-config",
        json={"vault_root_path": str(tmp_path), "conflict_policy": "skip"},
        headers=auth_headers,
    )
    assert vault_response.status_code == 200

    # 4. 首次发布：成功
    publish_response1 = await client.post(
        f"/api/v1/task-processes/knowledge-outputs/{ko_id}/publish",
        headers=auth_headers,
    )
    assert publish_response1.status_code == 200
    path = publish_response1.json()["data"]["knowledge_output"]["absolute_path"]

    # 5. 再次发布 (冲突发生)：政策为 skip，报错 ValueError -> 400
    publish_response2 = await client.post(
        f"/api/v1/task-processes/knowledge-outputs/{ko_id}/publish",
        headers=auth_headers,
    )
    assert publish_response2.status_code == 400
    assert "文件已存在" in publish_response2.json()["error"]

    # 6. 设置 Vault 配置，policy = rename
    vault_response2 = await client.put(
        "/api/v1/task-processes/vault-config",
        json={"vault_root_path": str(tmp_path), "conflict_policy": "rename"},
        headers=auth_headers,
    )
    assert vault_response2.status_code == 200

    # 再次发布：生成重命名新文件，成功
    publish_response3 = await client.post(
        f"/api/v1/task-processes/knowledge-outputs/{ko_id}/publish",
        headers=auth_headers,
    )
    assert publish_response3.status_code == 200
    path3 = publish_response3.json()["data"]["knowledge_output"]["absolute_path"]
    assert path3 != path

