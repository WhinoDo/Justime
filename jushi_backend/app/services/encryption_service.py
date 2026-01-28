"""
加密服务层
负责数据的加密和解密，用于保护敏感字段（如 API Key）
"""

import base64
import hashlib
from cryptography.fernet import Fernet
from app.core.config import settings

class EncryptionService:
    def __init__(self):
        # 使用 JWT_SECRET 派生一个稳定的加密密钥
        # Fernet 需要 32 字节的 url-safe base64 key
        # 我们对 JWT_SECRET 进行 SHA256 哈希 (32字节)，然后 base64 编码
        secret = settings.JWT_SECRET or "default-insecure-secret-please-change"
        key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
        self.fernet = Fernet(key)

    def encrypt(self, data: str) -> str:
        """加密字符串"""
        if not data:
            return ""
        return self.fernet.encrypt(data.encode()).decode()

    def decrypt(self, token: str) -> str:
        """解密字符串"""
        if not token:
            return ""
        try:
            return self.fernet.decrypt(token.encode()).decode()
        except Exception:
            # 如果解密失败（例如密钥变更或数据损坏），返回空或原始值
            # 为了安全起见，通常返回空或抛出异常
            print("⚠️ 解密失败，可能是密钥变更或数据损坏")
            return ""

# 全局加密服务实例
encryption_service = EncryptionService()
