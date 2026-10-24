"""Rotating SSP unit-login codes and operational unit sessions (not a user JWT)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from .activation_codes import (
    CODE_LEN,
    hash_activation_code,
    hash_secret,
    is_valid_activation_code_format,
    new_activation_code,
    new_device_token,
    normalize_activation_code,
    redeem_is_allowed,
)

UNIT_CODE_TTL = timedelta(minutes=10)
UNIT_SESSION_TTL = timedelta(hours=8)
GENERIC_UNIT_INVALID = "קוד היחידה אינו תקף"


def new_unit_login_code() -> str:
    return new_activation_code()


def normalize_unit_code(raw: str) -> str:
    return normalize_activation_code(raw)


def is_valid_unit_code_format(value: str) -> bool:
    return is_valid_activation_code_format(value)


def hash_unit_code(code: str) -> str:
    return hash_activation_code(code)


def format_unit_code_display(code: str) -> str:
    compact = normalize_unit_code(code)
    if len(compact) == CODE_LEN:
        return f"{compact[:4]}-{compact[4:]}"
    return compact


def unit_code_expires_at(now: datetime | None = None) -> datetime:
    clock = now or datetime.now(timezone.utc)
    return clock + UNIT_CODE_TTL


def unit_session_expires_at(now: datetime | None = None) -> datetime:
    clock = now or datetime.now(timezone.utc)
    return clock + UNIT_SESSION_TTL


def new_unit_session_token() -> str:
    return new_device_token()


def hash_unit_session_token(token: str) -> str:
    return hash_secret(token.strip())


def remaining_seconds(expires_at: datetime | None, now: datetime | None = None) -> int:
    if not expires_at:
        return 0
    clock = now or datetime.now(timezone.utc)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return max(0, int((expires_at - clock).total_seconds()))


def unit_session_allows(
    *,
    session_status: str,
    session_expires_at: datetime | None,
    site_is_active: bool,
    now: datetime | None = None,
) -> bool:
    clock = now or datetime.now(timezone.utc)
    if session_status != "active":
        return False
    if session_expires_at and session_expires_at <= clock:
        return False
    return bool(site_is_active)


def raise_uniform_unit_invalid() -> None:
    from ..errors import ApiError

    raise ApiError(400, "VALIDATION_ERROR", GENERIC_UNIT_INVALID)


def unit_code_status_at(status: str, expires_at: datetime | None, now: datetime | None = None) -> str:
    clock = now or datetime.now(timezone.utc)
    if status == "active" and expires_at and expires_at < clock:
        return "expired"
    return status


__all__ = [
    "CODE_LEN",
    "GENERIC_UNIT_INVALID",
    "UNIT_CODE_TTL",
    "UNIT_SESSION_TTL",
    "format_unit_code_display",
    "hash_unit_code",
    "hash_unit_session_token",
    "is_valid_unit_code_format",
    "new_unit_login_code",
    "new_unit_session_token",
    "normalize_unit_code",
    "raise_uniform_unit_invalid",
    "redeem_is_allowed",
    "remaining_seconds",
    "unit_code_expires_at",
    "unit_code_status_at",
    "unit_session_allows",
    "unit_session_expires_at",
]
