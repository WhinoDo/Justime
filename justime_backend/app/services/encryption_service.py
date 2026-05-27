"""
加密服务层
负责数据的加密和解密，用于保护敏感字段（如 API Key）
"""

import base64
import hashlib
import logging
from cryptography.fernet import Fernet
from app.core.config import settings

logger = logging.getLogger(__name__)


class EncryptionService:
    def __init__(self):
        # 使用独立的 ENCRYPTION_SECRET 派生稳定加密密钥
        # Fernet 需要 32 字节的 url-safe base64 key
        secret = settings.ENCRYPTION_SECRET
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
        except Exception as e:
            # 如果解密失败（例如密钥变更或数据损坏），返回空或原始值
            # 为了安全起见，通常返回空或抛出异常
            logger.warning(f"Decryption failed: {type(e).__name__}: {e}")
            return ""

# 全局加密服务实例
encryption_service = EncryptionService()
