"""
后台 API Key 管理相关数据模型
"""

from typing import Optional

from pydantic import BaseModel, Field


class AdminApiKey(BaseModel):
    """后台通用 API Key 配置"""
    id: str = Field(..., description="API Key 配置ID")
    name: str = Field(..., description="显示名称")
    has_api_key: bool = Field(..., description="是否配置了密钥")
    updated_at: Optional[str] = Field(None, description="更新时间")


class AdminApiKeyCreated(BaseModel):
    """创建 API Key 后的响应（包含完整密钥）"""
    id: str = Field(..., description="API Key 配置ID")
    name: str = Field(..., description="显示名称")
    api_key: str = Field(..., description="完整的 API Key（仅创建时返回）")
    updated_at: Optional[str] = Field(None, description="更新时间")


class AdminApiKeyUpsertRequest(BaseModel):
    """创建/更新 API Key 请求"""
    id: Optional[str] = Field(None, description="配置ID，不填时自动生成")
    name: str = Field(..., min_length=1, description="显示名称")
    api_key: Optional[str] = Field(
        None,
        description="供应商 API Key；更新时留空表示不修改",
    )
