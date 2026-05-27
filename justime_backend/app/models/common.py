"""
通用数据模型
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    """错误详情"""
    field: Optional[str] = Field(None, description="错误字段")
    message: str = Field(..., description="错误消息")
    type: Optional[str] = Field(None, description="错误类型")


class ErrorResponse(BaseModel):
    """统一错误响应模型"""
    success: bool = Field(False, description="始终为 False")
    error: str = Field(..., description="错误消息")
    code: int = Field(..., description="HTTP 状态码")
    details: Optional[List[Dict[str, Any]]] = Field(None, description="详细错误列表")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "请求参数验证失败",
                "code": 400,
                "details": [{"field": "email", "message": "邮箱格式无效", "type": "value_error.email"}]
            }
        }


class SuccessResponse(BaseModel):
    """统一成功响应模型"""
    success: bool = Field(True, description="始终为 True")
    message: Optional[str] = Field(None, description="成功消息")
    data: Optional[Any] = Field(None, description="响应数据")
