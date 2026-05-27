import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.services.encryption_service import encryption_service
from app.services.user_service import UserService
from bson import ObjectId
import app.db.mongodb as db

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db.db = client["justime-agent"]
    user = await db.db.users.find_one({})
    user_id = str(user["_id"])
    config_id = user["llm_configs"][0]["id"]
    print(f"User ID: {user_id}, Config ID: {config_id}")
    
    # 模拟 Payload
    payload = {
        "name": "测试名称",
        "baseUrl": "https://api.deepseek.com",
        "modelId": "deepseek",
        "apiKey": "sk-1234567890"
    }
    
    from app.business.auth_business import AuthBusiness
    resp = await AuthBusiness.update_llm_config(user_id, config_id, payload)
    print(f"Update response: {resp.dict()}")

    # 查验
    user = await db.db.users.find_one({"_id": ObjectId(user_id)})
    for c in user["llm_configs"]:
        if c["id"] == config_id:
            print(f"New Key: {encryption_service.decrypt(c['api_key'])}")

if __name__ == "__main__":
    asyncio.run(main())
