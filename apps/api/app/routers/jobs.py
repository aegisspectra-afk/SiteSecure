from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query
from pydantic import BaseModel, ConfigDict, Field

from ..audit import write_audit
from ..authz.guard import require
from ..authz.scope import apply_assigned_job_list_filter, empty_assigned_page
from ..authz.types import ResourceRef
from ..deps import ServiceClient, UserClient, current_user, load_authz_context, service_client, user_client
from ..errors import ApiError
from ..identity import actor_id
from ..job_lifecycle import OPEN_JOB_STATUSES, assert_transition
from ..pagination import decode_cursor, page_from_rows, parse_limit
from ..rest import as_list, created_or_403, one_or_404, patched_or_403
from ..site_timeline import write_site_timeline

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["jobs"])

JOB_SELECT = (
    "id,workspace_id,number,title,kind,status,priority,project_id,service_call_id,"
    "customer_id,site_id,scheduled_for,scheduled_end,started_at,arrived_at,completed_at,"
    "completion_notes,created_by,created_at,updated_at,"
    "customer_signature_document_id,customer_signer_name,customer_signed_at,customer_signed_by"
)


class JobCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=200)
    customer_id: str
    site_id: str
    kind: str = "service"
    scheduled_for: str | None = None
    scheduled_end: str | None = None
    project_id: str | None = None
    service_call_id: str | None = None
    priority: str | None = None


class JobPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, min_length=1, max_length=200)
    kind: str | None = None
    scheduled_for: str | None = None
    scheduled_end: str | None = None
    priority: str | None = None


class JobComplete(BaseModel):
    model_config = ConfigDict(extra="forbid")
    completion_notes: str | None = None


class JobAssign(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: str
    # DEMO-3.1: "שבץ טכנאי" sets the visit time in the same step (optional).
    scheduled_for: str | None = None
    scheduled_end: str | None = None


MAX_JOB_DURATION_HOURS = 24
_IDEMPOTENCY_KEY = re.compile(r"^[A-Za-z0-9_-]{8,100}$")


def _idempotency_key(raw: str | None) -> str | None:
    """DEMO-3.3: optional client key for one create attempt (8-100 of A-Z a-z 0-9 _ -)."""
    if raw is None or raw == "":
        return None
    if not _IDEMPOTENCY_KEY.match(raw):
        raise ApiError(400, "VALIDATION_ERROR", "מפתח בקשה לא תקין", {"field": "Idempotency-Key"})
    return raw


def _job_by_idempotency_key(client: UserClient, workspace_id: UUID, key: str) -> dict | None:
    rows = as_list(
        client.get(
            "jobs",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "idempotency_key": f"eq.{key}",
                "select": JOB_SELECT,
                "limit": "1",
            },
        )
    )
    return rows[0] if rows else None


def _parse_ts(value: str, field: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        raise ApiError(400, "VALIDATION_ERROR", "מועד לא תקין", {"field": field}) from None
    if parsed.tzinfo is None:
        raise ApiError(400, "VALIDATION_ERROR", "מועד חייב לכלול אזור זמן", {"field": field})
    return parsed


def _schedule_patch(start: str | None, end: str | None, existing: dict | None = None) -> dict[str, str]:
    """DEMO-3.1: validated scheduled_for / scheduled_end (duration = end - start).

    An end needs a start (given now or already on the job); the end is after the start and
    within MAX_JOB_DURATION_HOURS. Returns only the fields that were sent.
    """
    out: dict[str, str] = {}
    start_dt = _parse_ts(start, "scheduled_for") if start else None
    end_dt = _parse_ts(end, "scheduled_end") if end else None
    if start_dt is None and end_dt is not None:
        current = (existing or {}).get("scheduled_for")
        if not current:
            raise ApiError(400, "VALIDATION_ERROR", "יש לקבוע שעת התחלה לפני שעת סיום", {"field": "scheduled_for"})
        start_dt = _parse_ts(str(current), "scheduled_for")
    if start_dt is not None and end_dt is not None:
        hours = (end_dt - start_dt).total_seconds() / 3600
        if hours <= 0:
            raise ApiError(400, "VALIDATION_ERROR", "שעת הסיום חייבת להיות אחרי שעת ההתחלה", {"field": "scheduled_end"})
        if hours > MAX_JOB_DURATION_HOURS:
            raise ApiError(400, "VALIDATION_ERROR", "משך עבודה עד 24 שעות", {"field": "scheduled_end"})
    if start:
        out["scheduled_for"] = start_dt.isoformat()  # type: ignore[union-attr]
    if end:
        out["scheduled_end"] = end_dt.isoformat()  # type: ignore[union-attr]
    return out


class ChecklistItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label_he: str = Field(min_length=1, max_length=300)
    required: bool = False


class ChecklistItemPatch(BaseModel):
    """DEMO-4.3: any of done / not applicable / notes / photo (who and when are set by the DB)."""

    model_config = ConfigDict(extra="forbid")
    completed: bool | None = None
    not_applicable: bool | None = None
    notes: str | None = Field(default=None, max_length=1000)
    photo_document_id: str | None = None


class JobAssigneeOut(BaseModel):
    user_id: str
    display_name: str | None = None
    assigned_at: str | None = None
    assigned_by: str | None = None
    assigned_by_name: str | None = None


class JobOut(BaseModel):
    id: str
    workspace_id: str
    number: str
    title: str
    kind: str
    status: str
    priority: str = "normal"
    project_id: str | None = None
    service_call_id: str | None = None
    customer_id: str
    site_id: str
    scheduled_for: str | None = None
    scheduled_end: str | None = None
    started_at: str | None = None
    arrived_at: str | None = None
    completed_at: str | None = None
    completion_notes: str | None = None
    created_by: str | None = None
    created_at: str
    updated_at: str
    assignees: list[JobAssigneeOut] = Field(default_factory=list)
    is_assigned: bool = False
    # DEMO-4.1: customer signature collected on site.
    customer_signature_document_id: str | None = None
    customer_signer_name: str | None = None
    customer_signed_at: str | None = None
    customer_signed_by: str | None = None


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


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


def _profile_names(client: UserClient, user_ids: set[str]) -> dict[str, str]:
    clean = [uid for uid in user_ids if uid]
    if not clean:
        return {}
    rows = as_list(
        client.get(
            "profiles",
            params={"id": f"in.({','.join(clean)})", "select": "id,full_name"},
        )
    )
    out: dict[str, str] = {}
    for row in rows:
        name = row.get("full_name")
        if name:
            out[str(row["id"])] = str(name)
    return out


def _job_assignees(client: UserClient, workspace_id: UUID, job_id: str) -> list[JobAssigneeOut]:
    rows = as_list(
        client.get(
            "assignments",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "resource_type": "eq.job",
                "resource_id": f"eq.{job_id}",
                "unassigned_at": "is.null",
                "select": "user_id,assigned_by,created_at",
                "order": "created_at.asc",
            },
        )
    )
    ids: set[str] = set()
    for row in rows:
        if row.get("user_id"):
            ids.add(str(row["user_id"]))
        if row.get("assigned_by"):
            ids.add(str(row["assigned_by"]))
    names = _profile_names(client, ids)
    return [
        JobAssigneeOut(
            user_id=str(row["user_id"]),
            display_name=names.get(str(row["user_id"])),
            assigned_at=row.get("created_at"),
            assigned_by=str(row["assigned_by"]) if row.get("assigned_by") else None,
            assigned_by_name=names.get(str(row["assigned_by"])) if row.get("assigned_by") else None,
        )
        for row in rows
        if row.get("user_id")
    ]


def _out(client: UserClient, workspace_id: UUID, row: dict, *, with_assignees: bool = True) -> JobOut:
    assignees: list[JobAssigneeOut] = []
    if with_assignees:
        assignees = _job_assignees(client, workspace_id, str(row["id"]))
    return JobOut(
        id=row["id"],
        workspace_id=row["workspace_id"],
        number=row["number"],
        title=row["title"],
        kind=row["kind"],
        status=row["status"],
        priority=row.get("priority") or "normal",
        project_id=row.get("project_id"),
        service_call_id=row.get("service_call_id"),
        customer_id=row["customer_id"],
        site_id=row["site_id"],
        scheduled_for=row.get("scheduled_for"),
        scheduled_end=row.get("scheduled_end"),
        started_at=row.get("started_at"),
        arrived_at=row.get("arrived_at"),
        completed_at=row.get("completed_at"),
        completion_notes=row.get("completion_notes"),
        created_by=row.get("created_by"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        assignees=assignees,
        is_assigned=bool(assignees),
        customer_signature_document_id=row.get("customer_signature_document_id"),
        customer_signer_name=row.get("customer_signer_name"),
        customer_signed_at=row.get("customer_signed_at"),
        customer_signed_by=row.get("customer_signed_by"),
    )


def _patch_status(
    client: UserClient,
    workspace_id: UUID,
    job_id: UUID,
    *,
    payload: dict[str, Any],
) -> dict:
    return patched_or_403(
        client.patch(
            "jobs",
            payload,
            params={"id": f"eq.{job_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )


def _timeline_job(
    client: UserClient,
    *,
    workspace_id: str,
    job: dict,
    actor: str | None,
    title: str,
    body: str | None = None,
) -> None:
    write_site_timeline(
        client,
        workspace_id=workspace_id,
        site_id=job.get("site_id"),
        event_type="job",
        title=title,
        body=body,
        actor_id=actor,
        source_type="job",
        source_id=str(job["id"]),
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
    service_call_id: str | None = Query(default=None),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "jobs.view")
    empty = empty_assigned_page(ctx)
    if empty is not None:
        return empty
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
    if service_call_id:
        params["service_call_id"] = f"eq.{service_call_id}"
    if q:
        params["title"] = f"ilike.*{q}*"
    before = decode_cursor(cursor)
    if before:
        params["created_at"] = f"lt.{before}"
    apply_assigned_job_list_filter(ctx, params)
    rows = as_list(client.get("jobs", params=params))
    page = page_from_rows(rows, page_size)
    # List stays light: skip per-row assignee enrichment for speed.
    return {
        "items": [_out(client, workspace_id, row, with_assignees=False).model_dump() for row in page.items],
        "next_cursor": page.next_cursor,
    }


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

CCTV_TEMPLATE_KEY = "cctv_installation_v1"

# DEMO-4.3: CCTV installation checklist. Copied into job_checklist_items when an installation
# job comes from a CCTV quote. required = must be done (or N/A where allowed) before the job
# is completed; photo_required = a photo of this job must be attached to complete the item.
CCTV_INSTALLATION_TEMPLATE: tuple[dict[str, Any], ...] = (
    {"key": "site_walkthrough", "label_he": "סיור באתר ואישור נקודות ההתקנה עם הלקוח",
     "help_he": "מיקום כל מצלמה, המקליט ונתיבי הכבילה מאושרים לפני קידוח.",
     "required": True, "photo_required": False, "allow_na": False},
    {"key": "cabling", "label_he": "פריסת כבילה ותשתית",
     "help_he": "צלמו את התוואי לפני סגירת תעלות / תקרה.",
     "required": True, "photo_required": True, "allow_na": False},
    {"key": "cameras_mounted", "label_he": "התקנת המצלמות במיקום הסופי",
     "help_he": "צילום אחד לפחות של מצלמה מותקנת.",
     "required": True, "photo_required": True, "allow_na": False},
    {"key": "recorder_installed", "label_he": "התקנת המקליט והכונן",
     "help_he": "צלמו את המקליט במקומו, כולל חיבורים.",
     "required": True, "photo_required": True, "allow_na": False},
    {"key": "poe_switch", "label_he": "חיבור מתג PoE ובדיקת הספק",
     "help_he": "לא רלוונטי כשהמקליט מזין את המצלמות ישירות.",
     "required": True, "photo_required": False, "allow_na": True},
    {"key": "power_ups", "label_he": "חיבור חשמל / UPS",
     "help_he": "לא רלוונטי כשאין UPS בהצעה.",
     "required": True, "photo_required": False, "allow_na": True},
    {"key": "recording_check", "label_he": "בדיקת הקלטה בכל הערוצים",
     "help_he": "וידוא שכל מצלמה מקליטה ושמירת הימים מוגדרת.",
     "required": True, "photo_required": False, "allow_na": False},
    {"key": "image_quality", "label_he": "בדיקת זווית ואיכות תמונה (יום / לילה)",
     "help_he": "צילום מסך של תצוגת כל המצלמות.",
     "required": True, "photo_required": True, "allow_na": False},
    {"key": "remote_view", "label_he": "הגדרת צפייה מרחוק אצל הלקוח",
     "help_he": "לא רלוונטי כשהלקוח לא ביקש גישה מרחוק.",
     "required": True, "photo_required": False, "allow_na": True},
    {"key": "labeling", "label_he": "סימון כבלים וציוד",
     "help_he": None, "required": False, "photo_required": False, "allow_na": True},
    {"key": "customer_training", "label_he": "הדרכת לקוח ומסירת סיסמאות",
     "help_he": "שינוי סיסמת ברירת המחדל ומסירתה ללקוח בלבד.",
     "required": True, "photo_required": False, "allow_na": False},
    {"key": "cleanup", "label_he": "ניקיון האתר בסיום",
     "help_he": None, "required": True, "photo_required": False, "allow_na": False},
)


def _is_cctv_project(client: UserClient, workspace_id: UUID, project_id: str | None) -> bool:
    """A project whose source quote has CCTV lines (wizard package) or a CCTV system design."""
    if not project_id:
        return False
    rows = as_list(
        client.get(
            "projects",
            params={"id": f"eq.{project_id}", "workspace_id": f"eq.{workspace_id}", "select": "source_quote_id"},
        )
    )
    quote_id = rows[0].get("source_quote_id") if rows else None
    if not quote_id:
        return False
    lines = as_list(
        client.get(
            "quote_items",
            params={
                "quote_id": f"eq.{quote_id}",
                "workspace_id": f"eq.{workspace_id}",
                "package_name": "like.cctv-*",
                "select": "id",
                "limit": "1",
            },
        )
    )
    if lines:
        return True
    try:
        designs = as_list(
            client.get(
                "system_designs",
                params={"quote_id": f"eq.{quote_id}", "workspace_id": f"eq.{workspace_id}", "select": "id", "limit": "1"},
            )
        )
    except Exception:
        designs = []
    return bool(designs)


def _checklist_rows(workspace_id: UUID, job_id: str, kind: str, cctv: bool) -> list[dict[str, Any]]:
    if kind == "installation" and cctv:
        return [
            {
                "workspace_id": str(workspace_id),
                "job_id": job_id,
                "label_he": item["label_he"],
                "help_he": item["help_he"],
                "required": item["required"],
                "photo_required": item["photo_required"],
                "allow_na": item["allow_na"],
                "item_key": item["key"],
                "template_key": CCTV_TEMPLATE_KEY,
                "sort_order": index,
            }
            for index, item in enumerate(CCTV_INSTALLATION_TEMPLATE)
        ]
    labels = INSTALLATION_CHECKLIST if kind == "installation" else SERVICE_CHECKLIST if kind == "service" else ()
    return [
        {"workspace_id": str(workspace_id), "job_id": job_id, "label_he": label, "required": True, "sort_order": index}
        for index, label in enumerate(labels)
    ]


SERVICE_CHECKLIST = (
    "אבחון תקלה",
    "תיקון / טיפול",
    "בדיקת תקינות",
    "תיעוד צילום",
    "עדכון לקוח",
)


@router.post("/jobs", response_model=JobOut)
def create_job(
    workspace_id: UUID,
    body: JobCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> JobOut:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "jobs.create", resource=ResourceRef(type="job", site_id=body.site_id))
    key = _idempotency_key(idempotency_key)
    one_or_404(
        client.get(
            "sites",
            params={"id": f"eq.{body.site_id}", "workspace_id": f"eq.{workspace_id}", "select": "id,customer_id"},
        )
    )
    # DEMO-3.3: the same create attempt (double click, retry) returns the job it already made.
    if key:
        earlier = _job_by_idempotency_key(client, workspace_id, key)
        if earlier:
            return _out(client, workspace_id, earlier)
    payload: dict[str, Any] = {
        "workspace_id": str(workspace_id),
        "created_by": actor_id(user),
        "title": body.title,
        "customer_id": body.customer_id,
        "site_id": body.site_id,
        "kind": body.kind,
    }
    payload.update(_schedule_patch(body.scheduled_for, body.scheduled_end))
    if body.project_id:
        payload["project_id"] = body.project_id
    if body.service_call_id:
        payload["service_call_id"] = body.service_call_id
    if body.priority:
        payload["priority"] = body.priority
    if key:
        payload["idempotency_key"] = key
    res = client.post("jobs", payload)
    if key and res.status_code == 409:
        # A concurrent request with the same key won the unique index: return its job.
        earlier = _job_by_idempotency_key(client, workspace_id, key)
        if earlier:
            return _out(client, workspace_id, earlier)
    row = created_or_403(res)
    cctv = body.kind == "installation" and _is_cctv_project(client, workspace_id, body.project_id)
    checklist_rows = _checklist_rows(workspace_id, str(row["id"]), body.kind, cctv)
    if checklist_rows:
        try:
            client.post("job_checklist_items", checklist_rows)
        except Exception:
            pass
    actor = actor_id(user)
    write_audit(
        client,
        str(workspace_id),
        "jobs.create",
        entity_type="job",
        entity_id=row["id"],
        metadata={"number": row.get("number"), "service_call_id": body.service_call_id},
    )
    _timeline_job(
        client,
        workspace_id=str(workspace_id),
        job=row,
        actor=actor,
        title=f"נוצרה עבודה {row.get('number') or ''}".strip(),
        body=row.get("title"),
    )
    return _out(client, workspace_id, row)


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
    return _out(client, workspace_id, row)


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
    if existing.get("status") not in OPEN_JOB_STATUSES | {"scheduled"}:
        if existing.get("status") in {"completed", "cancelled"}:
            raise ApiError(400, "BUSINESS_RULE", "לא ניתן לערוך עבודה שהושלמה או בוטלה")
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    if "scheduled_for" in patch or "scheduled_end" in patch:
        patch.update(_schedule_patch(patch.get("scheduled_for"), patch.get("scheduled_end"), existing))
    row = patched_or_403(
        client.patch("jobs", patch, params={"id": f"eq.{job_id}", "workspace_id": f"eq.{workspace_id}"})
    )
    return _out(client, workspace_id, row)


@router.post("/jobs/{job_id}/en-route", response_model=JobOut)
def en_route_job(
    workspace_id: UUID,
    job_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> JobOut:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_job(client, workspace_id, job_id)
    require(ctx, "jobs.start", resource=_ref(existing))
    target = assert_transition("en_route", str(existing.get("status") or ""))
    row = _patch_status(client, workspace_id, job_id, payload={"status": target})
    actor = actor_id(user)
    write_audit(client, str(workspace_id), "jobs.en_route", entity_type="job", entity_id=str(job_id))
    _timeline_job(
        client,
        workspace_id=str(workspace_id),
        job=row,
        actor=actor,
        title=f"{row.get('number') or 'עבודה'} — יצא לדרך",
    )
    return _out(client, workspace_id, row)


@router.post("/jobs/{job_id}/arrived", response_model=JobOut)
def arrived_job(
    workspace_id: UUID,
    job_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> JobOut:
    ctx = _ctx(client, user, workspace_id)
    existing = _load_job(client, workspace_id, job_id)
    require(ctx, "jobs.start", resource=_ref(existing))
    target = assert_transition("arrived", str(existing.get("status") or ""))
    now = datetime.now(UTC).isoformat()
    row = _patch_status(
        client,
        workspace_id,
        job_id,
        payload={"status": target, "arrived_at": now},
    )
    actor = actor_id(user)
    write_audit(client, str(workspace_id), "jobs.arrived", entity_type="job", entity_id=str(job_id))
    _timeline_job(
        client,
        workspace_id=str(workspace_id),
        job=row,
        actor=actor,
        title=f"{row.get('number') or 'עבודה'} — הגיע לאתר",
    )
    return _out(client, workspace_id, row)


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
    target = assert_transition("start", str(existing.get("status") or ""))
    now = datetime.now(UTC).isoformat()
    payload: dict[str, Any] = {"status": target, "started_at": existing.get("started_at") or now}
    if not existing.get("arrived_at") and str(existing.get("status")) == "en_route":
        # Legacy path: start from en_route also stamps arrived_at.
        payload["arrived_at"] = now
    row = _patch_status(client, workspace_id, job_id, payload=payload)
    actor = actor_id(user)
    write_audit(client, str(workspace_id), "jobs.start", entity_type="job", entity_id=str(job_id))
    _timeline_job(
        client,
        workspace_id=str(workspace_id),
        job=row,
        actor=actor,
        title=f"{row.get('number') or 'עבודה'} — התחילה עבודה",
    )
    return _out(client, workspace_id, row)


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
    assert_transition("complete", str(existing.get("status") or ""))
    items = as_list(
        client.get(
            "job_checklist_items",
            params={
                "job_id": f"eq.{job_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,label_he,required,completed",
            },
        )
    )
    missing = [i for i in items if i.get("required") and not i.get("completed")]
    if missing:
        raise ApiError(
            400,
            "BUSINESS_RULE",
            "יש להשלים פריטי צ׳קליסט חובה לפני סיום",
            details={"missing": [m.get("label_he") for m in missing]},
        )
    payload: dict[str, Any] = {
        "status": "completed",
        "completed_at": datetime.now(UTC).isoformat(),
    }
    if body.completion_notes is not None:
        payload["completion_notes"] = body.completion_notes
    row = _patch_status(client, workspace_id, job_id, payload=payload)
    actor = actor_id(user)
    write_audit(
        client,
        str(workspace_id),
        "jobs.complete",
        entity_type="job",
        entity_id=str(job_id),
        metadata={"notes": bool(body.completion_notes)},
    )
    _timeline_job(
        client,
        workspace_id=str(workspace_id),
        job=row,
        actor=actor,
        title=f"{row.get('number') or 'עבודה'} — הושלמה",
        body=body.completion_notes,
    )
    # Keep assignments for history — do not delete.
    if existing.get("service_call_id"):
        try:
            client.patch(
                "service_calls",
                {"status": "closed"},
                params={
                    "id": f"eq.{existing['service_call_id']}",
                    "workspace_id": f"eq.{workspace_id}",
                },
            )
        except Exception:
            pass
    return _out(client, workspace_id, row)


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
    schedule = (
        _schedule_patch(body.scheduled_for, body.scheduled_end, existing)
        if body.scheduled_for or body.scheduled_end
        else {}
    )
    # Verify target is a workspace member.
    one_or_404(
        client.get(
            "workspace_memberships",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "user_id": f"eq.{body.user_id}",
                "select": "user_id,role_key",
                "limit": "1",
            },
        )
    )
    previous = _job_assignees(client, workspace_id, str(job_id))
    previous_ids = {a.user_id for a in previous}
    now = datetime.now(UTC).isoformat()
    actor = actor_id(user)
    # Close other active assignees — do not delete rows (operational history).
    for assignee in previous:
        if assignee.user_id == body.user_id:
            continue
        try:
            client.patch(
                "assignments",
                {"unassigned_at": now, "unassigned_by": actor},
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "resource_type": "eq.job",
                    "resource_id": f"eq.{job_id}",
                    "user_id": f"eq.{assignee.user_id}",
                    "unassigned_at": "is.null",
                },
            )
        except Exception:
            pass
    if body.user_id not in previous_ids:
        created_or_403(
            client.post(
                "assignments",
                {
                    "workspace_id": str(workspace_id),
                    "user_id": body.user_id,
                    "resource_type": "job",
                    "resource_id": str(job_id),
                    "assigned_by": actor,
                },
            )
        )
    names = _profile_names(client, {body.user_id, *previous_ids, actor})
    from_names = [a.display_name or a.user_id for a in previous if a.user_id != body.user_id]
    to_name = names.get(body.user_id, body.user_id)
    removed_others = bool(previous_ids - {body.user_id})
    action = "jobs.reassign" if removed_others else "jobs.assign"
    write_audit(
        client,
        str(workspace_id),
        action,
        entity_type="job",
        entity_id=str(job_id),
        metadata={
            "to_user_id": body.user_id,
            "to_name": to_name,
            "from_user_ids": sorted(previous_ids),
            "from_names": from_names,
            "assigned_by": actor,
        },
    )
    body_text = None
    if from_names:
        body_text = f"{', '.join(from_names)} → {to_name}"
    _timeline_job(
        client,
        workspace_id=str(workspace_id),
        job=existing,
        actor=actor,
        title=f"{existing.get('number') or 'עבודה'} — שויכה ל־{to_name}",
        body=body_text,
    )
    if schedule:
        patched_or_403(
            client.patch("jobs", schedule, params={"id": f"eq.{job_id}", "workspace_id": f"eq.{workspace_id}"})
        )
    assignees = _job_assignees(client, workspace_id, str(job_id))
    primary = next((a for a in assignees if a.user_id == body.user_id), None)
    return {
        "job_id": str(job_id),
        "user_id": body.user_id,
        "scheduled_for": schedule.get("scheduled_for", existing.get("scheduled_for")),
        "scheduled_end": schedule.get("scheduled_end", existing.get("scheduled_end")),
        "assigned_at": primary.assigned_at if primary else None,
        "assigned_by": primary.assigned_by if primary else actor,
        "assignees": [a.model_dump() for a in assignees],
        "reassigned": action == "jobs.reassign",
    }


class JobSignatureIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    signer_name: str = Field(min_length=1, max_length=120)
    signature_data_url: str = Field(min_length=20, max_length=350_000)


SIGNABLE_JOB_STATUSES = frozenset({"arrived", "in_progress"})


@router.post("/jobs/{job_id}/signature")
def sign_job(
    workspace_id: UUID,
    job_id: UUID,
    body: JobSignatureIn,
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
) -> dict:
    """DEMO-4.1: the customer signs on the technician's device (name + date + drawing).

    The image goes to the private signatures bucket under {workspace}/job/{job}/; the job keeps
    the signer, the time and who collected it. Only while the job is on site (arrived /
    in progress). The signature columns are server-only (trigger), so they are written with
    the service role after the checks below.
    """
    from ..quote_signature import store_signature_document

    ctx = _ctx(client, user, workspace_id)
    existing = _load_job(client, workspace_id, job_id)  # RLS: someone else's job is 404
    require(ctx, "jobs.start", resource=_ref(existing))
    signer = " ".join(body.signer_name.split())
    if not signer:
        raise ApiError(400, "VALIDATION_ERROR", "יש להזין את שם החותם", {"field": "signer_name"})
    if existing.get("status") not in SIGNABLE_JOB_STATUSES:
        raise ApiError(409, "BUSINESS_RULE", "אפשר להחתים לקוח רק כשהעבודה באתר או בתהליך")
    signed_at = datetime.now(UTC).isoformat()
    stored = store_signature_document(
        svc,
        workspace_id=str(workspace_id),
        entity_type="job",
        entity_id=str(job_id),
        file_stem="customer-signature",
        signed_at=signed_at,
        signature_data_url=body.signature_data_url,
        plan_key=ctx.plan_key,
    )
    actor = actor_id(user)
    patched_or_403(
        svc.patch(
            "jobs",
            {
                "customer_signature_document_id": stored["document_id"],
                "customer_signer_name": signer,
                "customer_signed_at": signed_at,
                "customer_signed_by": actor,
            },
            params={"id": f"eq.{job_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "jobs.customer_signature",
        entity_type="job",
        entity_id=str(job_id),
        metadata={"document_id": stored["document_id"], "signer_name": signer},
    )
    return {
        "job_id": str(job_id),
        "document_id": stored["document_id"],
        "signer_name": signer,
        "signed_at": signed_at,
        "signed_by": actor,
    }


CHECKLIST_SELECT = (
    "id,label_he,help_he,required,photo_required,allow_na,item_key,template_key,completed,"
    "not_applicable,notes,photo_document_id,completed_at,completed_by,sort_order"
)


def _with_marker_names(client: UserClient, rows: list[dict]) -> list[dict]:
    """Who marked each item: profile name, else email (visible to the workspace's members)."""
    ids = sorted({str(r.get("completed_by")) for r in rows if r.get("completed_by")})
    names: dict[str, str] = {}
    if ids:
        for prof in as_list(client.get("profiles", params={"id": f"in.({','.join(ids)})", "select": "id,full_name,email"})):
            label = (prof.get("full_name") or "").strip() or (prof.get("email") or "").strip()
            if label:
                names[str(prof["id"])] = label
    for r in rows:
        r["completed_by_name"] = names.get(str(r.get("completed_by"))) if r.get("completed_by") else None
    return rows


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
    return _with_marker_names(client, as_list(
        client.get(
            "job_checklist_items",
            params={
                "job_id": f"eq.{job_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": CHECKLIST_SELECT,
                "order": "sort_order.asc",
            },
        )
    ))


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
    require(ctx, "jobs.start", resource=_ref(existing))
    if existing.get("status") in {"completed", "cancelled"}:
        raise ApiError(409, "BUSINESS_RULE", "העבודה סגורה: הצ'קליסט נעול")
    item = one_or_404(
        client.get(
            "job_checklist_items",
            params={"id": f"eq.{item_id}", "job_id": f"eq.{job_id}", "workspace_id": f"eq.{workspace_id}",
                    "select": CHECKLIST_SELECT},
        )
    )
    patch = body.model_dump(exclude_unset=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    if patch.get("completed"):
        patch["not_applicable"] = False
    if patch.get("not_applicable"):
        if not item.get("allow_na"):
            raise ApiError(400, "VALIDATION_ERROR", "הסעיף הזה חייב להתבצע: אי אפשר לסמן 'לא רלוונטי'")
        patch["completed"] = False
    if "notes" in patch and patch["notes"] is not None:
        patch["notes"] = patch["notes"].strip() or None
    photo = patch.get("photo_document_id", item.get("photo_document_id"))
    if patch.get("photo_document_id"):
        docs = as_list(
            client.get(
                "documents",
                params={
                    "id": f"eq.{patch['photo_document_id']}",
                    "workspace_id": f"eq.{workspace_id}",
                    "entity_type": "eq.job",
                    "entity_id": f"eq.{job_id}",
                    "select": "id",
                },
            )
        )
        if not docs:
            raise ApiError(400, "VALIDATION_ERROR", "התמונה לא שייכת לעבודה הזו")
    completing = patch.get("completed", item.get("completed"))
    if completing and item.get("photo_required") and not photo:
        raise ApiError(400, "VALIDATION_ERROR", "יש לצרף תמונה לסעיף הזה לפני סימון")
    # who marked and when are set by the database trigger from the signed-in user.
    row = patched_or_403(
        client.patch(
            "job_checklist_items",
            patch,
            params={"id": f"eq.{item_id}", "job_id": f"eq.{job_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )
    return _with_marker_names(client, [row])[0]
