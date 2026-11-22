"""Customer portal OTP login (no Supabase password)."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..config import Settings, get_settings
from ..errors import MESSAGES, ApiError
from ..portal_otp import (
    OTP_COOLDOWN,
    OTP_SESSION_TTL,
    OTP_TTL,
    debug_otp_response,
    hash_portal_session_token,
    is_local_portal_debug,
    log_otp_code_local,
    mint_otp_code,
    mint_portal_session_token,
    normalize_portal_phone,
    now_utc,
    otp_code_hash,
    phone_match_key,
)
from ..rest import as_list, created_or_403
from ..supabase_service import ServiceClient
from ..deps import service_client

logger = logging.getLogger("site-secure")

router = APIRouter(prefix="/api/v1/portal/otp", tags=["customer-portal"])


class OtpPhoneIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    phone: str = Field(min_length=9, max_length=32)


class OtpVerifyIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    phone: str = Field(min_length=9, max_length=32)
    code: str = Field(min_length=4, max_length=8)


def _generic_sent() -> dict:
    return {"status": "sent"}


def _client_ip(request: Request) -> str | None:
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    return forwarded or (request.client.host if request.client else None)


def _parse_dt(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    text = str(value).replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _access_ids_for_phone(service: ServiceClient, phone: str) -> list[dict]:
    normalized = normalize_portal_phone(phone)
    key = phone_match_key(normalized)
    if len(key) < 7:
        return []
    contact_hits: set[str] = set()
    customer_hits: set[tuple[str, str]] = set()
    for row in as_list(
        service.get(
            "customer_contacts",
            params={"phone": "not.is.null", "select": "id,customer_id,workspace_id,phone", "limit": "2000"},
        )
    ):
        if phone_match_key(normalize_portal_phone(str(row.get("phone") or ""))) == key:
            contact_hits.add(str(row["id"]))
            customer_hits.add((str(row["workspace_id"]), str(row["customer_id"])))
    for row in as_list(
        service.get(
            "customers",
            params={"phone": "not.is.null", "deleted_at": "is.null", "select": "id,workspace_id,phone", "limit": "2000"},
        )
    ):
        if phone_match_key(normalize_portal_phone(str(row.get("phone") or ""))) == key:
            customer_hits.add((str(row["workspace_id"]), str(row["id"])))
    if not contact_hits and not customer_hits:
        return []
    access_rows = as_list(
        service.get(
            "customer_portal_access",
            params={
                "status": "in.(invited,active)",
                "select": "id,workspace_id,customer_id,contact_id,status,email",
            },
        )
    )
    out: list[dict] = []
    for row in access_rows:
        cid = str(row.get("contact_id") or "")
        pair = (str(row["workspace_id"]), str(row["customer_id"]))
        if cid and cid in contact_hits:
            out.append(row)
        elif pair in customer_hits:
            out.append(row)
    return out


@router.post("/request-code")
def portal_otp_request_code(
    body: OtpPhoneIn,
    request: Request,
    service: Annotated[ServiceClient, Depends(service_client)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict:
    normalized = normalize_portal_phone(body.phone)
    if len(phone_match_key(normalized)) < 7:
        raise ApiError(400, "VALIDATION_ERROR", MESSAGES["VALIDATION_ERROR"])
    access = _access_ids_for_phone(service, normalized)
    if not access:
        return _generic_sent()
    now = now_utc()
    recent = as_list(
        service.get(
            "portal_otp_challenges",
            params={
                "phone_normalized": f"eq.{normalized}",
                "consumed_at": "is.null",
                "order": "created_at.desc",
                "limit": "1",
            },
        )
    )
    if recent:
        created = _parse_dt(recent[0].get("created_at"))
        if created and now - created < OTP_COOLDOWN:
            return _generic_sent()
    code = mint_otp_code()
    log_otp_code_local(normalized, code, settings)
    ip = _client_ip(request)
    payload: dict[str, Any] = {
        "phone_normalized": normalized,
        "code_hash": otp_code_hash(normalized, code),
        "expires_at": (now + OTP_TTL).isoformat(),
        "attempts": 0,
    }
    if ip:
        payload["request_ip"] = ip
    created_or_403(service.post("portal_otp_challenges", payload))
    return {**_generic_sent(), **debug_otp_response(settings, code)}


@router.post("/verify")
def portal_otp_verify(
    body: OtpVerifyIn,
    service: Annotated[ServiceClient, Depends(service_client)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict:
    normalized = normalize_portal_phone(body.phone)
    code = body.code.strip()
    if len(phone_match_key(normalized)) < 7 or not code.isdigit():
        raise ApiError(400, "VALIDATION_ERROR", MESSAGES["VALIDATION_ERROR"])
    rows = as_list(
        service.get(
            "portal_otp_challenges",
            params={
                "phone_normalized": f"eq.{normalized}",
                "consumed_at": "is.null",
                "order": "created_at.desc",
                "limit": "1",
            },
        )
    )
    if not rows:
        raise ApiError(401, "PORTAL_OTP_INVALID", MESSAGES.get("PORTAL_OTP_INVALID", "קוד לא תקין"))
    challenge = rows[0]
    expires = _parse_dt(challenge.get("expires_at"))
    if expires is None or expires <= now_utc():
        raise ApiError(401, "PORTAL_OTP_EXPIRED", MESSAGES.get("PORTAL_OTP_EXPIRED", "פג תוקף הקוד"))
    attempts = int(challenge.get("attempts") or 0)
    max_attempts = int(challenge.get("max_attempts") or 5)
    digest = otp_code_hash(normalized, code)
    if digest != str(challenge.get("code_hash") or ""):
        service.patch(
            "portal_otp_challenges",
            {"attempts": attempts + 1},
            params={"id": f"eq.{challenge['id']}"},
        )
        if attempts + 1 >= max_attempts:
            service.patch(
                "portal_otp_challenges",
                {"consumed_at": now_utc().isoformat()},
                params={"id": f"eq.{challenge['id']}"},
            )
        raise ApiError(401, "PORTAL_OTP_INVALID", MESSAGES.get("PORTAL_OTP_INVALID", "קוד לא תקין"))
    service.patch(
        "portal_otp_challenges",
        {"consumed_at": now_utc().isoformat(), "attempts": attempts + 1},
        params={"id": f"eq.{challenge['id']}"},
    )
    grants = _access_ids_for_phone(service, normalized)
    if not grants:
        raise ApiError(401, "PORTAL_OTP_INVALID", MESSAGES.get("PORTAL_OTP_INVALID", "קוד לא תקין"))
    now = now_utc().isoformat()
    for row in grants:
        if row.get("status") == "invited":
            service.patch(
                "customer_portal_access",
                {"status": "active", "last_login_at": now},
                params={"id": f"eq.{row['id']}"},
            )
        else:
            service.patch(
                "customer_portal_access",
                {"last_login_at": now},
                params={"id": f"eq.{row['id']}"},
            )
    token = mint_portal_session_token()
    session = created_or_403(
        service.post(
            "portal_sessions",
            {
                "token_hash": hash_portal_session_token(token),
                "phone_normalized": normalized,
                "expires_at": (now_utc() + OTP_SESSION_TTL).isoformat(),
            },
        )
    )
    session_id = str(session["id"])
    for row in grants:
        created_or_403(
            service.post(
                "portal_session_grants",
                {"session_id": session_id, "access_id": str(row["id"])},
            )
        )
    out: dict[str, Any] = {
        "token": token,
        "expires_at": session.get("expires_at"),
        "grants": [
            {
                "access_id": str(r["id"]),
                "customer_id": str(r["customer_id"]),
                "workspace_id": str(r["workspace_id"]),
            }
            for r in grants
        ],
    }
    if is_local_portal_debug(settings):
        out["debug_code"] = code
    return out