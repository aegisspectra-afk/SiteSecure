"""Cryptographically secure public codes for SSP operational entities."""

from __future__ import annotations

import re
import secrets

CHECKPOINT_CODE_RE = re.compile(r"^cp_[a-f0-9]{24}$")


def new_checkpoint_code() -> str:
    return f"cp_{secrets.token_hex(12)}"


def is_valid_checkpoint_code(value: str) -> bool:
    return bool(CHECKPOINT_CODE_RE.fullmatch(value or ""))
