"""
数据库索引优化
为常用查询字段创建索引，提升查询性能
"""

import logging
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

logger = logging.getLogger(__name__)


# 索引配置
INDEX_CONFIG = {
    "chat_sessions": [
        # 用户会话查询
        {"keys": [("userId", 1), ("updatedAt", -1)], "name": "idx_user_updated"},
        # 会话ID查询
        {"keys": [("_id", 1)], "name": "idx_session_id"},
    ],
    "chat_messages": [
        # 会话消息查询
        {"keys": [("sessionId", 1), ("timestamp", -1)], "name": "idx_session_timestamp"},
        # 用户消息查询
        {"keys": [("userId", 1), ("timestamp", -1)], "name": "idx_user_timestamp"},
        # 消息ID查询
        {"keys": [("_id", 1)], "name": "idx_message_id"},
    ],
    "users": [
        # 用户查询
        {"keys": [("email", 1)], "name": "idx_email", "unique": True},
        {"keys": [("username", 1)], "name": "idx_username", "unique": True, "sparse": True},
        {"keys": [("_id", 1)], "name": "idx_user_id"},
    ],
    "calendar_events": [
        # 日程查询
        {"keys": [("userId", 1), ("startTime", 1)], "name": "idx_user_starttime"},
        {"keys": [("userId", 1), ("endTime", 1)], "name": "idx_user_endtime"},
        {"keys": [("_id", 1)], "name": "idx_event_id"},
    ],
    "knowledge_documents": [
        # 知识库文档查询
        {"keys": [("userId", 1), ("createdAt", -1)], "name": "idx_user_created"},
        {"keys": [("userId", 1), ("status", 1)], "name": "idx_user_status"},
        {"keys": [("_id", 1)], "name": "idx_doc_id"},
    ],
    "study_tasks": [
        {"keys": [("userId", 1), ("scheduledDate", 1)], "name": "idx_user_scheduled"},
        {"keys": [("userId", 1), ("status", 1)], "name": "idx_user_status"},
        {"keys": [("planId", 1)], "name": "idx_plan"},
    ],
    "study_progress": [
        {"keys": [("userId", 1), ("date", 1)], "name": "idx_user_date"},
        {"keys": [("userId", 1), ("subject", 1)], "name": "idx_user_subject"},
    ],
    "review_schedule": [
        {"keys": [("userId", 1), ("nextReview", 1)], "name": "idx_user_next_review"},
    ],
    "study_materials": [
        {"keys": [("userId", 1), ("subject", 1)], "name": "idx_user_subject"},
    ],
}


async def create_indexes(db):
    """
    创建所有索引
    """
    created_count = 0
    skipped_count = 0

    for collection_name, indexes in INDEX_CONFIG.items():
        collection = db[collection_name]

        for index_config in indexes:
            try:
                keys = index_config["keys"]
                name = index_config["name"]
                options = {
                    "name": name,
                }

                if "unique" in index_config:
                    options["unique"] = index_config["unique"]
                if "sparse" in index_config:
                    options["sparse"] = index_config["sparse"]

                # 检查索引是否已存在
                existing_indexes = await collection.index_information()
                if name in existing_indexes:
                    logger.debug(f"索引已存在: {collection_name}.{name}")
                    skipped_count += 1
                    continue

                # 创建索引
                await collection.create_index(keys, **options)
                logger.info(f"创建索引: {collection_name}.{name}")
                created_count += 1

            except Exception as e:
                logger.error(f"创建索引失败 {collection_name}.{name}: {e}")

    logger.info(f"索引创建完成: 新建 {created_count} 个, 跳过 {skipped_count} 个")
    return created_count, skipped_count


async def ensure_indexes():
    """
    确保所有必要的索引都存在
    可在应用启动时调用
    """
    try:
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
        
        client = AsyncIOMotorClient(settings.MONGODB_URI, **client_options)
        db = client[settings.MONGODB_DB_NAME]

        await create_indexes(db)

        client.close()
    except Exception as e:
        logger.error(f"索引初始化失败: {e}")


async def analyze_query_performance(db):
    """
    分析查询性能
    返回慢查询建议
    """
    suggestions = []

    # 检查各集合的统计信息
    for collection_name in INDEX_CONFIG.keys():
        try:
            collection = db[collection_name]
            stats = await collection.command("collstats", scale=1024 * 1024)

            suggestions.append({
                "collection": collection_name,
                "count": stats.get("count", 0),
                "size_mb": stats.get("size", 0),
                "index_size_mb": stats.get("totalIndexSize", 0),
            })
        except Exception as e:
            logger.error(f"获取集合统计失败 {collection_name}: {e}")

    return suggestions
