"""
认证相关 API 端点
"""

from fastapi import APIRouter, Depends, Response, Query
from app.business.auth_business import auth_business
from app.models.auth import (
    RegisterRequest, LoginRequest, AuthResponse, LLMConfig, AuthData, SafeUser, UserProfile, ProfileUpdateRequest
)
from app.services.security_service import SecurityService
from typing import Dict, Any

router = APIRouter()


@router.post("/register", response_model=AuthResponse, summary="用户注册")
async def register_user(payload: RegisterRequest) -> AuthResponse:
    """用户注册接口"""
    return await auth_business.register(payload)


@router.post("/login", response_model=AuthResponse, summary="用户登录")
async def login_user(payload: LoginRequest, response: Response) -> AuthResponse:
    """用户登录接口"""
    result = await auth_business.login(payload)
    
    # 如果登录成功，将 token 设置到 cookie 中
    if result.success and result.data and result.data.token:
        # 根据 rememberMe 设置 Cookie 过期时间
        # 记住我：30天，否则：1天
        max_age = 60 * 60 * 24 * 30 if payload.rememberMe else 60 * 60 * 24 * 1
        
        response.set_cookie(
            key="access_token",
            value=result.data.token,
            httponly=True,
            max_age=max_age,
            samesite="lax"
        )
    
    return result


@router.get("/me", response_model=AuthResponse, summary="获取当前用户信息")
async def get_current_user_info(current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)) -> AuthResponse:
    """获取当前登录用户信息"""
    user_id = str(current_user["_id"])
    return await auth_business.get_profile(user_id)


@router.post("/refresh", response_model=AuthResponse, summary="刷新令牌")
async def refresh_token(current_user: Dict[str, Any] = Depends(SecurityService.get_current_user), response: Response = None) -> AuthResponse:
    """刷新认证令牌"""
    user_id = str(current_user["_id"])
    
    # 生成新的 token
    new_token = SecurityService.create_access_token(data={"sub": user_id})
    
    profile = current_user.get("profile") if isinstance(current_user.get("profile"), dict) else {}
    if not profile.get("name"):
        profile["name"] = current_user.get("displayName") or current_user.get("username") or ""
    safe_user = SafeUser(
        id=user_id,
        email=current_user.get("email", ""),
        displayName=current_user.get("displayName", ""),
        username=current_user.get("username", ""),
        profile=UserProfile(**profile),
        role=current_user.get("role", "user"),
        isEmailVerified=current_user.get("isEmailVerified", False)
    )
    
    # 更新 cookie
    if response:
        response.set_cookie(
            key="access_token",
            value=new_token,
            httponly=True,
            max_age=60 * 60 * 24 * 7,
            samesite="lax"
        )
    
    return AuthResponse(
        success=True, 
        message="刷新令牌成功", 
        data=AuthData(user=safe_user, token=new_token)
    )


@router.post("/logout", response_model=AuthResponse, summary="退出登录")
async def logout(response: Response) -> AuthResponse:
    """退出登录"""
    # 清除 cookie
    response.delete_cookie(key="access_token")
    return AuthResponse(success=True, message="退出登录成功", data=None)


@router.get("/profile", response_model=AuthResponse, summary="获取用户资料")
async def get_profile(current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)) -> AuthResponse:
    user_id = str(current_user["_id"])
    return await auth_business.get_profile(user_id)


@router.put("/profile", response_model=AuthResponse, summary="更新用户资料")
async def update_profile(
    payload: ProfileUpdateRequest,
    current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)
) -> AuthResponse:
    user_id = str(current_user["_id"])
    return await auth_business.update_profile(user_id, payload.profile)


@router.get("/llm-config", response_model=AuthResponse, summary="获取LLM配置")
async def get_llm_config(current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)) -> AuthResponse:
    """获取当前用户LLM配置"""
    user_id = str(current_user["_id"])
    return await auth_business.get_llm_config(user_id)


@router.put("/llm-config", response_model=AuthResponse, summary="保存LLM配置 (Legacy)")
async def save_llm_config(config: LLMConfig, current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)) -> AuthResponse:
    """保存用户LLM配置 (兼容旧接口)"""
    user_id = str(current_user["_id"])
    return await auth_business.save_llm_config(user_id, config)


# --- New Multiple Config Endpoints ---

@router.get("/llm-configs", response_model=AuthResponse, summary="获取配置列表")
async def get_llm_configs(current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)) -> AuthResponse:
    """获取用户的所有LLM配置"""
    user_id = str(current_user["_id"])
    return await auth_business.get_llm_configs_list(user_id)

@router.post("/llm-configs", response_model=AuthResponse, summary="添加配置")
async def add_llm_config(payload: Dict[str, Any], current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)) -> AuthResponse:
    """添加新的LLM配置"""
    user_id = str(current_user["_id"])
    return await auth_business.add_llm_config(user_id, payload)

@router.put("/llm-configs/{config_id}", response_model=AuthResponse, summary="更新配置")
async def update_llm_config(config_id: str, payload: Dict[str, Any], current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)) -> AuthResponse:
    """更新指定的LLM配置"""
    user_id = str(current_user["_id"])
    return await auth_business.update_llm_config(user_id, config_id, payload)

@router.delete("/llm-configs/{config_id}", response_model=AuthResponse, summary="删除配置")
async def delete_llm_config(config_id: str, current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)) -> AuthResponse:
    """删除指定的LLM配置"""
    user_id = str(current_user["_id"])
    return await auth_business.delete_llm_config(user_id, config_id)

@router.put("/llm-configs/{config_id}/active", response_model=AuthResponse, summary="激活配置")
async def set_active_config(config_id: str, current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)) -> AuthResponse:
    """设置当前激活的配置"""
    user_id = str(current_user["_id"])
    return await auth_business.set_active_config(user_id, config_id)


@router.get("/llm-usage/daily", summary="获取模型每日 Token 使用量")
async def get_llm_daily_usage(
    days: int = Query(default=14, ge=1, le=90),
    scope: str = Query(default="primary", pattern="^(primary|all)$"),
    current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)
) -> Dict[str, Any]:
    """获取当前用户按模型聚合的每日 token 使用量"""
    user_id = str(current_user["_id"])
    return await auth_business.get_llm_daily_usage(user_id, days, scope)


@router.get("/llm-usage/sessions", summary="获取模型会话级 Token 使用量")
async def get_llm_session_usage(
    days: int = Query(default=14, ge=1, le=90),
    scope: str = Query(default="primary", pattern="^(primary|all)$"),
    current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)
) -> Dict[str, Any]:
    """获取当前用户按会话聚合的模型 token 使用量"""
    user_id = str(current_user["_id"])
    return await auth_business.get_llm_session_usage(user_id, days, scope)


@router.get("/llm-presets", summary="获取LLM模型预设")
async def get_llm_presets() -> Dict[str, Any]:
    """获取系统支持的LLM模型预设列表"""
    import json
    import os
    from pathlib import Path
    
    try:
        config_path = Path("app/config/models.json")
        if config_path.exists():
            with open(config_path, "r", encoding="utf-8") as f:
                presets = json.load(f)
            return {"success": True, "data": presets}
        else:
            return {"success": False, "error": "配置文件不存在", "data": []}
    except Exception as e:
        return {"success": False, "error": str(e), "data": []}
