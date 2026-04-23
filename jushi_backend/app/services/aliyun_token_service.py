"""
阿里云语音 Token 服务
"""

from __future__ import annotations

import json
import threading
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

from app.core.config import settings


class AliyunTokenService:
    """通过阿里云公共 SDK 获取并缓存语音 Token。"""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._cached_token: Optional[str] = None
        self._cached_expire_time: int = 0

    def get_token(self, force_refresh: bool = False) -> Dict[str, Any]:
        with self._lock:
            now = int(time.time())
            if (
                not force_refresh
                and self._cached_token
                and self._cached_expire_time > now + 60
            ):
                return self._build_result(self._cached_token, self._cached_expire_time, cached=True)

            token, expire_time = self._request_new_token()
            self._cached_token = token
            self._cached_expire_time = expire_time
            return self._build_result(token, expire_time, cached=False)

    def _request_new_token(self) -> tuple[str, int]:
        ak_id = (settings.ALIYUN_AK_ID or "").strip()
        ak_secret = (settings.ALIYUN_AK_SECRET or "").strip()
        if not ak_id or not ak_secret:
            raise RuntimeError(
                "缺少阿里云凭证，请在后端环境变量中设置 ALIYUN_AK_ID 和 ALIYUN_AK_SECRET。"
            )

        try:
            from aliyunsdkcore.client import AcsClient
            from aliyunsdkcore.request import CommonRequest
        except Exception as exc:
            raise RuntimeError(
                "未安装 aliyun-python-sdk-core，请先执行: pip install aliyun-python-sdk-core==2.15.1"
            ) from exc

        client = AcsClient(ak_id, ak_secret, settings.ALIYUN_NLS_REGION_ID)

        request = CommonRequest()
        request.set_method("POST")
        request.set_domain(settings.ALIYUN_NLS_DOMAIN)
        request.set_version(settings.ALIYUN_NLS_API_VERSION)
        request.set_action_name(settings.ALIYUN_NLS_ACTION)

        try:
            response = client.do_action_with_exception(request)
            payload = json.loads(response.decode("utf-8") if isinstance(response, bytes) else response)
        except Exception as exc:
            message = str(exc)
            if "Not supported proxy scheme" in message:
                raise RuntimeError(
                    "获取 Token 失败：检测到代理配置异常（Not supported proxy scheme）。"
                    "请检查并修正/清理 http_proxy 与 https_proxy。"
                ) from exc
            raise RuntimeError(f"获取 Token 失败：{message}") from exc

        token = (
            payload.get("Token", {}).get("Id")
            if isinstance(payload, dict)
            else None
        )
        expire_time = (
            payload.get("Token", {}).get("ExpireTime")
            if isinstance(payload, dict)
            else None
        )

        if not token or not expire_time:
            raise RuntimeError(f"获取 Token 失败：返回内容缺少 Token/ExpireTime，响应={payload}")

        return str(token), int(expire_time)

    @staticmethod
    def _build_result(token: str, expire_time: int, cached: bool) -> Dict[str, Any]:
        expire_dt_utc = datetime.fromtimestamp(expire_time, tz=timezone.utc)
        beijing_tz = timezone(timedelta(hours=8))
        expire_dt_bj = expire_dt_utc.astimezone(beijing_tz)
        return {
            "token": token,
            "expireTime": expire_time,
            "expireAtUTC": expire_dt_utc.strftime("%Y-%m-%d %H:%M:%S %Z"),
            "expireAtBeijing": expire_dt_bj.strftime("%Y-%m-%d %H:%M:%S %Z"),
            "cached": cached,
        }


aliyun_token_service = AliyunTokenService()
