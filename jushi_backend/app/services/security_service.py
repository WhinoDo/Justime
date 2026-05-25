"""
安全服务
处理 JWT 令牌生成、验证和密码哈希
"""

import jwt
from datetime import datetime, timedelta
from typing import Annotated, Optional, Dict, Any
from app.core.config import settings
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException, status
from app.services.user_service import UserService

# OAuth2 方案，用于 Swagger UI 认证
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

# Annotated type hint for OAuth2 token dependency (SonarQube python:S8410)
AuthToken = Annotated[str, Depends(oauth2_scheme)]

class SecurityService:
    ACCESS_TOKEN_TYPE = "access"
    REFRESH_TOKEN_TYPE = "refresh"
    PASSWORD_RESET_TOKEN_TYPE = "password_reset"

    @staticmethod
    def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """创建访问令牌 (JWT)"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

        to_encode.update({"exp": expire, "type": SecurityService.ACCESS_TOKEN_TYPE, "iss": "jushi-app", "aud": "jushi-users"})
        encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
        return encoded_jwt

    @staticmethod
    def create_refresh_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """创建刷新令牌 (JWT)"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)

        to_encode.update({"exp": expire, "type": SecurityService.REFRESH_TOKEN_TYPE, "iss": "jushi-app", "aud": "jushi-users"})
        encoded_jwt = jwt.encode(to_encode, settings.JWT_REFRESH_SECRET, algorithm=settings.JWT_ALGORITHM)
        return encoded_jwt

    @staticmethod
    def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
        """解码并验证访问令牌"""
        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM], audience="jushi-users", issuer="jushi-app")
            if payload.get("type") != SecurityService.ACCESS_TOKEN_TYPE:
                return None
            return payload
        except jwt.PyJWTError:
            return None

    @staticmethod
    def decode_refresh_token(token: str) -> Optional[Dict[str, Any]]:
        """解码并验证刷新令牌"""
        try:
            payload = jwt.decode(token, settings.JWT_REFRESH_SECRET, algorithms=[settings.JWT_ALGORITHM], audience="jushi-users", issuer="jushi-app")
            if payload.get("type") != SecurityService.REFRESH_TOKEN_TYPE:
                return None
            return payload
        except jwt.PyJWTError:
            return None

    @staticmethod
    def create_password_reset_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """创建密码重置令牌"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(hours=1)

        to_encode.update({"exp": expire, "type": SecurityService.PASSWORD_RESET_TOKEN_TYPE, "iss": "jushi-app", "aud": "jushi-users"})
        encoded_jwt = jwt.encode(to_encode, settings.JWT_PASSWORD_RESET_SECRET, algorithm=settings.JWT_ALGORITHM)
        return encoded_jwt

    @staticmethod
    def decode_password_reset_token(token: str) -> Optional[Dict[str, Any]]:
        """解码并验证密码重置令牌"""
        try:
            payload = jwt.decode(token, settings.JWT_PASSWORD_RESET_SECRET, algorithms=[settings.JWT_ALGORITHM], audience="jushi-users", issuer="jushi-app")
            if payload.get("type") != SecurityService.PASSWORD_RESET_TOKEN_TYPE:
                return None
            return payload
        except jwt.PyJWTError:
            return None

    @staticmethod
    async def get_current_user(token: AuthToken) -> Dict[str, Any]:
        """
        获取当前用户依赖项
        用法: from app.api.deps import CurrentUser
             async def endpoint(current_user: CurrentUser):
        """
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
        payload = SecurityService.decode_access_token(token)
        if payload is None:
            raise credentials_exception
            
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
            
        user = await UserService.get_user_by_id(user_id)
        
        if user is None:
            raise credentials_exception

        password_changed_at = user.get("password_changed_at")
        if password_changed_at:
            token_iat = payload.get("iat")
            if token_iat and datetime.utcfromtimestamp(token_iat) < password_changed_at:
                raise credentials_exception
        
        return user

# 全局安全服务实例
security_service = SecurityService()
