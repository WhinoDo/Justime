"""
管理后台相关数据模型
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class AdminUser(BaseModel):
    """管理后台用户信息"""
    id: str = Field(..., description="用户 ID")
    username: str = Field(..., description="用户名")
    email: str = Field(..., description="邮箱")
    role: str = Field(..., description="角色")
    status: str = Field(..., description="状态")
    access_all_models: bool = Field(True, description="是否可访问所有模型")
    allowed_model_ids: List[str] = Field(default_factory=list, description="允许访问的模型ID列表")
    created_at: str = Field(..., description="创建时间")
    last_login: str = Field(..., description="最后登录时间")


class SystemStats(BaseModel):
    """系统统计信息"""
    total_users: int = Field(..., description="总用户数")
    active_users: int = Field(..., description="活跃用户数")
    total_tokens: int = Field(..., description="Token 使用量")
    total_conversations: int = Field(..., description="对话总数")
    version: str = Field(..., description="系统版本")


class UserStatusUpdateRequest(BaseModel):
    """更新用户状态请求"""
    status: Literal["active", "banned"] = Field(..., description="用户状态")


class UserRoleUpdateRequest(BaseModel):
    """更新用户角色请求"""
    role: Literal["user", "admin"] = Field(..., description="用户角色")


class UserModelAccessUpdateRequest(BaseModel):
    """更新用户模型访问权限请求"""
    access_all_models: bool = Field(..., description="是否可访问所有模型")
    allowed_model_ids: List[str] = Field(default_factory=list, description="允许访问的模型配置ID列表")


class AdminModel(BaseModel):
    """后台系统模型配置"""
    id: str = Field(..., description="系统模型配置ID")
    name: str = Field(..., description="显示名称")
    model_id: str = Field(..., description="模型ID")
    base_url: str = Field(..., description="模型服务地址")
    temperature: float = Field(..., description="温度参数")
    capabilities: List[str] = Field(default_factory=list, description="能力标签")
    priority: int = Field(..., description="优先级")
    enabled: bool = Field(..., description="是否启用")
    has_api_key: bool = Field(..., description="是否配置了API Key")
    api_key_id: Optional[str] = Field(None, description="引用的系统 API Key ID")
    api_key_name: Optional[str] = Field(None, description="引用的系统 API Key 名称")
    updated_at: Optional[str] = Field(None, description="更新时间")


class AdminModelUpsertRequest(BaseModel):
    """创建/更新系统模型配置请求"""
    id: Optional[str] = Field(None, description="配置ID，不填时自动生成")
    name: str = Field(..., min_length=1, description="显示名称")
    model_id: str = Field(..., min_length=1, description="模型ID")
    base_url: str = Field(..., min_length=1, description="模型服务地址")
    api_key: Optional[str] = Field(None, description="供应商API Key")
    api_key_id: Optional[str] = Field(None, description="引用的系统 API Key ID")
    temperature: float = Field(0.7, ge=0.0, le=2.0, description="温度参数")
    capabilities: List[str] = Field(default_factory=list, description="能力标签")
    priority: int = Field(100, ge=1, le=999, description="优先级")
    enabled: bool = Field(True, description="是否启用")
