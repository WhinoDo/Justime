"""
认证相关数据模型
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """用户注册请求"""
    email: EmailStr = Field(..., description="邮箱地址")
    password: str = Field(..., min_length=6, description="密码，至少 6 位")
    username: Optional[str] = Field(None, description="用户名，可选")
    display_name: Optional[str] = Field(None, description="显示名称，可选")
    phone: Optional[str] = Field(None, description="手机号，可选")


class LoginRequest(BaseModel):
    """用户登录请求"""
    identifier: str = Field(..., description="邮箱或用户名")
    password: str = Field(..., description="密码")
    rememberMe: Optional[bool] = Field(False, description="记住登录状态")


class UserProfile(BaseModel):
    """用户资料"""
    name: str
    displayName: Optional[str] = None
    email: Optional[str] = None
    avatar: Optional[str] = None
    department: Optional[str] = None
    jobTitle: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    habits: Optional[Dict[str, Any]] = None


class SafeUser(BaseModel):
    """安全的用户信息（不含密码）"""
    id: str
    username: Optional[str] = None
    email: str
    displayName: str
    profile: UserProfile
    isEmailVerified: bool = False
    role: str = "user"
    needsVerification: bool = False


class LLMConfig(BaseModel):
    """LLM 配置"""
    modelId: Optional[str] = None
    baseUrl: Optional[str] = None
    apiKey: Optional[str] = None
    temperature: Optional[float] = 0.7


class AuthData(BaseModel):
    """认证数据"""
    user: Optional[SafeUser] = None
    token: Optional[str] = None
    refreshToken: Optional[str] = None
    llmConfig: Optional[LLMConfig] = None
    configs: Optional[list] = None # Support for multiple configs
    models: Optional[list] = None # Support for dynamic provider models


class AuthResponse(BaseModel):
    """认证响应"""
    success: bool
    message: str
    data: Optional[AuthData] = None


class ProfileUpdateRequest(BaseModel):
    """用户资料更新请求"""
    profile: Dict[str, Any] = Field(..., description="用户资料对象")
