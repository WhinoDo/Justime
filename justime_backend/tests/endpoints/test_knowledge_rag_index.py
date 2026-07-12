import copy
from pathlib import Path
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException

from app.api.v1.endpoints import knowledge_outputs as knowledge_endpoints
from app.business.task_process_business import (
    INDEXING_INTERNAL_ERROR,
    KnowledgeOutputIndexConflict,
    TaskProcessBusiness,
)
from app.models.knowledge_output import VaultConfig
from app.services import rag_service as rag_service_module
from app.services.rag_service import PROVIDER_NOT_CONFIGURED, PROVIDER_UNAVAILABLE


class FakeKnowledgeCollection:
    def __init__(self, docs):
        self.docs = {doc["_id"]: copy.deepcopy(doc) for doc in docs}
        self.updates = []

    async def find_one(self, query):
        return self._find(query)

    async def find_one_and_update(self, query, update, return_document=None):
        doc = self._find(query, copy_result=False)
        if doc is None:
            return None
        doc.update(copy.deepcopy(update.get("$set", {})))
        self.updates.append(copy.deepcopy(doc))
        return copy.deepcopy(doc)

    def current(self, output_id):
        return copy.deepcopy(self.docs[ObjectId(output_id)])

    def _find(self, query, copy_result=True):
        for doc in self.docs.values():
            if all(doc.get(key) == value for key, value in query.items()):
                return copy.deepcopy(doc) if copy_result else doc
        return None


def output_doc(user_id="user-1", **overrides):
    doc = {
        "_id": ObjectId(),
        "task_id": "task-1",
        "userId": user_id,
        "title": "Knowledge",
        "format": "summary",
        "markdown": "published content",
        "vault_relative_path": "Knowledge.md",
        "obsidian_tags": [],
        "obsidian_links": [],
        "status": "draft",
        "source_evidence_ids": [],
        "absolute_path": None,
        "published_at": None,
        "word_count": 2,
        "version": 1,
        "previous_version_id": None,
        "version_history": [],
        "createdAt": None,
        "updatedAt": None,
    }
    doc.update(overrides)
    return doc


def build_business(monkeypatch, collection, vault_root, rag_result, *, publish_calls=None):
    business = TaskProcessBusiness()
    monkeypatch.setattr(business, "_knowledge_collection", lambda: collection)

    async def get_vault_config(user_id):
        return VaultConfig(vault_root_path=str(vault_root))

    async def publish(user_id, output):
        if publish_calls is not None:
            publish_calls.append((user_id, output.id))
        path = vault_root / output.vault_relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(output.markdown, encoding="utf-8")
        return str(path)

    monkeypatch.setattr(
        "app.business.task_process_business.markdown_export_service.get_vault_config",
        get_vault_config,
    )
    monkeypatch.setattr(
        "app.business.task_process_business.markdown_export_service.publish", publish
    )
    monkeypatch.setattr(
        "app.business.task_process_business.rag_service.index_published_output",
        rag_result,
    )
    return business


def ready_result(**kwargs):
    return {
        "success": True,
        "status": "ready",
        "retryable": False,
        "error_code": None,
    }


def test_legacy_serialization_uses_backward_compatible_indexing_defaults():
    serialized = TaskProcessBusiness()._serialize_knowledge_output(output_doc())

    assert serialized.indexing_status == "not_requested"
    assert serialized.indexing_error_code is None
    assert serialized.indexing_retryable is False
    assert serialized.indexed_at is None


@pytest.mark.asyncio
async def test_publish_commits_file_and_publication_before_ready_indexing(
    monkeypatch, tmp_path
):
    doc = output_doc()
    collection = FakeKnowledgeCollection([doc])
    observed = {}

    def rag_result(*, user_id, published_path):
        persisted = collection.current(str(doc["_id"]))
        observed.update(persisted)
        assert published_path.read_text(encoding="utf-8") == doc["markdown"]
        return ready_result()

    business = build_business(monkeypatch, collection, tmp_path, rag_result)
    result = await business.publish_knowledge_output("user-1", str(doc["_id"]))

    assert observed["status"] == "published"
    assert observed["absolute_path"] == str(tmp_path / "Knowledge.md")
    assert observed["published_at"] is not None
    assert observed["indexing_status"] == "pending"
    assert collection.updates[0]["status"] == "published"
    assert collection.updates[0].get("indexing_status", "not_requested") == "not_requested"
    assert collection.updates[1]["indexing_status"] == "pending"
    assert result.status == "published"
    assert result.indexing_status == "success"
    assert result.indexed_at is not None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("rag_result", "expected_status", "expected_code", "expected_retryable"),
    [
        (
            lambda **kwargs: {
                "success": False,
                "status": "degraded",
                "retryable": False,
                "error_code": PROVIDER_NOT_CONFIGURED,
            },
            "skipped",
            PROVIDER_NOT_CONFIGURED,
            False,
        ),
        (
            lambda **kwargs: {
                "success": False,
                "status": "unavailable",
                "retryable": True,
                "error_code": PROVIDER_UNAVAILABLE,
                "raw_error": "token=secret path=/private/vault",
            },
            "failed",
            PROVIDER_UNAVAILABLE,
            True,
        ),
    ],
)
async def test_publish_preserves_file_for_sanitized_degraded_outcomes(
    monkeypatch,
    tmp_path,
    rag_result,
    expected_status,
    expected_code,
    expected_retryable,
):
    doc = output_doc()
    collection = FakeKnowledgeCollection([doc])
    business = build_business(monkeypatch, collection, tmp_path, rag_result)

    result = await business.publish_knowledge_output("user-1", str(doc["_id"]))

    assert result.status == "published"
    assert result.indexing_status == expected_status
    assert result.indexing_error_code == expected_code
    assert result.indexing_retryable is expected_retryable
    assert result.indexed_at is None
    assert Path(result.absolute_path).read_text(encoding="utf-8") == doc["markdown"]
    assert "secret" not in repr(result)
    assert "/private/vault" not in repr(result)
    assert "raw_error" not in repr(result)


@pytest.mark.asyncio
async def test_unexpected_index_exception_is_sanitized_and_publication_survives(
    monkeypatch, tmp_path
):
    doc = output_doc()
    collection = FakeKnowledgeCollection([doc])

    def rag_result(**kwargs):
        raise RuntimeError("token=secret path=/private/vault")

    business = build_business(monkeypatch, collection, tmp_path, rag_result)
    result = await business.publish_knowledge_output("user-1", str(doc["_id"]))

    assert result.status == "published"
    assert result.indexing_status == "failed"
    assert result.indexing_error_code == INDEXING_INTERNAL_ERROR
    assert result.indexing_retryable is True
    assert Path(result.absolute_path).read_text(encoding="utf-8") == doc["markdown"]
    assert "secret" not in repr(result)
    assert "/private/vault" not in repr(result)


@pytest.mark.asyncio
async def test_retry_succeeds_without_republishing_or_rewriting_file(monkeypatch, tmp_path):
    published_path = tmp_path / "Knowledge.md"
    published_path.write_text("original file", encoding="utf-8")
    doc = output_doc(
        status="published",
        absolute_path=str(published_path),
        indexing_status="failed",
        indexing_error_code=PROVIDER_UNAVAILABLE,
        indexing_retryable=True,
    )
    collection = FakeKnowledgeCollection([doc])
    publish_calls = []
    business = build_business(
        monkeypatch, collection, tmp_path, ready_result, publish_calls=publish_calls
    )

    result = await business.reindex_knowledge_output("user-1", str(doc["_id"]))

    assert result.indexing_status == "success"
    assert result.indexed_at is not None
    assert publish_calls == []
    assert published_path.read_text(encoding="utf-8") == "original file"

    with pytest.raises(KnowledgeOutputIndexConflict):
        await business.reindex_knowledge_output("user-1", str(doc["_id"]))
    assert publish_calls == []
    assert published_path.read_text(encoding="utf-8") == "original file"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "state",
    [
        {"indexing_status": "skipped", "indexing_retryable": False},
        {"indexing_status": "failed", "indexing_retryable": False},
        {"indexing_status": "pending", "indexing_retryable": False},
        {"indexing_status": "success", "indexing_retryable": False},
        {"indexing_status": "not_requested", "indexing_retryable": False},
        {"status": "draft", "indexing_status": "failed", "indexing_retryable": True},
    ],
)
async def test_retry_rejects_disallowed_states_without_side_effects(
    monkeypatch, tmp_path, state
):
    published_path = tmp_path / "Knowledge.md"
    published_path.write_text("original file", encoding="utf-8")
    doc = output_doc(**{
        "status": "published",
        "absolute_path": str(published_path),
        "indexing_status": "failed",
        "indexing_retryable": True,
        **state,
    })
    collection = FakeKnowledgeCollection([doc])
    calls = []

    def rag_result(**kwargs):
        calls.append(kwargs)
        return ready_result()

    business = build_business(monkeypatch, collection, tmp_path, rag_result)

    with pytest.raises(KnowledgeOutputIndexConflict):
        await business.reindex_knowledge_output("user-1", str(doc["_id"]))
    assert calls == []
    assert collection.updates == []
    assert published_path.read_text(encoding="utf-8") == "original file"


@pytest.mark.asyncio
@pytest.mark.parametrize("invalid_path_kind", ["missing", "outside", "symlink"])
async def test_retry_rejects_invalid_persisted_paths_without_rag_call(
    monkeypatch, tmp_path, invalid_path_kind
):
    vault_root = tmp_path / "vault"
    vault_root.mkdir()
    outside = tmp_path / "outside.md"
    outside.write_text("outside", encoding="utf-8")
    if invalid_path_kind == "missing":
        published_path = vault_root / "missing.md"
    elif invalid_path_kind == "outside":
        published_path = outside
    else:
        published_path = vault_root / "linked.md"
        published_path.symlink_to(outside)
    doc = output_doc(
        status="published",
        absolute_path=str(published_path),
        indexing_status="failed",
        indexing_retryable=True,
    )
    collection = FakeKnowledgeCollection([doc])
    calls = []

    def rag_result(**kwargs):
        calls.append(kwargs)
        return ready_result()

    business = build_business(monkeypatch, collection, vault_root, rag_result)

    with pytest.raises(KnowledgeOutputIndexConflict):
        await business.reindex_knowledge_output("user-1", str(doc["_id"]))
    assert calls == []
    assert collection.updates == []


@pytest.mark.asyncio
@pytest.mark.parametrize("request_kind", ["missing", "unowned"])
async def test_retry_returns_not_found_without_side_effects(
    monkeypatch, tmp_path, request_kind
):
    published_path = tmp_path / "Knowledge.md"
    published_path.write_text("original file", encoding="utf-8")
    owned_doc = output_doc(
        status="published",
        absolute_path=str(published_path),
        indexing_status="failed",
        indexing_retryable=True,
    )
    collection = FakeKnowledgeCollection([owned_doc])
    rag_calls = []
    publish_calls = []

    def rag_result(**kwargs):
        rag_calls.append(kwargs)
        return ready_result()

    business = build_business(
        monkeypatch,
        collection,
        tmp_path,
        rag_result,
        publish_calls=publish_calls,
    )
    output_id = (
        str(ObjectId()) if request_kind == "missing" else str(owned_doc["_id"])
    )
    user_id = "user-1" if request_kind == "missing" else "user-2"

    result = await business.reindex_knowledge_output(user_id, output_id)

    assert result is None
    assert rag_calls == []
    assert publish_calls == []
    assert collection.updates == []
    assert published_path.read_text(encoding="utf-8") == "original file"


def test_unknown_provider_error_is_mapped_to_sanitized_internal_error():
    outcome = TaskProcessBusiness()._indexing_outcome({
        "success": False,
        "status": "unavailable",
        "retryable": False,
        "error_code": "PRIVATE_PROVIDER_ERROR",
        "raw_error": "token=secret path=/private/vault",
    })

    assert outcome == {
        "indexing_status": "failed",
        "indexing_error_code": INDEXING_INTERNAL_ERROR,
        "indexing_retryable": True,
        "indexed_at": None,
    }


class RecordingUploadProvider:
    def __init__(self, *, ready=True, raises=False):
        self.ready = ready
        self.raises = raises
        self.calls = []

    async def upload_source(self, user_id, published_path):
        self.calls.append(("upload", user_id, published_path))
        if self.raises:
            raise RuntimeError("token=secret path=/private/vault")
        return {"source_id": "source-1"}

    async def list_sources(self, user_id):
        self.calls.append(("list", user_id))
        return [{"source_id": "source-1", "is_ready": self.ready}]


def test_rag_service_indexes_exact_published_path_for_explicit_user(
    monkeypatch, tmp_path
):
    published_path = tmp_path / "Knowledge.md"
    published_path.write_text("published content", encoding="utf-8")
    provider = RecordingUploadProvider()
    monkeypatch.setattr(rag_service_module, "_notebooklm_available", True)
    monkeypatch.setattr(rag_service_module, "_notebooklm_service", provider)

    result = rag_service_module.RAGService().index_published_output(
        user_id="user-1",
        published_path=published_path,
    )

    assert result["success"] is True
    assert result["status"] == "ready"
    assert result["error_code"] is None
    assert provider.calls == [
        ("upload", "user-1", published_path.resolve()),
        ("list", "user-1"),
    ]


def test_rag_service_sanitizes_provider_failure(monkeypatch, tmp_path, caplog):
    published_path = tmp_path / "Knowledge.md"
    published_path.write_text("published content", encoding="utf-8")
    provider = RecordingUploadProvider(raises=True)
    monkeypatch.setattr(rag_service_module, "_notebooklm_available", True)
    monkeypatch.setattr(rag_service_module, "_notebooklm_service", provider)

    result = rag_service_module.RAGService().index_published_output(
        user_id="user-1",
        published_path=published_path,
    )

    serialized = repr(result) + caplog.text
    assert result["success"] is False
    assert result["status"] == "unavailable"
    assert result["retryable"] is True
    assert result["error_code"] == PROVIDER_UNAVAILABLE
    assert "secret" not in serialized
    assert "/private/vault" not in serialized


@pytest.mark.asyncio
async def test_reindex_endpoint_preserves_not_found_ownership_and_conflict_conventions(
    monkeypatch,
):
    class FakeBusiness:
        calls = []

        async def reindex_knowledge_output(self, user_id, output_id):
            self.calls.append((user_id, output_id))
            if output_id in {"missing", "unowned"}:
                return None
            if output_id == "conflict":
                raise KnowledgeOutputIndexConflict("当前知识产出不可重试索引")
            return SimpleNamespace(indexing_status="success")

    fake_business = FakeBusiness()
    monkeypatch.setattr(knowledge_endpoints, "_task_process_business", fake_business)

    with pytest.raises(HTTPException) as missing:
        await knowledge_endpoints.reindex_knowledge_output("missing", {"_id": "user-1"})
    assert missing.value.status_code == 404

    with pytest.raises(HTTPException) as unowned:
        await knowledge_endpoints.reindex_knowledge_output("unowned", {"_id": "user-2"})
    assert unowned.value.status_code == 404

    with pytest.raises(HTTPException) as conflict:
        await knowledge_endpoints.reindex_knowledge_output("conflict", {"_id": "user-1"})
    assert conflict.value.status_code == 409

    result = await knowledge_endpoints.reindex_knowledge_output("owned", {"_id": "user-1"})
    assert result["data"]["knowledge_output"].indexing_status == "success"
    assert fake_business.calls == [
        ("user-1", "missing"),
        ("user-2", "unowned"),
        ("user-1", "conflict"),
        ("user-1", "owned"),
    ]
