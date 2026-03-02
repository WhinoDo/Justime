from app.database import connect_to_mongo, close_mongo_connection, db
import asyncio

async def main():
    await connect_to_mongo()
    print("Database connected")
    user = await db.db.users.find_one({"username": "zhuyuxuan"})
    print("User found:")
    for k, v in user.items():
        print(f"  {k}: {v}")
    
    user_email = await db.db.users.find_one({"email": "3170500968@qq.com"})
    print("\nUser by email found:")
    for k, v in user_email.items():
        print(f"  {k}: {v}")
    
    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(main())
