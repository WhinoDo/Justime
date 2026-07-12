from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.v1.endpoints import health
from app.core.config import Settings, settings


@pytest_asyncio.fixture
async def client():
    app = FastAPI()
    app.state.dependency_initialization = {
        "mongodb": {"status": "pending", "error_code": None},
        "redis": {"status": "pending", "error_code": None},
    }
    app.include_router(health.router, prefix="/api/v1/health")

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as test_client:
        yield test_client


@pytest.mark.asyncio
async def test_live_is_process_only(client: AsyncClient):
    with (
        patch.object(health, "_probe_mongodb", new_callable=AsyncMock) as mongo_probe,
        patch.object(health, "_probe_redis", new_callable=AsyncMock) as redis_probe,
    ):
        response = await client.get("/api/v1/health/live")

    assert response.status_code == 200
    assert response.json() == {
        "status": "alive",
        "service": "justime-backend",
    }
    mongo_probe.assert_not_awaited()
    redis_probe.assert_not_awaited()


@pytest.mark.asyncio
async def test_ready_when_all_dependencies_are_available(client: AsyncClient):
    with (
        patch.object(
            health,
            "_probe_mongodb",
            AsyncMock(
                return_value=health.DependencyHealth(
                    required=True,
                    status="available",
                )
            ),
        ),
        patch.object(
            health,
            "_probe_redis",
            AsyncMock(
                return_value=health.DependencyHealth(
                    required=True,
                    status="available",
                )
            ),
        ),
    ):
        response = await client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "service": "justime-backend",
        "dependencies": {
            "mongodb": {"required": True, "status": "available"},
            "redis": {"required": True, "status": "available"},
        },
    }


@pytest.mark.asyncio
async def test_mongodb_failure_is_not_ready_but_live_stays_alive(
    client: AsyncClient,
):
    with (
        patch.object(
            health,
            "_probe_mongodb",
            AsyncMock(
                return_value=health.DependencyHealth(
                    required=True,
                    status="unavailable",
                    error_code="MONGODB_UNAVAILABLE",
                )
            ),
        ),
        patch.object(
            health,
            "_probe_redis",
            AsyncMock(
                return_value=health.DependencyHealth(
                    required=False,
                    status="available",
                )
            ),
        ),
    ):
        live_response = await client.get("/api/v1/health/live")
        ready_response = await client.get("/api/v1/health/ready")

    assert live_response.status_code == 200
    assert ready_response.status_code == 503
    body = ready_response.json()
    assert body["status"] == "not_ready"
    assert body["dependencies"]["mongodb"] == {
        "required": True,
        "status": "unavailable",
        "error_code": "MONGODB_UNAVAILABLE",
    }


@pytest.mark.asyncio
async def test_required_redis_failure_is_not_ready(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(settings, "REDIS_REQUIRED", True)
    with (
        patch.object(
            health,
            "_probe_mongodb",
            AsyncMock(
                return_value=health.DependencyHealth(
                    required=True,
                    status="available",
                )
            ),
        ),
        patch.object(
            health.RedisClient,
            "get_client",
            return_value=None,
        ),
    ):
        response = await client.get("/api/v1/health/ready")

    assert response.status_code == 503
    assert response.json()["dependencies"]["redis"] == {
        "required": True,
        "status": "unavailable",
        "error_code": "REDIS_NOT_INITIALIZED",
    }


@pytest.mark.asyncio
async def test_optional_redis_failure_is_degraded(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(settings, "REDIS_REQUIRED", False)
    with (
        patch.object(
            health,
            "_probe_mongodb",
            AsyncMock(
                return_value=health.DependencyHealth(
                    required=True,
                    status="available",
                )
            ),
        ),
        patch.object(
            health.RedisClient,
            "get_client",
            return_value=None,
        ),
    ):
        response = await client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json()["status"] == "degraded"
    assert response.json()["dependencies"]["redis"] == {
        "required": False,
        "status": "unavailable",
        "error_code": "REDIS_NOT_INITIALIZED",
    }


@pytest.mark.asyncio
async def test_probe_errors_are_sanitized(client: AsyncClient):
    secret_error = "redis://admin:password@private-host:6379 traceback secret"
    redis_client = AsyncMock()
    redis_client.ping.side_effect = RuntimeError(secret_error)

    with (
        patch.object(
            health,
            "_probe_mongodb",
            AsyncMock(
                return_value=health.DependencyHealth(
                    required=True,
                    status="available",
                )
            ),
        ),
        patch.object(
            health.RedisClient,
            "get_client",
            return_value=redis_client,
        ),
    ):
        response = await client.get("/api/v1/health/ready")

    serialized = response.text
    assert response.json()["dependencies"]["redis"]["error_code"] == "REDIS_UNAVAILABLE"
    assert secret_error not in serialized
    assert "password" not in serialized
    assert "traceback" not in serialized


def test_redis_required_defaults_to_false():
    assert Settings.model_fields["REDIS_REQUIRED"].default is False
