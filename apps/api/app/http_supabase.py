"""Shared Supabase HTTP helpers — map transport failures to ApiError, retry briefly."""

from __future__ import annotations

import threading
import time
from typing import Any

import httpx

from .errors import MESSAGES, ApiError

DEFAULT_TIMEOUT = 20.0
MAX_ATTEMPTS = 3

_lock = threading.Lock()
_client: httpx.Client | None = None


def get_http_client(timeout: float = DEFAULT_TIMEOUT) -> httpx.Client:
    """Process-wide keep-alive client — avoids TLS handshake per PostgREST call."""
    global _client
    with _lock:
        if _client is None or _client.is_closed:
            _client = httpx.Client(
                timeout=timeout,
                limits=httpx.Limits(max_connections=32, max_keepalive_connections=16),
            )
        return _client


def reset_http_client() -> None:
    """Close the shared client (tests / shutdown)."""
    global _client
    with _lock:
        if _client is not None and not _client.is_closed:
            _client.close()
        _client = None


def supabase_request(
    method: str,
    url: str,
    *,
    headers: dict[str, str],
    params: dict[str, Any] | None = None,
    json: dict | list | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> httpx.Response:
    last: BaseException | None = None
    client = get_http_client(timeout)
    for attempt in range(MAX_ATTEMPTS):
        try:
            return client.request(method, url, headers=headers, params=params, json=json)
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            last = exc
            if attempt + 1 < MAX_ATTEMPTS:
                time.sleep(0.25 * (attempt + 1))
                # Drop a broken pooled connection before retry.
                reset_http_client()
                client = get_http_client(timeout)
    raise ApiError(503, "API_UNAVAILABLE", MESSAGES["API_UNAVAILABLE"]) from last
