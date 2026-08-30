"""Authorize() treats ctx.features as effective entitlements (RPC-fed)."""

from __future__ import annotations

from app.authz.catalog import load_catalog
from app.authz.engine import authorize
from app.authz.types import AuthzContext, ResourceRef


def _ctx(*, plan: str, features: frozenset[str], role: str = "owner") -> AuthzContext:
    return AuthzContext(
        user_id="u1",
        workspace_id="w1",
        role_key=role,
        workspace_status="active",
        subscription_status="active",
        plan_key=plan,
        features=features,
    )


def test_feature_enabled_allows_entitled_action():
    catalog = load_catalog()
    features = catalog["_plan_features"]["business"]
    d = authorize(ctx=_ctx(plan="business", features=features), action="audit.view")
    assert d.allowed is True


def test_disable_override_shape_blocks_even_with_rbac():
    """Simulate effective features after disable override removed 'audit'."""
    catalog = load_catalog()
    features = frozenset(f for f in catalog["_plan_features"]["business"] if f != "audit")
    d = authorize(ctx=_ctx(plan="business", features=features, role="owner"), action="audit.view")
    assert d.allowed is False
    assert d.code == "FEATURE_NOT_INCLUDED"
    assert d.details.get("feature") == "audit"


def test_enable_override_shape_allows_solo_inventory_when_present():
    catalog = load_catalog()
    solo = set(catalog["_plan_features"]["solo"])
    solo.add("inventory")
    d = authorize(
        ctx=_ctx(plan="solo", features=frozenset(solo), role="owner"),
        action="inventory.view",
    )
    assert d.allowed is True


def test_rbac_denies_even_when_feature_enabled():
    catalog = load_catalog()
    features = catalog["_plan_features"]["business"]
    d = authorize(
        ctx=_ctx(plan="business", features=features, role="viewer"),
        action="users.invite",
    )
    assert d.allowed is False
    assert d.code == "PERMISSION_DENIED"


def test_feature_denies_even_when_rbac_allows():
    """Owner has permission but workspace effective features exclude inventory."""
    catalog = load_catalog()
    features = catalog["_plan_features"]["solo"]  # no inventory
    d = authorize(ctx=_ctx(plan="solo", features=features, role="owner"), action="inventory.view")
    assert d.allowed is False
    assert d.code == "FEATURE_NOT_INCLUDED"


def test_inactive_subscription_still_denied_before_feature():
    catalog = load_catalog()
    features = catalog["_plan_features"]["business"]
    ctx = _ctx(plan="business", features=features)
    ctx = AuthzContext(
        user_id=ctx.user_id,
        workspace_id=ctx.workspace_id,
        role_key=ctx.role_key,
        workspace_status=ctx.workspace_status,
        subscription_status="canceled",
        plan_key=ctx.plan_key,
        features=features,
    )
    d = authorize(ctx=ctx, action="audit.view")
    assert d.allowed is False
    assert d.code == "SUBSCRIPTION_INVALID"
