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
