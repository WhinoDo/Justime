"""
认证相关 API 端点
"""

from datetime import timedelta
from fastapi import APIRouter, Depends, Response, Query, HTTPException, status, Request
from app.business.auth_business import auth_business
from app.models.auth import (
    RegisterRequest, LoginRequest, AuthResponse, LLMConfig, AuthData, SafeUser, UserProfile, ProfileUpdateRequest
)
from app.services.security_service import SecurityService
from typing import Dict, Any
from app.core.config import settings
from app.services.user_service import UserService

router = APIRouter()


def _cookie_security_settings() -> tuple[bool, str]:
    secure = not settings.DEBUG
    same_site = "none" if secure else "lax"
    return secure, same_site


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str, remember_me: bool = False) -> None:
    secure, same_site = _cookie_security_settings()
    access_max_age = 60 * 60 * 24 * (30 if remember_me else 1)
    refresh_max_age = 60 * 60 * 24 * (30 if remember_me else 7)

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=secure,
        samesite=same_site,
        path="/",
        max_age=access_max_age
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite=same_site,
        path="/",
        max_age=refresh_max_age
    )


def _clear_auth_cookies(response: Response) -> None:
    secure, same_site = _cookie_security_settings()
    response.delete_cookie(key="access_token", path="/", secure=secure, samesite=same_site)
    response.delete_cookie(key="refresh_token", path="/", secure=secure, samesite=same_site)


@router.post("/register", response_model=AuthResponse, summary="用户注册")
async def register_user(payload: RegisterRequest, response: Response) -> AuthResponse:
    """用户注册接口"""
    result = await auth_business.register(payload)
    if result.success and result.data and result.data.token and result.data.refreshToken:
        _set_auth_cookies(
            response=response,
            access_token=result.data.token,
            refresh_token=result.data.refreshToken,
            remember_me=False,
        )
        result.data.refreshToken = None
    return result


@router.post("/login", response_model=AuthResponse, summary="用户登录")
async def login_user(payload: LoginRequest, response: Response) -> AuthResponse:
    """用户登录接口"""
    result = await auth_business.login(payload)

    if result.success and result.data and result.data.token and result.data.refreshToken:
        _set_auth_cookies(
            response=response,
            access_token=result.data.token,
            refresh_token=result.data.refreshToken,
            remember_me=bool(payload.rememberMe)
        )
        # refresh token 仅通过 HttpOnly Cookie 下发
        result.data.refreshToken = None

    return result


@router.get("/me", response_model=AuthResponse, summary="获取当前用户信息")
async def get_current_user_info(current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)) -> AuthResponse:
    """获取当前登录用户信息"""
    user_id = str(current_user["_id"])
    return await auth_business.get_profile(user_id)


@router.post("/refresh", response_model=AuthResponse, summary="刷新令牌")
async def refresh_token(request: Request, response: Response) -> AuthResponse:
    """刷新认证令牌"""
    refresh_token_value = request.cookies.get("refresh_token")
    if not refresh_token_value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="缺少刷新令牌")

    payload = SecurityService.decode_refresh_token(refresh_token_value)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="刷新令牌无效或已过期")

    user_id = str(payload.get("sub") or "").strip()
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="刷新令牌无效")

    user = await UserService.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在或已失效")

    profile = await UserService.get_user_profile(user_id)
    safe_user = auth_business._build_safe_user(user, profile)

    remember_me = bool(payload.get("remember", False))
    access_token_expires = timedelta(days=30) if remember_me else timedelta(days=1)
    refresh_token_expires = timedelta(days=30) if remember_me else timedelta(days=7)

    new_access_token = SecurityService.create_access_token(
        data={"sub": user_id},
        expires_delta=access_token_expires
    )
    new_refresh_token = SecurityService.create_refresh_token(
        data={"sub": user_id, "remember": remember_me},
        expires_delta=refresh_token_expires
    )

    _set_auth_cookies(
        response=response,
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        remember_me=remember_me
    )

    return AuthResponse(
        success=True,
        message="刷新令牌成功",
        data=AuthData(user=safe_user, token=new_access_token)
    )


@router.post("/logout", response_model=AuthResponse, summary="退出登录")
async def logout(response: Response) -> AuthResponse:
    """退出登录"""
    _clear_auth_cookies(response)
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


@router.put("/llm-configs/{config_id}", response_model=AuthResponse, summary="更新配置参数")
async def update_llm_config(
    config_id: str,
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)
) -> AuthResponse:
    """更新指定系统模型配置的可调参数（当前支持 temperature）"""
    # 验证 config_id 格式
    if not config_id or not config_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="配置ID不能为空"
        )
    config_id = config_id.strip()

    # 验证更新内容
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="更新内容不能为空"
        )

    # 限制允许更新的字段
    allowed_fields = {"temperature"}
    invalid_fields = set(payload.keys()) - allowed_fields
    if invalid_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的更新字段: {', '.join(invalid_fields)}"
        )

    # 验证 temperature 值
    if "temperature" in payload:
        temp = payload["temperature"]
        if not isinstance(temp, (int, float)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="temperature 必须是数字"
            )
        if temp < 0 or temp > 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="temperature 必须在 0 到 2 之间"
            )

    _ = current_user
    return await auth_business.update_system_config(config_id, payload)


@router.put("/llm-configs/{config_id}/active", response_model=AuthResponse, summary="激活配置")
async def set_active_config(config_id: str, current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)) -> AuthResponse:
    """设置当前激活的配置"""
    # 验证 config_id 格式
    if not config_id or not config_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="配置ID不能为空"
        )
    config_id = config_id.strip()

    user_id = str(current_user["_id"])
    return await auth_business.set_active_config(user_id, config_id)

@router.get("/provider-models", response_model=AuthResponse, summary="动态获取供应商支持的模型列表")
async def get_provider_models(current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)) -> AuthResponse:
    """根据当前激活的模型配置请求对应的供应商API，动态返回可用的模型列表"""
    user_id = str(current_user["_id"])
    return await auth_business.get_provider_models(user_id)


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
    from pathlib import Path

    config_path = Path("app/config/models.json")
    if not config_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="配置文件不存在")

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            presets = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    return {"success": True, "data": presets}
