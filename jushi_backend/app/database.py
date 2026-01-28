"""Database connection utilities.

实现真实的 MongoDB 连接/关闭逻辑。
"""

import logging
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

logger = logging.getLogger(__name__)

class Database:
    client: AsyncIOMotorClient = None
    db = None

db = Database()

async def connect_to_mongo() -> None:
    """应用启动时调用，连接到 MongoDB。"""
    try:
        logger.info(f"正在连接到 MongoDB... URI: {settings.MONGODB_URI.split('@')[-1]}") # 隐藏密码
        db.client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=5000, # 5秒超时
            connectTimeoutMS=5000,
            directConnection=True
        )
        db.db = db.client[settings.MONGODB_DB_NAME]
        # 尝试执行一个简单的操作来验证连接
        await db.client.admin.command('ping')
        logger.info(f"✅ 成功连接到 MongoDB: {settings.MONGODB_DB_NAME}")
    except Exception as e:
        logger.error(f"❌ 无法连接到 MongoDB: {e}")
        # 如果连接失败，我们打印更详细的信息
        import traceback
        logger.error(traceback.format_exc())
        raise e

async def close_mongo_connection() -> None:
    """应用关闭时调用，断开 MongoDB 连接。"""
    if db.client:
        db.client.close()
        logger.info("👋 已断开 MongoDB 连接")
