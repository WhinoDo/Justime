"""
后台 API Key 管理业务逻辑
"""

import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.core.normalizers import to_iso_datetime
from app.database import db
from app.models.admin_apikey import AdminApiKey, AdminApiKeyCreated, AdminApiKeyUpsertRequest
from app.services.encryption_service import encryption_service
from app.services.cache_service import CacheService


class AdminApiKeyBusiness:
    COLLECTION = "system_api_keys"

    @staticmethod
    def mask_api_key(api_key: str) -> str:
        if not api_key or len(api_key) <= 8:
            return "****" if api_key else ""
        return f"{api_key[:4]}****{api_key[-4:]}"

    @staticmethod
    def _safe_apikey(config: Dict[str, Any]) -> AdminApiKey:
        return AdminApiKey(
            id=str(config.get("id") or ""),
            name=str(config.get("name") or "系统 API Key"),
            has_api_key=bool(config.get("api_key")),
            updated_at=to_iso_datetime(config.get("updated_at")),
        )

    @staticmethod
    def _resolve_key_filter(key_id: str) -> Dict[str, Any]:
        return {"id": key_id}

    @staticmethod
    def _build_doc(
        payload: AdminApiKeyUpsertRequest,
        existing: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        existing = existing or {}
        now = datetime.utcnow()
        config_id = payload.id or existing.get("id")
        if not config_id:
            slug = re.sub(r"[^a-z0-9]+", "-", payload.name.strip().lower()).strip("-")
            config_id = f"key-{slug or 'default'}"

        encrypted_key = existing.get("api_key", "")
        if payload.api_key is not None:
            plain = payload.api_key.strip()
            encrypted_key = encryption_service.encrypt(plain) if plain else ""

        return {
            "id": config_id,
            "name": payload.name.strip(),
            "api_key": encrypted_key,
            "updated_at": now,
            "created_at": existing.get("created_at", now),
        }

    @staticmethod
    async def get_all_apikeys() -> List[AdminApiKey]:
        if db.db is None:
            return []
        docs = await db.db[AdminApiKeyBusiness.COLLECTION].find({}).sort(
            [("updated_at", -1), ("name", 1)]
        ).to_list(length=None)
        return [AdminApiKeyBusiness._safe_apikey(doc) for doc in docs]

    @staticmethod
    async def create_apikey(payload: AdminApiKeyUpsertRequest) -> Optional[AdminApiKeyCreated]:
        if db.db is None:
            return None
        doc = AdminApiKeyBusiness._build_doc(payload)
        if await db.db[AdminApiKeyBusiness.COLLECTION].find_one({"id": doc["id"]}):
            doc["id"] = f"{doc['id']}-{int(datetime.utcnow().timestamp())}"

        plain_key = payload.api_key.strip() if payload.api_key else ""
        await db.db[AdminApiKeyBusiness.COLLECTION].insert_one(doc)
        created = await db.db[AdminApiKeyBusiness.COLLECTION].find_one({"id": doc["id"]})
        if not created:
            return None
        # 使系统 LLM 配置缓存失效（因为 API Key 被引用）
        await CacheService.invalidate_system_llm_configs()
        return AdminApiKeyCreated(
            id=str(created.get("id") or ""),
            name=str(created.get("name") or "系统 API Key"),
            api_key=plain_key,
            updated_at=to_iso_datetime(created.get("updated_at")),
        )

    @staticmethod
    async def update_apikey(key_id: str, payload: AdminApiKeyUpsertRequest) -> Optional[AdminApiKey]:
        if db.db is None:
            return None
        key_filter = AdminApiKeyBusiness._resolve_key_filter(key_id)
        existing = await db.db[AdminApiKeyBusiness.COLLECTION].find_one(key_filter)
        if not existing:
            return None

        doc = AdminApiKeyBusiness._build_doc(payload, existing=existing)
        await db.db[AdminApiKeyBusiness.COLLECTION].update_one(
            {"_id": existing["_id"]},
            {"$set": doc},
        )
        updated = await db.db[AdminApiKeyBusiness.COLLECTION].find_one({"_id": existing["_id"]})
        if not updated:
            return None
        # 使系统 LLM 配置缓存失效（因为 API Key 被引用）
        await CacheService.invalidate_system_llm_configs()
        return AdminApiKeyBusiness._safe_apikey(updated)

    @staticmethod
    async def delete_apikey(key_id: str) -> bool:
        if db.db is None:
            return False
        result = await db.db[AdminApiKeyBusiness.COLLECTION].delete_one(
            AdminApiKeyBusiness._resolve_key_filter(key_id)
        )
        success = result.deleted_count > 0
        if success:
            # 使系统 LLM 配置缓存失效（因为 API Key 被引用）
            await CacheService.invalidate_system_llm_configs()
        return success


admin_apikey_business = AdminApiKeyBusiness()
