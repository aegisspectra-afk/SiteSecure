from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..audit import write_audit
from ..authz.guard import require
from ..authz.scope import (
    apply_assigned_job_list_filter,
    apply_assigned_project_list_filter,
    apply_assigned_service_call_list_filter,
    apply_assigned_task_list_filter,
    empty_assigned_page,
    is_assigned_scope,
)
from ..authz.types import ResourceRef
from ..deps import UserClient, current_user, load_authz_context, service_client, user_client
from ..notify import notify_task_assigned, try_notify
from ..errors import ApiError
from ..identity import actor_id
from ..installed_assets_from_planned import (
    build_create_plan,
    count_assets_by_planned_item,
    create_installed_assets_from_plan,
)
from ..csv_export import EXPORT_MAX, EXPORT_PAGE, TASK_STATUS_HE, build_csv, csv_response
from ..pagination import decode_cursor, page_from_rows, parse_limit
from ..project_from_quote import plan_project_from_quote
from ..rest import acked_or_403, as_list, created_or_403, one_or_404, patched_or_403
from ..search_query import sanitize_search_q
from ..supabase_service import ServiceClient

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["ops"])


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


# ── Leads ────────────────────────────────────────────────────────────────────


class LeadCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=200)
    status: str = "new"
    source: str = "manual"
    priority: str = "normal"
    service_type: str | None = None
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    notes: str | None = None
    next_action: str | None = None
    next_action_at: str | None = None
    estimated_value_cents: int | None = None
    requirements: dict | None = None
    address_text: str | None = None
    property_notes: str | None = None
    customer_id: str | None = None
    site_id: str | None = None


class LeadPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, min_length=1, max_length=200)
    status: str | None = None
    source: str | None = None
    priority: str | None = None
    service_type: str | None = None
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    notes: str | None = None
    next_action: str | None = None
    next_action_at: str | None = None
    estimated_value_cents: int | None = Field(default=None, ge=0)
    requirements: dict | None = None
    address_text: str | None = None
    property_notes: str | None = None
    customer_id: str | None = None
    site_id: str | None = None


LEAD_SELECT = (
    "id,workspace_id,title,status,source,priority,service_type,owner_user_id,customer_id,site_id,"
    "contact_name,email,phone,notes,next_action,next_action_at,estimated_value_cents,requirements,"
    "address_text,property_notes,created_at,updated_at"
)


def _assert_lead_relations(
    client: UserClient,
    workspace_id: UUID,
    *,
    customer_id: str | None,
    site_id: str | None,
) -> None:
    if customer_id:
        one_or_404(
            client.get(
                "customers",
                params={"id": f"eq.{customer_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
            )
        )
    if site_id:
        site = one_or_404(
            client.get(
                "sites",
                params={"id": f"eq.{site_id}", "workspace_id": f"eq.{workspace_id}", "select": "id,customer_id"},
            )
        )
        if customer_id and str(site.get("customer_id")) != customer_id:
            raise ApiError(400, "VALIDATION_ERROR", "האתר אינו שייך ללקוח שנבחר")


@router.get("/leads")
def list_leads(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    limit: int | None = Query(default=50),
    cursor: str | None = Query(default=None),
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    source: str | None = Query(default=None),
    customer_id: str | None = Query(default=None),
    site_id: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "leads.view")
    page_size = parse_limit(limit)
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": LEAD_SELECT,
        "order": "created_at.desc",
        "limit": str(page_size + 1),
    }
    if status:
        params["status"] = f"eq.{status}"
    if priority:
        params["priority"] = f"eq.{priority}"
    if source:
        params["source"] = f"eq.{source}"
    if customer_id:
        params["customer_id"] = f"eq.{customer_id}"
    if site_id:
        params["site_id"] = f"eq.{site_id}"
    if q:
        needle = q.strip()
        params["or"] = (
            f"(title.ilike.*{needle}*,contact_name.ilike.*{needle}*,phone.ilike.*{needle}*,"
            f"email.ilike.*{needle}*,address_text.ilike.*{needle}*)"
        )
    before = decode_cursor(cursor)
    if before:
        params["created_at"] = f"lt.{before}"
    rows = as_list(client.get("leads", params=params))
    page = page_from_rows(rows, page_size)
    return {"items": page.items, "next_cursor": page.next_cursor}


@router.post("/leads")
def create_lead(
    workspace_id: UUID,
    body: LeadCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "leads.create", resource=ResourceRef(type="lead"))
    _assert_lead_relations(client, workspace_id, customer_id=body.customer_id, site_id=body.site_id)
    payload = {
        "workspace_id": str(workspace_id),
        "owner_user_id": actor_id(user),
        **body.model_dump(exclude_none=True),
    }
    return created_or_403(client.post("leads", payload))


@router.get("/leads/{lead_id}")
def get_lead(
    workspace_id: UUID,
    lead_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "leads.view")
    return one_or_404(
        client.get(
            "leads",
            params={"id": f"eq.{lead_id}", "workspace_id": f"eq.{workspace_id}", "select": LEAD_SELECT},
        )
    )


@router.patch("/leads/{lead_id}")
def patch_lead(
    workspace_id: UUID,
    lead_id: UUID,
    body: LeadPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    existing = one_or_404(
        client.get(
            "leads",
            params={"id": f"eq.{lead_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )
    require(ctx, "leads.edit", resource=ResourceRef(type="lead", id=existing["id"]))
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    next_customer = patch.get("customer_id", None)
    next_site = patch.get("site_id", None)
    if next_customer is not None or next_site is not None:
        current = one_or_404(
            client.get(
                "leads",
                params={
                    "id": f"eq.{lead_id}",
                    "workspace_id": f"eq.{workspace_id}",
                    "select": "customer_id,site_id",
                },
            )
        )
        _assert_lead_relations(
            client,
            workspace_id,
            customer_id=next_customer if next_customer is not None else current.get("customer_id"),
            site_id=next_site if next_site is not None else current.get("site_id"),
        )
    return patched_or_403(
        client.patch("leads", patch, params={"id": f"eq.{lead_id}", "workspace_id": f"eq.{workspace_id}"})
    )


# ── Projects ─────────────────────────────────────────────────────────────────


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)
    customer_id: str
    site_id: str | None = None
    source_quote_id: str | None = None
    status: str = "draft"


class ProjectFromQuoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_quote_id: str = Field(min_length=1)
    site_id: str | None = None


class ProjectPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=200)
    status: str | None = None
    site_id: str | None = None
    assigned_to: str | None = None


PROJECT_SELECT = (
    "id,workspace_id,name,status,customer_id,site_id,source_quote_id,"
    "assigned_to,created_by,created_at,updated_at"
)
QUOTE_FOR_PROJECT_SELECT = (
    "id,workspace_id,number,status,customer_id,site_id,lead_id,title,project_name,deleted_at"
)


def _existing_project_for_quote(client: UserClient, workspace_id: UUID, quote_id: str) -> dict | None:
    rows = as_list(
        client.get(
            "projects",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "source_quote_id": f"eq.{quote_id}",
                "select": PROJECT_SELECT,
                "limit": "1",
            },
        )
    )
    return rows[0] if rows else None


def _load_quote_for_project(client: UserClient, workspace_id: UUID, quote_id: str) -> dict | None:
    rows = as_list(
        client.get(
            "quotes",
            params={
                "id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "deleted_at": "is.null",
                "select": QUOTE_FOR_PROJECT_SELECT,
                "limit": "1",
            },
        )
    )
    return rows[0] if rows else None


def _attach_quote_site_for_project(
    client: UserClient,
    workspace_id: UUID,
    quote: dict,
    site_id: str,
) -> dict:
    customer_id = quote.get("customer_id")
    if not customer_id:
        raise ApiError(
            409,
            "RESOURCE_STATE",
            "להצעת המחיר אין לקוח משויך, ולכן לא ניתן ליצור פרויקט.",
        )
    site = one_or_404(
        client.get(
            "sites",
            params={
                "id": f"eq.{site_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,customer_id",
            },
        )
    )
    if str(site.get("customer_id") or "") != str(customer_id):
        raise ApiError(400, "VALIDATION_ERROR", "האתר אינו שייך ללקוח של ההצעה.")
    patched_or_403(
        client.patch(
            "quotes",
            {"site_id": site_id},
            params={"id": f"eq.{quote['id']}", "workspace_id": f"eq.{workspace_id}"},
        )
    )
    return {**quote, "site_id": site_id}


@router.get("/projects")
def list_projects(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    limit: int | None = Query(default=50),
    cursor: str | None = Query(default=None),
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    customer_id: str | None = Query(default=None),
    source_quote_id: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "projects.view")
    empty = empty_assigned_page(ctx)
    if empty is not None:
        return empty
    page_size = parse_limit(limit)
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": PROJECT_SELECT,
        "order": "created_at.desc",
        "limit": str(page_size + 1),
    }
    if status:
        params["status"] = f"eq.{status}"
    if customer_id:
        params["customer_id"] = f"eq.{customer_id}"
    if source_quote_id:
        params["source_quote_id"] = f"eq.{source_quote_id}"
    if q:
        params["name"] = f"ilike.*{q}*"
    before = decode_cursor(cursor)
    if before:
        params["created_at"] = f"lt.{before}"
    apply_assigned_project_list_filter(ctx, params)
    rows = as_list(client.get("projects", params=params))
    page = page_from_rows(rows, page_size)
    return {"items": page.items, "next_cursor": page.next_cursor}


@router.post("/projects")
def create_project(
    workspace_id: UUID,
    body: ProjectCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "projects.create", resource=ResourceRef(type="project"))
    one_or_404(
        client.get(
            "customers",
            params={"id": f"eq.{body.customer_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )
    if body.site_id:
        one_or_404(
            client.get(
                "sites",
                params={"id": f"eq.{body.site_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
            )
        )
    if body.source_quote_id:
        quote = _load_quote_for_project(client, workspace_id, body.source_quote_id)
        plan = plan_project_from_quote(
            quote=quote,
            workspace_id=str(workspace_id),
            existing_project=_existing_project_for_quote(client, workspace_id, body.source_quote_id),
        )
        if plan.customer_id != body.customer_id:
            raise ApiError(400, "VALIDATION_ERROR", "הלקוח אינו תואם להצעת המחיר.")
        if body.site_id and plan.site_id and body.site_id != plan.site_id:
            raise ApiError(400, "VALIDATION_ERROR", "האתר אינו תואם להצעת המחיר.")
    payload = {
        "workspace_id": str(workspace_id),
        "created_by": actor_id(user),
        **body.model_dump(exclude_none=True),
    }
    return created_or_403(client.post("projects", payload))


@router.post("/projects/from-quote")
def create_project_from_quote(
    workspace_id: UUID,
    body: ProjectFromQuoteCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "projects.create", resource=ResourceRef(type="project"))
    quote = _load_quote_for_project(client, workspace_id, body.source_quote_id)
    existing = _existing_project_for_quote(client, workspace_id, body.source_quote_id)
    if quote and not quote.get("site_id") and body.site_id:
        quote = _attach_quote_site_for_project(client, workspace_id, quote, body.site_id)
    plan = plan_project_from_quote(
        quote=quote,
        workspace_id=str(workspace_id),
        existing_project=existing,
    )
    one_or_404(
        client.get(
            "customers",
            params={"id": f"eq.{plan.customer_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )
    if plan.site_id:
        one_or_404(
            client.get(
                "sites",
                params={"id": f"eq.{plan.site_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
            )
        )
    payload = {
        "workspace_id": str(workspace_id),
        "created_by": actor_id(user),
        "name": plan.name,
        "customer_id": plan.customer_id,
        "site_id": plan.site_id,
        "source_quote_id": plan.source_quote_id,
        "source_quote_version": plan.source_quote_version,
        "status": plan.status,
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    project = created_or_403(client.post("projects", payload))
    lead_id = quote.get("lead_id")
    if lead_id:
        try:
            client.patch(
                "leads",
                {"status": "won"},
                params={"id": f"eq.{lead_id}", "workspace_id": f"eq.{workspace_id}"},
            )
        except Exception:
            pass
    write_audit(
        client,
        str(workspace_id),
        "projects.create_from_quote",
        entity_type="project",
        entity_id=str(project.get("id") or ""),
        metadata={
            "source_quote_id": plan.source_quote_id,
            "source_quote_version": plan.source_quote_version,
            "lead_id": lead_id,
        },
    )
    return project


@router.get("/projects/{project_id}")
def get_project(
    workspace_id: UUID,
    project_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "projects.view")
    row = one_or_404(
        client.get(
            "projects",
            params={
                "id": f"eq.{project_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": PROJECT_SELECT,
            },
        )
    )
    require(ctx, "projects.view", resource=ResourceRef(type="project", id=str(row["id"])))
    return row


PLANNED_ITEM_SELECT = (
    "id,workspace_id,project_id,source_quote_id,source_quote_version,source_quote_item_id,"
    "section_id,section_name,item_type,scope_kind,product_id,sku,name,description,qty,unit,"
    "manufacturer,model,is_optional,sort_order"
)


def _load_project_planned_items(client: UserClient, workspace_id: UUID, project_id: UUID) -> list[dict]:
    return as_list(
        client.get(
            "project_planned_items",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "project_id": f"eq.{project_id}",
                "select": PLANNED_ITEM_SELECT,
                "order": "sort_order.asc",
            },
        )
    )


@router.get("/projects/{project_id}/planned-items")
def list_project_planned_items(
    workspace_id: UUID,
    project_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "projects.view")
    one_or_404(
        client.get(
            "projects",
            params={
                "id": f"eq.{project_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id",
            },
        )
    )
    require(ctx, "projects.view", resource=ResourceRef(type="project", id=str(project_id)))
    return {"items": _load_project_planned_items(client, workspace_id, project_id)}


@router.get("/projects/{project_id}/create-installed-assets/preview")
def preview_create_installed_assets(
    workspace_id: UUID,
    project_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "projects.view")
    project = one_or_404(
        client.get(
            "projects",
            params={
                "id": f"eq.{project_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": PROJECT_SELECT,
            },
        )
    )
    require(ctx, "projects.view", resource=ResourceRef(type="project", id=str(project_id)))
    site_id = str(project.get("site_id") or "")
    planned = _load_project_planned_items(client, workspace_id, project_id)
    counts = count_assets_by_planned_item(client, str(workspace_id), str(project_id))
    lines = build_create_plan(planned, counts)
    total = sum(int(line["remaining"]) for line in lines)
    return {
        "site_id": site_id or None,
        "eligible": total > 0 and bool(site_id),
        "fully_materialized": total == 0,
        "total_to_create": total,
        "lines": [
            {
                "planned_item_id": line["planned_item_id"],
                "label": line["label"],
                "qty": line["qty"],
                "existing": line["existing"],
                "remaining": line["remaining"],
                "category": line["category"],
            }
            for line in lines
        ],
        "message": "הציוד כבר נוצר" if total == 0 else f"ייווצרו {total} פריטי ציוד",
    }


@router.post("/projects/{project_id}/create-installed-assets")
def create_installed_assets(
    workspace_id: UUID,
    project_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "projects.view")
    project = one_or_404(
        client.get(
            "projects",
            params={
                "id": f"eq.{project_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": PROJECT_SELECT,
            },
        )
    )
    require(ctx, "projects.view", resource=ResourceRef(type="project", id=str(project_id)))
    site_id = str(project.get("site_id") or "")
    if not site_id:
        raise ApiError(400, "VALIDATION_ERROR", "לפרויקט אין אתר — לא ניתן ליצור ציוד מותקן")
    one_or_404(
        client.get(
            "sites",
            params={"id": f"eq.{site_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )
    require(ctx, "systems.edit", resource=ResourceRef(type="site", site_id=site_id))
    planned = _load_project_planned_items(client, workspace_id, project_id)
    result = create_installed_assets_from_plan(
        client,
        workspace_id=str(workspace_id),
        site_id=site_id,
        project_id=str(project_id),
        planned_items=planned,
    )
    write_audit(
        client,
        str(workspace_id),
        "equipment.create_from_plan",
        entity_type="project",
        entity_id=str(project_id),
        metadata={"created": result.get("created"), "site_id": site_id},
    )
    return result


@router.patch("/projects/{project_id}")
def patch_project(
    workspace_id: UUID,
    project_id: UUID,
    body: ProjectPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    existing = one_or_404(
        client.get(
            "projects",
            params={"id": f"eq.{project_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )
    require(ctx, "projects.edit", resource=ResourceRef(type="project", id=existing["id"]))
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    return patched_or_403(
        client.patch(
            "projects",
            patch,
            params={"id": f"eq.{project_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )


# ── Service calls ─────────────────────────────────────────────────────────────


class ServiceCallCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=200)
    customer_id: str
    site_id: str
    priority: str = "normal"
    description: str | None = None
    equipment_id: str | None = None


class ServiceCallPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, min_length=1, max_length=200)
    status: str | None = None
    priority: str | None = None
    description: str | None = None
    equipment_id: str | None = None


SERVICE_SELECT = (
    "id,workspace_id,number,status,priority,customer_id,site_id,system_id,equipment_id,"
    "title,description,created_by,created_at,updated_at"
)


def _assert_service_equipment(
    client: UserClient, workspace_id: UUID, equipment_id: str, site_id: str
) -> None:
    row = one_or_404(
        client.get(
            "equipment",
            params={
                "id": f"eq.{equipment_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,site_id",
            },
        )
    )
    if str(row.get("site_id") or "") != str(site_id):
        raise ApiError(400, "VALIDATION_ERROR", "הציוד אינו שייך לאתר של קריאת השירות")


def _enrich_service_rows(client: UserClient, workspace_id: UUID, rows: list[dict]) -> list[dict]:
    customer_ids = {str(r["customer_id"]) for r in rows if r.get("customer_id")}
    site_ids = {str(r["site_id"]) for r in rows if r.get("site_id")}
    names: dict[str, str] = {}
    if customer_ids:
        for row in as_list(
            client.get(
                "customers",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "id": f"in.({','.join(sorted(customer_ids))})",
                    "select": "id,display_name",
                },
            )
        ):
            names[str(row["id"])] = str(row.get("display_name") or "")
    if site_ids:
        for row in as_list(
            client.get(
                "sites",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "id": f"in.({','.join(sorted(site_ids))})",
                    "select": "id,name",
                },
            )
        ):
            names[str(row["id"])] = str(row.get("name") or "")
    out: list[dict] = []
    for row in rows:
        item = dict(row)
        cid = str(row["customer_id"]) if row.get("customer_id") else None
        sid = str(row["site_id"]) if row.get("site_id") else None
        item["customer_name"] = names.get(cid) if cid else None
        item["site_name"] = names.get(sid) if sid else None
        out.append(item)
    return out


@router.get("/service-calls")
def list_service_calls(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    limit: int | None = Query(default=50),
    cursor: str | None = Query(default=None),
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    equipment_id: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "service.view")
    empty = empty_assigned_page(ctx)
    if empty is not None:
        return empty
    page_size = parse_limit(limit)
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": SERVICE_SELECT,
        "order": "created_at.desc",
        "limit": str(page_size + 1),
    }
    if status:
        params["status"] = f"eq.{status}"
    if equipment_id:
        params["equipment_id"] = f"eq.{equipment_id}"
    if q:
        params["title"] = f"ilike.*{q}*"
    before = decode_cursor(cursor)
    if before:
        params["created_at"] = f"lt.{before}"
    apply_assigned_service_call_list_filter(ctx, params)
    rows = as_list(client.get("service_calls", params=params))
    page = page_from_rows(rows, page_size)
    return {"items": _enrich_service_rows(client, workspace_id, page.items), "next_cursor": page.next_cursor}


@router.post("/service-calls")
def create_service_call(
    workspace_id: UUID,
    body: ServiceCallCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "service.create", resource=ResourceRef(type="service_call", site_id=body.site_id))
    one_or_404(
        client.get(
            "sites",
            params={
                "id": f"eq.{body.site_id}",
                "workspace_id": f"eq.{workspace_id}",
                "customer_id": f"eq.{body.customer_id}",
                "select": "id",
            },
        )
    )
    if body.equipment_id:
        _assert_service_equipment(client, workspace_id, body.equipment_id, body.site_id)
    payload = {
        "workspace_id": str(workspace_id),
        "created_by": actor_id(user),
        **body.model_dump(exclude_none=True),
    }
    return created_or_403(client.post("service_calls", payload))


@router.patch("/service-calls/{call_id}")
def patch_service_call(
    workspace_id: UUID,
    call_id: UUID,
    body: ServiceCallPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    existing = one_or_404(
        client.get(
            "service_calls",
            params={
                "id": f"eq.{call_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,site_id",
            },
        )
    )
    require(
        ctx,
        "service.edit",
        resource=ResourceRef(type="service_call", id=existing["id"], site_id=existing.get("site_id")),
    )
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    if patch.get("equipment_id"):
        _assert_service_equipment(
            client, workspace_id, str(patch["equipment_id"]), str(existing.get("site_id") or "")
        )
    return patched_or_403(
        client.patch(
            "service_calls",
            patch,
            params={"id": f"eq.{call_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )


@router.get("/service-calls/{call_id}")
def get_service_call(
    workspace_id: UUID,
    call_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "service.view")
    row = one_or_404(
        client.get(
            "service_calls",
            params={
                "id": f"eq.{call_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": SERVICE_SELECT,
            },
        )
    )
    require(
        ctx,
        "service.view",
        resource=ResourceRef(type="service_call", id=row["id"], site_id=row.get("site_id")),
    )
    linked = as_list(
        client.get(
            "jobs",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "service_call_id": f"eq.{call_id}",
                "select": "id,number,title,status,scheduled_for,priority,created_at",
                "order": "created_at.desc",
                "limit": "20",
            },
        )
    )
    enriched = _enrich_service_rows(client, workspace_id, [row])[0]
    return {**enriched, "linked_jobs": linked}


class ServiceCallCreateJob(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scheduled_for: str | None = None
    scheduled_end: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)


@router.post("/service-calls/{call_id}/create-job")
def create_job_from_service_call(
    workspace_id: UUID,
    call_id: UUID,
    body: ServiceCallCreateJob,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    from ..site_timeline import write_site_timeline

    ctx = _ctx(client, user, workspace_id)
    call = one_or_404(
        client.get(
            "service_calls",
            params={
                "id": f"eq.{call_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": SERVICE_SELECT,
            },
        )
    )
    require(
        ctx,
        "jobs.create",
        resource=ResourceRef(type="job", site_id=call.get("site_id")),
    )
    title = (body.title or call.get("title") or "עבודת שירות").strip()
    payload = {
        "workspace_id": str(workspace_id),
        "created_by": actor_id(user),
        "title": title,
        "kind": "service",
        "customer_id": call["customer_id"],
        "site_id": call["site_id"],
        "service_call_id": str(call_id),
        "priority": call.get("priority") or "normal",
    }
    if body.scheduled_for:
        payload["scheduled_for"] = body.scheduled_for
    if body.scheduled_end:
        payload["scheduled_end"] = body.scheduled_end
    job = created_or_403(client.post("jobs", payload))
    # Default service checklist
    for index, label in enumerate(
        ("אבחון תקלה", "תיקון / טיפול", "בדיקת תקינות", "תיעוד צילום", "עדכון לקוח")
    ):
        try:
            client.post(
                "job_checklist_items",
                {
                    "workspace_id": str(workspace_id),
                    "job_id": job["id"],
                    "label_he": label,
                    "required": True,
                    "sort_order": index,
                },
            )
        except Exception:
            break
    if call.get("status") == "open":
        try:
            client.patch(
                "service_calls",
                {"status": "in_progress"},
                params={"id": f"eq.{call_id}", "workspace_id": f"eq.{workspace_id}"},
            )
        except Exception:
            pass
    write_audit(
        client,
        str(workspace_id),
        "service_calls.create_job",
        entity_type="service_call",
        entity_id=str(call_id),
        metadata={"job_id": job["id"], "job_number": job.get("number")},
    )
    write_site_timeline(
        client,
        workspace_id=str(workspace_id),
        site_id=call.get("site_id"),
        event_type="service",
        title=f"{call.get('number') or 'קריאת שירות'} → עבודה {job.get('number') or ''}".strip(),
        body=title,
        actor_id=actor_id(user),
        source_type="job",
        source_id=job["id"],
    )
    return job


# ── Warranties ────────────────────────────────────────────────────────────────


WARRANTY_TYPES = frozenset({"manufacturer", "installation", "extended", "maintenance_contract"})
WARRANTY_STATUSES = frozenset({"draft", "active", "expiring_soon", "expired", "cancelled"})

WARRANTY_SELECT = (
    "id,workspace_id,number,title,type,status,customer_id,site_id,installed_equipment_id,"
    "starts_on,ends_on,policy,document_id,created_at,updated_at"
)


class WarrantyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    customer_id: str
    site_id: str | None = None
    type: str = "installation"
    starts_on: str
    ends_on: str
    equipment_id: str | None = None
    title: str | None = None
    status: str | None = None
    policy: dict | None = None


class WarrantyPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: str | None = None
    starts_on: str | None = None
    ends_on: str | None = None
    type: str | None = None
    equipment_id: str | None = None
    title: str | None = None
    policy: dict | None = None


def _validate_warranty_fields(*, type: str | None = None, status: str | None = None) -> None:
    if type is not None and type not in WARRANTY_TYPES:
        raise ApiError(400, "VALIDATION_ERROR", "סוג אחריות אינו תקין")
    if status is not None and status not in WARRANTY_STATUSES:
        raise ApiError(400, "VALIDATION_ERROR", "סטטוס אחריות אינו תקין")


def _validate_warranty_dates(starts_on: str | None, ends_on: str | None) -> None:
    if starts_on and ends_on and ends_on < starts_on:
        raise ApiError(400, "VALIDATION_ERROR", "תאריך הסיום חייב להיות אחרי תאריך ההתחלה")


def _assert_warranty_site(
    client: UserClient,
    workspace_id: UUID,
    *,
    customer_id: str,
    site_id: str,
) -> None:
    one_or_404(
        client.get(
            "sites",
            params={
                "id": f"eq.{site_id}",
                "workspace_id": f"eq.{workspace_id}",
                "customer_id": f"eq.{customer_id}",
                "select": "id",
            },
        )
    )


def _assert_warranty_equipment(
    client: UserClient,
    workspace_id: UUID,
    equipment_id: str,
    site_id: str | None,
) -> None:
    equipment = one_or_404(
        client.get(
            "equipment",
            params={
                "id": f"eq.{equipment_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,site_id",
            },
        )
    )
    if site_id and str(equipment.get("site_id") or "") != site_id:
        raise ApiError(400, "VALIDATION_ERROR", "הציוד אינו שייך לאתר שנבחר")


def _index_by_id(rows: list[dict]) -> dict[str, dict]:
    return {str(row["id"]): row for row in rows if row.get("id")}


def _enrich_warranty_row(
    row: dict,
    customers: dict[str, dict],
    sites: dict[str, dict],
    equipment: dict[str, dict],
) -> dict:
    out = dict(row)
    equipment_id = out.pop("installed_equipment_id", None)
    out["equipment_id"] = equipment_id
    customer = customers.get(str(out.get("customer_id") or ""))
    site = sites.get(str(out.get("site_id") or ""))
    item = equipment.get(str(equipment_id or ""))
    out["customer_name"] = customer.get("display_name") if customer else None
    out["site_name"] = site.get("name") if site else None
    out["equipment_name"] = item.get("name") if item else None
    out["equipment_manufacturer"] = item.get("manufacturer") if item else None
    out["equipment_model"] = item.get("model") if item else None
    out["equipment_serial"] = item.get("serial") if item else None
    return out


def _enrich_warranties(client: UserClient, workspace_id: UUID, rows: list[dict]) -> list[dict]:
    if not rows:
        return []
    customer_ids = sorted({str(row["customer_id"]) for row in rows if row.get("customer_id")})
    site_ids = sorted({str(row["site_id"]) for row in rows if row.get("site_id")})
    equipment_ids = sorted(
        {str(row["installed_equipment_id"]) for row in rows if row.get("installed_equipment_id")}
    )
    customers: dict[str, dict] = {}
    sites: dict[str, dict] = {}
    equipment: dict[str, dict] = {}
    if customer_ids:
        customers = _index_by_id(
            as_list(
                client.get(
                    "customers",
                    params={
                        "id": f"in.({','.join(customer_ids)})",
                        "workspace_id": f"eq.{workspace_id}",
                        "select": "id,display_name",
                    },
                )
            )
        )
    if site_ids:
        sites = _index_by_id(
            as_list(
                client.get(
                    "sites",
                    params={
                        "id": f"in.({','.join(site_ids)})",
                        "workspace_id": f"eq.{workspace_id}",
                        "select": "id,name",
                    },
                )
            )
        )
    if equipment_ids:
        equipment = _index_by_id(
            as_list(
                client.get(
                    "equipment",
                    params={
                        "id": f"in.({','.join(equipment_ids)})",
                        "workspace_id": f"eq.{workspace_id}",
                        "select": "id,name,manufacturer,model,serial",
                    },
                )
            )
        )
    return [_enrich_warranty_row(row, customers, sites, equipment) for row in rows]


def _warranty_payload(body: WarrantyCreate, workspace_id: UUID) -> dict:
    payload = {"workspace_id": str(workspace_id), **body.model_dump(exclude_none=True)}
    equipment_id = payload.pop("equipment_id", None)
    if equipment_id:
        payload["installed_equipment_id"] = equipment_id
    return payload


@router.get("/warranties")
def list_warranties(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    limit: int | None = Query(default=50),
    cursor: str | None = Query(default=None),
    status: str | None = Query(default=None),
    site_id: str | None = Query(default=None),
    customer_id: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "warranties.view")
    page_size = parse_limit(limit)
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": WARRANTY_SELECT,
        "order": "ends_on.asc",
        "limit": str(page_size + 1),
    }
    if status:
        params["status"] = f"eq.{status}"
    if site_id:
        params["site_id"] = f"eq.{site_id}"
    if customer_id:
        params["customer_id"] = f"eq.{customer_id}"
    before = decode_cursor(cursor)
    if before:
        params["created_at"] = f"lt.{before}"
    rows = as_list(client.get("warranties", params=params))
    page = page_from_rows(rows, page_size)
    return {"items": _enrich_warranties(client, workspace_id, page.items), "next_cursor": page.next_cursor}


@router.post("/warranties")
def create_warranty(
    workspace_id: UUID,
    body: WarrantyCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "warranties.issue", resource=ResourceRef(type="warranty", site_id=body.site_id))
    _validate_warranty_fields(type=body.type, status=body.status)
    _validate_warranty_dates(body.starts_on, body.ends_on)
    one_or_404(
        client.get(
            "customers",
            params={
                "id": f"eq.{body.customer_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id",
            },
        )
    )
    if body.site_id:
        _assert_warranty_site(
            client, workspace_id, customer_id=body.customer_id, site_id=body.site_id
        )
    if body.equipment_id:
        _assert_warranty_equipment(client, workspace_id, body.equipment_id, body.site_id)
    created = created_or_403(client.post("warranties", _warranty_payload(body, workspace_id)))
    return _enrich_warranties(client, workspace_id, [created])[0]


@router.get("/warranties/{warranty_id}")
def get_warranty(
    workspace_id: UUID,
    warranty_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "warranties.view")
    row = one_or_404(
        client.get(
            "warranties",
            params={
                "id": f"eq.{warranty_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": WARRANTY_SELECT,
            },
        )
    )
    return _enrich_warranties(client, workspace_id, [row])[0]


@router.patch("/warranties/{warranty_id}")
def patch_warranty(
    workspace_id: UUID,
    warranty_id: UUID,
    body: WarrantyPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    existing = one_or_404(
        client.get(
            "warranties",
            params={
                "id": f"eq.{warranty_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": WARRANTY_SELECT,
            },
        )
    )
    require(
        ctx,
        "warranties.issue",
        resource=ResourceRef(type="warranty", id=str(existing.get("id")), site_id=existing.get("site_id")),
    )
    patch = body.model_dump(exclude_unset=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    _validate_warranty_fields(type=patch.get("type"), status=patch.get("status"))
    _validate_warranty_dates(
        patch.get("starts_on", existing.get("starts_on")),
        patch.get("ends_on", existing.get("ends_on")),
    )
    if "equipment_id" in patch:
        equipment_id = patch.pop("equipment_id")
        if equipment_id:
            _assert_warranty_equipment(
                client, workspace_id, equipment_id, existing.get("site_id")
            )
            patch["installed_equipment_id"] = equipment_id
        else:
            patch["installed_equipment_id"] = None
    updated = patched_or_403(
        client.patch(
            "warranties",
            patch,
            params={"id": f"eq.{warranty_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )
    return _enrich_warranties(client, workspace_id, [updated])[0]


# ── Tasks (calendar) ──────────────────────────────────────────────────────────


class TaskCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=200)
    type: str = "other"
    due_at: str | None = None
    assignee_id: str | None = None
    customer_id: str | None = None
    site_id: str | None = None
    lead_id: str | None = None
    notes: str | None = None
    time_window: str | None = None
    visit_status: str | None = None


class TaskPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, min_length=1, max_length=200)
    status: str | None = None
    due_at: str | None = None
    assignee_id: str | None = None
    notes: str | None = None
    time_window: str | None = None
    visit_status: str | None = None


TASK_SELECT = (
    "id,workspace_id,type,status,title,due_at,assignee_id,customer_id,site_id,"
    "lead_id,quote_id,job_id,notes,time_window,visit_status,created_by,created_at,updated_at"
)


@router.get("/tasks")
def list_tasks(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    limit: int | None = Query(default=50),
    cursor: str | None = Query(default=None),
    status: str | None = Query(default=None),
    type: str | None = Query(default=None),
    lead_id: str | None = Query(default=None),
    q: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "calendar.view")
    page_size = parse_limit(limit)
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": TASK_SELECT,
        "order": "created_at.desc",
        "limit": str(page_size + 1),
    }
    if status:
        params["status"] = f"eq.{status}"
    if type:
        params["type"] = f"eq.{type}"
    if lead_id:
        params["lead_id"] = f"eq.{lead_id}"
    safe_q = sanitize_search_q(q)
    if safe_q:
        params["title"] = f"ilike.*{safe_q}*"
    before = decode_cursor(cursor)
    if before:
        params["created_at"] = f"lt.{before}"
    apply_assigned_task_list_filter(ctx, params)
    rows = as_list(client.get("tasks", params=params))
    page = page_from_rows(rows, page_size)
    return {"items": page.items, "next_cursor": page.next_cursor}


@router.get("/tasks/export")
def export_tasks_csv(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    status: str | None = Query(default=None),
    type: str | None = Query(default=None),
    lead_id: str | None = Query(default=None),
    q: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "calendar.export")
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        # Export never includes customer/site columns — assigned technicians
        # must not receive names or ids they cannot see on the list page.
        "select": "id,workspace_id,type,status,title,due_at,assignee_id,created_at",
        "order": "created_at.desc",
    }
    if status:
        params["status"] = f"eq.{status}"
    if type:
        params["type"] = f"eq.{type}"
    if lead_id:
        params["lead_id"] = f"eq.{lead_id}"
    safe_q = sanitize_search_q(q)
    if safe_q:
        params["title"] = f"ilike.*{safe_q}*"
    apply_assigned_task_list_filter(ctx, params)
    collected: list[dict] = []
    cursor: str | None = None
    truncated = False
    while len(collected) < EXPORT_MAX:
        page_params = dict(params)
        page_params["limit"] = str(EXPORT_PAGE + 1)
        if cursor:
            page_params["created_at"] = f"lt.{cursor}"
        rows = as_list(client.get("tasks", params=page_params))
        page = page_from_rows(rows, EXPORT_PAGE)
        collected.extend(page.items)
        if not page.next_cursor:
            break
        if len(collected) >= EXPORT_MAX:
            truncated = True
            break
        cursor = page.next_cursor
    headers = ["כותרת", "סטטוס", "סוג", "אחראי", "יעד", "נוצר"]
    csv_rows = [
        [
            row.get("title"),
            TASK_STATUS_HE.get(str(row.get("status") or ""), row.get("status")),
            row.get("type"),
            row.get("assignee_id"),
            row.get("due_at"),
            row.get("created_at"),
        ]
        for row in collected
    ]
    write_audit(
        client,
        str(workspace_id),
        "tasks.export",
        entity_type="task",
        metadata={"row_count": len(csv_rows), "truncated": truncated, "max_rows": EXPORT_MAX},
    )
    return csv_response(
        build_csv(headers, csv_rows),
        "משימות.csv",
        row_count=len(csv_rows),
        truncated=truncated,
    )


@router.post("/tasks")
def create_task(
    workspace_id: UUID,
    body: TaskCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    svc: Annotated[ServiceClient | None, Depends(service_client)] = None,
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "calendar.edit")
    actor = actor_id(user)
    payload = {
        "workspace_id": str(workspace_id),
        "created_by": actor,
        **body.model_dump(exclude_none=True),
    }
    if not payload.get("assignee_id"):
        payload["assignee_id"] = actor
    row = created_or_403(client.post("tasks", payload))
    if svc is not None:
        try_notify(notify_task_assigned, svc, row, workspace_id=str(workspace_id), actor_user_id=actor)
    return row


@router.patch("/tasks/{task_id}")
def patch_task(
    workspace_id: UUID,
    task_id: UUID,
    body: TaskPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    svc: Annotated[ServiceClient | None, Depends(service_client)] = None,
):
    ctx = _ctx(client, user, workspace_id)
    existing = one_or_404(
        client.get(
            "tasks",
            params={"id": f"eq.{task_id}", "workspace_id": f"eq.{workspace_id}", "select": TASK_SELECT},
        )
    )
    require(ctx, "calendar.edit")
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    row = patched_or_403(
        client.patch(
            "tasks",
            patch,
            params={"id": f"eq.{task_id}", "workspace_id": f"eq.{workspace_id}", "select": TASK_SELECT},
        )
    )
    new_assignee = str(row.get("assignee_id") or "")
    old_assignee = str(existing.get("assignee_id") or "")
    if svc is not None and new_assignee and new_assignee != old_assignee:
        try_notify(
            notify_task_assigned, svc, row, workspace_id=str(workspace_id), actor_user_id=actor_id(user)
        )
    return row


@router.delete("/tasks/{task_id}")
def delete_task(
    workspace_id: UUID,
    task_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = one_or_404(
        client.get(
            "tasks",
            params={
                "id": f"eq.{task_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,title,assignee_id",
            },
        )
    )
    require(ctx, "calendar.edit")
    if is_assigned_scope(ctx) and str(existing.get("assignee_id") or "") != ctx.user_id:
        raise ApiError(403, "PERMISSION_DENIED", "טכנאי יכול למחוק רק משימות שמשויכות אליו")
    acked_or_403(
        client.delete(
            "tasks",
            params={"id": f"eq.{task_id}", "workspace_id": f"eq.{workspace_id}"},
            prefer="return=minimal",
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "tasks.deleted",
        entity_type="task",
        entity_id=str(task_id),
        metadata={"title": existing.get("title")},
    )
    return {"ok": True}


# ── Knowledge ─────────────────────────────────────────────────────────────────


class KnowledgeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1)
    category: str = "general"


class KnowledgePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = None
    category: str | None = None


KNOWLEDGE_SELECT = "id,workspace_id,category,title,body,created_at,updated_at"


@router.get("/knowledge")
def list_knowledge(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    limit: int | None = Query(default=50),
    cursor: str | None = Query(default=None),
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "knowledge.view")
    page_size = parse_limit(limit)
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": KNOWLEDGE_SELECT,
        "order": "updated_at.desc",
        "limit": str(page_size + 1),
    }
    if category:
        params["category"] = f"eq.{category}"
    if q:
        params["title"] = f"ilike.*{q}*"
    before = decode_cursor(cursor)
    if before:
        params["updated_at"] = f"lt.{before}"
    rows = as_list(client.get("knowledge_articles", params=params))
    page = page_from_rows(rows, page_size)
    return {"items": page.items, "next_cursor": page.next_cursor}


@router.post("/knowledge")
def create_knowledge(
    workspace_id: UUID,
    body: KnowledgeCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "knowledge.edit")
    payload = {"workspace_id": str(workspace_id), **body.model_dump()}
    return created_or_403(client.post("knowledge_articles", payload))


@router.patch("/knowledge/{article_id}")
def patch_knowledge(
    workspace_id: UUID,
    article_id: UUID,
    body: KnowledgePatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    one_or_404(
        client.get(
            "knowledge_articles",
            params={"id": f"eq.{article_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )
    require(ctx, "knowledge.edit")
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    return patched_or_403(
        client.patch(
            "knowledge_articles",
            patch,
            params={"id": f"eq.{article_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )
