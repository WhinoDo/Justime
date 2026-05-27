from datetime import datetime
from typing import Any, Iterable, List


def to_iso_datetime(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, str) and value:
        return value
    return datetime.utcnow().isoformat()


def normalize_capabilities(raw: Any, allowed: Iterable[str] | None = None) -> List[str]:
    if not isinstance(raw, list):
        return []

    allowed_set = {item.strip().lower() for item in allowed} if allowed else None
    values: List[str] = []
    for item in raw:
        if not isinstance(item, str):
            continue
        normalized = item.strip().lower()
        if not normalized:
            continue
        if allowed_set is not None and normalized not in allowed_set:
            continue
        if normalized not in values:
            values.append(normalized)
    return values


def normalize_bool(raw: Any, default: bool = True) -> bool:
    if isinstance(raw, bool):
        return raw
    if raw is None:
        return default
    if isinstance(raw, str):
        lowered = raw.strip().lower()
        if lowered in {"true", "1", "yes", "y"}:
            return True
        if lowered in {"false", "0", "no", "n"}:
            return False
    return bool(raw)


def normalize_priority(raw: Any, default: int = 100, minimum: int = 1, maximum: int = 999) -> int:
    try:
        return max(minimum, min(int(raw), maximum))
    except Exception:
        return default
