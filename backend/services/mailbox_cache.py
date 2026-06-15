import asyncio
from typing import Dict, Any, Optional

_mailbox_cache: Dict[str, Dict[str, Any]] = {}
_lock = asyncio.Lock()

async def set_mailbox(mailbox_id: str, data: Dict[str, Any]):
    """Store mailbox data in in-memory cache."""
    async with _lock:
        _mailbox_cache[mailbox_id] = data

async def get_mailbox(mailbox_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve cached mailbox data, or None if not cached."""
    async with _lock:
        return _mailbox_cache.get(mailbox_id)
