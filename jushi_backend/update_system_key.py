import asyncio
import logging
import os
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.services.encryption_service import encryption_service

logger = logging.getLogger(__name__)

async def update_key():
    # ---------------------------------------------------------
    # API Key 从环境变量读取，请勿在代码中硬编码密钥
    # 环境变量:
    #   - DEEPSEEK_API_KEY: DeepSeek API 密钥
    #   - OPENAI_API_KEY: OpenAI API 密钥 (可选)
    # ---------------------------------------------------------
    NEW_DEEPSEEK_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
    NEW_OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "")

    if not NEW_DEEPSEEK_KEY:
        raise ValueError("缺少 DEEPSEEK_API_KEY 环境变量，请设置后再运行")

    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DB_NAME]

    logger.info("正在连接数据库更新系统模型 Keys...")

    # 更新 DeepSeek Chat
    encrypted_ds = encryption_service.encrypt(NEW_DEEPSEEK_KEY)
    result = await db.system_llm_configs.update_one(
        {"model_id": "deepseek-chat"},
        {"$set": {"api_key": encrypted_ds}}
    )
    logger.info("DeepSeek Chat 更新: 匹配 %d 条，修改 %d 条", result.matched_count, result.modified_count)

    # 更新 DeepSeek Reasoner
    result2 = await db.system_llm_configs.update_one(
        {"model_id": "deepseek-reasoner"},
        {"$set": {"api_key": encrypted_ds}}
    )
    logger.info("DeepSeek Reasoner 更新: 匹配 %d 条，修改 %d 条", result2.matched_count, result2.modified_count)

    # 更新 OpenAI GPT-4o
    if NEW_OPENAI_KEY:
        encrypted_oai = encryption_service.encrypt(NEW_OPENAI_KEY)
        result3 = await db.system_llm_configs.update_one(
            {"model_id": "gpt-4o"},
            {"$set": {"api_key": encrypted_oai}}
        )
        logger.info("GPT-4o 更新: 匹配 %d 条，修改 %d 条", result3.matched_count, result3.modified_count)
    else:
        logger.info("跳过 OpenAI Key 更新 (未设置 OPENAI_API_KEY 环境变量)")

    logger.info("更新完成！现在您可以在前端重新尝试对话了。")
    client.close()

if __name__ == "__main__":
    asyncio.run(update_key())
