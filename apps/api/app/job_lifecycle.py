"""Server-authoritative job status transitions for field dispatch."""

from __future__ import annotations

from typing import Final

from .errors import ApiError

# Logical "assigned" = scheduled/open + assignments row (not a separate enum value).
JOB_STATUSES: Final[frozenset[str]] = frozenset(
    {
        "scheduled",
        "en_route",
        "arrived",
        "in_progress",
        "completed",
        "cancelled",
        "blocked",
    }
)

OPEN_JOB_STATUSES: Final[frozenset[str]] = frozenset(
    {"scheduled", "en_route", "arrived", "in_progress", "blocked"}
)

# action -> (from_statuses, to_status)
TRANSITION_MATRIX: Final[dict[str, tuple[frozenset[str], str]]] = {
    "en_route": (frozenset({"scheduled"}), "en_route"),
    "arrived": (frozenset({"en_route"}), "arrived"),
    "start": (frozenset({"arrived", "en_route"}), "in_progress"),  # en_route allowed for legacy
    "complete": (frozenset({"in_progress"}), "completed"),
    "block": (frozenset({"in_progress", "arrived", "en_route"}), "blocked"),
    "unblock": (frozenset({"blocked"}), "in_progress"),
    "cancel": (frozenset({"scheduled", "en_route", "arrived", "in_progress", "blocked"}), "cancelled"),
}


def assert_transition(action: str, current_status: str) -> str:
    """Return target status or raise BUSINESS_RULE."""
    spec = TRANSITION_MATRIX.get(action)
    if spec is None:
        raise ApiError(400, "VALIDATION_ERROR", "פעולת סטטוס לא מוכרת")
    allowed_from, target = spec
    if current_status not in allowed_from:
        raise ApiError(
            400,
            "BUSINESS_RULE",
            f"לא ניתן לבצע '{action}' ממצב '{current_status}'",
            details={"from": current_status, "action": action, "allowed_from": sorted(allowed_from)},
        )
    return target
