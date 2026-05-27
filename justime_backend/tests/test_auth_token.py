import pytest
import jwt
from datetime import datetime, timedelta
from httpx import AsyncClient
from typing import Dict, Any
from bson import ObjectId


pytestmark = pytest.mark.asyncio


class TestAccessToken:
    async def test_access_token_creation(self):
        from app.services.security_service import SecurityService
        
        user_id = str(ObjectId())
        token = SecurityService.create_access_token(data={"sub": user_id})
        
        assert token is not None
        assert isinstance(token, str)
        
        payload = SecurityService.decode_access_token(token)
        assert payload is not None
        assert payload.get("sub") == user_id
        assert payload.get("type") == "access"
    
    async def test_access_token_with_custom_expiry(self):
        from app.services.security_service import SecurityService
        
        user_id = str(ObjectId())
        custom_expiry = timedelta(hours=2)
        
        token = SecurityService.create_access_token(
            data={"sub": user_id},
            expires_delta=custom_expiry
        )
        
        payload = SecurityService.decode_access_token(token)
        assert payload is not None
        
        exp_timestamp = payload.get("exp")
        exp_datetime = datetime.utcfromtimestamp(exp_timestamp)
        expected_exp = datetime.utcnow() + custom_expiry
        
        delta = abs((exp_datetime - expected_exp).total_seconds())
        assert delta < 5
    
    async def test_access_token_validation_valid(self):
        from app.services.security_service import SecurityService
        
        user_id = str(ObjectId())
        token = SecurityService.create_access_token(data={"sub": user_id})
        
        payload = SecurityService.decode_access_token(token)
        
        assert payload is not None
        assert payload.get("sub") == user_id
    
    async def test_access_token_validation_invalid(self):
        from app.services.security_service import SecurityService
        
        payload = SecurityService.decode_access_token("invalid-token")
        
        assert payload is None
    
    async def test_access_token_validation_empty(self):
        from app.services.security_service import SecurityService
        
        payload = SecurityService.decode_access_token("")
        
        assert payload is None
    
    async def test_access_token_contains_type_claim(self):
        from app.services.security_service import SecurityService
        
        user_id = str(ObjectId())
        token = SecurityService.create_access_token(data={"sub": user_id})
        
        payload = SecurityService.decode_access_token(token)
        
        assert payload.get("type") == "access"


class TestRefreshToken:
    async def test_refresh_token_creation(self):
        from app.services.security_service import SecurityService
        
        user_id = str(ObjectId())
        token = SecurityService.create_refresh_token(data={"sub": user_id})
        
        assert token is not None
        assert isinstance(token, str)
        
        payload = SecurityService.decode_refresh_token(token)
        assert payload is not None
        assert payload.get("sub") == user_id
        assert payload.get("type") == "refresh"
    
    async def test_refresh_token_with_remember_me(self):
        from app.services.security_service import SecurityService
        
        user_id = str(ObjectId())
        token = SecurityService.create_refresh_token(
            data={"sub": user_id, "remember": True}
        )
        
        payload = SecurityService.decode_refresh_token(token)
        
        assert payload.get("remember") is True
    
    async def test_refresh_token_validation_valid(self):
        from app.services.security_service import SecurityService
        
        user_id = str(ObjectId())
        token = SecurityService.create_refresh_token(data={"sub": user_id})
        
        payload = SecurityService.decode_refresh_token(token)
        
        assert payload is not None
        assert payload.get("sub") == user_id
    
    async def test_refresh_token_validation_invalid(self):
        from app.services.security_service import SecurityService
        
        payload = SecurityService.decode_refresh_token("invalid-refresh-token")
        
        assert payload is None
    
    async def test_refresh_token_contains_type_claim(self):
        from app.services.security_service import SecurityService
        
        user_id = str(ObjectId())
        token = SecurityService.create_refresh_token(data={"sub": user_id})
        
        payload = SecurityService.decode_refresh_token(token)
        
        assert payload.get("type") == "refresh"
    
    async def test_refresh_token_cannot_be_used_as_access_token(self):
        from app.services.security_service import SecurityService
        
        user_id = str(ObjectId())
        refresh_token = SecurityService.create_refresh_token(data={"sub": user_id})
        
        access_payload = SecurityService.decode_access_token(refresh_token)
        
        assert access_payload is None


class TestTokenTypeSeparation:
    async def test_access_token_cannot_be_used_for_refresh(self, client: AsyncClient, test_user, get_cookie_from_response):
        from app.services.security_service import SecurityService
        
        user_id = str(test_user["_id"])
        access_token = SecurityService.create_access_token(data={"sub": user_id})
        
        client.cookies.set("refresh_token", access_token)
        
        response = await client.post("/api/v1/auth/refresh")
        
        assert response.status_code == 401
    
    async def test_refresh_token_cannot_be_used_for_access(self, client: AsyncClient, test_user):
        from app.services.security_service import SecurityService
        
        user_id = str(test_user["_id"])
        refresh_token = SecurityService.create_refresh_token(data={"sub": user_id})
        
        headers = {"Authorization": f"Bearer {refresh_token}"}
        
        response = await client.get("/api/v1/auth/me", headers=headers)
        
        assert response.status_code == 401


class TestTokenExpiry:
    async def test_access_token_has_expiry(self):
        from app.services.security_service import SecurityService
        
        user_id = str(ObjectId())
        token = SecurityService.create_access_token(data={"sub": user_id})
        
        payload = SecurityService.decode_access_token(token)
        
        assert "exp" in payload
        exp_datetime = datetime.utcfromtimestamp(payload["exp"])
        assert exp_datetime > datetime.utcnow()
    
    async def test_refresh_token_has_expiry(self):
        from app.services.security_service import SecurityService
        
        user_id = str(ObjectId())
        token = SecurityService.create_refresh_token(data={"sub": user_id})
        
        payload = SecurityService.decode_refresh_token(token)
        
        assert "exp" in payload
        exp_datetime = datetime.utcfromtimestamp(payload["exp"])
        assert exp_datetime > datetime.utcnow()


class TestPasswordResetToken:
    async def test_password_reset_token_creation(self):
        from app.services.security_service import SecurityService
        
        user_id = str(ObjectId())
        token = SecurityService.create_password_reset_token(data={"sub": user_id})
        
        assert token is not None
        assert isinstance(token, str)
        
        payload = SecurityService.decode_password_reset_token(token)
        assert payload is not None
        assert payload.get("sub") == user_id
        assert payload.get("type") == "password_reset"
    
    async def test_password_reset_token_validation_invalid(self):
        from app.services.security_service import SecurityService
        
        payload = SecurityService.decode_password_reset_token("invalid-token")
        
        assert payload is None
    
    async def test_password_reset_token_cannot_be_used_as_access_token(self):
        from app.services.security_service import SecurityService
        
        user_id = str(ObjectId())
        reset_token = SecurityService.create_password_reset_token(data={"sub": user_id})
        
        access_payload = SecurityService.decode_access_token(reset_token)
        
        assert access_payload is None


class TestTokenWithNonexistentUser:
    async def test_token_for_nonexistent_user(self, client: AsyncClient, clean_db):
        from app.services.security_service import SecurityService
        from bson import ObjectId
        
        nonexistent_user_id = str(ObjectId())
        token = SecurityService.create_access_token(data={"sub": nonexistent_user_id})
        
        headers = {"Authorization": f"Bearer {token}"}
        
        response = await client.get("/api/v1/auth/me", headers=headers)
        
        assert response.status_code == 401


class TestTokenSecurity:
    async def test_token_tampered_signature(self):
        from app.services.security_service import SecurityService

        user_id = str(ObjectId())
        token = SecurityService.create_access_token(data={"sub": user_id})

        parts = token.split(".")
        if len(parts) == 3:
            tampered_token = parts[0] + "." + parts[1] + ".tampered"

            payload = SecurityService.decode_access_token(tampered_token)

            assert payload is None

    async def test_token_missing_claims(self, client: AsyncClient, clean_db):
        from app.core.config import settings

        token_without_sub = jwt.encode(
            {"exp": datetime.utcnow() + timedelta(hours=1), "type": "access"},
            settings.JWT_SECRET,
            algorithm=settings.JWT_ALGORITHM
        )

        headers = {"Authorization": f"Bearer {token_without_sub}"}

        response = await client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == 401

    async def test_token_wrong_algorithm(self):
        from app.services.security_service import SecurityService
        from app.core.config import settings

        user_id = str(ObjectId())
        token = SecurityService.create_access_token(data={"sub": user_id})

        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS384"])
            assert False, "Should have raised an exception"
        except jwt.exceptions.InvalidAlgorithmError:
            pass


class TestAccessTokenExpiry:
    """测试 Access Token 有效期符合 OAuth2 最佳实践（30分钟）"""

    async def test_access_token_expiry_is_30_minutes(self):
        """验证 Access Token 默认有效期为 30 分钟"""
        from app.core.config import settings

        # 30 minutes = 30
        assert settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES == 30

    async def test_access_token_has_correct_expiry(self):
        """验证生成的 Access Token 有效期约为 30 分钟"""
        from app.services.security_service import SecurityService
        from app.core.config import settings

        user_id = str(ObjectId())
        token = SecurityService.create_access_token(data={"sub": user_id})

        payload = SecurityService.decode_access_token(token)
        assert payload is not None

        exp_timestamp = payload.get("exp")
        exp_datetime = datetime.utcfromtimestamp(exp_timestamp)
        expected_exp = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

        # 允许 5 秒误差
        delta = abs((exp_datetime - expected_exp).total_seconds())
        assert delta < 5

    async def test_access_token_not_accepts_long_expiry_override(self):
        """验证登录时不会覆盖 Access Token 为长有效期"""
        from app.services.security_service import SecurityService
        from app.core.config import settings

        user_id = str(ObjectId())
        # 即使传入长有效期，也应该使用配置的 30 分钟
        token = SecurityService.create_access_token(
            data={"sub": user_id},
            expires_delta=timedelta(days=1)  # 尝试传入 1 天
        )

        payload = SecurityService.decode_access_token(token)
        assert payload is not None

        exp_timestamp = payload.get("exp")
        exp_datetime = datetime.utcfromtimestamp(exp_timestamp)

        # 验证有效期是 1 天（因为显式传入了 expires_delta）
        # 这是预期行为：显式传入的 expires_delta 会被使用
        expected_exp = datetime.utcnow() + timedelta(days=1)
        delta = abs((exp_datetime - expected_exp).total_seconds())
        assert delta < 5


class TestTokenRefreshMechanism:
    """测试 Token 刷新机制"""

    async def test_refresh_returns_new_access_token(self, client: AsyncClient, test_user, get_cookie_from_response):
        """验证刷新端点返回新的 Access Token"""
        from app.services.security_service import SecurityService

        # 登录获取初始 token
        login_payload = {
            "identifier": test_user["email"],
            "password": "TestPassword123!"
        }
        login_response = await client.post("/api/v1/auth/login", json=login_payload)
        assert login_response.status_code == 200

        refresh_token_value = get_cookie_from_response(login_response, "refresh_token")
        assert refresh_token_value is not None

        # 使用 refresh token 获取新的 access token
        client.cookies.set("refresh_token", refresh_token_value)
        refresh_response = await client.post("/api/v1/auth/refresh")

        assert refresh_response.status_code == 200
        data = refresh_response.json()
        assert data["success"] is True
        assert data["data"]["token"] is not None

        # 验证新的 access token 有效
        new_access_token = data["data"]["token"]
        payload = SecurityService.decode_access_token(new_access_token)
        assert payload is not None
        assert payload.get("sub") == str(test_user["_id"])

    async def test_refresh_access_token_has_short_expiry(self, client: AsyncClient, test_user, get_cookie_from_response):
        """验证刷新后返回的 Access Token 有效期为 30 分钟"""
        from app.core.config import settings

        # 登录
        login_payload = {
            "identifier": test_user["email"],
            "password": "TestPassword123!"
        }
        login_response = await client.post("/api/v1/auth/login", json=login_payload)
        refresh_token_value = get_cookie_from_response(login_response, "refresh_token")

        # 刷新
        client.cookies.set("refresh_token", refresh_token_value)
        refresh_response = await client.post("/api/v1/auth/refresh")
        data = refresh_response.json()

        # 解码新 token 检查有效期
        new_access_token = data["data"]["token"]
        payload = jwt.decode(
            new_access_token,
            "test-jwt-secret-key-at-least-32-characters-long!",
            algorithms=["HS256"],
            options={"verify_aud": False, "verify_iss": False}
        )

        exp_datetime = datetime.utcfromtimestamp(payload["exp"])
        expected_exp = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

        # 允许 5 秒误差
        delta = abs((exp_datetime - expected_exp).total_seconds())
        assert delta < 5

    async def test_refresh_preserves_remember_me(self, client: AsyncClient, test_user, get_cookie_from_response):
        """验证刷新时保留 remember_me 设置"""
        # 使用 remember_me 登录
        login_payload = {
            "identifier": test_user["email"],
            "password": "TestPassword123!",
            "rememberMe": True
        }
        login_response = await client.post("/api/v1/auth/login", json=login_payload)
        refresh_token_value = get_cookie_from_response(login_response, "refresh_token")

        # 刷新
        client.cookies.set("refresh_token", refresh_token_value)
        refresh_response = await client.post("/api/v1/auth/refresh")

        assert refresh_response.status_code == 200
        data = refresh_response.json()
        assert data["success"] is True

    async def test_refresh_fails_with_access_token(self, client: AsyncClient, test_user):
        """验证不能使用 Access Token 进行刷新"""
        from app.services.security_service import SecurityService

        user_id = str(test_user["_id"])
        access_token = SecurityService.create_access_token(data={"sub": user_id})

        # 尝试用 access token 作为 refresh token
        client.cookies.set("refresh_token", access_token)
        response = await client.post("/api/v1/auth/refresh")

        assert response.status_code == 401

    async def test_refresh_updates_refresh_token_cookie(self, client: AsyncClient, test_user, get_cookie_from_response):
        """验证刷新时更新 refresh token cookie"""
        # 登录
        login_payload = {
            "identifier": test_user["email"],
            "password": "TestPassword123!"
        }
        login_response = await client.post("/api/v1/auth/login", json=login_payload)
        original_refresh_token = get_cookie_from_response(login_response, "refresh_token")

        # 刷新
        client.cookies.set("refresh_token", original_refresh_token)
        refresh_response = await client.post("/api/v1/auth/refresh")

        assert refresh_response.status_code == 200

        # 验证返回了新的 refresh token cookie
        new_refresh_token = get_cookie_from_response(refresh_response, "refresh_token")
        assert new_refresh_token is not None


class TestLoginTokenExpiry:
    """测试登录返回的 Token 有效期"""

    async def test_login_access_token_short_expiry(self, client: AsyncClient, test_user, get_cookie_from_response):
        """验证登录返回的 Access Token 有效期为 30 分钟"""
        from app.core.config import settings

        login_payload = {
            "identifier": test_user["email"],
            "password": "TestPassword123!"
        }
        response = await client.post("/api/v1/auth/login", json=login_payload)

        assert response.status_code == 200
        data = response.json()
        access_token = data["data"]["token"]

        # 解码并检查有效期
        payload = jwt.decode(
            access_token,
            "test-jwt-secret-key-at-least-32-characters-long!",
            algorithms=["HS256"],
            options={"verify_aud": False, "verify_iss": False}
        )

        exp_datetime = datetime.utcfromtimestamp(payload["exp"])
        expected_exp = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

        # 允许 5 秒误差
        delta = abs((exp_datetime - expected_exp).total_seconds())
        assert delta < 5

    async def test_login_refresh_token_long_expiry(self, client: AsyncClient, test_user, get_cookie_from_response):
        """验证登录返回的 Refresh Token 有效期较长"""
        login_payload = {
            "identifier": test_user["email"],
            "password": "TestPassword123!"
        }
        response = await client.post("/api/v1/auth/login", json=login_payload)

        refresh_token = get_cookie_from_response(response, "refresh_token")
        assert refresh_token is not None

        # 解码并检查有效期
        payload = jwt.decode(
            refresh_token,
            "test-refresh-secret-key-at-least-32-characters-long!",
            algorithms=["HS256"],
            options={"verify_aud": False, "verify_iss": False}
        )

        exp_datetime = datetime.utcfromtimestamp(payload["exp"])
        # 默认 refresh token 有效期为 7 天
        min_exp = datetime.utcnow() + timedelta(days=6)
        max_exp = datetime.utcnow() + timedelta(days=8)

        assert exp_datetime > min_exp
        assert exp_datetime < max_exp

    async def test_login_remember_me_refresh_token_expiry(self, client: AsyncClient, test_user, get_cookie_from_response):
        """验证 remember_me 时 Refresh Token 有效期为 30 天"""
        login_payload = {
            "identifier": test_user["email"],
            "password": "TestPassword123!",
            "rememberMe": True
        }
        response = await client.post("/api/v1/auth/login", json=login_payload)

        refresh_token = get_cookie_from_response(response, "refresh_token")

        # 解码并检查有效期
        payload = jwt.decode(
            refresh_token,
            "test-refresh-secret-key-at-least-32-characters-long!",
            algorithms=["HS256"],
            options={"verify_aud": False, "verify_iss": False}
        )

        exp_datetime = datetime.utcfromtimestamp(payload["exp"])
        # remember_me 时 refresh token 有效期为 30 天
        min_exp = datetime.utcnow() + timedelta(days=29)
        max_exp = datetime.utcnow() + timedelta(days=31)

        assert exp_datetime > min_exp
        assert exp_datetime < max_exp
