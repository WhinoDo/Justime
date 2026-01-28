"""
管理后台业务逻辑
"""

from datetime import datetime
from typing import List
from app.services.user_service import UserService
from app.database import db
from app.models.admin import AdminUser, SystemStats

class AdminBusiness:
    @staticmethod
    async def get_all_users() -> List[AdminUser]:
        users = await UserService.get_all_users()
        return [
            AdminUser(
                id=str(u["_id"]),
                username=u.get("username", u["email"].split("@")[0]),
                email=u["email"],
                role=u.get("role", "user"),
                status=u.get("status", "active"),
                created_at=u.get("created_at", datetime.now()).isoformat(),
                last_login=u.get("last_login", datetime.now()).isoformat()
            ) for u in users
        ]

    @staticmethod
    async def delete_user(user_id: str) -> bool:
        return await UserService.delete_user(user_id)

    @staticmethod
    async def get_system_stats() -> SystemStats:
        if db.db is None:
            return SystemStats(total_users=0, active_users=0, total_tokens=0, total_conversations=0, version="1.0.0")
            
        user_count = await db.db.users.count_documents({})
        return SystemStats(
            total_users=user_count,
            active_users=user_count,
            total_tokens=1500000,
            total_conversations=5600,
            version="1.0.0"
        )

admin_business = AdminBusiness()
