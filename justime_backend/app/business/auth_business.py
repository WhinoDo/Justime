"""
用户认证业务逻辑
"""

import logging
import secrets
from bson import ObjectId
from fastapi import HTTPException
from pymongo import ReturnDocument
from app.core.config import settings
from app.services.user_service import UserService
from app.models.auth import (
    RegisterRequest, LoginRequest, SafeUser,
    UserProfile, AuthData, AuthResponse, LLMConfig,
    ForgotPasswordRequest, ResetPasswordRequest
)

from datetime import timedelta, datetime
from typing import Dict, Any, Optional
from app.core.normalizers import normalize_bool, normalize_capabilities, normalize_priority
from app.services.security_service import SecurityService
from app.services.encryption_service import encryption_service
from app.services.cache_service import CacheService
from app.core.exceptions import UserNotFoundError, PasswordIncorrectError

logger = logging.getLogger(__name__)

class AuthBusiness:
    _ALLOWED_CAPABILITIES = {"fast", "reasoning", "classifier", "tool_call"}

    @staticmethod
    def _build_safe_user(user: dict, profile: dict) -> SafeUser:
        display_name = user.get("displayName") or profile.get("displayName") or profile.get("name") or user.get("username") or ""
        profile_name = profile.get("name") or display_name or ""
        profile_data = dict(profile) if isinstance(profile, dict) else {}
        profile_data["name"] = profile_name
        profile_data.setdefault("displayName", display_name)
        profile_data.setdefault("email", user.get("email", ""))

        return SafeUser(
            id=str(user["_id"]),
            username=user.get("username"),
            email=user.get("email", ""),
            displayName=display_name,
            profile=UserProfile(**profile_data),
            isEmailVerified=user.get("isEmailVerified", False),
            role=user.get("role", "user"),
            feishuBinding=bool(user.get("feishuOpenId")),
            feishuOpenId=user.get("feishuOpenId")
        )

    @staticmethod
    async def register(payload: RegisterRequest) -> AuthResponse:
        if await UserService.get_user_by_email(payload.email):
            raise HTTPException(status_code=400, detail="Email already registered")
            
        username = payload.username or payload.email.split("@")[0]
        user_data = {
            "email": payload.email,
            "password": payload.password,
            "username": username,
            "displayName": payload.display_name or username,
            "profile": {"name": payload.display_name or username}
        }
        
        if payload.phone:
            user_data["phone"] = payload.phone
            
        new_user = await UserService.create_user(user_data)
        user_id = str(new_user["_id"])
        profile = await UserService.get_user_profile(user_id)
        safe_user = AuthBusiness._build_safe_user(new_user, profile)

        # Generate tokens
        access_token = SecurityService.create_access_token(data={"sub": user_id})
        refresh_token = SecurityService.create_refresh_token(data={"sub": user_id, "remember": False})

        return AuthResponse(
            success=True,
            message="注册成功",
            data=AuthData(
                user=safe_user,
                token=access_token,
                refreshToken=refresh_token
            )
        )

    @staticmethod
    async def login(payload: LoginRequest) -> AuthResponse:
        # 检查数据库连接
        from app.database import db
        if db.db is None:
            logger.error("Login failed: Database not connected")
            raise HTTPException(status_code=503, detail="数据库连接失败，请稍后重试")

        # 验证用户
        try:
            safe_identifier = UserService._mask_identifier(payload.identifier)
            user = await UserService.authenticate_user(payload.identifier, payload.password)
        except UserNotFoundError:
            logger.warning(f"Login failed: User {safe_identifier} not found")
            raise HTTPException(status_code=404, detail="账号不存在")
        except PasswordIncorrectError:
            logger.warning(f"Login failed: Password incorrect for {safe_identifier}")
            raise HTTPException(status_code=401, detail="密码错误")

        user_id = str(user["_id"])
        logger.info(f"User {safe_identifier} authenticated successfully")
        profile = await UserService.get_user_profile(user_id)
        safe_user = AuthBusiness._build_safe_user(user, profile)

        # Generate tokens
        # Access token always uses short expiry (30 minutes) for security (OAuth2 best practice)
        # Refresh token uses longer expiry based on rememberMe
        refresh_token_expires = timedelta(days=30) if payload.rememberMe else timedelta(days=7)

        access_token = SecurityService.create_access_token(
            data={"sub": user_id}
        )
        refresh_token = SecurityService.create_refresh_token(
            data={"sub": user_id, "remember": bool(payload.rememberMe)},
            expires_delta=refresh_token_expires
        )

        return AuthResponse(
            success=True,
            message="登录成功",
            data=AuthData(
                user=safe_user,
                token=access_token,
                refreshToken=refresh_token
            )
        )

    @staticmethod
    async def get_llm_config(user_id: str) -> AuthResponse:
        """获取用户的 LLM 配置 (自动获取当前激活的配置)"""
        # 1. 获取所有系统配置数据
        system_configs = await UserService.get_available_models_for_user(user_id)
        active_id = await UserService.get_user_active_model_id(user_id)
        
        target_config = None
        
        # 2. 尝试获取激活的配置
        if active_id and system_configs:
            target_config = next((c for c in system_configs if c.get("id") == active_id), None)
            
        # 3. 如果没有激活的，尝试使用第一个
        if not target_config and system_configs:
            target_config = system_configs[0]

        if not target_config:
            raise HTTPException(status_code=404, detail="平台尚未配置可用的 AI 模型，请联系管理员添加。")

        # 解密 API Key
        encrypted_key = target_config.get("api_key", "")
        plain_key = encryption_service.decrypt(encrypted_key) if encrypted_key else ""

        config = LLMConfig(
            modelId=target_config.get("model_id"),
            baseUrl=target_config.get("base_url"),
            apiKey=plain_key if plain_key else None,
            temperature=target_config.get("temperature", 0.7)
        )
        return AuthResponse(success=True, message="获取用户配置成功", data=AuthData(llmConfig=config))


    @staticmethod
    async def get_llm_configs_list(user_id: str) -> AuthResponse:
        """获取平台的 LLM 配置列表"""
        system_configs = await UserService.get_available_models_for_user(user_id)
        active_id = await UserService.get_user_active_model_id(user_id)
        
        # 处理返回数据 (完全隐藏 Key)
        safe_configs = []
        for c in system_configs:
            safe_configs.append({
                "id": c.get("id"),
                "name": c.get("name", "系统模型"),
                "modelId": c.get("model_id"),
                "baseUrl": c.get("base_url"),
                "apiKey": None, # Never return any API keys to the frontend in B2C
                "isActive": c.get("id") == active_id,
                "temperature": c.get("temperature", 0.7),
                "capabilities": normalize_capabilities(c.get("capabilities")),
                "priority": normalize_priority(c.get("priority", 100), default=100),
                "enabled": normalize_bool(c.get("enabled", True), default=True)
            })
            
        return AuthResponse(success=True, message="获取配置列表成功", data={"configs": safe_configs})

    @staticmethod
    async def get_provider_models(user_id: str) -> AuthResponse:
        """从 LLM 供应商动态获取可用的模型列表"""
        system_configs = await UserService.get_available_models_for_user(user_id)
        active_id = await UserService.get_user_active_model_id(user_id)

        target_config = None
        if active_id and system_configs:
            target_config = next((c for c in system_configs if c.get("id") == active_id), None)
        if not target_config and system_configs:
            target_config = system_configs[0]

        if not target_config:
            raise HTTPException(status_code=404, detail="系统未配置模型")

        base_url = target_config.get("base_url")
        encrypted_key = target_config.get("api_key", "")
        plain_key = encryption_service.decrypt(encrypted_key) if encrypted_key else ""

        if not base_url or not plain_key:
            raise HTTPException(status_code=400, detail="系统模型配置缺失（URL或Key不存在）")

        # Normalize baseUrl for models endpoint
        testing_url = base_url
        if not testing_url.endswith("/v1"):
            testing_url = f"{testing_url.rstrip('/')}/v1"
        testing_url = f"{testing_url}/models"

        import httpx

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    testing_url,
                    headers={
                        "Authorization": f"Bearer {plain_key}",
                        "Content-Type": "application/json"
                    }
                )
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="连接超时，无法获取供应商模型")
        except Exception as e:
            logger.error(f"获取供应商模型失败: {e}")
            raise HTTPException(status_code=502, detail="获取供应商模型失败，请稍后重试")

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"获取失败，供应商返回 {response.status_code}")

        data = response.json()
        models = data.get("data", [])
        model_ids = [m.get("id") for m in models if isinstance(m, dict) and m.get("id")]
        return AuthResponse(success=True, message="获取供应商模型成功", data={"models": model_ids})

    @staticmethod
    async def update_system_config(config_id: str, payload: Dict[str, Any]) -> AuthResponse:
        """更新系统模型配置的可调参数（当前支持 temperature）"""
        if not isinstance(payload, dict):
            raise HTTPException(status_code=400, detail="请求参数格式错误")

        updates: Dict[str, Any] = {}
        if "temperature" in payload:
            temperature = payload.get("temperature")
            if isinstance(temperature, bool) or not isinstance(temperature, (int, float)):
                raise HTTPException(status_code=400, detail="temperature 必须是数字")
            if temperature < 0 or temperature > 2:
                raise HTTPException(status_code=400, detail="temperature 必须在 0.0 ~ 2.0 之间")
            updates["temperature"] = float(temperature)

        if not updates:
            raise HTTPException(status_code=400, detail="没有可更新的参数")

        from app.database import db
        if db.db is None:
            raise HTTPException(status_code=503, detail="数据库未连接")

        result = await db.db.system_llm_configs.update_one(
            {"id": config_id},
            {"$set": updates}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail=f"未找到配置 {config_id}")

        # 使系统 LLM 配置缓存失效
        await CacheService.invalidate_system_llm_configs()

        return AuthResponse(success=True, message="更新配置成功")

    @staticmethod
    async def set_active_config(user_id: str, config_id: str) -> AuthResponse:
        """设置激活配置"""
        available = await UserService.get_available_models_for_user(user_id)
        if not any(str(c.get("id") or "") == config_id for c in available):
            raise HTTPException(status_code=403, detail="无权访问该模型配置")
        if await UserService.set_active_model_id(user_id, config_id):
            return AuthResponse(success=True, message="设置激活成功")
        raise HTTPException(status_code=500, detail="设置失败")

    @staticmethod
    async def get_llm_daily_usage(user_id: str, days: int = 14, scope: str = "primary") -> Dict[str, Any]:
        """获取按模型聚合的每日 token 使用量"""
        days = max(1, min(int(days or 14), 90))
        target_scope = "all" if scope == "all" else "primary"

        end_date = datetime.utcnow().date()
        date_series = [
            (end_date - timedelta(days=offset)).strftime("%Y-%m-%d")
            for offset in range(days - 1, -1, -1)
        ]
        date_from = date_series[0]
        date_to = date_series[-1]

        usage_rows = await UserService.get_model_token_usage_daily(
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
            scope=target_scope
        )

        system_configs = await UserService.get_system_llm_configs()
        active_id = await UserService.get_user_active_model_id(user_id)

        def init_daily_points() -> Dict[str, Dict[str, int]]:
            return {
                day: {
                    "promptTokens": 0,
                    "completionTokens": 0,
                    "totalTokens": 0,
                    "requests": 0,
                    "missingUsageRequests": 0
                }
                for day in date_series
            }

        models_map: Dict[str, Dict[str, Any]] = {}

        for conf in system_configs:
            config_id = conf.get("id")
            if not config_id:
                continue
            models_map[config_id] = {
                "configId": config_id,
                "name": conf.get("name") or "未命名平台配置",
                "modelId": conf.get("model_id") or "",
                "isActive": config_id == active_id,
                "_daily_map": init_daily_points()
            }

        for row in usage_rows:
            config_id = row.get("configId") or "unknown"
            usage_date = row.get("date")
            if usage_date not in date_series:
                continue

            if config_id not in models_map:
                row_model_id = (row.get("modelId") or "").strip().lower()
                matched_key = None
                if row_model_id:
                    best_score = 0
                    for key, entry in models_map.items():
                        entry_model_id = (entry.get("modelId") or "").strip().lower()
                        if not entry_model_id:
                            continue

                        score = 0
                        if entry_model_id == row_model_id:
                            score = 3
                        elif row_model_id in entry_model_id or entry_model_id in row_model_id:
                            score = 2
                        else:
                            row_provider = row_model_id.split("-")[0]
                            entry_provider = entry_model_id.split("-")[0]
                            if row_provider and row_provider == entry_provider:
                                score = 1

                        if score > best_score:
                            best_score = score
                            matched_key = key
                        elif score > 0 and score == best_score and key == active_id:
                            matched_key = key

                # 历史默认配置优先归并到当前激活配置，避免出现孤立“默认配置”条目
                if not matched_key and config_id in {"legacy-default", "platform-default", "default"} and active_id in models_map:
                    matched_key = active_id

                if matched_key:
                    config_id = matched_key
                else:
                    models_map[config_id] = {
                        "configId": config_id,
                        "name": row.get("configName") or "历史配置",
                        "modelId": row.get("modelId") or "",
                        "isActive": config_id == active_id,
                        "_daily_map": init_daily_points()
                    }

            models_map[config_id]["_daily_map"][usage_date] = {
                "promptTokens": int(row.get("promptTokens", 0)),
                "completionTokens": int(row.get("completionTokens", 0)),
                "totalTokens": int(row.get("totalTokens", 0)),
                "requests": int(row.get("requests", 0)),
                "missingUsageRequests": int(row.get("missingUsageRequests", 0))
            }

        models = []
        for item in models_map.values():
            daily_points = []
            total_tokens = 0
            total_requests = 0
            missing_usage_requests = 0

            for day in date_series:
                point = item["_daily_map"][day]
                total_tokens += point["totalTokens"]
                total_requests += point["requests"]
                missing_usage_requests += point["missingUsageRequests"]
                daily_points.append({
                    "date": day,
                    **point
                })

            source_coverage = 1.0
            if total_requests > 0:
                source_coverage = max(0.0, min(1.0, (total_requests - missing_usage_requests) / total_requests))

            models.append({
                "configId": item["configId"],
                "name": item["name"],
                "modelId": item["modelId"],
                "isActive": item["isActive"],
                "totalTokens": total_tokens,
                "totalRequests": total_requests,
                "missingUsageRequests": missing_usage_requests,
                "sourceCoverage": source_coverage,
                "daily": daily_points
            })

        models.sort(key=lambda x: (not x["isActive"], -x["totalTokens"], x["name"]))

        return {
            "success": True,
            "data": {
                "days": days,
                "dateRange": {
                    "from": date_from,
                    "to": date_to
                },
                "scope": target_scope,
                "models": models,
                "note": "仅统计模型供应商返回的 usage。若未返回 usage，则该请求仅计入缺失次数，不计入 token。"
            }
        }

    @staticmethod
    async def get_llm_session_usage(user_id: str, days: int = 14, scope: str = "primary") -> Dict[str, Any]:
        """获取按会话聚合的模型 usage（可审计）。"""
        days = max(1, min(int(days or 14), 90))
        target_scope = "all" if scope == "all" else "primary"

        end_date = datetime.utcnow().date()
        date_series = [
            (end_date - timedelta(days=offset)).strftime("%Y-%m-%d")
            for offset in range(days - 1, -1, -1)
        ]
        date_from = date_series[0]
        date_to = date_series[-1]

        rows = await UserService.get_model_token_usage_sessions(
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
            scope=target_scope
        )

        sessions_map: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            session_id = row.get("sessionId") or "unknown_session"
            if session_id not in sessions_map:
                sessions_map[session_id] = {
                    "sessionId": session_id,
                    "firstAt": row.get("firstAt"),
                    "lastAt": row.get("lastAt"),
                    "promptTokens": 0,
                    "completionTokens": 0,
                    "totalTokens": 0,
                    "requests": 0,
                    "missingUsageRequests": 0,
                    "models": []
                }

            bucket = sessions_map[session_id]
            bucket["promptTokens"] += int(row.get("promptTokens", 0))
            bucket["completionTokens"] += int(row.get("completionTokens", 0))
            bucket["totalTokens"] += int(row.get("totalTokens", 0))
            bucket["requests"] += int(row.get("requests", 0))
            bucket["missingUsageRequests"] += int(row.get("missingUsageRequests", 0))
            if row.get("firstAt") and (not bucket["firstAt"] or row["firstAt"] < bucket["firstAt"]):
                bucket["firstAt"] = row["firstAt"]
            if row.get("lastAt") and (not bucket["lastAt"] or row["lastAt"] > bucket["lastAt"]):
                bucket["lastAt"] = row["lastAt"]

            bucket["models"].append({
                "configId": row.get("configId"),
                "configName": row.get("configName"),
                "modelId": row.get("modelId"),
                "promptTokens": int(row.get("promptTokens", 0)),
                "completionTokens": int(row.get("completionTokens", 0)),
                "totalTokens": int(row.get("totalTokens", 0)),
                "requests": int(row.get("requests", 0)),
                "missingUsageRequests": int(row.get("missingUsageRequests", 0)),
            })

        sessions = list(sessions_map.values())
        sessions.sort(key=lambda item: item.get("lastAt") or "", reverse=True)

        return {
            "success": True,
            "data": {
                "days": days,
                "dateRange": {
                    "from": date_from,
                    "to": date_to
                },
                "scope": target_scope,
                "sessions": sessions,
            }
        }

    @staticmethod
    async def get_profile(user_id: str) -> AuthResponse:
        user = await UserService.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")

        profile = await UserService.get_user_profile(user_id)
        safe_user = AuthBusiness._build_safe_user(user, profile)
        return AuthResponse(success=True, message="获取资料成功", data=AuthData(user=safe_user))

    @staticmethod
    async def update_profile(user_id: str, profile_payload: dict) -> AuthResponse:
        user = await UserService.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")

        success = await UserService.update_user_profile(user_id, profile_payload or {})
        if not success:
            raise HTTPException(status_code=500, detail="更新资料失败")

        refreshed_user = await UserService.get_user_by_id(user_id)
        profile = await UserService.get_user_profile(user_id)
        safe_user = AuthBusiness._build_safe_user(refreshed_user or user, profile)
        return AuthResponse(success=True, message="更新资料成功", data=AuthData(user=safe_user))

    @staticmethod
    async def forgot_password(email: str) -> AuthResponse:
        """处理忘记密码请求，生成重置 token 并发送邮件"""
        from app.database import db
        from app.services.email_service import email_service
        
        if db.db is None:
            raise HTTPException(status_code=503, detail="数据库连接失败")
        
        user = await UserService.get_user_by_email(email)
        if not user:
            return AuthResponse(
                success=True,
                message="如果该邮箱已注册，您将收到密码重置邮件"
            )
        
        user_id = str(user["_id"])
        user_name = user.get("displayName") or user.get("username") or email.split("@")[0]
        
        reset_token = secrets.token_urlsafe(32)
        ttl_minutes = settings.PASSWORD_RESET_TTL_MINUTES
        expires_at = datetime.utcnow() + timedelta(minutes=ttl_minutes)
        
        await db.db.password_reset_tokens.delete_many({"user_id": user_id})
        
        insert_result = await db.db.password_reset_tokens.insert_one({
            "user_id": user_id,
            "token": reset_token,
            "expires_at": expires_at,
            "created_at": datetime.utcnow(),
            "used": False
        })
        
        delivered = await email_service.send_password_reset_email(
            email,
            reset_token,
            user_name,
            ttl_minutes,
        )
        if not delivered:
            await db.db.password_reset_tokens.delete_one({"_id": insert_result.inserted_id})
            logger.warning("Password reset email delivery failed")
        
        return AuthResponse(
            success=True,
            message="如果该邮箱已注册，您将收到密码重置邮件"
        )

    @staticmethod
    async def reset_password(token: str, new_password: str) -> AuthResponse:
        """通过重置 token 设置新密码"""
        from app.database import db

        if db.db is None:
            raise HTTPException(status_code=503, detail="数据库连接失败")

        hashed_password = await UserService.get_password_hash(new_password)
        now = datetime.utcnow()

        token_doc = await db.db.password_reset_tokens.find_one_and_update({
            "token": token,
            "used": False,
            "expires_at": {"$gt": now}
        }, {
            "$set": {"used": True, "used_at": now}
        }, return_document=ReturnDocument.AFTER)

        if not token_doc:
            raise HTTPException(status_code=400, detail="重置链接无效或已过期")

        user_id = token_doc["user_id"]

        result = await db.db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"hashed_password": hashed_password, "password_changed_at": now, "updated_at": now}}
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="用户不存在")

        # 使该用户的数据缓存失效
        await CacheService.invalidate_user_data(user_id)

        return AuthResponse(
            success=True,
            message="密码重置成功，请使用新密码登录"
        )

    @staticmethod
    async def bind_feishu(user_id: str, feishu_open_id: Optional[str]) -> AuthResponse:
        from bson import ObjectId
        from fastapi import HTTPException
        from app.services.user_service import UserService
        from app.database import db

        user = await UserService.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")

        if feishu_open_id:
            feishu_open_id = feishu_open_id.strip()
            # 校验是否已被其他用户绑定
            existing_user = await db.db.users.find_one({"feishuOpenId": feishu_open_id, "_id": {"$ne": ObjectId(user_id)}})
            if existing_user:
                raise HTTPException(status_code=400, detail="该飞书账号已被其他账户绑定")

            # 绑定
            await db.db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"feishuOpenId": feishu_open_id, "updated_at": datetime.utcnow()}}
            )
        else:
            # 解绑
            await db.db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$unset": {"feishuOpenId": ""}, "$set": {"updated_at": datetime.utcnow()}}
            )

        # 使缓存失效
        await CacheService.invalidate_user_data(user_id)

        # 重新获取完整用户资料并返回
        updated_user = await UserService.get_user_by_id(user_id)
        profile = await UserService.get_user_profile(user_id)
        safe_user = AuthBusiness._build_safe_user(updated_user or user, profile)
        return AuthResponse(
            success=True,
            message="绑定成功" if feishu_open_id else "解绑成功",
            data=AuthData(user=safe_user)
        )

auth_business = AuthBusiness()
