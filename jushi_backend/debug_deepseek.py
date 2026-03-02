import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import httpx
import sys
import os

from app.core.config import settings
from app.services.encryption_service import encryption_service

async def test():
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DB_NAME]
    
    # Get system config
    configs = await db.system_llm_configs.find({}).to_list(10)
    print("Found system configs:", len(configs))
    if not configs:
        print("No configs found in system_llm_configs!")
        return 
        
    for target_config in configs:
        base_url = target_config.get("base_url")
        encrypted_key = target_config.get("api_key", "")
        plain_key = encryption_service.decrypt(encrypted_key) if encrypted_key else ""
        
        print(f"Testing Config Name: {target_config.get('name')}")
        print(f"Base URL: {base_url}")
        print(f"Key parsed length: {len(plain_key)}")

        if not base_url or not plain_key:
             print("Missing url or key.")
             continue
             
        testing_url = base_url
        if not testing_url.endswith("/v1"):
             testing_url = f"{testing_url.rstrip('/')}/v1"
        testing_url = f"{testing_url}/models"
        print(f"Hitting {testing_url}...")
        
        try:
             async with httpx.AsyncClient(timeout=10.0) as http_client:
                 response = await http_client.get(
                     testing_url,
                     headers={
                         "Authorization": f"Bearer {plain_key}",
                         "Content-Type": "application/json"
                     }
                 )
                 print(f"Status Code: {response.status_code}")
                 data = response.json()
                 print("Response body:", data)
                 models = data.get("data", [])
                 model_ids = [m.get("id") for m in models if isinstance(m, dict) and m.get("id")]
                 print("Parsed models:", model_ids)
                 
                 if not model_ids and "deepseek" in base_url.lower():
                     print("Fallback to ['deepseek-chat', 'deepseek-reasoner']")
        except Exception as e:
             print(f"Exception: {e}")

if __name__ == "__main__":
    asyncio.run(test())
