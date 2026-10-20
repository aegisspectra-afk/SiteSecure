"""One-time SSP site activation codes (not a session, not a user, not a site id)."""

from __future__ import annotations

import re
import secrets
from datetime import datetime, timedelta, timezone

from ..quote_tokens import hash_public_token, new_public_token

# Crockford-ish alphabet: no 0/O/1/I. 32^8 ≈ 1.1e12; rate-limit + TTL bound guessing.
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LEN = 8
CODE_TTL = timedelta(hours=4)
ENROLLMENT_TTL = timedelta(minutes=30)
DEVICE_SESSION_TTL = timedelta(hours=12)
GENERIC_INVALID = "קוד ההפעלה אינו תקף"
_CODE_RE = re.compile(rf"^[{_ALPHABET}]{{{CODE_LEN}}}$")


def normalize_activation_code(raw: str) -> str:
    compact = "".join(ch for ch in (raw or "").upper() if ch not in {" ", "-", "_"})
    return compact


def new_activation_code() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(CODE_LEN))


def is_valid_activation_code_format(value: str) -> bool:
    return bool(_CODE_RE.fullmatch(normalize_activation_code(value)))


def hash_activation_code(code: str) -> str:
    return hash_public_token(normalize_activation_code(code))


def code_expires_at(now: datetime | None = None) -> datetime:
    clock = now or datetime.now(timezone.utc)
    return clock + CODE_TTL


def enrollment_expires_at(now: datetime | None = None) -> datetime:
    clock = now or datetime.now(timezone.utc)
    return clock + ENROLLMENT_TTL


def device_session_expires_at(now: datetime | None = None) -> datetime:
    clock = now or datetime.now(timezone.utc)
    return clock + DEVICE_SESSION_TTL


def new_poll_token() -> str:
    return new_public_token()


def new_device_token() -> str:
    return new_public_token()


def hash_secret(value: str) -> str:
    return hash_public_token(value)


def code_status_at(status: str, expires_at: datetime | None, now: datetime | None = None) -> str:
    clock = now or datetime.now(timezone.utc)
    if status == "active" and expires_at and expires_at < clock:
        return "expired"
    return status


def uniform_invalid() -> tuple[int, str, str]:
    return 400, "VALIDATION_ERROR", GENERIC_INVALID


def raise_uniform_invalid() -> None:
    status, code, message = uniform_invalid()
    from ..errors import ApiError

    raise ApiError(status, code, message)


def redeem_is_allowed(*, status: str, expires_at: datetime | None, now: datetime | None = None) -> bool:
    clock = now or datetime.now(timezone.utc)
    if status != "active":
        return False
    if expires_at and expires_at <= clock:
        return False
    return True


def enrollment_public_status(status: str, expires_at: datetime | None, now: datetime | None = None) -> str:
    clock = now or datetime.now(timezone.utc)
    if status == "pending" and expires_at and expires_at <= clock:
        return "expired"
    return status


def can_approve_enrollment(
    *,
    enrollment_status: str,
    site_is_active: bool,
    code_status: str,
) -> bool:
    return enrollment_status == "pending" and site_is_active and code_status in {"redeemed", "active"}


def session_allows_site(session_site_pk: str, requested_site_pk: str | None) -> bool:
    if not requested_site_pk:
        return True
    return str(session_site_pk) == str(requested_site_pk)


def device_access_allowed(
    *,
    session_status: str,
    session_expires_at: datetime | None,
    device_status: str,
    site_is_active: bool,
    now: datetime | None = None,
) -> bool:
    clock = now or datetime.now(timezone.utc)
    if session_status != "active":
        return False
    if session_expires_at and session_expires_at <= clock:
        return False
    if device_status != "active":
        return False
    return bool(site_is_active)


def classify_site_activation(
    *,
    has_active_device: bool,
    has_pending_enrollment: bool,
    has_live_code: bool,
) -> str:
    if has_active_device:
        return "device_active"
    if has_pending_enrollment:
        return "pending_approval"
    if has_live_code:
        return "code_issued"
    return "awaiting_activation"
