import importlib.util
import sys
import types
from pathlib import Path

import pytest


KNOWLEDGE_ENDPOINT_PATH = (
    Path(__file__).resolve().parents[2]
    / "app"
    / "api"
    / "v1"
    / "endpoints"
    / "knowledge.py"
)
API_PATH = Path(__file__).resolve().parents[2] / "app" / "api" / "v1" / "api.py"


class FakeRouter:
    def __init__(self):
        self.includes = []

    def get(self, *args, **kwargs):
        return lambda fn: fn

    def post(self, *args, **kwargs):
        return lambda fn: fn

    def delete(self, *args, **kwargs):
        return lambda fn: fn

    def include_router(self, router, prefix="", tags=None):
        self.includes.append((router, prefix, tags))


def state(
    mode="unavailable",
    provider="none",
    status="degraded",
    retryable=False,
    error_code="PROVIDER_NOT_CONFIGURED",
):
    return {
        "mode": mode,
        "provider": provider,
        "status": status,
        "retryable": retryable,
        "error_code": error_code,
    }


class FakeTaskService:
    def __init__(self, task_state=None):
        self.task_state = task_state
        self.started = False

    async def start_rebuild_task(self, user_id, docs_dir):
        self.started = True
        return "task-1"

    async def get_task_status(self, task_id):
        return self.task_state


def install_common_modules(rag, task_service):
    fastapi = types.ModuleType("fastapi")
    fastapi.APIRouter = FakeRouter
    fastapi.UploadFile = object
    fastapi.File = lambda *args, **kwargs: None
    fastapi.Form = lambda *args, **kwargs: None
    fastapi.Query = lambda default=None, **kwargs: default
    fastapi.HTTPException = RuntimeError
    fastapi.status = types.SimpleNamespace(
        HTTP_400_BAD_REQUEST=400,
        HTTP_403_FORBIDDEN=403,
        HTTP_404_NOT_FOUND=404,
        HTTP_413_REQUEST_ENTITY_TOO_LARGE=413,
        HTTP_500_INTERNAL_SERVER_ERROR=500,
    )
    responses = types.ModuleType("fastapi.responses")
    responses.FileResponse = object

    pydantic = types.ModuleType("pydantic")
    pydantic.BaseModel = object
    pydantic.Field = lambda *args, **kwargs: None

    app = types.ModuleType("app")
    app.__path__ = []
    services = types.ModuleType("app.services")
    services.__path__ = []
    api = types.ModuleType("app.api")
    api.__path__ = []
    core = types.ModuleType("app.core")
    core.__path__ = []

    paths = types.ModuleType("app.services.knowledge_paths")
    paths.DOCS_DIR = Path("/tmp/docs")
    paths.get_user_docs_dir = lambda user_id: Path("/tmp/docs") / user_id

    deps = types.ModuleType("app.api.deps")
    deps.CurrentUser = dict

    uploads = types.ModuleType("app.services.upload_service")
    uploads.chunked_upload_manager = object()
    uploads.generate_upload_id = lambda *args: "upload-1"

    validators = types.ModuleType("app.core.validators")
    validators.InputValidator = object

    config = types.ModuleType("app.core.config")
    config.settings = types.SimpleNamespace(
        MAX_FILE_SIZE=100,
        CHUNKED_UPLOAD_THRESHOLD=50,
        CHUNK_SIZE=10,
    )

    rag_module = types.ModuleType("app.services.rag_service")
    rag_module.rag_service = rag

    tasks = types.ModuleType("app.services.knowledge_task_service")
    tasks.knowledge_task_service = task_service

    sys.modules.update({
        "fastapi": fastapi,
        "fastapi.responses": responses,
        "pydantic": pydantic,
        "app": app,
        "app.services": services,
        "app.api": api,
        "app.core": core,
        "app.services.knowledge_paths": paths,
        "app.api.deps": deps,
        "app.services.upload_service": uploads,
        "app.core.validators": validators,
        "app.core.config": config,
        "app.services.rag_service": rag_module,
        "app.services.knowledge_task_service": tasks,
    })


def load_knowledge_module(rag, task_service):
    install_common_modules(rag, task_service)
    spec = importlib.util.spec_from_file_location(
        f"knowledge_endpoint_under_test_{id(rag)}", KNOWLEDGE_ENDPOINT_PATH
    )
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


@pytest.mark.asyncio
async def test_unconfigured_provider_returns_structured_state_without_task():
    rag = types.SimpleNamespace(get_availability_state=lambda: state())
    task_service = FakeTaskService()
    module = load_knowledge_module(rag, task_service)

    result = await module.rebuild_index(current_user={"_id": "user-1"})

    assert task_service.started is False
    assert result["success"] is False
    assert result["task_id"] is None
    assert result["status"] == "unavailable"
    assert result["provider_status"] == "degraded"
    assert result["availability"] == state()
    assert result["error_code"] == "PROVIDER_NOT_CONFIGURED"


@pytest.mark.asyncio
async def test_configured_provider_preserves_mobile_queue_contract():
    configured = state(
        mode="cloud", provider="notebooklm", status="degraded", error_code=None
    )
    rag = types.SimpleNamespace(get_availability_state=lambda: configured)
    task_service = FakeTaskService()
    module = load_knowledge_module(rag, task_service)

    result = await module.rebuild_index(current_user={"_id": "user-1"})

    assert task_service.started is True
    assert result["success"] is True
    assert result["task_id"] == "task-1"
    assert result["status"] == "pending"
    assert result["task_status"] == "pending"
    assert result["provider_status"] == "degraded"
    assert result["availability"] == configured
    assert result["error_code"] is None
    assert "removed" not in repr(result)


@pytest.mark.asyncio
async def test_failed_task_status_is_retryable_and_does_not_leak_raw_error():
    configured = state(
        mode="cloud", provider="notebooklm", status="degraded", error_code=None
    )
    rag = types.SimpleNamespace(get_availability_state=lambda: configured)
    task_service = FakeTaskService({
        "task_id": "task-1",
        "user_id": "user-1",
        "status": "failed",
        "message": "token=secret-value",
        "error": "host=internal.example path=/private/docs",
        "created_at": 1,
        "started_at": 2,
        "completed_at": 3,
    })
    module = load_knowledge_module(rag, task_service)

    result = await module.get_rebuild_status(
        task_id="task-1", current_user={"_id": "user-1"}
    )

    assert result["success"] is True
    assert result["status"] == "failed"
    assert result["task_status"] == "failed"
    assert result["provider_status"] == "unavailable"
    assert result["availability"]["status"] == "unavailable"
    assert result["retryable"] is True
    assert result["error_code"] == "PROVIDER_UNAVAILABLE"
    assert result["error"] is None
    assert "secret-value" not in repr(result)
    assert "internal.example" not in repr(result)


@pytest.mark.asyncio
async def test_completed_task_status_is_the_only_successful_rebuild_state():
    configured = state(
        mode="cloud", provider="notebooklm", status="degraded", error_code=None
    )
    rag = types.SimpleNamespace(get_availability_state=lambda: configured)
    task_service = FakeTaskService({
        "task_id": "task-1",
        "user_id": "user-1",
        "status": "completed",
        "message": "provider result",
        "error": None,
        "created_at": 1,
        "started_at": 2,
        "completed_at": 3,
    })
    module = load_knowledge_module(rag, task_service)

    result = await module.get_rebuild_status(
        task_id="task-1", current_user={"_id": "user-1"}
    )

    assert result["success"] is True
    assert result["task_status"] == "completed"
    assert result["status"] == "completed"
    assert result["provider_status"] == "ready"
    assert result["availability"]["status"] == "ready"
    assert result["error_code"] is None


@pytest.mark.asyncio
@pytest.mark.parametrize("task_status", ["pending", "running"])
async def test_in_progress_poll_preserves_mobile_lifecycle_status(task_status):
    configured = state(
        mode="cloud", provider="notebooklm", status="degraded", error_code=None
    )
    rag = types.SimpleNamespace(get_availability_state=lambda: configured)
    task_service = FakeTaskService({
        "task_id": "task-1",
        "user_id": "user-1",
        "status": task_status,
        "message": "provider detail",
        "error": None,
        "created_at": 1,
        "started_at": 2 if task_status == "running" else None,
        "completed_at": None,
    })
    module = load_knowledge_module(rag, task_service)

    result = await module.get_rebuild_status(
        task_id="task-1", current_user={"_id": "user-1"}
    )

    assert result["success"] is True
    assert result["status"] == task_status
    assert result["task_status"] == task_status
    assert result["availability"] == configured


def test_api_registers_knowledge_router_unconditionally():
    fastapi = types.ModuleType("fastapi")
    fastapi.APIRouter = FakeRouter
    sys.modules["fastapi"] = fastapi

    endpoint_names = [
        "admin", "admin_apikeys", "agent", "auth", "book_analysis", "calendar",
        "documents", "evidence", "feishu_webhook", "health", "knowledge",
        "knowledge_outputs", "study", "task_process", "chat",
    ]
    endpoints = types.ModuleType("app.api.v1.endpoints")
    for name in endpoint_names:
        setattr(endpoints, name, types.SimpleNamespace(router=object()))

    app = types.ModuleType("app")
    app.__path__ = []
    app_api = types.ModuleType("app.api")
    app_api.__path__ = []
    app_api_v1 = types.ModuleType("app.api.v1")
    app_api_v1.__path__ = []
    sys.modules.update({
        "app": app,
        "app.api": app_api,
        "app.api.v1": app_api_v1,
        "app.api.v1.endpoints": endpoints,
    })

    spec = importlib.util.spec_from_file_location("api_under_test", API_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)

    prefixes = [prefix for _, prefix, _ in module.api_router.includes]
    assert "/knowledge" in prefixes
    assert module.knowledge_available is True
