"""
语音相关 API 端点
"""

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.services.aliyun_token_service import aliyun_token_service
from app.services.security_service import SecurityService

router = APIRouter()


@router.get("/token", summary="获取阿里云语音服务 Token")
async def get_aliyun_speech_token(
    force_refresh: bool = Query(default=False, description="是否强制刷新，不使用缓存"),
    current_user: Dict[str, Any] = Depends(SecurityService.get_current_user),
) -> Dict[str, Any]:
    """服务端生成并返回阿里云语音服务 Token。"""
    _ = current_user
    try:
        data = aliyun_token_service.get_token(force_refresh=force_refresh)
        return {
            "success": True,
            "message": "获取语音 Token 成功",
            "data": data,
        }
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
