from datetime import datetime
from typing import Optional, Dict, Any, List
from passlib.context import CryptContext
from app.database import db
from bson import ObjectId
from app.core.exceptions import UserNotFoundError, PasswordIncorrectError

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserService:
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
        except:
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
            
        # Hash password if present
        if "password" in user_data:
            user_data["hashed_password"] = UserService.get_password_hash(user_data["password"])
            del user_data["password"]

        result = await db.db.users.insert_one(user_data)
        user_data["_id"] = result.inserted_id
        return user_data

    @staticmethod
    async def authenticate_user(identifier: str, password: str) -> Optional[Dict[str, Any]]:
        print(f"🔐 Authenticating user: {identifier}")
        
        if db.db is None:
            print("❌ Database not connected")
            return None
            
        # Check by email or username
        user = await UserService.get_user_by_email(identifier)
        if not user:
            print(f"  User not found by email, trying username...")
            user = await UserService.get_user_by_username(identifier)
            
        if not user:
            print(f"❌ User not found: {identifier}")
            raise UserNotFoundError(f"User {identifier} not found")
        
        print(f"  Found user: {user.get('email', 'N/A')}, role: {user.get('role', 'N/A')}")
            
        # 优先检查 hashed_password
        hashed_password = user.get("hashed_password")
        if hashed_password:
            print(f"  Verifying hashed password...")
            try:
                if UserService.verify_password(password, hashed_password):
                    print(f"✅ Password verified successfully")
                    return user
                else:
                    print(f"❌ Password mismatch")
                    raise PasswordIncorrectError("Password verification failed")
            except AuthenticationError:
                raise
            except Exception as e:
                print(f"❌ Password verification error: {type(e).__name__}: {e}")
                raise PasswordIncorrectError("Password verification error")
        else:
            print(f"⚠️ No hashed_password field found for user")
        
        # 兼容旧数据或直接存储的明文密码（仅作为修复手段）
        old_password = user.get("password")
        if old_password:
            print(f"  Checking plain text password (legacy)...")
            if old_password == password:
                # 如果匹配，建议并执行自动升级到哈希密码
                print(f"⚠️ Plain text password matched. Upgrading to hash...")
                new_hashed = UserService.get_password_hash(password)
                await db.db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"hashed_password": new_hashed}, "$unset": {"password": ""}}
                )
                print(f"✅ Password upgraded to hash")
                return user
            else:
                print(f"❌ Plain text password mismatch")
                raise PasswordIncorrectError("Legacy password verification failed")
        else:
            print(f"❌ No password field found at all")
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
            # Handle both string ID and ObjectId
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            result = await db.db.users.delete_one({"_id": oid})
            return result.deleted_count > 0
        except:
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
            print(f"Error updating user config: {e}")
            return False

    @staticmethod
    async def get_user_llm_config(user_id: str) -> Optional[Dict[str, Any]]:
        """获取用户的 LLM 配置"""
        if db.db is None:
            return None
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            user = await db.db.users.find_one({"_id": oid}, {"llm_config": 1})
            return user.get("llm_config") if user else None
        except Exception:
            return None


    @staticmethod
    async def get_user_llm_configs_data(user_id: str) -> Dict[str, Any]:
        """获取用户的所有 LLM 配置数据 (包含列表和当前激活ID)"""
        if db.db is None:
            return {"configs": [], "active_id": None}
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            user = await db.db.users.find_one({"_id": oid}, {"llm_configs": 1, "active_llm_config_id": 1, "llm_config": 1})
            
            if not user:
                return {"configs": [], "active_id": None}
                
            # 兼容旧字段 llm_config
            legacy_config = user.get("llm_config")
            configs = user.get("llm_configs", [])
            active_id = user.get("active_llm_config_id")
            
            return {
                "configs": configs, 
                "active_id": active_id,
                "legacy_config": legacy_config
            }
        except Exception:
            return {"configs": [], "active_id": None}

    @staticmethod
    async def add_user_llm_config(user_id: str, config_item: Dict[str, Any]) -> bool:
        """添加新的 LLM 配置"""
        if db.db is None: return False
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            await db.db.users.update_one(
                {"_id": oid},
                {"$push": {"llm_configs": config_item}}
            )
            return True
        except Exception: return False

    @staticmethod
    async def update_user_llm_config_item(user_id: str, config_id: str, update_data: Dict[str, Any]) -> bool:
        """更新列表中的特定配置"""
        if db.db is None: return False
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            # Mongo update inside array using identifier 'id'
            # Construct set dict
            update_fields = {f"llm_configs.$.{k}": v for k, v in update_data.items()}
            
            result = await db.db.users.update_one(
                {"_id": oid, "llm_configs.id": config_id},
                {"$set": update_fields}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Update error: {e}")
            return False

    @staticmethod
    async def delete_user_llm_config(user_id: str, config_id: str) -> bool:
        """删除列表中的特定配置"""
        if db.db is None: return False
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            await db.db.users.update_one(
                {"_id": oid},
                {"$pull": {"llm_configs": {"id": config_id}}}
            )
            return True
        except Exception: return False

    @staticmethod
    async def set_active_llm_config(user_id: str, config_id: str) -> bool:
        """设置当前激活的配置 ID"""
        if db.db is None: return False
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            await db.db.users.update_one(
                {"_id": oid},
                {"$set": {"active_llm_config_id": config_id}}
            )
            return True
        except Exception: return False

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
            print(f"Error recording model token usage: {e}")
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
            print(f"Error fetching model token usage: {e}")
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
            print(f"Error fetching model session usage: {e}")
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
            print(f"Error get user profile: {e}")
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
            print(f"Error update user profile: {e}")
            return False
