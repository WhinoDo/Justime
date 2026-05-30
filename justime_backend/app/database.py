"""Database connection utilities.

实现真实的 MongoDB 连接/关闭逻辑。
"""

import logging
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.core.log_sanitizer import mask_connection_string

logger = logging.getLogger(__name__)

class Database:
    client: AsyncIOMotorClient = None
    db = None

db = Database()

async def connect_to_mongo() -> None:
    """应用启动时调用，连接到 MongoDB。"""
    try:
        logger.info(f"正在连接到 MongoDB... URI: {mask_connection_string(settings.MONGODB_URI)}")
        
        client_options = {
            "maxPoolSize": settings.MONGODB_MAX_POOL_SIZE,
            "minPoolSize": settings.MONGODB_MIN_POOL_SIZE,
            "maxIdleTimeMS": settings.MONGODB_MAX_IDLE_TIME_MS,
            "connectTimeoutMS": settings.MONGODB_CONNECT_TIMEOUT_MS,
            "serverSelectionTimeoutMS": settings.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
            "socketTimeoutMS": settings.MONGODB_SOCKET_TIMEOUT_MS,
            "retryWrites": True,
            "retryReads": True,
        }
        
        valid_read_preferences = {
            "primary", "primaryPreferred", "secondary", "secondaryPreferred", "nearest"
        }
        read_pref = settings.MONGODB_READ_PREFERENCE
        if read_pref in valid_read_preferences:
            client_options["readPreference"] = read_pref
        
        db.client = AsyncIOMotorClient(settings.MONGODB_URI, **client_options)
        db.db = db.client[settings.MONGODB_DB_NAME]
        
        await db.client.admin.command('ping')
        logger.info(f"✅ 成功连接到 MongoDB: {settings.MONGODB_DB_NAME} (连接池: {settings.MONGODB_MIN_POOL_SIZE}-{settings.MONGODB_MAX_POOL_SIZE})")

        await _create_indexes()
    except Exception as e:
        logger.error(f"❌ 无法连接到 MongoDB: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise e


async def _create_indexes() -> None:
    """创建数据库索引以优化查询性能"""
    try:
        # 用户集合索引
        await db.db.users.create_index([("email", 1)], unique=True)
        await db.db.users.create_index([("username", 1)], unique=True, sparse=True)
        logger.info("✅ 用户索引创建完成")

        # 聊天会话索引
        await db.db.chat_sessions.create_index([("userId", 1), ("updatedAt", -1)])
        logger.info("✅ 聊天会话索引创建完成")

        # 聊天消息索引
        await db.db.chat_messages.create_index([("sessionId", 1), ("timestamp", -1)])
        await db.db.chat_messages.create_index([("userId", 1), ("timestamp", -1)])
        logger.info("✅ 聊天消息索引创建完成")

        # 日历事件索引
        await db.db.calendar_events.create_index([("userId", 1), ("start", 1)])
        await db.db.calendar_events.create_index([("userId", 1), ("status", 1)])
        logger.info("✅ 日历事件索引创建完成")

        # 工作文档索引
        await db.db.work_documents.create_index([("userId", 1), ("eventId", 1)], unique=True)
        await db.db.work_documents.create_index([("eventId", 1)], unique=True)
        logger.info("✅ 工作文档索引创建完成")

        # Token使用记录索引
        await db.db.token_usage.create_index([("userId", 1), ("date", -1)])
        await db.db.token_usage.create_index([("sessionId", 1)])
        logger.info("✅ Token使用记录索引创建完成")

        # 学习科目 Notebook 映射索引
        await db.db.study_notebooks.create_index([("user_id", 1), ("subject", 1)], unique=True)
        logger.info("✅ 学习科目Notebook映射索引创建完成")

        # 考研学习相关索引
        await db.db.study_profiles.create_index([("userId", 1)], unique=True)
        await db.db.study_plans.create_index([("userId", 1), ("createdAt", -1)])
        await db.db.study_tasks.create_index([("userId", 1), ("scheduledDate", 1)])
        await db.db.study_tasks.create_index([("userId", 1), ("status", 1)])
        await db.db.study_progress.create_index([("userId", 1), ("date", -1)])
        await db.db.review_schedules.create_index([("userId", 1), ("nextReview", 1)])
        await db.db.review_schedules.create_index([("userId", 1), "subject"])
        logger.info("✅ 考研学习相关索引创建完成")

        await db.db.exam_papers.create_index([("userId", 1), ("subject", 1), ("year", -1)])
        await db.db.exam_trends.create_index([("userId", 1), ("subject", 1)])
        await db.db.practice_questions.create_index([("userId", 1), ("subject", 1)])
        await db.db.study_reports.create_index([("userId", 1), ("reportType", 1), ("generatedAt", -1)])
        logger.info("✅ 真题解析与报告相关索引创建完成")

    except Exception as e:
        logger.warning(f"⚠️ 创建索引时出现警告: {e}")

async def close_mongo_connection() -> None:
    """应用关闭时调用，断开 MongoDB 连接。"""
    if db.client:
        db.client.close()
        logger.info("👋 已断开 MongoDB 连接")
