"""
飞书后端服务主应用
FastAPI应用入口点
"""

import logging
from fastapi import FastAPI
from dotenv import load_dotenv

from app.core.config import settings
from app.api.v1.api import api_router
from app.core.exceptions import setup_exception_handlers
from app.core.middleware import setup_middlewares
from app.database import connect_to_mongo, close_mongo_connection

# 加载环境变量
load_dotenv()

# 配置日志
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)



def create_app() -> FastAPI:
    """创建FastAPI应用实例"""

    app = FastAPI(
        title=settings.PROJECT_NAME,
        description="飞书集成后端服务",
        version=settings.VERSION,
        openapi_url=f"{settings.API_V1_STR}/openapi.json"
    )

    setup_middlewares(app)

    # 注册API路由
    app.include_router(api_router, prefix=settings.API_V1_STR)

    # 设置异常处理器
    setup_exception_handlers(app)

    # 添加启动和关闭事件
    @app.on_event("startup")
    async def startup_event():
        """应用启动时连接数据库"""
        try:
            await connect_to_mongo()
            logger.info("数据库连接成功")
        except Exception as e:
            logger.warning(f'数据库连接失败，某些功能可能不可用: {e}')

    @app.on_event("shutdown")
    async def shutdown_event():
        """应用关闭时断开数据库连接"""
        await close_mongo_connection()
        logger.info("数据库连接已关闭")

    return app


# 创建应用实例
app = create_app()
