"""
认证相关数据模型
"""

import re
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class RegisterRequest(BaseModel):
    """用户注册请求"""
    email: EmailStr = Field(..., description="邮箱地址")
    password: str = Field(..., min_length=8, max_length=128, description="密码，至少 8 位")
    username: Optional[str] = Field(None, max_length=50, description="用户名，可选")
    display_name: Optional[str] = Field(None, max_length=100, description="显示名称，可选")
    phone: Optional[str] = Field(None, max_length=20, description="手机号，可选")

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """验证密码强度"""
        if not v or not v.strip():
            raise ValueError('密码不能为空')
        if len(v) < 8:
            raise ValueError('密码至少需要8个字符')
        if len(v) > 128:
            raise ValueError('密码不能超过128个字符')
        if v.strip() != v:
            raise ValueError('密码不能包含首尾空白字符')
        return v

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: Optional[str]) -> Optional[str]:
        """验证用户名格式"""
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        if len(v) < 2:
            raise ValueError('用户名至少需要2个字符')
        if len(v) > 50:
            raise ValueError('用户名不能超过50个字符')
        # 允许中文、字母、数字、下划线、短横线
        if not re.match(r'^[\u4e00-\u9fa5a-zA-Z0-9_-]+$', v):
            raise ValueError('用户名只能包含中文、字母、数字、下划线和短横线')
        return v

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        """验证手机号格式"""
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        # 简单的手机号验证（中国手机号）
        if not re.match(r'^1[3-9]\d{9}$', v):
            raise ValueError('手机号格式无效')
        return v


class LoginRequest(BaseModel):
    """用户登录请求"""
    identifier: str = Field(..., min_length=1, max_length=100, description="邮箱或用户名")
    password: str = Field(..., min_length=1, max_length=128, description="密码")
    rememberMe: Optional[bool] = Field(False, description="记住登录状态")

    @field_validator('identifier')
    @classmethod
    def validate_identifier(cls, v: str) -> str:
        """验证登录标识符"""
        if not v or not v.strip():
            raise ValueError('邮箱或用户名不能为空')
        return v.strip()

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """验证密码"""
        if not v:
            raise ValueError('密码不能为空')
        return v


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
    feishuBinding: bool = False
    feishuOpenId: Optional[str] = None


class LLMConfig(BaseModel):
    """LLM 配置"""
    modelId: Optional[str] = Field(None, max_length=200, description="模型ID")
    baseUrl: Optional[str] = Field(None, max_length=500, description="API基础URL")
    apiKey: Optional[str] = Field(None, max_length=500, description="API密钥")
    temperature: Optional[float] = Field(0.7, ge=0.0, le=2.0, description="温度参数")

    @field_validator('baseUrl')
    @classmethod
    def validate_base_url(cls, v: Optional[str]) -> Optional[str]:
        """验证API基础URL"""
        if v is None or not v.strip():
            return None
        v = v.strip()
        if not v.startswith(('http://', 'https://')):
            raise ValueError('API基础URL必须以 http:// 或 https:// 开头')
        return v.rstrip('/')


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

    @field_validator('profile')
    @classmethod
    def validate_profile(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        """验证用户资料"""
        if not v:
            raise ValueError('用户资料不能为空')
        if not isinstance(v, dict):
            raise ValueError('用户资料必须是对象')

        # 限制嵌套深度
        def check_depth(obj: Any, current_depth: int = 0, max_depth: int = 3) -> None:
            if current_depth > max_depth:
                raise ValueError(f'资料嵌套深度不能超过{max_depth}层')
            if isinstance(obj, dict):
                for value in obj.values():
                    check_depth(value, current_depth + 1, max_depth)
            elif isinstance(obj, list):
                for item in obj:
                    check_depth(item, current_depth + 1, max_depth)

        check_depth(v)

        # 验证允许的字段和长度限制
        allowed_fields = {
            'name': 100,
            'displayName': 100,
            'email': 254,
            'avatar': 500,
            'department': 100,
            'jobTitle': 100,
            'bio': 1000,
            'phone': 20,
            'location': 100,
            'website': 500,
            'habits': None  # habits 允许嵌套对象
        }

        for key in v.keys():
            if key not in allowed_fields:
                raise ValueError(f'不支持的资料字段: {key}')

        # 验证字符串字段长度
        for key, max_len in allowed_fields.items():
            if max_len is not None and key in v and isinstance(v[key], str):
                if len(v[key]) > max_len:
                    raise ValueError(f'{key}长度不能超过{max_len}个字符')

        return v


class ForgotPasswordRequest(BaseModel):
    """忘记密码请求"""
    email: EmailStr = Field(..., description="邮箱地址")


class ResetPasswordRequest(BaseModel):
    """重置密码请求"""
    token: str = Field(..., min_length=1, description="重置令牌")
    new_password: str = Field(..., min_length=8, max_length=128, description="新密码，至少 8 位")

    @field_validator('new_password')
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        """验证新密码强度"""
        if not v or not v.strip():
            raise ValueError('密码不能为空')
        if len(v) < 8:
            raise ValueError('密码至少需要8个字符')
        if len(v) > 128:
            raise ValueError('密码不能超过128个字符')
        if v.strip() != v:
            raise ValueError('密码不能包含首尾空白字符')
        return v
