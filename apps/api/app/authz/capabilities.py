"""Plan capability gates (C1 / §8) — boolean modules beyond RBAC features.

Canonical keys: free / pro / business / enterprise.
Legacy plan key ``solo`` resolves as ``free``.
Denied capabilities raise HTTP 409 with upgrade_required + «שדרג».
"""
from __future__ import annotations

from typing import Any

from .catalog import load_catalog
from .types import AuthzContext, Decision

# Master Brief §8 capability matrix.
PLAN_CAPABILITIES: tuple[str, ...] = (
    "quotes.alternatives",
    "branding.custom_handover",
    "comms.whatsapp",
    "quotes.sales_tracking",
    "field.technicians",
    "field.dispatch",
    "jobs.checklist",
    "sites.dossier",
    "service.reminders",
    "quotes.profitability",
)

_UPGRADE_MSG = "היכולת אינה כלולה בתוכנית — שדרגו כדי להמשיך"


def normalize_plan_key(plan_key: str | None) -> str:
    key = (plan_key or "free").strip().lower() or "free"
    if key == "solo":
        return "free"
    return key


def plan_capability_enabled(plan_key: str | None, capability_key: str) -> bool:
    """True when the plan enables the capability. Missing row = deny."""
    key = normalize_plan_key(plan_key)
    caps = load_catalog().get("_plan_capabilities") or {}
    plan_caps = caps.get(key) or caps.get(plan_key or "") or {}
    if not isinstance(plan_caps, dict):
        return False
    raw = plan_caps.get(capability_key)
    if isinstance(raw, dict):
        return bool(raw.get("enabled"))
    if isinstance(raw, bool):
        return raw
    return False


def evaluate_capability(ctx: AuthzContext, capability_key: str) -> Decision:
    plan_key = normalize_plan_key(getattr(ctx, "plan_key", None))
    if plan_capability_enabled(plan_key, capability_key):
        return Decision(True)
    return Decision(
        False,
        "PLAN_LIMIT_REACHED",
        _UPGRADE_MSG,
        {
            "resource": "capability",
            "capability": capability_key,
            "capability_key": capability_key,
            "plan_key": plan_key,
            "upgrade_required": True,
            "required_plan_hint": "pro" if capability_key.startswith(("quotes.alternatives", "branding.", "comms.", "quotes.sales")) else "business",
            "message": "שדרג",
            "hint": "שדרג",
        },
    )


def require_capability(ctx: AuthzContext, capability_key: str) -> None:
    from .limits import raise_plan_limit

    decision = evaluate_capability(ctx, capability_key)
    raise_plan_limit(decision)


def capability_matrix() -> dict[str, dict[str, bool]]:
    """plan_key → capability → enabled (tests / billing UI)."""
    out: dict[str, dict[str, bool]] = {}
    for plan in ("free", "pro", "business", "enterprise"):
        out[plan] = {cap: plan_capability_enabled(plan, cap) for cap in PLAN_CAPABILITIES}
    return out


def plan_limits_snapshot(plan_key: str | None) -> dict[str, Any]:
    """Normalized limits for the plan (solo → free)."""
    key = normalize_plan_key(plan_key)
    limits = (load_catalog().get("_plan_limits") or {}).get(key) or {}
    return dict(limits) if isinstance(limits, dict) else {}
