from __future__ import annotations

import re

import httpx

from .errors import MESSAGES, ApiError


def _plan_limit_from_response(res: httpx.Response) -> ApiError | None:
    text = res.text or ""
    if "PLAN_LIMIT_REACHED" not in text:
        return None
    resource = None
    limit = None
    current = None
    # Trigger format: PLAN_LIMIT_REACHED:resource:limit:current
    match = re.search(
        r"PLAN_LIMIT_REACHED(?::([A-Za-z0-9_]+))?(?::(\d+))?(?::(\d+))?",
        text,
    )
    if match:
        resource = match.group(1)
        if match.group(2) is not None:
            limit = int(match.group(2))
        if match.group(3) is not None:
            current = int(match.group(3))
    messages = {
        "customers": "הגעת למגבלת הלקוחות בתוכנית שלך",
        "quotes": "הגעת למגבלת ההצעות בתוכנית שלך",
        "storage": "אין מספיק שטח אחסון להעלאת הקובץ",
    }
    details: dict = {}
    if resource:
        details["resource"] = resource
    if limit is not None:
        details["limit"] = limit
    if current is not None:
        details["current"] = current
    return ApiError(
        403,
        "PLAN_LIMIT_REACHED",
        messages.get(resource or "", MESSAGES["PLAN_LIMIT_REACHED"]),
        details,
    )


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
    limit_err = _plan_limit_from_response(res)
    if limit_err:
        raise limit_err
    raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])


def patched_or_403(res: httpx.Response) -> dict:
    return created_or_403(res)


def acked_or_403(res: httpx.Response) -> None:
    """Success for mutations that must not RETURN the row (soft-delete vs SELECT RLS)."""
    if res.status_code in {200, 201, 204}:
        return
    limit_err = _plan_limit_from_response(res)
    if limit_err:
        raise limit_err
    raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])