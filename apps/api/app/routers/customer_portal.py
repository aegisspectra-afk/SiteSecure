"""Staff controls and customer portal reads.

Portal principals are authenticated Supabase users with a customer_portal_access
row. They are never inserted into workspace_memberships.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import write_audit
from ..authz.engine import authorize
from ..deps import current_user, load_authz_context, service_client, user_client
from ..errors import MESSAGES, ApiError
from ..portal_access import (
    INVITE_TTL,
    PORTAL_DOCUMENT_BUCKETS,
    PORTAL_VIEW_CAPABILITIES,
    QUOTE_PORTAL_STATUSES,
    document_visible,
    has_capability,
    normalize_portal_email,
    portal_ui_status,
    project_document,
    project_equipment,
    project_installation,
    project_profile,
    project_quote,
    project_service_call,
    project_site,
    project_warranty,
    should_touch_login,
)
from ..rest import as_list, created_or_403
from ..supabase_service import ServiceClient
from ..supabase_user import UserClient

router = APIRouter(prefix="/api/v1", tags=["customer-portal"])


class PortalEnableIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=320)


class PortalTokenIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(min_length=16, max_length=512)


def _now() -> datetime:
    return datetime.now(UTC)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _raise_decision(decision) -> None:
    if not decision.allowed:
        status = 401 if decision.code == "UNAUTHENTICATED" else 403
        raise ApiError(status, decision.code or "PERMISSION_DENIED", decision.message_he, decision.details)


def _require_customer(client: UserClient, workspace_id: UUID, customer_id: UUID) -> dict:
    res = client.get(
        "customers",
        params={
            "id": f"eq.{customer_id}",
            "workspace_id": f"eq.{workspace_id}",
            "deleted_at": "is.null",
            "select": "id,email",
        },
    )
    rows = as_list(res)
    if not rows:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    return rows[0]


def _contact_id(client: UserClient, workspace_id: UUID, customer_id: UUID, email: str) -> str | None:
    res = client.get(
        "customer_contacts",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "customer_id": f"eq.{customer_id}",
            "select": "id,email",
        },
    )
    for row in as_list(res):
        if str(row.get("email") or "").strip().lower() == email:
            return str(row["id"])
    return None


def _live_access(service: ServiceClient, workspace_id: UUID, customer_id: UUID, email: str) -> dict | None:
    res = service.get(
        "customer_portal_access",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "customer_id": f"eq.{customer_id}",
            "email": f"eq.{email}",
            "status": "in.(invited,active)",
            "select": "id,status",
            "limit": "1",
        },
    )
    rows = as_list(res)
    return rows[0] if rows else None


def _access_or_404(service: ServiceClient, workspace_id: UUID, customer_id: UUID, access_id: UUID) -> dict:
    res = service.get(
        "customer_portal_access",
        params={
            "id": f"eq.{access_id}",
            "workspace_id": f"eq.{workspace_id}",
            "customer_id": f"eq.{customer_id}",
            "select": "*",
            "limit": "1",
        },
    )
    rows = as_list(res)
    if not rows:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    return rows[0]


def _latest_invites(service: ServiceClient, access_ids: list[str]) -> dict[str, dict]:
    if not access_ids:
        return {}
    joined = ",".join(access_ids)
    res = service.get(
        "customer_portal_invite",
        params={
            "access_id": f"in.({joined})",
            "select": "id,access_id,expires_at,consumed_at,revoked_at,created_at",
            "order": "created_at.desc",
        },
    )
    found: dict[str, dict] = {}
    for row in as_list(res):
        key = str(row["access_id"])
        if key not in found:
            found[key] = row
    return found


def _public_access(row: dict, invite: dict | None) -> dict:
    status = portal_ui_status(row, invite)
    expires = (invite or {}).get("expires_at")
    return {
        "id": row["id"],
        "email": row["email"],
        "status": status,
        "contact_id": row.get("contact_id"),
        "last_login_at": row.get("last_login_at"),
        "expires_at": expires if status in {"invited", "expired"} else None,
    }


def _mint_invite(
    service: ServiceClient,
    access_id: str,
    actor_id: str,
    *,
    delivery: str,
) -> str:
    service.patch(
        "customer_portal_invite",
        {"revoked_at": _now().isoformat()},
        params={
            "access_id": f"eq.{access_id}",
            "consumed_at": "is.null",
            "revoked_at": "is.null",
        },
    )
    token = secrets.token_urlsafe(32)
    created_or_403(
        service.post(
            "customer_portal_invite",
            {
                "access_id": access_id,
                "token_hash": _hash_token(token),
                "expires_at": (_now() + INVITE_TTL).isoformat(),
                "delivery": delivery,
                "created_by": actor_id,
            },
        )
    )
    return token


def _rpc_error(text: str) -> ApiError:
    if "PORTAL_INVITE_EMAIL_MISMATCH" in text:
        return ApiError(403, "PORTAL_INVITE_EMAIL_MISMATCH", MESSAGES["PORTAL_INVITE_EMAIL_MISMATCH"])
    if "UNAUTHENTICATED" in text:
        return ApiError(401, "UNAUTHENTICATED", MESSAGES["UNAUTHENTICATED"])
    return ApiError(400, "PORTAL_INVITE_INVALID", MESSAGES["PORTAL_INVITE_INVALID"])


@router.get("/workspaces/{workspace_id}/customers/{customer_id}/portal")
def list_customer_portal(
    workspace_id: UUID,
    customer_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    service: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    _raise_decision(authorize(ctx=ctx, action="customer_portal.view"))
    _require_customer(client, workspace_id, customer_id)
    res = service.get(
        "customer_portal_access",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "customer_id": f"eq.{customer_id}",
            "select": "id,email,status,contact_id,last_login_at,created_at",
            "order": "created_at.desc",
        },
    )
    rows = as_list(res)
    invites = _latest_invites(service, [str(row["id"]) for row in rows])
    return {"access": [_public_access(row, invites.get(str(row["id"]))) for row in rows]}


@router.post("/workspaces/{workspace_id}/customers/{customer_id}/portal")
def enable_customer_portal(
    workspace_id: UUID,
    customer_id: UUID,
    body: PortalEnableIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    service: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    _raise_decision(authorize(ctx=ctx, action="customer_portal.create"))
    _require_customer(client, workspace_id, customer_id)
    try:
        email = normalize_portal_email(body.email)
    except ValueError:
        raise ApiError(400, "VALIDATION_ERROR", MESSAGES["VALIDATION_ERROR"]) from None
    if _live_access(service, workspace_id, customer_id, email):
        raise ApiError(409, "PORTAL_ALREADY_ENABLED", MESSAGES["PORTAL_ALREADY_ENABLED"])
    created = created_or_403(
        service.post(
            "customer_portal_access",
            {
                "workspace_id": str(workspace_id),
                "customer_id": str(customer_id),
                "contact_id": _contact_id(client, workspace_id, customer_id, email),
                "email": email,
                "status": "invited",
                "scope": "customer",
                "capabilities": list(PORTAL_VIEW_CAPABILITIES),
                "enabled_by": user["id"],
            },
        )
    )
    token = _mint_invite(service, str(created["id"]), user["id"], delivery="copy")
    write_audit(
        client,
        str(workspace_id),
        "customer_portal.enable",
        entity_type="customer_portal_access",
        entity_id=str(created["id"]),
        metadata={"result": "success", "customer_id": str(customer_id)},
    )
    write_audit(
        client,
        str(workspace_id),
        "customer_portal.invite_create",
        entity_type="customer_portal_access",
        entity_id=str(created["id"]),
        metadata={"result": "success", "delivery": "copy"},
    )
    invite = {"expires_at": (_now() + INVITE_TTL).isoformat(), "consumed_at": None, "revoked_at": None}
    payload = _public_access({**created, "status": "invited"}, invite)
    payload["token"] = token
    return payload


@router.post("/workspaces/{workspace_id}/customers/{customer_id}/portal/{access_id}/link")
def copy_customer_portal_link(
    workspace_id: UUID,
    customer_id: UUID,
    access_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    service: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    return _rotate_invite(
        workspace_id,
        customer_id,
        access_id,
        client,
        user,
        service,
        action="customer_portal.manage",
        audit_action="customer_portal.invite_copy",
        delivery="copy",
    )


@router.post("/workspaces/{workspace_id}/customers/{customer_id}/portal/{access_id}/resend")
def resend_customer_portal(
    workspace_id: UUID,
    customer_id: UUID,
    access_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    service: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    return _rotate_invite(
        workspace_id,
        customer_id,
        access_id,
        client,
        user,
        service,
        action="customer_portal.manage",
        audit_action="customer_portal.invite_resend",
        delivery="copy",
    )


def _rotate_invite(
    workspace_id: UUID,
    customer_id: UUID,
    access_id: UUID,
    client: UserClient,
    user: dict,
    service: ServiceClient,
    *,
    action: str,
    audit_action: str,
    delivery: str,
) -> dict:
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    _raise_decision(authorize(ctx=ctx, action=action))
    _require_customer(client, workspace_id, customer_id)
    access = _access_or_404(service, workspace_id, customer_id, access_id)
    if access["status"] != "invited":
        raise ApiError(409, "PORTAL_NOT_INVITED", MESSAGES["PORTAL_NOT_INVITED"])
    token = _mint_invite(service, str(access_id), user["id"], delivery=delivery)
    write_audit(
        client,
        str(workspace_id),
        audit_action,
        entity_type="customer_portal_access",
        entity_id=str(access_id),
        metadata={"result": "success", "delivery": delivery},
    )
    invite = {"expires_at": (_now() + INVITE_TTL).isoformat(), "consumed_at": None, "revoked_at": None}
    payload = _public_access(access, invite)
    payload["token"] = token
    return payload


@router.post("/workspaces/{workspace_id}/customers/{customer_id}/portal/{access_id}/revoke")
def revoke_customer_portal(
    workspace_id: UUID,
    customer_id: UUID,
    access_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    service: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    _raise_decision(authorize(ctx=ctx, action="customer_portal.revoke"))
    _require_customer(client, workspace_id, customer_id)
    access = _access_or_404(service, workspace_id, customer_id, access_id)
    if access["status"] == "revoked":
        return _public_access(access, None)
    now = _now().isoformat()
    patched = service.patch(
        "customer_portal_access",
        {"status": "revoked", "revoked_at": now, "revoked_by": user["id"]},
        params={"id": f"eq.{access_id}"},
    )
    rows = as_list(patched)
    service.patch(
        "customer_portal_invite",
        {"revoked_at": now},
        params={
            "access_id": f"eq.{access_id}",
            "consumed_at": "is.null",
            "revoked_at": "is.null",
        },
    )
    write_audit(
        client,
        str(workspace_id),
        "customer_portal.revoke",
        entity_type="customer_portal_access",
        entity_id=str(access_id),
        metadata={"result": "success", "customer_id": str(customer_id)},
    )
    current = rows[0] if rows else {**access, "status": "revoked", "last_login_at": access.get("last_login_at")}
    return _public_access(current, None)


@router.get("/portal/invites/peek")
def peek_portal_invite(
    token: str,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    raw = (token or "").strip()
    if len(raw) < 16:
        return {"status": "invalid"}
    res = client.rpc("peek_customer_portal_invite", {"p_token": raw})
    if res.status_code != 200:
        text = res.text or ""
        if "UNAUTHENTICATED" in text:
            raise ApiError(401, "UNAUTHENTICATED", MESSAGES["UNAUTHENTICATED"])
        return {"status": "invalid"}
    payload = res.json() or {}
    if not isinstance(payload, dict):
        return {"status": "invalid"}
    status = str(payload.get("status") or "invalid")
    if status != "valid":
        if status in {"invalid", "expired", "consumed", "revoked"}:
            return {"status": status}
        return {"status": "invalid"}
    invited = str(payload.get("email") or "").strip().lower()
    current = str(user.get("email") or "").strip().lower()
    if invited and current and invited != current:
        return {"status": "wrong_account", "email": invited}
    return {
        "status": "valid",
        "email": invited or None,
        "customer_name": payload.get("customer_name"),
        "workspace_name": payload.get("workspace_name"),
        "expires_at": payload.get("expires_at"),
    }


@router.post("/portal/invites/accept")
def accept_portal_invite(
    body: PortalTokenIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    res = client.rpc("accept_customer_portal_invite", {"p_token": body.token.strip()})
    if res.status_code != 200:
        raise _rpc_error(res.text or "")
    access_id = res.json()
    if not access_id:
        raise ApiError(400, "PORTAL_INVITE_INVALID", MESSAGES["PORTAL_INVITE_INVALID"])
    return {"access_id": str(access_id).strip('"'), "status": "active"}


@router.get("/portal/session")
def portal_session(
    user: Annotated[dict, Depends(current_user)],
    service: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    res = service.get(
        "customer_portal_access",
        params={
            "portal_user_id": f"eq.{user['id']}",
            "status": "eq.active",
            "select": "id,customer_id,workspace_id,capabilities,customers(display_name)",
            "order": "created_at.asc",
        },
    )
    grants = []
    for row in as_list(res):
        nested = row.get("customers")
        if isinstance(nested, list):
            nested = nested[0] if nested else None
        name = nested.get("display_name") if isinstance(nested, dict) else ""
        grants.append(
            {
                "access_id": row["id"],
                "customer_id": row["customer_id"],
                "customer_name": name or "",
                "capabilities": list(row.get("capabilities") or []),
            }
        )
    return {"grants": grants}


@router.get("/portal/access/{access_id}")
def portal_home(
    access_id: UUID,
    request: Request,
    user: Annotated[dict, Depends(current_user)],
    service: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    grant = _require_active_grant(service, user["id"], access_id)
    _touch_login(service, grant, user["id"], request)
    return _build_home(service, grant)


@router.post("/portal/access/{access_id}/documents/{document_id}/url")
def portal_document_url(
    access_id: UUID,
    document_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    service: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    grant = _require_active_grant(service, user["id"], access_id)
    if not has_capability(grant, "portal.documents.view"):
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    home_ids = _ownership_ids(service, grant)
    res = service.get(
        "documents",
        params={
            "id": f"eq.{document_id}",
            "workspace_id": f"eq.{grant['workspace_id']}",
            "select": "id,entity_type,entity_id,kind,visibility,storage_bucket,storage_path",
            "limit": "1",
        },
    )
    rows = as_list(res)
    if not rows or not document_visible(rows[0], customer_id=str(grant["customer_id"]), **home_ids):
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    row = rows[0]
    bucket = str(row.get("storage_bucket") or "")
    path = str(row.get("storage_path") or "")
    if bucket not in PORTAL_DOCUMENT_BUCKETS or not path:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    return {"url": service.storage_sign_download(bucket, path, expires_in=60)}


def _require_active_grant(service: ServiceClient, user_id: str, access_id: UUID) -> dict:
    res = service.get(
        "customer_portal_access",
        params={
            "id": f"eq.{access_id}",
            "portal_user_id": f"eq.{user_id}",
            "status": "eq.active",
            "select": "id,workspace_id,customer_id,email,capabilities,status,last_login_at",
            "limit": "1",
        },
    )
    rows = as_list(res)
    if not rows:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    return rows[0]


def _touch_login(service: ServiceClient, grant: dict, user_id: str, request: Request) -> None:
    if not should_touch_login(grant.get("last_login_at")):
        return
    now = _now().isoformat()
    service.patch(
        "customer_portal_access",
        {"last_login_at": now},
        params={"id": f"eq.{grant['id']}"},
    )
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    ip = forwarded or (request.client.host if request.client else "")
    payload: dict[str, Any] = {
        "access_id": grant["id"],
        "portal_user_id": user_id,
        "user_agent": (request.headers.get("user-agent") or "")[:500] or None,
    }
    if ip:
        payload["ip"] = ip
    try:
        service.post("portal_login_events", payload)
    except Exception:
        return


def _ids(service: ServiceClient, table: str, params: dict) -> set[str]:
    res = service.get(table, params={**params, "select": "id"})
    return {str(row["id"]) for row in as_list(res) if row.get("id")}


def _ownership_ids(service: ServiceClient, grant: dict) -> dict[str, set[str]]:
    workspace_id = grant["workspace_id"]
    customer_id = grant["customer_id"]
    site_ids = _ids(
        service,
        "sites",
        {"workspace_id": f"eq.{workspace_id}", "customer_id": f"eq.{customer_id}", "deleted_at": "is.null"},
    )
    job_ids = _ids(
        service,
        "jobs",
        {"workspace_id": f"eq.{workspace_id}", "customer_id": f"eq.{customer_id}"},
    )
    quote_ids = _ids(
        service,
        "quotes",
        {"workspace_id": f"eq.{workspace_id}", "customer_id": f"eq.{customer_id}", "deleted_at": "is.null"},
    )
    warranty_ids = _ids(
        service,
        "warranties",
        {"workspace_id": f"eq.{workspace_id}", "customer_id": f"eq.{customer_id}"},
    )
    project_ids = _ids(
        service,
        "projects",
        {"workspace_id": f"eq.{workspace_id}", "customer_id": f"eq.{customer_id}"},
    )
    system_ids: set[str] = set()
    if site_ids:
        joined = ",".join(sorted(site_ids))
        system_ids = _ids(
            service,
            "systems",
            {"workspace_id": f"eq.{workspace_id}", "site_id": f"in.({joined})"},
        )
    return {
        "site_ids": site_ids,
        "job_ids": job_ids,
        "quote_ids": quote_ids,
        "warranty_ids": warranty_ids,
        "project_ids": project_ids,
        "system_ids": system_ids,
    }


def _build_home(service: ServiceClient, grant: dict) -> dict:
    workspace_id = grant["workspace_id"]
    customer_id = grant["customer_id"]
    customer_res = service.get(
        "customers",
        params={
            "id": f"eq.{customer_id}",
            "workspace_id": f"eq.{workspace_id}",
            "deleted_at": "is.null",
            "select": "id,display_name,type,phone",
            "limit": "1",
        },
    )
    customers = as_list(customer_res)
    if not customers:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    workspace_res = service.get(
        "workspaces",
        params={"id": f"eq.{workspace_id}", "status": "eq.active", "select": "id,name", "limit": "1"},
    )
    if not as_list(workspace_res):
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])

    owned = _ownership_ids(service, grant)
    sites = []
    if has_capability(grant, "portal.sites.view") and owned["site_ids"]:
        site_rows = as_list(
            service.get(
                "sites",
                params={
                    "id": f"in.({','.join(sorted(owned['site_ids']))})",
                    "select": "id,name,code,installation_status,address",
                    "order": "name.asc",
                },
            )
        )
        sites = [project_site(row) for row in site_rows]

    installations = []
    if has_capability(grant, "portal.installations.view"):
        job_rows = as_list(
            service.get(
                "jobs",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "customer_id": f"eq.{customer_id}",
                    "kind": "eq.installation",
                    "status": "eq.completed",
                    "select": "id,number,title,status,completed_at,site_id",
                    "order": "completed_at.desc",
                },
            )
        )
        installations = [project_installation(row) for row in job_rows]

    equipment = []
    if has_capability(grant, "portal.equipment.view") and owned["site_ids"]:
        eq_rows = as_list(
            service.get(
                "equipment",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "site_id": f"in.({','.join(sorted(owned['site_ids']))})",
                    "status": "eq.installed",
                    "select": "id,site_id,name,category,manufacturer,model,serial,installed_at,status",
                    "order": "name.asc",
                },
            )
        )
        equipment = [project_equipment(row) for row in eq_rows]

    warranties = []
    if has_capability(grant, "portal.warranties.view"):
        warranty_rows = as_list(
            service.get(
                "warranties",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "customer_id": f"eq.{customer_id}",
                    "select": "id,number,type,status,starts_on,ends_on,site_id",
                    "order": "ends_on.desc",
                },
            )
        )
        warranties = [project_warranty(row) for row in warranty_rows]

    quotes = []
    if has_capability(grant, "portal.quotes.view"):
        quote_rows = as_list(
            service.get(
                "quotes",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "customer_id": f"eq.{customer_id}",
                    "deleted_at": "is.null",
                    "status": f"in.({','.join(sorted(QUOTE_PORTAL_STATUSES))})",
                    "select": "id,number,status,total_gross,sent_at,valid_until",
                    "order": "sent_at.desc",
                },
            )
        )
        quotes = [item for item in (project_quote(row) for row in quote_rows) if item]

    service_calls = []
    if has_capability(grant, "portal.service.view"):
        call_rows = as_list(
            service.get(
                "service_calls",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "customer_id": f"eq.{customer_id}",
                    "select": "id,number,title,status,created_at,site_id",
                    "order": "created_at.desc",
                },
            )
        )
        service_calls = [project_service_call(row) for row in call_rows]

    documents = []
    if has_capability(grant, "portal.documents.view"):
        doc_rows = as_list(
            service.get(
                "documents",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "visibility": "eq.customer",
                    "select": "id,entity_type,entity_id,kind,visibility,storage_bucket,original_filename,mime_type,created_at",
                    "order": "created_at.desc",
                    "limit": "200",
                },
            )
        )
        documents = [
            project_document(row)
            for row in doc_rows
            if document_visible(row, customer_id=str(customer_id), **owned)
        ]

    return {
        "access_id": grant["id"],
        "customer_name": customers[0].get("display_name") or "",
        "profile": project_profile(customers[0], str(grant.get("email") or "")),
        "sites": sites,
        "installations": installations,
        "equipment": equipment,
        "warranties": warranties,
        "quotes": quotes,
        "service": service_calls,
        "documents": documents,
    }
