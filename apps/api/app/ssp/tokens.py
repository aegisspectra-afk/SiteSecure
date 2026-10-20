from __future__ import annotations

import hashlib
import hmac
import secrets

from ..quote_tokens import hash_public_token, new_public_token

__all__ = [
    "new_public_token",
    "hash_public_token",
    "hash_access_code",
    "verify_access_code",
]


def hash_access_code(code: str) -> str:
    """One-way access-code digest with random salt. Format: salt$hexdigest."""
    normalized = code.strip()
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        normalized.encode("utf-8"),
        salt.encode("utf-8"),
        120_000,
    ).hex()
    return f"{salt}${digest}"


def verify_access_code(code: str, stored: str | None) -> bool:
    if not stored or "$" not in stored:
        return False
    salt, expected = stored.split("$", 1)
    if not salt or not expected:
        return False
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        code.strip().encode("utf-8"),
        salt.encode("utf-8"),
        120_000,
    ).hex()
    return hmac.compare_digest(digest, expected)
