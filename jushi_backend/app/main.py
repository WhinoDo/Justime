"""
飞书后端服务主应用
FastAPI应用入口点
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.core.config import settings
from app.api.v1.api import api_router
from app.core.exceptions import setup_exception_handlers

# 加载环境变量
load_dotenv()

def create_app() -> FastAPI:
    """创建FastAPI应用实例"""
    
    app = FastAPI(
        title=settings.PROJECT_NAME,
        description="飞书集成后端服务",
        version=settings.VERSION,
        openapi_url=f"{settings.API_V1_STR}/openapi.json"
    )

    # 设置CORS
    setup_cors_middleware(app)
    
    # 注册API路由
    app.include_router(api_router, prefix=settings.API_V1_STR)
    
    # 设置异常处理器
    setup_exception_handlers(app)
    
    return app

def setup_cors_middleware(app: FastAPI):
    """设置CORS中间件"""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# 创建应用实例
app = create_app()
