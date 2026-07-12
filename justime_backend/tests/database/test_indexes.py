import pytest

from app import database


class RecordingCollection:
    def __init__(self, name):
        self.name = name
        self.created = []

    async def create_index(self, keys, **options):
        self.created.append((keys, options))


class RecordingDatabase:
    def __init__(self):
        self.collections = {}

    def __getattr__(self, name):
        return self.collections.setdefault(name, RecordingCollection(name))


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
