from __future__ import annotations

import httpx

from .errors import MESSAGES, ApiError


def as_list(res: httpx.Response) -> list[dict]:
    if res.status_code == 200:
        data = res.json()
        return data if isinstance(data, list) else []
    if res.status_code in {401, 403}:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    raise ApiError(400, "BUSINESS_RULE", MESSAGES["BUSINESS_RULE"])


def one_or_404(res: httpx.Response) -> dict:
    rows = as_list(res) if res.status_code == 200 else None
    if res.status_code == 200 and rows:
        return rows[0]
    raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])


def created_or_403(res: httpx.Response) -> dict:
    if res.status_code in {200, 201}:
        data = res.json()
        if isinstance(data, list) and data:
            return data[0]
        if isinstance(data, dict) and data:
            return data
    raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])


def patched_or_403(res: httpx.Response) -> dict:
    return created_or_403(res)
