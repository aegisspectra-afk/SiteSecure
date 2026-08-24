from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from ..deps import UserClient, current_user, load_authz_context, user_client
from ..rest import as_list, created_or_403

router = APIRouter(prefix="/api/v1", tags=["feedback"])

ReportType = Literal["bug", "feature", "general"]
Severity = Literal["low", "medium", "high", "blocker"]


class FeedbackCreate(BaseModel):
    workspace_id: UUID
    report_type: ReportType
    title: str = Field(min_length=3, max_length=160)
    body: str = Field(min_length=8, max_length=8000)
    severity: Severity = "medium"
    page_url: str | None = Field(default=None, max_length=2000)
    user_agent: str | None = Field(default=None, max_length=500)
    viewport: str | None = Field(default=None, max_length=80)
    screenshot_url: str | None = Field(default=None, max_length=2000)


class FeedbackOut(BaseModel):
    id: str
    ticket_id: str
    workspace_id: str
    report_type: str
    severity: str
    status: str
    title: str
    body: str
    page_url: str | None = None
    created_at: str
    is_beta: bool = False


def _out(row: dict) -> FeedbackOut:
    return FeedbackOut(
        id=row["id"],
        ticket_id=row["ticket_id"],
        workspace_id=row["workspace_id"],
        report_type=row["report_type"],
        severity=row["severity"],
        status=row["status"],
        title=row["title"],
        body=row["body"],
        page_url=row.get("page_url"),
        created_at=row["created_at"],
        is_beta=bool(row.get("is_beta")),
    )


@router.get("/feedback", response_model=list[FeedbackOut])
def list_feedback(
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    workspace_id: UUID | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
) -> list[FeedbackOut]:
    params: dict[str, str] = {
        "user_id": f"eq.{user['id']}",
        "select": "id,ticket_id,workspace_id,report_type,severity,status,title,body,page_url,created_at,is_beta",
        "order": "created_at.desc",
        "limit": str(limit),
    }
    if workspace_id:
        load_authz_context(client, user["id"], str(workspace_id))
        params["workspace_id"] = f"eq.{workspace_id}"
    return [_out(row) for row in as_list(client.get("feedback_reports", params=params))]


@router.post("/feedback", response_model=FeedbackOut)
def create_feedback(
    body: FeedbackCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> FeedbackOut:
    ctx = load_authz_context(client, user["id"], str(body.workspace_id))
    ws = client.get(
        "workspaces",
        params={"id": f"eq.{body.workspace_id}", "select": "id,is_beta"},
    )
    is_beta = False
    if ws.status_code == 200 and ws.json():
        is_beta = bool(ws.json()[0].get("is_beta"))
    ticket_id = f"FB-{uuid4().hex[:8].upper()}"
    row = created_or_403(
        client.post(
            "feedback_reports",
            {
                "ticket_id": ticket_id,
                "workspace_id": str(body.workspace_id),
                "user_id": user["id"],
                "report_type": body.report_type,
                "severity": body.severity,
                "title": body.title.strip(),
                "body": body.body.strip(),
                "page_url": body.page_url,
                "user_agent": body.user_agent,
                "viewport": body.viewport,
                "role_key": ctx.role_key,
                "plan_key": ctx.plan_key,
                "is_beta": is_beta,
                "screenshot_url": body.screenshot_url,
            },
        )
    )
    return _out(row)


@router.get("/feature-flags")
def list_feature_flags(
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    workspace_id: UUID | None = Query(default=None),
) -> list[dict]:
    is_beta = False
    if workspace_id:
        load_authz_context(client, user["id"], str(workspace_id))
        ws = client.get("workspaces", params={"id": f"eq.{workspace_id}", "select": "is_beta"})
        if ws.status_code == 200 and ws.json():
            is_beta = bool(ws.json()[0].get("is_beta"))
    flags = as_list(
        client.get(
            "feature_flags",
            params={"select": "id,name,enabled_for_beta,enabled_for_production,description", "order": "name.asc"},
        )
    )
    out = []
    for flag in flags:
        enabled = bool(flag.get("enabled_for_beta") if is_beta else flag.get("enabled_for_production"))
        out.append(
            {
                "id": flag["id"],
                "name": flag["name"],
                "description": flag.get("description"),
                "enabled_for_beta": bool(flag.get("enabled_for_beta")),
                "enabled_for_production": bool(flag.get("enabled_for_production")),
                "enabled": enabled,
            }
        )
    return out
