from datetime import datetime
from typing import Optional, Dict, Any
from passlib.context import CryptContext
from app.database import db
from bson import ObjectId

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserService:
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def get_password_hash(password: str) -> str:
        return pwd_context.hash(password)

    @staticmethod
    async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
        if db.db is None:
            return None
        return await db.db.users.find_one({"email": email})

    @staticmethod
    async def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
        if db.db is None:
            return None
        return await db.db.users.find_one({"username": username})

    @staticmethod
    async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
        if db.db is None:
            return None
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            return await db.db.users.find_one({"_id": oid})
        except:
            return None

    @staticmethod
    async def create_user(user_data: Dict[str, Any]) -> Dict[str, Any]:
        if db.db is None:
            raise Exception("Database not connected")
            
        # Add timestamps and default fields
        user_data["created_at"] = datetime.utcnow()
        user_data["last_login"] = datetime.utcnow()
        if "role" not in user_data:
            user_data["role"] = "user"
        if "status" not in user_data:
            user_data["status"] = "active"
            
        # Hash password if present
        if "password" in user_data:
            user_data["hashed_password"] = UserService.get_password_hash(user_data["password"])
            del user_data["password"]

        result = await db.db.users.insert_one(user_data)
        user_data["_id"] = result.inserted_id
        return user_data

    @staticmethod
    async def authenticate_user(identifier: str, password: str) -> Optional[Dict[str, Any]]:
        print(f"🔐 Authenticating user: {identifier}")
        
        if db.db is None:
            print("❌ Database not connected")
            return None
            
        # Check by email or username
        user = await UserService.get_user_by_email(identifier)
        if not user:
            print(f"  User not found by email, trying username...")
            user = await UserService.get_user_by_username(identifier)
            
        if not user:
            print(f"❌ User not found: {identifier}")
            return None
        
        print(f"  Found user: {user.get('email', 'N/A')}, role: {user.get('role', 'N/A')}")
            
        # 优先检查 hashed_password
        hashed_password = user.get("hashed_password")
        if hashed_password:
            print(f"  Verifying hashed password...")
            try:
                if UserService.verify_password(password, hashed_password):
                    print(f"✅ Password verified successfully")
                    return user
                else:
                    print(f"❌ Password mismatch")
                    return None
            except Exception as e:
                print(f"❌ Password verification error: {type(e).__name__}: {e}")
                return None
        else:
            print(f"⚠️ No hashed_password field found for user")
        
        # 兼容旧数据或直接存储的明文密码（仅作为修复手段）
        old_password = user.get("password")
        if old_password:
            print(f"  Checking plain text password (legacy)...")
            if old_password == password:
                # 如果匹配，建议并执行自动升级到哈希密码
                print(f"⚠️ Plain text password matched. Upgrading to hash...")
                new_hashed = UserService.get_password_hash(password)
                await db.db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"hashed_password": new_hashed}, "$unset": {"password": ""}}
                )
                print(f"✅ Password upgraded to hash")
                return user
            else:
                print(f"❌ Plain text password mismatch")
        else:
            print(f"❌ No password field found at all")
            
        return None

    @staticmethod
    async def get_all_users() -> list[Dict[str, Any]]:
        if db.db is None:
            return []
        cursor = db.db.users.find({})
        users = await cursor.to_list(length=1000)
        return users

    @staticmethod
    async def delete_user(user_id: str) -> bool:
        if db.db is None:
            return False
        try:
            # Handle both string ID and ObjectId
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            result = await db.db.users.delete_one({"_id": oid})
            return result.deleted_count > 0
        except:
            return False

    @staticmethod
    async def update_user_llm_config(user_id: str, config: Dict[str, Any]) -> bool:
        """更新用户的 LLM 配置"""
        if db.db is None:
            return False
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            result = await db.db.users.update_one(
                {"_id": oid},
                {"$set": {"llm_config": config}}
            )
            return result.modified_count > 0 or result.matched_count > 0
        except Exception as e:
            print(f"Error updating user config: {e}")
            return False

    @staticmethod
    async def get_user_llm_config(user_id: str) -> Optional[Dict[str, Any]]:
        """获取用户的 LLM 配置"""
        if db.db is None:
            return None
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            user = await db.db.users.find_one({"_id": oid}, {"llm_config": 1})
            return user.get("llm_config") if user else None
        except Exception:
            return None


    @staticmethod
    async def get_user_llm_configs_data(user_id: str) -> Dict[str, Any]:
        """获取用户的所有 LLM 配置数据 (包含列表和当前激活ID)"""
        if db.db is None:
            return {"configs": [], "active_id": None}
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            user = await db.db.users.find_one({"_id": oid}, {"llm_configs": 1, "active_llm_config_id": 1, "llm_config": 1})
            
            if not user:
                return {"configs": [], "active_id": None}
                
            # 兼容旧字段 llm_config
            legacy_config = user.get("llm_config")
            configs = user.get("llm_configs", [])
            active_id = user.get("active_llm_config_id")
            
            return {
                "configs": configs, 
                "active_id": active_id,
                "legacy_config": legacy_config
            }
        except Exception:
            return {"configs": [], "active_id": None}

    @staticmethod
    async def add_user_llm_config(user_id: str, config_item: Dict[str, Any]) -> bool:
        """添加新的 LLM 配置"""
        if db.db is None: return False
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            await db.db.users.update_one(
                {"_id": oid},
                {"$push": {"llm_configs": config_item}}
            )
            return True
        except Exception: return False

    @staticmethod
    async def update_user_llm_config_item(user_id: str, config_id: str, update_data: Dict[str, Any]) -> bool:
        """更新列表中的特定配置"""
        if db.db is None: return False
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            # Mongo update inside array using identifier 'id'
            # Construct set dict
            update_fields = {f"llm_configs.$.{k}": v for k, v in update_data.items()}
            
            result = await db.db.users.update_one(
                {"_id": oid, "llm_configs.id": config_id},
                {"$set": update_fields}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Update error: {e}")
            return False

    @staticmethod
    async def delete_user_llm_config(user_id: str, config_id: str) -> bool:
        """删除列表中的特定配置"""
        if db.db is None: return False
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            await db.db.users.update_one(
                {"_id": oid},
                {"$pull": {"llm_configs": {"id": config_id}}}
            )
            return True
        except Exception: return False

    @staticmethod
    async def set_active_llm_config(user_id: str, config_id: str) -> bool:
        """设置当前激活的配置 ID"""
        if db.db is None: return False
        try:
            oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            await db.db.users.update_one(
                {"_id": oid},
                {"$set": {"active_llm_config_id": config_id}}
            )
            return True
        except Exception: return False
