"""
飞书事件加密/解密与签名验证
AES-CBC (PKCS7) + SHA256 签名
"""

import base64
import hashlib
import logging
import struct
from typing import Optional

from Crypto.Cipher import AES

logger = logging.getLogger(__name__)


def verify_feishu_signature(
    timestamp: str,
    nonce: str,
    body: str,
    signature: str,
    encrypt_key: str,
) -> bool:
    """验证飞书请求签名"""
    if not encrypt_key or not signature:
        return False
    content = f"{timestamp}{nonce}{encrypt_key}{body}"
    expected = hashlib.sha256(content.encode()).hexdigest()
    import hmac as _hmac
    return _hmac.compare_digest(expected, signature)


def decrypt_feishu_data(encrypt_data: str, encrypt_key: str) -> Optional[dict]:
    """解密飞书 AES-CBC 加密数据"""
    if not encrypt_key or not encrypt_data:
        return None

    try:
        key = encrypt_key.encode("utf-8")
        key = hashlib.sha256(key).digest()[:32]

        raw = base64.b64decode(encrypt_data)

        cipher = AES.new(key, AES.MODE_CBC, iv=key[:16])
        decrypted = cipher.decrypt(raw)

        pad_len = decrypted[-1]
        if pad_len < 1 or pad_len > AES.block_size:
            logger.error("Invalid PKCS7 padding length: %d", pad_len)
            return None
        decrypted = decrypted[:-pad_len]

        if len(decrypted) < 20:
            logger.error("Decrypted data too short")
            return None

        random_bytes = decrypted[:16]
        msg_len = struct.unpack("!I", decrypted[16:20])[0]
        msg_bytes = decrypted[20 : 20 + msg_len]

        result = msg_bytes.decode("utf-8")

        import json
        return json.loads(result)
    except Exception as e:
        logger.error("decrypt_feishu_data failed: %s", e)
        return None
