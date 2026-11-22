"""Bearer portal session auth (parallel to Supabase JWT for portal APIs)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import Depends, Header

from .config import Settings, get_settings
from .deps import current_user, service_client, user_client
from .errors import MESSAGES, ApiError
from .portal_otp import hash_portal_session_token, is_portal_bearer_token
from .rest import as_list
from .supabase_service import ServiceClient
from .supabase_user import UserClient


@dataclass(frozen=True)
class PortalAuth:
    mode: str  # "session" | "supabase"
    user_id: str | None
    session_id: str | None
    access_ids: frozenset[str]
    phone_normalized: str | None = None


def _parse_dt(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    text = str(value).replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _load_portal_session(service: ServiceClient, token: str) -> PortalAuth | None:
    if not is_portal_bearer_token(token):
        return None
    digest = hash_portal_session_token(token)
    res = service.get(
        "portal_sessions",
        params={
            "token_hash": f"eq.{digest}",
            "select": "id,phone_normalized,expires_at,revoked_at",
            "limit": "1",
        },
    )
    rows = as_list(res)
    if not rows:
        return None
    row = rows[0]
    if row.get("revoked_at"):
        return None
    expires = _parse_dt(row.get("expires_at"))
    if expires is None or expires <= datetime.now(UTC):
        return None
    grants = as_list(
        service.get(
            "portal_session_grants",
            params={"session_id": f"eq.{row['id']}", "select": "access_id"},
        )
    )
    access_ids = frozenset(str(g["access_id"]) for g in grants if g.get("access_id"))
    if not access_ids:
        return None
    return PortalAuth(
        mode="session",
        user_id=None,
        session_id=str(row["id"]),
        access_ids=access_ids,
        phone_normalized=str(row.get("phone_normalized") or "") or None,
    )


def portal_auth_flexible(
    authorization: Annotated[str | None, Header()] = None,
    service: Annotated[ServiceClient, Depends(service_client)] = None,
    settings: Annotated[Settings, Depends(get_settings)] = None,
) -> PortalAuth:
    """Portal customer APIs: accept pss_ session bearer OR Supabase JWT."""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        session_auth = _load_portal_session(service, token)
        if session_auth is not None:
            return session_auth
        if is_portal_bearer_token(token):
            raise ApiError(401, "UNAUTHENTICATED", MESSAGES["UNAUTHENTICATED"])
        user_client_inst = UserClient(settings, token)
        user = current_user(user_client_inst)
        return PortalAuth(
            mode="supabase",
            user_id=str(user["id"]),
            session_id=None,
            access_ids=frozenset(),
        )
    raise ApiError(401, "UNAUTHENTICATED", MESSAGES["UNAUTHENTICATED"])


def require_portal_grant(service: ServiceClient, auth: PortalAuth, access_id: UUID) -> dict:
    aid = str(access_id)
    if auth.mode == "session":
        if aid not in auth.access_ids:
            raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
        res = service.get(
            "customer_portal_access",
            params={
                "id": f"eq.{access_id}",
                "status": "eq.active",
                "select": "id,workspace_id,customer_id,email,capabilities,status,last_login_at",
                "limit": "1",
            },
        )
    else:
        res = service.get(
            "customer_portal_access",
            params={
                "id": f"eq.{access_id}",
                "portal_user_id": f"eq.{auth.user_id}",
                "status": "eq.active",
                "select": "id,workspace_id,customer_id,email,capabilities,status,last_login_at",
                "limit": "1",
            },
        )
    rows = as_list(res)
    if not rows:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    return rows[0]