"""In-process idempotency for a single API node. Not a substitute for RLS."""

from __future__ import annotations

import time
from threading import Lock

_TTL_SECONDS = 24 * 60 * 60
_lock = Lock()
_store: dict[tuple[str, str], tuple[float, int, dict]] = {}


def remember(workspace_id: str, key: str, status: int, body: dict) -> None:
    with _lock:
        _store[(workspace_id, key)] = (time.time(), status, body)


def lookup(workspace_id: str, key: str | None) -> tuple[int, dict] | None:
    if not key:
        return None
    with _lock:
        hit = _store.get((workspace_id, key))
        if not hit:
            return None
        stored_at, status, body = hit
        if time.time() - stored_at > _TTL_SECONDS:
            _store.pop((workspace_id, key), None)
            return None
        return status, body
