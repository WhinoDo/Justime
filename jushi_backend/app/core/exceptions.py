"""
全局异常处理
"""

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging

logger = logging.getLogger(__name__)

def setup_exception_handlers(app: FastAPI):
    """设置全局异常处理器"""
    
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        """HTTP异常处理器"""
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": exc.detail,
                "code": exc.status_code
            }
        )
    
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """请求验证异常处理器"""
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error": "请求参数验证失败",
                "details": exc.errors(),
                "code": 422
            }
        )
    
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """全局异常处理器"""
        logger.error(f"未处理的异常: {str(exc)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "服务器内部错误",
                "code": 500
            }
        )
