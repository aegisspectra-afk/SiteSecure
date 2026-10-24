"""Product enablement helpers — plan eligibility vs workspace overrides.

Effective access is COALESCE(override, plan feature under an active subscription),
matching ``my_workspace_entitlements`` (0041). Catalog is labels/known-key metadata
only and must not decide enablement by itself.
"""

from __future__ import annotations

from typing import Any

from .authz.catalog import load_catalog

# Same statuses as 0041 my_workspace_entitlements / authorize().
ACTIVE_ENTITLEMENT_STATUSES = frozenset({"trialing", "active", "manual"})

# Products that remain on whenever the plan includes them (not workspace-toggleable).
LOCKED_FEATURES: frozenset[str] = frozenset(
    {
        "core",
        "crm",
        "sales",
        "catalog",
        "quotes",
        "projects",
        "service",
        "settings",
    }
)

# Optional products seeded disabled for new Solo workspaces (API create path).
SOLO_DEFAULT_DISABLED: frozenset[str] = frozenset({"fleet", "ssp", "workforce"})


def known_feature_keys() -> frozenset[str]:
    catalog = load_catalog()
    return frozenset(catalog.get("features") or ())


def plan_eligible_features_catalog(plan_key: str) -> frozenset[str]:
    """Catalog mirror of plan defaults — not an access decision."""
    catalog = load_catalog()
    return frozenset(catalog.get("_plan_features", {}).get(plan_key) or ())


# Back-compat alias used by older unit tests / callers. Not for authorize().
def plan_eligible_features(plan_key: str) -> frozenset[str]:
    return plan_eligible_features_catalog(plan_key)


def is_toggleable(feature_key: str, *, known: frozenset[str] | None = None) -> bool:
    registry = known if known is not None else known_feature_keys()
    return feature_key in registry and feature_key not in LOCKED_FEATURES


def validate_override_request(
    *,
    feature_key: str,
    enabled: bool,
    plan_key: str,
    plan_eligible: frozenset[str] | None = None,
    known: frozenset[str] | None = None,
) -> str | None:
    """Return an error code, or None if the request is allowed.

    plan_eligible is required for enable/disable decisions (DB plan_features).
    Omitting it fails closed — catalog plan lists are not a substitute.
    """
    _ = plan_key  # kept for callers; eligibility is plan_eligible only
    registry = known if known is not None else known_feature_keys()
    if feature_key not in registry:
        return "UNKNOWN_FEATURE"
    if not is_toggleable(feature_key, known=registry):
        return "FEATURE_NOT_TOGGLEABLE"
    if plan_eligible is None:
        return "FEATURE_NOT_IN_PLAN"
    if enabled and feature_key not in plan_eligible:
        return "FEATURE_NOT_IN_PLAN"
    if not enabled and feature_key not in plan_eligible:
        # Disabling a non-plan feature is a no-op cleanup; allow explicit disable.
        return None
    return None


def effective_enabled(
    *,
    feature_key: str,
    plan_eligible: frozenset[str],
    override: bool | None,
    subscription_status: str = "active",
) -> bool:
    """COALESCE(override, plan includes feature under an active subscription)."""
    if override is not None:
        return bool(override)
    if subscription_status not in ACTIVE_ENTITLEMENT_STATUSES:
        return False
    return feature_key in plan_eligible


def effective_feature_set(
    *,
    plan_eligible: frozenset[str],
    overrides: dict[str, bool],
    subscription_status: str = "active",
    feature_keys: frozenset[str] | None = None,
) -> frozenset[str]:
    """Workspace-scoped effective features. Same boolean as 0041 my_workspace_entitlements."""
    keys = feature_keys if feature_keys is not None else (plan_eligible | frozenset(overrides))
    return frozenset(
        key
        for key in keys
        if key
        and effective_enabled(
            feature_key=key,
            plan_eligible=plan_eligible,
            override=overrides[key] if key in overrides else None,
            subscription_status=subscription_status,
        )
    )


def required_solo_disable_keys(plan_eligible: frozenset[str]) -> frozenset[str]:
    """Solo defaults to disable only when the product is actually plan-eligible."""
    return frozenset(k for k in SOLO_DEFAULT_DISABLED if k in plan_eligible)


def product_rows(
    *,
    plan_key: str,
    plan_eligible: frozenset[str],
    effective_features: frozenset[str],
    overrides: dict[str, bool],
) -> list[dict[str, Any]]:
    """List toggleable products relevant to this workspace (eligible and/or overridden)."""
    keys = sorted(
        {
            *(k for k in plan_eligible if is_toggleable(k)),
            *(k for k in overrides if is_toggleable(k)),
            *(k for k in SOLO_DEFAULT_DISABLED if is_toggleable(k) and k in plan_eligible),
        }
    )
    rows: list[dict[str, Any]] = []
    for key in keys:
        override = overrides[key] if key in overrides else None
        rows.append(
            {
                "feature_key": key,
                "eligible": key in plan_eligible,
                "enabled": key in effective_features,
                "override_enabled": override,
                "toggleable": is_toggleable(key) and key in plan_eligible,
            }
        )
    return rows
