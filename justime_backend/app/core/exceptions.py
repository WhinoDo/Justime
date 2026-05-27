"""
全局异常处理
"""

from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
import logging

from app.models.common import ErrorResponse
from app.core.log_sanitizer import sanitize_error_message

logger = logging.getLogger(__name__)


class AuthenticationError(Exception):
    """Base authentication error"""
    pass


class UserNotFoundError(AuthenticationError):
    """User not found during authentication"""
    pass


class PasswordIncorrectError(AuthenticationError):
    """Password incorrect during authentication"""
    pass


class CSRFError(Exception):
    """CSRF token validation error"""
    pass


class ValidationErrorDetail:
    """验证错误详情"""
    def __init__(self, field: str, message: str, error_type: str = None):
        self.field = field
        self.message = message
        self.error_type = error_type

    def to_dict(self) -> dict:
        result = {"field": self.field, "message": self.message}
        if self.error_type:
            result["type"] = self.error_type
        return result


def _get_friendly_field_name(field: str) -> str:
    """获取友好的字段名称"""
    field_names = {
        "email": "邮箱",
        "password": "密码",
        "username": "用户名",
        "displayName": "显示名称",
        "display_name": "显示名称",
        "message": "消息内容",
        "sessionId": "会话ID",
        "session_id": "会话ID",
        "taskId": "任务ID",
        "task_id": "任务ID",
        "title": "标题",
        "description": "描述",
        "start": "开始时间",
        "end": "结束时间",
        "type": "类型",
        "priority": "优先级",
        "status": "状态",
        "modelId": "模型ID",
        "model_id": "模型ID",
        "baseUrl": "API地址",
        "base_url": "API地址",
        "apiKey": "API密钥",
        "api_key": "API密钥",
        "temperature": "温度参数",
        "task": "任务描述",
        "tools": "工具列表",
        "max_steps": "最大步数",
        "provider": "提供者",
        "identifier": "邮箱或用户名",
        "rememberMe": "记住我",
        "remember_me": "记住我",
        "profile": "用户资料",
        "config_id": "配置ID",
        "user_id": "用户ID",
        "event_id": "事件ID",
        "phone": "手机号",
        "role": "角色",
        "name": "名称",
        "url": "链接",
        "location": "地点",
        "resources": "资源",
        "reminders": "提醒",
    }
    return field_names.get(field, field)


def _get_friendly_error_message(field: str, message: str, error_type: str) -> str:
    """
    将技术性错误消息转换为更友好的提示
    """
    friendly_field = _get_friendly_field_name(field)

    if error_type in ("value_error.missing", "missing"):
        return f"{friendly_field}不能为空"
    elif "email" in error_type:
        return f"{friendly_field}格式无效，请输入有效的邮箱地址"
    elif "min_length" in error_type or "min_length" in message:
        return f"{friendly_field}长度不足"
    elif "max_length" in error_type or "max_length" in message:
        return f"{friendly_field}长度超出限制"
    elif "not_ge" in error_type or "greater_than_equal" in error_type:
        return f"{friendly_field}值太小"
    elif "not_le" in error_type or "less_than_equal" in error_type:
        return f"{friendly_field}值太大"
    elif "pattern" in error_type or "regex" in error_type:
        return f"{friendly_field}格式无效"
    elif "url" in error_type or "URL" in message:
        return f"{friendly_field}URL格式无效"
    elif "datetime" in error_type:
        return f"{friendly_field}日期时间格式无效"

    if any('\u4e00' <= c <= '\u9fff' for c in message):
        return message

    return f"{friendly_field}格式无效"


def _format_validation_errors(errors: list) -> list:
    """格式化验证错误"""
    formatted_errors = []
    for error in errors:
        loc = error.get("loc", [])
        field = ".".join(str(l) for l in loc if l not in ("body", "query", "path", "header"))

        message = error.get("msg", "验证失败")
        error_type = error.get("type", "")

        friendly_message = _get_friendly_error_message(field, message, error_type)
        formatted_errors.append({
            "field": field,
            "message": friendly_message,
            "type": error_type
        })

    return formatted_errors


def setup_exception_handlers(app: FastAPI):
    """设置全局异常处理器"""

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        """HTTP异常处理器"""
        from app.core.config import settings
        
        if settings.DEBUG:
            error_detail = exc.detail
        else:
            sensitive_keywords = ['token', 'secret', 'password', 'key', 'auth', 'credential']
            detail_lower = str(exc.detail).lower()
            if any(keyword in detail_lower for keyword in sensitive_keywords):
                error_detail = "请求处理失败"
            else:
                error_detail = exc.detail
        
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": error_detail,
                "code": exc.status_code
            }
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """请求验证异常处理器"""
        formatted_errors = _format_validation_errors(exc.errors())
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=ErrorResponse(
                success=False,
                error="请求参数验证失败",
                code=422,
                details=formatted_errors
            ).model_dump()
        )

    @app.exception_handler(ValidationError)
    async def pydantic_validation_handler(request: Request, exc: ValidationError):
        """Pydantic验证异常处理器"""
        formatted_errors = _format_validation_errors(exc.errors())
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=ErrorResponse(
                success=False,
                error="数据验证失败",
                code=422,
                details=formatted_errors
            ).model_dump()
        )

    @app.exception_handler(AuthenticationError)
    async def authentication_error_handler(request: Request, exc: AuthenticationError):
        """认证错误处理器"""
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={
                "success": False,
                "error": str(exc) if str(exc) else "认证失败",
                "code": 401
            },
            headers={"WWW-Authenticate": "Bearer"}
        )

    @app.exception_handler(CSRFError)
    async def csrf_error_handler(request: Request, exc: CSRFError):
        """CSRF 错误处理器"""
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "success": False,
                "error": str(exc) if str(exc) else "CSRF 验证失败",
                "code": 403
            }
        )

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        """值错误处理器"""
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=ErrorResponse(
                success=False,
                error=str(exc),
                code=400
            ).model_dump()
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """全局异常处理器"""
        sanitized_error = sanitize_error_message(f"{type(exc).__name__}: {str(exc)}")
        logger.error(f"未处理的异常: {sanitized_error}", exc_info=True)

        from app.core.config import settings
        if settings.DEBUG:
            error_detail = str(exc)
        else:
            error_detail = "服务器内部错误"
            if isinstance(exc, ValueError):
                error_detail = sanitize_error_message(str(exc))
            elif isinstance(exc, KeyError):
                error_detail = "请求参数错误"
            elif "timeout" in str(type(exc).__name__).lower():
                error_detail = "请求超时，请稍后重试"
            elif "connection" in str(exc).lower():
                error_detail = "服务连接失败，请稍后重试"

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": error_detail,
                "code": 500
            }
        )
