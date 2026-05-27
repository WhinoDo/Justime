import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.services.encryption_service import encryption_service

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["justime-agent"]
    user = await db.users.find_one({})
    if not user:
        print("No user")
        return
    configs = user.get("llm_configs", [])
    for c in configs:
        encrypted = c.get('api_key')
        if encrypted:
            print(f"Decrypted Key: {encryption_service.decrypt(encrypted)}")

if __name__ == "__main__":
    asyncio.run(main())
