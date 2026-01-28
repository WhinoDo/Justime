"""
管理后台相关数据模型
"""

from pydantic import BaseModel, Field


class AdminUser(BaseModel):
    """管理后台用户信息"""
    id: str = Field(..., description="用户 ID")
    username: str = Field(..., description="用户名")
    email: str = Field(..., description="邮箱")
    role: str = Field(..., description="角色")
    status: str = Field(..., description="状态")
    created_at: str = Field(..., description="创建时间")
    last_login: str = Field(..., description="最后登录时间")


class SystemStats(BaseModel):
    """系统统计信息"""
    total_users: int = Field(..., description="总用户数")
    active_users: int = Field(..., description="活跃用户数")
    total_tokens: int = Field(..., description="Token 使用量")
    total_conversations: int = Field(..., description="对话总数")
    version: str = Field(..., description="系统版本")
