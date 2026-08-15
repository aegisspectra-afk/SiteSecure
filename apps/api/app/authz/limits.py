from __future__ import annotations

from collections.abc import Iterable

from ..errors import MESSAGES
from .catalog import load_catalog
from .types import Decision


def _deny(code: str, **details: object) -> Decision:
    return Decision(False, code, MESSAGES.get(code, code), details)


def _allow() -> Decision:
    return Decision(True)


def seat_limit_key(role_key: str) -> str | None:
    buckets = load_catalog().get("seat_buckets") or {}
    for limit_key, roles in buckets.items():
        if role_key in roles:
            return str(limit_key)
    return None


def plan_limit_value(plan_key: str, limit_key: str) -> int:
    limits = load_catalog().get("_plan_limits", {}).get(plan_key) or {}
    try:
        return int(limits.get(limit_key, 0))
    except (TypeError, ValueError):
        return 0


def is_unlimited(limit: int) -> bool:
    return limit <= 0


def evaluate_seat_limit(
    *,
    plan_key: str,
    invite_role: str,
    occupied_roles: Iterable[str],
) -> Decision:
    """Catalog-driven seat cap. 0 = unlimited. Does not replace RBAC."""
    bucket = seat_limit_key(invite_role)
    if bucket is None:
        return _allow()
    limit = plan_limit_value(plan_key, bucket)
    if is_unlimited(limit):
        return _allow()
    current = sum(1 for role in occupied_roles if seat_limit_key(role) == bucket)
    if current >= limit:
        return _deny(
            "PLAN_LIMIT_REACHED",
            limit_key=bucket,
            current=current,
            limit=limit,
            plan_key=plan_key,
            invite_role=invite_role,
        )
    return _allow()
