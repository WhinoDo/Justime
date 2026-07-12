from unittest.mock import Mock

import pytest

from app import database


class RecordingAggregateCursor:
    def __init__(self, results):
        self.results = results

    async def to_list(self, length):
        assert length == 1
        return self.results


class RecordingCollection:
    def __init__(self, name, aggregate_results=None):
        self.name = name
        self.created = []
        self.aggregate_results = aggregate_results
        self.aggregate_calls = []
        self.required_index_error = None

    def aggregate(self, pipeline):
        self.aggregate_calls.append(pipeline)
        results = self.aggregate_results
        if results is None:
            results = [{"summary": [], "samples": []}]
        return RecordingAggregateCursor(results)

    async def create_index(self, keys, **options):
        self.created.append((keys, options))
        if (
            options.get("name") == "uq_evidence_user_task_type_source_id"
            and self.required_index_error is not None
        ):
            raise self.required_index_error


class RecordingDatabase:
    def __init__(self, evidence_aggregate_results=None):
        self.collections = {
            "evidence": RecordingCollection(
                "evidence", aggregate_results=evidence_aggregate_results
            )
        }

    def __getattr__(self, name):
        return self.collections.setdefault(name, RecordingCollection(name))


def _required_evidence_indexes(recording_db):
    return [
        (keys, options)
        for keys, options in recording_db.collections["evidence"].created
        if options.get("name") == "uq_evidence_user_task_type_source_id"
    ]


@pytest.mark.asyncio
async def test_runtime_create_indexes_creates_password_reset_ttl(monkeypatch):
    recording_db = RecordingDatabase()
    monkeypatch.setattr(database.db, "db", recording_db)

    await database._create_indexes()

    assert recording_db.collections["password_reset_tokens"].created == [
        (
            [("expires_at", 1)],
            {
                "name": "idx_password_reset_tokens_expires_at_ttl",
                "expireAfterSeconds": 0,
            },
        )
    ]


@pytest.mark.asyncio
async def test_create_indexes_builds_exact_evidence_source_id_index(monkeypatch):
    recording_db = RecordingDatabase()
    monkeypatch.setattr(database.db, "db", recording_db)

    await database._create_indexes()

    evidence = recording_db.collections["evidence"]
    assert evidence.aggregate_calls == [
        [
            {"$match": {"source_id": {"$type": "string"}}},
            {
                "$group": {
                    "_id": {
                        "userId": "$userId",
                        "task_id": "$task_id",
                        "type": "$type",
                        "source_id": "$source_id",
                    },
                    "count": {"$sum": 1},
                }
            },
            {"$match": {"count": {"$gt": 1}}},
            {
                "$facet": {
                    "summary": [{"$count": "conflict_groups"}],
                    "samples": [{"$limit": 5}],
                }
            },
        ]
    ]
    assert _required_evidence_indexes(recording_db) == [
        (
            [("userId", 1), ("task_id", 1), ("type", 1), ("source_id", 1)],
            {
                "name": "uq_evidence_user_task_type_source_id",
                "unique": True,
                "partialFilterExpression": {"source_id": {"$type": "string"}},
            },
        )
    ]


@pytest.mark.asyncio
async def test_duplicate_preflight_fails_closed_before_required_index(monkeypatch):
    conflict_key = {
        "userId": "sensitive-tenant",
        "task_id": "sensitive-task",
        "type": "chat",
        "source_id": "sensitive-source",
    }
    recording_db = RecordingDatabase(
        evidence_aggregate_results=[
            {
                "summary": [{"conflict_groups": 2}],
                "samples": [{"_id": conflict_key, "count": 3}],
            }
        ]
    )
    warning = Mock()
    monkeypatch.setattr(database.db, "db", recording_db)
    monkeypatch.setattr(database.logger, "warning", warning)

    with pytest.raises(database.EvidenceSourceIdConflictError) as exc_info:
        await database._create_indexes()

    message = str(exc_info.value)
    assert "2 conflicting tenant-scoped group(s)" in message
    assert "count=3" in message
    assert "key_sha256=" in message
    assert all(value not in message for value in conflict_key.values())
    assert _required_evidence_indexes(recording_db) == []
    warning.assert_not_called()


@pytest.mark.asyncio
async def test_required_index_creation_failure_propagates(monkeypatch):
    recording_db = RecordingDatabase()
    recording_db.collections["evidence"].required_index_error = RuntimeError(
        "index creation failed"
    )
    warning = Mock()
    monkeypatch.setattr(database.db, "db", recording_db)
    monkeypatch.setattr(database.logger, "warning", warning)

    with pytest.raises(database.EvidenceSourceIdIndexError) as exc_info:
        await database._create_indexes()

    assert isinstance(exc_info.value.__cause__, RuntimeError)
    warning.assert_not_called()
