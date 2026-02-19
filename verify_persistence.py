import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime

# Configuration
MONGODB_URI = "mongodb://localhost:27017/jushi-agent"
DB_NAME = "jushi-agent"

# Sample Task Decomposition
SAMPLE_DECOMPOSITION = {
    "type": "task_decomposition_suggestion",
    "market_analysis": "Test Analysis",
    "project_name": "Test Persistence Project",
    "start_date": "2023-10-27",
    "total_days": 3,
    "confidence_score": 0.9,
    "tasks": [
        {
            "id": "t1",
            "title": "Verify Backend Persistence",
            "description": "Check if data is saved to text",
            "duration": "2h",
            "duration_hours": 2,
            "order": 1,
            "resources": []
        },
        {
            "id": "t2",
            "title": "Verify Frontend Rendering",
            "description": "Reload page and check UI",
            "duration": "1h",
            "duration_hours": 1,
            "order": 2,
            "resources": []
        }
    ]
}

async def main():
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DB_NAME]
    
    # 1. Find the most recent session
    session = await db.chat_sessions.find_one(sort=[("updatedAt", -1)])
    
    if not session:
        print("No sessions found. Please start a conversation first.")
        return

    session_id = str(session["_id"])
    print(f"Found recent session: {session_id} - {session.get('title')}")

    # 2. Insert a test message
    message_doc = {
        "sessionId": session_id,
        "role": "assistant",
        "content": "This is a test message with persisted task decomposition. If you see the task plan below, the frontend persistence logic is working!",
        "timestamp": datetime.now(),
        "taskDecomposition": SAMPLE_DECOMPOSITION
    }
    
    result = await db.chat_messages.insert_one(message_doc)
    print(f"Inserted test message: {result.inserted_id}")
    print("Please refresh your chat page to verify.")

if __name__ == "__main__":
    asyncio.run(main())
