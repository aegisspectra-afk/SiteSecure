"""Pure helpers for SSP form→site assignments (no DB). Snapshot is frozen at assign time."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

FillBucket = Literal["available", "unfilled", "submitted", "overdue", "upcoming", "paused", "completed"]


def parse_dt(value: object) -> datetime | None:
    if value is None or value == "":
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def classify_assignment(
    *,
    status: str,
    starts_at: object,
    due_at: object,
    has_submission: bool,
    now: datetime | None = None,
) -> FillBucket:
    """Bucket used by the operational site screen and manager metrics."""
    clock = now or datetime.now(timezone.utc)
    if status == "paused":
        return "paused"
    if status in {"completed", "cancelled"}:
        return "completed"
    if has_submission:
        return "submitted"
    start = parse_dt(starts_at)
    due = parse_dt(due_at)
    if start and start > clock:
        return "upcoming"
    if due and due < clock:
        return "overdue"
    return "available"


def duplicate_submit_blocked(
    *,
    filler_mode: str,
    existing_for_assignment: bool,
    existing_for_user: bool,
) -> bool:
    """Once cadence: site-wide one submit, or one submit per authorized user."""
    if filler_mode == "site":
        return existing_for_assignment
    return existing_for_user


def user_may_fill(
    *,
    filler_mode: str,
    user_id: str,
    is_site_member: bool,
    is_manager: bool,
    target_user_ids: set[str],
    user_department_id: str | None,
    assignment_department_id: str | None,
) -> bool:
    if is_manager:
        return True
    if filler_mode == "site":
        return is_site_member
    if filler_mode == "users":
        return user_id in target_user_ids
    if filler_mode == "group":
        if not assignment_department_id:
            return False
        return bool(user_department_id) and str(user_department_id) == str(assignment_department_id)
    return False


def snapshot_uses_assigned_version(
    assignment_version_id: str,
    assignment_snapshot: dict[str, Any] | None,
    latest_published_version_id: str | None,
) -> bool:
    """Publishing a new form version must not silently retarget existing assignments."""
    if not assignment_snapshot:
        return False
    if latest_published_version_id and str(assignment_version_id) == str(latest_published_version_id):
        return True
    return str(assignment_version_id) != str(latest_published_version_id or "")
