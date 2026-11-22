"""Plan capability gates (C1) — boolean modules beyond RBAC features."""

from __future__ import annotations

from .catalog import load_catalog
from .types import AuthzContext, Decision


def plan_capability_enabled(plan_key: str, capability_key: str) -> bool:
    """True when the plan enables the capability. Missing row = deny."""
    caps = load_catalog().get("_plan_capabilities") or {}
    plan_caps = caps.get(plan_key) or {}
    raw = plan_caps.get(capability_key)
    if isinstance(raw, dict):
        return bool(raw.get("enabled"))
    if isinstance(raw, bool):
        return raw
    return False


def evaluate_capability(ctx: AuthzContext, capability_key: str) -> Decision:
    plan_key = str(ctx.plan_key or "")
    if plan_capability_enabled(plan_key, capability_key):
        return Decision(True)
    return Decision(
        False,
        "PLAN_LIMIT_REACHED",
        "היכולת אינה כלולה בתוכנית — שדרגו כדי להמשיך",
        {
            "resource": "capability",
            "capability_key": capability_key,
            "plan_key": plan_key,
            "upgrade_required": True,
            "required_plan_hint": "pro",
        },
    )


def require_capability(ctx: AuthzContext, capability_key: str) -> None:
    from .limits import raise_plan_limit

    decision = evaluate_capability(ctx, capability_key)
    raise_plan_limit(decision)
