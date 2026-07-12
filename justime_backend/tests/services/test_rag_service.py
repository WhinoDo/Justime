import importlib.util
import sys
import types
from pathlib import Path

RAG_SERVICE_PATH = (
    Path(__file__).resolve().parents[2] / "app" / "services" / "rag_service.py"
)


def load_rag_module(*, enabled=True, provider=None, user_id="user-1"):
    app_module = types.ModuleType("app")
    app_module.__path__ = []
    services_module = types.ModuleType("app.services")
    services_module.__path__ = []
    core_module = types.ModuleType("app.core")
    core_module.__path__ = []

    paths_module = types.ModuleType("app.services.knowledge_paths")
    paths_module.DOCS_DIR = Path("/tmp/docs")
    paths_module.SUPPORTED_DOC_EXTENSIONS = [".md"]
    paths_module._ensure_directory = lambda path: path
    paths_module.get_user_docs_dir = lambda current_user: Path("/tmp/docs") / current_user
    paths_module.set_current_user_context = lambda value: None
    paths_module.clear_current_user_context = lambda: None
    paths_module.get_current_user_context = lambda: user_id

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
    return module


class ReadyProvider:
    async def ask(self, user_id, question):
        return {
            "answer": f"answer for {question}",
            "references": [{"fileName": "guide.md"}],
        }

    async def sync_all_sources(self, user_id, docs_dir):
        return "已同步 1 个文件到 NotebookLM"


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


def test_rebuild_results_are_structured_and_sanitize_provider_failure(caplog):
    ready_module = load_rag_module(enabled=True, provider=ReadyProvider())
    ready = ready_module.RAGService().rebuild_index(Path("/tmp/docs"))

    assert ready["success"] is True
    assert ready["status"] == "ready"
    assert ready.startswith("已同步")

    failing_module = load_rag_module(enabled=True, provider=FailingProvider())
    failed = failing_module.RAGService().rebuild_index(Path("/tmp/docs"))

    serialized = repr(failed) + caplog.text
    assert "secret-value" not in serialized
    assert "/private/docs" not in serialized
    assert failed["success"] is False
    assert failed["error_code"] == "PROVIDER_UNAVAILABLE"
    assert failed["retryable"] is True
