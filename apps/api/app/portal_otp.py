"""Phone OTP helpers for the customer portal."""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta

from .config import DEV_APP_ENVS

logger = logging.getLogger("site-secure")

OTP_TTL = timedelta(minutes=10)
OTP_COOLDOWN = timedelta(seconds=45)
OTP_SESSION_TTL = timedelta(days=30)
PORTAL_BEARER_PREFIX = "pss_"


def normalize_portal_phone(value: str) -> str:
    digits = "".join(ch for ch in (value or "") if ch.isdigit())
    if digits.startswith("972") and len(digits) >= 11:
        digits = "0" + digits[3:]
    if len(digits) == 9 and not digits.startswith("0"):
        digits = "0" + digits
    if len(digits) > 10:
        digits = digits[-10:]
    return digits


def phone_match_key(normalized: str) -> str:
    """Last 9 digits — matches import deduping on customers/contacts."""
    digits = "".join(ch for ch in normalized if ch.isdigit())
    return digits[-9:] if len(digits) >= 9 else digits


def otp_code_hash(phone_normalized: str, code: str) -> str:
    payload = f"{phone_normalized}:{code.strip()}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def mint_otp_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def mint_portal_session_token() -> str:
    return f"{PORTAL_BEARER_PREFIX}{secrets.token_urlsafe(32)}"


def hash_portal_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def is_portal_bearer_token(token: str) -> bool:
    return (token or "").startswith(PORTAL_BEARER_PREFIX)


def is_local_portal_debug(settings) -> bool:
    return (settings.app_env or "").strip().lower() in DEV_APP_ENVS


def debug_otp_response(settings, code: str) -> dict:
    if is_local_portal_debug(settings):
        return {"debug_code": code}
    return {}


def log_otp_code_local(phone: str, code: str, settings) -> None:
    if is_local_portal_debug(settings):
        logger.info("portal_otp_local phone=%s code=%s", phone, code)


def now_utc() -> datetime:
    return datetime.now(UTC)