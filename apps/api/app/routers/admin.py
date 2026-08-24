from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from ..deps import ServiceClient, current_user, service_client
from ..errors import ApiError, MESSAGES
from ..platform import require_platform_admin
from ..rest import as_list, one_or_404, patched_or_403

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

BetaProgram = Literal["early", "private", "public"]
FeedbackStatus = Literal["new", "triage", "in_progress", "resolved", "wont_fix"]


class OrgBetaPatch(BaseModel):
    is_beta: bool | None = None
    beta_program: BetaProgram | None = None


class FeedbackAdminPatch(BaseModel):
    status: FeedbackStatus | None = None
    internal_notes: str | None = Field(default=None, max_length=8000)
    severity: Literal["low", "medium", "high", "blocker"] | None = None


class FlagPatch(BaseModel):
    enabled_for_beta: bool | None = None
    enabled_for_production: bool | None = None
    description: str | None = Field(default=None, max_length=500)


def _nested(value):
    if isinstance(value, list):
        return value[0] if value else None
    return value if isinstance(value, dict) else None


@router.get("/summary")
def admin_summary(
    service: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
):
    require_platform_admin(service, user["id"])
    orgs = as_list(service.get("workspaces", params={"select": "id,is_beta,status"}))
    users = as_list(service.get("profiles", params={"select": "id"}))
    reports = as_list(service.get("feedback_reports", params={"select": "id,status"}))
    open_statuses = {"new", "triage", "in_progress"}
    return {
        "organizations": len(orgs),
        "beta_organizations": sum(1 for row in orgs if row.get("is_beta")),
        "users": len(users),
        "feedback_open": sum(1 for row in reports if row.get("status") in open_statuses),
        "feedback_total": len(reports),
    }


@router.get("/organizations")
def list_organizations(
    service: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
):
    require_platform_admin(service, user["id"])
    rows = as_list(
        service.get(
            "workspaces",
            params={
                "select": "id,name,status,is_beta,beta_program,beta_enrolled_at,created_at,subscriptions(plan_key,status)",
                "order": "created_at.desc",
            },
        )
    )
    out = []
    for row in rows:
        sub = _nested(row.get("subscriptions"))
        out.append(
            {
                "id": row["id"],
                "name": row["name"],
                "status": row["status"],
                "is_beta": bool(row.get("is_beta")),
                "beta_program": row.get("beta_program"),
                "beta_enrolled_at": row.get("beta_enrolled_at"),
                "created_at": row.get("created_at"),
                "plan_key": sub.get("plan_key") if sub else None,
                "subscription_status": sub.get("status") if sub else None,
            }
        )
    return out


@router.patch("/organizations/{workspace_id}")
def patch_organization(
    workspace_id: UUID,
    body: OrgBetaPatch,
    service: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
):
    require_platform_admin(service, user["id"])
    existing = one_or_404(
        service.get(
            "workspaces",
            params={"id": f"eq.{workspace_id}", "select": "id,is_beta,beta_program,beta_enrolled_at,name,status"},
        )
    )
    patch: dict = {}
    if body.is_beta is not None:
        patch["is_beta"] = body.is_beta
        if body.is_beta and not existing.get("beta_enrolled_at"):
            patch["beta_enrolled_at"] = datetime.now(timezone.utc).isoformat()
        if body.is_beta and not body.beta_program and not existing.get("beta_program"):
            patch["beta_program"] = "early"
    if body.beta_program is not None:
        patch["beta_program"] = body.beta_program
    if not patch:
        return existing
    row = patched_or_403(service.patch("workspaces", patch, params={"id": f"eq.{workspace_id}"}))
    return {
        "id": row["id"],
        "name": row["name"],
        "status": row["status"],
        "is_beta": bool(row.get("is_beta")),
        "beta_program": row.get("beta_program"),
        "beta_enrolled_at": row.get("beta_enrolled_at"),
    }


@router.get("/users")
def list_users(
    service: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
):
    require_platform_admin(service, user["id"])
    profiles = as_list(
        service.get(
            "profiles",
            params={
                "select": "id,email,full_name,is_platform_admin,created_at",
                "order": "created_at.desc",
                "limit": "200",
            },
        )
    )
    members = as_list(
        service.get(
            "workspace_memberships",
            params={
                "select": "user_id,workspace_id,role_key,status,workspaces(name,is_beta)",
                "status": "eq.active",
            },
        )
    )
    by_user: dict[str, list] = {}
    for row in members:
        ws = _nested(row.get("workspaces")) or {}
        by_user.setdefault(row["user_id"], []).append(
            {
                "workspace_id": row["workspace_id"],
                "workspace_name": ws.get("name"),
                "role_key": row["role_key"],
                "is_beta": bool(ws.get("is_beta")),
            }
        )
    return [
        {
            **row,
            "is_platform_admin": bool(row.get("is_platform_admin")),
            "memberships": by_user.get(row["id"], []),
        }
        for row in profiles
    ]


@router.get("/feedback")
def list_admin_feedback(
    service: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
    status: str | None = Query(default=None),
    report_type: str | None = Query(default=None),
):
    require_platform_admin(service, user["id"])
    params: dict[str, str] = {
        "select": "id,ticket_id,workspace_id,user_id,report_type,severity,status,title,body,page_url,user_agent,viewport,role_key,plan_key,is_beta,screenshot_url,internal_notes,created_at,updated_at",
        "order": "created_at.desc",
        "limit": "200",
    }
    if status:
        params["status"] = f"eq.{status}"
    if report_type:
        params["report_type"] = f"eq.{report_type}"
    return as_list(service.get("feedback_reports", params=params))


@router.patch("/feedback/{report_id}")
def patch_admin_feedback(
    report_id: UUID,
    body: FeedbackAdminPatch,
    service: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
):
    require_platform_admin(service, user["id"])
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", MESSAGES["VALIDATION_ERROR"])
    return patched_or_403(service.patch("feedback_reports", patch, params={"id": f"eq.{report_id}"}))


@router.get("/feature-flags")
def list_admin_flags(
    service: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
):
    require_platform_admin(service, user["id"])
    return as_list(
        service.get(
            "feature_flags",
            params={"select": "id,name,enabled_for_beta,enabled_for_production,description,updated_at", "order": "name.asc"},
        )
    )


@router.patch("/feature-flags/{flag_id}")
def patch_admin_flag(
    flag_id: UUID,
    body: FlagPatch,
    service: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
):
    require_platform_admin(service, user["id"])
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", MESSAGES["VALIDATION_ERROR"])
    return patched_or_403(service.patch("feature_flags", patch, params={"id": f"eq.{flag_id}"}))
