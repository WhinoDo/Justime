import asyncio
import sys
import os

# Add parent directory to path to allow importing app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app.database import db, connect_to_mongo, close_mongo_connection
from app.services.user_service import UserService
from app.core.config import settings

async def init_admin():
    print(f"Connecting to MongoDB at {settings.MONGODB_URI}...")
    try:
        await connect_to_mongo()
        print("Connected to MongoDB.")
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        return

    # Check if admin exists
    admin_email = "admin@example.com"
    try:
        existing_admin = await UserService.get_user_by_email(admin_email)
        
        if existing_admin:
            print("Admin user already exists.")
        else:
            print("Creating admin user...")
            admin_data = {
                "username": "admin",
                "email": admin_email,
                "password": "admin",  # Default password
                "displayName": "System Admin",
                "role": "admin",
                "status": "active"
            }
            await UserService.create_user(admin_data)
            print("----------------------------------------")
            print("✅ Admin user created successfully!")
            print(f"Username: admin")
            print(f"Password: admin")
            print("----------------------------------------")
            
    except Exception as e:
        print(f"Error creating admin user: {e}")
    finally:
        await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(init_admin())
