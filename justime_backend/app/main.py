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

load_dotenv()

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)



def create_app() -> FastAPI:

    app = FastAPI(
        title=settings.PROJECT_NAME,
        description="飞书集成后端服务",
        version=settings.VERSION,
        openapi_url=f"{settings.API_V1_STR}/openapi.json"
    )

    setup_middlewares(app)

    app.include_router(api_router, prefix=settings.API_V1_STR)

    setup_exception_handlers(app)

    @app.on_event("startup")
    async def startup_event():
        try:
            await connect_to_mongo()
            logger.info("数据库连接成功")
        except Exception as e:
            logger.warning(f'数据库连接失败，某些功能可能不可用: {e}')
        
        try:
            from app.core.redis_client import RedisClient
            await RedisClient.init()
            if RedisClient.is_enabled():
                logger.info("Redis 缓存连接成功")
        except Exception as e:
            logger.warning(f'Redis 连接失败，缓存功能不可用: {e}')

    @app.on_event("shutdown")
    async def shutdown_event():
        await close_mongo_connection()
        logger.info("数据库连接已关闭")
        
        try:
            from app.core.redis_client import RedisClient
            await RedisClient.close()
            logger.info("Redis 连接已关闭")
        except Exception as e:
            logger.warning(f'Redis 关闭异常: {e}')

        try:
            from app.services.llm_service import close_shared_client
            await close_shared_client()
            logger.info("httpx 共享连接池已关闭")
        except Exception as e:
            logger.warning(f'httpx 共享连接池关闭异常: {e}')

    return app


app = create_app()
