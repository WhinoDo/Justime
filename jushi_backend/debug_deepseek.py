import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
import httpx
import sys
import os

from app.core.config import settings
from app.services.encryption_service import encryption_service

logger = logging.getLogger(__name__)

async def test():
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DB_NAME]
    
    # Get system config
    configs = await db.system_llm_configs.find({}).to_list(10)
    logger.info("Found system configs: %d", len(configs))
    if not configs:
        logger.warning("No configs found in system_llm_configs!")
        return

    for target_config in configs:
        base_url = target_config.get("base_url")
        encrypted_key = target_config.get("api_key", "")
        plain_key = encryption_service.decrypt(encrypted_key) if encrypted_key else ""

        logger.info("Testing Config Name: %s", target_config.get('name'))
        logger.info("Base URL: %s", base_url)
        logger.info("Key parsed length: %d", len(plain_key))

        if not base_url or not plain_key:
             logger.warning("Missing url or key.")
             continue

        testing_url = base_url
        if not testing_url.endswith("/v1"):
             testing_url = f"{testing_url.rstrip('/')}/v1"
        testing_url = f"{testing_url}/models"
        logger.info("Hitting %s...", testing_url)

        try:
             async with httpx.AsyncClient(timeout=10.0) as http_client:
                 response = await http_client.get(
                     testing_url,
                     headers={
                         "Authorization": f"Bearer {plain_key}",
                         "Content-Type": "application/json"
                     }
                 )
                 logger.info("Status Code: %d", response.status_code)
                 data = response.json()
                 logger.info("Response body: %s", data)
                 models = data.get("data", [])
                 model_ids = [m.get("id") for m in models if isinstance(m, dict) and m.get("id")]
                 logger.info("Parsed models: %s", model_ids)

                 if not model_ids and "deepseek" in base_url.lower():
                     logger.info("Fallback to ['deepseek-chat', 'deepseek-reasoner']")
        except Exception as e:
             logger.error("Exception: %s", e)

if __name__ == "__main__":
    asyncio.run(test())
