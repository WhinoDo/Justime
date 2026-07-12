import copy
from unittest.mock import AsyncMock, Mock

import pytest
from bson import ObjectId

from app.business.task_process_business import TaskProcessBusiness
from app.models.task_process import TaskProcessListQuery


pytestmark = pytest.mark.asyncio


class FakeTaskCursor:
    def __init__(self, docs):
        self.docs = copy.deepcopy(docs)
        self.sort_call = None
        self.skip_call = None
        self.limit_call = None
        self.to_list_call = None

    def sort(self, field, direction):
        self.sort_call = (field, direction)
        return self

    def skip(self, value):
        self.skip_call = value
        return self

    def limit(self, value):
        self.limit_call = value
        return self

    async def to_list(self, length):
        self.to_list_call = length
        return copy.deepcopy(self.docs)


class FakeTaskCollection:
    def __init__(self, docs, total):
        self.docs = copy.deepcopy(docs)
        self.total = total
        self.find_calls = []
        self.count_calls = []
        self.find_one_calls = []
        self.cursor = None

    def find(self, filters):
        self.find_calls.append(copy.deepcopy(filters))
        self.cursor = FakeTaskCursor(self.docs)
        return self.cursor

    async def count_documents(self, filters):
        self.count_calls.append(copy.deepcopy(filters))
        return self.total

    async def find_one(self, filters):
        self.find_one_calls.append(copy.deepcopy(filters))
        return copy.deepcopy(self.docs[0]) if self.docs else None


class FakeAggregateCursor:
    def __init__(self, rows):
        self.rows = copy.deepcopy(rows)
        self.to_list_calls = []

    async def to_list(self, length):
        self.to_list_calls.append(length)
        return copy.deepcopy(self.rows)


class FakeChildCollection:
    def __init__(self, aggregate_rows=None, count_result=0):
        self.aggregate_rows = aggregate_rows or []
        self.count_result = count_result
        self.aggregate_calls = []
        self.aggregate_cursors = []
        self.count_calls = []

    def aggregate(self, pipeline):
        self.aggregate_calls.append(copy.deepcopy(pipeline))
        cursor = FakeAggregateCursor(self.aggregate_rows)
        self.aggregate_cursors.append(cursor)
        return cursor

    async def count_documents(self, filters):
        self.count_calls.append(copy.deepcopy(filters))
        return self.count_result


def task_doc(title):
    return {
        "_id": ObjectId(),
        "userId": "user-1",
        "title": title,
        "goal": f"Goal for {title}",
    }


def build_business(monkeypatch, docs, total, evidence_rows=None, knowledge_rows=None):
    business = TaskProcessBusiness()
    tasks = FakeTaskCollection(docs, total)
    evidence = FakeChildCollection(evidence_rows)
    knowledge = FakeChildCollection(knowledge_rows)
    monkeypatch.setattr(business, "_task_collection", lambda: tasks)
    monkeypatch.setattr(business, "_evidence_collection", lambda: evidence)
    monkeypatch.setattr(business, "_knowledge_collection", lambda: knowledge)
    return business, tasks, evidence, knowledge


def expected_pipeline(task_ids):
    return [
        {"$match": {"task_id": {"$in": task_ids}}},
        {"$group": {"_id": "$task_id", "count": {"$sum": 1}}},
    ]


async def test_multi_task_page_uses_two_bounded_aggregations_and_preserves_page_contract(monkeypatch):
    docs = [task_doc("Third"), task_doc("Second"), task_doc("First")]
    task_ids = [str(doc["_id"]) for doc in docs]
    business, tasks, evidence, knowledge = build_business(
        monkeypatch,
        docs,
        total=8,
        evidence_rows=[{"_id": task_ids[0], "count": 3}, {"_id": task_ids[2], "count": 1}],
        knowledge_rows=[{"_id": task_ids[1], "count": 2}],
    )
    query = TaskProcessListQuery(
        status="active",
        phase="during",
        category="development",
        priority="high",
        search="bounded",
        sort_by="createdAt",
        sort_order="asc",
        page=2,
        page_size=3,
    )

    result = await business.list_task_processes("user-1", query)

    filters = {
        "userId": "user-1",
        "status": "active",
        "phase": "during",
        "category": "development",
        "priority": "high",
        "$or": [
            {"title": {"$regex": "bounded", "$options": "i"}},
            {"description": {"$regex": "bounded", "$options": "i"}},
            {"goal": {"$regex": "bounded", "$options": "i"}},
        ],
    }
    assert tasks.find_calls == [filters]
    assert tasks.count_calls == [filters]
    assert tasks.cursor.sort_call == ("createdAt", 1)
    assert tasks.cursor.skip_call == 3
    assert tasks.cursor.limit_call == 3
    assert tasks.cursor.to_list_call == 3
    assert evidence.aggregate_calls == [expected_pipeline(task_ids)]
    assert knowledge.aggregate_calls == [expected_pipeline(task_ids)]
    assert evidence.aggregate_cursors[0].to_list_calls == [None]
    assert knowledge.aggregate_cursors[0].to_list_calls == [None]
    assert evidence.count_calls == []
    assert knowledge.count_calls == []
    assert [item.id for item in result["items"]] == task_ids
    assert [item.title for item in result["items"]] == ["Third", "Second", "First"]
    assert [item.evidence_count for item in result["items"]] == [3, 0, 1]
    assert [item.knowledge_output_count for item in result["items"]] == [0, 2, 0]
    assert {key: result[key] for key in ("total", "page", "page_size", "total_pages")} == {
        "total": 8,
        "page": 2,
        "page_size": 3,
        "total_pages": 3,
    }


async def test_one_task_page_still_uses_exactly_two_bounded_aggregations(monkeypatch):
    docs = [task_doc("Only task")]
    task_id = str(docs[0]["_id"])
    business, _, evidence, knowledge = build_business(
        monkeypatch,
        docs,
        total=1,
        evidence_rows=[{"_id": task_id, "count": 4}],
        knowledge_rows=[{"_id": task_id, "count": 5}],
    )

    result = await business.list_task_processes(
        "user-1", TaskProcessListQuery(page=1, page_size=20)
    )

    assert evidence.aggregate_calls == [expected_pipeline([task_id])]
    assert knowledge.aggregate_calls == [expected_pipeline([task_id])]
    assert result["items"][0].evidence_count == 4
    assert result["items"][0].knowledge_output_count == 5
    assert result["total"] == 1
    assert result["total_pages"] == 1


async def test_empty_page_skips_child_aggregations_and_preserves_empty_pagination(monkeypatch):
    business, _, evidence, knowledge = build_business(monkeypatch, [], total=0)

    result = await business.list_task_processes(
        "user-1", TaskProcessListQuery(page=3, page_size=10)
    )

    assert evidence.aggregate_calls == []
    assert knowledge.aggregate_calls == []
    assert result == {
        "items": [],
        "total": 0,
        "page": 3,
        "page_size": 10,
        "total_pages": 0,
    }


async def test_single_task_get_retains_count_documents_semantics(monkeypatch):
    docs = [task_doc("Single item")]
    task_id = str(docs[0]["_id"])
    business, tasks, evidence, knowledge = build_business(monkeypatch, docs, total=1)
    evidence.count_result = 6
    knowledge.count_result = 7

    result = await business.get_task_process("user-1", task_id)

    assert tasks.find_one_calls == [{"_id": docs[0]["_id"], "userId": "user-1"}]
    assert evidence.count_calls == [{"task_id": task_id}]
    assert knowledge.count_calls == [{"task_id": task_id}]
    assert evidence.aggregate_calls == []
    assert knowledge.aggregate_calls == []
    assert result.evidence_count == 6
    assert result.knowledge_output_count == 7


async def test_list_does_not_enter_knowledge_publication_or_indexing_paths(monkeypatch):
    docs = [task_doc("Indexing invariant")]
    business, _, _, _ = build_business(monkeypatch, docs, total=1)
    publish = AsyncMock()
    get_vault_config = AsyncMock()
    rag_index = Mock()
    publish_output = AsyncMock()
    index_output = AsyncMock()
    reindex_output = AsyncMock()
    validate_path = AsyncMock()
    indexing_outcome = Mock()
    monkeypatch.setattr(
        "app.business.task_process_business.markdown_export_service.publish", publish
    )
    monkeypatch.setattr(
        "app.business.task_process_business.markdown_export_service.get_vault_config",
        get_vault_config,
    )
    monkeypatch.setattr(
        "app.business.task_process_business.rag_service.index_published_output", rag_index
    )
    monkeypatch.setattr(business, "publish_knowledge_output", publish_output)
    monkeypatch.setattr(business, "_index_published_output", index_output)
    monkeypatch.setattr(business, "reindex_knowledge_output", reindex_output)
    monkeypatch.setattr(business, "_validated_published_path", validate_path)
    monkeypatch.setattr(business, "_indexing_outcome", indexing_outcome)

    result = await business.list_task_processes("user-1", TaskProcessListQuery())
    serialized = business._serialize_knowledge_output(
        {
            "_id": ObjectId(),
            "task_id": str(docs[0]["_id"]),
            "userId": "user-1",
            "title": "Legacy output",
            "markdown": "Legacy content",
            "vault_relative_path": "Legacy.md",
        }
    )

    assert len(result["items"]) == 1
    assert serialized.indexing_status == "not_requested"
    assert serialized.indexing_error_code is None
    assert serialized.indexing_retryable is False
    assert serialized.indexed_at is None
    publish.assert_not_awaited()
    get_vault_config.assert_not_awaited()
    rag_index.assert_not_called()
    publish_output.assert_not_awaited()
    index_output.assert_not_awaited()
    reindex_output.assert_not_awaited()
    validate_path.assert_not_awaited()
    indexing_outcome.assert_not_called()
