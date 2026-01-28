import asyncio
import os
from dotenv import load_dotenv
from app.database import db, connect_to_mongo
from app.business.auth_business import auth_business

# Load environment variables
load_dotenv()

async def main():
    await connect_to_mongo()
    print("Connected to database")
    
    users = await db.db.users.find({}).to_list(length=100)
    print(f"Found {len(users)} users")
    
    for user in users:
        user_id = str(user.get('_id'))
        print(f"User: {user.get('username', 'Unknown')} ({user_id})")
        
        # Trigger Migration
        print("  Triggering get_llm_configs_list...")
        try:
            resp = await auth_business.get_llm_configs_list(user_id)
            print(f"  Response: success={resp.success}, configs={len(resp.data.get('configs', []))}")
        except Exception as e:
            print(f"  Error triggering migration: {e}")
            
        # Re-fetch to see changes
        updated_user = await db.db.users.find_one({"_id": user.get("_id")})
        print(f"  - llm_config (Legacy): {updated_user.get('llm_config') is not None}")
        print(f"  - llm_configs (New): {updated_user.get('llm_configs')}")
        print(f"  - active_llm_config_id: {updated_user.get('active_llm_config_id')}")
        print("-" * 30)

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    loop.run_until_complete(main())
