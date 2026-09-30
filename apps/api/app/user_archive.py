"""Reversible platform user soft-archive helpers (ADMIN-USER-ARCHIVE-1).

Distinct from workspace cold-archive (`archive_*` schema) and from
workspace_memberships.status disable.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .errors import ApiError, MESSAGES
from .rest import as_list
from .supabase_service import ServiceClient

# GoTrue ban_duration: long ban (reversible via "none"). Does NOT delete auth.users.
AUTH_BAN_DURATION = "876600h"

PROFILE_ARCHIVE_SELECT = (
    "id,email,full_name,is_platform_admin,recognition_badges,created_at,"
    "archived_at,archived_by,archive_reason"
)


def profile_lifecycle_status(row: dict[str, Any] | None) -> str:
    if row and row.get("archived_at"):
        return "archived"
    return "active"


def raise_if_archived_profile(row: dict[str, Any] | None) -> None:
    if row and row.get("archived_at"):
        raise ApiError(403, "ACCOUNT_INACTIVE", MESSAGES["ACCOUNT_INACTIVE"])


def fetch_profile_archive_row(service: ServiceClient, user_id: str) -> dict[str, Any] | None:
    rows = as_list(
        service.get(
            "profiles",
            params={"id": f"eq.{user_id}", "select": PROFILE_ARCHIVE_SELECT, "limit": "1"},
        )
    )
    return rows[0] if rows else None


def fetch_profile_by_email(service: ServiceClient, email: str) -> dict[str, Any] | None:
    needle = email.strip().lower()
    if not needle:
        return None
    rows = as_list(
        service.get(
            "profiles",
            params={
                "email": f"eq.{needle}",
                "select": PROFILE_ARCHIVE_SELECT,
                "limit": "1",
            },
        )
    )
    return rows[0] if rows else None


def raise_if_email_archived(service: ServiceClient, email: str) -> None:
    row = fetch_profile_by_email(service, email)
    if row and row.get("archived_at"):
        raise ApiError(403, "USER_ARCHIVED", MESSAGES["USER_ARCHIVED"])


def list_memberships_for_user(service: ServiceClient, user_id: str) -> list[dict[str, Any]]:
    rows = as_list(
        service.get(
            "workspace_memberships",
            params={
                "user_id": f"eq.{user_id}",
                "select": "id,user_id,workspace_id,role_key,status,workspaces(id,name,status)",
                "order": "created_at.desc",
                "limit": "500",
            },
        )
    )
    out: list[dict[str, Any]] = []
    for row in rows:
        nested = row.get("workspaces")
        if isinstance(nested, list):
            nested = nested[0] if nested else None
        ws = nested if isinstance(nested, dict) else {}
        out.append(
            {
                "membership_id": row.get("id"),
                "workspace_id": row.get("workspace_id"),
                "workspace_name": ws.get("name"),
                "workspace_status": ws.get("status"),
                "role_key": row.get("role_key"),
                "status": row.get("status"),
            }
        )
    return out


def orphan_owner_workspace_ids(service: ServiceClient, user_id: str) -> list[dict[str, Any]]:
    """Workspaces that would lose their last active Owner if this user is archived."""
    memberships = list_memberships_for_user(service, user_id)
    orphaned: list[dict[str, Any]] = []
    for m in memberships:
        if str(m.get("status") or "") != "active":
            continue
        if str(m.get("role_key") or "") != "owner":
            continue
        if str(m.get("workspace_status") or "") != "active":
            continue
        ws_id = str(m["workspace_id"])
        owners = as_list(
            service.get(
                "workspace_memberships",
                params={
                    "workspace_id": f"eq.{ws_id}",
                    "role_key": "eq.owner",
                    "status": "eq.active",
                    "select": "user_id",
                    "limit": "50",
                },
            )
        )
        other = [o for o in owners if str(o.get("user_id")) != str(user_id)]
        if not other:
            orphaned.append(
                {
                    "workspace_id": ws_id,
                    "workspace_name": m.get("workspace_name"),
                }
            )
    return orphaned


def suspend_workspaces(service: ServiceClient, workspaces: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Mark workspaces suspended so they are no longer operable without an active Owner."""
    suspended: list[dict[str, Any]] = []
    for row in workspaces:
        ws_id = str(row.get("workspace_id") or "").strip()
        if not ws_id:
            continue
        patched = as_list(
            service.patch(
                "workspaces",
                {"status": "suspended"},
                params={"id": f"eq.{ws_id}", "select": "id,name,status"},
            )
        )
        if not patched:
            raise ApiError(
                502,
                "API_UNAVAILABLE",
                f"לא ניתן להשעות סביבה לפני ארכוב המשתמש: {row.get('workspace_name') or ws_id}",
            )
        suspended.append(
            {
                "workspace_id": patched[0].get("id") or ws_id,
                "workspace_name": patched[0].get("name") or row.get("workspace_name"),
                "workspace_status": patched[0].get("status") or "suspended",
            }
        )
    return suspended


def assert_archive_allowed(
    service: ServiceClient,
    *,
    actor_user_id: str,
    target: dict[str, Any],
) -> list[dict[str, Any]]:
    target_id = str(target["id"])
    if target_id == str(actor_user_id):
        raise ApiError(403, "ARCHIVE_SELF", MESSAGES["ARCHIVE_SELF"])
    if target.get("archived_at"):
        raise ApiError(409, "RESOURCE_STATE", "המשתמש כבר בארכיון")

    if target.get("is_platform_admin"):
        admins = as_list(
            service.get(
                "profiles",
                params={
                    "is_platform_admin": "eq.true",
                    "archived_at": "is.null",
                    "select": "id",
                    "limit": "50",
                },
            )
        )
        others = [a for a in admins if str(a.get("id")) != target_id]
        if not others:
            raise ApiError(403, "ARCHIVE_LAST_ADMIN", MESSAGES["ARCHIVE_LAST_ADMIN"])

    return list_memberships_for_user(service, target_id)


def apply_auth_ban(service: ServiceClient, user_id: str, *, ban: bool) -> None:
    body = {"ban_duration": AUTH_BAN_DURATION if ban else "none"}
    res = service.auth_admin_update_user(user_id, body)
    if res.status_code not in {200, 201}:
        raise ApiError(
            502,
            "API_UNAVAILABLE",
            "לא ניתן לעדכן מצב אימות עבור המשתמש",
            details={"status": res.status_code, "body": (res.text or "")[:240]},
        )


def invalidate_auth_sessions(service: ServiceClient, user_id: str) -> None:
    """Best-effort global logout for the auth user (does not delete the account)."""
    try:
        service.auth_admin_logout_user(user_id)
    except Exception:
        pass


def archive_platform_user(
    service: ServiceClient,
    *,
    actor_user_id: str,
    target_id: str,
    reason: str | None,
) -> dict[str, Any]:
    target = fetch_profile_archive_row(service, target_id)
    if not target:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    # Hard blocks first (self / already archived / last platform admin).
    assert_archive_allowed(service, actor_user_id=actor_user_id, target=target)

    # Sole-owner of active workspaces: suspend those workspaces, then archive the user.
    # Keeps no *active* workspace without an Owner; suspended workspaces are non-operable.
    orphans = orphan_owner_workspace_ids(service, target_id)
    suspended_workspaces = suspend_workspaces(service, orphans) if orphans else []

    memberships = list_memberships_for_user(service, target_id)
    now = datetime.now(timezone.utc).isoformat()
    reason_clean = (reason or "").strip() or None
    if reason_clean and len(reason_clean) > 500:
        reason_clean = reason_clean[:500]

    patched = as_list(
        service.patch(
            "profiles",
            {
                "archived_at": now,
                "archived_by": actor_user_id,
                "archive_reason": reason_clean,
            },
            params={"id": f"eq.{target_id}", "select": PROFILE_ARCHIVE_SELECT},
        )
    )
    if not patched:
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])

    apply_auth_ban(service, target_id, ban=True)
    invalidate_auth_sessions(service, target_id)

    from .platform import write_platform_admin_event

    write_platform_admin_event(
        service,
        actor_user_id=actor_user_id,
        action="platform_user_archived",
        target_user_id=target_id,
        metadata={
            "email": target.get("email"),
            "archive_reason": reason_clean,
            "membership_count": len(memberships),
            "suspended_workspaces": suspended_workspaces[:40],
            "memberships": [
                {
                    "workspace_id": m.get("workspace_id"),
                    "role_key": m.get("role_key"),
                    "status": m.get("status"),
                }
                for m in memberships[:40]
            ],
        },
    )
    row = patched[0]
    return {
        **row,
        "lifecycle_status": "archived",
        "memberships": memberships,
        "suspended_workspaces": suspended_workspaces,
    }


def restore_platform_user(
    service: ServiceClient,
    *,
    actor_user_id: str,
    target_id: str,
) -> dict[str, Any]:
    target = fetch_profile_archive_row(service, target_id)
    if not target:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    if not target.get("archived_at"):
        raise ApiError(409, "RESOURCE_STATE", "המשתמש כבר פעיל")

    patched = as_list(
        service.patch(
            "profiles",
            {
                "archived_at": None,
                "archived_by": None,
                "archive_reason": None,
            },
            params={"id": f"eq.{target_id}", "select": PROFILE_ARCHIVE_SELECT},
        )
    )
    if not patched:
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])

    apply_auth_ban(service, target_id, ban=False)

    memberships = list_memberships_for_user(service, target_id)
    from .platform import write_platform_admin_event

    write_platform_admin_event(
        service,
        actor_user_id=actor_user_id,
        action="platform_user_restored",
        target_user_id=target_id,
        metadata={
            "email": target.get("email"),
            "previous_archived_at": target.get("archived_at"),
            "previous_archive_reason": target.get("archive_reason"),
            "membership_count": len(memberships),
        },
    )
    row = patched[0]
    return {
        **row,
        "lifecycle_status": "active",
        "memberships": memberships,
    }
