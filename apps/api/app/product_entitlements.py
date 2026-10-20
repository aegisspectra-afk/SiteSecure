"""Product enablement helpers — plan eligibility vs workspace overrides.

Uses existing workspace_feature_overrides + my_workspace_entitlements semantics.
Plan eligibility for enable/disable decisions should use DB plan_features (same
source as entitlements RPC), not catalog alone.
"""

from __future__ import annotations

from typing import Any

from .authz.catalog import load_catalog

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
    """Catalog mirror only — prefer DB plan_features for authorization decisions."""
    catalog = load_catalog()
    return frozenset(catalog.get("_plan_features", {}).get(plan_key) or ())


# Back-compat alias used by older unit tests / callers.
def plan_eligible_features(plan_key: str) -> frozenset[str]:
    return plan_eligible_features_catalog(plan_key)


def is_toggleable(feature_key: str) -> bool:
    return feature_key in known_feature_keys() and feature_key not in LOCKED_FEATURES


def validate_override_request(
    *,
    feature_key: str,
    enabled: bool,
    plan_key: str,
    plan_eligible: frozenset[str] | None = None,
) -> str | None:
    """Return an error code, or None if the request is allowed.

    plan_eligible: authoritative plan feature set (DB plan_features). When omitted,
    falls back to catalog (tests / legacy only).
    """
    if feature_key not in known_feature_keys():
        return "UNKNOWN_FEATURE"
    if not is_toggleable(feature_key):
        return "FEATURE_NOT_TOGGLEABLE"
    eligible = plan_eligible if plan_eligible is not None else plan_eligible_features_catalog(plan_key)
    if enabled and feature_key not in eligible:
        return "FEATURE_NOT_IN_PLAN"
    if not enabled and feature_key not in eligible:
        # Disabling a non-plan feature is a no-op cleanup; allow explicit disable.
        return None
    return None


def effective_enabled(
    *,
    feature_key: str,
    plan_eligible: frozenset[str],
    override: bool | None,
) -> bool:
    """COALESCE(override, plan includes feature) — mirrors auth_feature / entitlements RPC."""
    if override is not None:
        return bool(override)
    return feature_key in plan_eligible


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
