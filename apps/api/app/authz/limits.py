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
            resource=bucket,
            current=current,
            limit=limit,
            plan_key=plan_key,
            invite_role=invite_role,
        )
    return _allow()


_RESOURCE_MESSAGES = {
    "customers": "הגעת למגבלת הלקוחות בתוכנית שלך",
    "quotes": "הגעת למגבלת ההצעות בתוכנית שלך",
    "storage": "אין מספיק שטח אחסון להעלאת הקובץ",
}


def evaluate_count_limit(
    *,
    plan_key: str,
    limit_key: str,
    resource: str,
    current: int,
    requested: int = 1,
) -> Decision:
    """Hard count quota. 0 = unlimited. Blocks when current + requested would exceed limit."""
    limit = plan_limit_value(plan_key, limit_key)
    if is_unlimited(limit):
        return _allow()
    used = max(0, int(current or 0))
    need = max(1, int(requested or 1))
    if used + need > limit:
        return Decision(
            False,
            "PLAN_LIMIT_REACHED",
            _RESOURCE_MESSAGES.get(resource, MESSAGES["PLAN_LIMIT_REACHED"]),
            {
                "resource": resource,
                "limit_key": limit_key,
                "current": used,
                "limit": limit,
                "requested": need,
                "plan_key": plan_key,
            },
        )
    return _allow()


def evaluate_storage_limit(
    *,
    plan_key: str,
    used_bytes: int,
    requested_bytes: int,
) -> Decision:
    """Hard storage quota in bytes. storage_gb 0 = unlimited."""
    limit_gb = plan_limit_value(plan_key, "storage_gb")
    if is_unlimited(limit_gb):
        return _allow()
    limit_bytes = limit_gb * (1024**3)
    used = max(0, int(used_bytes or 0))
    need = max(0, int(requested_bytes or 0))
    if need <= 0:
        return _allow()
    if used + need > limit_bytes:
        return Decision(
            False,
            "PLAN_LIMIT_REACHED",
            _RESOURCE_MESSAGES["storage"],
            {
                "resource": "storage",
                "limit_key": "storage_gb",
                "current": used,
                "limit": limit_bytes,
                "requested": need,
                "plan_key": plan_key,
            },
        )
    return _allow()


def raise_plan_limit(decision: Decision) -> None:
    """Raise ApiError for a denied plan-limit Decision."""
    from ..errors import ApiError

    if decision.allowed:
        return
    raise ApiError(
        403,
        decision.code or "PLAN_LIMIT_REACHED",
        decision.message_he or MESSAGES["PLAN_LIMIT_REACHED"],
        dict(decision.details or {}),
    )
