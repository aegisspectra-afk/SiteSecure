"""Manager APIs: issue/revoke activation codes, decide enrollments, unlink devices."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from datetime import UTC, datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..audit import write_audit
from ..deps import UserClient, current_user, load_authz_context, service_client, user_client
from ..errors import ApiError, MESSAGES
from ..identity import actor_id
from ..rest import as_list, created_or_403, one_or_404, patched_or_403
from ..ssp.activation_codes import (
    can_approve_enrollment,
    classify_site_activation,
    code_expires_at,
    code_status_at,
    hash_activation_code,
    is_valid_activation_code_format,
    new_activation_code,
    normalize_activation_code,
    raise_uniform_invalid,
)
from ..ssp.product_authz import (
    assert_site_in_scope,
    catalog_allows,
    filter_sites_for_membership,
    load_company,
    load_member_site_ids,
    require_ssp_action,
)
from ..ssp.site_assignments import classify_assignment, parse_dt
from ..supabase_service import ServiceClient

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}/ssp", tags=["ssp-site-activation"])

_join_fail_window: dict[str, deque[float]] = defaultdict(deque)
_JOIN_WINDOW_SEC = 600
_JOIN_FAIL_MAX = 8


def _check_join_rate(user_id: str) -> None:
    now = time.time()
    window = _join_fail_window[user_id]
    while window and now - window[0] > _JOIN_WINDOW_SEC:
        window.popleft()
    if len(window) >= _JOIN_FAIL_MAX:
        raise ApiError(429, "RATE_LIMITED", "יותר מדי ניסיונות. נסו שוב מאוחר יותר.")


def _record_join_failure(user_id: str) -> None:
    _join_fail_window[user_id].append(time.time())

SITE_SELECT = (
    "id,workspace_id,company_pk,site_id,name,phone,description,admin_notes,"
    "org_unit_id,department_id,manager_user_id,is_active,kind,created_at,updated_at"
)
CODE_SELECT = (
    "id,workspace_id,company_pk,site_pk,status,created_by,created_at,expires_at,"
    "redeemed_at,revoked_at,enrollment_id,audience,invited_role"
)
ENROLL_SELECT = (
    "id,workspace_id,company_pk,site_pk,code_id,status,device_label,created_at,"
    "expires_at,decided_at,decided_by,device_id,audience,requested_user_id,invited_role"
)
DEVICE_SELECT = (
    "id,workspace_id,company_pk,site_pk,enrollment_id,status,device_label,"
    "approved_by,approved_at,last_seen_at,revoked_at,revoked_by,created_at"
)


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


def _require_company(client: UserClient, workspace_id: UUID) -> dict[str, Any]:
    company = load_company(client, workspace_id=str(workspace_id))
    if not company:
        raise ApiError(400, "BUSINESS_RULE", "יש להגדיר חברת SSP לפני ניהול אתרים")
    return company


def _member_ids(client: UserClient, workspace_id: UUID, user_id: str) -> set[str]:
    try:
        return load_member_site_ids(client, workspace_id=str(workspace_id), user_id=user_id)
    except ApiError:
        return set()


def _load_site(client: UserClient, workspace_id: UUID, site_pk: UUID) -> dict[str, Any]:
    return one_or_404(
        client.get(
            "ssp_sites",
            params={"id": f"eq.{site_pk}", "workspace_id": f"eq.{workspace_id}", "select": SITE_SELECT},
        )
    )


def _guard_site(ctx, client: UserClient, membership: dict[str, Any] | None, site: dict[str, Any], *, catalog_action: str) -> None:
    assert_site_in_scope(
        membership,
        site,
        catalog_unscoped=catalog_allows(ctx, catalog_action),
        member_site_ids=_member_ids(client, UUID(str(ctx.workspace_id)), ctx.user_id),
        actor_user_id=ctx.user_id,
    )


def _try_list(client: UserClient, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
    res = client.get(table, params=params)
    if res.status_code != 200:
        return []
    data = res.json()
    return data if isinstance(data, list) else []


def _require_manager(ctx, client: UserClient):
    membership = require_ssp_action(
        ctx, client, catalog_action="ssp.forms.edit", product_action="ssp.sites.edit"
    )
    if membership and membership.get("product_role") == "patrol_officer":
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    return membership


class NotesPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    admin_notes: str | None = Field(default=None, max_length=2000)


class IssueCodeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    audience: Literal["device", "user"] = "device"
    invited_role: Literal["patrol_officer", "patrol_manager"] | None = None


class UserJoinIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=4, max_length=32)


# ── Issue / list / revoke codes ───────────────────────────────────────────────


@router.get("/sites/{site_pk}/activation-codes")
def list_activation_codes(
    workspace_id: UUID,
    site_pk: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(
        ctx, client, catalog_action="ssp.forms.view", product_action="ssp.sites.view"
    )
    site = _load_site(client, workspace_id, site_pk)
    _guard_site(ctx, client, membership, site, catalog_action="ssp.forms.view")
    items = _try_list(
        client,
        "ssp_site_activation_codes",
        {
            "workspace_id": f"eq.{workspace_id}",
            "site_pk": f"eq.{site_pk}",
            "select": CODE_SELECT,
            "order": "created_at.desc",
        },
    )
    now = datetime.now(UTC)
    public = []
    for row in items:
        public.append(
            {
                **row,
                "status": code_status_at(str(row.get("status") or ""), parse_dt(row.get("expires_at")), now),
                "code": None,
            }
        )
    return {"items": public}


@router.post("/sites/{site_pk}/activation-codes", status_code=201)
def issue_activation_code(
    workspace_id: UUID,
    site_pk: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
    body: IssueCodeIn | None = None,
):
    ctx = _ctx(client, user, workspace_id)
    membership = _require_manager(ctx, client)
    site = _load_site(client, workspace_id, site_pk)
    _guard_site(ctx, client, membership, site, catalog_action="ssp.forms.edit")
    if not site.get("is_active"):
        raise ApiError(400, "BUSINESS_RULE", "לא ניתן להפיק קוד לאתר שאינו פעיל")
    company = _require_company(client, workspace_id)
    spec = body or IssueCodeIn()
    audience = spec.audience
    invited_role = spec.invited_role or "patrol_officer"
    if invited_role not in {"patrol_officer", "patrol_manager"}:
        invited_role = "patrol_officer"
    live = _try_list(
        client,
        "ssp_site_activation_codes",
        {
            "workspace_id": f"eq.{workspace_id}",
            "site_pk": f"eq.{site_pk}",
            "status": "eq.active",
            "audience": f"eq.{audience}",
            "select": "id",
        },
    )
    if live:
        svc.patch(
            "ssp_site_activation_codes",
            json={"status": "revoked", "revoked_at": datetime.now(UTC).isoformat()},
            params={
                "workspace_id": f"eq.{workspace_id}",
                "site_pk": f"eq.{site_pk}",
                "status": "eq.active",
                "audience": f"eq.{audience}",
            },
        )
    plaintext = new_activation_code()
    expires = code_expires_at()
    row = created_or_403(
        svc.post(
            "ssp_site_activation_codes",
            json={
                "workspace_id": str(workspace_id),
                "company_pk": company["id"],
                "site_pk": str(site_pk),
                "code_hash": hash_activation_code(plaintext),
                "status": "active",
                "created_by": ctx.user_id,
                "expires_at": expires.isoformat(),
                "audience": audience,
                "invited_role": invited_role,
            },
            params={"select": CODE_SELECT},
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.activation_code.issue",
        entity_type="ssp_site",
        entity_id=str(site_pk),
        metadata={"code_id": row["id"], "expires_at": row.get("expires_at"), "audience": audience},
    )
    join_path = f"/app/ssp/join?code={plaintext}" if audience == "user" else None
    return {**row, "code": plaintext, "join_path": join_path}


@router.post("/join")
def request_site_user_join(
    workspace_id: UUID,
    body: UserJoinIn,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    """Authenticated user redeems a user-audience code into a pending join request."""
    ctx = _ctx(client, user, workspace_id)
    from ..ssp.product_authz import feature_gate

    feature_gate(ctx)
    _check_join_rate(ctx.user_id)
    code = normalize_activation_code(body.code)
    if not is_valid_activation_code_format(code):
        _record_join_failure(ctx.user_id)
        raise_uniform_invalid()
    wm = client.get(
        "workspace_memberships",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "user_id": f"eq.{ctx.user_id}",
            "status": "eq.active",
            "select": "user_id,role_key",
            "limit": "1",
        },
    )
    if wm.status_code != 200 or not (wm.json() or []):
        _record_join_failure(ctx.user_id)
        raise_uniform_invalid()
    rpc = svc.rpc(
        "ssp_request_site_user_join",
        {
            "p_code_hash": hash_activation_code(code),
            "p_user_id": ctx.user_id,
            "p_user_agent": None,
        },
    )
    payload: Any = {}
    if rpc.status_code in {200, 201} and rpc.content:
        payload = rpc.json()
    if isinstance(payload, list) and payload:
        payload = payload[0]
    if not isinstance(payload, dict) or not payload.get("ok"):
        _record_join_failure(ctx.user_id)
        raise_uniform_invalid()
    if str(payload.get("workspace_id")) != str(workspace_id):
        _record_join_failure(ctx.user_id)
        raise_uniform_invalid()
    site_rows = as_list(
        svc.get(
            "ssp_sites",
            params={
                "id": f"eq.{payload['site_pk']}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,name,is_active",
                "limit": "1",
            },
        )
    )
    site = site_rows[0] if site_rows else {"id": payload["site_pk"], "name": None}
    write_audit(
        client,
        str(workspace_id),
        "ssp.site_join.request",
        entity_type="ssp_site",
        entity_id=str(site["id"]),
        metadata={"enrollment_id": payload.get("enrollment_id")},
    )
    return {
        "status": "pending",
        "enrollment_id": payload.get("enrollment_id"),
        "site_name": site.get("name"),
        "message": "בקשת ההצטרפות נשלחה וממתינה לאישור מנהל",
    }


@router.post("/activation-codes/{code_id}/revoke")
def revoke_activation_code(
    workspace_id: UUID,
    code_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = _require_manager(ctx, client)
    row = one_or_404(
        client.get(
            "ssp_site_activation_codes",
            params={"id": f"eq.{code_id}", "workspace_id": f"eq.{workspace_id}", "select": CODE_SELECT},
        )
    )
    site = _load_site(client, workspace_id, UUID(str(row["site_pk"])))
    _guard_site(ctx, client, membership, site, catalog_action="ssp.forms.edit")
    if row.get("status") != "active":
        raise ApiError(400, "BUSINESS_RULE", "ניתן לבטל רק קוד שטרם נוצל")
    updated = patched_or_403(
        svc.patch(
            "ssp_site_activation_codes",
            json={"status": "revoked", "revoked_at": datetime.now(UTC).isoformat()},
            params={
                "id": f"eq.{code_id}",
                "workspace_id": f"eq.{workspace_id}",
                "status": "eq.active",
                "select": CODE_SELECT,
            },
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.activation_code.revoke",
        entity_type="ssp_activation_code",
        entity_id=str(code_id),
        metadata={"site_pk": str(site["id"])},
    )
    return {**updated, "code": None}


# ── Enrollments ────────────────────────────────────────────────────────────────


@router.get("/enrollments")
def list_enrollments(
    workspace_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    status: str | None = Query(default=None),
    site_id: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(
        ctx, client, catalog_action="ssp.forms.view", product_action="ssp.sites.view"
    )
    company = load_company(client, workspace_id=str(workspace_id))
    if not company:
        return {"items": [], "data_mode": "empty"}
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "company_pk": f"eq.{company['id']}",
        "select": ENROLL_SELECT,
        "order": "created_at.desc",
    }
    if status:
        params["status"] = f"eq.{status}"
    if site_id:
        params["site_pk"] = f"eq.{site_id}"
    items = _try_list(client, "ssp_site_enrollments", params)
    sites = {
        str(s["id"]): s
        for s in filter_sites_for_membership(
            _try_list(
                client,
                "ssp_sites",
                {
                    "workspace_id": f"eq.{workspace_id}",
                    "company_pk": f"eq.{company['id']}",
                    "select": SITE_SELECT,
                },
            ),
            membership,
            catalog_unscoped=catalog_allows(ctx, "ssp.forms.view"),
            member_site_ids=_member_ids(client, workspace_id, ctx.user_id),
            actor_user_id=ctx.user_id,
        )
    }
    out = []
    for row in items:
        site = sites.get(str(row.get("site_pk")))
        if not site:
            continue
        out.append(
            {
                **row,
                "site_name": site.get("name"),
                "site_phone": site.get("phone"),
                "site_public_id": site.get("site_id"),
            }
        )
    return {"items": out, "data_mode": "live" if out else "empty"}


def _decide_enrollment(
    workspace_id: UUID,
    enrollment_id: UUID,
    user: dict,
    client: UserClient,
    svc: ServiceClient,
    decision: str,
) -> dict[str, Any]:
    ctx = _ctx(client, user, workspace_id)
    membership = _require_manager(ctx, client)
    row = one_or_404(
        client.get(
            "ssp_site_enrollments",
            params={"id": f"eq.{enrollment_id}", "workspace_id": f"eq.{workspace_id}", "select": ENROLL_SELECT},
        )
    )
    site = _load_site(client, workspace_id, UUID(str(row["site_pk"])))
    _guard_site(ctx, client, membership, site, catalog_action="ssp.forms.edit")
    code = one_or_404(
        client.get(
            "ssp_site_activation_codes",
            params={"id": f"eq.{row['code_id']}", "workspace_id": f"eq.{workspace_id}", "select": CODE_SELECT},
        )
    )
    now = datetime.now(UTC)
    if decision == "approved":
        if not can_approve_enrollment(
            enrollment_status=str(row.get("status") or ""),
            site_is_active=bool(site.get("is_active")),
            code_status=str(code.get("status") or ""),
        ):
            raise ApiError(400, "BUSINESS_RULE", "לא ניתן לאשר את בקשת הקישור")
        if parse_dt(row.get("expires_at")) and parse_dt(row.get("expires_at")) <= now:
            raise ApiError(400, "BUSINESS_RULE", "פג תוקף הבקשה")
        user_join = str(row.get("audience") or "device") == "user" or bool(row.get("requested_user_id"))
        rpc = svc.rpc(
            "ssp_approve_site_user_join" if user_join else "ssp_approve_site_enrollment",
            {"p_enrollment_id": str(enrollment_id), "p_decided_by": ctx.user_id},
        )
        payload: Any = {}
        if rpc.status_code in {200, 201} and rpc.content:
            payload = rpc.json()
        if isinstance(payload, list) and payload:
            payload = payload[0]
        if not isinstance(payload, dict) or not payload.get("ok"):
            raise ApiError(400, "BUSINESS_RULE", "לא ניתן לאשר את בקשת הקישור")
        if str(payload.get("workspace_id")) != str(workspace_id) or str(payload.get("site_pk")) != str(site["id"]):
            raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
        updated = one_or_404(
            svc.get(
                "ssp_site_enrollments",
                params={
                    "id": f"eq.{enrollment_id}",
                    "workspace_id": f"eq.{workspace_id}",
                    "select": ENROLL_SELECT,
                },
            )
        )
        device_id = payload.get("device_id")
        write_audit(
            client,
            str(workspace_id),
            "ssp.enrollment.approve",
            entity_type="ssp_site_enrollment",
            entity_id=str(enrollment_id),
            metadata={
                "site_pk": str(site["id"]),
                "device_id": device_id,
                "user_id": payload.get("user_id") or row.get("requested_user_id"),
                "audience": row.get("audience") or "device",
            },
        )
        return {**updated, "device_id": device_id, "user_id": payload.get("user_id")}
    if row.get("status") != "pending":
        raise ApiError(400, "BUSINESS_RULE", "הבקשה כבר הוכרעה")
    updated = patched_or_403(
        svc.patch(
            "ssp_site_enrollments",
            json={
                "status": decision,
                "decided_at": now.isoformat(),
                "decided_by": ctx.user_id,
            },
            params={
                "id": f"eq.{enrollment_id}",
                "workspace_id": f"eq.{workspace_id}",
                "status": "eq.pending",
                "select": ENROLL_SELECT,
            },
        )
    )
    write_audit(
        client,
        str(workspace_id),
        f"ssp.enrollment.{decision}",
        entity_type="ssp_site_enrollment",
        entity_id=str(enrollment_id),
        metadata={"site_pk": str(site["id"])},
    )
    return updated


@router.post("/enrollments/{enrollment_id}/approve")
def approve_enrollment(
    workspace_id: UUID,
    enrollment_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    return _decide_enrollment(workspace_id, enrollment_id, user, client, svc, "approved")


@router.post("/enrollments/{enrollment_id}/deny")
def deny_enrollment(
    workspace_id: UUID,
    enrollment_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    return _decide_enrollment(workspace_id, enrollment_id, user, client, svc, "denied")


@router.post("/enrollments/{enrollment_id}/cancel")
def cancel_enrollment(
    workspace_id: UUID,
    enrollment_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    return _decide_enrollment(workspace_id, enrollment_id, user, client, svc, "cancelled")


# ── Devices ────────────────────────────────────────────────────────────────────


@router.get("/sites/{site_pk}/devices")
def list_site_devices(
    workspace_id: UUID,
    site_pk: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(
        ctx, client, catalog_action="ssp.forms.view", product_action="ssp.sites.view"
    )
    site = _load_site(client, workspace_id, site_pk)
    _guard_site(ctx, client, membership, site, catalog_action="ssp.forms.view")
    items = _try_list(
        client,
        "ssp_site_devices",
        {
            "workspace_id": f"eq.{workspace_id}",
            "site_pk": f"eq.{site_pk}",
            "select": DEVICE_SELECT,
            "order": "created_at.desc",
        },
    )
    sessions = _try_list(
        client,
        "ssp_site_device_sessions",
        {
            "workspace_id": f"eq.{workspace_id}",
            "site_pk": f"eq.{site_pk}",
            "select": "id,device_id,status,expires_at,last_seen_at",
        },
    )
    by_dev: dict[str, list] = {}
    for s in sessions:
        by_dev.setdefault(str(s.get("device_id")), []).append(s)
    out = []
    for d in items:
        sess = by_dev.get(str(d["id"]), [])
        live = [s for s in sess if s.get("status") == "active"]
        out.append({**d, "session_status": live[0]["status"] if live else "none", "sessions": len(live)})
    return {"items": out}


@router.post("/devices/{device_id}/revoke")
def revoke_device(
    workspace_id: UUID,
    device_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = _require_manager(ctx, client)
    device = one_or_404(
        client.get(
            "ssp_site_devices",
            params={"id": f"eq.{device_id}", "workspace_id": f"eq.{workspace_id}", "select": DEVICE_SELECT},
        )
    )
    site = _load_site(client, workspace_id, UUID(str(device["site_pk"])))
    _guard_site(ctx, client, membership, site, catalog_action="ssp.forms.edit")
    now = datetime.now(UTC).isoformat()
    updated = patched_or_403(
        svc.patch(
            "ssp_site_devices",
            json={"status": "revoked", "revoked_at": now, "revoked_by": ctx.user_id},
            params={"id": f"eq.{device_id}", "workspace_id": f"eq.{workspace_id}", "select": DEVICE_SELECT},
        )
    )
    svc.patch(
        "ssp_site_device_sessions",
        json={"status": "revoked", "revoked_at": now},
        params={"device_id": f"eq.{device_id}", "workspace_id": f"eq.{workspace_id}", "status": "eq.active"},
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.device.revoke",
        entity_type="ssp_site_device",
        entity_id=str(device_id),
        metadata={"site_pk": str(site["id"])},
    )
    return updated


@router.post("/devices/{device_id}/revoke-session")
def revoke_device_session(
    workspace_id: UUID,
    device_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = _require_manager(ctx, client)
    device = one_or_404(
        client.get(
            "ssp_site_devices",
            params={"id": f"eq.{device_id}", "workspace_id": f"eq.{workspace_id}", "select": DEVICE_SELECT},
        )
    )
    site = _load_site(client, workspace_id, UUID(str(device["site_pk"])))
    _guard_site(ctx, client, membership, site, catalog_action="ssp.forms.edit")
    now = datetime.now(UTC).isoformat()
    svc.patch(
        "ssp_site_device_sessions",
        json={"status": "revoked", "revoked_at": now},
        params={"device_id": f"eq.{device_id}", "workspace_id": f"eq.{workspace_id}", "status": "eq.active"},
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.device.session_revoke",
        entity_type="ssp_site_device",
        entity_id=str(device_id),
        metadata={"site_pk": str(site["id"])},
    )
    return {**device, "session_status": "revoked"}


def annotate_sites(client: UserClient, workspace_id: UUID, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Attach activation / assignment summaries. Missing tables → zeros."""
    if not items:
        return items
    ids = [str(s["id"]) for s in items]
    id_filter = f"in.({','.join(ids)})"
    devices = _try_list(
        client,
        "ssp_site_devices",
        {"workspace_id": f"eq.{workspace_id}", "site_pk": id_filter, "select": "id,site_pk,status"},
    )
    enrollments = _try_list(
        client,
        "ssp_site_enrollments",
        {
            "workspace_id": f"eq.{workspace_id}",
            "site_pk": id_filter,
            "select": "id,site_pk,status,audience",
        },
    )
    members = _try_list(
        client,
        "ssp_site_members",
        {"workspace_id": f"eq.{workspace_id}", "site_pk": id_filter, "select": "id,site_pk,user_id"},
    )
    codes = _try_list(
        client,
        "ssp_site_activation_codes",
        {"workspace_id": f"eq.{workspace_id}", "site_pk": id_filter, "select": "id,site_pk,status,expires_at"},
    )
    assigns = _try_list(
        client,
        "ssp_form_site_assignments",
        {
            "workspace_id": f"eq.{workspace_id}",
            "site_pk": id_filter,
            "select": "id,site_pk,status,starts_at,due_at",
        },
    )
    assign_ids = [str(a["id"]) for a in assigns]
    submitted: set[str] = set()
    if assign_ids:
        subs = _try_list(
            client,
            "ssp_form_submissions",
            {
                "workspace_id": f"eq.{workspace_id}",
                "site_assignment_id": f"in.({','.join(assign_ids)})",
                "select": "site_assignment_id",
            },
        )
        submitted = {str(s["site_assignment_id"]) for s in subs if s.get("site_assignment_id")}
    now = datetime.now(UTC)
    out = []
    for site in items:
        sid = str(site["id"])
        site_devs = [d for d in devices if str(d.get("site_pk")) == sid]
        site_en = [e for e in enrollments if str(e.get("site_pk")) == sid]
        site_codes = [c for c in codes if str(c.get("site_pk")) == sid]
        site_asg = [a for a in assigns if str(a.get("site_pk")) == sid]
        site_mem = [m for m in members if str(m.get("site_pk")) == sid]
        pending_user_joins = sum(
            1 for e in site_en if e.get("status") == "pending" and str(e.get("audience") or "device") == "user"
        )
        submitted_count = sum(1 for a in site_asg if str(a.get("id")) in submitted)
        overdue = 0
        for a in site_asg:
            bucket = classify_assignment(
                status=str(a.get("status") or ""),
                starts_at=a.get("starts_at"),
                due_at=a.get("due_at"),
                has_submission=str(a.get("id")) in submitted,
                now=now,
            )
            if bucket == "overdue":
                overdue += 1
        live_codes = [
            c
            for c in site_codes
            if code_status_at(str(c.get("status") or ""), parse_dt(c.get("expires_at")), now) == "active"
        ]
        activation = classify_site_activation(
            has_active_device=any(d.get("status") == "active" for d in site_devs),
            has_pending_enrollment=any(e.get("status") == "pending" for e in site_en),
            has_live_code=bool(live_codes),
        )
        seen_at = [str(d.get("last_seen_at")) for d in site_devs if d.get("last_seen_at")]
        out.append(
            {
                **site,
                "activation_status": activation,
                "assigned_forms_count": len(site_asg),
                "overdue_count": overdue,
                "active_devices_count": sum(1 for d in site_devs if d.get("status") == "active"),
                "last_device_seen_at": max(seen_at) if seen_at else None,
                "members_count": len(site_mem),
                "pending_join_count": pending_user_joins,
                "submissions_count": submitted_count,
            }
        )
    return out
