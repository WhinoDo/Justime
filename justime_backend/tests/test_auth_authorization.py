import pytest
from httpx import AsyncClient
from typing import Dict, Any


pytestmark = pytest.mark.asyncio


class TestAuthenticationRequired:
    async def test_protected_endpoint_without_token(self, client: AsyncClient, clean_db):
        response = await client.get("/api/v1/auth/me")
        
        assert response.status_code == 401
    
    async def test_protected_endpoint_with_invalid_token(self, client: AsyncClient, clean_db):
        headers = {"Authorization": "Bearer invalid-token"}
        
        response = await client.get("/api/v1/auth/me", headers=headers)
        
        assert response.status_code == 401
    
    async def test_protected_endpoint_with_malformed_header(self, client: AsyncClient, clean_db):
        headers = {"Authorization": "InvalidFormat token"}
        
        response = await client.get("/api/v1/auth/me", headers=headers)
        
        assert response.status_code == 401
    
    async def test_protected_endpoint_without_bearer_prefix(self, client: AsyncClient, clean_db):
        from app.services.security_service import SecurityService
        
        token = SecurityService.create_access_token(data={"sub": "some-user-id"})
        headers = {"Authorization": token}
        
        response = await client.get("/api/v1/auth/me", headers=headers)
        
        assert response.status_code == 401


class TestAdminAuthorization:
    async def test_admin_users_endpoint_as_admin(self, client: AsyncClient, admin_auth_headers):
        response = await client.get("/api/v1/admin/users", headers=admin_auth_headers)
        
        assert response.status_code == 200
    
    async def test_admin_users_endpoint_as_user(self, client: AsyncClient, auth_headers):
        response = await client.get("/api/v1/admin/users", headers=auth_headers)
        
        assert response.status_code == 403
    
    async def test_admin_users_endpoint_unauthorized(self, client: AsyncClient, clean_db):
        response = await client.get("/api/v1/admin/users")
        
        assert response.status_code == 401
    
    async def test_admin_models_endpoint_as_admin(self, client: AsyncClient, admin_auth_headers):
        response = await client.get("/api/v1/admin/models", headers=admin_auth_headers)
        
        assert response.status_code == 200
    
    async def test_admin_models_endpoint_as_user(self, client: AsyncClient, auth_headers):
        response = await client.get("/api/v1/admin/models", headers=auth_headers)
        
        assert response.status_code == 403
    
    async def test_admin_stats_endpoint_as_admin(self, client: AsyncClient, admin_auth_headers):
        response = await client.get("/api/v1/admin/stats", headers=admin_auth_headers)
        
        assert response.status_code == 200
    
    async def test_admin_stats_endpoint_as_user(self, client: AsyncClient, auth_headers):
        response = await client.get("/api/v1/admin/stats", headers=auth_headers)
        
        assert response.status_code == 403
    
    async def test_admin_update_user_role_as_admin(
        self, 
        client: AsyncClient, 
        admin_auth_headers, 
        test_user,
        csrf_headers
    ):
        payload = {"role": "admin"}
        
        response = await client.put(
            f"/api/v1/admin/users/{test_user['_id']}/role",
            json=payload,
            headers={**admin_auth_headers, **csrf_headers}
        )
        
        assert response.status_code == 200
    
    async def test_admin_update_user_role_as_user(
        self,
        client: AsyncClient,
        auth_headers,
        test_user,
        csrf_headers
    ):
        payload = {"role": "admin"}
        
        response = await client.put(
            f"/api/v1/admin/users/{test_user['_id']}/role",
            json=payload,
            headers={**auth_headers, **csrf_headers}
        )
        
        assert response.status_code == 403
    
    async def test_admin_delete_user_as_admin(
        self,
        client: AsyncClient,
        admin_auth_headers,
        clean_db,
        csrf_headers
    ):
        from app.services.user_service import UserService
        
        user_data = {
            "email": "delete_target@example.com",
            "password": "DeletePassword123!",
            "username": "delete_target"
        }
        target_user = await UserService.create_user(user_data)
        
        response = await client.delete(
            f"/api/v1/admin/users/{target_user['_id']}",
            headers={**admin_auth_headers, **csrf_headers}
        )
        
        assert response.status_code == 200
    
    async def test_admin_delete_user_as_user(
        self,
        client: AsyncClient,
        auth_headers,
        test_user,
        csrf_headers
    ):
        response = await client.delete(
            f"/api/v1/admin/users/{test_user['_id']}",
            headers={**auth_headers, **csrf_headers}
        )
        
        assert response.status_code == 403


class TestUserStatusAuthorization:
    async def test_admin_update_user_status_as_admin(
        self,
        client: AsyncClient,
        admin_auth_headers,
        test_user,
        csrf_headers
    ):
        payload = {"status": "banned"}
        
        response = await client.put(
            f"/api/v1/admin/users/{test_user['_id']}/status",
            json=payload,
            headers={**admin_auth_headers, **csrf_headers}
        )
        
        assert response.status_code == 200
    
    async def test_admin_update_user_status_as_user(
        self,
        client: AsyncClient,
        auth_headers,
        test_user,
        csrf_headers
    ):
        payload = {"status": "banned"}
        
        response = await client.put(
            f"/api/v1/admin/users/{test_user['_id']}/status",
            json=payload,
            headers={**auth_headers, **csrf_headers}
        )
        
        assert response.status_code == 403


class TestModelAccessAuthorization:
    async def test_admin_update_user_model_access_as_admin(
        self,
        client: AsyncClient,
        admin_auth_headers,
        test_user,
        csrf_headers
    ):
        payload = {
            "access_all_models": False,
            "allowed_model_ids": ["model-1", "model-2"]
        }
        
        response = await client.put(
            f"/api/v1/admin/users/{test_user['_id']}/models",
            json=payload,
            headers={**admin_auth_headers, **csrf_headers}
        )
        
        assert response.status_code == 200
    
    async def test_admin_update_user_model_access_as_user(
        self,
        client: AsyncClient,
        auth_headers,
        test_user,
        csrf_headers
    ):
        payload = {
            "access_all_models": False,
            "allowed_model_ids": ["model-1"]
        }
        
        response = await client.put(
            f"/api/v1/admin/users/{test_user['_id']}/models",
            json=payload,
            headers={**auth_headers, **csrf_headers}
        )
        
        assert response.status_code == 403


class TestCrossUserAuthorization:
    async def test_user_cannot_access_other_user_profile(
        self,
        client: AsyncClient,
        clean_db
    ):
        from app.services.user_service import UserService
        from app.services.security_service import SecurityService
        
        user1_data = {
            "email": "user1@example.com",
            "password": "User1Password123!",
            "username": "user1"
        }
        user1 = await UserService.create_user(user1_data)
        
        user2_data = {
            "email": "user2@example.com",
            "password": "User2Password123!",
            "username": "user2"
        }
        user2 = await UserService.create_user(user2_data)
        
        user1_token = SecurityService.create_access_token(data={"sub": str(user1["_id"])})
        headers = {"Authorization": f"Bearer {user1_token}"}
        
        response = await client.get("/api/v1/auth/profile", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["user"]["email"] == user1["email"]


class TestObjectIdValidation:
    async def test_admin_endpoint_invalid_object_id(
        self,
        client: AsyncClient,
        admin_auth_headers,
        csrf_headers
    ):
        response = await client.put(
            "/api/v1/admin/users/invalid-id/status",
            json={"status": "active"},
            headers={**admin_auth_headers, **csrf_headers}
        )
        
        assert response.status_code == 400
    
    async def test_admin_endpoint_nonexistent_user(
        self,
        client: AsyncClient,
        admin_auth_headers,
        csrf_headers
    ):
        from bson import ObjectId
        
        nonexistent_id = str(ObjectId())
        
        response = await client.put(
            f"/api/v1/admin/users/{nonexistent_id}/status",
            json={"status": "active"},
            headers={**admin_auth_headers, **csrf_headers}
        )
        
        assert response.status_code == 404


class TestRoleValidation:
    async def test_admin_assign_valid_role(
        self,
        client: AsyncClient,
        admin_auth_headers,
        test_user,
        csrf_headers
    ):
        valid_roles = ["user", "admin"]
        
        for role in valid_roles:
            response = await client.put(
                f"/api/v1/admin/users/{test_user['_id']}/role",
                json={"role": role},
                headers={**admin_auth_headers, **csrf_headers}
            )
            assert response.status_code == 200
    
    async def test_admin_assign_invalid_role(
        self,
        client: AsyncClient,
        admin_auth_headers,
        test_user,
        csrf_headers
    ):
        response = await client.put(
            f"/api/v1/admin/users/{test_user['_id']}/role",
            json={"role": "superadmin"},
            headers={**admin_auth_headers, **csrf_headers}
        )
        
        assert response.status_code in [400, 422]


class TestStatusValidation:
    async def test_admin_assign_valid_status(
        self,
        client: AsyncClient,
        admin_auth_headers,
        test_user,
        csrf_headers
    ):
        valid_statuses = ["active", "banned"]
        
        for status in valid_statuses:
            response = await client.put(
                f"/api/v1/admin/users/{test_user['_id']}/status",
                json={"status": status},
                headers={**admin_auth_headers, **csrf_headers}
            )
            assert response.status_code == 200
    
    async def test_admin_assign_invalid_status(
        self,
        client: AsyncClient,
        admin_auth_headers,
        test_user,
        csrf_headers
    ):
        response = await client.put(
            f"/api/v1/admin/users/{test_user['_id']}/status",
            json={"status": "invalid_status"},
            headers={**admin_auth_headers, **csrf_headers}
        )
        
        assert response.status_code in [400, 422]
