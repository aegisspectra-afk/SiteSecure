"""Unit: SSP manager actions require feature + permission (catalog engine)."""

from __future__ import annotations

from app.authz.catalog import load_catalog
from app.authz.engine import authorize
from app.authz.types import AuthzContext


def _ctx(role: str, plan: str = "business", features: frozenset[str] | None = None) -> AuthzContext:
    catalog = load_catalog()
    feats = features if features is not None else catalog["_plan_features"][plan]
    return AuthzContext(
        user_id="user-1",
        workspace_id="ws-1",
        role_key=role,
        workspace_status="active",
        subscription_status="active",
        plan_key=plan,
        features=feats,
    )


def test_manager_can_manage_forms_when_ssp_entitled():
    ctx = _ctx("manager")
    assert "ssp" in ctx.features
    for action in (
        "ssp.forms.view",
        "ssp.forms.edit",
        "ssp.forms.publish",
        "ssp.assignments.manage",
        "ssp.submissions.view",
    ):
        d = authorize(ctx=ctx, action=action)
        assert d.allowed is True, action


def test_technician_denied_ssp_mutations():
    ctx = _ctx("technician")
    assert authorize(ctx=ctx, action="ssp.forms.edit").allowed is False
    assert authorize(ctx=ctx, action="ssp.forms.publish").allowed is False
    assert authorize(ctx=ctx, action="ssp.assignments.manage").allowed is False
    assert authorize(ctx=ctx, action="ssp.submissions.view").allowed is False


def test_feature_gate_denies_without_ssp_even_for_owner_grants():
    # Owner has "*", but authorize still requires feature mapping when permission_feature is set.
    ctx = _ctx("owner", features=frozenset({"core", "crm", "quotes"}))
    d = authorize(ctx=ctx, action="ssp.forms.view")
    assert d.allowed is False
    assert d.code == "FEATURE_NOT_INCLUDED"


def test_viewer_can_view_not_edit():
    ctx = _ctx("viewer")
    assert authorize(ctx=ctx, action="ssp.forms.view").allowed is True
    assert authorize(ctx=ctx, action="ssp.submissions.view").allowed is True
    assert authorize(ctx=ctx, action="ssp.forms.edit").allowed is False
    assert authorize(ctx=ctx, action="ssp.assignments.manage").allowed is False
