from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, datetime
from typing import Annotated, Any, Callable, Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from ..authz.engine import authorize
from ..authz.guard import require
from ..dashboard import DEFAULT_WORKSPACE_TZ, build_dashboard
from ..deps import UserClient, current_user, load_authz_context, user_client
from ..identity import actor_id
from ..rest import as_list

# Cap kept high enough for ops summary buckets, low enough for mobile RTT.
QUOTE_DASHBOARD_LIMIT = "200"
JOB_DASHBOARD_LIMIT = "100"

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["dashboard"])

QUOTE_SELECT = "id,number,title,status,customer_id,site_id,owner_user_id,valid_until,updated_at,total_gross"
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
    site_id: str | None = None
    site_address: str | None = None
    customer_phone: str | None = None
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
    title: str | None = None
    customer_name: str | None = None
    total_gross: float | None = None
    updated_at: str


class BusinessChartOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    labels_he: list[str]
    revenue: list[float]
    quotes: list[int]
    revenue_change_percent: int | None = None
    quote_change: int | None = None
    conversion_change_percent: int | None = None


class DashboardOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    home_variant: Literal["ops", "sales", "today", "observe"]
    generated_at: str
    attention: list[AttentionGroupOut]
    today: TodayBlockOut
    activity: list[ActivityItemOut]
    summary: DashboardSummaryOut
    recent_quotes: list[RecentQuoteOut]
    business_chart: BusinessChartOut | None = None


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


def _run_parallel(jobs: dict[str, Callable[[], Any]]) -> dict[str, Any]:
    """Run independent PostgREST fetches concurrently (same JWT client; sync HTTP)."""
    if not jobs:
        return {}
    if len(jobs) == 1:
        key, fn = next(iter(jobs.items()))
        return {key: fn()}
    out: dict[str, Any] = {}
    with ThreadPoolExecutor(max_workers=min(6, len(jobs))) as pool:
        futures = {pool.submit(fn): key for key, fn in jobs.items()}
        for fut in as_completed(futures):
            out[futures[fut]] = fut.result()
    return out


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
    assignments_reliable = ctx.role_key in {"owner", "administrator", "manager"}
    ws = str(workspace_id)

    phase1: dict[str, Callable[[], Any]] = {
        "workspace": lambda: _optional_list(
            client.get("workspaces", params={"id": f"eq.{ws}", "select": "timezone", "limit": "1"})
        ),
        "assignments": lambda: _optional_list(
            client.get(
                "assignments",
                params={
                    "workspace_id": f"eq.{ws}",
                    "resource_type": "eq.job",
                    "select": "resource_id,user_id",
                },
            )
        ),
    }
    if can_quotes_view:
        phase1["quotes"] = lambda: as_list(
            client.get(
                "quotes",
                params={
                    "workspace_id": f"eq.{ws}",
                    "deleted_at": "is.null",
                    "select": QUOTE_SELECT,
                    "limit": QUOTE_DASHBOARD_LIMIT,
                    "order": "updated_at.desc",
                },
            )
        )
        phase1["events"] = lambda: _optional_list(
            client.get(
                "quote_events",
                params={
                    "workspace_id": f"eq.{ws}",
                    "select": "event_type,quote_id,created_at",
                    "order": "created_at.desc",
                    "limit": "8",
                },
            )
        )
    if can_jobs_view:
        phase1["jobs"] = lambda: as_list(
            client.get(
                "jobs",
                params={
                    "workspace_id": f"eq.{ws}",
                    "select": JOB_SELECT,
                    "limit": JOB_DASHBOARD_LIMIT,
                    "order": "scheduled_for.asc",
                },
            )
        )

    batch1 = _run_parallel(phase1)
    workspace_tz = DEFAULT_WORKSPACE_TZ
    workspace_rows = batch1.get("workspace") or []
    if workspace_rows and workspace_rows[0].get("timezone"):
        workspace_tz = str(workspace_rows[0]["timezone"])

    quotes: list[dict[str, Any]] = list(batch1.get("quotes") or [])
    for row in quotes:
        for key in COST_SELECT_FORBIDDEN:
            row.pop(key, None)
    jobs: list[dict[str, Any]] = list(batch1.get("jobs") or [])
    assignment_rows: list[dict[str, Any]] = list(batch1.get("assignments") or [])
    raw_events: list[dict[str, Any]] = list(batch1.get("events") or [])

    job_assignees: dict[str, set[str]] = {}
    for row in assignment_rows:
        job_assignees.setdefault(str(row["resource_id"]), set()).add(str(row["user_id"]))

    names: dict[str, str] = {}
    site_addresses: dict[str, str] = {}
    customer_phones: dict[str, str] = {}
    customer_filter = _in_filter({str(r["customer_id"]) for r in quotes + jobs if r.get("customer_id")})
    site_filter = _in_filter({str(r["site_id"]) for r in quotes + jobs if r.get("site_id")})
    approved_ids = {str(q["id"]) for q in quotes if q.get("status") == "approved"} if can_quotes_view else set()

    phase2: dict[str, Callable[[], Any]] = {}
    if customer_filter:
        phase2["customers"] = lambda: _optional_list(
            client.get("customers", params={"id": customer_filter, "select": "id,display_name,phone"})
        )
    if site_filter:
        phase2["sites"] = lambda: _optional_list(
            client.get("sites", params={"id": site_filter, "select": "id,name,address"})
        )
    if approved_ids:
        phase2["projects"] = lambda: _optional_list(
            client.get(
                "projects",
                params={
                    "workspace_id": f"eq.{ws}",
                    "source_quote_id": f"in.({','.join(sorted(approved_ids))})",
                    "select": "source_quote_id",
                    "limit": "100",
                },
            )
        )

    batch2 = _run_parallel(phase2)
    for row in batch2.get("customers") or []:
        names[str(row["id"])] = row.get("display_name") or ""
        phone = (row.get("phone") or "").strip()
        if phone:
            customer_phones[str(row["id"])] = phone
    for row in batch2.get("sites") or []:
        names[str(row["id"])] = row.get("name") or ""
        addr = row.get("address")
        line = ""
        if isinstance(addr, dict):
            line = str(addr.get("line") or addr.get("formatted") or "").strip()
        elif isinstance(addr, str):
            line = addr.strip()
        if line:
            site_addresses[str(row["id"])] = line

    events: list[dict[str, Any]] = []
    quote_numbers = {str(q["id"]): q.get("number") or "" for q in quotes}
    for event in raw_events:
        event["quote_number"] = quote_numbers.get(str(event.get("quote_id") or ""), "")
        events.append(event)

    project_source_quote_ids: frozenset[str] = frozenset(
        str(row["source_quote_id"]) for row in (batch2.get("projects") or []) if row.get("source_quote_id")
    )

    payload = build_dashboard(
        role_key=ctx.role_key,
        user_id=ctx.user_id,
        now=datetime.now(UTC),
        tz_name=workspace_tz,
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
    jobs_by_id = {str(j["id"]): j for j in jobs}
    for item in payload.get("today", {}).get("items", []):
        if item.get("entity_type") != "job":
            continue
        job = jobs_by_id.get(str(item.get("entity_id") or ""))
        if not job:
            continue
        site_id = str(job["site_id"]) if job.get("site_id") else None
        customer_id = str(job["customer_id"]) if job.get("customer_id") else None
        item["site_id"] = site_id
        item["site_address"] = site_addresses.get(site_id) if site_id else None
        item["customer_phone"] = customer_phones.get(customer_id) if customer_id else None
    return DashboardOut.model_validate(payload)
