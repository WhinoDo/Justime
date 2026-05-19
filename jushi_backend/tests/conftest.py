import asyncio
import os
import pytest
import pytest_asyncio
from datetime import datetime
from typing import AsyncGenerator, Dict, Any
from httpx import AsyncClient, ASGITransport
from motor.motor_asyncio import AsyncIOMotorClient
from unittest.mock import patch, AsyncMock

os.environ["JWT_SECRET"] = "test-jwt-secret-key-at-least-32-characters-long!"
os.environ["JWT_REFRESH_SECRET"] = "test-refresh-secret-key-at-least-32-characters-long!"
os.environ["JWT_PASSWORD_RESET_SECRET"] = "test-password-reset-secret-key-at-least-32-characters-long!"
os.environ["ENCRYPTION_SECRET"] = "test-encryption-secret-key-at-least-32-characters-long!"
os.environ["CSRF_SECRET"] = "test-csrf-secret-key-at-least-32-characters-long!"
os.environ["CSRF_ENABLED"] = "false"
os.environ["DEBUG"] = "true"
os.environ["MONGODB_URI"] = "mongodb://localhost:27017/jushi_test"
os.environ["MONGODB_DB_NAME"] = "jushi_test"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def test_db():
    from app.core.config import settings
    
    client_options = {
        "maxPoolSize": settings.MONGODB_MAX_POOL_SIZE,
        "minPoolSize": settings.MONGODB_MIN_POOL_SIZE,
        "maxIdleTimeMS": settings.MONGODB_MAX_IDLE_TIME_MS,
        "connectTimeoutMS": settings.MONGODB_CONNECT_TIMEOUT_MS,
        "serverSelectionTimeoutMS": settings.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
        "socketTimeoutMS": settings.MONGODB_SOCKET_TIMEOUT_MS,
        "retryWrites": True,
        "retryReads": True,
    }
    
    valid_read_preferences = {
        "primary", "primaryPreferred", "secondary", "secondaryPreferred", "nearest"
    }
    read_pref = settings.MONGODB_READ_PREFERENCE
    if read_pref in valid_read_preferences:
        client_options["readPreference"] = read_pref
    
    client = AsyncIOMotorClient(settings.MONGODB_URI, **client_options)
    db = client[settings.MONGODB_DB_NAME]
    
    yield db
    
    await client.drop_database(settings.MONGODB_DB_NAME)
    client.close()


@pytest_asyncio.fixture(scope="function")
async def clean_db(app):
    from app.database import db
    
    if db.db is not None:
        collections = await db.db.list_collection_names()
        for collection_name in collections:
            await db.db[collection_name].delete_many({})
    yield db.db


@pytest_asyncio.fixture
async def app():
    from app.main import create_app
    from app.database import connect_to_mongo, close_mongo_connection, db as db_module
    
    test_app = create_app()
    
    await connect_to_mongo()
    
    yield test_app
    
    await close_mongo_connection()


@pytest_asyncio.fixture
async def client(app) -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac


@pytest_asyncio.fixture
async def test_user(clean_db) -> Dict[str, Any]:
    from app.services.user_service import UserService
    
    user_data = {
        "email": "testuser@example.com",
        "password": "TestPassword123!",
        "username": "testuser",
        "displayName": "Test User",
        "role": "user"
    }
    
    user = await UserService.create_user(user_data)
    return user


@pytest_asyncio.fixture
async def admin_user(clean_db) -> Dict[str, Any]:
    from app.services.user_service import UserService
    
    user_data = {
        "email": "admin@example.com",
        "password": "AdminPassword123!",
        "username": "admin",
        "displayName": "Admin User",
        "role": "admin"
    }
    
    user = await UserService.create_user(user_data)
    return user


@pytest_asyncio.fixture
async def auth_headers(test_user) -> Dict[str, str]:
    from app.services.security_service import SecurityService
    
    user_id = str(test_user["_id"])
    access_token = SecurityService.create_access_token(data={"sub": user_id})
    
    return {"Authorization": f"Bearer {access_token}"}


@pytest_asyncio.fixture
async def admin_auth_headers(admin_user) -> Dict[str, str]:
    from app.services.security_service import SecurityService
    
    user_id = str(admin_user["_id"])
    access_token = SecurityService.create_access_token(data={"sub": user_id})
    
    return {"Authorization": f"Bearer {access_token}"}


@pytest_asyncio.fixture
async def registered_user(client: AsyncClient) -> Dict[str, Any]:
    register_payload = {
        "email": "newuser@example.com",
        "password": "NewUserPassword123!",
        "username": "newuser",
        "display_name": "New User"
    }
    
    response = await client.post("/api/v1/auth/register", json=register_payload)
    assert response.status_code == 200
    
    data = response.json()
    return {
        "user": data["data"]["user"],
        "token": data["data"]["token"],
        "refresh_token": response.cookies.get("refresh_token")
    }


@pytest.fixture
def get_cookie_from_response():
    def _get_cookie(response, name):
        for cookie in response.cookies.jar:
            if cookie.name == name:
                return cookie.value
        return None
    return _get_cookie


@pytest_asyncio.fixture
async def csrf_token(client: AsyncClient) -> str:
    import hmac
    import hashlib
    from datetime import datetime
    from app.core.config import settings
    
    timestamp = int(datetime.utcnow().timestamp())
    random_bytes = "0" * 16
    payload = f"{timestamp}:{random_bytes}"
    signature = hmac.new(
        settings.CSRF_SECRET.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    csrf_token_value = f"{payload}:{signature}"
    
    client.cookies.set("csrf_token", csrf_token_value)
    
    return csrf_token_value


@pytest_asyncio.fixture
async def csrf_headers(csrf_token: str) -> Dict[str, str]:
    return {"X-CSRF-Token": csrf_token}
