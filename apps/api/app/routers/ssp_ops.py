"""SSP operational API — dashboard, officers, patrols, checkpoints, scans, events, distributions."""

from __future__ import annotations

from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..deps import UserClient, current_user, load_authz_context, user_client
from ..errors import ApiError, MESSAGES
from ..identity import actor_id
from ..rest import as_list, created_or_403, one_or_404, patched_or_403, schema_missing
from datetime import datetime, timezone

from ..ssp.ops_ids import new_checkpoint_code
from ..ssp.product_authz import (
    catalog_allows,
    filter_sites_for_membership,
    load_company,
    load_member_site_ids,
    require_ssp_action,
)
from ..ssp.run_lifecycle import assert_transition, officer_may_act_on_run, progress_summary
from ..ssp.scan_rules import resolve_scan_result

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}/ssp", tags=["ssp-ops"])


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


def _require_company(client: UserClient, workspace_id: UUID) -> dict[str, Any]:
    company = load_company(client, workspace_id=str(workspace_id))
    if not company:
        raise ApiError(400, "BUSINESS_RULE", "יש להגדיר חברת SSP לפני פעולות תפעול")
    return company


def _dept_filter(membership: dict[str, Any] | None) -> str | None:
    if not membership:
        return None
    if membership.get("product_role") == "org_admin":
        return None
    return membership.get("department_id")


def _scope_params(
    workspace_id: UUID,
    company: dict[str, Any],
    membership: dict[str, Any] | None,
    *,
    select: str,
    order: str | None = None,
) -> dict[str, str]:
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "company_pk": f"eq.{company['id']}",
        "select": select,
    }
    if order:
        params["order"] = order
    dept = _dept_filter(membership)
    if dept:
        params["department_id"] = f"eq.{dept}"
    return params


# ── Dashboard ─────────────────────────────────────────────────────────────────


def _try_list(client: UserClient, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
    """Best-effort list: missing local tables (pre-migration) yield empty, not a hard fail."""
    res = client.get(table, params=params)
    if res.status_code != 200:
        return []
    data = res.json()
    return data if isinstance(data, list) else []


@router.get("/dashboard")
def ops_dashboard(
    workspace_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    status: str | None = Query(default=None),
    department_id: str | None = Query(default=None),
    from_date: str | None = Query(default=None),
    to_date: str | None = Query(default=None),
    site_id: str | None = Query(default=None),
    org_unit_id: str | None = Query(default=None),
    form_id: str | None = Query(default=None),
    assignment_status: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    # Legacy workspace SSP grants (catalog) can view ops summary; product roles use ssp.dashboard.view.
    membership = require_ssp_action(
        ctx, client, catalog_action="ssp.forms.view", product_action="ssp.dashboard.view"
    )
    company = load_company(client, workspace_id=str(workspace_id))
    now_iso = datetime.now(timezone.utc).isoformat()
    if not company:
        return {
            "company": None,
            "runs": {"planned": 0, "active": 0, "completed": 0, "late": 0},
            "open_events": 0,
            "checkpoints_active": 0,
            "checkpoint_scans_ok": 0,
            "officers": 0,
            "distributions_overdue": 0,
            "sites_active": 0,
            "forms_published": 0,
            "site_assignments_active": 0,
            "submissions_pending": 0,
            "submissions_submitted": 0,
            "submissions_overdue": 0,
            "sites_pending_activation": 0,
            "enrollments_pending": 0,
            "devices_active": 0,
            "devices_revoked": 0,
            "site_members_active": 0,
            "user_joins_pending": 0,
            "updated_at": now_iso,
            "filters": {
                "status": status,
                "department_id": department_id,
                "from_date": from_date,
                "to_date": to_date,
                "site_id": site_id,
                "org_unit_id": org_unit_id,
                "form_id": form_id,
                "assignment_status": assignment_status,
            },
            "data_mode": "empty",
        }

    run_params = _scope_params(workspace_id, company, membership, select="id,status,department_id,planned_start_at")
    if department_id and not _dept_filter(membership):
        run_params["department_id"] = f"eq.{department_id}"
    if status:
        run_params["status"] = f"eq.{status}"
    if from_date:
        run_params["planned_start_at"] = f"gte.{from_date}"
    runs = _try_list(client, "ssp_patrol_runs", run_params)
    if to_date:
        runs = [r for r in runs if not r.get("planned_start_at") or str(r["planned_start_at"])[:10] <= to_date[:10]]
    counts = {"planned": 0, "active": 0, "completed": 0, "late": 0}
    for r in runs:
        st = r.get("status")
        if st in counts:
            counts[st] += 1

    ev_params = _scope_params(workspace_id, company, membership, select="id")
    ev_params["status"] = "in.(open,in_progress)"
    open_events = len(_try_list(client, "ssp_events", ev_params))

    cp_params = _scope_params(workspace_id, company, membership, select="id")
    cp_params["is_active"] = "eq.true"
    checkpoints_active = len(_try_list(client, "ssp_checkpoints", cp_params))

    scan_params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "company_pk": f"eq.{company['id']}",
        "result": "eq.ok",
        "select": "id",
        "limit": "1000",
    }
    checkpoint_scans_ok = len(_try_list(client, "ssp_checkpoint_scans", scan_params))

    mem_params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "company_pk": f"eq.{company['id']}",
        "status": "eq.active",
        "product_role": "eq.patrol_officer",
        "select": "id",
    }
    dept = _dept_filter(membership) or department_id
    if dept:
        mem_params["department_id"] = f"eq.{dept}"
    officers = len(_try_list(client, "ssp_memberships", mem_params))

    # Overdue distributions: active + due_at in past with pending targets (best-effort count)
    dist_params = _scope_params(workspace_id, company, membership, select="id,due_at,status")
    dist_params["status"] = "eq.active"
    dists = _try_list(client, "ssp_form_distributions", dist_params)
    overdue = 0
    now = datetime.now(timezone.utc)
    for d in dists:
        due = d.get("due_at")
        if not due:
            continue
        try:
            due_dt = datetime.fromisoformat(str(due).replace("Z", "+00:00"))
        except ValueError:
            continue
        if due_dt < now:
            overdue += 1

    site_params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "company_pk": f"eq.{company['id']}",
        "is_active": "eq.true",
        "select": "id,org_unit_id,department_id,manager_user_id",
    }
    if org_unit_id:
        site_params["org_unit_id"] = f"eq.{org_unit_id}"
    if site_id:
        site_params["id"] = f"eq.{site_id}"
    dept_scope = _dept_filter(membership) or department_id
    if dept_scope:
        site_params["department_id"] = f"eq.{dept_scope}"
    sites = _try_list(client, "ssp_sites", site_params)
    sites = filter_sites_for_membership(
        sites,
        membership,
        catalog_unscoped=catalog_allows(ctx, "ssp.forms.view"),
        member_site_ids=load_member_site_ids(
            client, workspace_id=str(workspace_id), user_id=ctx.user_id
        ),
        actor_user_id=ctx.user_id,
    )
    visible_site_ids = {str(s["id"]) for s in sites if s.get("id")}

    form_params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "status": "eq.published",
        "select": "id,department_id",
    }
    if form_id:
        form_params["id"] = f"eq.{form_id}"
    forms_published_rows = _try_list(client, "ssp_forms", form_params)
    if dept_scope:
        forms_published_rows = [
            f
            for f in forms_published_rows
            if not f.get("department_id") or str(f.get("department_id")) == str(dept_scope)
        ]

    assign_params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "company_pk": f"eq.{company['id']}",
        "select": "id,site_pk,form_id,status,starts_at,due_at",
    }
    if assignment_status:
        assign_params["status"] = f"eq.{assignment_status}"
    if form_id:
        assign_params["form_id"] = f"eq.{form_id}"
    if site_id:
        assign_params["site_pk"] = f"eq.{site_id}"
    assignments = _try_list(client, "ssp_form_site_assignments", assign_params)
    if visible_site_ids:
        assignments = [a for a in assignments if str(a.get("site_pk")) in visible_site_ids]
    elif sites is not None and (org_unit_id or site_id or dept_scope):
        assignments = []

    from ..ssp.site_assignments import classify_assignment

    assign_ids = [str(a["id"]) for a in assignments if a.get("id")]
    submitted_ids: set[str] = set()
    if assign_ids:
        sub_params: dict[str, str] = {
            "workspace_id": f"eq.{workspace_id}",
            "site_assignment_id": f"in.({','.join(assign_ids)})",
            "select": "id,site_assignment_id,submitted_at",
        }
        if from_date:
            sub_params["submitted_at"] = f"gte.{from_date}"
        subs = _try_list(client, "ssp_form_submissions", sub_params)
        if to_date:
            subs = [s for s in subs if not s.get("submitted_at") or str(s["submitted_at"])[:10] <= to_date[:10]]
        submitted_ids = {str(s["site_assignment_id"]) for s in subs if s.get("site_assignment_id")}

    pending = 0
    submitted_n = 0
    overdue_assign = 0
    active_assign = 0
    clock = datetime.now(timezone.utc)
    for a in assignments:
        has_sub = str(a.get("id")) in submitted_ids
        bucket = classify_assignment(
            status=str(a.get("status") or ""),
            starts_at=a.get("starts_at"),
            due_at=a.get("due_at"),
            has_submission=has_sub,
            now=clock,
        )
        if a.get("status") == "active":
            active_assign += 1
        if bucket == "submitted":
            submitted_n += 1
        elif bucket == "overdue":
            overdue_assign += 1
        elif bucket == "available":
            pending += 1

    return {
        "company": {"id": company["id"], "company_id": company["company_id"], "name": company["name"]},
        "runs": counts,
        "open_events": open_events,
        "checkpoints_active": checkpoints_active,
        "checkpoint_scans_ok": checkpoint_scans_ok,
        "officers": officers,
        "distributions_overdue": overdue,
        "sites_active": len(sites),
        "forms_published": len(forms_published_rows),
        "site_assignments_active": active_assign,
        "submissions_pending": pending,
        "submissions_submitted": submitted_n,
        "submissions_overdue": overdue_assign,
        "enrollments_pending": len(
            [
                e
                for e in _try_list(
                    client,
                    "ssp_site_enrollments",
                    {
                        "workspace_id": f"eq.{workspace_id}",
                        "company_pk": f"eq.{company['id']}",
                        "status": "eq.pending",
                        "select": "id,site_pk,audience",
                    },
                )
                if not visible_site_ids or str(e.get("site_pk")) in visible_site_ids
            ]
        ),
        "user_joins_pending": len(
            [
                e
                for e in _try_list(
                    client,
                    "ssp_site_enrollments",
                    {
                        "workspace_id": f"eq.{workspace_id}",
                        "company_pk": f"eq.{company['id']}",
                        "status": "eq.pending",
                        "select": "id,site_pk,audience",
                    },
                )
                if str(e.get("audience") or "device") == "user"
                and (not visible_site_ids or str(e.get("site_pk")) in visible_site_ids)
            ]
        ),
        "site_members_active": len(
            {
                str(m["user_id"])
                for m in _try_list(
                    client,
                    "ssp_site_members",
                    {
                        "workspace_id": f"eq.{workspace_id}",
                        "select": "user_id,site_pk",
                    },
                )
                if m.get("user_id")
                and (not visible_site_ids or str(m.get("site_pk")) in visible_site_ids)
            }
        ),
        "devices_active": len(
            [
                d
                for d in _try_list(
                    client,
                    "ssp_site_devices",
                    {
                        "workspace_id": f"eq.{workspace_id}",
                        "company_pk": f"eq.{company['id']}",
                        "status": "eq.active",
                        "select": "id,site_pk",
                    },
                )
                if not visible_site_ids or str(d.get("site_pk")) in visible_site_ids
            ]
        ),
        "devices_revoked": len(
            [
                d
                for d in _try_list(
                    client,
                    "ssp_site_devices",
                    {
                        "workspace_id": f"eq.{workspace_id}",
                        "company_pk": f"eq.{company['id']}",
                        "status": "eq.revoked",
                        "select": "id,site_pk",
                    },
                )
                if not visible_site_ids or str(d.get("site_pk")) in visible_site_ids
            ]
        ),
        "sites_pending_activation": len(
            [
                s
                for s in sites
                if str(s.get("id")) not in {
                    str(d.get("site_pk"))
                    for d in _try_list(
                        client,
                        "ssp_site_devices",
                        {
                            "workspace_id": f"eq.{workspace_id}",
                            "company_pk": f"eq.{company['id']}",
                            "status": "eq.active",
                            "select": "site_pk",
                        },
                    )
                    if d.get("site_pk")
                }
            ]
        ),
        "updated_at": now_iso,
        "filters": {
            "status": status,
            "department_id": department_id,
            "from_date": from_date,
            "to_date": to_date,
            "site_id": site_id,
            "org_unit_id": org_unit_id,
            "form_id": form_id,
            "assignment_status": assignment_status,
        },
        "data_mode": "live",
    }


@router.get("/alerts")
def list_ops_alerts(
    workspace_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    """Real operational alerts only — no synthetic rows."""
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(
        ctx, client, catalog_action="ssp.forms.view", product_action="ssp.dashboard.view"
    )
    company = load_company(client, workspace_id=str(workspace_id))
    if not company:
        return {"items": [], "data_mode": "empty"}

    items: list[dict[str, Any]] = []
    site_params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "company_pk": f"eq.{company['id']}",
        "select": "id,department_id,manager_user_id,name",
    }
    sites = filter_sites_for_membership(
        _try_list(client, "ssp_sites", site_params),
        membership,
        catalog_unscoped=catalog_allows(ctx, "ssp.forms.view"),
        member_site_ids=load_member_site_ids(
            client, workspace_id=str(workspace_id), user_id=ctx.user_id
        ),
        actor_user_id=ctx.user_id,
    )
    visible_site_ids = {str(s["id"]) for s in sites if s.get("id")}
    site_name = {str(s["id"]): s.get("name") for s in sites}

    events = _try_list(
        client,
        "ssp_events",
        {
            "workspace_id": f"eq.{workspace_id}",
            "company_pk": f"eq.{company['id']}",
            "status": "in.(open,in_progress)",
            "select": "id,title,status,severity,created_at,updated_at",
            "order": "created_at.desc",
            "limit": "50",
        },
    )
    for row in events:
        items.append(
            {
                "id": f"event:{row['id']}",
                "source": "event",
                "status": row.get("status"),
                "at": row.get("updated_at") or row.get("created_at"),
                "title": row.get("title"),
                "href": f"/app/ssp/events/{row['id']}",
                "severity": row.get("severity"),
            }
        )

    late_runs = _try_list(
        client,
        "ssp_patrol_runs",
        {
            "workspace_id": f"eq.{workspace_id}",
            "company_pk": f"eq.{company['id']}",
            "status": "eq.late",
            "select": "id,status,planned_end_at,updated_at,created_at",
            "limit": "50",
        },
    )
    for row in late_runs:
        items.append(
            {
                "id": f"patrol:{row['id']}",
                "source": "patrol",
                "status": row.get("status"),
                "at": row.get("updated_at") or row.get("planned_end_at") or row.get("created_at"),
                "title": "חריגת סיור",
                "href": "/app/ssp/patrols",
            }
        )

    pending = _try_list(
        client,
        "ssp_site_enrollments",
        {
            "workspace_id": f"eq.{workspace_id}",
            "company_pk": f"eq.{company['id']}",
            "status": "eq.pending",
            "select": "id,site_pk,status,created_at,audience",
            "limit": "50",
        },
    )
    for row in pending:
        sid = str(row.get("site_pk") or "")
        if visible_site_ids and sid not in visible_site_ids:
            continue
        items.append(
            {
                "id": f"join:{row['id']}",
                "source": "join",
                "status": row.get("status"),
                "at": row.get("created_at"),
                "title": site_name.get(sid) or "בקשת הצטרפות",
                "href": "/app/ssp/enrollments?status=pending",
            }
        )

    from ..ssp.site_assignments import classify_assignment

    assigns = _try_list(
        client,
        "ssp_form_site_assignments",
        {
            "workspace_id": f"eq.{workspace_id}",
            "company_pk": f"eq.{company['id']}",
            "status": "eq.active",
            "select": "id,site_pk,form_id,status,starts_at,due_at",
            "limit": "100",
        },
    )
    if visible_site_ids:
        assigns = [a for a in assigns if str(a.get("site_pk")) in visible_site_ids]
    assign_ids = [str(a["id"]) for a in assigns if a.get("id")]
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
    clock = datetime.now(timezone.utc)
    for a in assigns:
        bucket = classify_assignment(
            status=str(a.get("status") or ""),
            starts_at=a.get("starts_at"),
            due_at=a.get("due_at"),
            has_submission=str(a.get("id")) in submitted,
            now=clock,
        )
        if bucket not in {"overdue", "available"}:
            continue
        sid = str(a.get("site_pk") or "")
        items.append(
            {
                "id": f"form:{a['id']}",
                "source": "form",
                "status": bucket,
                "at": a.get("due_at") or a.get("starts_at"),
                "title": site_name.get(sid) or "טופס",
                "href": f"/app/ssp/sites/{sid}" if sid else "/app/ssp/activity",
            }
        )

    items.sort(key=lambda r: str(r.get("at") or ""), reverse=True)
    return {"items": items[:80], "data_mode": "live" if items else "empty"}


# ── Officers (SSP memberships with patrol roles) ───────────────────────────────


@router.get("/officers")
def list_officers(
    workspace_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.officers.view")
    company = _require_company(client, workspace_id)
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "company_pk": f"eq.{company['id']}",
        "status": "eq.active",
        "product_role": "in.(patrol_officer,patrol_manager)",
        "select": (
            "id,workspace_id,company_pk,user_id,org_unit_id,department_id,"
            "product_role,manager_user_id,status,created_at"
        ),
        "order": "created_at.desc",
    }
    dept = _dept_filter(membership)
    if dept:
        params["department_id"] = f"eq.{dept}"
    officers_res = client.get("ssp_memberships", params=params)
    if schema_missing(officers_res):
        return {"items": [], "data_mode": "unavailable"}
    return {"items": as_list(officers_res), "data_mode": "live"}


# ── Checkpoints ───────────────────────────────────────────────────────────────


class CheckpointCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)
    location_label: str | None = Field(default=None, max_length=200)
    org_unit_id: str | None = None
    department_id: str | None = None
    code_format: Literal["qr", "barcode", "both"] = "qr"


@router.get("/checkpoints")
def list_checkpoints(
    workspace_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.checkpoints.view")
    company = _require_company(client, workspace_id)
    params = _scope_params(
        workspace_id,
        company,
        membership,
        select="id,workspace_id,company_pk,org_unit_id,department_id,code,name,location_label,code_format,is_active,created_at",
        order="name.asc",
    )
    return {"items": as_list(client.get("ssp_checkpoints", params=params)), "data_mode": "live"}


@router.post("/checkpoints", status_code=201)
def create_checkpoint(
    workspace_id: UUID,
    body: CheckpointCreate,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.checkpoints.edit")
    company = _require_company(client, workspace_id)
    dept = body.department_id or (membership.get("department_id") if membership else None)
    row = created_or_403(
        client.post(
            "ssp_checkpoints",
            json={
                "workspace_id": str(workspace_id),
                "company_pk": company["id"],
                "org_unit_id": body.org_unit_id or (membership.get("org_unit_id") if membership else None),
                "department_id": dept,
                "code": new_checkpoint_code(),
                "name": body.name.strip(),
                "location_label": (body.location_label or "").strip() or None,
                "code_format": body.code_format,
                "created_by": ctx.user_id,
            },
        )
    )
    return row


# ── Patrols ───────────────────────────────────────────────────────────────────


class PatrolCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    department_id: str | None = None
    org_unit_id: str | None = None


class PatrolStopPut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    stops: list[dict[str, Any]] = Field(default_factory=list)


@router.get("/patrols")
def list_patrols(
    workspace_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.patrols.view")
    company = _require_company(client, workspace_id)
    params = _scope_params(
        workspace_id,
        company,
        membership,
        select="id,workspace_id,company_pk,org_unit_id,department_id,name,description,status,created_at,updated_at",
        order="updated_at.desc",
    )
    role = membership.get("product_role") if membership else None
    if role == "patrol_officer":
        params["status"] = "eq.active"
    return {"items": as_list(client.get("ssp_patrols", params=params)), "data_mode": "live"}


@router.post("/patrols", status_code=201)
def create_patrol(
    workspace_id: UUID,
    body: PatrolCreate,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.patrols.edit")
    company = _require_company(client, workspace_id)
    dept = body.department_id or (membership.get("department_id") if membership else None)
    return created_or_403(
        client.post(
            "ssp_patrols",
            json={
                "workspace_id": str(workspace_id),
                "company_pk": company["id"],
                "org_unit_id": body.org_unit_id or (membership.get("org_unit_id") if membership else None),
                "department_id": dept,
                "name": body.name.strip(),
                "description": (body.description or "").strip(),
                "status": "draft",
                "created_by": ctx.user_id,
            },
        )
    )


@router.get("/patrols/{patrol_id}")
def get_patrol(
    workspace_id: UUID,
    patrol_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.patrols.view")
    company = _require_company(client, workspace_id)
    patrol = one_or_404(
        client.get(
            "ssp_patrols",
            params={
                "id": f"eq.{patrol_id}",
                "workspace_id": f"eq.{workspace_id}",
                "company_pk": f"eq.{company['id']}",
                "select": "*",
            },
        )
    )
    stops = as_list(
        client.get(
            "ssp_patrol_stops",
            params={
                "patrol_id": f"eq.{patrol_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,patrol_id,checkpoint_id,sort_order,is_required",
                "order": "sort_order.asc",
            },
        )
    )
    return {"patrol": patrol, "stops": stops, "data_mode": "live"}


@router.put("/patrols/{patrol_id}/stops")
def put_patrol_stops(
    workspace_id: UUID,
    patrol_id: UUID,
    body: PatrolStopPut,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.patrols.edit")
    company = _require_company(client, workspace_id)
    one_or_404(
        client.get(
            "ssp_patrols",
            params={
                "id": f"eq.{patrol_id}",
                "workspace_id": f"eq.{workspace_id}",
                "company_pk": f"eq.{company['id']}",
                "select": "id",
            },
        )
    )
    # Replace stops: delete existing then insert (scoped).
    client.delete(
        "ssp_patrol_stops",
        params={"patrol_id": f"eq.{patrol_id}", "workspace_id": f"eq.{workspace_id}"},
    )
    created = []
    for i, stop in enumerate(body.stops):
        cp_id = stop.get("checkpoint_id")
        if not cp_id:
            continue
        one_or_404(
            client.get(
                "ssp_checkpoints",
                params={
                    "id": f"eq.{cp_id}",
                    "workspace_id": f"eq.{workspace_id}",
                    "company_pk": f"eq.{company['id']}",
                    "select": "id",
                },
            )
        )
        created.append(
            created_or_403(
                client.post(
                    "ssp_patrol_stops",
                    json={
                        "workspace_id": str(workspace_id),
                        "patrol_id": str(patrol_id),
                        "checkpoint_id": cp_id,
                        "sort_order": int(stop.get("sort_order", i)),
                        "is_required": bool(stop.get("is_required", True)),
                    },
                )
            )
        )
    return {"items": created}


class PatrolRunCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    patrol_id: str
    planned_start_at: str | None = None
    planned_end_at: str | None = None
    assignee_user_ids: list[str] = Field(default_factory=list)


@router.get("/patrol-runs")
def list_patrol_runs(
    workspace_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    status: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.patrols.view")
    company = _require_company(client, workspace_id)
    role = membership.get("product_role") if membership else None
    if role == "patrol_officer":
        # Only runs assigned to this officer.
        assigns = as_list(
            client.get(
                "ssp_patrol_run_assignees",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "user_id": f"eq.{ctx.user_id}",
                    "select": "run_id",
                },
            )
        )
        run_ids = [a["run_id"] for a in assigns if a.get("run_id")]
        if not run_ids:
            return {"items": [], "data_mode": "live"}
        params: dict[str, str] = {
            "workspace_id": f"eq.{workspace_id}",
            "company_pk": f"eq.{company['id']}",
            "id": f"in.({','.join(run_ids)})",
            "select": "*",
            "order": "planned_start_at.desc.nullslast,created_at.desc",
        }
    else:
        params = _scope_params(workspace_id, company, membership, select="*", order="planned_start_at.desc.nullslast,created_at.desc")
    if status:
        params["status"] = f"eq.{status}"
    return {"items": as_list(client.get("ssp_patrol_runs", params=params)), "data_mode": "live"}


@router.post("/patrol-runs", status_code=201)
def create_patrol_run(
    workspace_id: UUID,
    body: PatrolRunCreate,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.patrols.edit")
    company = _require_company(client, workspace_id)
    patrol = one_or_404(
        client.get(
            "ssp_patrols",
            params={
                "id": f"eq.{body.patrol_id}",
                "workspace_id": f"eq.{workspace_id}",
                "company_pk": f"eq.{company['id']}",
                "select": "id,department_id,status",
            },
        )
    )
    run = created_or_403(
        client.post(
            "ssp_patrol_runs",
            json={
                "workspace_id": str(workspace_id),
                "company_pk": company["id"],
                "patrol_id": body.patrol_id,
                "department_id": patrol.get("department_id")
                or (membership.get("department_id") if membership else None),
                "status": "planned",
                "planned_start_at": body.planned_start_at,
                "planned_end_at": body.planned_end_at,
                "created_by": ctx.user_id,
            },
        )
    )
    for uid in body.assignee_user_ids:
        created_or_403(
            client.post(
                "ssp_patrol_run_assignees",
                json={"workspace_id": str(workspace_id), "run_id": run["id"], "user_id": uid},
            )
        )
    return run


def _run_assignee_ids(client: UserClient, workspace_id: UUID, run_id: str) -> list[str]:
    rows = as_list(
        client.get(
            "ssp_patrol_run_assignees",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "run_id": f"eq.{run_id}",
                "select": "user_id",
            },
        )
    )
    return [str(r["user_id"]) for r in rows if r.get("user_id")]


def _load_run_in_company(
    client: UserClient, workspace_id: UUID, company: dict[str, Any], run_id: str
) -> dict[str, Any]:
    return one_or_404(
        client.get(
            "ssp_patrol_runs",
            params={
                "id": f"eq.{run_id}",
                "workspace_id": f"eq.{workspace_id}",
                "company_pk": f"eq.{company['id']}",
                "select": "*",
            },
        )
    )


@router.get("/patrol-runs/{run_id}")
def get_patrol_run(
    workspace_id: UUID,
    run_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.patrols.view")
    company = _require_company(client, workspace_id)
    run = _load_run_in_company(client, workspace_id, company, str(run_id))
    assignees = _run_assignee_ids(client, workspace_id, str(run_id))
    role = membership.get("product_role") if membership else None
    if role == "patrol_officer" and str(ctx.user_id) not in assignees:
        raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
    dept = _dept_filter(membership)
    if dept and run.get("department_id") and str(run["department_id"]) != str(dept):
        raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])

    stops = as_list(
        client.get(
            "ssp_patrol_stops",
            params={
                "patrol_id": f"eq.{run['patrol_id']}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "checkpoint_id,sort_order,is_required",
                "order": "sort_order.asc",
            },
        )
    )
    scans = as_list(
        client.get(
            "ssp_checkpoint_scans",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "run_id": f"eq.{run_id}",
                "select": "id,checkpoint_id,result,scanned_at,scanned_by",
                "order": "scanned_at.asc",
            },
        )
    )
    ok_ids = [s["checkpoint_id"] for s in scans if s.get("result") == "ok"]
    progress = progress_summary(
        stop_checkpoint_ids=[s["checkpoint_id"] for s in stops],
        required_checkpoint_ids=[s["checkpoint_id"] for s in stops if s.get("is_required")],
        ok_scanned_checkpoint_ids=ok_ids,
    )
    return {
        "run": run,
        "assignees": assignees,
        "stops": stops,
        "scans": scans,
        "progress": progress,
        "data_mode": "live",
    }


@router.post("/patrol-runs/{run_id}/start")
def start_patrol_run(
    workspace_id: UUID,
    run_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.patrols.view")
    # Officers need view + assignment; managers need edit or view+assignment for start
    role = membership.get("product_role") if membership else None
    if role == "patrol_manager" or role == "org_admin":
        require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.patrols.edit")
    company = _require_company(client, workspace_id)
    run = _load_run_in_company(client, workspace_id, company, str(run_id))
    assignees = _run_assignee_ids(client, workspace_id, str(run_id))
    if not officer_may_act_on_run(
        product_role=role, user_id=ctx.user_id, assignee_user_ids=assignees
    ):
        # Allow officer start when assigned even without edit grant
        if role != "patrol_officer" or str(ctx.user_id) not in assignees:
            raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
    assert_transition(run.get("status") or "planned", "active")
    now = datetime.now(timezone.utc).isoformat()
    return patched_or_403(
        client.patch(
            "ssp_patrol_runs",
            json={"status": "active", "started_at": now},
            params={"id": f"eq.{run_id}", "workspace_id": f"eq.{workspace_id}", "select": "*"},
        )
    )


@router.post("/patrol-runs/{run_id}/complete")
def complete_patrol_run(
    workspace_id: UUID,
    run_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.patrols.view")
    role = membership.get("product_role") if membership else None
    if role in {"patrol_manager", "org_admin"}:
        require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.patrols.edit")
    company = _require_company(client, workspace_id)
    run = _load_run_in_company(client, workspace_id, company, str(run_id))
    assignees = _run_assignee_ids(client, workspace_id, str(run_id))
    if not officer_may_act_on_run(
        product_role=role, user_id=ctx.user_id, assignee_user_ids=assignees
    ):
        if role != "patrol_officer" or str(ctx.user_id) not in assignees:
            raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
    assert_transition(run.get("status") or "planned", "completed")
    now = datetime.now(timezone.utc).isoformat()
    return patched_or_403(
        client.patch(
            "ssp_patrol_runs",
            json={"status": "completed", "completed_at": now},
            params={"id": f"eq.{run_id}", "workspace_id": f"eq.{workspace_id}", "select": "*"},
        )
    )


# ── Scans ─────────────────────────────────────────────────────────────────────


class ScanCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=8, max_length=64)
    run_id: str | None = None
    notes: str | None = Field(default=None, max_length=1000)


@router.post("/scans", status_code=201)
def create_scan(
    workspace_id: UUID,
    body: ScanCreate,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    """Scan records validation result — QR alone is never authorization."""
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.scans.create")
    company = _require_company(client, workspace_id)
    code = body.code.strip().lower()
    cp_rows = as_list(
        client.get(
            "ssp_checkpoints",
            params={
                "code": f"eq.{code}",
                "workspace_id": f"eq.{workspace_id}",
                "company_pk": f"eq.{company['id']}",
                "is_active": "eq.true",
                "select": "*",
                "limit": "1",
            },
        )
    )
    if not cp_rows:
        raise ApiError(404, "NOT_FOUND", "נקודת ביקורת לא נמצאה או אינה פעילה")
    cp = cp_rows[0]

    dept = membership.get("department_id") if membership else None
    if (
        membership
        and membership.get("product_role") in {"patrol_manager", "patrol_officer"}
        and dept
        and cp.get("department_id")
        and str(cp["department_id"]) != str(dept)
    ):
        raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])

    run_status: str | None = None
    on_route: bool | None = None
    already_ok = False
    if body.run_id:
        run = _load_run_in_company(client, workspace_id, company, body.run_id)
        run_status = run.get("status")
        assignees = _run_assignee_ids(client, workspace_id, body.run_id)
        role = membership.get("product_role") if membership else None
        if not officer_may_act_on_run(
            product_role=role, user_id=ctx.user_id, assignee_user_ids=assignees
        ):
            if role != "patrol_officer" or str(ctx.user_id) not in assignees:
                raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
        stops = as_list(
            client.get(
                "ssp_patrol_stops",
                params={
                    "patrol_id": f"eq.{run['patrol_id']}",
                    "workspace_id": f"eq.{workspace_id}",
                    "select": "checkpoint_id",
                },
            )
        )
        route_ids = {str(s["checkpoint_id"]) for s in stops}
        on_route = str(cp["id"]) in route_ids if route_ids else None
        prior = as_list(
            client.get(
                "ssp_checkpoint_scans",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "checkpoint_id": f"eq.{cp['id']}",
                    "run_id": f"eq.{body.run_id}",
                    "result": "eq.ok",
                    "select": "id",
                    "limit": "1",
                },
            )
        )
        already_ok = bool(prior)

    result = resolve_scan_result(
        checkpoint_on_route=on_route,
        already_ok_scanned=already_ok,
        run_status=run_status,
    )
    row = created_or_403(
        client.post(
            "ssp_checkpoint_scans",
            json={
                "workspace_id": str(workspace_id),
                "company_pk": company["id"],
                "checkpoint_id": cp["id"],
                "run_id": body.run_id,
                "scanned_by": ctx.user_id,
                "result": result,
                "notes": (body.notes or "").strip() or None,
            },
        )
    )
    return {"scan": row, "checkpoint": {"id": cp["id"], "name": cp.get("name"), "code": cp.get("code")}, "result": result}


# ── Events ────────────────────────────────────────────────────────────────────


class EventCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=4000)
    category: Literal["general", "security", "safety", "maintenance", "other"] = "general"
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    run_id: str | None = None
    checkpoint_id: str | None = None
    location_label: str | None = Field(default=None, max_length=200)
    occurred_at: str | None = None


class EventPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["open", "in_progress", "resolved", "closed"] | None = None
    severity: Literal["low", "medium", "high", "critical"] | None = None
    assignee_user_id: str | None = None
    description: str | None = Field(default=None, max_length=4000)
    note: str | None = Field(default=None, max_length=2000)


def _append_event_action(
    client: UserClient,
    *,
    workspace_id: str,
    company_pk: str,
    event_id: str,
    actor_user_id: str,
    action_type: str,
    from_value: str | None = None,
    to_value: str | None = None,
    note: str | None = None,
) -> None:
    client.post(
        "ssp_event_actions",
        json={
            "workspace_id": workspace_id,
            "company_pk": company_pk,
            "event_id": event_id,
            "actor_user_id": actor_user_id,
            "action_type": action_type,
            "from_value": from_value,
            "to_value": to_value,
            "note": note,
        },
    )


@router.get("/events")
def list_events(
    workspace_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
    status: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.events.view")
    company = _require_company(client, workspace_id)
    role = membership.get("product_role") if membership else None
    params = _scope_params(
        workspace_id,
        company,
        membership,
        select="*",
        order="created_at.desc",
    )
    if role == "patrol_officer":
        params["or"] = f"(reported_by.eq.{ctx.user_id},assignee_user_id.eq.{ctx.user_id})"
    if status:
        params["status"] = f"eq.{status}"
    return {"items": as_list(client.get("ssp_events", params=params)), "data_mode": "live"}


@router.post("/events", status_code=201)
def create_event(
    workspace_id: UUID,
    body: EventCreate,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.events.create")
    company = _require_company(client, workspace_id)
    event = created_or_403(
        client.post(
            "ssp_events",
            json={
                "workspace_id": str(workspace_id),
                "company_pk": company["id"],
                "org_unit_id": membership.get("org_unit_id") if membership else None,
                "department_id": membership.get("department_id") if membership else None,
                "run_id": body.run_id,
                "checkpoint_id": body.checkpoint_id,
                "reported_by": ctx.user_id,
                "title": body.title.strip(),
                "description": (body.description or "").strip(),
                "category": body.category,
                "severity": body.severity,
                "status": "open",
                "occurred_at": body.occurred_at,
                "location_label": (body.location_label or "").strip() or None,
            },
        )
    )
    _append_event_action(
        client,
        workspace_id=str(workspace_id),
        company_pk=company["id"],
        event_id=event["id"],
        actor_user_id=ctx.user_id,
        action_type="created",
        to_value="open",
    )
    return event


@router.get("/events/{event_id}")
def get_event(
    workspace_id: UUID,
    event_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.events.view")
    company = _require_company(client, workspace_id)
    event = one_or_404(
        client.get(
            "ssp_events",
            params={
                "id": f"eq.{event_id}",
                "workspace_id": f"eq.{workspace_id}",
                "company_pk": f"eq.{company['id']}",
                "select": "*",
            },
        )
    )
    role = membership.get("product_role") if membership else None
    if role == "patrol_officer":
        if str(event.get("reported_by") or "") != str(ctx.user_id) and str(
            event.get("assignee_user_id") or ""
        ) != str(ctx.user_id):
            raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
    actions = as_list(
        client.get(
            "ssp_event_actions",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "event_id": f"eq.{event_id}",
                "select": "id,actor_user_id,action_type,from_value,to_value,note,created_at",
                "order": "created_at.asc",
            },
        )
    )
    return {"event": event, "actions": actions, "data_mode": "live"}


@router.patch("/events/{event_id}")
def patch_event(
    workspace_id: UUID,
    event_id: UUID,
    body: EventPatch,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    from ..ssp.product_authz import load_ssp_membership, product_grants

    membership = load_ssp_membership(client, workspace_id=str(workspace_id), user_id=ctx.user_id)
    grants = product_grants(membership.get("product_role") if membership else None)
    # Officers may add notes / update own open events limited; managers use edit
    if "ssp.events.edit" not in grants:
        if "ssp.events.create" not in grants:
            require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.events.edit")
        # Officer: only note on own/assigned events; no arbitrary status close without edit
        if body.status is not None or body.assignee_user_id is not None or body.severity is not None:
            raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    else:
        require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.events.edit")

    company = _require_company(client, workspace_id)
    existing = one_or_404(
        client.get(
            "ssp_events",
            params={
                "id": f"eq.{event_id}",
                "workspace_id": f"eq.{workspace_id}",
                "company_pk": f"eq.{company['id']}",
                "select": "*",
            },
        )
    )
    if membership and membership.get("product_role") == "patrol_officer":
        if str(existing.get("reported_by") or "") != str(ctx.user_id) and str(
            existing.get("assignee_user_id") or ""
        ) != str(ctx.user_id):
            raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])

    patch: dict[str, Any] = {}
    if body.status is not None:
        patch["status"] = body.status
    if body.severity is not None:
        patch["severity"] = body.severity
    if body.assignee_user_id is not None:
        patch["assignee_user_id"] = body.assignee_user_id
    if body.description is not None:
        patch["description"] = body.description.strip()
    if not patch and not body.note:
        raise ApiError(400, "VALIDATION_ERROR", "אין שדות לעדכון")

    updated = existing
    if patch:
        updated = patched_or_403(
            client.patch(
                "ssp_events",
                json=patch,
                params={"id": f"eq.{event_id}", "workspace_id": f"eq.{workspace_id}", "select": "*"},
            )
        )
        if "status" in patch:
            action = "closed" if patch["status"] == "closed" else "status_changed"
            _append_event_action(
                client,
                workspace_id=str(workspace_id),
                company_pk=company["id"],
                event_id=str(event_id),
                actor_user_id=ctx.user_id,
                action_type=action,
                from_value=str(existing.get("status")),
                to_value=str(patch["status"]),
            )
        if "severity" in patch:
            _append_event_action(
                client,
                workspace_id=str(workspace_id),
                company_pk=company["id"],
                event_id=str(event_id),
                actor_user_id=ctx.user_id,
                action_type="severity_changed",
                from_value=str(existing.get("severity")),
                to_value=str(patch["severity"]),
            )
        if "assignee_user_id" in patch:
            _append_event_action(
                client,
                workspace_id=str(workspace_id),
                company_pk=company["id"],
                event_id=str(event_id),
                actor_user_id=ctx.user_id,
                action_type="assigned",
                from_value=str(existing.get("assignee_user_id") or ""),
                to_value=str(patch["assignee_user_id"] or ""),
            )
    if body.note:
        _append_event_action(
            client,
            workspace_id=str(workspace_id),
            company_pk=company["id"],
            event_id=str(event_id),
            actor_user_id=ctx.user_id,
            action_type="note_added",
            note=body.note.strip(),
        )
    return updated


# ── Distributions ─────────────────────────────────────────────────────────────


class DistributionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    form_id: str
    title: str = Field(default="", max_length=200)
    due_at: str | None = None
    require_completion: bool = False
    target_user_ids: list[str] = Field(default_factory=list)
    department_id: str | None = None
    org_unit_id: str | None = None
    run_id: str | None = None


def _effective_target_status(target: dict[str, Any], due_at: str | None) -> str:
    st = target.get("status") or "pending"
    if st == "submitted":
        return "submitted"
    if st == "waived":
        return "waived"
    if due_at:
        try:
            due_dt = datetime.fromisoformat(str(due_at).replace("Z", "+00:00"))
            if due_dt < datetime.now(timezone.utc) and st in {"pending", "started"}:
                return "overdue"
        except ValueError:
            pass
    return st


@router.get("/distributions")
def list_distributions(
    workspace_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.distributions.view")
    company = _require_company(client, workspace_id)
    role = membership.get("product_role") if membership else None
    if role == "patrol_officer":
        targets = as_list(
            client.get(
                "ssp_form_distribution_targets",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "user_id": f"eq.{ctx.user_id}",
                    "select": "id,distribution_id,user_id,status,submitted_at,started_at",
                },
            )
        )
        dist_ids = [t["distribution_id"] for t in targets if t.get("distribution_id")]
        if not dist_ids:
            return {"items": [], "targets": [], "data_mode": "live"}
        items = as_list(
            client.get(
                "ssp_form_distributions",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "company_pk": f"eq.{company['id']}",
                    "id": f"in.({','.join(dist_ids)})",
                    "select": "*",
                    "order": "created_at.desc",
                },
            )
        )
        by_id = {d["id"]: d for d in items}
        enriched = []
        for t in targets:
            d = by_id.get(t["distribution_id"])
            enriched.append(
                {
                    **t,
                    "effective_status": _effective_target_status(t, d.get("due_at") if d else None),
                    "form_id": d.get("form_id") if d else None,
                    "title": d.get("title") if d else None,
                    "due_at": d.get("due_at") if d else None,
                    "form_version_id": d.get("form_version_id") if d else None,
                }
            )
        return {"items": items, "targets": enriched, "data_mode": "live"}

    params = _scope_params(workspace_id, company, membership, select="*", order="created_at.desc")
    items = as_list(client.get("ssp_form_distributions", params=params))
    return {"items": items, "data_mode": "live"}


@router.get("/distributions/{distribution_id}")
def get_distribution(
    workspace_id: UUID,
    distribution_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.distributions.view")
    company = _require_company(client, workspace_id)
    dist = one_or_404(
        client.get(
            "ssp_form_distributions",
            params={
                "id": f"eq.{distribution_id}",
                "workspace_id": f"eq.{workspace_id}",
                "company_pk": f"eq.{company['id']}",
                "select": "*",
            },
        )
    )
    targets = as_list(
        client.get(
            "ssp_form_distribution_targets",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "distribution_id": f"eq.{distribution_id}",
                "select": "id,user_id,status,submitted_at,started_at",
            },
        )
    )
    role = membership.get("product_role") if membership else None
    if role == "patrol_officer":
        targets = [t for t in targets if str(t.get("user_id")) == str(ctx.user_id)]
        if not targets:
            raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
    enriched = [{**t, "effective_status": _effective_target_status(t, dist.get("due_at"))} for t in targets]
    return {"distribution": dist, "targets": enriched, "data_mode": "live"}


@router.post("/distributions", status_code=201)
def create_distribution(
    workspace_id: UUID,
    body: DistributionCreate,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    membership = require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.distributions.manage")
    company = _require_company(client, workspace_id)
    one_or_404(
        client.get(
            "ssp_forms",
            params={
                "id": f"eq.{body.form_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id",
            },
        )
    )
    # Snapshot latest published version — historical submissions keep their own version rows
    versions = as_list(
        client.get(
            "ssp_form_versions",
            params={
                "form_id": f"eq.{body.form_id}",
                "workspace_id": f"eq.{workspace_id}",
                "status": "eq.published",
                "select": "id,version",
                "order": "version.desc",
                "limit": "1",
            },
        )
    )
    form_version_id = versions[0]["id"] if versions else None

    target_ids = list(body.target_user_ids)
    # Expand department members into targets when department_id set and no explicit users
    dept_id = body.department_id or (membership.get("department_id") if membership else None)
    if not target_ids and dept_id:
        members = as_list(
            client.get(
                "ssp_memberships",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "company_pk": f"eq.{company['id']}",
                    "department_id": f"eq.{dept_id}",
                    "status": "eq.active",
                    "select": "user_id",
                },
            )
        )
        target_ids = [m["user_id"] for m in members if m.get("user_id")]

    dist = created_or_403(
        client.post(
            "ssp_form_distributions",
            json={
                "workspace_id": str(workspace_id),
                "company_pk": company["id"],
                "form_id": body.form_id,
                "form_version_id": form_version_id,
                "department_id": dept_id,
                "org_unit_id": body.org_unit_id
                or (membership.get("org_unit_id") if membership else None),
                "run_id": body.run_id,
                "title": (body.title or "").strip(),
                "due_at": body.due_at,
                "require_completion": body.require_completion,
                "status": "active",
                "created_by": ctx.user_id,
            },
        )
    )
    for uid in target_ids:
        # Unique (distribution_id, user_id) — skip duplicates silently via check
        existing = as_list(
            client.get(
                "ssp_form_distribution_targets",
                params={
                    "distribution_id": f"eq.{dist['id']}",
                    "user_id": f"eq.{uid}",
                    "select": "id",
                    "limit": "1",
                },
            )
        )
        if existing:
            continue
        created_or_403(
            client.post(
                "ssp_form_distribution_targets",
                json={
                    "workspace_id": str(workspace_id),
                    "distribution_id": dist["id"],
                    "user_id": uid,
                    "status": "pending",
                },
            )
        )
    return dist


@router.post("/distributions/{distribution_id}/start")
def start_distribution_target(
    workspace_id: UUID,
    distribution_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.distributions.view")
    company = _require_company(client, workspace_id)
    one_or_404(
        client.get(
            "ssp_form_distributions",
            params={
                "id": f"eq.{distribution_id}",
                "workspace_id": f"eq.{workspace_id}",
                "company_pk": f"eq.{company['id']}",
                "select": "id",
            },
        )
    )
    targets = as_list(
        client.get(
            "ssp_form_distribution_targets",
            params={
                "distribution_id": f"eq.{distribution_id}",
                "workspace_id": f"eq.{workspace_id}",
                "user_id": f"eq.{ctx.user_id}",
                "select": "*",
                "limit": "1",
            },
        )
    )
    if not targets:
        raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
    t = targets[0]
    if t.get("status") == "submitted":
        raise ApiError(400, "BUSINESS_RULE", "הטופס כבר הוגש")
    if t.get("status") == "started":
        return t
    now = datetime.now(timezone.utc).isoformat()
    return patched_or_403(
        client.patch(
            "ssp_form_distribution_targets",
            json={"status": "started", "started_at": now},
            params={"id": f"eq.{t['id']}", "workspace_id": f"eq.{workspace_id}", "select": "*"},
        )
    )


@router.post("/distributions/{distribution_id}/complete")
def complete_distribution_target(
    workspace_id: UUID,
    distribution_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    """Mark target submitted after officer form submit — prevents double-complete."""
    ctx = _ctx(client, user, workspace_id)
    require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.forms.submit")
    company = _require_company(client, workspace_id)
    one_or_404(
        client.get(
            "ssp_form_distributions",
            params={
                "id": f"eq.{distribution_id}",
                "workspace_id": f"eq.{workspace_id}",
                "company_pk": f"eq.{company['id']}",
                "select": "id",
            },
        )
    )
    targets = as_list(
        client.get(
            "ssp_form_distribution_targets",
            params={
                "distribution_id": f"eq.{distribution_id}",
                "workspace_id": f"eq.{workspace_id}",
                "user_id": f"eq.{ctx.user_id}",
                "select": "*",
                "limit": "1",
            },
        )
    )
    if not targets:
        raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
    t = targets[0]
    if t.get("status") == "submitted":
        raise ApiError(409, "BUSINESS_RULE", "הגשה כפולה אינה מותרת להפצה זו")
    now = datetime.now(timezone.utc).isoformat()
    return patched_or_403(
        client.patch(
            "ssp_form_distribution_targets",
            json={"status": "submitted", "submitted_at": now},
            params={"id": f"eq.{t['id']}", "workspace_id": f"eq.{workspace_id}", "select": "*"},
        )
    )
