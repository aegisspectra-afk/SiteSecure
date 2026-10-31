"""Sanitize list-search q so PostgREST wildcards cannot be injected."""

from __future__ import annotations

WILDCARD_CHARS = frozenset("*()%,_")


def sanitize_search_q(raw: str | None) -> str:
    if not raw:
        return ""
    cleaned = "".join(" " if ch in WILDCARD_CHARS else ch for ch in str(raw))
    return " ".join(cleaned.split())
