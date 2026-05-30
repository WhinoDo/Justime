"""
飞书 Webhook 端点
接收飞书事件回调 + URL 验证
"""

import json
import logging

from fastapi import APIRouter, Request, HTTPException

from app.core.config import settings
from app.services.feishu_crypto import verify_feishu_signature, decrypt_feishu_data
from app.services.feishu_service import feishu_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/webhook")
async def feishu_webhook(request: Request):
    """接收飞书事件回调"""
    body = await request.body()
    body_str = body.decode("utf-8")

    try:
        payload = json.loads(body_str)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    if payload.get("type") == "url_verification":
        challenge = payload.get("challenge", "")
        token = payload.get("token", "")
        if token != settings.FEISHU_VERIFICATION_TOKEN:
            logger.warning("URL verification token mismatch")
            raise HTTPException(status_code=403, detail="Token mismatch")
        return {"challenge": challenge}

    encrypt_key = settings.FEISHU_ENCRYPT_KEY
    if encrypt_key:
        encrypt_data = payload.get("encrypt", "")
        if not encrypt_data:
            logger.warning("Missing encrypt field in encrypted mode")
            raise HTTPException(status_code=400, detail="Missing encrypt field")

        timestamp = request.headers.get("X-Lark-Request-Timestamp", "")
        nonce = request.headers.get("X-Lark-Request-Nonce", "")
        signature = request.headers.get("X-Lark-Signature", "")

        if not verify_feishu_signature(timestamp, nonce, body_str, signature, encrypt_key):
            logger.warning("Feishu webhook signature verification failed")
            raise HTTPException(status_code=403, detail="Signature verification failed")

        decrypted = decrypt_feishu_data(encrypt_data, encrypt_key)
        if not decrypted:
            logger.error("Failed to decrypt feishu event data")
            raise HTTPException(status_code=400, detail="Decryption failed")
        payload = decrypted
    else:
        token = payload.get("token", "")
        if token and token != settings.FEISHU_VERIFICATION_TOKEN:
            logger.warning("Feishu webhook verification token mismatch")
            raise HTTPException(status_code=403, detail="Token mismatch")

    app_id = payload.get("app_id", "") or payload.get("header", {}).get("app_id", "")
    if app_id and app_id != settings.FEISHU_APP_ID:
        logger.warning("Feishu webhook app_id mismatch: %s", app_id)
        raise HTTPException(status_code=403, detail="App ID mismatch")

    event = payload.get("event", {})
    event_type = payload.get("type", "") or payload.get("header", {}).get("event_type", "")

    if event_type == "im.message.receive_v1" or event.get("type") == "message":
        import asyncio
        asyncio.create_task(_handle_message_event_safe(event))
    elif event_type == "calendar.event.changed_v1" or "calendar" in event_type:
        import asyncio
        asyncio.create_task(_handle_calendar_event_safe(event))
    else:
        logger.info("Unhandled feishu event type: %s", event_type)

    return {}


@router.get("/webhook")
async def feishu_webhook_verify(request: Request):
    """飞书事件订阅验证（首次配置时飞书会发 GET 请求验证）"""
    challenge = request.query_params.get("challenge", "")
    token = request.query_params.get("token", "")
    if token and token != settings.FEISHU_VERIFICATION_TOKEN:
        raise HTTPException(status_code=403, detail="Token mismatch")
    return {"challenge": challenge}


async def _handle_message_event_safe(event: dict):
    try:
        await feishu_service.handle_message_event(event)
    except Exception as e:
        logger.error("handle_message_event error: %s", e, exc_info=True)


async def _handle_calendar_event_safe(event: dict):
    try:
        await feishu_service.handle_calendar_event(event)
    except Exception as e:
        logger.error("handle_calendar_event error: %s", e, exc_info=True)
