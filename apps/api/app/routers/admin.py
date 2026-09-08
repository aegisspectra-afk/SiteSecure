from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..deps import ServiceClient, current_user, service_client
from ..errors import ApiError, MESSAGES
from ..platform import require_platform_admin, write_platform_admin_event
from ..rest import as_list, created_or_403, one_or_404, patched_or_403

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

BetaProgram = Literal["early", "private", "public"]
FeedbackStatus = Literal["new", "triage", "in_progress", "resolved", "wont_fix"]
BetaParticipantStatus = Literal["invited", "registered", "activated", "active", "paused", "exited"]

DEFAULT_BETA_COHORT = "Founding Technicians — 2026"

ALLOWED_RECOGNITION_BADGES = frozenset(
    {"founding_technician", "verified_technician", "early_access", "partner"}
)


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


class UserBadgesPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    recognition_badges: list[str] = Field(default_factory=list)
    reason: str | None = Field(default=None, max_length=500)


class BetaParticipantPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    workspace_id: UUID
    status: BetaParticipantStatus
    cohort: str | None = Field(default=None, max_length=120)
    internal_note: str | None = Field(default=None, max_length=2000)


def _nested(value):
    if isinstance(value, list):
        return value[0] if value else None
    return value if isinstance(value, dict) else None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _apply_beta_timestamps(existing: dict[str, Any] | None, status: str) -> dict[str, Any]:
    """Server-authored timestamps only — never invent unrelated stamp fields."""
    now = _now()
    patch: dict[str, Any] = {"status": status}
    if status == "invited":
        if not (existing or {}).get("invited_at"):
            patch["invited_at"] = now
    elif status == "registered":
        if not (existing or {}).get("registered_at"):
            patch["registered_at"] = now
    elif status == "activated":
        if not (existing or {}).get("activated_at"):
            patch["activated_at"] = now
    elif status == "active":
        if not (existing or {}).get("activated_at"):
            patch["activated_at"] = now
        if not (existing or {}).get("joined_at"):
            patch["joined_at"] = now
    elif status == "paused":
        patch["paused_at"] = now
    elif status == "exited":
        patch["exited_at"] = now
    return patch


def _serialize_beta_row(row: dict[str, Any], *, email: str | None = None, full_name: str | None = None, role_key: str | None = None, workspace_name: str | None = None, recognition_badges: list[str] | None = None) -> dict[str, Any]:
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "workspace_id": row["workspace_id"],
        "cohort": row.get("cohort"),
        "status": row.get("status"),
        "invited_at": row.get("invited_at"),
        "registered_at": row.get("registered_at"),
        "activated_at": row.get("activated_at"),
        "joined_at": row.get("joined_at"),
        "paused_at": row.get("paused_at"),
        "exited_at": row.get("exited_at"),
        "internal_note": row.get("internal_note"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
        "email": email,
        "full_name": full_name,
        "role_key": role_key,
        "workspace_name": workspace_name,
        "recognition_badges": recognition_badges or [],
    }


@router.get("/summary")
def admin_summary(
    service: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
):
    require_platform_admin(service, user["id"])
    orgs = as_list(service.get("workspaces", params={"select": "id,is_beta,status"}))
    users = as_list(service.get("profiles", params={"select": "id"}))
    reports = as_list(service.get("feedback_reports", params={"select": "id,status"}))
    participants = as_list(service.get("beta_participants", params={"select": "id,status"}))
    open_statuses = {"new", "triage", "in_progress"}
    active_beta = {"invited", "registered", "activated", "active"}
    return {
        "organizations": len(orgs),
        "beta_organizations": sum(1 for row in orgs if row.get("is_beta")),
        "users": len(users),
        "feedback_open": sum(1 for row in reports if row.get("status") in open_statuses),
        "feedback_total": len(reports),
        "beta_participants_active": sum(1 for row in participants if row.get("status") in active_beta),
        "beta_participants_total": len(participants),
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
            patch["beta_enrolled_at"] = _now()
        if body.is_beta and not body.beta_program and not existing.get("beta_program"):
            patch["beta_program"] = "early"
    if body.beta_program is not None:
        patch["beta_program"] = body.beta_program
    if not patch:
        return existing
    row = patched_or_403(service.patch("workspaces", patch, params={"id": f"eq.{workspace_id}"}))
    write_platform_admin_event(
        service,
        actor_user_id=user["id"],
        action="workspace_beta_updated",
        target_workspace_id=str(workspace_id),
        metadata={"before": {"is_beta": existing.get("is_beta"), "beta_program": existing.get("beta_program")}, "after": patch},
    )
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
    q: str | None = Query(default=None, max_length=120),
):
    require_platform_admin(service, user["id"])
    profiles = as_list(
        service.get(
            "profiles",
            params={
                "select": "id,email,full_name,is_platform_admin,recognition_badges,created_at",
                "order": "created_at.desc",
                "limit": "200",
            },
        )
    )
    if q:
        needle = q.strip().lower()
        profiles = [
            p
            for p in profiles
            if needle in str(p.get("email") or "").lower() or needle in str(p.get("full_name") or "").lower()
        ]
    members = as_list(
        service.get(
            "workspace_memberships",
            params={
                "select": "user_id,workspace_id,role_key,status,workspaces(name,is_beta)",
                "status": "eq.active",
            },
        )
    )
    beta_rows = as_list(
        service.get(
            "beta_participants",
            params={
                "select": "id,user_id,workspace_id,cohort,status,invited_at,registered_at,activated_at,joined_at,paused_at,exited_at,internal_note,created_at,updated_at",
                "order": "updated_at.desc",
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
    beta_by_user: dict[str, list] = {}
    for row in beta_rows:
        beta_by_user.setdefault(row["user_id"], []).append(_serialize_beta_row(row))
    return [
        {
            **row,
            "is_platform_admin": bool(row.get("is_platform_admin")),
            "platform_role": "platform_super_admin" if row.get("is_platform_admin") else None,
            "recognition_badges": list(row.get("recognition_badges") or []),
            "memberships": by_user.get(row["id"], []),
            "beta_participations": beta_by_user.get(row["id"], []),
        }
        for row in profiles
    ]


@router.patch("/users/{user_id}/badges")
def patch_user_badges(
    user_id: UUID,
    body: UserBadgesPatch,
    service: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
):
    require_platform_admin(service, user["id"])
    existing = one_or_404(
        service.get(
            "profiles",
            params={"id": f"eq.{user_id}", "select": "id,email,full_name,is_platform_admin,recognition_badges,created_at"},
        )
    )
    before = list(existing.get("recognition_badges") or [])
    badges = []
    for raw in body.recognition_badges:
        key = str(raw).strip()
        if key and key in ALLOWED_RECOGNITION_BADGES and key not in badges:
            badges.append(key)
    row = patched_or_403(
        service.patch(
            "profiles",
            {"recognition_badges": badges},
            params={"id": f"eq.{user_id}", "select": "id,email,full_name,is_platform_admin,recognition_badges,created_at"},
        )
    )
    granted = sorted(set(badges) - set(before))
    revoked = sorted(set(before) - set(badges))
    if granted:
        write_platform_admin_event(
            service,
            actor_user_id=user["id"],
            action="badge_granted",
            target_user_id=str(user_id),
            metadata={"badges": granted, "reason": body.reason, "all": badges},
        )
    if revoked:
        write_platform_admin_event(
            service,
            actor_user_id=user["id"],
            action="badge_revoked",
            target_user_id=str(user_id),
            metadata={"badges": revoked, "reason": body.reason, "all": badges},
        )
    # Badge must not alter platform admin or imply role change — return memberships empty; caller refreshes list.
    return {
        **row,
        "is_platform_admin": bool(row.get("is_platform_admin")),
        "platform_role": "platform_super_admin" if row.get("is_platform_admin") else None,
        "recognition_badges": list(row.get("recognition_badges") or []),
        "memberships": [],
        "beta_participations": [],
    }


@router.get("/beta/participants")
def list_beta_participants(
    service: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
    status: str | None = Query(default=None),
    cohort: str | None = Query(default=None, max_length=120),
    badge: str | None = Query(default=None, max_length=64),
):
    require_platform_admin(service, user["id"])
    params: dict[str, str] = {
        "select": "id,user_id,workspace_id,cohort,status,invited_at,registered_at,activated_at,joined_at,paused_at,exited_at,internal_note,created_at,updated_at",
        "order": "updated_at.desc",
        "limit": "500",
    }
    if status:
        params["status"] = f"eq.{status}"
    if cohort:
        params["cohort"] = f"eq.{cohort}"
    rows = as_list(service.get("beta_participants", params=params))
    if not rows:
        return []
    user_ids = sorted({r["user_id"] for r in rows})
    ws_ids = sorted({r["workspace_id"] for r in rows})
    profiles = as_list(
        service.get(
            "profiles",
            params={"id": f"in.({','.join(user_ids)})", "select": "id,email,full_name,recognition_badges"},
        )
    )
    workspaces = as_list(
        service.get(
            "workspaces",
            params={"id": f"in.({','.join(ws_ids)})", "select": "id,name"},
        )
    )
    members = as_list(
        service.get(
            "workspace_memberships",
            params={
                "user_id": f"in.({','.join(user_ids)})",
                "status": "eq.active",
                "select": "user_id,workspace_id,role_key",
            },
        )
    )
    profile_by = {p["id"]: p for p in profiles}
    ws_by = {w["id"]: w for w in workspaces}
    role_by = {(m["user_id"], m["workspace_id"]): m.get("role_key") for m in members}
    out = []
    for row in rows:
        prof = profile_by.get(row["user_id"]) or {}
        badges = list(prof.get("recognition_badges") or [])
        if badge and badge not in badges:
            continue
        out.append(
            _serialize_beta_row(
                row,
                email=prof.get("email"),
                full_name=prof.get("full_name"),
                role_key=role_by.get((row["user_id"], row["workspace_id"])),
                workspace_name=(ws_by.get(row["workspace_id"]) or {}).get("name"),
                recognition_badges=badges,
            )
        )
    return out


@router.patch("/users/{user_id}/beta")
def patch_user_beta(
    user_id: UUID,
    body: BetaParticipantPatch,
    service: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
):
    """Upsert Beta participation. Does NOT mutate workspace membership role_key."""
    require_platform_admin(service, user["id"])
    # Confirm target profile + membership exist (no role change).
    one_or_404(service.get("profiles", params={"id": f"eq.{user_id}", "select": "id"}))
    member = as_list(
        service.get(
            "workspace_memberships",
            params={
                "user_id": f"eq.{user_id}",
                "workspace_id": f"eq.{body.workspace_id}",
                "status": "eq.active",
                "select": "id,role_key",
                "limit": "1",
            },
        )
    )
    if not member:
        raise ApiError(400, "VALIDATION_ERROR", "המשתמש אינו חבר פעיל בסביבת העבודה שנבחרה")
    role_before = member[0].get("role_key")

    existing_rows = as_list(
        service.get(
            "beta_participants",
            params={
                "user_id": f"eq.{user_id}",
                "workspace_id": f"eq.{body.workspace_id}",
                "select": "*",
                "limit": "1",
            },
        )
    )
    existing = existing_rows[0] if existing_rows else None
    stamp = _apply_beta_timestamps(existing, body.status)
    if body.cohort is not None:
        stamp["cohort"] = body.cohort.strip() or DEFAULT_BETA_COHORT
    elif not existing:
        stamp["cohort"] = DEFAULT_BETA_COHORT
    if body.internal_note is not None:
        stamp["internal_note"] = body.internal_note

    if existing:
        row = patched_or_403(
            service.patch(
                "beta_participants",
                stamp,
                params={"id": f"eq.{existing['id']}", "select": "*"},
            )
        )
    else:
        payload = {
            "user_id": str(user_id),
            "workspace_id": str(body.workspace_id),
            **stamp,
        }
        row = created_or_403(service.post("beta_participants", payload))

    # Verify role unchanged
    member_after = as_list(
        service.get(
            "workspace_memberships",
            params={
                "user_id": f"eq.{user_id}",
                "workspace_id": f"eq.{body.workspace_id}",
                "status": "eq.active",
                "select": "role_key",
                "limit": "1",
            },
        )
    )
    role_after = (member_after[0].get("role_key") if member_after else None)
    if role_after != role_before:
        raise ApiError(500, "API_UNAVAILABLE", "Beta mutation must not change workspace role")

    action = {
        "invited": "beta_participant_invited",
        "registered": "beta_participant_registered",
        "activated": "beta_participant_activated",
        "active": "beta_participant_activated",
        "paused": "beta_participant_paused",
        "exited": "beta_participant_exited",
    }.get(body.status, "beta_participant_updated")
    write_platform_admin_event(
        service,
        actor_user_id=user["id"],
        action=action,
        target_user_id=str(user_id),
        target_workspace_id=str(body.workspace_id),
        metadata={
            "status": body.status,
            "cohort": row.get("cohort"),
            "role_unchanged": role_before,
            "internal_note": body.internal_note,
        },
    )
    return _serialize_beta_row(row, role_key=role_before)


@router.get("/audit")
def list_admin_audit(
    service: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
    limit: int = Query(default=100, ge=1, le=500),
):
    require_platform_admin(service, user["id"])
    # Platform Admin events (primary for badge/beta ops)
    platform_rows = as_list(
        service.get(
            "platform_admin_events",
            params={
                "select": "id,actor_user_id,action,target_user_id,target_workspace_id,metadata,created_at",
                "order": "created_at.desc",
                "limit": str(limit),
            },
        )
    )
    # Optional: recent workspace audit_logs (metadata only; not customer content dump)
    workspace_rows = as_list(
        service.get(
            "audit_logs",
            params={
                "select": "id,workspace_id,actor_user_id,action,entity_type,entity_id,metadata,created_at,workspaces(name)",
                "order": "created_at.desc",
                "limit": str(min(limit, 50)),
            },
        )
    )
    out: list[dict[str, Any]] = []
    for row in platform_rows:
        out.append(
            {
                "id": row["id"],
                "source": "platform",
                "workspace_id": row.get("target_workspace_id"),
                "workspace_name": None,
                "actor_user_id": row.get("actor_user_id"),
                "actor_email": None,
                "target_user_id": row.get("target_user_id"),
                "action": row.get("action"),
                "entity_type": "platform",
                "entity_id": row.get("target_user_id") or row.get("target_workspace_id"),
                "created_at": row.get("created_at"),
                "metadata": row.get("metadata") or {},
            }
        )
    for row in workspace_rows:
        ws = _nested(row.get("workspaces")) or {}
        out.append(
            {
                "id": row["id"],
                "source": "workspace",
                "workspace_id": row["workspace_id"],
                "workspace_name": ws.get("name"),
                "actor_user_id": row.get("actor_user_id"),
                "actor_email": None,
                "target_user_id": None,
                "action": row.get("action"),
                "entity_type": row.get("entity_type"),
                "entity_id": str(row["entity_id"]) if row.get("entity_id") else None,
                "created_at": row.get("created_at"),
                "metadata": row.get("metadata") or {},
            }
        )
    out.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    out = out[:limit]
    actor_ids = {r["actor_user_id"] for r in out if r.get("actor_user_id")}
    if actor_ids:
        profiles = as_list(
            service.get(
                "profiles",
                params={"id": f"in.({','.join(sorted(actor_ids))})", "select": "id,email"},
            )
        )
        email_by_id = {p["id"]: p.get("email") for p in profiles}
        for row in out:
            if row.get("actor_user_id"):
                row["actor_email"] = email_by_id.get(row["actor_user_id"])
    return out


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
    row = patched_or_403(service.patch("feedback_reports", patch, params={"id": f"eq.{report_id}"}))
    write_platform_admin_event(
        service,
        actor_user_id=user["id"],
        action="feedback_updated",
        metadata={"report_id": str(report_id), "patch": {k: patch[k] for k in patch if k != "internal_notes"}},
    )
    return row


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
    row = patched_or_403(service.patch("feature_flags", patch, params={"id": f"eq.{flag_id}"}))
    write_platform_admin_event(
        service,
        actor_user_id=user["id"],
        action="feature_flag_updated",
        metadata={"flag_id": str(flag_id), "patch": patch},
    )
    return row
