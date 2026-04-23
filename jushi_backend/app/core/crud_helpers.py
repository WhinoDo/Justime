from __future__ import annotations

from datetime import datetime
from typing import Any, Awaitable, Callable, Optional


def with_timestamp_suffix(value: str, now: Optional[datetime] = None) -> str:
    current = now or datetime.utcnow()
    return f"{value}-{int(current.timestamp())}"


async def create_with_id_conflict(
    collection: Any,
    doc: dict,
    *,
    id_field: str = 'id',
    suffix_factory: Callable[[str], str] = with_timestamp_suffix,
) -> Optional[dict]:
    doc_id = str(doc.get(id_field) or '').strip()
    if doc_id and await collection.find_one({id_field: doc_id}):
        doc[id_field] = suffix_factory(doc_id)

    await collection.insert_one(doc)
    return await collection.find_one({id_field: doc.get(id_field)})


async def update_existing_and_fetch(
    collection: Any,
    existing: Optional[dict],
    doc: dict,
) -> Optional[dict]:
    if not existing:
        return None

    await collection.update_one(
        {'_id': existing['_id']},
        {'$set': doc},
    )
    return await collection.find_one({'_id': existing['_id']})


async def delete_by_filter(collection: Any, lookup_filter: dict) -> bool:
    result = await collection.delete_one(lookup_filter)
    return result.deleted_count > 0
