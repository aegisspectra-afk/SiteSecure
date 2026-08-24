from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..authz.guard import require
from ..authz.types import ResourceRef
from ..deps import UserClient, current_user, load_authz_context, user_client
from ..errors import ApiError
from ..identity import actor_id
from ..pagination import decode_cursor, page_from_rows, parse_limit
from ..rest import as_list, created_or_403, one_or_404, patched_or_403

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["jobs"])

JOB_SELECT = (
    "id,workspace_id,number,title,kind,status,project_id,service_call_id,"
    "customer_id,site_id,scheduled_for,started_at,completed_at,completion_notes,"
    "created_at,updated_at"
)


class JobCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=200)
    customer_id: str
    site_id: str
    kind: str = "service"
    scheduled_for: str | None = None
    project_id: str | None = None


class JobPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, min_length=1, max_length=200)
    kind: str | None = None
    scheduled_for: str | None = None


class JobComplete(BaseModel):
    model_config = ConfigDict(extra="forbid")
    completion_notes: str | None = None


class JobAssign(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: str


class ChecklistItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label_he: str = Field(min_length=1, max_length=300)
    required: bool = False


class ChecklistItemPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    completed: bool


class JobOut(BaseModel):
    id: str
    workspace_id: str
    number: str
    title: str
    kind: str
    status: str
    project_id: str | None = None
    service_call_id: str | None = None
    customer_id: str
    site_id: str
    scheduled_for: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
    completion_notes: str | None = None
    created_at: str
    updated_at: str


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


def _out(row: dict) -> JobOut:
    return JobOut(
        id=row["id"],
        workspace_id=row["workspace_id"],
        number=row["number"],
        title=row["title"],
        kind=row["kind"],
        status=row["status"],
        project_id=row.get("project_id"),
        service_call_id=row.get("service_call_id"),
        customer_id=row["customer_id"],
        site_id=row["site_id"],
        scheduled_for=row.get("scheduled_for"),
        started_at=row.get("started_at"),
        completed_at=row.get("completed_at"),
        completion_notes=row.get("completion_notes"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _ref(row: dict) -> ResourceRef:
    return ResourceRef(
        type="job",
        id=row["id"],
        site_id=row.get("site_id"),
        state=row.get("status"),
    )


def _load_job(client: UserClient, workspace_id: UUID, job_id: UUID) -> dict:
    return one_or_404(
        client.get(
            "jobs",
            params={"id": f"eq.{job_id}", "workspace_id": f"eq.{workspace_id}", "select": JOB_SELECT},
        )
    )


@router.get("/jobs")
def list_jobs(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    limit: int | None = Query(default=50),
    cursor: str | None = Query(default=None),
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    site_id: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "jobs.view")
    page_size = parse_limit(limit)
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": JOB_SELECT,
        "order": "created_at.desc",
        "limit": str(page_size + 1),
    }
    if status:
        params["status"] = f"eq.{status}"
    if site_id:
        params["site_id"] = f"eq.{site_id}"
    if q:
        params["title"] = f"ilike.*{q}*"
    before = decode_cursor(cursor)
    if before:
        params["created_at"] = f"lt.{before}"
    rows = as_list(client.get("jobs", params=params))
    page = page_from_rows(rows, page_size)
    return {"items": [_out(row).model_dump() for row in page.items], "next_cursor": page.next_cursor}


INSTALLATION_CHECKLIST = (
    "תשתית",
    "ציוד",
    "התקנה",
    "חיבור",
    "בדיקות",
    "תמונות",
    "מסירה",
    "חתימה",
)


@router.post("/jobs", response_model=JobOut)
def create_job(
    workspace_id: UUID,
    body: JobCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> JobOut:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "jobs.create", resource=ResourceRef(type="job", site_id=body.site_id))
    one_or_404(
        client.get(
            "sites",
            params={"id": f"eq.{body.site_id}", "workspace_id": f"eq.{workspace_id}", "select": "id,customer_id"},
        )
    )
    payload = {
        "workspace_id": str(workspace_id),
        "created_by": actor_id(user),
        "title": body.title,
        "customer_id": body.customer_id,
        "site_id": body.site_id,
        "kind": body.kind,
    }
    if body.scheduled_for:
        payload["scheduled_for"] = body.scheduled_for
    if body.project_id:
        payload["project_id"] = body.project_id
    row = created_or_403(client.post("jobs", payload))
    if body.kind == "installation":
        for index, label in enumerate(INSTALLATION_CHECKLIST):
            try:
                client.post(
                    "job_checklist_items",
                    {
                        "workspace_id": str(workspace_id),
                        "job_id": row["id"],
                        "label_he": label,
                        "required": True,
                        "sort_order": index,
                    },
                )
            except Exception:
                break
    return _out(row)


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(
    workspace_id: UUID,
    job_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> JobOut:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "jobs.view")
    row = _load_job(client, workspace_id, job_id)
    require(ctx, "jobs.view", resource=_ref(row))
    return _out(row)


@router.patch("/jobs/{job_id}", response_model=JobOut)
def patch_job(
    workspace_id: UUID,
    job_id: UUID,
    body: JobPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> JobOut:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_job(client, workspace_id, job_id)
    require(ctx, "jobs.create", resource=_ref(existing))
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    row = patched_or_403(
        client.patch("jobs", patch, params={"id": f"eq.{job_id}", "workspace_id": f"eq.{workspace_id}"})
    )
    return _out(row)


@router.post("/jobs/{job_id}/start", response_model=JobOut)
def start_job(
    workspace_id: UUID,
    job_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> JobOut:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_job(client, workspace_id, job_id)
    require(ctx, "jobs.start", resource=_ref(existing))
    row = patched_or_403(
        client.patch(
            "jobs",
            {"status": "in_progress", "started_at": datetime.now(UTC).isoformat()},
            params={"id": f"eq.{job_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )
    return _out(row)


@router.post("/jobs/{job_id}/complete", response_model=JobOut)
def complete_job(
    workspace_id: UUID,
    job_id: UUID,
    body: JobComplete,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> JobOut:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_job(client, workspace_id, job_id)
    require(ctx, "jobs.complete", resource=_ref(existing))
    payload = {
        "status": "completed",
        "completed_at": datetime.now(UTC).isoformat(),
    }
    if body.completion_notes is not None:
        payload["completion_notes"] = body.completion_notes
    row = patched_or_403(
        client.patch("jobs", payload, params={"id": f"eq.{job_id}", "workspace_id": f"eq.{workspace_id}"})
    )
    return _out(row)


@router.post("/jobs/{job_id}/assign")
def assign_job(
    workspace_id: UUID,
    job_id: UUID,
    body: JobAssign,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_job(client, workspace_id, job_id)
    require(ctx, "jobs.assign", resource=_ref(existing))
    row = created_or_403(
        client.post(
            "assignments",
            {
                "workspace_id": str(workspace_id),
                "user_id": body.user_id,
                "resource_type": "job",
                "resource_id": str(job_id),
                "assigned_by": actor_id(user),
            },
        )
    )
    return {"id": row["id"], "user_id": row["user_id"], "resource_id": row["resource_id"]}


@router.get("/jobs/{job_id}/checklist")
def list_checklist(
    workspace_id: UUID,
    job_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> list[dict]:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_job(client, workspace_id, job_id)
    require(ctx, "jobs.view", resource=_ref(existing))
    return as_list(
        client.get(
            "job_checklist_items",
            params={
                "job_id": f"eq.{job_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,label_he,required,completed,completed_at,completed_by,sort_order",
                "order": "sort_order.asc",
            },
        )
    )


@router.post("/jobs/{job_id}/checklist")
def add_checklist_item(
    workspace_id: UUID,
    job_id: UUID,
    body: ChecklistItemCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_job(client, workspace_id, job_id)
    require(ctx, "jobs.start", resource=_ref(existing))
    return created_or_403(
        client.post(
            "job_checklist_items",
            {
                "workspace_id": str(workspace_id),
                "job_id": str(job_id),
                "label_he": body.label_he,
                "required": body.required,
            },
        )
    )


@router.patch("/jobs/{job_id}/checklist/{item_id}")
def patch_checklist_item(
    workspace_id: UUID,
    job_id: UUID,
    item_id: UUID,
    body: ChecklistItemPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_job(client, workspace_id, job_id)
    require(ctx, "jobs.complete" if body.completed else "jobs.start", resource=_ref(existing))
    patch: dict = {"completed": body.completed}
    if body.completed:
        patch["completed_at"] = datetime.now(UTC).isoformat()
        patch["completed_by"] = actor_id(user)
    else:
        patch["completed_at"] = None
        patch["completed_by"] = None
    return patched_or_403(
        client.patch(
            "job_checklist_items",
            patch,
            params={"id": f"eq.{item_id}", "job_id": f"eq.{job_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )
