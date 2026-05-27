"""
LLM 基础服务层
处理底层的 LLM API 调用，支持流式和非流式响应
"""

import asyncio
import logging
import json
from typing import Dict, Any, List, Optional, AsyncGenerator
import httpx

logger = logging.getLogger(__name__)

_shared_client: Optional[httpx.AsyncClient] = None


async def get_shared_client() -> httpx.AsyncClient:
    global _shared_client
    if _shared_client is None or _shared_client.is_closed:
        _shared_client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=10.0, read=300.0, write=10.0, pool=10.0),
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
        )
    return _shared_client


async def close_shared_client():
    global _shared_client
    if _shared_client and not _shared_client.is_closed:
        await _shared_client.aclose()
        _shared_client = None


# 流式读取超时配置
STREAM_READ_TIMEOUT = 30.0  # 单次读取超时（秒）
STREAM_TOTAL_TIMEOUT = 300.0  # 流式响应总超时（秒）
STREAM_HEARTBEAT_INTERVAL = 15.0  # 心跳间隔（秒）


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
        target_api_key = api_key
        target_api_base = api_base
        target_model = model

        if not target_api_key or not target_api_base or not target_model:
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

        client = await get_shared_client()
        response = await client.post(
            f"{target_api_base}/chat/completions",
            headers=headers,
            json=payload,
            timeout=timeout,
        )
        response.raise_for_status()
        return response.json()

    @staticmethod
    async def chat_completion_stream(
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        read_timeout: float = STREAM_READ_TIMEOUT,
        total_timeout: float = STREAM_TOTAL_TIMEOUT,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        流式对话补全接口，带超时控制

        Args:
            messages: 对话消息列表
            model: 模型ID
            api_key: API密钥
            api_base: API基础URL
            temperature: 温度参数
            max_tokens: 最大token数
            read_timeout: 单次读取超时（秒）
            total_timeout: 流式响应总超时（秒）

        Yields:
            流式响应chunk，格式为标准OpenAI SSE格式

        Raises:
            ValueError: 配置不完整
            asyncio.TimeoutError: 读取超时
            httpx.HTTPStatusError: HTTP错误
        """
        target_api_key = api_key
        target_api_base = api_base
        target_model = model

        if not target_api_key or not target_api_base or not target_model:
            raise ValueError("LLM 配置不完整")

        headers = {
            "Authorization": f"Bearer {target_api_key}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
        }

        payload = {
            "model": target_model,
            "messages": messages,
            "temperature": temperature,
            "stream": True,  # 启用流式响应
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens

        # 使用带超时的客户端配置
        timeout_config = httpx.Timeout(
            connect=10.0,
            read=read_timeout,
            write=10.0,
            pool=10.0,
        )

        client: Optional[httpx.AsyncClient] = None
        response: Optional[httpx.Response] = None

        try:
            client = await get_shared_client()
            response = await client.post(
                f"{target_api_base}/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()

            # 使用整体超时控制
            start_time = asyncio.get_event_loop().time()
            last_chunk_time = start_time

            async for line in response.aiter_lines():
                current_time = asyncio.get_event_loop().time()

                # 检查总超时
                if current_time - start_time > total_timeout:
                    logger.warning(f"Stream total timeout exceeded: {total_timeout}s")
                    raise asyncio.TimeoutError(f"流式响应总超时（{total_timeout}s）")

                # 检查读取超时（两次chunk之间的间隔）
                if current_time - last_chunk_time > read_timeout:
                    logger.warning(f"Stream read timeout: no data for {read_timeout}s")
                    raise asyncio.TimeoutError(f"流式读取超时（{read_timeout}s）")

                last_chunk_time = current_time

                # 解析SSE数据
                if not line or line.strip() == "":
                    continue

                if line.startswith("data: "):
                    data_str = line[6:]  # 移除 "data: " 前缀

                    if data_str.strip() == "[DONE]":
                        break

                    try:
                        chunk_data = json.loads(data_str)
                        yield chunk_data
                    except json.JSONDecodeError as e:
                        logger.warning(f"Failed to parse SSE chunk: {e}")
                        continue

        except httpx.HTTPStatusError as e:
            logger.error(f"LLM API HTTP error: {e.response.status_code} - {e.response.text}")
            raise
        except httpx.ReadTimeout as e:
            logger.error(f"LLM stream read timeout: {e}")
            raise asyncio.TimeoutError(f"流式读取超时: {str(e)}")
        except httpx.ConnectTimeout as e:
            logger.error(f"LLM connection timeout: {e}")
            raise asyncio.TimeoutError(f"连接超时: {str(e)}")
        except httpx.RequestError as e:
            logger.error(f"LLM request error: {e}")
            raise
        finally:
            # 确保资源正确释放
            if response is not None:
                try:
                    await response.aclose()
                except Exception as e:
                    logger.warning(f"Error closing response: {e}")


llm_service = LLMService()
