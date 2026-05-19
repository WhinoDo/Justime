"""
管理后台业务逻辑
"""

import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from bson import ObjectId
from app.core.normalizers import normalize_bool, normalize_capabilities, normalize_priority, to_iso_datetime
from app.services.user_service import UserService
from app.services.encryption_service import encryption_service
from app.services.cache_service import CacheService
from app.database import db
from app.models.admin import AdminModel, AdminModelUpsertRequest, AdminUser, SystemStats

class AdminBusiness:
    _ALLOWED_CAPABILITIES = {"fast", "reasoning", "classifier", "tool_call"}

    @staticmethod
    def _safe_model(config: Dict[str, Any]) -> AdminModel:
        api_key_id = str(config.get("api_key_id") or "").strip()
        return AdminModel(
            id=str(config.get("id") or ""),
            name=str(config.get("name") or "系统模型"),
            model_id=str(config.get("model_id") or ""),
            base_url=str(config.get("base_url") or ""),
            temperature=float(config.get("temperature", 0.7) or 0.7),
            capabilities=normalize_capabilities(config.get("capabilities"), allowed=AdminBusiness._ALLOWED_CAPABILITIES),
            priority=normalize_priority(config.get("priority", 100), default=100),
            enabled=normalize_bool(config.get("enabled", True), default=True),
            has_api_key=bool(config.get("api_key") or api_key_id),
            api_key_id=api_key_id or None,
            api_key_name=str(config.get("api_key_name") or "").strip() or None,
            updated_at=to_iso_datetime(config.get("updated_at")),
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
            "capabilities": normalize_capabilities(payload.capabilities, allowed=AdminBusiness._ALLOWED_CAPABILITIES),
            "priority": normalize_priority(payload.priority, default=100),
            "enabled": normalize_bool(payload.enabled, default=True),
            "is_active": normalize_bool(existing.get("is_active", True), default=True),
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
                access_all_models=normalize_bool(u.get("access_all_models", True), default=True),
                allowed_model_ids=(
                    [str(item).strip() for item in (u.get("allowed_model_ids") or []) if str(item).strip()]
                    if isinstance(u.get("allowed_model_ids"), list)
                    else []
                ),
                created_at=to_iso_datetime(u.get("created_at")),
                last_login=to_iso_datetime(u.get("last_login"))
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
        success = result.modified_count > 0 or result.matched_count > 0
        if success:
            # 使用户数据缓存失效
            await CacheService.invalidate_user_data(user_id)
        return success

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
        success = result.modified_count > 0 or result.matched_count > 0
        if success:
            # 使用户数据缓存失效
            await CacheService.invalidate_user_data(user_id)
        return success

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
        # 使系统 LLM 配置缓存失效
        await CacheService.invalidate_system_llm_configs()
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
        # 使系统 LLM 配置缓存失效
        await CacheService.invalidate_system_llm_configs()
        return AdminBusiness._safe_model(updated)

    @staticmethod
    async def delete_model(model_id: str) -> bool:
        if db.db is None:
            return False
        result = await db.db.system_llm_configs.delete_one(AdminBusiness._resolve_model_filter(model_id))
        success = result.deleted_count > 0
        if success:
            # 使系统 LLM 配置缓存失效
            await CacheService.invalidate_system_llm_configs()
        return success

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

    @staticmethod
    async def test_connection(
        base_url: str,
        api_key: Optional[str],
        api_key_id: Optional[str],
        model_id: str,
    ) -> Dict[str, Any]:
        """
        测试 API 连接
        
        Returns:
            Dict with keys: success, message, latency_ms
        """
        import httpx
        import time
        import logging

        logger = logging.getLogger(__name__)

        # 解析实际使用的 API Key
        actual_api_key = ""
        
        # 优先使用直接传入的 api_key
        if api_key and api_key.strip():
            actual_api_key = api_key.strip()
        # 否则尝试从系统 API Key 中获取
        elif api_key_id and api_key_id.strip() and db.db is not None:
            key_doc = await db.db.system_api_keys.find_one({"id": api_key_id.strip()})
            if key_doc and key_doc.get("api_key"):
                encrypted = key_doc.get("api_key", "")
                actual_api_key = encryption_service.decrypt(encrypted)

        logger.info(f"测试连接: base_url={base_url}, model_id={model_id}, has_api_key={bool(actual_api_key)}")

        if not actual_api_key:
            return {
                "success": False,
                "message": "未提供有效的 API Key",
                "latency_ms": None,
            }

        # 规范化 base_url：OpenAI 兼容接口一般为 .../v1/chat/completions
        normalized_url = base_url.strip().rstrip("/")
        if not normalized_url.endswith("/v1"):
            normalized_url = f"{normalized_url}/v1"

        actual_headers = {
            "Authorization": f"Bearer {actual_api_key}",
            "Content-Type": "application/json",
        }
        
        # 使用一个简单的请求来测试连接
        payload = {
            "model": model_id.strip(),
            "messages": [{"role": "user", "content": "Hi"}],
            "max_tokens": 5,
        }

        start_time = time.time()

        # 临时移除代理环境变量（ALL_PROXY=socks… 且无 socksio 会报错）；测试结束在 finally 中恢复。
        _proxy_keys = (
            "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY",
            "http_proxy", "https_proxy", "all_proxy", "no_proxy",
        )
        _saved_proxy: Dict[str, str] = {}
        try:
            for _k in _proxy_keys:
                if _k in os.environ:
                    _saved_proxy[_k] = os.environ.pop(_k)

            try:
                logger.info(f"发送请求到: {normalized_url}/chat/completions")
                transport = httpx.AsyncHTTPTransport(retries=0)
                async with httpx.AsyncClient(
                    transport=transport,
                    timeout=15.0,
                    trust_env=False,
                ) as client:
                    response = await client.post(
                        f"{normalized_url}/chat/completions",
                        headers=actual_headers,
                        json=payload,
                    )
                elapsed_ms = int((time.time() - start_time) * 1000)
                logger.info(f"收到响应: status={response.status_code}, elapsed={elapsed_ms}ms")

                if response.status_code == 200:
                    return {
                        "success": True,
                        "message": f"连接成功 (HTTP {response.status_code})",
                        "latency_ms": elapsed_ms,
                    }

                try:
                    error_body = response.json()
                    error_msg = error_body.get("error", {}).get("message", response.text[:100])
                except Exception:
                    error_msg = response.text[:100] if response.text else f"HTTP {response.status_code}"
                return {
                    "success": False,
                    "message": f"连接失败: {error_msg}",
                    "latency_ms": elapsed_ms,
                }
            except httpx.TimeoutException:
                elapsed_ms = int((time.time() - start_time) * 1000)
                logger.error(f"连接超时: {elapsed_ms}ms")
                return {
                    "success": False,
                    "message": "连接超时，请检查网络或服务地址",
                    "latency_ms": elapsed_ms,
                }
            except httpx.ConnectError as e:
                elapsed_ms = int((time.time() - start_time) * 1000)
                logger.error(f"连接错误: {str(e)}")
                return {
                    "success": False,
                    "message": f"无法连接到服务: {str(e)[:100]}",
                    "latency_ms": elapsed_ms,
                }
            except Exception as e:
                elapsed_ms = int((time.time() - start_time) * 1000)
                logger.error(f"测试异常: {type(e).__name__}: {str(e)}", exc_info=True)
                return {
                    "success": False,
                    "message": f"测试失败: {str(e)[:100]}",
                    "latency_ms": elapsed_ms,
                }
        finally:
            os.environ.update(_saved_proxy)

admin_business = AdminBusiness()
