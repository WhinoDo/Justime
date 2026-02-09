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
from app.services.security_service import SecurityService
from app.services.encryption_service import encryption_service
from app.core.exceptions import UserNotFoundError, PasswordIncorrectError

class AuthBusiness:
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
        
        safe_user = SafeUser(
            id=user_id,
            email=new_user["email"],
            displayName=new_user.get("displayName", ""),
            profile=UserProfile(name=new_user.get("displayName", "")),
            isEmailVerified=new_user.get("isEmailVerified", False),
            role=new_user.get("role", "user")
        )

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
                
            safe_user = SafeUser(
                id=user_id,
                email=user.get("email", ""),
                displayName=user.get("displayName", ""),
                profile=UserProfile(name=user.get("displayName", "")),
                role=user.get("role", "user"),
                isEmailVerified=user.get("isEmailVerified", False)
            )

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
                "isActive": c.get("id") == active_id
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
            "timeout": payload.get("timeout", 60)
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

auth_business = AuthBusiness()
