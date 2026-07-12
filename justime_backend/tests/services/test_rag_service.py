import asyncio
import importlib.util
import sys
import threading
import types
from pathlib import Path

RAG_SERVICE_PATH = (
    Path(__file__).resolve().parents[2] / "app" / "services" / "rag_service.py"
)


def load_rag_module(
    *,
    enabled=True,
    provider=None,
    user_id="user-1",
    docs_root=Path("/tmp/docs"),
):
    app_module = types.ModuleType("app")
    app_module.__path__ = []
    services_module = types.ModuleType("app.services")
    services_module.__path__ = []
    core_module = types.ModuleType("app.core")
    core_module.__path__ = []

    paths_module = types.ModuleType("app.services.knowledge_paths")
    paths_module.DOCS_DIR = docs_root
    paths_module.SUPPORTED_DOC_EXTENSIONS = [".md"]
    paths_module._ensure_directory = lambda path: path
    paths_module.get_user_docs_dir = lambda current_user: docs_root / current_user
    context = threading.local()
    context.user_id = user_id
    paths_module.set_current_user_context = lambda value: setattr(
        context, "user_id", value
    )
    paths_module.clear_current_user_context = lambda: setattr(context, "user_id", None)
    paths_module.get_current_user_context = lambda: getattr(context, "user_id", None)

    config_module = types.ModuleType("app.core.config")
    config_module.settings = types.SimpleNamespace(NOTEBOOKLM_ENABLED=enabled)

    sys.modules["app"] = app_module
    sys.modules["app.services"] = services_module
    sys.modules["app.core"] = core_module
    sys.modules["app.services.knowledge_paths"] = paths_module
    sys.modules["app.core.config"] = config_module

    notebooklm_module_name = "app.services.notebooklm_service"
    if provider is None:
        sys.modules.pop(notebooklm_module_name, None)
    else:
        notebooklm_module = types.ModuleType(notebooklm_module_name)
        notebooklm_module.notebooklm_service = provider
        sys.modules[notebooklm_module_name] = notebooklm_module

    module_name = f"rag_service_under_test_{enabled}_{id(provider)}_{user_id}"
    spec = importlib.util.spec_from_file_location(module_name, RAG_SERVICE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    module.test_paths = paths_module
    return module


class ReadyProvider:
    async def ask(self, user_id, question):
        return {
            "answer": f"answer for {question}",
            "references": [{"fileName": "guide.md"}],
        }

    async def sync_all_sources(self, user_id, docs_dir):
        return "已同步 1 个文件到 NotebookLM"

    async def list_sources(self, user_id):
        return [{"source_id": "source-1", "is_ready": True}]


class FailingProvider:
    async def ask(self, user_id, question):
        raise RuntimeError("token=secret-value host=internal.example")

    async def sync_all_sources(self, user_id, docs_dir):
        raise RuntimeError("token=secret-value path=/private/docs")


class LegacyErrorProvider:
    async def ask(self, user_id, question):
        return {
            "answer": "NotebookLM 查询出错: token=secret-value",
            "references": [],
        }


class RecordingSyncProvider:
    def __init__(self, synced_count, *, ready_count=None, all_ready=True):
        self.synced_count = synced_count
        self.ready_count = synced_count if ready_count is None else ready_count
        self.all_ready = all_ready
        self.calls = []

    async def sync_all_sources(self, user_id, docs_dir):
        self.calls.append((user_id, docs_dir))
        return f"已同步 {self.synced_count} 个文件到 NotebookLM"

    async def list_sources(self, user_id):
        return [
            {"source_id": f"source-{index}", "is_ready": self.all_ready}
            for index in range(self.ready_count)
        ]


class MalformedSyncProvider:
    async def sync_all_sources(self, user_id, docs_dir):
        return {"synced": 1}

    async def list_sources(self, user_id):
        return [{"source_id": "source-1", "is_ready": True}]


def assert_state(result, expected):
    assert {
        "mode": result["mode"],
        "provider": result["provider"],
        "status": result["status"],
        "retryable": result["retryable"],
        "error_code": result["error_code"],
    } == expected


def test_unconfigured_provider_returns_non_retryable_degraded_state():
    module = load_rag_module(enabled=False, provider=ReadyProvider())

    result = module.RAGService().query_with_references("question")

    assert result["answer"]
    assert result["references"] == []
    assert_state(result, {
        "mode": "unavailable",
        "provider": "none",
        "status": "degraded",
        "retryable": False,
        "error_code": "PROVIDER_NOT_CONFIGURED",
    })


def test_provider_import_failure_returns_non_retryable_degraded_state():
    module = load_rag_module(enabled=True, provider=None)

    result = module.RAGService().query_with_references("question")

    assert result["references"] == []
    assert_state(result, {
        "mode": "unavailable",
        "provider": "none",
        "status": "degraded",
        "retryable": False,
        "error_code": "PROVIDER_NOT_CONFIGURED",
    })


def test_missing_user_context_returns_non_retryable_error():
    module = load_rag_module(enabled=True, provider=ReadyProvider(), user_id=None)

    result = module.RAGService().query_with_references("question")

    assert result["references"] == []
    assert_state(result, {
        "mode": "cloud",
        "provider": "notebooklm",
        "status": "error",
        "retryable": False,
        "error_code": "USER_CONTEXT_REQUIRED",
    })


def test_transient_query_failure_is_retryable_and_sanitized(caplog):
    module = load_rag_module(enabled=True, provider=FailingProvider())

    result = module.RAGService().query_with_references("question")

    serialized = repr(result) + caplog.text
    assert "secret-value" not in serialized
    assert "internal.example" not in serialized
    assert result["references"] == []
    assert_state(result, {
        "mode": "cloud",
        "provider": "notebooklm",
        "status": "unavailable",
        "retryable": True,
        "error_code": "PROVIDER_UNAVAILABLE",
    })


def test_legacy_provider_error_payload_is_sanitized():
    module = load_rag_module(enabled=True, provider=LegacyErrorProvider())

    result = module.RAGService().query_with_references("question")

    assert "secret-value" not in repr(result)
    assert result["references"] == []
    assert result["error_code"] == "PROVIDER_UNAVAILABLE"
    assert result["retryable"] is True


def test_ready_provider_preserves_answer_and_references():
    module = load_rag_module(enabled=True, provider=ReadyProvider())

    result = module.RAGService().query_with_references("question")

    assert result["answer"] == "answer for question"
    assert result["references"] == [{"fileName": "guide.md"}]
    assert_state(result, {
        "mode": "cloud",
        "provider": "notebooklm",
        "status": "ready",
        "retryable": False,
        "error_code": None,
    })


def test_rebuild_results_are_structured_and_sanitize_provider_failure(
    tmp_path, caplog
):
    user_docs_dir = tmp_path / "user-1"
    user_docs_dir.mkdir()
    (user_docs_dir / "guide.md").write_text("guide")

    ready_module = load_rag_module(
        enabled=True,
        provider=ReadyProvider(),
        docs_root=tmp_path,
    )
    ready = ready_module.RAGService().rebuild_index(user_docs_dir)

    assert ready["success"] is True
    assert ready["status"] == "ready"
    assert ready.startswith("已同步")

    failing_module = load_rag_module(
        enabled=True,
        provider=FailingProvider(),
        docs_root=tmp_path,
    )
    failed = failing_module.RAGService().rebuild_index(user_docs_dir)

    serialized = repr(failed) + caplog.text
    assert "secret-value" not in serialized
    assert "/private/docs" not in serialized
    assert failed["success"] is False
    assert failed["error_code"] == "PROVIDER_UNAVAILABLE"
    assert failed["retryable"] is True


def test_rebuild_recovers_validated_user_context_across_executor(tmp_path):
    user_docs_dir = tmp_path / "user-1"
    user_docs_dir.mkdir()
    (user_docs_dir / "guide.md").write_text("guide")
    provider = RecordingSyncProvider(synced_count=1)
    module = load_rag_module(
        enabled=True,
        provider=provider,
        docs_root=tmp_path,
    )
    module.test_paths.set_current_user_context("user-1")

    async def execute_rebuild():
        loop = asyncio.get_running_loop()
        worker_context = await loop.run_in_executor(
            None, module.get_current_user_context
        )
        result = await loop.run_in_executor(
            None,
            module.RAGService().rebuild_index,
            user_docs_dir,
            False,
        )
        return worker_context, result

    worker_context, result = asyncio.run(execute_rebuild())

    assert worker_context is None
    assert result["success"] is True
    assert result["status"] == "ready"
    assert provider.calls == [("user-1", user_docs_dir.resolve())]


def test_rebuild_rejects_unvalidated_docs_path_as_user_context(tmp_path):
    nested_docs_dir = tmp_path / "nested" / "user-1"
    nested_docs_dir.mkdir(parents=True)
    provider = RecordingSyncProvider(synced_count=0)
    module = load_rag_module(
        enabled=True,
        provider=provider,
        user_id=None,
        docs_root=tmp_path,
    )

    result = module.RAGService().rebuild_index(nested_docs_dir)

    assert result["success"] is False
    assert result["error_code"] == "USER_CONTEXT_REQUIRED"
    assert provider.calls == []


def test_rebuild_rejects_user_directory_symlink_outside_docs_root(tmp_path):
    docs_root = tmp_path / "docs"
    docs_root.mkdir()
    outside_dir = tmp_path / "outside"
    outside_dir.mkdir()
    (docs_root / "user-1").symlink_to(outside_dir, target_is_directory=True)
    provider = RecordingSyncProvider(synced_count=0)
    module = load_rag_module(
        enabled=True,
        provider=provider,
        docs_root=docs_root,
    )

    result = module.RAGService().rebuild_index(docs_root / "user-1")

    assert result["success"] is False
    assert result["error_code"] == "USER_CONTEXT_REQUIRED"
    assert provider.calls == []


def test_partial_provider_sync_cannot_claim_ready(tmp_path):
    user_docs_dir = tmp_path / "user-1"
    user_docs_dir.mkdir()
    (user_docs_dir / "first.md").write_text("first")
    (user_docs_dir / "second.md").write_text("second")
    (user_docs_dir / ".ignored").write_text("ignored")
    provider = RecordingSyncProvider(synced_count=1)
    module = load_rag_module(
        enabled=True,
        provider=provider,
        docs_root=tmp_path,
    )

    result = module.RAGService().rebuild_index(user_docs_dir)

    assert result["success"] is False
    assert result["status"] == "unavailable"
    assert result["retryable"] is True
    assert result["error_code"] == "PROVIDER_UNAVAILABLE"


def test_not_ready_provider_source_cannot_claim_ready(tmp_path):
    user_docs_dir = tmp_path / "user-1"
    user_docs_dir.mkdir()
    (user_docs_dir / "guide.md").write_text("guide")
    provider = RecordingSyncProvider(synced_count=1, all_ready=False)
    module = load_rag_module(
        enabled=True,
        provider=provider,
        docs_root=tmp_path,
    )

    result = module.RAGService().rebuild_index(user_docs_dir)

    assert result["success"] is False
    assert result["status"] == "unavailable"
    assert result["retryable"] is True
    assert result["error_code"] == "PROVIDER_UNAVAILABLE"


def test_malformed_provider_sync_result_cannot_claim_ready(tmp_path):
    user_docs_dir = tmp_path / "user-1"
    user_docs_dir.mkdir()
    (user_docs_dir / "guide.md").write_text("guide")
    module = load_rag_module(
        enabled=True,
        provider=MalformedSyncProvider(),
        docs_root=tmp_path,
    )

    result = module.RAGService().rebuild_index(user_docs_dir)

    assert result["success"] is False
    assert result["status"] == "unavailable"
    assert result["error_code"] == "PROVIDER_UNAVAILABLE"
