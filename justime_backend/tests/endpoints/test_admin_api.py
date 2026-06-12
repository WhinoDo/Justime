"""
Admin API 端到端测试
测试 CRUD 操作和权限控制
"""

import pytest
from httpx import AsyncClient
from typing import Dict, Any

pytestmark = pytest.mark.asyncio


class TestAdminPermissionControl:
    """测试管理员权限控制"""

    async def test_get_users_unauthorized(self, client: AsyncClient, clean_db):
        """未登录用户访问用户列表应返回401"""
        response = await client.get("/api/v1/admin/users")
        assert response.status_code == 401

    async def test_get_users_forbidden_for_normal_user(self, client: AsyncClient, auth_headers, clean_db):
        """普通用户访问用户列表应返回403"""
        response = await client.get("/api/v1/admin/users", headers=auth_headers)
        assert response.status_code == 403

    async def test_get_models_unauthorized(self, client: AsyncClient, clean_db):
        """未登录用户访问模型列表应返回401"""
        response = await client.get("/api/v1/admin/models")
        assert response.status_code == 401

    async def test_get_models_forbidden_for_normal_user(self, client: AsyncClient, auth_headers, clean_db):
        """普通用户访问模型列表应返回403"""
        response = await client.get("/api/v1/admin/models", headers=auth_headers)
        assert response.status_code == 403

    async def test_get_apikeys_unauthorized(self, client: AsyncClient, clean_db):
        """未登录用户访问API Key列表应返回401"""
        response = await client.get("/api/v1/admin/apikeys")
        assert response.status_code == 401

    async def test_get_apikeys_forbidden_for_normal_user(self, client: AsyncClient, auth_headers, clean_db):
        """普通用户访问API Key列表应返回403"""
        response = await client.get("/api/v1/admin/apikeys", headers=auth_headers)
        assert response.status_code == 403

    async def test_get_stats_unauthorized(self, client: AsyncClient, clean_db):
        """未登录用户访问系统统计应返回401"""
        response = await client.get("/api/v1/admin/stats")
        assert response.status_code == 401

    async def test_get_stats_forbidden_for_normal_user(self, client: AsyncClient, auth_headers, clean_db):
        """普通用户访问系统统计应返回403"""
        response = await client.get("/api/v1/admin/stats", headers=auth_headers)
        assert response.status_code == 403

    async def test_update_user_status_forbidden_for_normal_user(
        self, client: AsyncClient, auth_headers, test_user, clean_db
    ):
        """普通用户更新用户状态应返回403"""
        user_id = str(test_user["_id"])
        payload = {"status": "banned"}
        response = await client.put(
            f"/api/v1/admin/users/{user_id}/status",
            json=payload,
            headers=auth_headers,
        )
        assert response.status_code == 403

    async def test_update_user_role_forbidden_for_normal_user(
        self, client: AsyncClient, auth_headers, test_user, clean_db
    ):
        """普通用户更新用户角色应返回403"""
        user_id = str(test_user["_id"])
        payload = {"role": "admin"}
        response = await client.put(
            f"/api/v1/admin/users/{user_id}/role",
            json=payload,
            headers=auth_headers,
        )
        assert response.status_code == 403

    async def test_delete_user_forbidden_for_normal_user(
        self, client: AsyncClient, auth_headers, test_user, clean_db
    ):
        """普通用户删除用户应返回403"""
        user_id = str(test_user["_id"])
        response = await client.delete(
            f"/api/v1/admin/users/{user_id}",
            headers=auth_headers,
        )
        assert response.status_code == 403

    async def test_create_model_forbidden_for_normal_user(
        self, client: AsyncClient, auth_headers, clean_db
    ):
        """普通用户创建模型应返回403"""
        payload = {
            "name": "Test Model",
            "model_id": "test-model",
            "base_url": "https://api.test.com",
        }
        response = await client.post(
            "/api/v1/admin/models",
            json=payload,
            headers=auth_headers,
        )
        assert response.status_code == 403

    async def test_create_apikey_forbidden_for_normal_user(
        self, client: AsyncClient, auth_headers, clean_db
    ):
        """普通用户创建API Key应返回403"""
        payload = {
            "name": "Test API Key",
            "api_key": "test-key-123",
        }
        response = await client.post(
            "/api/v1/admin/apikeys",
            json=payload,
            headers=auth_headers,
        )
        assert response.status_code == 403


class TestAdminUserCRUD:
    """测试管理员用户 CRUD 操作"""

    async def test_get_users_success(self, client: AsyncClient, admin_auth_headers, test_user, clean_db):
        """管理员获取用户列表成功"""
        response = await client.get("/api/v1/admin/users", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        user_emails = [u["email"] for u in data]
        assert test_user["email"] in user_emails

    async def test_update_user_status_success(
        self, client: AsyncClient, admin_auth_headers, test_user, clean_db
    ):
        """管理员更新用户状态成功"""
        user_id = str(test_user["_id"])
        payload = {"status": "banned"}
        response = await client.put(
            f"/api/v1/admin/users/{user_id}/status",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        response = await client.get("/api/v1/admin/users", headers=admin_auth_headers)
        users = response.json()
        updated_user = next((u for u in users if u["id"] == user_id), None)
        assert updated_user is not None
        assert updated_user["status"] == "banned"

    async def test_update_user_status_invalid_id(
        self, client: AsyncClient, admin_auth_headers, clean_db
    ):
        """更新不存在用户的状态应返回404"""
        import bson
        fake_id = str(bson.ObjectId())
        payload = {"status": "banned"}
        response = await client.put(
            f"/api/v1/admin/users/{fake_id}/status",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 404

    async def test_update_user_status_malformed_id(
        self, client: AsyncClient, admin_auth_headers, clean_db
    ):
        """更新用户状态使用无效ID格式应返回400"""
        payload = {"status": "banned"}
        response = await client.put(
            "/api/v1/admin/users/invalid-id/status",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 400

    async def test_update_user_role_success(
        self, client: AsyncClient, admin_auth_headers, test_user, clean_db
    ):
        """管理员更新用户角色成功"""
        user_id = str(test_user["_id"])
        payload = {"role": "admin"}
        response = await client.put(
            f"/api/v1/admin/users/{user_id}/role",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        response = await client.get("/api/v1/admin/users", headers=admin_auth_headers)
        users = response.json()
        updated_user = next((u for u in users if u["id"] == user_id), None)
        assert updated_user is not None
        assert updated_user["role"] == "admin"

    async def test_update_user_role_invalid_id(
        self, client: AsyncClient, admin_auth_headers, clean_db
    ):
        """更新不存在用户的角色应返回404"""
        import bson
        fake_id = str(bson.ObjectId())
        payload = {"role": "admin"}
        response = await client.put(
            f"/api/v1/admin/users/{fake_id}/role",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 404

    async def test_update_user_model_access_success(
        self, client: AsyncClient, admin_auth_headers, test_user, clean_db
    ):
        """管理员更新用户模型访问权限成功"""
        user_id = str(test_user["_id"])
        payload = {
            "access_all_models": False,
            "allowed_model_ids": ["model-1", "model-2"],
        }
        response = await client.put(
            f"/api/v1/admin/users/{user_id}/models",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        response = await client.get("/api/v1/admin/users", headers=admin_auth_headers)
        users = response.json()
        updated_user = next((u for u in users if u["id"] == user_id), None)
        assert updated_user is not None
        assert updated_user["access_all_models"] is False
        assert "model-1" in updated_user["allowed_model_ids"]
        assert "model-2" in updated_user["allowed_model_ids"]

    async def test_update_user_model_access_empty_list(
        self, client: AsyncClient, admin_auth_headers, test_user, clean_db
    ):
        """管理员更新用户模型访问权限为空列表"""
        user_id = str(test_user["_id"])
        payload = {
            "access_all_models": True,
            "allowed_model_ids": [],
        }
        response = await client.put(
            f"/api/v1/admin/users/{user_id}/models",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 200

    async def test_update_user_model_access_invalid_id(
        self, client: AsyncClient, admin_auth_headers, clean_db
    ):
        """更新不存在用户的模型权限应返回404"""
        import bson
        fake_id = str(bson.ObjectId())
        payload = {
            "access_all_models": False,
            "allowed_model_ids": ["model-1"],
        }
        response = await client.put(
            f"/api/v1/admin/users/{fake_id}/models",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 404

    async def test_delete_user_success(
        self, client: AsyncClient, admin_auth_headers, clean_db
    ):
        """管理员删除用户成功"""
        from app.services.user_service import UserService
        user_data = {
            "email": "delete_me@example.com",
            "password": "DeletePassword123!",
            "username": "delete_me",
            "displayName": "Delete Me",
            "role": "user",
        }
        user = await UserService.create_user(user_data)
        user_id = str(user["_id"])

        response = await client.delete(
            f"/api/v1/admin/users/{user_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        response = await client.get("/api/v1/admin/users", headers=admin_auth_headers)
        users = response.json()
        user_ids = [u["id"] for u in users]
        assert user_id not in user_ids

    async def test_delete_user_invalid_id(
        self, client: AsyncClient, admin_auth_headers, clean_db
    ):
        """删除不存在用户应返回404"""
        import bson
        fake_id = str(bson.ObjectId())
        response = await client.delete(
            f"/api/v1/admin/users/{fake_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 404


class TestAdminModelCRUD:
    """测试管理员模型 CRUD 操作"""

    async def test_get_models_empty(self, client: AsyncClient, admin_auth_headers, clean_db):
        """管理员获取空模型列表"""
        response = await client.get("/api/v1/admin/models", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_create_model_success(self, client: AsyncClient, admin_auth_headers, clean_db):
        """管理员创建模型成功"""
        payload = {
            "name": "Test GPT Model",
            "model_id": "gpt-4-test",
            "base_url": "https://api.openai.com/v1",
            "api_key": "test-api-key-123",
            "temperature": 0.7,
            "capabilities": ["fast", "reasoning"],
            "priority": 100,
            "enabled": True,
        }
        response = await client.post(
            "/api/v1/admin/models",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == payload["name"]
        assert data["model_id"] == payload["model_id"]
        assert data["has_api_key"] is True
        assert "id" in data

    async def test_create_model_with_custom_id(self, client: AsyncClient, admin_auth_headers, clean_db):
        """管理员创建模型使用自定义ID"""
        payload = {
            "id": "custom-model-id",
            "name": "Custom Model",
            "model_id": "custom-model",
            "base_url": "https://api.custom.com",
        }
        response = await client.post(
            "/api/v1/admin/models",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "custom-model-id"

    async def test_create_model_with_api_key_reference(
        self, client: AsyncClient, admin_auth_headers, clean_db
    ):
        """管理员创建模型引用系统API Key"""
        key_payload = {
            "name": "Test Key for Model",
            "api_key": "sk-test-key",
        }
        key_response = await client.post(
            "/api/v1/admin/apikeys",
            json=key_payload,
            headers=admin_auth_headers,
        )
        assert key_response.status_code == 200
        key_id = key_response.json()["id"]

        model_payload = {
            "name": "Model with Key Reference",
            "model_id": "ref-model",
            "base_url": "https://api.test.com",
            "api_key_id": key_id,
        }
        response = await client.post(
            "/api/v1/admin/models",
            json=model_payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["api_key_id"] == key_id
        assert data["has_api_key"] is True

    async def test_update_model_success(self, client: AsyncClient, admin_auth_headers, clean_db):
        """管理员更新模型成功"""
        create_payload = {
            "name": "Model to Update",
            "model_id": "update-model",
            "base_url": "https://api.original.com",
        }
        create_response = await client.post(
            "/api/v1/admin/models",
            json=create_payload,
            headers=admin_auth_headers,
        )
        assert create_response.status_code == 200
        model_id = create_response.json()["id"]

        update_payload = {
            "name": "Updated Model Name",
            "model_id": "updated-model-id",
            "base_url": "https://api.updated.com",
            "temperature": 0.5,
            "enabled": False,
        }
        response = await client.put(
            f"/api/v1/admin/models/{model_id}",
            json=update_payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Model Name"
        assert data["model_id"] == "updated-model-id"
        assert data["temperature"] == 0.5
        assert data["enabled"] is False

    async def test_update_model_by_model_id(self, client: AsyncClient, admin_auth_headers, clean_db):
        """管理员通过model_id更新模型"""
        create_payload = {
            "name": "Model for ID Update",
            "model_id": "unique-model-id-for-update",
            "base_url": "https://api.test.com",
        }
        create_response = await client.post(
            "/api/v1/admin/models",
            json=create_payload,
            headers=admin_auth_headers,
        )
        assert create_response.status_code == 200

        update_payload = {
            "name": "Updated by Model ID",
            "model_id": "unique-model-id-for-update",
            "base_url": "https://api.test.com",
        }
        response = await client.put(
            "/api/v1/admin/models/unique-model-id-for-update",
            json=update_payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated by Model ID"

    async def test_update_model_not_found(self, client: AsyncClient, admin_auth_headers, clean_db):
        """更新不存在模型应返回404"""
        payload = {
            "name": "Nonexistent Model",
            "model_id": "nonexistent",
            "base_url": "https://api.test.com",
        }
        response = await client.put(
            "/api/v1/admin/models/nonexistent-model-id",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 404

    async def test_update_model_empty_id(self, client: AsyncClient, admin_auth_headers, clean_db):
        """更新模型使用空ID应返回400"""
        payload = {
            "name": "Test",
            "model_id": "test",
            "base_url": "https://api.test.com",
        }
        response = await client.put(
            "/api/v1/admin/models/   ",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 400

    async def test_delete_model_success(self, client: AsyncClient, admin_auth_headers, clean_db):
        """管理员删除模型成功"""
        create_payload = {
            "name": "Model to Delete",
            "model_id": "delete-model",
            "base_url": "https://api.test.com",
        }
        create_response = await client.post(
            "/api/v1/admin/models",
            json=create_payload,
            headers=admin_auth_headers,
        )
        assert create_response.status_code == 200
        model_id = create_response.json()["id"]

        response = await client.delete(
            f"/api/v1/admin/models/{model_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        response = await client.get("/api/v1/admin/models", headers=admin_auth_headers)
        models = response.json()
        model_ids = [m["id"] for m in models]
        assert model_id not in model_ids

    async def test_delete_model_by_model_id(self, client: AsyncClient, admin_auth_headers, clean_db):
        """管理员通过model_id删除模型"""
        create_payload = {
            "name": "Model to Delete by Model ID",
            "model_id": "delete-by-model-id",
            "base_url": "https://api.test.com",
        }
        create_response = await client.post(
            "/api/v1/admin/models",
            json=create_payload,
            headers=admin_auth_headers,
        )
        assert create_response.status_code == 200

        response = await client.delete(
            "/api/v1/admin/models/delete-by-model-id",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200

    async def test_delete_model_not_found(self, client: AsyncClient, admin_auth_headers, clean_db):
        """删除不存在模型应返回404"""
        response = await client.delete(
            "/api/v1/admin/models/nonexistent-model",
            headers=admin_auth_headers,
        )
        assert response.status_code == 404

    async def test_delete_model_empty_id(self, client: AsyncClient, admin_auth_headers, clean_db):
        """删除模型使用空ID应返回400"""
        response = await client.delete(
            "/api/v1/admin/models/   ",
            headers=admin_auth_headers,
        )
        assert response.status_code == 400

    async def test_model_connection_no_key(self, client: AsyncClient, admin_auth_headers, clean_db):
        """测试模型连接当未提供API Key时应失败且明确提示"""
        payload = {
            "base_url": "https://api.deepseek.com",
            "model_id": "deepseek-v4-pro",
        }
        response = await client.post(
            "/api/v1/admin/models/test",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "API Key" in data["message"]


class TestAdminApiKeyCRUD:
    """测试管理员 API Key CRUD 操作"""

    async def test_get_apikeys_empty(self, client: AsyncClient, admin_auth_headers, clean_db):
        """管理员获取空API Key列表"""
        response = await client.get("/api/v1/admin/apikeys", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_create_apikey_success(self, client: AsyncClient, admin_auth_headers, clean_db):
        """管理员创建API Key成功"""
        payload = {
            "name": "Test API Key",
            "api_key": "sk-test-api-key-12345",
        }
        response = await client.post(
            "/api/v1/admin/apikeys",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == payload["name"]
        assert data["api_key"] == payload["api_key"]
        assert "id" in data

    async def test_create_apikey_with_custom_id(self, client: AsyncClient, admin_auth_headers, clean_db):
        """管理员创建API Key使用自定义ID"""
        payload = {
            "id": "custom-key-id",
            "name": "Custom Key",
            "api_key": "sk-custom-key",
        }
        response = await client.post(
            "/api/v1/admin/apikeys",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "custom-key-id"

    async def test_get_apikeys_after_create(self, client: AsyncClient, admin_auth_headers, clean_db):
        """创建API Key后列表应包含该Key"""
        payload = {
            "name": "Key for List Test",
            "api_key": "sk-list-test-key",
        }
        create_response = await client.post(
            "/api/v1/admin/apikeys",
            json=payload,
            headers=admin_auth_headers,
        )
        assert create_response.status_code == 200
        created_id = create_response.json()["id"]

        response = await client.get("/api/v1/admin/apikeys", headers=admin_auth_headers)
        assert response.status_code == 200
        keys = response.json()
        key_ids = [k["id"] for k in keys]
        assert created_id in key_ids

        created_key = next((k for k in keys if k["id"] == created_id), None)
        assert created_key is not None
        assert created_key["has_api_key"] is True

    async def test_update_apikey_success(self, client: AsyncClient, admin_auth_headers, clean_db):
        """管理员更新API Key成功"""
        create_payload = {
            "name": "Key to Update",
            "api_key": "sk-original-key",
        }
        create_response = await client.post(
            "/api/v1/admin/apikeys",
            json=create_payload,
            headers=admin_auth_headers,
        )
        assert create_response.status_code == 200
        key_id = create_response.json()["id"]

        update_payload = {
            "name": "Updated Key Name",
            "api_key": "sk-new-api-key",
        }
        response = await client.put(
            f"/api/v1/admin/apikeys/{key_id}",
            json=update_payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Key Name"

    async def test_update_apikey_preserve_key(self, client: AsyncClient, admin_auth_headers, clean_db):
        """更新API Key时不提供新key应保留原key"""
        create_payload = {
            "name": "Key for Preserve Test",
            "api_key": "sk-original-to-preserve",
        }
        create_response = await client.post(
            "/api/v1/admin/apikeys",
            json=create_payload,
            headers=admin_auth_headers,
        )
        assert create_response.status_code == 200
        key_id = create_response.json()["id"]

        update_payload = {
            "name": "Updated Name Only",
        }
        response = await client.put(
            f"/api/v1/admin/apikeys/{key_id}",
            json=update_payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name Only"
        assert data["has_api_key"] is True

    async def test_update_apikey_not_found(self, client: AsyncClient, admin_auth_headers, clean_db):
        """更新不存在API Key应返回404"""
        import bson
        fake_id = str(bson.ObjectId())
        payload = {"name": "Nonexistent Key", "api_key": "sk-test"}
        response = await client.put(
            f"/api/v1/admin/apikeys/{fake_id}",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 404

    async def test_update_apikey_invalid_id(self, client: AsyncClient, admin_auth_headers, clean_db):
        """更新API Key使用空ID应返回400"""
        payload = {"name": "Test", "api_key": "sk-test"}
        response = await client.put(
            "/api/v1/admin/apikeys/   ",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 400

    async def test_delete_apikey_success(self, client: AsyncClient, admin_auth_headers, clean_db):
        """管理员删除API Key成功"""
        create_payload = {
            "name": "Key to Delete",
            "api_key": "sk-delete-key",
        }
        create_response = await client.post(
            "/api/v1/admin/apikeys",
            json=create_payload,
            headers=admin_auth_headers,
        )
        assert create_response.status_code == 200
        key_id = create_response.json()["id"]

        response = await client.delete(
            f"/api/v1/admin/apikeys/{key_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        response = await client.get("/api/v1/admin/apikeys", headers=admin_auth_headers)
        keys = response.json()
        key_ids = [k["id"] for k in keys]
        assert key_id not in key_ids

    async def test_delete_apikey_not_found(self, client: AsyncClient, admin_auth_headers, clean_db):
        """删除不存在API Key应返回404"""
        import bson
        fake_id = str(bson.ObjectId())
        response = await client.delete(
            f"/api/v1/admin/apikeys/{fake_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 404

    async def test_delete_apikey_invalid_id(self, client: AsyncClient, admin_auth_headers, clean_db):
        """删除API Key使用空ID应返回400"""
        response = await client.delete(
            "/api/v1/admin/apikeys/   ",
            headers=admin_auth_headers,
        )
        assert response.status_code == 400


class TestAdminSystemStats:
    """测试管理员系统统计"""

    async def test_get_stats_success(self, client: AsyncClient, admin_auth_headers, clean_db):
        """管理员获取系统统计成功"""
        response = await client.get("/api/v1/admin/stats", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        assert "active_users" in data
        assert "total_tokens" in data
        assert "total_conversations" in data
        assert "version" in data
        assert isinstance(data["total_users"], int)
        assert isinstance(data["active_users"], int)

    async def test_get_stats_with_users(
        self, client: AsyncClient, admin_auth_headers, test_user, admin_user, clean_db
    ):
        """有用户时统计应正确"""
        response = await client.get("/api/v1/admin/stats", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_users"] >= 2


class TestAdminValidation:
    """测试管理员输入验证"""

    async def test_create_model_missing_required_fields(
        self, client: AsyncClient, admin_auth_headers, clean_db
    ):
        """创建模型缺少必填字段应返回422"""
        payload = {"name": "Test"}
        response = await client.post(
            "/api/v1/admin/models",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 422

    async def test_create_model_invalid_temperature(
        self, client: AsyncClient, admin_auth_headers, clean_db
    ):
        """创建模型温度参数超出范围应返回422"""
        payload = {
            "name": "Test Model",
            "model_id": "test-model",
            "base_url": "https://api.test.com",
            "temperature": 3.0,
        }
        response = await client.post(
            "/api/v1/admin/models",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 422

    async def test_create_model_invalid_priority(
        self, client: AsyncClient, admin_auth_headers, clean_db
    ):
        """创建模型优先级超出范围应返回422"""
        payload = {
            "name": "Test Model",
            "model_id": "test-model",
            "base_url": "https://api.test.com",
            "priority": 1000,
        }
        response = await client.post(
            "/api/v1/admin/models",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 422

    async def test_update_user_status_invalid_status(
        self, client: AsyncClient, admin_auth_headers, test_user, clean_db
    ):
        """更新用户状态使用无效值应返回422"""
        user_id = str(test_user["_id"])
        payload = {"status": "invalid_status"}
        response = await client.put(
            f"/api/v1/admin/users/{user_id}/status",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 422

    async def test_update_user_role_invalid_role(
        self, client: AsyncClient, admin_auth_headers, test_user, clean_db
    ):
        """更新用户角色使用无效值应返回422"""
        user_id = str(test_user["_id"])
        payload = {"role": "super_admin"}
        response = await client.put(
            f"/api/v1/admin/users/{user_id}/role",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 422

    async def test_create_apikey_missing_name(
        self, client: AsyncClient, admin_auth_headers, clean_db
    ):
        """创建API Key缺少名称应返回422"""
        payload = {"api_key": "sk-test"}
        response = await client.post(
            "/api/v1/admin/apikeys",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 422

    async def test_update_user_model_access_empty_model_id(
        self, client: AsyncClient, admin_auth_headers, test_user, clean_db
    ):
        """更新用户模型权限使用空模型ID应返回400"""
        user_id = str(test_user["_id"])
        payload = {
            "access_all_models": False,
            "allowed_model_ids": ["valid-id", ""],
        }
        response = await client.put(
            f"/api/v1/admin/users/{user_id}/models",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 400


class TestAdminEdgeCases:
    """测试管理员边界情况"""

    async def test_admin_can_delete_self(
        self, client: AsyncClient, admin_auth_headers, admin_user, clean_db
    ):
        """管理员可以删除自己（注意：这是当前行为，可能需要在业务层添加保护）"""
        admin_id = str(admin_user["_id"])
        response = await client.delete(
            f"/api/v1/admin/users/{admin_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200

    async def test_create_model_duplicate_id_auto_resolved(
        self, client: AsyncClient, admin_auth_headers, clean_db
    ):
        """创建模型ID冲突时自动解决"""
        payload1 = {
            "id": "duplicate-model-id",
            "name": "First Model",
            "model_id": "first-model",
            "base_url": "https://api.first.com",
        }
        response1 = await client.post(
            "/api/v1/admin/models",
            json=payload1,
            headers=admin_auth_headers,
        )
        assert response1.status_code == 200

        payload2 = {
            "id": "duplicate-model-id",
            "name": "Second Model",
            "model_id": "second-model",
            "base_url": "https://api.second.com",
        }
        response2 = await client.post(
            "/api/v1/admin/models",
            json=payload2,
            headers=admin_auth_headers,
        )
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["id"] != "duplicate-model-id"

    async def test_create_apikey_duplicate_id_auto_resolved(
        self, client: AsyncClient, admin_auth_headers, clean_db
    ):
        """创建API Key ID冲突时自动解决"""
        payload1 = {
            "id": "duplicate-key-id",
            "name": "First Key",
            "api_key": "sk-first-key",
        }
        response1 = await client.post(
            "/api/v1/admin/apikeys",
            json=payload1,
            headers=admin_auth_headers,
        )
        assert response1.status_code == 200

        payload2 = {
            "id": "duplicate-key-id",
            "name": "Second Key",
            "api_key": "sk-second-key",
        }
        response2 = await client.post(
            "/api/v1/admin/apikeys",
            json=payload2,
            headers=admin_auth_headers,
        )
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["id"] != "duplicate-key-id"

    async def test_model_capabilities_filtered(
        self, client: AsyncClient, admin_auth_headers, clean_db
    ):
        """模型capabilities应被过滤为允许的值"""
        payload = {
            "name": "Model with Capabilities",
            "model_id": "cap-model",
            "base_url": "https://api.test.com",
            "capabilities": ["fast", "reasoning", "invalid_cap", "another_invalid"],
        }
        response = await client.post(
            "/api/v1/admin/models",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "fast" in data["capabilities"]
        assert "reasoning" in data["capabilities"]
        assert "invalid_cap" not in data["capabilities"]

    async def test_model_priority_accepted(
        self, client: AsyncClient, admin_auth_headers, clean_db
    ):
        """模型priority值被接受（当前不进行范围限制）"""
        payload = {
            "name": "Model with Priority",
            "model_id": "priority-model",
            "base_url": "https://api.test.com",
            "priority": 500,
        }
        response = await client.post(
            "/api/v1/admin/models",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["priority"] == 500

    async def test_update_model_preserve_api_key(
        self, client: AsyncClient, admin_auth_headers, clean_db
    ):
        """更新模型时不提供新api_key应保留原key"""
        create_payload = {
            "name": "Model to Preserve Key",
            "model_id": "preserve-key-model",
            "base_url": "https://api.test.com",
            "api_key": "sk-original-model-key",
        }
        create_response = await client.post(
            "/api/v1/admin/models",
            json=create_payload,
            headers=admin_auth_headers,
        )
        assert create_response.status_code == 200
        model_id = create_response.json()["id"]

        update_payload = {
            "name": "Updated Model Name",
            "model_id": "preserve-key-model",
            "base_url": "https://api.test.com",
        }
        response = await client.put(
            f"/api/v1/admin/models/{model_id}",
            json=update_payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Model Name"
        assert data["has_api_key"] is True

    async def test_update_model_switch_to_api_key_reference(
        self, client: AsyncClient, admin_auth_headers, clean_db
    ):
        """更新模型切换到引用系统API Key"""
        create_payload = {
            "name": "Model with Inline Key",
            "model_id": "switch-key-model",
            "base_url": "https://api.test.com",
            "api_key": "sk-inline-key",
        }
        create_response = await client.post(
            "/api/v1/admin/models",
            json=create_payload,
            headers=admin_auth_headers,
        )
        assert create_response.status_code == 200
        model_id = create_response.json()["id"]

        key_payload = {
            "name": "System Key for Switch",
            "api_key": "sk-system-key",
        }
        key_response = await client.post(
            "/api/v1/admin/apikeys",
            json=key_payload,
            headers=admin_auth_headers,
        )
        assert key_response.status_code == 200
        key_id = key_response.json()["id"]

        update_payload = {
            "name": "Model with System Key",
            "model_id": "switch-key-model",
            "base_url": "https://api.test.com",
            "api_key_id": key_id,
        }
        response = await client.put(
            f"/api/v1/admin/models/{model_id}",
            json=update_payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["api_key_id"] == key_id

    async def test_update_user_status_same_value(
        self, client: AsyncClient, admin_auth_headers, test_user, clean_db
    ):
        """更新用户状态为相同值应成功"""
        user_id = str(test_user["_id"])
        payload = {"status": "active"}
        response = await client.put(
            f"/api/v1/admin/users/{user_id}/status",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 200

    async def test_update_user_role_same_value(
        self, client: AsyncClient, admin_auth_headers, test_user, clean_db
    ):
        """更新用户角色为相同值应成功"""
        user_id = str(test_user["_id"])
        payload = {"role": "user"}
        response = await client.put(
            f"/api/v1/admin/users/{user_id}/role",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 200

    async def test_get_users_includes_admin(
        self, client: AsyncClient, admin_auth_headers, admin_user, clean_db
    ):
        """获取用户列表应包含管理员"""
        response = await client.get("/api/v1/admin/users", headers=admin_auth_headers)
        assert response.status_code == 200
        users = response.json()
        admin_emails = [u["email"] for u in users if u["role"] == "admin"]
        assert admin_user["email"] in admin_emails

    async def test_create_model_with_all_fields(
        self, client: AsyncClient, admin_auth_headers, clean_db
    ):
        """创建模型包含所有字段"""
        payload = {
            "name": "Full Model",
            "model_id": "full-model",
            "base_url": "https://api.full.com",
            "api_key": "sk-full-key",
            "temperature": 0.5,
            "capabilities": ["fast", "reasoning", "tool_call"],
            "priority": 50,
            "enabled": False,
        }
        response = await client.post(
            "/api/v1/admin/models",
            json=payload,
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Full Model"
        assert data["model_id"] == "full-model"
        assert data["temperature"] == 0.5
        assert set(data["capabilities"]) == {"fast", "reasoning", "tool_call"}
        assert data["priority"] == 50
        assert data["enabled"] is False
        assert data["has_api_key"] is True

    async def test_delete_user_nonexistent_returns_404(
        self, client: AsyncClient, admin_auth_headers, clean_db
    ):
        """删除不存在用户返回404"""
        import bson
        fake_id = str(bson.ObjectId())
        response = await client.delete(
            f"/api/v1/admin/users/{fake_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 404

    async def test_update_user_status_malformed_json(
        self, client: AsyncClient, admin_auth_headers, test_user, clean_db
    ):
        """更新用户状态使用无效JSON应返回422"""
        user_id = str(test_user["_id"])
        response = await client.put(
            f"/api/v1/admin/users/{user_id}/status",
            content="invalid json",
            headers=admin_auth_headers,
        )
        assert response.status_code == 422
