from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..audit import write_audit
from ..authz.guard import require
from ..authz.types import ResourceRef
from ..deps import UserClient, current_user, load_authz_context, user_client
from ..errors import ApiError
from ..identity import actor_id
from ..pagination import decode_cursor, page_from_rows, parse_limit
from ..project_from_quote import plan_project_from_quote
from ..rest import as_list, created_or_403, one_or_404, patched_or_403

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
        metadata={"source_quote_id": plan.source_quote_id, "lead_id": lead_id},
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
    return one_or_404(
        client.get(
            "projects",
            params={
                "id": f"eq.{project_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": PROJECT_SELECT,
            },
        )
    )


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


class ServiceCallPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, min_length=1, max_length=200)
    status: str | None = None
    priority: str | None = None
    description: str | None = None


SERVICE_SELECT = (
    "id,workspace_id,status,priority,customer_id,site_id,system_id,"
    "title,description,created_by,created_at,updated_at"
)


@router.get("/service-calls")
def list_service_calls(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    limit: int | None = Query(default=50),
    cursor: str | None = Query(default=None),
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "service.view")
    page_size = parse_limit(limit)
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": SERVICE_SELECT,
        "order": "created_at.desc",
        "limit": str(page_size + 1),
    }
    if status:
        params["status"] = f"eq.{status}"
    if q:
        params["title"] = f"ilike.*{q}*"
    before = decode_cursor(cursor)
    if before:
        params["created_at"] = f"lt.{before}"
    rows = as_list(client.get("service_calls", params=params))
    page = page_from_rows(rows, page_size)
    return {"items": page.items, "next_cursor": page.next_cursor}


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
    return patched_or_403(
        client.patch(
            "service_calls",
            patch,
            params={"id": f"eq.{call_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )


# ── Warranties ────────────────────────────────────────────────────────────────


class WarrantyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    customer_id: str
    site_id: str
    type: str = "installation"
    starts_on: str
    ends_on: str


WARRANTY_SELECT = (
    "id,workspace_id,number,type,status,customer_id,site_id,starts_on,ends_on,"
    "document_id,created_at,updated_at"
)


@router.get("/warranties")
def list_warranties(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    limit: int | None = Query(default=50),
    cursor: str | None = Query(default=None),
    status: str | None = Query(default=None),
    site_id: str | None = Query(default=None),
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
    before = decode_cursor(cursor)
    if before:
        params["created_at"] = f"lt.{before}"
    rows = as_list(client.get("warranties", params=params))
    page = page_from_rows(rows, page_size)
    return {"items": page.items, "next_cursor": page.next_cursor}


@router.post("/warranties")
def create_warranty(
    workspace_id: UUID,
    body: WarrantyCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "warranties.issue", resource=ResourceRef(type="warranty", site_id=body.site_id))
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
    payload = {"workspace_id": str(workspace_id), **body.model_dump()}
    return created_or_403(client.post("warranties", payload))


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
    before = decode_cursor(cursor)
    if before:
        params["created_at"] = f"lt.{before}"
    rows = as_list(client.get("tasks", params=params))
    page = page_from_rows(rows, page_size)
    return {"items": page.items, "next_cursor": page.next_cursor}


@router.post("/tasks")
def create_task(
    workspace_id: UUID,
    body: TaskCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "calendar.edit")
    payload = {
        "workspace_id": str(workspace_id),
        "created_by": actor_id(user),
        **body.model_dump(exclude_none=True),
    }
    return created_or_403(client.post("tasks", payload))


@router.patch("/tasks/{task_id}")
def patch_task(
    workspace_id: UUID,
    task_id: UUID,
    body: TaskPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    one_or_404(
        client.get(
            "tasks",
            params={"id": f"eq.{task_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )
    require(ctx, "calendar.edit")
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    return patched_or_403(
        client.patch("tasks", patch, params={"id": f"eq.{task_id}", "workspace_id": f"eq.{workspace_id}"})
    )


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
