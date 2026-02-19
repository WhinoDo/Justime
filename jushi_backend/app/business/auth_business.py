"""
用户认证业务逻辑
"""

import dotenv
from pathlib import Path
from fastapi import HTTPException
from app.core.config import settings
from app.services.user_service import UserService
from app.models.auth import (
    RegisterRequest, LoginRequest, SafeUser, 
    UserProfile, AuthData, AuthResponse, LLMConfig
)

from datetime import timedelta, datetime
from typing import Dict, Any
from app.services.security_service import SecurityService
from app.services.encryption_service import encryption_service
from app.core.exceptions import UserNotFoundError, PasswordIncorrectError

class AuthBusiness:
    _ALLOWED_CAPABILITIES = {"fast", "reasoning", "classifier", "tool_call"}

    @staticmethod
    def _normalize_capabilities(raw: Any) -> list[str]:
        if not isinstance(raw, list):
            return []
        values = []
        for item in raw:
            if not isinstance(item, str):
                continue
            normalized = item.strip().lower()
            if normalized in AuthBusiness._ALLOWED_CAPABILITIES and normalized not in values:
                values.append(normalized)
        return values

    @staticmethod
    def _normalize_priority(raw: Any, default: int = 100) -> int:
        try:
            return max(1, min(int(raw), 999))
        except Exception:
            return default

    @staticmethod
    def _normalize_enabled(raw: Any, default: bool = True) -> bool:
        if isinstance(raw, bool):
            return raw
        if raw is None:
            return default
        if isinstance(raw, str):
            lowered = raw.strip().lower()
            if lowered in {"true", "1", "yes", "y"}:
                return True
            if lowered in {"false", "0", "no", "n"}:
                return False
        return bool(raw)

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
            role=user.get("role", "user")
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
        
        return AuthResponse(
            success=True, 
            message="注册成功", 
            data=AuthData(
                user=safe_user,
                token=access_token
            )
        )

    @staticmethod
    async def login(payload: LoginRequest) -> AuthResponse:
        try:
            # 检查数据库连接
            from app.database import db
            if db.db is None:
                print("❌ Login failed: Database not connected")
                return AuthResponse(success=False, message="数据库连接失败，请稍后重试")
            
            # 验证用户
            user = await UserService.authenticate_user(payload.identifier, payload.password)
            if not user:
                print(f"❌ Login failed: Invalid credentials for {payload.identifier}")
                return AuthResponse(success=False, message="用户名或密码错误")
            
            user_id = str(user["_id"])
            print(f"✅ User {payload.identifier} authenticated successfully")
            profile = await UserService.get_user_profile(user_id)
            safe_user = AuthBusiness._build_safe_user(user, profile)

            # Generate tokens
            # 根据 rememberMe 设置过期时间
            if payload.rememberMe:
                access_token_expires = timedelta(days=30)
            else:
                access_token_expires = timedelta(days=1)
                
            access_token = SecurityService.create_access_token(
                data={"sub": user_id},
                expires_delta=access_token_expires
            )

            return AuthResponse(
                success=True, 
                message="登录成功", 
                data=AuthData(
                    user=safe_user,
                    token=access_token
                )
            )
        except UserNotFoundError:
             print(f"❌ Login failed: User {payload.identifier} not found")
             return AuthResponse(success=False, message="账号不存在")
        except PasswordIncorrectError:
             print(f"❌ Login failed: Password incorrect for {payload.identifier}")
             return AuthResponse(success=False, message="密码错误")
        except Exception as e:
            print(f"❌ Login error: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            return AuthResponse(success=False, message=f"登录时发生错误: {str(e)}")

    @staticmethod
    async def get_llm_config(user_id: str) -> AuthResponse:
        """获取用户的 LLM 配置 (自动获取当前激活的配置)"""
        # 1. 获取所有配置数据
        data = await UserService.get_user_llm_configs_data(user_id)
        configs = data.get("configs", [])
        active_id = data.get("active_id")
        legacy_config = data.get("legacy_config")
        
        target_config = None
        
        # 2. 尝试获取激活的配置
        if active_id and configs:
            target_config = next((c for c in configs if c.get("id") == active_id), None)
            
        # 3. 如果没有激活的，尝试使用第一个
        if not target_config and configs:
            target_config = configs[0]
            
        # 4. 如果连列表都没有，尝试使用旧配置
        if not target_config and legacy_config:
            target_config = legacy_config
            
        if target_config:
            # 解密 API Key
            encrypted_key = target_config.get("api_key", "")
            plain_key = encryption_service.decrypt(encrypted_key) if encrypted_key else ""
            
            config = LLMConfig(
                modelId=target_config.get("model_id"),
                baseUrl=target_config.get("base_url"),
                apiKey="******" if plain_key else None,
                temperature=target_config.get("temperature", 0.7)
            )
            return AuthResponse(success=True, message="获取用户配置成功", data=AuthData(llmConfig=config))
            
        # 5. 如果用户没有配置，回退到全局默认配置
        config = LLMConfig(
            modelId=settings.LLM_MODEL_ID,
            baseUrl=settings.LLM_BASE_URL,
            apiKey=None,
            temperature=0.7
        )
        return AuthResponse(success=True, message="获取系统默认配置", data=AuthData(llmConfig=config))

    @staticmethod
    async def save_llm_config(user_id: str, config: LLMConfig) -> AuthResponse:
        """保存用户的 LLM 配置"""
        try:
            # 1. 获取现有配置以处理掩码
            current_config = await UserService.get_user_llm_config(user_id) or {}
            current_encrypted_key = current_config.get("api_key", "")
            
            # 2. 处理 API Key
            final_encrypted_key = current_encrypted_key
            if config.apiKey and "******" not in config.apiKey:
                # 如果是新 Key，加密保存
                final_encrypted_key = encryption_service.encrypt(config.apiKey)
            
            # 3. 构造存储对象
            # 只要有修改，就保存到用户对象
            new_config = {
                "model_id": config.modelId,
                "base_url": config.baseUrl,
                "api_key": final_encrypted_key,
                "temperature": config.temperature
            }
            
            # 4. 更新数据库
            await UserService.update_user_llm_config(user_id, new_config)
            
            return AuthResponse(success=True, message="配置已安全保存", data=AuthData(llmConfig=config))
        except Exception as e:
            return AuthResponse(success=False, message=f"保存失败: {str(e)}")


    @staticmethod
    async def get_llm_configs_list(user_id: str) -> AuthResponse:
        """获取用户的 LLM 配置列表"""
        data = await UserService.get_user_llm_configs_data(user_id)
        configs = data.get("configs", [])
        active_id = data.get("active_id")
        legacy_config = data.get("legacy_config")
        
        # 1. 自动迁移：如果列表为空但有旧配置，创建默认配置
        if not configs and legacy_config and legacy_config.get("model_id"):
            import uuid
            new_id = str(uuid.uuid4())
            migration_config = {
                "id": new_id,
                "name": "默认配置",
                "model_id": legacy_config.get("model_id"),
                "base_url": legacy_config.get("base_url"),
                "api_key": legacy_config.get("api_key"), # Keeping encrypted
                "capabilities": [],
                "priority": 100,
                "enabled": True,
                "created_at": str(datetime.now())
            }
            await UserService.add_user_llm_config(user_id, migration_config)
            await UserService.set_active_llm_config(user_id, new_id)
            configs = [migration_config]
            active_id = new_id
            
        # 2. 处理返回数据 (隐藏 Key)
        safe_configs = []
        for c in configs:
            # 解密 API Key 检查是否存在 (不返回明文)
            encrypted_key = c.get("api_key", "")
            has_key = bool(encrypted_key)
            
            safe_configs.append({
                "id": c.get("id"),
                "name": c.get("name", "未命名配置"),
                "modelId": c.get("model_id"),
                "baseUrl": c.get("base_url"),
                "apiKey": "******" if has_key else None,
                "isActive": c.get("id") == active_id,
                "capabilities": AuthBusiness._normalize_capabilities(c.get("capabilities")),
                "priority": AuthBusiness._normalize_priority(c.get("priority", 100), default=100),
                "enabled": AuthBusiness._normalize_enabled(c.get("enabled", True), default=True)
            })
            
        return AuthResponse(success=True, message="获取配置列表成功", data={"configs": safe_configs})

    @staticmethod
    async def add_llm_config(user_id: str, payload: dict) -> AuthResponse:
        """添加新配置"""
        import uuid
        
        # 加密 Key
        encrypted_key = ""
        if payload.get("apiKey"):
            encrypted_key = encryption_service.encrypt(payload["apiKey"])
            
        new_id = str(uuid.uuid4())
        new_config = {
            "id": new_id,
            "name": payload.get("name", "新配置"),
            "model_id": payload.get("modelId"),
            "base_url": payload.get("baseUrl"),
            "api_key": encrypted_key,
            "timeout": payload.get("timeout", 60),
            "capabilities": AuthBusiness._normalize_capabilities(payload.get("capabilities")),
            "priority": AuthBusiness._normalize_priority(payload.get("priority", 100), default=100),
            "enabled": AuthBusiness._normalize_enabled(payload.get("enabled", True), default=True),
            "created_at": str(datetime.now())
        }
        
        if await UserService.add_user_llm_config(user_id, new_config):
            # 如果是第一个配置，设为激活
            data = await UserService.get_user_llm_configs_data(user_id)
            if len(data.get("configs", [])) == 1:
                await UserService.set_active_llm_config(user_id, new_id)
                
            return AuthResponse(success=True, message="添加成功", data={"id": new_id})
        return AuthResponse(success=False, message="添加失败")

    @staticmethod
    async def update_llm_config(user_id: str, config_id: str, payload: dict) -> AuthResponse:
        """更新配置"""
        update_data = {
            "name": payload.get("name"),
            "model_id": payload.get("modelId"),
            "base_url": payload.get("baseUrl"),
            "timeout": payload.get("timeout", 60),
            "capabilities": AuthBusiness._normalize_capabilities(payload.get("capabilities")) if "capabilities" in payload else None,
            "priority": AuthBusiness._normalize_priority(payload.get("priority", 100), default=100) if "priority" in payload else None,
            "enabled": AuthBusiness._normalize_enabled(payload.get("enabled", True), default=True) if "enabled" in payload else None
        }
        
        # 只有在提供了新 Key 时才更新 (非掩码)
        if payload.get("apiKey") and "******" not in payload["apiKey"]:
            update_data["api_key"] = encryption_service.encrypt(payload["apiKey"])
            
        # 过滤 None
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        if await UserService.update_user_llm_config_item(user_id, config_id, update_data):
            return AuthResponse(success=True, message="更新成功")
        return AuthResponse(success=False, message="更新失败")

    @staticmethod
    async def delete_llm_config(user_id: str, config_id: str) -> AuthResponse:
        """删除配置"""
        if await UserService.delete_user_llm_config(user_id, config_id):
            return AuthResponse(success=True, message="删除成功")
        return AuthResponse(success=False, message="删除失败")

    @staticmethod
    async def set_active_config(user_id: str, config_id: str) -> AuthResponse:
        """设置激活配置"""
        if await UserService.set_active_llm_config(user_id, config_id):
            return AuthResponse(success=True, message="设置激活成功")
        return AuthResponse(success=False, message="设置失败")

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

        config_data = await UserService.get_user_llm_configs_data(user_id)
        configs = config_data.get("configs", []) or []
        active_id = config_data.get("active_id")

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

        for conf in configs:
            config_id = conf.get("id")
            if not config_id:
                continue
            models_map[config_id] = {
                "configId": config_id,
                "name": conf.get("name") or "未命名配置",
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
            return AuthResponse(success=False, message="用户不存在")

        profile = await UserService.get_user_profile(user_id)
        safe_user = AuthBusiness._build_safe_user(user, profile)
        return AuthResponse(success=True, message="获取资料成功", data=AuthData(user=safe_user))

    @staticmethod
    async def update_profile(user_id: str, profile_payload: dict) -> AuthResponse:
        user = await UserService.get_user_by_id(user_id)
        if not user:
            return AuthResponse(success=False, message="用户不存在")

        success = await UserService.update_user_profile(user_id, profile_payload or {})
        if not success:
            return AuthResponse(success=False, message="更新资料失败")

        refreshed_user = await UserService.get_user_by_id(user_id)
        profile = await UserService.get_user_profile(user_id)
        safe_user = AuthBusiness._build_safe_user(refreshed_user or user, profile)
        return AuthResponse(success=True, message="更新资料成功", data=AuthData(user=safe_user))

auth_business = AuthBusiness()
