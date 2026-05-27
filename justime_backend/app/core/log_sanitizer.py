"""
日志脱敏工具
防止敏感数据泄露到日志中
"""

import re
from typing import Any, Dict, List, Optional, Set
from copy import deepcopy


SENSITIVE_FIELD_NAMES: Set[str] = {
    "password",
    "pwd",
    "pass",
    "hashed_password",
    "new_password",
    "old_password",
    "confirm_password",
    "token",
    "access_token",
    "refresh_token",
    "refreshToken",
    "accessToken",
    "csrf_token",
    "csrfToken",
    "api_key",
    "apiKey",
    "secret",
    "secret_key",
    "secretKey",
    "private_key",
    "privateKey",
    "authorization",
    "auth",
    "credential",
    "credentials",
    "session_id",
    "sessionId",
    "cookie",
    "jwt",
    "bearer",
}

SENSITIVE_HEADER_NAMES: Set[str] = {
    "authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
    "x-auth-token",
    "x-csrf-token",
    "x-session-id",
    "x-api-secret",
}

SENSITIVE_PATTERNS = [
    (re.compile(r"eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*"), "<JWT_TOKEN>"),
    (re.compile(r"sk-[a-zA-Z0-9]{20,}"), "<API_KEY>"),
    (re.compile(r"sk_live_[a-zA-Z0-9]{20,}"), "<API_KEY>"),
    (re.compile(r"sk_test_[a-zA-Z0-9]{20,}"), "<API_KEY>"),
    (re.compile(r"rk-[a-zA-Z0-9]{20,}"), "<API_KEY>"),
    (re.compile(r"[a-zA-Z0-9]{32,45}"), "<SECRET>"),
]

MASK_VALUE = "***"
MASK_HEADER = "***REDACTED***"


def mask_token(token: str, visible_chars: int = 4) -> str:
    if not token or len(token) <= visible_chars * 2:
        return MASK_VALUE
    return f"{token[:visible_chars]}...{token[-visible_chars:]}"


def mask_email(email: str) -> str:
    if not email or "@" not in email:
        return MASK_VALUE
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked_local = local[0] + "***"
    else:
        masked_local = local[:2] + "***"
    return f"{masked_local}@{domain}"


def mask_connection_string(uri: str) -> str:
    if not uri:
        return uri
    
    pattern = re.compile(r"(mongodb|redis|postgres|mysql)://([^:]+):([^@]+)@(.+)")
    match = pattern.match(uri)
    if match:
        protocol = match.group(1)
        host_part = match.group(4)
        return f"{protocol}://***:***@{host_part}"
    
    return uri


def is_sensitive_field_name(field_name: str) -> bool:
    normalized = field_name.lower().replace("-", "_")
    return normalized in SENSITIVE_FIELD_NAMES


def is_sensitive_header_name(header_name: str) -> bool:
    normalized = header_name.lower().replace("-", "_")
    return normalized in SENSITIVE_HEADER_NAMES


def sanitize_value(key: str, value: Any) -> Any:
    if value is None:
        return None
    
    if isinstance(value, (dict, list)):
        return sanitize_data(value)
    
    if isinstance(value, str):
        for pattern, replacement in SENSITIVE_PATTERNS:
            if pattern.search(value):
                if "eyJ" in value:
                    return mask_token(value, 8)
                return replacement
    
    if is_sensitive_field_name(key):
        if isinstance(value, str):
            if len(value) > 50:
                return f"<REDACTED:{len(value)}chars>"
            return MASK_VALUE
        return MASK_VALUE
    
    return value


def sanitize_dict(data: Dict[str, Any]) -> Dict[str, Any]:
    sanitized = {}
    for key, value in data.items():
        sanitized[key] = sanitize_value(key, value)
    return sanitized


def sanitize_list(data: List[Any]) -> List[Any]:
    return [sanitize_value(str(i), item) for i, item in enumerate(data)]


def sanitize_data(data: Any) -> Any:
    if isinstance(data, dict):
        return sanitize_dict(data)
    elif isinstance(data, list):
        return sanitize_list(data)
    elif isinstance(data, str):
        for pattern, replacement in SENSITIVE_PATTERNS:
            if pattern.search(data):
                return pattern.sub(replacement, data)
        return data
    return data


def sanitize_headers(headers: Dict[str, str]) -> Dict[str, str]:
    sanitized = {}
    for key, value in headers.items():
        if is_sensitive_header_name(key):
            sanitized[key] = MASK_HEADER
        else:
            sanitized[key] = value
    return sanitized


def sanitize_query_params(params: Dict[str, Any]) -> Dict[str, Any]:
    return sanitize_dict(params)


def sanitize_url(url: str) -> str:
    try:
        from urllib.parse import urlparse, parse_qs, urlunparse, urlencode
        
        parsed = urlparse(url)
        query_dict = parse_qs(parsed.query)
        
        sanitized_query = {}
        for key, values in query_dict.items():
            if is_sensitive_field_name(key):
                sanitized_query[key] = [MASK_VALUE]
            else:
                sanitized_query[key] = values
        
        new_query = urlencode(sanitized_query, doseq=True)
        
        return urlunparse((
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            new_query,
            parsed.fragment
        ))
    except Exception:
        return url


def sanitize_error_message(message: str) -> str:
    if not message:
        return message
    
    sanitized = message
    
    for pattern, replacement in SENSITIVE_PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)
    
    return sanitized


def sanitize_log_message(message: str, extra: Optional[Dict[str, Any]] = None) -> tuple:
    sanitized_message = sanitize_error_message(message)
    
    sanitized_extra = None
    if extra:
        sanitized_extra = sanitize_dict(deepcopy(extra))
    
    return sanitized_message, sanitized_extra
