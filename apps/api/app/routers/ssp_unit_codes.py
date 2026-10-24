"""Manager APIs: issue, display, and revoke rotating SSP unit-login codes."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from ..audit import write_audit
from ..deps import UserClient, current_user, load_authz_context, service_client, user_client
from ..errors import ApiError, MESSAGES
from ..identity import actor_id
from ..rest import as_list, created_or_403, one_or_404, patched_or_403
from ..ssp.product_authz import (
    assert_site_in_scope,
    catalog_allows,
    load_company,
    load_member_site_ids,
    require_ssp_action,
)
from ..ssp.site_assignments import parse_dt
from ..ssp.unit_login import (
    format_unit_code_display,
    hash_unit_code,
    new_unit_login_code,
    remaining_seconds,
    unit_code_expires_at,
    unit_code_status_at,
)
from ..supabase_service import ServiceClient

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}/ssp", tags=["ssp-unit-login"])

SITE_SELECT = (
    "id,workspace_id,company_pk,site_id,name,phone,description,"
    "org_unit_id,department_id,manager_user_id,is_active,kind,created_at,updated_at"
)
CODE_PUBLIC_SELECT = (
    "id,workspace_id,company_pk,site_pk,status,created_by,created_at,"
    "expires_at,redeemed_at,revoked_at"
)
CODE_SVC_SELECT = CODE_PUBLIC_SELECT + ",display_code"


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


def _require_company(client: UserClient, workspace_id: UUID) -> dict[str, Any]:
    company = load_company(client, workspace_id=str(workspace_id))
    if not company:
        raise ApiError(400, "BUSINESS_RULE", "יש להגדיר חברת SSP לפני ניהול יחידות")
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


def _guard_site(ctx, client: UserClient, membership: dict[str, Any] | None, site: dict[str, Any]) -> None:
    assert_site_in_scope(
        membership,
        site,
        catalog_unscoped=catalog_allows(ctx, "ssp.sites.edit") or catalog_allows(ctx, "ssp.forms.edit"),
        member_site_ids=_member_ids(client, UUID(str(ctx.workspace_id)), ctx.user_id),
        actor_user_id=ctx.user_id,
    )


def _require_manager(ctx, client: UserClient):
    membership = require_ssp_action(
        ctx, client, catalog_action="ssp.forms.edit", product_action="ssp.sites.edit"
    )
    if membership and membership.get("product_role") == "patrol_officer":
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    return membership


def _assert_actor_kind(site: dict[str, Any]) -> None:
    if str(site.get("kind") or "") not in {"office", "ops_center"}:
        raise ApiError(400, "BUSINESS_RULE", "קוד יחידה זמין רק למשרד או למוקד תפעולי")


class EmptyIn(BaseModel):
    model_config = ConfigDict(extra="forbid")


def _public_code_row(row: dict[str, Any], *, include_code: bool) -> dict[str, Any]:
    now = datetime.now(UTC)
    expires = parse_dt(row.get("expires_at"))
    status = unit_code_status_at(str(row.get("status") or ""), expires, now)
    plaintext = str(row.get("display_code") or "") if include_code and status == "active" else ""
    return {
        "id": row.get("id"),
        "site_pk": row.get("site_pk"),
        "status": status,
        "created_at": row.get("created_at"),
        "expires_at": row.get("expires_at"),
        "redeemed_at": row.get("redeemed_at"),
        "revoked_at": row.get("revoked_at"),
        "remaining_seconds": remaining_seconds(expires, now) if status == "active" else 0,
        "code": format_unit_code_display(plaintext) if plaintext else None,
    }


@router.get("/sites/{site_pk}/unit-login-code")
def get_unit_login_code(
    workspace_id: UUID,
    site_pk: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = _require_manager(ctx, client)
    site = _load_site(client, workspace_id, site_pk)
    _guard_site(ctx, client, membership, site)
    _assert_actor_kind(site)
    rows = as_list(
        svc.get(
            "ssp_unit_login_codes",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "site_pk": f"eq.{site_pk}",
                "status": "eq.active",
                "select": CODE_SVC_SELECT,
                "order": "created_at.desc",
                "limit": "1",
            },
        )
    )
    if not rows:
        return {
            "code": None,
            "status": None,
            "site": {"id": site["id"], "name": site.get("name"), "kind": site.get("kind")},
            "remaining_seconds": 0,
        }
    public = _public_code_row(rows[0], include_code=True)
    return {
        **public,
        "site": {"id": site["id"], "name": site.get("name"), "kind": site.get("kind")},
    }


@router.post("/sites/{site_pk}/unit-login-codes", status_code=201)
def issue_unit_login_code(
    workspace_id: UUID,
    site_pk: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
    _body: EmptyIn | None = None,
):
    ctx = _ctx(client, user, workspace_id)
    membership = _require_manager(ctx, client)
    site = _load_site(client, workspace_id, site_pk)
    _guard_site(ctx, client, membership, site)
    _assert_actor_kind(site)
    if not site.get("is_active"):
        raise ApiError(400, "BUSINESS_RULE", "לא ניתן להפיק קוד ליחידה שאינה פעילה")
    company = _require_company(client, workspace_id)
    now_iso = datetime.now(UTC).isoformat()
    svc.patch(
        "ssp_unit_login_codes",
        json={"status": "superseded", "revoked_at": now_iso, "display_code": None},
        params={
            "workspace_id": f"eq.{workspace_id}",
            "site_pk": f"eq.{site_pk}",
            "status": "eq.active",
        },
    )
    plaintext = new_unit_login_code()
    expires = unit_code_expires_at()
    row = created_or_403(
        svc.post(
            "ssp_unit_login_codes",
            json={
                "workspace_id": str(workspace_id),
                "company_pk": company["id"],
                "site_pk": str(site_pk),
                "code_hash": hash_unit_code(plaintext),
                "display_code": plaintext,
                "status": "active",
                "created_by": ctx.user_id,
                "expires_at": expires.isoformat(),
            },
            params={"select": CODE_SVC_SELECT},
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.unit_login_code.issue",
        entity_type="ssp_site",
        entity_id=str(site_pk),
        metadata={"code_id": row.get("id"), "expires_at": row.get("expires_at")},
    )
    public = _public_code_row(row, include_code=True)
    return {
        **public,
        "site": {"id": site["id"], "name": site.get("name"), "kind": site.get("kind")},
    }


@router.post("/unit-login-codes/{code_id}/revoke")
def revoke_unit_login_code(
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
            "ssp_unit_login_codes",
            params={
                "id": f"eq.{code_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": CODE_PUBLIC_SELECT,
            },
        )
    )
    site = _load_site(client, workspace_id, UUID(str(row["site_pk"])))
    _guard_site(ctx, client, membership, site)
    if row.get("status") != "active":
        raise ApiError(400, "BUSINESS_RULE", "ניתן לבטל רק קוד שטרם נוצל")
    updated = patched_or_403(
        svc.patch(
            "ssp_unit_login_codes",
            json={
                "status": "revoked",
                "revoked_at": datetime.now(UTC).isoformat(),
                "display_code": None,
            },
            params={
                "id": f"eq.{code_id}",
                "workspace_id": f"eq.{workspace_id}",
                "status": "eq.active",
                "select": CODE_PUBLIC_SELECT,
            },
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.unit_login_code.revoke",
        entity_type="ssp_unit_login_code",
        entity_id=str(code_id),
        metadata={"site_pk": str(site["id"])},
    )
    return {**_public_code_row(updated, include_code=False), "code": None}


@router.post("/sites/{site_pk}/unit-sessions/revoke")
def revoke_unit_sessions(
    workspace_id: UUID,
    site_pk: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = _require_manager(ctx, client)
    site = _load_site(client, workspace_id, site_pk)
    _guard_site(ctx, client, membership, site)
    now_iso = datetime.now(UTC).isoformat()
    svc.patch(
        "ssp_unit_sessions",
        json={"status": "revoked", "revoked_at": now_iso},
        params={
            "workspace_id": f"eq.{workspace_id}",
            "site_pk": f"eq.{site_pk}",
            "status": "eq.active",
        },
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.unit_session.revoke",
        entity_type="ssp_site",
        entity_id=str(site_pk),
        metadata={"identity": "unit"},
    )
    return {"ok": True, "site_pk": str(site_pk)}
