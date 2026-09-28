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


def _parse_iso(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


def _hours_ago(value: Any, *, now: datetime) -> float | None:
    dt = _parse_iso(value)
    if not dt:
        return None
    return max(0.0, (now - dt).total_seconds() / 3600.0)


@router.get("/summary")
def admin_summary(
    service: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
):
    """Founding Beta operations summary — real counts only, no fabricated health."""
    from ..config import get_settings

    require_platform_admin(service, user["id"])
    now = datetime.now(timezone.utc)
    week_ago = now.timestamp() - 7 * 24 * 3600

    orgs = as_list(
        service.get(
            "workspaces",
            params={
                "select": "id,name,status,is_beta,beta_program,created_at",
                "order": "created_at.desc",
                "limit": "500",
            },
        )
    )
    profiles = as_list(
        service.get(
            "profiles",
            params={"select": "id,recognition_badges,created_at", "limit": "1000"},
        )
    )
    reports = as_list(
        service.get(
            "feedback_reports",
            params={
                "select": "id,ticket_id,title,severity,status,is_beta,workspace_id,created_at",
                "order": "created_at.desc",
                "limit": "200",
            },
        )
    )
    participants = as_list(service.get("beta_participants", params={"select": "id,status,user_id"}))
    invites = as_list(
        service.get(
            "invitations",
            params={
                "select": "id,workspace_id,email,role_key,expires_at,accepted_at,revoked_at,created_at,workspaces(name)",
                "order": "created_at.desc",
                "limit": "500",
            },
        )
    )
    memberships = as_list(
        service.get(
            "workspace_memberships",
            params={
                "select": "id,workspace_id,user_id,role_key,status,created_at",
                "order": "created_at.desc",
                "limit": "1000",
            },
        )
    )
    recent_events = as_list(
        service.get(
            "platform_admin_events",
            params={
                "select": "id,actor_user_id,action,target_user_id,target_workspace_id,metadata,created_at",
                "order": "created_at.desc",
                "limit": "20",
            },
        )
    )

    open_statuses = {"new", "triage", "in_progress"}
    active_beta = {"invited", "registered", "activated", "active"}
    invite_rows = [
        {
            **_serialize_admin_invite(row, workspace_name=(_nested(row.get("workspaces")) or {}).get("name")),
            "created_ts": _parse_iso(row.get("created_at")),
            "accepted_ts": _parse_iso(row.get("accepted_at")),
        }
        for row in invites
    ]

    beta_orgs = [row for row in orgs if row.get("is_beta")]
    beta_active = [row for row in beta_orgs if str(row.get("status") or "") == "active"]
    founding = [
        row
        for row in profiles
        if "founding_technician" in (row.get("recognition_badges") or [])
    ]

    pending = [row for row in invite_rows if row["status"] == "pending"]
    expired = [row for row in invite_rows if row["status"] == "expired"]
    revoked = [row for row in invite_rows if row["status"] == "revoked"]
    accepted = [row for row in invite_rows if row["status"] == "accepted"]
    accepted_7d = [
        row
        for row in accepted
        if row.get("accepted_ts") and row["accepted_ts"].timestamp() >= week_ago
    ]
    owner_pending = [row for row in pending if row.get("role_key") == "owner"]
    tech_pending = [row for row in pending if row.get("role_key") == "technician"]
    owner_invites = [row for row in invite_rows if row.get("role_key") == "owner"]
    owner_accepted = [row for row in owner_invites if row["status"] == "accepted"]

    active_memberships = [row for row in memberships if str(row.get("status") or "") == "active"]
    members_by_ws: dict[str, list[dict[str, Any]]] = {}
    for row in active_memberships:
        members_by_ws.setdefault(str(row["workspace_id"]), []).append(row)
    joined_7d = [
        row
        for row in memberships
        if (_parse_iso(row.get("created_at")) or datetime.min.replace(tzinfo=timezone.utc)).timestamp()
        >= week_ago
    ]

    attention: list[dict[str, Any]] = []
    for row in owner_pending:
        age_h = _hours_ago(row.get("created_at"), now=now)
        if age_h is not None and age_h >= 24:
            attention.append(
                {
                    "id": f"invite-stale-{row['id']}",
                    "kind": "owner_invite_stale",
                    "severity": "high",
                    "title": "הזמנת Owner ממתינה מעל 24 שעות",
                    "detail": f"{row.get('email')} · {row.get('workspace_name') or 'סביבה'}",
                    "href": "/admin/invitations",
                    "created_at": row.get("created_at"),
                }
            )
    for row in expired[:12]:
        attention.append(
            {
                "id": f"invite-expired-{row['id']}",
                "kind": "invite_expired",
                "severity": "medium",
                "title": "הזמנה שפג תוקפה",
                "detail": f"{row.get('email')} · {row.get('workspace_name') or 'סביבה'}",
                "href": "/admin/invitations",
                "created_at": row.get("created_at"),
            }
        )
    for row in beta_active:
        ws_id = str(row["id"])
        members = members_by_ws.get(ws_id) or []
        has_owner = any(m.get("role_key") == "owner" for m in members)
        if not members:
            attention.append(
                {
                    "id": f"ws-empty-{ws_id}",
                    "kind": "workspace_no_members",
                    "severity": "high",
                    "title": "סביבת בטא ללא חברים",
                    "detail": row.get("name") or ws_id,
                    "href": "/admin/organizations",
                    "created_at": row.get("created_at"),
                }
            )
        elif not has_owner:
            attention.append(
                {
                    "id": f"ws-no-owner-{ws_id}",
                    "kind": "workspace_no_owner",
                    "severity": "high",
                    "title": "סביבת בטא ללא Owner",
                    "detail": row.get("name") or ws_id,
                    "href": "/admin/invitations",
                    "created_at": row.get("created_at"),
                }
            )
    open_feedback = [row for row in reports if row.get("status") in open_statuses]
    for row in open_feedback:
        if row.get("severity") in {"high", "blocker"}:
            attention.append(
                {
                    "id": f"feedback-{row['id']}",
                    "kind": "feedback_high",
                    "severity": "high" if row.get("severity") == "high" else "critical",
                    "title": row.get("title") or "פידבק פתוח",
                    "detail": f"חומרה: {row.get('severity')}",
                    "href": "/admin/feedback",
                    "created_at": row.get("created_at"),
                }
            )

    severity_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    attention.sort(
        key=lambda item: (
            severity_rank.get(str(item.get("severity")), 9),
            -( _parse_iso(item.get("created_at")) or datetime.min.replace(tzinfo=timezone.utc)).timestamp(),
        )
    )

    beta_workspace_cards = []
    for row in beta_orgs[:12]:
        ws_id = str(row["id"])
        members = members_by_ws.get(ws_id) or []
        pending_for_ws = [inv for inv in pending if str(inv.get("workspace_id")) == ws_id]
        beta_workspace_cards.append(
            {
                "id": ws_id,
                "name": row.get("name"),
                "status": row.get("status"),
                "created_at": row.get("created_at"),
                "member_count": len(members),
                "pending_invites": len(pending_for_ws),
                "has_owner": any(m.get("role_key") == "owner" for m in members),
            }
        )

    feedback_cards = [
        {
            "id": row["id"],
            "ticket_id": row.get("ticket_id"),
            "title": row.get("title"),
            "severity": row.get("severity"),
            "status": row.get("status"),
            "workspace_id": row.get("workspace_id"),
            "created_at": row.get("created_at"),
            "is_beta": bool(row.get("is_beta")),
        }
        for row in sorted(
            open_feedback,
            key=lambda r: (
                0 if r.get("severity") in {"blocker", "high"} else 1,
                -( _parse_iso(r.get("created_at")) or datetime.min.replace(tzinfo=timezone.utc)).timestamp(),
            ),
        )[:8]
    ]

    activity = []
    for row in recent_events[:12]:
        meta = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
        activity.append(
            {
                "id": row["id"],
                "action": row.get("action"),
                "created_at": row.get("created_at"),
                "workspace_id": row.get("target_workspace_id"),
                "actor_user_id": row.get("actor_user_id"),
                "summary": meta.get("name") or meta.get("email") or meta.get("invitation_id") or row.get("action"),
            }
        )

    settings = get_settings()
    return {
        # legacy keys (compat)
        "organizations": len(orgs),
        "beta_organizations": len(beta_orgs),
        "users": len(profiles),
        "feedback_open": len(open_feedback),
        "feedback_total": len(reports),
        "beta_participants_active": sum(1 for row in participants if row.get("status") in active_beta),
        "beta_participants_total": len(participants),
        # Founding Beta ops
        "beta_workspaces_active": len(beta_active),
        "founding_technicians": len(founding),
        "invites_pending": len(pending),
        "invites_expired": len(expired),
        "invites_revoked": len(revoked),
        "invites_accepted": len(accepted),
        "invites_accepted_7d": len(accepted_7d),
        "owner_invites_pending": len(owner_pending),
        "technician_invites_pending": len(tech_pending),
        "joined_7d": len(joined_7d),
        "funnel": {
            "beta_workspaces": len(beta_orgs),
            "owner_invites": len(owner_invites),
            "owner_accepted": len(owner_accepted),
            "owner_pending": len(owner_pending),
        },
        "attention": attention[:20],
        "pending_invites": [
            {
                "id": row["id"],
                "email": row.get("email"),
                "workspace_id": row.get("workspace_id"),
                "workspace_name": row.get("workspace_name"),
                "role_key": row.get("role_key"),
                "status": row.get("status"),
                "created_at": row.get("created_at"),
                "expires_at": row.get("expires_at"),
                "age_hours": round(_hours_ago(row.get("created_at"), now=now) or 0, 1),
            }
            for row in pending[:10]
        ],
        "beta_workspaces": beta_workspace_cards,
        "open_feedback": feedback_cards,
        "recent_activity": activity,
        "system": {
            "api_ok": True,
            "api_version": "v1",
            "app_env": settings.app_env,
            "backup_status": "unavailable",
            "auth_status": "unknown",
            "web_status": "unknown",
            "invite_flow_status": "unknown",
            "quote_flow_status": "unknown",
        },
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


# --- BETA-ADMIN-1: workspace provision + invitations ---------------------------------

AdminInviteRole = Literal["owner", "manager", "sales", "technician", "viewer", "administrator"]


class AdminWorkspaceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=2, max_length=120)
    plan_key: str | None = Field(default="business", max_length=40)
    is_beta: bool = True
    beta_program: BetaProgram | None = "early"
    internal_note: str | None = Field(default=None, max_length=2000)


class AdminInviteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    workspace_id: UUID
    email: str = Field(min_length=3, max_length=320)
    role_key: AdminInviteRole = "owner"


def _invite_status(row: dict[str, Any]) -> str:
    if row.get("revoked_at"):
        return "revoked"
    if row.get("accepted_at"):
        return "accepted"
    expires = row.get("expires_at")
    if expires:
        try:
            exp = datetime.fromisoformat(str(expires).replace("Z", "+00:00"))
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp <= datetime.now(timezone.utc):
                return "expired"
        except ValueError:
            pass
    return "pending"


def _serialize_admin_invite(
    row: dict[str, Any], *, workspace_name: str | None = None, token: str | None = None
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": row["id"],
        "workspace_id": row["workspace_id"],
        "workspace_name": workspace_name,
        "email": row.get("email"),
        "role_key": row.get("role_key"),
        "created_at": row.get("created_at"),
        "expires_at": row.get("expires_at"),
        "accepted_at": row.get("accepted_at"),
        "revoked_at": row.get("revoked_at"),
        "invited_by": row.get("invited_by"),
        "status": _invite_status(row),
    }
    if token is not None:
        out["token"] = token
        out["invite_path"] = f"/invite/{token}"
    return out


@router.post("/organizations")
def create_organization(
    body: AdminWorkspaceCreate,
    service: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
):
    """Provision empty beta workspace (no membership). Invite owner next."""
    require_platform_admin(service, user["id"])
    plan = (body.plan_key or "business").strip() or "business"
    res = service.rpc(
        "admin_provision_workspace",
        {"p_name": body.name.strip(), "p_plan_key": plan},
    )
    if res.status_code != 200:
        text = res.text or ""
        if "INVALID_NAME" in text:
            raise ApiError(400, "VALIDATION_ERROR", MESSAGES["VALIDATION_ERROR"])
        if "INVALID_PLAN" in text:
            raise ApiError(400, "VALIDATION_ERROR", "תוכנית לא חוקית")
        raise ApiError(503, "API_UNAVAILABLE", MESSAGES["API_UNAVAILABLE"])
    workspace_id = str(res.json()).strip('"')
    patch: dict[str, Any] = {}
    if body.is_beta:
        patch["is_beta"] = True
        patch["beta_program"] = body.beta_program or "early"
        patch["beta_enrolled_at"] = _now()
    if patch:
        service.patch("workspaces", patch, params={"id": f"eq.{workspace_id}"})
    row = one_or_404(
        service.get(
            "workspaces",
            params={
                "id": f"eq.{workspace_id}",
                "select": "id,name,status,is_beta,beta_program,beta_enrolled_at,created_at,subscriptions(plan_key,status)",
            },
        )
    )
    sub = _nested(row.get("subscriptions"))
    write_platform_admin_event(
        service,
        actor_user_id=user["id"],
        action="admin_workspace_created",
        target_workspace_id=workspace_id,
        metadata={
            "name": row.get("name"),
            "plan_key": plan,
            "is_beta": bool(row.get("is_beta")),
            "internal_note": body.internal_note,
        },
    )
    return {
        "id": row["id"],
        "name": row["name"],
        "status": row["status"],
        "is_beta": bool(row.get("is_beta")),
        "beta_program": row.get("beta_program"),
        "beta_enrolled_at": row.get("beta_enrolled_at"),
        "created_at": row.get("created_at"),
        "plan_key": sub.get("plan_key") if sub else plan,
        "subscription_status": sub.get("status") if sub else None,
    }


@router.get("/memberships")
def list_memberships(
    service: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
    workspace_id: UUID | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
):
    require_platform_admin(service, user["id"])
    params: dict[str, str] = {
        "select": "id,workspace_id,user_id,role_key,status,created_at,profiles(email,full_name),workspaces(name)",
        "order": "created_at.desc",
        "limit": str(limit),
    }
    if workspace_id:
        params["workspace_id"] = f"eq.{workspace_id}"
    rows = as_list(service.get("workspace_memberships", params=params))
    out = []
    for row in rows:
        prof = _nested(row.get("profiles")) or {}
        ws = _nested(row.get("workspaces")) or {}
        out.append(
            {
                "id": row["id"],
                "email": prof.get("email"),
                "full_name": prof.get("full_name"),
                "workspace_id": row["workspace_id"],
                "workspace_name": ws.get("name"),
                "role_key": row.get("role_key"),
                "status": row.get("status"),
                "created_at": row.get("created_at"),
            }
        )
    return out


@router.get("/invitations")
def list_admin_invitations(
    service: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
    workspace_id: UUID | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
):
    require_platform_admin(service, user["id"])
    params: dict[str, str] = {
        "select": "id,workspace_id,email,role_key,invited_by,expires_at,accepted_at,revoked_at,created_at,workspaces(name)",
        "order": "created_at.desc",
        "limit": str(limit),
    }
    if workspace_id:
        params["workspace_id"] = f"eq.{workspace_id}"
    rows = as_list(service.get("invitations", params=params))
    out = []
    for row in rows:
        ws = _nested(row.get("workspaces")) or {}
        item = _serialize_admin_invite(row, workspace_name=ws.get("name"))
        if status and item["status"] != status:
            continue
        out.append(item)
    return out


@router.post("/invitations")
def create_admin_invitation(
    body: AdminInviteCreate,
    service: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
):
    import hashlib
    import secrets

    require_platform_admin(service, user["id"])
    email = body.email.strip().lower()
    role_key = body.role_key
    workspace_id = str(body.workspace_id)

    ws = one_or_404(
        service.get(
            "workspaces",
            params={"id": f"eq.{workspace_id}", "select": "id,name,status"},
        )
    )
    if ws.get("status") != "active":
        raise ApiError(403, "TENANT_INACTIVE", MESSAGES["TENANT_INACTIVE"])

    if role_key == "owner":
        owners = as_list(
            service.get(
                "workspace_memberships",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "role_key": "eq.owner",
                    "status": "eq.active",
                    "select": "id",
                    "limit": "1",
                },
            )
        )
        if owners:
            raise ApiError(403, "BUSINESS_RULE", "לסביבה כבר יש בעלים פעיל — לא ניתן להזמין בעלים נוסף")

    members = as_list(
        service.get(
            "workspace_memberships",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "status": "eq.active",
                "select": "id,user_id,profiles(email)",
            },
        )
    )
    for m in members:
        prof = _nested(m.get("profiles")) or {}
        if str(prof.get("email") or "").strip().lower() == email:
            raise ApiError(403, "INVITE_USER_EXISTS", MESSAGES["INVITE_USER_EXISTS"])

    pending = as_list(
        service.get(
            "invitations",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "email": f"eq.{email}",
                "accepted_at": "is.null",
                "revoked_at": "is.null",
                "select": "id,expires_at",
                "order": "created_at.desc",
            },
        )
    )
    now = datetime.now(timezone.utc)
    for inv in pending:
        try:
            exp = datetime.fromisoformat(str(inv["expires_at"]).replace("Z", "+00:00"))
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp > now:
                raise ApiError(403, "INVITE_ALREADY_PENDING", MESSAGES["INVITE_ALREADY_PENDING"])
        except ValueError:
            raise ApiError(403, "INVITE_ALREADY_PENDING", MESSAGES["INVITE_ALREADY_PENDING"]) from None

    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    row = created_or_403(
        service.post(
            "invitations",
            {
                "workspace_id": workspace_id,
                "email": email,
                "role_key": role_key,
                "token_hash": token_hash,
                "invited_by": user["id"],
            },
        )
    )
    write_platform_admin_event(
        service,
        actor_user_id=user["id"],
        action="admin_invitation_created",
        target_workspace_id=workspace_id,
        metadata={"invitation_id": row["id"], "email": email, "role_key": role_key},
    )
    return _serialize_admin_invite(row, workspace_name=ws.get("name"), token=token)


@router.post("/invitations/{invitation_id}/revoke")
def revoke_admin_invitation(
    invitation_id: UUID,
    service: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
):
    require_platform_admin(service, user["id"])
    existing = one_or_404(
        service.get(
            "invitations",
            params={
                "id": f"eq.{invitation_id}",
                "select": "id,workspace_id,email,role_key,expires_at,accepted_at,revoked_at,created_at,invited_by,workspaces(name)",
            },
        )
    )
    if existing.get("accepted_at"):
        raise ApiError(409, "INVITE_ALREADY_ACCEPTED", MESSAGES["INVITE_ALREADY_ACCEPTED"])
    if existing.get("revoked_at"):
        ws = _nested(existing.get("workspaces")) or {}
        return _serialize_admin_invite(existing, workspace_name=ws.get("name"))
    row = patched_or_403(
        service.patch(
            "invitations",
            {"revoked_at": _now()},
            params={
                "id": f"eq.{invitation_id}",
                "select": "id,workspace_id,email,role_key,expires_at,accepted_at,revoked_at,created_at,invited_by",
            },
        )
    )
    write_platform_admin_event(
        service,
        actor_user_id=user["id"],
        action="admin_invitation_revoked",
        target_workspace_id=str(row["workspace_id"]),
        metadata={"invitation_id": str(invitation_id), "email": row.get("email"), "role_key": row.get("role_key")},
    )
    ws = _nested(existing.get("workspaces")) or {}
    return _serialize_admin_invite(row, workspace_name=ws.get("name"))


@router.post("/invitations/{invitation_id}/reissue")
def reissue_admin_invitation(
    invitation_id: UUID,
    service: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
):
    """Revoke pending invite (if any) and create a replacement with a new token."""
    require_platform_admin(service, user["id"])
    existing = one_or_404(
        service.get(
            "invitations",
            params={
                "id": f"eq.{invitation_id}",
                "select": "id,workspace_id,email,role_key,accepted_at,revoked_at",
            },
        )
    )
    if existing.get("accepted_at"):
        raise ApiError(409, "INVITE_ALREADY_ACCEPTED", MESSAGES["INVITE_ALREADY_ACCEPTED"])
    if not existing.get("revoked_at"):
        service.patch(
            "invitations",
            {"revoked_at": _now()},
            params={"id": f"eq.{invitation_id}"},
        )
        write_platform_admin_event(
            service,
            actor_user_id=user["id"],
            action="admin_invitation_revoked",
            target_workspace_id=str(existing["workspace_id"]),
            metadata={"invitation_id": str(invitation_id), "reason": "reissue"},
        )
    return create_admin_invitation(
        AdminInviteCreate(
            workspace_id=UUID(str(existing["workspace_id"])),
            email=str(existing["email"]),
            role_key=str(existing["role_key"]),  # type: ignore[arg-type]
        ),
        service,
        user,
    )
