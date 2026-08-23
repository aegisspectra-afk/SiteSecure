"""Shared Supabase HTTP helpers — map transport failures to ApiError, retry briefly."""

from __future__ import annotations

import time
from typing import Any

import httpx

from .errors import MESSAGES, ApiError

DEFAULT_TIMEOUT = 20.0
MAX_ATTEMPTS = 3


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
    for attempt in range(MAX_ATTEMPTS):
        try:
            with httpx.Client(timeout=timeout) as client:
                return client.request(method, url, headers=headers, params=params, json=json)
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            last = exc
            if attempt + 1 < MAX_ATTEMPTS:
                time.sleep(0.25 * (attempt + 1))
    raise ApiError(503, "API_UNAVAILABLE", MESSAGES["API_UNAVAILABLE"]) from last
