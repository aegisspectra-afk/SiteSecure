"""Patrol run status transitions (pure rules — unit-tested without DB)."""

from __future__ import annotations

from typing import Any

ALLOWED_TRANSITIONS: dict[str, frozenset[str]] = {
    "planned": frozenset({"active", "cancelled"}),
    "active": frozenset({"completed", "late", "cancelled"}),
    "late": frozenset({"completed", "cancelled"}),
    "completed": frozenset(),
    "cancelled": frozenset(),
}


def can_transition(from_status: str, to_status: str) -> bool:
    return to_status in ALLOWED_TRANSITIONS.get(from_status, frozenset())


def assert_transition(from_status: str, to_status: str) -> None:
    from ..errors import ApiError, MESSAGES

    if not can_transition(from_status, to_status):
        raise ApiError(
            400,
            "BUSINESS_RULE",
            f"מעבר סטטוס לא חוקי: {from_status} → {to_status}",
            {"from": from_status, "to": to_status},
        )


def officer_may_act_on_run(
    *,
    product_role: str | None,
    user_id: str,
    assignee_user_ids: list[str],
) -> bool:
    """Managers/admins may act on any in-scope run; officers only if assigned."""
    if product_role in {"org_admin", "patrol_manager"}:
        return True
    if product_role == "patrol_officer":
        return str(user_id) in {str(x) for x in assignee_user_ids}
    # Legacy catalog users without product role: deny run lifecycle mutations
    # (they still use forms via catalog). Managers with catalog-only use edit grant path separately.
    return False


def progress_summary(
    *,
    stop_checkpoint_ids: list[str],
    required_checkpoint_ids: list[str],
    ok_scanned_checkpoint_ids: list[str],
) -> dict[str, Any]:
    stops = list(dict.fromkeys(stop_checkpoint_ids))
    required = set(required_checkpoint_ids) or set(stops)
    scanned = set(ok_scanned_checkpoint_ids)
    done = [c for c in stops if c in scanned]
    missing = [c for c in stops if c in required and c not in scanned]
    return {
        "total_stops": len(stops),
        "required_stops": len(required),
        "completed_stops": len(done),
        "missing_checkpoint_ids": missing,
        "percent": int(round(100 * len(done) / len(stops))) if stops else 0,
    }
