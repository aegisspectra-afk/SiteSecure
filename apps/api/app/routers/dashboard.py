from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from ..authz.engine import authorize
from ..authz.guard import require
from ..dashboard import build_dashboard
from ..deps import UserClient, current_user, load_authz_context, user_client
from ..identity import actor_id
from ..rest import as_list

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["dashboard"])

QUOTE_SELECT = "id,number,status,customer_id,site_id,owner_user_id,valid_until,updated_at,total_gross"
JOB_SELECT = (
    "id,number,title,status,customer_id,site_id,scheduled_for,started_at,completed_at,updated_at"
)
COST_SELECT_FORBIDDEN = ("cost_total", "margin_amount", "margin_percent")


class DashboardItemOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    entity_type: str
    entity_id: str
    number: str
    title_he: str
    customer_name: str | None = None
    site_name: str | None = None
    scheduled_for: str | None = None
    severity: Literal["now", "next", "info"]
    actions: list[str] = Field(default_factory=list)
    updated_at: str | None = None


class AttentionGroupOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: str
    label_he: str
    count: int
    items: list[DashboardItemOut]


class TodayBlockOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label_he: str
    items: list[DashboardItemOut]


class ActivityItemOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    entity_type: str
    entity_id: str
    title_he: str
    occurred_at: str


class DashboardSummaryOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    quotes_draft: int
    quotes_sent: int
    quotes_viewed: int
    quotes_approved: int
    quotes_rejected: int
    quotes_open: int
    quotes_approved_value: float
    quotes_open_value: float = 0
    jobs_open: int
    jobs_overdue: int
    jobs_unassigned: int


class RecentQuoteOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    number: str
    status: str
    customer_name: str | None = None
    total_gross: float | None = None
    updated_at: str


class DashboardOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    home_variant: Literal["ops", "sales", "today", "observe"]
    generated_at: str
    attention: list[AttentionGroupOut]
    today: TodayBlockOut
    activity: list[ActivityItemOut]
    summary: DashboardSummaryOut
    recent_quotes: list[RecentQuoteOut]


def _optional_list(res) -> list[dict[str, Any]]:
    if res.status_code == 200:
        data = res.json()
        return data if isinstance(data, list) else []
    return []


def _in_filter(ids: set[str]) -> str | None:
    clean = [item for item in ids if item]
    if not clean:
        return None
    return f"in.({','.join(clean)})"


@router.get("/dashboard", response_model=DashboardOut)
def get_dashboard(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> DashboardOut:
    ctx = load_authz_context(client, actor_id(user), str(workspace_id))
    require(ctx, "dashboard.view")

    can_quotes_view = authorize(ctx=ctx, action="quotes.view").allowed
    can_jobs_view = authorize(ctx=ctx, action="jobs.view").allowed
    can_jobs_start = authorize(ctx=ctx, action="jobs.start").allowed
    can_jobs_complete = authorize(ctx=ctx, action="jobs.complete").allowed

    quotes: list[dict[str, Any]] = []
    if can_quotes_view:
        quotes = as_list(
            client.get(
                "quotes",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "deleted_at": "is.null",
                    "select": QUOTE_SELECT,
                    "limit": "100",
                    "order": "updated_at.desc",
                },
            )
        )
        for row in quotes:
            for key in COST_SELECT_FORBIDDEN:
                row.pop(key, None)

    jobs: list[dict[str, Any]] = []
    if can_jobs_view:
        jobs = as_list(
            client.get(
                "jobs",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "select": JOB_SELECT,
                    "limit": "100",
                    "order": "scheduled_for.asc",
                },
            )
        )

    assignment_rows = _optional_list(
        client.get(
            "assignments",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "resource_type": "eq.job",
                "select": "resource_id,user_id",
            },
        )
    )
    job_assignees: dict[str, set[str]] = {}
    for row in assignment_rows:
        job_assignees.setdefault(str(row["resource_id"]), set()).add(str(row["user_id"]))
    assignments_reliable = ctx.role_key in {"owner", "administrator", "manager"}

    names: dict[str, str] = {}
    customer_filter = _in_filter({str(r["customer_id"]) for r in quotes + jobs if r.get("customer_id")})
    site_filter = _in_filter({str(r["site_id"]) for r in quotes + jobs if r.get("site_id")})
    if customer_filter:
        for row in _optional_list(
            client.get("customers", params={"id": customer_filter, "select": "id,display_name"})
        ):
            names[str(row["id"])] = row.get("display_name") or ""
    if site_filter:
        for row in _optional_list(client.get("sites", params={"id": site_filter, "select": "id,name"})):
            names[str(row["id"])] = row.get("name") or ""

    events: list[dict[str, Any]] = []
    if can_quotes_view:
        raw_events = _optional_list(
            client.get(
                "quote_events",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "select": "event_type,quote_id,created_at",
                    "order": "created_at.desc",
                    "limit": "8",
                },
            )
        )
        quote_numbers = {str(q["id"]): q.get("number") or "" for q in quotes}
        for event in raw_events:
            event["quote_number"] = quote_numbers.get(str(event.get("quote_id") or ""), "")
            events.append(event)

    project_source_quote_ids: frozenset[str] = frozenset()
    if can_quotes_view:
        approved_ids = {str(q["id"]) for q in quotes if q.get("status") == "approved"}
        if approved_ids:
            project_rows = _optional_list(
                client.get(
                    "projects",
                    params={
                        "workspace_id": f"eq.{workspace_id}",
                        "source_quote_id": f"in.({','.join(sorted(approved_ids))})",
                        "select": "source_quote_id",
                        "limit": "100",
                    },
                )
            )
            project_source_quote_ids = frozenset(
                str(row["source_quote_id"]) for row in project_rows if row.get("source_quote_id")
            )

    payload = build_dashboard(
        role_key=ctx.role_key,
        user_id=ctx.user_id,
        now=datetime.now(UTC),
        quotes=quotes,
        jobs=jobs,
        job_assignees=job_assignees,
        assigned_resource_ids=ctx.assigned_resource_ids,
        names=names,
        events=events,
        can_quotes_view=can_quotes_view,
        can_jobs_view=can_jobs_view,
        can_jobs_start=can_jobs_start,
        can_jobs_complete=can_jobs_complete,
        assignments_reliable=assignments_reliable,
        project_source_quote_ids=project_source_quote_ids,
    )
    return DashboardOut.model_validate(payload)
