from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from ..deps import service_client
from ..errors import ApiError, MESSAGES
from ..quote_tokens import hash_public_token
from ..rest import as_list
from ..supabase_service import ServiceClient

router = APIRouter(prefix="/api/v1/public/quotes", tags=["public-quotes"])

QUOTE_SELECT = (
    "id,workspace_id,number,status,version,valid_until,sent_at,viewed_at,"
    "approved_at,rejected_at,approved_name,rejection_reason"
)
DECISION_STATES = frozenset({"sent", "viewed"})


class PublicDecisionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, max_length=200)
    reason: str | None = Field(default=None, max_length=2000)


def _as_date(value: object) -> date | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        return None


def _load_access(svc: ServiceClient, token: str) -> dict:
    digest = hash_public_token(token.strip())
    rows = as_list(
        svc.get(
            "quote_public_access",
            params={
                "token_hash": f"eq.{digest}",
                "select": "id,workspace_id,quote_id,version,expires_at,revoked_at",
            },
        )
    )
    if not rows:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    access = rows[0]
    if access.get("revoked_at"):
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    expires = access.get("expires_at")
    if expires:
        try:
            exp = datetime.fromisoformat(str(expires).replace("Z", "+00:00"))
            if exp < datetime.now(UTC):
                raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
        except ApiError:
            raise
        except Exception:
            pass
    return access


def _load_quote(svc: ServiceClient, access: dict) -> dict:
    rows = as_list(
        svc.get(
            "quotes",
            params={
                "id": f"eq.{access['quote_id']}",
                "workspace_id": f"eq.{access['workspace_id']}",
                "select": QUOTE_SELECT,
            },
        )
    )
    if not rows:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    return rows[0]


def _load_version(svc: ServiceClient, access: dict) -> dict:
    rows = as_list(
        svc.get(
            "quote_versions",
            params={
                "quote_id": f"eq.{access['quote_id']}",
                "workspace_id": f"eq.{access['workspace_id']}",
                "version": f"eq.{access['version']}",
                "select": "id,version,snapshot,created_at",
            },
        )
    )
    if not rows:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    return rows[0]


def _public_from_version(version_row: dict) -> dict:
    snapshot = version_row.get("snapshot") or {}
    public = snapshot.get("public")
    if not isinstance(public, dict):
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    return dict(public)


def _maybe_expire(svc: ServiceClient, quote: dict) -> dict:
    if quote.get("status") not in DECISION_STATES:
        return quote
    until = _as_date(quote.get("valid_until"))
    if until is None or until >= datetime.now(UTC).date():
        return quote
    res = svc.patch(
        "quotes",
        {"status": "expired"},
        params={"id": f"eq.{quote['id']}", "workspace_id": f"eq.{quote['workspace_id']}", "status": f"in.({','.join(DECISION_STATES)})"},
    )
    rows = as_list(res) if res.status_code == 200 else []
    if not rows:
        return quote
    patched = rows[0]
    _event(svc, patched, "expired", {})
    return patched


def _event(svc: ServiceClient, quote: dict, event_type: str, metadata: dict) -> None:
    try:
        svc.post(
            "quote_events",
            {
                "workspace_id": quote["workspace_id"],
                "quote_id": quote["id"],
                "event_type": event_type,
                "metadata": metadata,
            },
        )
    except Exception:
        return


def _audit(svc: ServiceClient, quote: dict, action: str, metadata: dict) -> None:
    try:
        svc.post(
            "audit_logs",
            {
                "workspace_id": quote["workspace_id"],
                "action": action,
                "entity_type": "quote",
                "entity_id": quote["id"],
                "metadata": metadata,
            },
        )
    except Exception:
        return


def _assemble(svc: ServiceClient, token: str, *, mark_viewed: bool) -> dict:
    access = _load_access(svc, token)
    quote = _maybe_expire(svc, _load_quote(svc, access))
    public = _public_from_version(_load_version(svc, access))
    live_version = int(quote.get("version") or 1)
    access_version = int(access.get("version") or 1)
    superseded = live_version != access_version
    if mark_viewed and not superseded and quote.get("status") == "sent":
        now = datetime.now(UTC).isoformat()
        res = svc.patch(
            "quotes",
            {"status": "viewed", "viewed_at": now},
            params={
                "id": f"eq.{quote['id']}",
                "workspace_id": f"eq.{quote['workspace_id']}",
                "status": "eq.sent",
            },
        )
        rows = as_list(res) if res.status_code == 200 else []
        if rows:
            quote = rows[0]
            _event(svc, quote, "viewed", {"version": access_version})
            _audit(svc, quote, "quotes.view_public", {"version": access_version, "source": "public"})
        else:
            quote = _load_quote(svc, access)
    can_decide = (not superseded) and quote.get("status") in DECISION_STATES
    public["status"] = "superseded" if superseded else quote.get("status")
    public["superseded"] = superseded
    public["can_approve"] = can_decide
    public["can_reject"] = can_decide
    public["viewed_at"] = quote.get("viewed_at")
    public["approved_at"] = quote.get("approved_at")
    public["rejected_at"] = quote.get("rejected_at")
    return public


@router.get("/{token}")
def get_public_quote(
    token: str,
    svc: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    return _assemble(svc, token, mark_viewed=True)


@router.post("/{token}/approve")
def approve_public_quote(
    token: str,
    body: PublicDecisionIn,
    svc: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    access = _load_access(svc, token)
    quote = _maybe_expire(svc, _load_quote(svc, access))
    if int(quote.get("version") or 1) != int(access.get("version") or 1):
        raise ApiError(403, "RESOURCE_STATE", MESSAGES["RESOURCE_STATE"], {"state": "superseded"})
    if quote.get("status") not in DECISION_STATES:
        raise ApiError(403, "RESOURCE_STATE", MESSAGES["RESOURCE_STATE"], {"state": quote.get("status")})
    now = datetime.now(UTC).isoformat()
    name = (body.name or "").strip() or None
    patched = svc.patch(
        "quotes",
        {"status": "approved", "approved_at": now, "approved_name": name},
        params={
            "id": f"eq.{quote['id']}",
            "workspace_id": f"eq.{quote['workspace_id']}",
            "status": f"in.({','.join(DECISION_STATES)})",
            "version": f"eq.{access['version']}",
        },
    )
    rows = as_list(patched) if patched.status_code == 200 else []
    if not rows:
        raise ApiError(403, "RESOURCE_STATE", MESSAGES["RESOURCE_STATE"], {"state": quote.get("status")})
    quote = rows[0]
    _event(svc, quote, "approved", {"version": access["version"], "name": name})
    _audit(svc, quote, "quotes.approve", {"version": access["version"], "source": "public"})
    public = _public_from_version(_load_version(svc, access))
    public["status"] = "approved"
    public["superseded"] = False
    public["can_approve"] = False
    public["can_reject"] = False
    public["approved_at"] = quote.get("approved_at")
    return public


@router.post("/{token}/reject")
def reject_public_quote(
    token: str,
    body: PublicDecisionIn,
    svc: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    access = _load_access(svc, token)
    quote = _maybe_expire(svc, _load_quote(svc, access))
    if int(quote.get("version") or 1) != int(access.get("version") or 1):
        raise ApiError(403, "RESOURCE_STATE", MESSAGES["RESOURCE_STATE"], {"state": "superseded"})
    if quote.get("status") not in DECISION_STATES:
        raise ApiError(403, "RESOURCE_STATE", MESSAGES["RESOURCE_STATE"], {"state": quote.get("status")})
    now = datetime.now(UTC).isoformat()
    reason = (body.reason or "").strip() or None
    patched = svc.patch(
        "quotes",
        {"status": "rejected", "rejected_at": now, "rejection_reason": reason},
        params={
            "id": f"eq.{quote['id']}",
            "workspace_id": f"eq.{quote['workspace_id']}",
            "status": f"in.({','.join(DECISION_STATES)})",
            "version": f"eq.{access['version']}",
        },
    )
    rows = as_list(patched) if patched.status_code == 200 else []
    if not rows:
        raise ApiError(403, "RESOURCE_STATE", MESSAGES["RESOURCE_STATE"], {"state": quote.get("status")})
    quote = rows[0]
    _event(svc, quote, "rejected", {"version": access["version"], "reason": reason})
    _audit(svc, quote, "quotes.reject", {"version": access["version"], "source": "public"})
    public = _public_from_version(_load_version(svc, access))
    public["status"] = "rejected"
    public["superseded"] = False
    public["can_approve"] = False
    public["can_reject"] = False
    public["rejected_at"] = quote.get("rejected_at")
    return public
