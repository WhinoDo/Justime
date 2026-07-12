import asyncio
from copy import deepcopy
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException
from pydantic import ValidationError

from app.business.auth_business import AuthBusiness
from app.core.config import Settings, settings
from app.database import db
from app.services.cache_service import CacheService
from app.services.email_service import email_service
from app.services.user_service import UserService


def test_password_reset_ttl_setting_is_bounded(monkeypatch):
    monkeypatch.delenv("PASSWORD_RESET_TTL_MINUTES", raising=False)

    assert Settings(_env_file=None).PASSWORD_RESET_TTL_MINUTES == 15
    for invalid_value in (0, 1441):
        with pytest.raises(ValidationError):
            Settings(
                _env_file=None,
                PASSWORD_RESET_TTL_MINUTES=invalid_value,
            )


class InMemoryCollection:
    def __init__(self, documents=None):
        self.documents = [deepcopy(document) for document in (documents or [])]
        self._lock = asyncio.Lock()

    async def delete_many(self, query):
        async with self._lock:
            original_count = len(self.documents)
            self.documents = [document for document in self.documents if not self._matches(document, query)]
            return SimpleNamespace(deleted_count=original_count - len(self.documents))

    async def delete_one(self, query):
        async with self._lock:
            for index, document in enumerate(self.documents):
                if self._matches(document, query):
                    del self.documents[index]
                    return SimpleNamespace(deleted_count=1)
            return SimpleNamespace(deleted_count=0)

    async def insert_one(self, document):
        async with self._lock:
            stored = deepcopy(document)
            stored.setdefault("_id", ObjectId())
            self.documents.append(stored)
            return SimpleNamespace(inserted_id=stored["_id"])

    async def find_one_and_update(self, query, update, return_document=None):
        async with self._lock:
            for document in self.documents:
                if self._matches(document, query):
                    document.update(deepcopy(update.get("$set", {})))
                    return deepcopy(document)
            return None

    async def update_one(self, query, update):
        async with self._lock:
            for document in self.documents:
                if self._matches(document, query):
                    document.update(deepcopy(update.get("$set", {})))
                    return SimpleNamespace(matched_count=1, modified_count=1)
            return SimpleNamespace(matched_count=0, modified_count=0)

    @staticmethod
    def _matches(document, query):
        for key, expected in query.items():
            actual = document.get(key)
            if isinstance(expected, dict) and "$gt" in expected:
                if actual is None or actual <= expected["$gt"]:
                    return False
            elif actual != expected:
                return False
        return True


@pytest.fixture
def password_reset_db(monkeypatch):
    user_id = ObjectId("507f1f77bcf86cd799439011")
    fake_db = SimpleNamespace(
        password_reset_tokens=InMemoryCollection(),
        users=InMemoryCollection([{"_id": user_id, "hashed_password": "old-hash"}]),
    )
    monkeypatch.setattr(db, "db", fake_db)
    return fake_db, user_id


@pytest.mark.asyncio
async def test_configured_ttl_drives_stored_expiry_and_email_copy(
    monkeypatch,
    password_reset_db,
):
    fake_db, user_id = password_reset_db
    captured = {}

    async def get_user_by_email(email):
        return {"_id": user_id, "email": email, "displayName": "Test User"}

    async def send_email(email, token, user_name, ttl_minutes):
        captured.update(
            email=email,
            token=token,
            user_name=user_name,
            ttl_minutes=ttl_minutes,
        )
        return True

    monkeypatch.setattr(settings, "PASSWORD_RESET_TTL_MINUTES", 37)
    monkeypatch.setattr(UserService, "get_user_by_email", get_user_by_email)
    monkeypatch.setattr(email_service, "send_password_reset_email", send_email)

    before = datetime.utcnow()
    response = await AuthBusiness.forgot_password("test@example.com")
    after = datetime.utcnow()

    assert response.success is True
    assert captured["ttl_minutes"] == 37
    assert captured["token"] == fake_db.password_reset_tokens.documents[0]["token"]
    expires_at = fake_db.password_reset_tokens.documents[0]["expires_at"]
    assert before + timedelta(minutes=37) <= expires_at <= after + timedelta(minutes=37)


@pytest.mark.asyncio
async def test_delivery_failure_removes_undelivered_token_but_keeps_generic_response(
    monkeypatch,
    password_reset_db,
):
    fake_db, user_id = password_reset_db

    async def get_user_by_email(email):
        return {"_id": user_id, "email": email}

    async def fail_delivery(*args, **kwargs):
        return False

    monkeypatch.setattr(UserService, "get_user_by_email", get_user_by_email)
    monkeypatch.setattr(email_service, "send_password_reset_email", fail_delivery)

    response = await AuthBusiness.forgot_password("test@example.com")

    assert response.success is True
    assert response.message == "如果该邮箱已注册，您将收到密码重置邮件"
    assert fake_db.password_reset_tokens.documents == []


@pytest.mark.asyncio
async def test_expired_and_reused_tokens_are_rejected(monkeypatch, password_reset_db):
    fake_db, user_id = password_reset_db
    fake_db.password_reset_tokens.documents.extend(
        [
            {
                "_id": ObjectId(),
                "user_id": str(user_id),
                "token": "expired-token",
                "expires_at": datetime.utcnow() - timedelta(seconds=1),
                "used": False,
            },
            {
                "_id": ObjectId(),
                "user_id": str(user_id),
                "token": "used-token",
                "expires_at": datetime.utcnow() + timedelta(minutes=15),
                "used": True,
            },
        ]
    )

    async def get_password_hash(password):
        return f"hash:{password}"

    monkeypatch.setattr(UserService, "get_password_hash", get_password_hash)

    for token in ("expired-token", "used-token"):
        with pytest.raises(HTTPException) as exc_info:
            await AuthBusiness.reset_password(token, "NewPassword123!")
        assert exc_info.value.status_code == 400

    assert fake_db.users.documents[0]["hashed_password"] == "old-hash"


@pytest.mark.asyncio
async def test_concurrent_resets_claim_token_once(monkeypatch, password_reset_db):
    fake_db, user_id = password_reset_db
    fake_db.password_reset_tokens.documents.append(
        {
            "_id": ObjectId(),
            "user_id": str(user_id),
            "token": "single-use-token",
            "expires_at": datetime.utcnow() + timedelta(minutes=15),
            "used": False,
        }
    )
    password_updates = []

    async def get_password_hash(password):
        await asyncio.sleep(0)
        return f"hash:{password}"

    original_update_one = fake_db.users.update_one

    async def record_password_update(query, update):
        password_updates.append(update["$set"]["hashed_password"])
        return await original_update_one(query, update)

    async def invalidate_user_data(user_id):
        return None

    monkeypatch.setattr(UserService, "get_password_hash", get_password_hash)
    monkeypatch.setattr(fake_db.users, "update_one", record_password_update)
    monkeypatch.setattr(CacheService, "invalidate_user_data", invalidate_user_data)

    results = await asyncio.gather(
        AuthBusiness.reset_password("single-use-token", "FirstPassword123!"),
        AuthBusiness.reset_password("single-use-token", "SecondPassword123!"),
        return_exceptions=True,
    )

    successes = [result for result in results if not isinstance(result, Exception)]
    failures = [result for result in results if isinstance(result, HTTPException)]
    assert len(successes) == 1
    assert len(failures) == 1
    assert failures[0].status_code == 400
    assert len(password_updates) == 1
    assert fake_db.password_reset_tokens.documents[0]["used"] is True
