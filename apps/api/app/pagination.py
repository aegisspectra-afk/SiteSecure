from __future__ import annotations

import base64
from typing import Any, TypeVar

from pydantic import BaseModel, Field

from .errors import ApiError

T = TypeVar("T")


class Page(BaseModel):
    items: list[Any]
    next_cursor: str | None = None


class ListQuery(BaseModel):
    limit: int = Field(default=50, ge=1, le=100)
    cursor: str | None = None
    q: str | None = None
    status: str | None = None
    sort: str = "-created_at"


def parse_limit(limit: int | None) -> int:
    n = 50 if limit is None else limit
    if n < 1 or n > 100:
        raise ApiError(400, "VALIDATION_ERROR", "מגבלת עמוד לא תקינה")
    return n


def encode_cursor(value: str) -> str:
    return base64.urlsafe_b64encode(value.encode("utf-8")).decode("ascii").rstrip("=")


def decode_cursor(cursor: str | None) -> str | None:
    if not cursor:
        return None
    pad = "=" * (-len(cursor) % 4)
    try:
        return base64.urlsafe_b64decode(cursor + pad).decode("utf-8")
    except Exception as exc:
        raise ApiError(400, "VALIDATION_ERROR", "סמן עמוד לא תקין") from exc


def page_from_rows(rows: list[dict], limit: int, *, cursor_field: str = "created_at") -> Page:
    next_cursor = None
    items = rows
    if len(rows) > limit:
        items = rows[:limit]
        marker = items[-1].get(cursor_field)
        if marker:
            next_cursor = encode_cursor(str(marker))
    return Page(items=items, next_cursor=next_cursor)
