"""
健康检查端点
"""

import asyncio
from typing import Dict, Literal, Optional

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.config import settings
from app.core.redis_client import RedisClient
from app.database import db

router = APIRouter()


SERVICE_NAME = "justime-backend"
PROBE_TIMEOUT_SECONDS = 2.0


class HealthResponse(BaseModel):
    status: str
    message: str
    service: str


class LivenessResponse(BaseModel):
    status: Literal["alive"]
    service: str


class DependencyHealth(BaseModel):
    required: bool
    status: Literal["available", "unavailable"]
    error_code: Optional[str] = None


class ReadinessResponse(BaseModel):
    status: Literal["ready", "degraded", "not_ready"]
    service: str
    dependencies: Dict[str, DependencyHealth]


def _initialization_error_code(
    request: Request,
    dependency: str,
    fallback: str,
) -> str:
    initialization = getattr(
        request.app.state,
        "dependency_initialization",
        {},
    )
    dependency_state = initialization.get(dependency, {})
    return dependency_state.get("error_code") or fallback


async def _probe_mongodb(request: Request) -> DependencyHealth:
    if db.client is None:
        return DependencyHealth(
            required=True,
            status="unavailable",
            error_code=_initialization_error_code(
                request,
                "mongodb",
                "MONGODB_NOT_INITIALIZED",
            ),
        )

    try:
        await asyncio.wait_for(
            db.client.admin.command("ping"),
            timeout=PROBE_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        return DependencyHealth(
            required=True,
            status="unavailable",
            error_code="MONGODB_TIMEOUT",
        )
    except Exception:
        return DependencyHealth(
            required=True,
            status="unavailable",
            error_code="MONGODB_UNAVAILABLE",
        )

    return DependencyHealth(required=True, status="available")


async def _probe_redis(request: Request) -> DependencyHealth:
    required = settings.REDIS_REQUIRED
    client = RedisClient.get_client()
    if client is None:
        return DependencyHealth(
            required=required,
            status="unavailable",
            error_code=_initialization_error_code(
                request,
                "redis",
                "REDIS_NOT_INITIALIZED",
            ),
        )

    try:
        await asyncio.wait_for(
            client.ping(),
            timeout=PROBE_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        return DependencyHealth(
            required=required,
            status="unavailable",
            error_code="REDIS_TIMEOUT",
        )
    except Exception:
        return DependencyHealth(
            required=required,
            status="unavailable",
            error_code="REDIS_UNAVAILABLE",
        )

    return DependencyHealth(required=required, status="available")


@router.get("/", response_model=HealthResponse)
async def health_check():
    """健康检查接口"""
    return HealthResponse(
        status="healthy",
        message="服务运行正常",
        service=SERVICE_NAME,
    )


@router.get("/live", response_model=LivenessResponse)
async def liveness_check() -> LivenessResponse:
    """Return process-only liveness without dependency calls."""
    return LivenessResponse(status="alive", service=SERVICE_NAME)


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    response_model_exclude_none=True,
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"model": ReadinessResponse}},
)
async def readiness_check(request: Request):
    """Probe configured dependencies and return a routing-safe readiness signal."""
    mongodb, redis = await asyncio.gather(
        _probe_mongodb(request),
        _probe_redis(request),
    )
    dependencies = {"mongodb": mongodb, "redis": redis}

    required_unavailable = any(
        dependency.required and dependency.status == "unavailable"
        for dependency in dependencies.values()
    )
    optional_unavailable = any(
        not dependency.required and dependency.status == "unavailable"
        for dependency in dependencies.values()
    )

    if required_unavailable:
        readiness_status = "not_ready"
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    elif optional_unavailable:
        readiness_status = "degraded"
        status_code = status.HTTP_200_OK
    else:
        readiness_status = "ready"
        status_code = status.HTTP_200_OK

    response = ReadinessResponse(
        status=readiness_status,
        service=SERVICE_NAME,
        dependencies=dependencies,
    )
    return JSONResponse(
        status_code=status_code,
        content=response.model_dump(exclude_none=True),
    )
