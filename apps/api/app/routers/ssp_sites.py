"""SSP operational sites, form→site assignments, and site-screen fill."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..audit import write_audit
from ..deps import UserClient, current_user, load_authz_context, service_client, user_client
from ..errors import ApiError, MESSAGES
from ..identity import actor_id
from ..rest import as_list, created_or_403, one_or_404, patched_or_403, schema_missing
from ..ssp.forms_schema import validate_answers, validate_definition
from ..ssp.product_authz import (
    assert_form_in_scope,
    assert_site_in_scope,
    catalog_allows,
    filter_sites_for_membership,
    load_company,
    load_member_site_ids,
    require_ssp_action,
)
from ..ssp.site_assignments import (
    classify_assignment,
    duplicate_submit_blocked,
    user_may_fill,
)
from ..ssp.site_ids import new_site_id
from ..supabase_service import ServiceClient

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}/ssp", tags=["ssp-sites"])

SITE_SELECT = (
    "id,workspace_id,company_pk,site_id,name,phone,description,admin_notes,"
    "org_unit_id,department_id,manager_user_id,is_active,kind,created_at,updated_at"
)
MEMBER_SELECT = "id,workspace_id,site_pk,user_id,created_at"
ASSIGN_SELECT = (
    "id,workspace_id,company_pk,form_id,form_version_id,site_pk,status,cadence,"
    "filler_mode,starts_at,due_at,department_id,definition_snapshot,created_by,"
    "created_at,updated_at,paused_at,completed_at"
)
FORM_SELECT = (
    "id,workspace_id,title,description,status,latest_published_version,"
    "created_by,created_at,updated_at,archived_at,category,"
    "company_pk,org_unit_id,department_id"
)
VERSION_SELECT = (
    "id,workspace_id,form_id,version,status,definition,published_at,published_by,created_at"
)
SUBMISSION_SELECT = (
    "id,workspace_id,form_id,form_version_id,assignment_id,site_assignment_id,status,"
    "answers,consent,definition_snapshot,submitted_at,created_at,submitted_by,device_id"
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
            params={
                "id": f"eq.{site_pk}",
                "workspace_id": f"eq.{workspace_id}",
                "select": SITE_SELECT,
            },
        )
    )


def _guard_site(
    ctx,
    client: UserClient,
    membership: dict[str, Any] | None,
    site: dict[str, Any],
    *,
    catalog_action: str,
) -> None:
    assert_site_in_scope(
        membership,
        site,
        catalog_unscoped=catalog_allows(ctx, catalog_action),
        member_site_ids=_member_ids(client, UUID(str(ctx.workspace_id)), ctx.user_id),
        actor_user_id=ctx.user_id,
    )


class SiteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=32)
    description: str = Field(default="", max_length=2000)
    org_unit_id: str | None = None
    department_id: str | None = None
    manager_user_id: str | None = None
    is_active: bool = True
    admin_notes: str | None = Field(default=None, max_length=2000)
    kind: Literal["office", "ops_center", "physical_site", "other"] = "office"


class SitePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=32)
    description: str | None = Field(default=None, max_length=2000)
    org_unit_id: str | None = None
    department_id: str | None = None
    manager_user_id: str | None = None
    is_active: bool | None = None
    admin_notes: str | None = Field(default=None, max_length=2000)
    kind: Literal["office", "ops_center", "physical_site", "other"] | None = None


class SiteMemberIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: str = Field(min_length=1, max_length=64)


class SiteAssignmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    form_id: str
    site_ids: list[str] = Field(min_length=1, max_length=100)
    starts_at: str | None = None
    due_at: str | None = None
    filler_mode: Literal["site", "users", "group"] = "site"
    user_ids: list[str] = Field(default_factory=list, max_length=200)
    department_id: str | None = None


class SiteSubmitIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answers: dict[str, Any]


# ── Sites CRUD ─────────────────────────────────────────────────────────────────


@router.get("/sites")
def list_sites(
    workspace_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    q: str | None = Query(default=None, max_length=80),
    is_active: bool | None = Query(default=None),
    org_unit_id: str | None = Query(default=None),
    department_id: str | None = Query(default=None),
    activation_status: str | None = Query(default=None),
    kind: str | None = Query(default=None),
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
        "select": SITE_SELECT,
        "order": "name.asc",
    }
    if is_active is not None:
        params["is_active"] = f"eq.{str(is_active).lower()}"
    if kind:
        allowed = {"office", "ops_center", "physical_site", "other"}
        kinds = [k.strip() for k in kind.split(",") if k.strip() in allowed]
        if len(kinds) == 1:
            params["kind"] = f"eq.{kinds[0]}"
        elif len(kinds) > 1:
            params["kind"] = f"in.({','.join(kinds)})"
    if org_unit_id:
        params["org_unit_id"] = f"eq.{org_unit_id}"
    scoped_dept = None
    if membership and membership.get("product_role") not in {None, "org_admin"}:
        scoped_dept = membership.get("department_id")
    if department_id:
        if scoped_dept and str(department_id) != str(scoped_dept):
            raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
        params["department_id"] = f"eq.{department_id}"
    elif scoped_dept and membership and membership.get("product_role") == "patrol_manager":
        params["department_id"] = f"eq.{scoped_dept}"
    sites_res = client.get("ssp_sites", params=params)
    if sites_res.status_code != 200:
        return {
            "items": [],
            "data_mode": "unavailable" if schema_missing(sites_res) else "empty",
        }
    items = as_list(sites_res)
    needle = (q or "").strip().lower()
    if needle:
        items = [
            s
            for s in items
            if needle in str(s.get("name") or "").lower()
            or needle in str(s.get("phone") or "").lower()
            or needle in str(s.get("site_id") or "").lower()
        ]
    items = filter_sites_for_membership(
        items,
        membership,
        catalog_unscoped=catalog_allows(ctx, "ssp.forms.view"),
        member_site_ids=_member_ids(client, workspace_id, ctx.user_id),
        actor_user_id=ctx.user_id,
    )
    from .ssp_site_activation import annotate_sites

    items = annotate_sites(client, workspace_id, items)
    if activation_status:
        items = [s for s in items if s.get("activation_status") == activation_status]
    return {"items": items, "data_mode": "live"}


@router.post("/sites", status_code=201)
def create_site(
    workspace_id: UUID,
    body: SiteCreate,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(
        ctx, client, catalog_action="ssp.forms.edit", product_action="ssp.sites.edit"
    )
    if membership and membership.get("product_role") == "patrol_officer":
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    company = _require_company(client, workspace_id)
    dept = body.department_id
    if membership and membership.get("product_role") == "patrol_manager":
        actor_dept = membership.get("department_id")
        if actor_dept:
            if dept and str(dept) != str(actor_dept):
                raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
            dept = dept or actor_dept
    payload: dict[str, Any] = {
        "workspace_id": str(workspace_id),
        "company_pk": company["id"],
        "site_id": new_site_id(),
        "name": body.name.strip(),
        "phone": (body.phone or "").strip() or None,
        "description": (body.description or "").strip(),
        "org_unit_id": body.org_unit_id or (membership.get("org_unit_id") if membership else None),
        "department_id": dept,
        "manager_user_id": body.manager_user_id,
        "is_active": body.is_active,
        "admin_notes": (body.admin_notes or "").strip() or None,
        "kind": body.kind,
    }
    row = created_or_403(client.post("ssp_sites", json=payload, params={"select": SITE_SELECT}))
    write_audit(
        client,
        str(workspace_id),
        "ssp.site.create",
        entity_type="ssp_site",
        entity_id=row["id"],
        metadata={"site_id": row.get("site_id"), "name": row.get("name")},
    )
    return row


@router.get("/sites/{site_pk}")
def get_site(
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
    return site


@router.patch("/sites/{site_pk}")
def patch_site(
    workspace_id: UUID,
    site_pk: UUID,
    body: SitePatch,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(
        ctx, client, catalog_action="ssp.forms.edit", product_action="ssp.sites.edit"
    )
    if membership and membership.get("product_role") == "patrol_officer":
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    site = _load_site(client, workspace_id, site_pk)
    _guard_site(ctx, client, membership, site, catalog_action="ssp.forms.edit")
    patch: dict[str, Any] = {}
    if body.name is not None:
        patch["name"] = body.name.strip()
    if body.phone is not None:
        patch["phone"] = body.phone.strip() or None
    if body.description is not None:
        patch["description"] = body.description.strip()
    if body.org_unit_id is not None:
        patch["org_unit_id"] = body.org_unit_id or None
    if body.department_id is not None:
        if membership and membership.get("product_role") == "patrol_manager":
            actor_dept = membership.get("department_id")
            if actor_dept and str(body.department_id) != str(actor_dept):
                raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
        patch["department_id"] = body.department_id or None
    if body.manager_user_id is not None:
        patch["manager_user_id"] = body.manager_user_id or None
    if body.is_active is not None:
        patch["is_active"] = body.is_active
    if body.admin_notes is not None:
        patch["admin_notes"] = body.admin_notes.strip() or None
    if body.kind is not None:
        patch["kind"] = body.kind
    if not patch:
        return site
    updated = patched_or_403(
        client.patch(
            "ssp_sites",
            json=patch,
            params={"id": f"eq.{site_pk}", "workspace_id": f"eq.{workspace_id}", "select": SITE_SELECT},
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.site.update",
        entity_type="ssp_site",
        entity_id=str(site_pk),
        metadata={"fields": list(patch.keys())},
    )
    return updated


# ── Members (existing users only) ──────────────────────────────────────────────


@router.get("/sites/{site_pk}/members")
def list_site_members(
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
    items = as_list(
        client.get(
            "ssp_site_members",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "site_pk": f"eq.{site_pk}",
                "select": MEMBER_SELECT,
                "order": "created_at.asc",
            },
        )
    )
    return {"items": items}


@router.post("/sites/{site_pk}/members", status_code=201)
def add_site_member(
    workspace_id: UUID,
    site_pk: UUID,
    body: SiteMemberIn,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(
        ctx, client, catalog_action="ssp.forms.edit", product_action="ssp.sites.edit"
    )
    if membership and membership.get("product_role") == "patrol_officer":
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    site = _load_site(client, workspace_id, site_pk)
    _guard_site(ctx, client, membership, site, catalog_action="ssp.forms.edit")
    wm = client.get(
        "workspace_memberships",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "user_id": f"eq.{body.user_id}",
            "status": "eq.active",
            "select": "user_id",
            "limit": "1",
        },
    )
    if wm.status_code != 200 or not (wm.json() or []):
        raise ApiError(404, "NOT_FOUND", "המשתמש אינו חבר פעיל בסביבה")
    row = created_or_403(
        client.post(
            "ssp_site_members",
            json={
                "workspace_id": str(workspace_id),
                "site_pk": str(site_pk),
                "user_id": body.user_id,
            },
            params={"select": MEMBER_SELECT},
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.site.member_add",
        entity_type="ssp_site",
        entity_id=str(site_pk),
        metadata={"user_id": body.user_id},
    )
    return row


@router.delete("/sites/{site_pk}/members/{user_id}")
def remove_site_member(
    workspace_id: UUID,
    site_pk: UUID,
    user_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(
        ctx, client, catalog_action="ssp.forms.edit", product_action="ssp.sites.edit"
    )
    if membership and membership.get("product_role") == "patrol_officer":
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    site = _load_site(client, workspace_id, site_pk)
    _guard_site(ctx, client, membership, site, catalog_action="ssp.forms.edit")
    client.delete(
        "ssp_site_members",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "site_pk": f"eq.{site_pk}",
            "user_id": f"eq.{user_id}",
        },
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.site.member_remove",
        entity_type="ssp_site",
        entity_id=str(site_pk),
        metadata={"user_id": str(user_id)},
    )
    return {"ok": True}


# ── Assignments ────────────────────────────────────────────────────────────────


def _published_version(client: UserClient, workspace_id: UUID, form_id: str) -> tuple[dict, dict]:
    form = one_or_404(
        client.get(
            "ssp_forms",
            params={"id": f"eq.{form_id}", "workspace_id": f"eq.{workspace_id}", "select": FORM_SELECT},
        )
    )
    if form.get("status") != "published":
        raise ApiError(400, "BUSINESS_RULE", "ניתן להקצות רק טופס שפורסם")
    versions = as_list(
        client.get(
            "ssp_form_versions",
            params={
                "form_id": f"eq.{form_id}",
                "workspace_id": f"eq.{workspace_id}",
                "status": "eq.published",
                "select": VERSION_SELECT,
                "order": "version.desc",
                "limit": "1",
            },
        )
    )
    if not versions:
        raise ApiError(400, "BUSINESS_RULE", "אין גרסה מפורסמת לטופס")
    definition = validate_definition(versions[0].get("definition") or {"fields": []})
    return form, {**versions[0], "definition": definition}


@router.get("/site-assignments")
def list_site_assignments(
    workspace_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    site_id: str | None = Query(default=None),
    form_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(
        ctx, client, catalog_action="ssp.forms.view", product_action="ssp.sites.view"
    )
    company = _require_company(client, workspace_id)
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "company_pk": f"eq.{company['id']}",
        "select": ASSIGN_SELECT,
        "order": "created_at.desc",
    }
    if site_id:
        params["site_pk"] = f"eq.{site_id}"
    if form_id:
        params["form_id"] = f"eq.{form_id}"
    if status:
        params["status"] = f"eq.{status}"
    items = as_list(client.get("ssp_form_site_assignments", params=params))
    visible_sites = {
        str(s["id"])
        for s in filter_sites_for_membership(
            as_list(
                client.get(
                    "ssp_sites",
                    params={
                        "workspace_id": f"eq.{workspace_id}",
                        "company_pk": f"eq.{company['id']}",
                        "select": SITE_SELECT,
                    },
                )
            ),
            membership,
            catalog_unscoped=catalog_allows(ctx, "ssp.forms.view"),
            member_site_ids=_member_ids(client, workspace_id, ctx.user_id),
            actor_user_id=ctx.user_id,
        )
    }
    items = [a for a in items if str(a.get("site_pk")) in visible_sites]
    if site_id and site_id not in visible_sites:
        raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
    form_ids = list({str(a["form_id"]) for a in items if a.get("form_id")})
    forms_by_id: dict[str, dict[str, Any]] = {}
    if form_ids:
        forms_by_id = {
            str(f["id"]): f
            for f in as_list(
                client.get(
                    "ssp_forms",
                    params={
                        "workspace_id": f"eq.{workspace_id}",
                        "id": f"in.({','.join(form_ids)})",
                        "select": "id,title,status,category",
                    },
                )
            )
        }
    assign_ids = [str(a["id"]) for a in items if a.get("id")]
    by_assign: dict[str, int] = {}
    latest_by_assign: dict[str, str | None] = {}
    if assign_ids:
        for sub in as_list(
            client.get(
                "ssp_form_submissions",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "site_assignment_id": f"in.({','.join(assign_ids)})",
                    "select": "site_assignment_id,submitted_at",
                    "order": "submitted_at.desc",
                },
            )
        ):
            aid = str(sub.get("site_assignment_id") or "")
            if not aid:
                continue
            by_assign[aid] = by_assign.get(aid, 0) + 1
            latest_by_assign.setdefault(aid, sub.get("submitted_at"))
    now = datetime.now(UTC)
    annotated = []
    for a in items:
        aid = str(a.get("id") or "")
        form = forms_by_id.get(str(a.get("form_id")) or "") or {}
        count = by_assign.get(aid, 0)
        bucket = classify_assignment(
            status=str(a.get("status") or ""),
            starts_at=a.get("starts_at"),
            due_at=a.get("due_at"),
            has_submission=count > 0,
            now=now,
        )
        annotated.append(
            {
                **{k: v for k, v in a.items() if k != "definition_snapshot"},
                "form_title": form.get("title"),
                "form_category": form.get("category"),
                "form_status": form.get("status"),
                "fill_status": bucket,
                "submission_count": count,
                "latest_submission_at": latest_by_assign.get(aid),
            }
        )
    return {"items": annotated, "data_mode": "live"}


@router.get("/site-assignments/{assignment_id}")
def get_site_assignment(
    workspace_id: UUID,
    assignment_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(
        ctx, client, catalog_action="ssp.forms.view", product_action="ssp.sites.view"
    )
    row = one_or_404(
        client.get(
            "ssp_form_site_assignments",
            params={
                "id": f"eq.{assignment_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": ASSIGN_SELECT,
            },
        )
    )
    site = _load_site(client, workspace_id, UUID(str(row["site_pk"])))
    _guard_site(ctx, client, membership, site, catalog_action="ssp.forms.view")
    return row


@router.post("/site-assignments", status_code=201)
def create_site_assignments(
    workspace_id: UUID,
    body: SiteAssignmentCreate,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(
        ctx, client, catalog_action="ssp.assignments.manage", product_action="ssp.assignments.manage"
    )
    if membership and membership.get("product_role") == "patrol_officer":
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    company = _require_company(client, workspace_id)
    form, version = _published_version(client, workspace_id, body.form_id)
    assert_form_in_scope(membership, form, catalog_unscoped=catalog_allows(ctx, "ssp.assignments.manage"))
    if body.filler_mode == "users" and not body.user_ids:
        raise ApiError(400, "VALIDATION_ERROR", "יש לבחור משתמשים מורשים למילוי")
    if body.filler_mode == "group" and not body.department_id:
        raise ApiError(400, "VALIDATION_ERROR", "יש לבחור מחלקה להקצאה לקבוצה")
    created: list[dict[str, Any]] = []
    snapshot = version["definition"]
    for site_pk in body.site_ids:
        site = _load_site(client, workspace_id, UUID(site_pk))
        if str(site.get("company_pk")) != str(company["id"]):
            raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
        _guard_site(ctx, client, membership, site, catalog_action="ssp.assignments.manage")
        row = created_or_403(
            client.post(
                "ssp_form_site_assignments",
                json={
                    "workspace_id": str(workspace_id),
                    "company_pk": company["id"],
                    "form_id": str(form["id"]),
                    "form_version_id": version["id"],
                    "site_pk": str(site["id"]),
                    "status": "active",
                    "cadence": "once",
                    "filler_mode": body.filler_mode,
                    "starts_at": body.starts_at,
                    "due_at": body.due_at,
                    "department_id": body.department_id,
                    "definition_snapshot": snapshot,
                    "created_by": ctx.user_id,
                },
                params={"select": ASSIGN_SELECT},
            )
        )
        if body.filler_mode == "users":
            for uid in body.user_ids:
                created_or_403(
                    client.post(
                        "ssp_form_site_assignment_targets",
                        json={
                            "workspace_id": str(workspace_id),
                            "site_assignment_id": row["id"],
                            "user_id": uid,
                        },
                        params={"select": "id,workspace_id,site_assignment_id,user_id,created_at"},
                    )
                )
        created.append(row)
    write_audit(
        client,
        str(workspace_id),
        "ssp.site_assignment.create",
        entity_type="ssp_form",
        entity_id=str(form["id"]),
        metadata={
            "form_version_id": version["id"],
            "site_count": len(created),
            "snapshot_fields": len(snapshot.get("fields") or []),
        },
    )
    return {"items": created}


@router.post("/site-assignments/{assignment_id}/pause")
def pause_site_assignment(
    workspace_id: UUID,
    assignment_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    return _set_assignment_status(workspace_id, assignment_id, user, client, "paused")


@router.post("/site-assignments/{assignment_id}/resume")
def resume_site_assignment(
    workspace_id: UUID,
    assignment_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    return _set_assignment_status(workspace_id, assignment_id, user, client, "active")


@router.post("/site-assignments/{assignment_id}/complete")
def complete_site_assignment(
    workspace_id: UUID,
    assignment_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    return _set_assignment_status(workspace_id, assignment_id, user, client, "completed")


def _set_assignment_status(
    workspace_id: UUID,
    assignment_id: UUID,
    user: dict,
    client: UserClient,
    status: str,
) -> dict[str, Any]:
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(
        ctx, client, catalog_action="ssp.assignments.manage", product_action="ssp.assignments.manage"
    )
    if membership and membership.get("product_role") == "patrol_officer":
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    row = one_or_404(
        client.get(
            "ssp_form_site_assignments",
            params={
                "id": f"eq.{assignment_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": ASSIGN_SELECT,
            },
        )
    )
    site = _load_site(client, workspace_id, UUID(str(row["site_pk"])))
    _guard_site(ctx, client, membership, site, catalog_action="ssp.assignments.manage")
    now = datetime.now(UTC).isoformat()
    patch: dict[str, Any] = {"status": status}
    if status == "paused":
        patch["paused_at"] = now
    elif status == "active":
        patch["paused_at"] = None
    elif status == "completed":
        patch["completed_at"] = now
    updated = patched_or_403(
        client.patch(
            "ssp_form_site_assignments",
            json=patch,
            params={
                "id": f"eq.{assignment_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": ASSIGN_SELECT,
            },
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.site_assignment.status",
        entity_type="ssp_site_assignment",
        entity_id=str(assignment_id),
        metadata={"status": status},
    )
    return updated


# ── Operational site screen ────────────────────────────────────────────────────


@router.get("/sites/{site_pk}/ops")
def site_ops(
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
    assignments = as_list(
        client.get(
            "ssp_form_site_assignments",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "site_pk": f"eq.{site_pk}",
                "select": ASSIGN_SELECT,
                "order": "due_at.asc.nullslast,created_at.desc",
            },
        )
    )
    form_ids = list({str(a["form_id"]) for a in assignments if a.get("form_id")})
    forms_by_id: dict[str, dict[str, Any]] = {}
    if form_ids:
        forms = as_list(
            client.get(
                "ssp_forms",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "id": f"in.({','.join(form_ids)})",
                    "select": "id,title,status,category,latest_published_version",
                },
            )
        )
        forms_by_id = {str(f["id"]): f for f in forms}
    assign_ids = [str(a["id"]) for a in assignments]
    submissions: list[dict[str, Any]] = []
    if assign_ids:
        submissions = as_list(
            client.get(
                "ssp_form_submissions",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "site_assignment_id": f"in.({','.join(assign_ids)})",
                    "select": SUBMISSION_SELECT,
                    "order": "submitted_at.desc",
                },
            )
        )
    by_assign: dict[str, list[dict[str, Any]]] = {}
    for sub in submissions:
        by_assign.setdefault(str(sub.get("site_assignment_id")), []).append(sub)
    now = datetime.now(UTC)
    cards = []
    buckets: dict[str, list[str]] = {
        "available": [],
        "unfilled": [],
        "submitted": [],
        "overdue": [],
        "upcoming": [],
        "paused": [],
        "completed": [],
    }
    for a in assignments:
        subs = by_assign.get(str(a["id"]), [])
        bucket = classify_assignment(
            status=str(a.get("status") or ""),
            starts_at=a.get("starts_at"),
            due_at=a.get("due_at"),
            has_submission=bool(subs),
            now=now,
        )
        form = forms_by_id.get(str(a.get("form_id"))) or {}
        cards.append(
            {
                **{k: v for k, v in a.items() if k != "definition_snapshot"},
                "form_title": form.get("title"),
                "form_category": form.get("category"),
                "form_status": form.get("status"),
                "fill_status": bucket,
                "submission_count": len(subs),
                "latest_submission_at": subs[0].get("submitted_at") if subs else None,
            }
        )
        buckets.setdefault(bucket, []).append(str(a["id"]))
        if bucket in {"available", "overdue", "upcoming"}:
            buckets["unfilled"].append(str(a["id"]))
    history = [
        {
            "id": s.get("id"),
            "site_assignment_id": s.get("site_assignment_id"),
            "form_id": s.get("form_id"),
            "submitted_at": s.get("submitted_at"),
            "submitted_by": s.get("submitted_by"),
            "device_id": s.get("device_id"),
            "status": s.get("status"),
        }
        for s in submissions
    ]
    members = as_list(
        client.get(
            "ssp_site_members",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "site_pk": f"eq.{site_pk}",
                "select": MEMBER_SELECT,
                "order": "created_at.asc",
            },
        )
    )
    return {
        "site": site,
        "assignments": cards,
        "buckets": buckets,
        "submissions": history,
        "members": members,
        "data_mode": "live" if (assignments or submissions or members) else "empty",
    }


@router.post("/site-assignments/{assignment_id}/submit")
def submit_site_assignment(
    workspace_id: UUID,
    assignment_id: UUID,
    body: SiteSubmitIn,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(
        ctx, client, catalog_action="ssp.forms.view", product_action="ssp.forms.submit"
    )
    row = one_or_404(
        client.get(
            "ssp_form_site_assignments",
            params={
                "id": f"eq.{assignment_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": ASSIGN_SELECT,
            },
        )
    )
    site = _load_site(client, workspace_id, UUID(str(row["site_pk"])))
    _guard_site(ctx, client, membership, site, catalog_action="ssp.forms.view")
    if row.get("status") != "active":
        raise ApiError(400, "BUSINESS_RULE", "ההקצאה אינה פעילה")
    now = datetime.now(UTC)
    start = row.get("starts_at")
    if start:
        from ..ssp.site_assignments import parse_dt

        start_dt = parse_dt(start)
        if start_dt and start_dt > now:
            raise ApiError(400, "BUSINESS_RULE", "ההקצאה טרם החלה")
    member_ids = _member_ids(client, workspace_id, ctx.user_id)
    targets = as_list(
        client.get(
            "ssp_form_site_assignment_targets",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "site_assignment_id": f"eq.{assignment_id}",
                "select": "user_id",
            },
        )
    )
    is_manager = bool(
        membership
        and membership.get("product_role") in {"org_admin", "patrol_manager"}
        or catalog_allows(ctx, "ssp.assignments.manage")
    )
    if not user_may_fill(
        filler_mode=str(row.get("filler_mode") or "site"),
        user_id=ctx.user_id,
        is_site_member=str(site["id"]) in member_ids,
        is_manager=is_manager,
        target_user_ids={str(t["user_id"]) for t in targets if t.get("user_id")},
        user_department_id=membership.get("department_id") if membership else None,
        assignment_department_id=row.get("department_id"),
    ):
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])

    existing = as_list(
        client.get(
            "ssp_form_submissions",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "site_assignment_id": f"eq.{assignment_id}",
                "select": "id,submitted_by",
            },
        )
    )
    existing_for_user = any(str(s.get("submitted_by")) == str(ctx.user_id) for s in existing)
    if duplicate_submit_blocked(
        filler_mode=str(row.get("filler_mode") or "site"),
        existing_for_assignment=bool(existing),
        existing_for_user=existing_for_user,
    ):
        raise ApiError(409, "BUSINESS_RULE", "הטופס כבר הוגש להקצאה זו")

    snapshot = row.get("definition_snapshot") or {"fields": []}
    if not isinstance(snapshot, dict):
        snapshot = {"fields": []}
    answers, consent = validate_answers(snapshot, body.answers)
    created = created_or_403(
        svc.post(
            "ssp_form_submissions",
            json={
                "workspace_id": str(workspace_id),
                "form_id": row["form_id"],
                "form_version_id": row["form_version_id"],
                "assignment_id": None,
                "site_assignment_id": str(assignment_id),
                "status": "submitted",
                "answers": answers,
                "consent": consent,
                "definition_snapshot": snapshot,
                "submitted_by": ctx.user_id,
            },
            params={"select": SUBMISSION_SELECT},
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "ssp.site_assignment.submit",
        entity_type="ssp_submission",
        entity_id=created["id"],
        metadata={"site_assignment_id": str(assignment_id), "site_pk": str(site["id"])},
    )
    return created
