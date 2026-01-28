"""
安全服务
处理 JWT 令牌生成、验证和密码哈希
"""

import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from app.core.config import settings
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException, status
from app.services.user_service import UserService

# OAuth2 方案，用于 Swagger UI 认证
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

class SecurityService:
    @staticmethod
    def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """创建访问令牌 (JWT)"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
            
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
        return encoded_jwt

    @staticmethod
    def decode_token(token: str) -> Optional[Dict[str, Any]]:
        """解码并验证令牌"""
        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
            return payload
        except jwt.PyJWTError:
            return None

    @staticmethod
    async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
        """
        获取当前用户依赖项
        用法: async def endpoint(current_user = Depends(SecurityService.get_current_user)):
        """
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
        payload = SecurityService.decode_token(token)
        if payload is None:
            raise credentials_exception
            
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
            
        # 使用 ID 查询用户
        user = await UserService.get_user_by_id(user_id)
        
        if user is None:
            raise credentials_exception
            
        return user

# 全局安全服务实例
security_service = SecurityService()
