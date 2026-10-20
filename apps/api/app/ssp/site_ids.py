"""Cryptographically secure SSP operational site_id (not a login, not G1 barcode)."""

from __future__ import annotations

import re
import secrets

SITE_ID_RE = re.compile(r"^sit_[a-f0-9]{32}$")


def new_site_id() -> str:
    return f"sit_{secrets.token_hex(16)}"


def is_valid_site_id(value: str) -> bool:
    return bool(SITE_ID_RE.fullmatch(value or ""))
