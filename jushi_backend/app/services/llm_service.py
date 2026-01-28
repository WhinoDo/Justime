"""
LLM 基础服务层
处理底层的 LLM API 调用
"""

import httpx
from typing import Dict, Any, List, Optional
from app.core.config import settings

class LLMService:
    @staticmethod
    async def chat_completion(
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        timeout: float = 60.0
    ) -> Dict[str, Any]:
        """通用对话补全接口"""
        target_api_key = api_key or settings.LLM_API_KEY
        target_api_base = api_base or settings.LLM_BASE_URL
        target_model = model or settings.LLM_MODEL_ID or "gpt-3.5-turbo"

        if not target_api_key or not target_api_base:
            raise ValueError("LLM 配置不完整")

        headers = {
            "Authorization": f"Bearer {target_api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": target_model,
            "messages": messages,
            "temperature": temperature
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{target_api_base}/chat/completions",
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            return response.json()

llm_service = LLMService()
