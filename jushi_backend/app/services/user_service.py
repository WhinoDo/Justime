import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from passlib.context import CryptContext
from app.database import db
from bson import ObjectId
from app.core.exceptions import UserNotFoundError, PasswordIncorrectError, AuthenticationError

# 初始化日志
logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserService:
    @staticmethod
    def _mask_identifier(identifier: str) -> str:
        raw = str(identifier or "").strip()
        if not raw:
            return "[EMPTY]"
        if "@" in raw:
            local, _, domain = raw.partition("@")
            masked_local = f"{local[:1]}***" if local else "***"
            return f"{masked_local}@{domain}"
        if len(raw) == 1:
            return "*"
        if len(raw) == 2:
            return f"{raw[0]}*"
        return f"{raw[:2]}***"

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def get_password_hash(password: str) -> str:
        return pwd_context.hash(password)

    @staticmethod
    async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
        if db.db is None:
            return None
        return await db.db.users.find_one({"email": email})

    @staticmethod
    async def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
        if db.db is None:
            return None
        return await db.db.users.find_one({"username": username})

    @staticmethod
    async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
        if db.db is None:
            return None
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            return await db.db.users.find_one({"_id": oid})
        except (ValueError, TypeError, Exception) as e:
            logger.debug(f"Invalid user_id format: {e}")
            return None

    @staticmethod
    async def create_user(user_data: Dict[str, Any]) -> Dict[str, Any]:
        if db.db is None:
            raise Exception("Database not connected")
            
        # Add timestamps and default fields
        user_data["created_at"] = datetime.utcnow()
        user_data["last_login"] = datetime.utcnow()
        if "role" not in user_data:
            user_data["role"] = "user"
        if "status" not in user_data:
            user_data["status"] = "active"
        if "access_all_models" not in user_data:
            user_data["access_all_models"] = True
        if "allowed_model_ids" not in user_data:
            user_data["allowed_model_ids"] = []
            
        # Hash password if present
        if "password" in user_data:
            user_data["hashed_password"] = UserService.get_password_hash(user_data["password"])
            del user_data["password"]

        result = await db.db.users.insert_one(user_data)
        user_data["_id"] = result.inserted_id
        return user_data

    @staticmethod
    async def authenticate_user(identifier: str, password: str) -> Optional[Dict[str, Any]]:
        safe_identifier = UserService._mask_identifier(identifier)
        logger.debug(f"Authenticating user: {safe_identifier}")
        if db.db is None:
            logger.error("Database not connected")
            return None

        # Check by email or username
        user = await UserService.get_user_by_email(identifier)
        if not user:
            logger.debug(f"User not found by email, trying username...")
            user = await UserService.get_user_by_username(identifier)

        if not user:
            raise UserNotFoundError(f"User {safe_identifier} not found")

        safe_email = UserService._mask_identifier(user.get("email", ""))
        logger.debug(f"Found user: {safe_email}, role: {user.get('role', 'N/A')}")
        # 优先检查 hashed_password
        hashed_password = user.get("hashed_password")
        if hashed_password:
            logger.debug("Verifying hashed password...")
            try:
                if UserService.verify_password(password, hashed_password):
                    logger.debug("Password verified successfully")
                    return user
                else:
                    logger.warning("Password mismatch")
                    raise PasswordIncorrectError("Password verification failed")
            except AuthenticationError:
                raise
            except Exception as e:
                logger.error(f"Password verification error: {type(e).__name__}: {e}")
                raise PasswordIncorrectError("Password verification error")
        else:
            logger.warning("No hashed_password field found for user")

        # 兼容旧数据或直接存储的明文密码（仅作为修复手段）
        old_password = user.get("password")
        if old_password:
            logger.debug("Checking plain text password (legacy)...")
            if old_password == password:
                # 如果匹配，建议并执行自动升级到哈希密码
                logger.info("Plain text password matched. Upgrading to hash...")
                new_hashed = UserService.get_password_hash(password)
                await db.db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"hashed_password": new_hashed}, "$unset": {"password": ""}}
                )
                logger.info("Password upgraded to hash")
                return user
            else:
                logger.warning("Plain text password mismatch")
                raise PasswordIncorrectError("Legacy password verification failed")
        else:
            logger.error("No password field found at all")
            raise PasswordIncorrectError("User has no password set")

        return None

    @staticmethod
    async def get_all_users() -> list[Dict[str, Any]]:
        if db.db is None:
            return []
        cursor = db.db.users.find({})
        users = await cursor.to_list(length=1000)
        return users

    @staticmethod
    async def delete_user(user_id: str) -> bool:
        if db.db is None:
            return False
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            result = await db.db.users.delete_one({"_id": oid})
            return result.deleted_count > 0
        except (ValueError, TypeError, Exception) as e:
            logger.debug(f"Failed to delete user: {e}")
            return False

    @staticmethod
    async def update_user_llm_config(user_id: str, config: Dict[str, Any]) -> bool:
        """更新用户的 LLM 配置"""
        if db.db is None:
            return False
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            result = await db.db.users.update_one(
                {"_id": oid},
                {"$set": {"llm_config": config}}
            )
            return result.modified_count > 0 or result.matched_count > 0
        except Exception as e:
            logger.error(f"Error updating user config: {e}")
            return False

    @staticmethod
    async def get_system_llm_configs() -> List[Dict[str, Any]]:
        """获取平台所有预设的 LLM 配置"""
        if db.db is None: return []
        try:
            configs = await db.db.system_llm_configs.find({}).to_list(length=None)
            configs = await UserService._inject_api_keys_for_configs(configs)
            for c in configs:
                c["_id"] = str(c.get("_id"))
            return configs
        except Exception: return []

    @staticmethod
    async def _inject_api_keys_for_configs(configs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if db.db is None or not configs:
            return configs

        api_key_ids = sorted(
            {
                str(c.get("api_key_id") or "").strip()
                for c in configs
                if str(c.get("api_key_id") or "").strip()
            }
        )
        api_key_map: Dict[str, str] = {}
        if api_key_ids:
            key_docs = await db.db.system_api_keys.find(
                {"id": {"$in": api_key_ids}},
                {"id": 1, "api_key": 1},
            ).to_list(length=None)
            api_key_map = {
                str(item.get("id") or "").strip(): str(item.get("api_key") or "").strip()
                for item in key_docs
                if str(item.get("id") or "").strip()
            }

        for c in configs:
            key_id = str(c.get("api_key_id") or "").strip()
            if key_id and api_key_map.get(key_id):
                # 注入的是加密态 API Key，调用层沿用 decrypt 逻辑。
                c["api_key"] = api_key_map[key_id]
        return configs

    @staticmethod
    async def get_available_models_for_user(user_id: str) -> List[Dict[str, Any]]:
        """按用户模型权限返回可用系统模型配置。"""
        configs = await UserService.get_system_llm_configs()
        if db.db is None:
            return configs
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            user = await db.db.users.find_one(
                {"_id": oid},
                {"access_all_models": 1, "allowed_model_ids": 1}
            )
        except Exception:
            return []

        if not user:
            return []

        access_all = bool(user.get("access_all_models", True))
        if access_all:
            return configs

        allowed_model_ids = user.get("allowed_model_ids") or []
        allowed_set = {
            str(item).strip()
            for item in allowed_model_ids
            if str(item).strip()
        }
        if not allowed_set:
            return []

        return [
            conf for conf in configs
            if str(conf.get("id") or "").strip() in allowed_set
        ]

    @staticmethod
    async def get_user_active_model_id(user_id: str) -> Optional[str]:
        if db.db is None: return None
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            user = await db.db.users.find_one({"_id": oid}, {"active_model_id": 1})
            return user.get("active_model_id") if user else None
        except Exception: return None

    @staticmethod
    async def set_active_model_id(user_id: str, model_id: str) -> bool:
        if db.db is None: return False
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            result = await db.db.users.update_one(
                {"_id": oid},
                {"$set": {"active_model_id": model_id}}
            )
            return result.modified_count > 0 or result.matched_count > 0
        except Exception: return False

    @staticmethod
    async def update_user_model_access(
        user_id: str,
        access_all_models: bool,
        allowed_model_ids: List[str],
    ) -> bool:
        if db.db is None:
            return False
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            normalized_ids: List[str] = []
            for item in allowed_model_ids:
                value = str(item or "").strip()
                if value and value not in normalized_ids:
                    normalized_ids.append(value)

            result = await db.db.users.update_one(
                {"_id": oid},
                {
                    "$set": {
                        "access_all_models": bool(access_all_models),
                        "allowed_model_ids": normalized_ids,
                        "updated_at": datetime.utcnow(),
                    }
                },
            )
            return result.modified_count > 0 or result.matched_count > 0
        except Exception:
            return False

    @staticmethod
    async def record_model_token_usage(
        user_id: str,
        config_id: str,
        model_id: str,
        config_name: str,
        prompt_tokens: int,
        completion_tokens: int,
        is_estimated: bool = True,
        usage_date: Optional[str] = None
    ) -> bool:
        """兼容旧接口：仅保留真实 usage；估算请求仅记缺失计数。"""
        if is_estimated:
            prompt_tokens = 0
            completion_tokens = 0
        return await UserService.record_llm_usage_event(
            user_id=user_id,
            session_id="unknown_session",
            config_id=config_id,
            model_id=model_id,
            config_name=config_name,
            path_type="legacy",
            is_primary=True,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            usage_missing=bool(is_estimated),
            usage_date=usage_date,
            request_count=1
        )

    @staticmethod
    async def record_llm_usage_event(
        user_id: str,
        session_id: str,
        config_id: str,
        model_id: str,
        config_name: str,
        path_type: str,
        is_primary: bool,
        prompt_tokens: int,
        completion_tokens: int,
        usage_missing: bool = False,
        usage_date: Optional[str] = None,
        request_count: int = 1,
        missing_usage_requests: Optional[int] = None,
        provider_request_ids: Optional[List[str]] = None,
        message_id: Optional[str] = None,
        usage_raw: Optional[Dict[str, Any]] = None
    ) -> bool:
        """记录真实 usage 事件，并同步写入按 scope 的日聚合表。"""
        if db.db is None:
            return False

        try:
            prompt_tokens = max(0, int(prompt_tokens or 0))
            completion_tokens = max(0, int(completion_tokens or 0))
            total_tokens = prompt_tokens + completion_tokens
            request_count = max(1, int(request_count or 1))

            today = usage_date or datetime.utcnow().strftime("%Y-%m-%d")
            now = datetime.utcnow()

            usage_missing = bool(usage_missing)
            if missing_usage_requests is None:
                missing_usage_requests = request_count if usage_missing else 0
            else:
                missing_usage_requests = max(0, int(missing_usage_requests))

            event_doc = {
                "userId": user_id,
                "sessionId": session_id or "unknown_session",
                "messageId": message_id,
                "configId": config_id or "system-default",
                "modelId": model_id or "",
                "configName": config_name or "未命名配置",
                "pathType": path_type or "unknown",
                "isPrimary": bool(is_primary),
                "promptTokens": prompt_tokens,
                "completionTokens": completion_tokens,
                "totalTokens": total_tokens,
                "requestCount": request_count,
                "missingUsageRequests": missing_usage_requests,
                "usageMissing": usage_missing,
                "providerRequestIds": provider_request_ids or [],
                "usageRaw": usage_raw or {},
                "date": today,
                "createdAt": now,
            }
            await db.db["llm_usage_events"].insert_one(event_doc)

            async def _update_daily(scope: str):
                await db.db["llm_token_usage_daily"].update_one(
                    {
                        "userId": user_id,
                        "configId": config_id or "system-default",
                        "date": today,
                        "scope": scope
                    },
                    {
                        "$inc": {
                            "promptTokens": prompt_tokens,
                            "completionTokens": completion_tokens,
                            "totalTokens": total_tokens,
                            "requests": request_count,
                            "missingUsageRequests": missing_usage_requests
                        },
                        "$set": {
                            "modelId": model_id or "",
                            "configName": config_name or "未命名配置",
                            "updatedAt": now
                        },
                        "$setOnInsert": {
                            "createdAt": now
                        }
                    },
                    upsert=True
                )

            # all 口径包含 primary + shadow；primary 仅主链路
            await _update_daily("all")
            if is_primary:
                await _update_daily("primary")

            return True
        except Exception as e:
            logger.error(f"Error recording model token usage: {e}")
            return False

    @staticmethod
    async def get_model_token_usage_daily(
        user_id: str,
        date_from: str,
        date_to: str,
        scope: str = "primary"
    ) -> List[Dict[str, Any]]:
        """获取用户在日期区间内的模型 token 使用记录"""
        if db.db is None:
            return []

        try:
            target_scope = "all" if scope == "all" else "primary"
            cursor = db.db["llm_token_usage_daily"].find(
                {
                    "userId": user_id,
                    "date": {"$gte": date_from, "$lte": date_to},
                    "scope": target_scope
                },
                {
                    "_id": 0
                }
            )
            return await cursor.to_list(length=5000)
        except Exception as e:
            logger.error(f"Error fetching model token usage: {e}")
            return []

    @staticmethod
    async def get_model_token_usage_sessions(
        user_id: str,
        date_from: str,
        date_to: str,
        scope: str = "primary"
    ) -> List[Dict[str, Any]]:
        """获取用户在日期区间内按会话聚合的 usage 记录。"""
        if db.db is None:
            return []

        try:
            match_query: Dict[str, Any] = {
                "userId": user_id,
                "date": {"$gte": date_from, "$lte": date_to},
            }
            if scope != "all":
                match_query["isPrimary"] = True

            pipeline = [
                {"$match": match_query},
                {
                    "$group": {
                        "_id": {
                            "sessionId": "$sessionId",
                            "configId": "$configId",
                            "modelId": "$modelId",
                            "configName": "$configName",
                        },
                        "promptTokens": {"$sum": "$promptTokens"},
                        "completionTokens": {"$sum": "$completionTokens"},
                        "totalTokens": {"$sum": "$totalTokens"},
                        "requests": {"$sum": "$requestCount"},
                        "missingUsageRequests": {"$sum": "$missingUsageRequests"},
                        "firstAt": {"$min": "$createdAt"},
                        "lastAt": {"$max": "$createdAt"},
                    }
                },
                {
                    "$project": {
                        "_id": 0,
                        "sessionId": "$_id.sessionId",
                        "configId": "$_id.configId",
                        "modelId": "$_id.modelId",
                        "configName": "$_id.configName",
                        "promptTokens": 1,
                        "completionTokens": 1,
                        "totalTokens": 1,
                        "requests": 1,
                        "missingUsageRequests": 1,
                        "firstAt": 1,
                        "lastAt": 1,
                    }
                },
                {"$sort": {"lastAt": -1}},
            ]
            cursor = db.db["llm_usage_events"].aggregate(pipeline)
            return await cursor.to_list(length=10000)
        except Exception as e:
            logger.error(f"Error fetching model session usage: {e}")
            return []

    @staticmethod
    async def get_user_profile(user_id: str) -> Dict[str, Any]:
        """获取用户 profile 数据（不存在时返回默认结构）"""
        default_profile = {"name": "", "habits": {}}
        if db.db is None:
            return default_profile
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            user = await db.db.users.find_one({"_id": oid}, {"profile": 1, "displayName": 1, "email": 1, "username": 1})
            if not user:
                return default_profile
            profile = user.get("profile") or {}
            if not isinstance(profile, dict):
                profile = {}
            if not profile.get("name"):
                profile["name"] = user.get("displayName") or user.get("username") or ""
            profile.setdefault("email", user.get("email") or "")
            profile.setdefault("displayName", user.get("displayName") or "")
            profile.setdefault("habits", {})
            return profile
        except Exception as e:
            logger.error(f"Error get user profile: {e}")
            return default_profile

    @staticmethod
    async def update_user_profile(user_id: str, profile: Dict[str, Any]) -> bool:
        """更新用户 profile 数据"""
        if db.db is None:
            return False
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            safe_profile = profile if isinstance(profile, dict) else {}
            if "name" in safe_profile and isinstance(safe_profile["name"], str):
                safe_profile["name"] = safe_profile["name"].strip()
            if "displayName" in safe_profile and isinstance(safe_profile["displayName"], str):
                safe_profile["displayName"] = safe_profile["displayName"].strip()
            if "habits" in safe_profile and not isinstance(safe_profile["habits"], dict):
                safe_profile["habits"] = {}

            update_doc = {
                "$set": {
                    "profile": safe_profile,
                    "updated_at": datetime.utcnow()
                }
            }

            display_name = safe_profile.get("displayName") or safe_profile.get("name")
            if isinstance(display_name, str) and display_name.strip():
                update_doc["$set"]["displayName"] = display_name.strip()

            result = await db.db.users.update_one({"_id": oid}, update_doc)
            return result.modified_count > 0 or result.matched_count > 0
        except Exception as e:
            logger.error(f"Error update user profile: {e}")
            return False

    @staticmethod
    async def update_password(user_id: str, new_password: str) -> bool:
        """更新用户密码"""
        if db.db is None:
            return False
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            hashed_password = UserService.get_password_hash(new_password)
            result = await db.db.users.update_one(
                {"_id": oid},
                {
                    "$set": {
                        "hashed_password": hashed_password,
                        "updated_at": datetime.utcnow()
                    },
                    "$unset": {"password": ""}
                }
            )
            return result.modified_count > 0 or result.matched_count > 0
        except Exception as e:
            logger.error(f"Error updating password: {e}")
            return False
