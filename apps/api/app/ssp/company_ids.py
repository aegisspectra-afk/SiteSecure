"""Cryptographically secure SSP company_id generation (not workspace UUID)."""

from __future__ import annotations

import re
import secrets

COMPANY_ID_RE = re.compile(r"^cmp_[a-f0-9]{32}$")


def new_company_id() -> str:
    """Return immutable-style public id: cmp_ + 32 hex chars from CSPRNG."""
    return f"cmp_{secrets.token_hex(16)}"


def is_valid_company_id(value: str) -> bool:
    return bool(COMPANY_ID_RE.fullmatch(value or ""))
