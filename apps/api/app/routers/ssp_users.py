"""SSP people directory, manager-provisioned users, and personal form inbox."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..audit import write_audit
from ..authz.usage import fetch_occupancy
from ..deps import ServiceClient, UserClient, current_user, load_authz_context, service_client, user_client
from ..errors import ApiError, MESSAGES
from ..identity import actor_id
from ..rest import as_list, one_or_404
from ..ssp.product_authz import (
    catalog_allows,
    feature_gate,
    load_company,
    load_member_site_ids,
    load_ssp_membership,
    product_grants,
    require_ssp_action,
)
from ..ssp.provision import CreateSspUserInput, person_out, provision_ssp_user
from ..ssp.site_assignments import classify_assignment, user_may_fill

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}/ssp", tags=["ssp-users"])

MEMBER_SELECT = (
    "id,workspace_id,company_pk,user_id,org_unit_id,department_id,"
    "product_role,manager_user_id,status,created_at"
)
SITE_SELECT = "id,workspace_id,name,kind,is_active,code,site_id"
ASSIGN_SELECT = (
    "id,workspace_id,company_pk,form_id,form_version_id,site_pk,status,cadence,"
    "filler_mode,starts_at,due_at,department_id,created_by,created_at,updated_at"
)


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


def _require_company(client: UserClient, workspace_id: UUID) -> dict[str, Any]:
    company = load_company(client, workspace_id=str(workspace_id))
    if not company:
        raise ApiError(400, "BUSINESS_RULE", "יש להגדיר חברת SSP לפני ניהול משתמשים")
    return company


def _can_manage_members(ctx, membership: dict[str, Any] | None) -> bool:
    role = membership.get("product_role") if membership else None
    grants = product_grants(role)
    if "ssp.members.manage" in grants or "ssp.members.manage_department" in grants:
        return True
    return catalog_allows(ctx, "users.invite") or catalog_allows(ctx, "users.manage")


def _can_view_members(ctx, membership: dict[str, Any] | None) -> bool:
    role = membership.get("product_role") if membership else None
    grants = product_grants(role)
    if "ssp.members.view" in grants or "ssp.members.manage" in grants or "ssp.officers.view" in grants:
        return True
    return catalog_allows(ctx, "users.view") or catalog_allows(ctx, "ssp.forms.view")


def _profiles_by_id(svc: ServiceClient, user_ids: list[str]) -> dict[str, dict[str, Any]]:
    if not user_ids:
        return {}
    unique = list(dict.fromkeys(user_ids))
    chunk: list[str] = unique[:80]
    rows = as_list(
        svc.get(
            "profiles",
            params={"id": f"in.({','.join(chunk)})", "select": "id,full_name,email,phone"},
        )
    )
    return {str(r["id"]): r for r in rows if r.get("id")}


def _workspace_roles(client: UserClient, workspace_id: UUID, user_ids: list[str]) -> dict[str, dict[str, Any]]:
    if not user_ids:
        return {}
    chunk = list(dict.fromkeys(user_ids))[:80]
    rows = as_list(
        client.get(
            "workspace_memberships",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "user_id": f"in.({','.join(chunk)})",
                "select": "user_id,role_key,workspace_role_key,status",
            },
        )
    )
    return {str(r["user_id"]): r for r in rows if r.get("user_id")}


def _sites_for_users(
    client: UserClient, workspace_id: UUID, user_ids: list[str]
) -> dict[str, list[dict[str, Any]]]:
    if not user_ids:
        return {}
    chunk = list(dict.fromkeys(user_ids))[:80]
    links = as_list(
        client.get(
            "ssp_site_members",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "user_id": f"in.({','.join(chunk)})",
                "select": "user_id,site_pk",
            },
        )
    )
    site_ids = list({str(r["site_pk"]) for r in links if r.get("site_pk")})
    sites_by_id: dict[str, dict[str, Any]] = {}
    if site_ids:
        sites = as_list(
            client.get(
                "ssp_sites",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "id": f"in.({','.join(site_ids[:80])})",
                    "select": SITE_SELECT,
                },
            )
        )
        sites_by_id = {str(s["id"]): s for s in sites if s.get("id")}
    out: dict[str, list[dict[str, Any]]] = {uid: [] for uid in chunk}
    for link in links:
        uid = str(link.get("user_id") or "")
        site = sites_by_id.get(str(link.get("site_pk") or ""))
        if not uid or not site:
            continue
        out.setdefault(uid, []).append(
            {"id": site["id"], "name": site.get("name"), "kind": site.get("kind"), "code": site.get("code")}
        )
    return out


class SspUserCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str = Field(min_length=2, max_length=200)
    email: str = Field(min_length=5, max_length=320)
    password: str = Field(min_length=8, max_length=128)
    product_role: Literal["org_admin", "patrol_manager", "patrol_officer"] = "patrol_officer"
    phone: str | None = Field(default=None, max_length=32)
    site_id: str | None = None
    org_unit_id: str | None = None
    department_id: str | None = None
    manager_user_id: str | None = None

    def __repr__(self) -> str:
        return (
            f"SspUserCreate(full_name={self.full_name!r}, email={self.email!r}, "
            f"product_role={self.product_role!r}, site_id={self.site_id!r}, password='***')"
        )


class SspUserPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str | None = Field(default=None, min_length=2, max_length=200)
    phone: str | None = Field(default=None, max_length=32)
    product_role: Literal["org_admin", "patrol_manager", "patrol_officer"] | None = None
    site_id: str | None = None
    status: Literal["active", "inactive"] | None = None
    org_unit_id: str | None = None
    department_id: str | None = None
    manager_user_id: str | None = None


@router.get("/users")
def list_users(
    workspace_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
    q: str | None = Query(default=None, max_length=80),
    site_id: str | None = Query(default=None),
    product_role: str | None = Query(default=None),
    status: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(
        ctx, client, catalog_action="ssp.forms.view", product_action="ssp.members.view"
    )
    if membership and membership.get("product_role") == "patrol_officer":
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    if not _can_view_members(ctx, membership):
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    company = load_company(client, workspace_id=str(workspace_id))
    if not company:
        return {"items": [], "data_mode": "empty"}
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "company_pk": f"eq.{company['id']}",
        "select": MEMBER_SELECT,
        "order": "created_at.desc",
    }
    if status in {"active", "inactive"}:
        params["status"] = f"eq.{status}"
    if product_role in {"org_admin", "patrol_manager", "patrol_officer"}:
        params["product_role"] = f"eq.{product_role}"
    if membership and membership.get("product_role") == "patrol_manager":
        dept = membership.get("department_id")
        if not dept:
            return {"items": [], "data_mode": "empty"}
        params["department_id"] = f"eq.{dept}"
    rows = as_list(client.get("ssp_memberships", params=params))
    user_ids = [str(r["user_id"]) for r in rows if r.get("user_id")]
    profiles = _profiles_by_id(svc, user_ids)
    roles = _workspace_roles(client, workspace_id, user_ids)
    sites_map = _sites_for_users(client, workspace_id, user_ids)
    items = []
    needle = (q or "").strip().lower()
    for row in rows:
        uid = str(row.get("user_id") or "")
        person_sites = sites_map.get(uid) or []
        if site_id and not any(str(s.get("id")) == str(site_id) for s in person_sites):
            continue
        wm = roles.get(uid) or {}
        person = person_out(
            membership=row,
            profile=profiles.get(uid),
            workspace_role_key=wm.get("workspace_role_key") or wm.get("role_key"),
            sites=person_sites,
        )
        if needle:
            blob = " ".join(
                str(v or "")
                for v in (person.get("full_name"), person.get("email"), person.get("phone"), uid)
            ).lower()
            if needle not in blob and not any(needle in str(s.get("name") or "").lower() for s in person_sites):
                continue
        items.append(person)
    return {"items": items, "data_mode": "live"}


@router.post("/users", status_code=201)
def create_user(
    workspace_id: UUID,
    body: SspUserCreate,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    ctx = _ctx(client, user, workspace_id)
    feature_gate(ctx)
    membership = load_ssp_membership(client, workspace_id=str(workspace_id), user_id=ctx.user_id)
    if membership and membership.get("product_role") == "patrol_officer":
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    if not _can_manage_members(ctx, membership):
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    if membership and membership.get("product_role") == "patrol_manager":
        if body.product_role == "org_admin":
            raise ApiError(403, "PERMISSION_DENIED", "מנהל סיור אינו יכול למנות מנהל ארגון")
        actor_dept = membership.get("department_id")
        if actor_dept:
            if body.department_id and str(body.department_id) != str(actor_dept):
                raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
            body.department_id = body.department_id or actor_dept
    company = _require_company(client, workspace_id)
    site_pk = body.site_id
    if site_pk:
        site = one_or_404(
            client.get(
                "ssp_sites",
                params={
                    "id": f"eq.{site_pk}",
                    "workspace_id": f"eq.{workspace_id}",
                    "company_pk": f"eq.{company['id']}",
                    "select": "id,kind,department_id,is_active",
                },
            )
        )
        if site.get("kind") not in {"office", "ops_center"}:
            raise ApiError(400, "VALIDATION_ERROR", "ניתן לשייך משתמש לגורם תפעולי בלבד, לא לאתר לקוח")
    occupancy = fetch_occupancy(client, str(workspace_id))
    created = provision_ssp_user(
        svc,
        workspace_id=str(workspace_id),
        company_pk=company["id"],
        actor_user_id=ctx.user_id,
        payload=CreateSspUserInput(
            full_name=body.full_name,
            email=body.email,
            password=body.password,
            product_role=body.product_role,
            phone=body.phone,
            site_pk=site_pk,
            org_unit_id=body.org_unit_id,
            department_id=body.department_id,
            manager_user_id=body.manager_user_id,
        ),
        occupied_roles=occupancy.roles,
        plan_key=ctx.plan_key,
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.user.create",
        entity_type="ssp_membership",
        entity_id=str(created.get("ssp_membership_id") or created.get("user_id")),
        metadata={
            "user_id": created.get("user_id"),
            "product_role": created.get("product_role"),
            "site_id": site_pk,
            "created_auth": created.get("created_auth"),
            "resumed": created.get("resumed"),
        },
    )
    return created


@router.get("/users/{user_id}")
def get_user(
    workspace_id: UUID,
    user_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(
        ctx, client, catalog_action="ssp.forms.view", product_action="ssp.members.view"
    )
    is_self = str(user_id) == str(ctx.user_id)
    if not is_self and membership and membership.get("product_role") == "patrol_officer":
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    if not is_self and not _can_view_members(ctx, membership):
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    company = _require_company(client, workspace_id)
    row = one_or_404(
        client.get(
            "ssp_memberships",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "company_pk": f"eq.{company['id']}",
                "user_id": f"eq.{user_id}",
                "select": MEMBER_SELECT,
                "limit": "1",
            },
        )
    )
    if membership and membership.get("product_role") == "patrol_manager":
        dept = membership.get("department_id")
        if dept and row.get("department_id") and str(row["department_id"]) != str(dept) and not is_self:
            raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
    uid = str(user_id)
    profile = _profiles_by_id(svc, [uid]).get(uid)
    wm = _workspace_roles(client, workspace_id, [uid]).get(uid) or {}
    sites = _sites_for_users(client, workspace_id, [uid]).get(uid) or []
    person = person_out(
        membership=row,
        profile=profile,
        workspace_role_key=wm.get("workspace_role_key") or wm.get("role_key"),
        sites=sites,
    )
    assignments = as_list(
        client.get(
            "ssp_form_site_assignment_targets",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "user_id": f"eq.{user_id}",
                "select": "id,site_assignment_id,created_at",
                "order": "created_at.desc",
                "limit": "50",
            },
        )
    )
    assign_ids = [str(a["site_assignment_id"]) for a in assignments if a.get("site_assignment_id")]
    assign_by_id: dict[str, dict[str, Any]] = {}
    forms_by_id: dict[str, dict[str, Any]] = {}
    if assign_ids:
        assign_rows = as_list(
            client.get(
                "ssp_form_site_assignments",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "id": f"in.({','.join(assign_ids[:80])})",
                    "select": "id,form_id,status,due_at",
                },
            )
        )
        assign_by_id = {str(a["id"]): a for a in assign_rows if a.get("id")}
        form_ids = list({str(a["form_id"]) for a in assign_rows if a.get("form_id")})
        if form_ids:
            forms_by_id = {
                str(f["id"]): f
                for f in as_list(
                    client.get(
                        "ssp_forms",
                        params={
                            "workspace_id": f"eq.{workspace_id}",
                            "id": f"in.({','.join(form_ids[:80])})",
                            "select": "id,title",
                        },
                    )
                )
                if f.get("id")
            }
    submissions = as_list(
        client.get(
            "ssp_form_submissions",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "submitted_by": f"eq.{user_id}",
                "select": "id,form_id,site_assignment_id,status,submitted_at",
                "order": "submitted_at.desc",
                "limit": "50",
            },
        )
    )
    if membership and membership.get("product_role") == "patrol_officer" and not is_self:
        submissions = []
        assignments = []
    person["assignments"] = [
        {
            "id": a.get("id"),
            "site_assignment_id": a.get("site_assignment_id"),
            "created_at": a.get("created_at"),
            "form_id": (assign_by_id.get(str(a.get("site_assignment_id") or "")) or {}).get("form_id"),
            "form_title": (
                forms_by_id.get(
                    str((assign_by_id.get(str(a.get("site_assignment_id") or "")) or {}).get("form_id") or "")
                )
                or {}
            ).get("title"),
            "status": (assign_by_id.get(str(a.get("site_assignment_id") or "")) or {}).get("status"),
            "due_at": (assign_by_id.get(str(a.get("site_assignment_id") or "")) or {}).get("due_at"),
        }
        for a in assignments
    ]
    person["submissions"] = submissions
    return person


@router.patch("/users/{user_id}")
def patch_user(
    workspace_id: UUID,
    user_id: UUID,
    body: SspUserPatch,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    ctx = _ctx(client, user, workspace_id)
    feature_gate(ctx)
    membership = load_ssp_membership(client, workspace_id=str(workspace_id), user_id=ctx.user_id)
    if membership and membership.get("product_role") == "patrol_officer":
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    if not _can_manage_members(ctx, membership):
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    if str(user_id) == str(ctx.user_id) and body.status == "inactive":
        raise ApiError(400, "BUSINESS_RULE", "לא ניתן להשבית את החשבון שלכם")
    company = _require_company(client, workspace_id)
    row = one_or_404(
        client.get(
            "ssp_memberships",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "company_pk": f"eq.{company['id']}",
                "user_id": f"eq.{user_id}",
                "select": MEMBER_SELECT,
                "limit": "1",
            },
        )
    )
    if membership and membership.get("product_role") == "patrol_manager":
        if body.product_role == "org_admin":
            raise ApiError(403, "PERMISSION_DENIED", "מנהל סיור אינו יכול למנות מנהל ארגון")
        actor_dept = membership.get("department_id")
        if actor_dept and row.get("department_id") and str(row["department_id"]) != str(actor_dept):
            raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
    patch: dict[str, Any] = {}
    if body.product_role is not None:
        patch["product_role"] = body.product_role
    if body.status is not None:
        patch["status"] = body.status
    if body.org_unit_id is not None:
        patch["org_unit_id"] = body.org_unit_id or None
    if body.department_id is not None:
        patch["department_id"] = body.department_id or None
    if body.manager_user_id is not None:
        patch["manager_user_id"] = body.manager_user_id or None
    if patch:
        res = client.patch(
            "ssp_memberships",
            json=patch,
            params={"id": f"eq.{row['id']}", "workspace_id": f"eq.{workspace_id}", "select": MEMBER_SELECT},
        )
        if res.status_code not in {200, 204}:
            raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
        data = res.json() if getattr(res, "content", None) else None
        if isinstance(data, list) and data:
            row = data[0]
        else:
            row = {**row, **patch}
    if body.full_name is not None or body.phone is not None:
        profile_patch: dict[str, Any] = {}
        if body.full_name is not None:
            profile_patch["full_name"] = body.full_name.strip()
        if body.phone is not None:
            profile_patch["phone"] = body.phone.strip() or None
        svc.patch("profiles", profile_patch, params={"id": f"eq.{user_id}"})
    if body.site_id:
        site = one_or_404(
            client.get(
                "ssp_sites",
                params={
                    "id": f"eq.{body.site_id}",
                    "workspace_id": f"eq.{workspace_id}",
                    "company_pk": f"eq.{company['id']}",
                    "select": "id,kind",
                },
            )
        )
        if site.get("kind") not in {"office", "ops_center"}:
            raise ApiError(400, "VALIDATION_ERROR", "ניתן לשייך משתמש לגורם תפעולי בלבד")
        existing = as_list(
            client.get(
                "ssp_site_members",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "site_pk": f"eq.{body.site_id}",
                    "user_id": f"eq.{user_id}",
                    "select": "id",
                    "limit": "1",
                },
            )
        )
        if not existing:
            posted = client.post(
                "ssp_site_members",
                json={"workspace_id": str(workspace_id), "site_pk": body.site_id, "user_id": str(user_id)},
            )
            if posted.status_code not in {200, 201} and not (
                getattr(posted, "status_code", None) == 409
            ):
                text = (getattr(posted, "text", None) or "").lower()
                if "duplicate" not in text and "23505" not in text:
                    raise ApiError(503, "SSP_PARTIAL_RECOVERY", MESSAGES["SSP_PARTIAL_RECOVERY"])
    write_audit(
        client,
        str(workspace_id),
        "ssp.user.update",
        entity_type="ssp_membership",
        entity_id=str(row.get("id")),
        metadata={"user_id": str(user_id), "fields": [k for k, v in body.model_dump().items() if v is not None]},
    )
    return get_user(workspace_id, user_id, user, client, svc)


@router.get("/me/forms")
def my_forms(
    workspace_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(
        ctx, client, catalog_action="ssp.forms.view", product_action="ssp.forms.submit"
    )
    company = load_company(client, workspace_id=str(workspace_id))
    if not company:
        return {"items": [], "data_mode": "empty"}
    member_ids = load_member_site_ids(client, workspace_id=str(workspace_id), user_id=ctx.user_id)
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "company_pk": f"eq.{company['id']}",
        "select": ASSIGN_SELECT,
        "order": "created_at.desc",
        "limit": "200",
    }
    assignments = as_list(client.get("ssp_form_site_assignments", params=params))
    if not assignments:
        return {"items": [], "data_mode": "empty"}
    assign_ids = [str(a["id"]) for a in assignments if a.get("id")]
    targets = as_list(
        client.get(
            "ssp_form_site_assignment_targets",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "site_assignment_id": f"in.({','.join(assign_ids[:80])})",
                "select": "site_assignment_id,user_id",
            },
        )
    ) if assign_ids else []
    targets_by_assign: dict[str, set[str]] = {}
    for t in targets:
        targets_by_assign.setdefault(str(t.get("site_assignment_id")), set()).add(str(t.get("user_id")))
    form_ids = list({str(a["form_id"]) for a in assignments if a.get("form_id")})
    forms = as_list(
        client.get(
            "ssp_forms",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "id": f"in.({','.join(form_ids[:80])})",
                "select": "id,title,category,status",
            },
        )
    ) if form_ids else []
    forms_by_id = {str(f["id"]): f for f in forms if f.get("id")}
    site_ids = list({str(a["site_pk"]) for a in assignments if a.get("site_pk")})
    sites = as_list(
        client.get(
            "ssp_sites",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "id": f"in.({','.join(site_ids[:80])})",
                "select": "id,name,kind",
            },
        )
    ) if site_ids else []
    sites_by_id = {str(s["id"]): s for s in sites if s.get("id")}
    subs = as_list(
        client.get(
            "ssp_form_submissions",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "submitted_by": f"eq.{ctx.user_id}",
                "site_assignment_id": f"in.({','.join(assign_ids[:80])})",
                "select": "id,site_assignment_id,status,submitted_at",
                "order": "submitted_at.desc",
            },
        )
    ) if assign_ids else []
    sub_by_assign = {str(s.get("site_assignment_id")): s for s in subs if s.get("site_assignment_id")}
    is_manager = bool(
        membership
        and membership.get("product_role") in {"org_admin", "patrol_manager"}
        or catalog_allows(ctx, "ssp.assignments.manage")
    )
    now = datetime.now(UTC)
    items: list[dict[str, Any]] = []
    for row in assignments:
        aid = str(row.get("id") or "")
        site_pk = str(row.get("site_pk") or "")
        target_ids = targets_by_assign.get(aid, set())
        if not user_may_fill(
            filler_mode=str(row.get("filler_mode") or "site"),
            user_id=ctx.user_id,
            is_site_member=site_pk in member_ids,
            is_manager=False if membership and membership.get("product_role") == "patrol_officer" else is_manager,
            target_user_ids=target_ids,
            user_department_id=membership.get("department_id") if membership else None,
            assignment_department_id=row.get("department_id"),
        ):
            continue
        sub = sub_by_assign.get(aid)
        bucket = classify_assignment(
            status=str(row.get("status") or ""),
            starts_at=row.get("starts_at"),
            due_at=row.get("due_at"),
            has_submission=bool(sub),
            now=now,
        )
        form = forms_by_id.get(str(row.get("form_id")) ) or {}
        site = sites_by_id.get(site_pk) or {}
        items.append(
            {
                "assignment_id": aid,
                "form_id": row.get("form_id"),
                "form_title": form.get("title"),
                "form_category": form.get("category"),
                "site_id": site_pk,
                "site_name": site.get("name"),
                "status": row.get("status"),
                "fill_status": bucket,
                "due_at": row.get("due_at"),
                "starts_at": row.get("starts_at"),
                "submitted_at": sub.get("submitted_at") if sub else None,
                "submission_id": sub.get("id") if sub else None,
                "form_version_id": row.get("form_version_id"),
            }
        )
    return {"items": items, "data_mode": "live" if items else "empty"}
