import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["jushi-agent"]
    user = await db.users.find_one({})
    if not user:
        print("No user")
        return
    print(f"User: {user['_id']}")
    configs = user.get("llm_configs", [])
    for c in configs:
        print(f"Config ID: {c.get('id')}, name: {c.get('name')}, api_key: {c.get('api_key')}")

if __name__ == "__main__":
    asyncio.run(main())
