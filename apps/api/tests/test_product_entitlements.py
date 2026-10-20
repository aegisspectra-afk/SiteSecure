"""Unit: plan eligibility vs workspace product overrides (no live DB)."""

from __future__ import annotations

from app.authz.engine import authorize
from app.authz.types import AuthzContext
from app.product_entitlements import (
    SOLO_DEFAULT_DISABLED,
    effective_enabled,
    is_toggleable,
    plan_eligible_features_catalog,
    product_rows,
    required_solo_disable_keys,
    validate_override_request,
)


def test_solo_catalog_lists_fleet_and_ssp():
    solo = plan_eligible_features_catalog("solo")
    assert "fleet" in solo
    assert "ssp" in solo
    assert "workforce" in solo
    assert SOLO_DEFAULT_DISABLED <= {"fleet", "ssp", "workforce"}


def test_required_solo_disable_only_when_plan_eligible():
    assert required_solo_disable_keys(frozenset({"core", "quotes"})) == frozenset()
    assert required_solo_disable_keys(frozenset({"fleet", "ssp", "workforce", "core"})) == frozenset(
        {"fleet", "ssp", "workforce"}
    )
    assert required_solo_disable_keys(frozenset({"fleet"})) == frozenset({"fleet"})


def test_core_features_not_toggleable():
    assert is_toggleable("core") is False
    assert is_toggleable("quotes") is False
    assert is_toggleable("fleet") is True
    assert is_toggleable("ssp") is True
    assert is_toggleable("workforce") is True


def test_cannot_enable_product_outside_plan_db_eligible():
    # Catalog may list more; authoritative eligible set excludes inventory.
    err = validate_override_request(
        feature_key="inventory",
        enabled=True,
        plan_key="solo",
        plan_eligible=frozenset({"core", "quotes", "fleet", "ssp"}),
    )
    assert err == "FEATURE_NOT_IN_PLAN"


def test_plan_ineligible_blocked_even_if_catalog_would_allow():
    """M2: DB plan_features win — fleet not in DB eligible → cannot enable."""
    err = validate_override_request(
        feature_key="fleet",
        enabled=True,
        plan_key="solo",
        plan_eligible=frozenset({"core", "quotes"}),  # diverge from catalog solo
    )
    assert err == "FEATURE_NOT_IN_PLAN"


def test_can_enable_fleet_when_db_eligible():
    err = validate_override_request(
        feature_key="fleet",
        enabled=True,
        plan_key="solo",
        plan_eligible=frozenset({"core", "fleet", "ssp"}),
    )
    assert err is None


def test_cannot_toggle_unknown_or_locked():
    assert validate_override_request(feature_key="nope", enabled=True, plan_key="solo") == "UNKNOWN_FEATURE"
    assert validate_override_request(feature_key="core", enabled=False, plan_key="solo") == "FEATURE_NOT_TOGGLEABLE"


def test_effective_enabled_respects_override():
    eligible = frozenset({"fleet", "ssp"})
    assert effective_enabled(feature_key="fleet", plan_eligible=eligible, override=False) is False
    assert effective_enabled(feature_key="fleet", plan_eligible=eligible, override=True) is True
    assert effective_enabled(feature_key="fleet", plan_eligible=eligible, override=None) is True


def test_product_rows_reflect_disable_override():
    rows = product_rows(
        plan_key="solo",
        plan_eligible=frozenset({"core", "quotes", "fleet", "ssp"}),
        effective_features=frozenset({"core", "quotes"}),
        overrides={"fleet": False, "ssp": False},
    )
    by_key = {r["feature_key"]: r for r in rows}
    assert by_key["fleet"]["eligible"] is True
    assert by_key["fleet"]["enabled"] is False
    assert by_key["fleet"]["toggleable"] is True
    assert by_key["ssp"]["enabled"] is False


def test_disable_removes_feature_from_authorize():
    """Disabling an eligible product → FEATURE_NOT_INCLUDED on mapped actions."""
    ctx = AuthzContext(
        user_id="u1",
        workspace_id="w1",
        role_key="owner",
        workspace_status="active",
        subscription_status="active",
        plan_key="solo",
        features=frozenset({"core", "quotes"}),  # fleet/ssp absent after override
        grants=frozenset({"*"}),
    )
    d = authorize(ctx=ctx, action="ssp.forms.view")
    assert d.allowed is False
    assert d.code == "FEATURE_NOT_INCLUDED"
    d2 = authorize(ctx=ctx, action="fleet.view")
    assert d2.allowed is False
    assert d2.code == "FEATURE_NOT_INCLUDED"
