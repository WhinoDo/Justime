"""
管理后台业务逻辑
"""

import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from bson import ObjectId
from app.services.user_service import UserService
from app.services.encryption_service import encryption_service
from app.database import db
from app.models.admin import AdminModel, AdminModelUpsertRequest, AdminUser, SystemStats

class AdminBusiness:
    _ALLOWED_CAPABILITIES = {"fast", "reasoning", "classifier", "tool_call"}

    @staticmethod
    def _to_iso(value: Any) -> str:
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, str) and value:
            return value
        return datetime.utcnow().isoformat()

    @staticmethod
    def _normalize_capabilities(raw: Any) -> List[str]:
        if not isinstance(raw, list):
            return []
        values: List[str] = []
        for item in raw:
            if not isinstance(item, str):
                continue
            normalized = item.strip().lower()
            if normalized in AdminBusiness._ALLOWED_CAPABILITIES and normalized not in values:
                values.append(normalized)
        return values

    @staticmethod
    def _safe_model(config: Dict[str, Any]) -> AdminModel:
        api_key_id = str(config.get("api_key_id") or "").strip()
        return AdminModel(
            id=str(config.get("id") or ""),
            name=str(config.get("name") or "系统模型"),
            model_id=str(config.get("model_id") or ""),
            base_url=str(config.get("base_url") or ""),
            temperature=float(config.get("temperature", 0.7) or 0.7),
            capabilities=AdminBusiness._normalize_capabilities(config.get("capabilities")),
            priority=int(config.get("priority", 100) or 100),
            enabled=bool(config.get("enabled", True)),
            has_api_key=bool(config.get("api_key") or api_key_id),
            api_key_id=api_key_id or None,
            api_key_name=str(config.get("api_key_name") or "").strip() or None,
            updated_at=AdminBusiness._to_iso(config.get("updated_at")),
        )

    @staticmethod
    def _resolve_model_filter(model_id: str) -> Dict[str, Any]:
        return {"$or": [{"id": model_id}, {"model_id": model_id}]}

    @staticmethod
    def _build_model_doc(
        payload: AdminModelUpsertRequest,
        existing: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        existing = existing or {}
        now = datetime.utcnow()
        config_id = payload.id or existing.get("id")
        if not config_id:
            slug = re.sub(r"[^a-z0-9]+", "-", payload.model_id.strip().lower()).strip("-")
            config_id = f"sys-{slug or 'custom'}"

        encrypted_key = existing.get("api_key", "")
        api_key_id = str(existing.get("api_key_id") or "").strip()

        if payload.api_key_id is not None:
            selected_key_id = payload.api_key_id.strip()
            api_key_id = selected_key_id
            if selected_key_id:
                # 引用系统 API Key 时，不再在模型文档中保留独立 key。
                encrypted_key = ""

        if payload.api_key is not None:
            api_key_plain = payload.api_key.strip()
            encrypted_key = encryption_service.encrypt(api_key_plain) if api_key_plain else ""
            if api_key_plain:
                api_key_id = ""

        return {
            "id": config_id,
            "name": payload.name.strip(),
            "model_id": payload.model_id.strip(),
            "base_url": payload.base_url.strip(),
            "api_key": encrypted_key,
            "api_key_id": api_key_id or None,
            "temperature": float(payload.temperature),
            "capabilities": AdminBusiness._normalize_capabilities(payload.capabilities),
            "priority": int(payload.priority),
            "enabled": bool(payload.enabled),
            "is_active": bool(existing.get("is_active", True)),
            "updated_at": now,
            "created_at": existing.get("created_at", now),
        }

    @staticmethod
    async def get_all_users() -> List[AdminUser]:
        users = await UserService.get_all_users()
        return [
            AdminUser(
                id=str(u["_id"]),
                username=u.get("username", (u.get("email") or "unknown@example.com").split("@")[0]),
                email=u.get("email", ""),
                role=u.get("role", "user"),
                status=u.get("status", "active"),
                access_all_models=bool(u.get("access_all_models", True)),
                allowed_model_ids=(
                    [str(item).strip() for item in (u.get("allowed_model_ids") or []) if str(item).strip()]
                    if isinstance(u.get("allowed_model_ids"), list)
                    else []
                ),
                created_at=AdminBusiness._to_iso(u.get("created_at")),
                last_login=AdminBusiness._to_iso(u.get("last_login"))
            ) for u in users
        ]

    @staticmethod
    async def delete_user(user_id: str) -> bool:
        return await UserService.delete_user(user_id)

    @staticmethod
    async def update_user_status(user_id: str, status_value: str) -> bool:
        if db.db is None:
            return False
        try:
            oid = ObjectId(user_id)
        except Exception:
            return False
        result = await db.db.users.update_one(
            {"_id": oid},
            {"$set": {"status": status_value, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0 or result.matched_count > 0

    @staticmethod
    async def update_user_role(user_id: str, role_value: str) -> bool:
        if db.db is None:
            return False
        try:
            oid = ObjectId(user_id)
        except Exception:
            return False
        result = await db.db.users.update_one(
            {"_id": oid},
            {"$set": {"role": role_value, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0 or result.matched_count > 0

    @staticmethod
    async def update_user_model_access(
        user_id: str,
        access_all_models: bool,
        allowed_model_ids: List[str],
    ) -> bool:
        return await UserService.update_user_model_access(
            user_id=user_id,
            access_all_models=access_all_models,
            allowed_model_ids=allowed_model_ids,
        )

    @staticmethod
    async def get_all_models() -> List[AdminModel]:
        if db.db is None:
            return []
        docs = await db.db.system_llm_configs.find({}).sort(
            [("priority", 1), ("name", 1)]
        ).to_list(length=None)
        api_key_ids = sorted(
            {
                str(doc.get("api_key_id") or "").strip()
                for doc in docs
                if str(doc.get("api_key_id") or "").strip()
            }
        )
        api_key_name_map: Dict[str, str] = {}
        if api_key_ids:
            key_docs = await db.db.system_api_keys.find(
                {"id": {"$in": api_key_ids}},
                {"id": 1, "name": 1},
            ).to_list(length=None)
            api_key_name_map = {
                str(row.get("id") or "").strip(): str(row.get("name") or "").strip()
                for row in key_docs
                if str(row.get("id") or "").strip()
            }

        for doc in docs:
            key_id = str(doc.get("api_key_id") or "").strip()
            if key_id:
                doc["api_key_name"] = api_key_name_map.get(key_id, "")

        return [AdminBusiness._safe_model(doc) for doc in docs]

    @staticmethod
    async def create_model(payload: AdminModelUpsertRequest) -> Optional[AdminModel]:
        if db.db is None:
            return None
        doc = AdminBusiness._build_model_doc(payload)
        # 避免 ID 冲突
        if await db.db.system_llm_configs.find_one({"id": doc["id"]}):
            doc["id"] = f"{doc['id']}-{int(datetime.utcnow().timestamp())}"

        await db.db.system_llm_configs.insert_one(doc)
        created = await db.db.system_llm_configs.find_one({"id": doc["id"]})
        if not created:
            return None
        return AdminBusiness._safe_model(created)

    @staticmethod
    async def update_model(model_id: str, payload: AdminModelUpsertRequest) -> Optional[AdminModel]:
        if db.db is None:
            return None
        model_filter = AdminBusiness._resolve_model_filter(model_id)
        existing = await db.db.system_llm_configs.find_one(model_filter)
        if not existing:
            return None

        doc = AdminBusiness._build_model_doc(payload, existing=existing)
        await db.db.system_llm_configs.update_one(
            {"_id": existing["_id"]},
            {"$set": doc}
        )
        updated = await db.db.system_llm_configs.find_one({"_id": existing["_id"]})
        if not updated:
            return None
        return AdminBusiness._safe_model(updated)

    @staticmethod
    async def delete_model(model_id: str) -> bool:
        if db.db is None:
            return False
        result = await db.db.system_llm_configs.delete_one(AdminBusiness._resolve_model_filter(model_id))
        return result.deleted_count > 0

    @staticmethod
    async def get_system_stats() -> SystemStats:
        if db.db is None:
            return SystemStats(total_users=0, active_users=0, total_tokens=0, total_conversations=0, version="1.0.0")

        user_count = await db.db.users.count_documents({})
        active_user_count = await db.db.users.count_documents({"status": {"$ne": "banned"}})

        token_rows = await db.db.llm_token_usage_daily.aggregate([
            {"$match": {"$or": [{"scope": "all"}, {"scope": {"$exists": False}}]}},
            {"$group": {"_id": None, "totalTokens": {"$sum": {"$ifNull": ["$totalTokens", 0]}}}}
        ]).to_list(length=1)
        total_tokens = int(token_rows[0]["totalTokens"]) if token_rows else 0

        collection_names = await db.db.list_collection_names()
        if "chat_sessions" in collection_names:
            total_conversations = await db.db.chat_sessions.count_documents({})
        elif "conversations" in collection_names:
            total_conversations = await db.db.conversations.count_documents({})
        else:
            total_conversations = 0

        return SystemStats(
            total_users=user_count,
            active_users=active_user_count,
            total_tokens=total_tokens,
            total_conversations=total_conversations,
            version="1.0.0"
        )

admin_business = AdminBusiness()
