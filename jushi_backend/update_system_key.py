import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.services.encryption_service import encryption_service

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
    
    print("正在连接数据库更新系统模型 Keys...")

    # 更新 DeepSeek Chat
    encrypted_ds = encryption_service.encrypt(NEW_DEEPSEEK_KEY)
    result = await db.system_llm_configs.update_one(
        {"model_id": "deepseek-chat"},
        {"$set": {"api_key": encrypted_ds}}
    )
    print(f"DeepSeek Chat 更新: 匹配 {result.matched_count} 条，修改 {result.modified_count} 条")

    # 更新 DeepSeek Reasoner
    result2 = await db.system_llm_configs.update_one(
        {"model_id": "deepseek-reasoner"},
        {"$set": {"api_key": encrypted_ds}}
    )
    print(f"DeepSeek Reasoner 更新: 匹配 {result2.matched_count} 条，修改 {result2.modified_count} 条")
    
    # 更新 OpenAI GPT-4o
    if NEW_OPENAI_KEY:
        encrypted_oai = encryption_service.encrypt(NEW_OPENAI_KEY)
        result3 = await db.system_llm_configs.update_one(
            {"model_id": "gpt-4o"},
            {"$set": {"api_key": encrypted_oai}}
        )
        print(f"GPT-4o 更新: 匹配 {result3.matched_count} 条，修改 {result3.modified_count} 条")
    else:
        print("⏭️ 跳过 OpenAI Key 更新 (未设置 OPENAI_API_KEY 环境变量)")

    print("\n✅ 更新完成！现在您可以在前端重新尝试对话了。")
    client.close()

if __name__ == "__main__":
    asyncio.run(update_key())
