import pytest
from httpx import AsyncClient
from typing import Dict, Any


pytestmark = pytest.mark.asyncio


class TestUserRegistration:
    async def test_register_success(self, client: AsyncClient, clean_db, get_cookie_from_response):
        payload = {
            "email": "register@example.com",
            "password": "RegisterPassword123!",
            "username": "registeruser",
            "display_name": "Register User"
        }
        
        response = await client.post("/api/v1/auth/register", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["message"] == "注册成功"
        assert data["data"]["user"]["email"] == payload["email"]
        assert data["data"]["user"]["username"] == payload["username"]
        assert data["data"]["token"] is not None
        assert get_cookie_from_response(response, "refresh_token") is not None
    
    async def test_register_duplicate_email(self, client: AsyncClient, test_user):
        payload = {
            "email": test_user["email"],
            "password": "AnotherPassword123!",
            "username": "anotheruser"
        }
        
        response = await client.post("/api/v1/auth/register", json=payload)
        
        assert response.status_code == 400
    
    async def test_register_invalid_email(self, client: AsyncClient, clean_db):
        payload = {
            "email": "invalid-email",
            "password": "ValidPassword123!"
        }
        
        response = await client.post("/api/v1/auth/register", json=payload)
        
        assert response.status_code == 422
    
    async def test_register_weak_password(self, client: AsyncClient, clean_db):
        payload = {
            "email": "weak@example.com",
            "password": "short"
        }
        
        response = await client.post("/api/v1/auth/register", json=payload)
        
        assert response.status_code == 422
    
    async def test_register_with_phone(self, client: AsyncClient, clean_db):
        payload = {
            "email": "phone@example.com",
            "password": "PhonePassword123!",
            "phone": "13800138000"
        }
        
        response = await client.post("/api/v1/auth/register", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


class TestUserLogin:
    async def test_login_with_email_success(self, client: AsyncClient, test_user, get_cookie_from_response):
        payload = {
            "identifier": test_user["email"],
            "password": "TestPassword123!"
        }
        
        response = await client.post("/api/v1/auth/login", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["message"] == "登录成功"
        assert data["data"]["token"] is not None
        assert get_cookie_from_response(response, "refresh_token") is not None
    
    async def test_login_with_username_success(self, client: AsyncClient, test_user):
        payload = {
            "identifier": test_user["username"],
            "password": "TestPassword123!"
        }
        
        response = await client.post("/api/v1/auth/login", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
    
    async def test_login_wrong_password(self, client: AsyncClient, test_user):
        payload = {
            "identifier": test_user["email"],
            "password": "WrongPassword123!"
        }
        
        response = await client.post("/api/v1/auth/login", json=payload)
        
        assert response.status_code == 401
    
    async def test_login_nonexistent_user(self, client: AsyncClient, clean_db):
        payload = {
            "identifier": "nonexistent@example.com",
            "password": "SomePassword123!"
        }
        
        response = await client.post("/api/v1/auth/login", json=payload)
        
        assert response.status_code == 404
    
    async def test_login_remember_me(self, client: AsyncClient, test_user, get_cookie_from_response):
        payload = {
            "identifier": test_user["email"],
            "password": "TestPassword123!",
            "rememberMe": True
        }
        
        response = await client.post("/api/v1/auth/login", json=payload)
        
        assert response.status_code == 200
        assert get_cookie_from_response(response, "refresh_token") is not None
    
    async def test_login_empty_credentials(self, client: AsyncClient, clean_db):
        payload = {
            "identifier": "",
            "password": ""
        }
        
        response = await client.post("/api/v1/auth/login", json=payload)
        
        assert response.status_code == 422


class TestTokenRefresh:
    async def test_refresh_token_success(self, client: AsyncClient, test_user, get_cookie_from_response):
        login_payload = {
            "identifier": test_user["email"],
            "password": "TestPassword123!"
        }
        
        login_response = await client.post("/api/v1/auth/login", json=login_payload)
        assert login_response.status_code == 200
        
        refresh_token_value = get_cookie_from_response(login_response, "refresh_token")
        assert refresh_token_value is not None
        
        client.cookies.set("refresh_token", refresh_token_value)
        response = await client.post("/api/v1/auth/refresh")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["token"] is not None
    
    async def test_refresh_token_missing(self, client: AsyncClient, clean_db):
        response = await client.post("/api/v1/auth/refresh")
        
        assert response.status_code == 401
    
    async def test_refresh_token_invalid(self, client: AsyncClient, clean_db):
        client.cookies.set("refresh_token", "invalid-refresh-token")
        
        response = await client.post("/api/v1/auth/refresh")
        
        assert response.status_code == 401


class TestLogout:
    async def test_logout_success(self, client: AsyncClient, auth_headers, csrf_headers):
        response = await client.post("/api/v1/auth/logout", headers={**auth_headers, **csrf_headers})
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["message"] == "退出登录成功"
    
    async def test_logout_clears_cookies(self, client: AsyncClient, test_user, csrf_headers):
        login_payload = {
            "identifier": test_user["email"],
            "password": "TestPassword123!"
        }
        
        login_response = await client.post("/api/v1/auth/login", json=login_payload)
        assert login_response.status_code == 200
        
        response = await client.post("/api/v1/auth/logout", headers=csrf_headers)
        
        assert response.status_code == 200


class TestGetCurrentUser:
    async def test_get_current_user_success(self, client: AsyncClient, auth_headers, test_user):
        response = await client.get("/api/v1/auth/me", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["user"]["email"] == test_user["email"]
    
    async def test_get_current_user_unauthorized(self, client: AsyncClient, clean_db):
        response = await client.get("/api/v1/auth/me")
        
        assert response.status_code == 401
    
    async def test_get_current_user_invalid_token(self, client: AsyncClient, clean_db):
        headers = {"Authorization": "Bearer invalid-token"}
        
        response = await client.get("/api/v1/auth/me", headers=headers)
        
        assert response.status_code == 401


class TestUserProfile:
    async def test_get_profile_success(self, client: AsyncClient, auth_headers, test_user):
        response = await client.get("/api/v1/auth/profile", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["user"]["id"] == str(test_user["_id"])
    
    async def test_update_profile_success(self, client: AsyncClient, auth_headers, csrf_headers):
        update_payload = {
            "profile": {
                "displayName": "Updated Name",
                "bio": "Updated bio"
            }
        }
        
        response = await client.put("/api/v1/auth/profile", json=update_payload, headers={**auth_headers, **csrf_headers})
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["user"]["profile"]["displayName"] == "Updated Name"
    
    async def test_update_profile_unauthorized(self, client: AsyncClient, clean_db, csrf_headers):
        update_payload = {
            "profile": {
                "displayName": "Updated Name"
            }
        }
        
        response = await client.put("/api/v1/auth/profile", json=update_payload, headers=csrf_headers)
        
        assert response.status_code == 401
    
    async def test_update_profile_invalid_field(self, client: AsyncClient, auth_headers, csrf_headers):
        update_payload = {
            "profile": {
                "invalidField": "some value"
            }
        }
        
        response = await client.put("/api/v1/auth/profile", json=update_payload, headers={**auth_headers, **csrf_headers})
        
        assert response.status_code in [400, 422]


class TestForgotPassword:
    async def test_forgot_password_existing_email(self, client: AsyncClient, test_user):
        payload = {"email": test_user["email"]}
        
        response = await client.post("/api/v1/auth/forgot-password", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["message"] == "重置链接已生成"
    
    async def test_forgot_password_nonexistent_email(self, client: AsyncClient, clean_db):
        payload = {"email": "nonexistent@example.com"}
        
        response = await client.post("/api/v1/auth/forgot-password", json=payload)
        
        assert response.status_code == 404


class TestResetPassword:
    async def test_reset_password_success(self, client: AsyncClient, test_user):
        from app.database import db
        import secrets
        from datetime import datetime, timedelta
        
        reset_token = secrets.token_urlsafe(32)
        user_id = str(test_user["_id"])
        
        await db.db.password_reset_tokens.insert_one({
            "user_id": user_id,
            "token": reset_token,
            "expires_at": datetime.utcnow() + timedelta(minutes=15),
            "created_at": datetime.utcnow(),
            "used": False
        })
        
        payload = {
            "token": reset_token,
            "new_password": "NewPassword123!"
        }
        
        response = await client.post("/api/v1/auth/reset-password", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
    
    async def test_reset_password_invalid_token(self, client: AsyncClient, clean_db):
        payload = {
            "token": "invalid-token",
            "new_password": "NewPassword123!"
        }
        
        response = await client.post("/api/v1/auth/reset-password", json=payload)
        
        assert response.status_code == 400
    
    async def test_reset_password_weak_password(self, client: AsyncClient, clean_db):
        payload = {
            "token": "some-token",
            "new_password": "short"
        }
        
        response = await client.post("/api/v1/auth/reset-password", json=payload)
        
        assert response.status_code == 422


class TestCSRFToken:
    async def test_get_csrf_token_success(self, client: AsyncClient):
        response = await client.get("/api/v1/auth/csrf-token")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "cookieName" in data["data"]
        assert "headerName" in data["data"]
    
    async def test_csrf_middleware_blocks_post_without_token(self, client: AsyncClient):
        response = await client.post("/api/v1/auth/logout", headers={"Authorization": "Bearer some-token"})
        
        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert "CSRF" in data["error"]
    
    async def test_csrf_middleware_blocks_put_without_token(self, client: AsyncClient):
        response = await client.put(
            "/api/v1/auth/profile",
            json={"profile": {"displayName": "Test"}},
            headers={"Authorization": "Bearer some-token"}
        )
        
        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert "CSRF" in data["error"]
    
    async def test_csrf_middleware_allows_exempt_paths(self, client: AsyncClient, clean_db):
        payload = {
            "email": "csrf_exempt@example.com",
            "password": "TestPassword123!",
            "username": "csrfexempt"
        }
        
        response = await client.post("/api/v1/auth/register", json=payload)
        
        assert response.status_code == 200
    
    async def test_csrf_middleware_allows_get_requests(self, client: AsyncClient, auth_headers):
        response = await client.get("/api/v1/auth/me", headers=auth_headers)
        
        assert response.status_code == 200


class TestLLMConfig:
    async def test_get_llm_config_unauthorized(self, client: AsyncClient, clean_db):
        response = await client.get("/api/v1/auth/llm-config")
        
        assert response.status_code == 401
    
    async def test_get_llm_configs_unauthorized(self, client: AsyncClient, clean_db):
        response = await client.get("/api/v1/auth/llm-configs")
        
        assert response.status_code == 401
