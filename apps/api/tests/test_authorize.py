from __future__ import annotations

from app.authz.engine import authorize
from app.authz.types import AuthzContext, ResourceRef


def _ctx(role: str, plan: str = "business", **kwargs) -> AuthzContext:
    from app.authz.catalog import load_catalog

    catalog = load_catalog()
    features = catalog["_plan_features"][plan]
    return AuthzContext(
        user_id="user-1",
        workspace_id="ws-1",
        role_key=role,
        workspace_status="active",
        subscription_status="active",
        plan_key=plan,
        features=features,
        assigned_resource_ids=frozenset(kwargs.get("assigned", ())),
    )


def test_unauthenticated():
    d = authorize(ctx=None, action="crm.view")
    assert d.allowed is False
    assert d.code == "UNAUTHENTICATED"


def test_owner_full():
    d = authorize(ctx=_ctx("owner"), action="workspace.billing")
    assert d.allowed is True


def test_administrator_no_billing():
    d = authorize(ctx=_ctx("administrator"), action="workspace.billing")
    assert d.allowed is False
    assert d.code == "PERMISSION_DENIED"


def test_manager_operational():
    d = authorize(ctx=_ctx("manager"), action="jobs.assign")
    assert d.allowed is True
    d = authorize(ctx=_ctx("manager"), action="users.invite")
    assert d.allowed is False


def test_sales_quotes():
    d = authorize(ctx=_ctx("sales"), action="quotes.send")
    assert d.allowed is True
    d = authorize(ctx=_ctx("sales"), action="quotes.view_cost")
    assert d.allowed is False


def test_technician_cannot_admin():
    d = authorize(ctx=_ctx("technician"), action="users.invite")
    assert d.allowed is False
    d = authorize(ctx=_ctx("technician"), action="jobs.complete")
    assert d.allowed is True


def test_founding_technician_model():
    d = authorize(ctx=_ctx("founding_technician"), action="crm.edit")
    assert d.allowed is True
    d = authorize(ctx=_ctx("founding_technician"), action="quotes.view_cost")
    assert d.allowed is False
    d = authorize(ctx=_ctx("founding_technician"), action="quotes.send")
    assert d.allowed is False
    d = authorize(ctx=_ctx("founding_technician"), action="users.manage")
    assert d.allowed is False
    d = authorize(ctx=_ctx("founding_technician"), action="workspace.billing")
    assert d.allowed is False


def test_viewer_readonly():
    d = authorize(ctx=_ctx("viewer"), action="crm.view")
    assert d.allowed is True
    d = authorize(ctx=_ctx("viewer"), action="crm.create")
    assert d.allowed is False
    d = authorize(ctx=_ctx("viewer"), action="quotes.edit")
    assert d.allowed is False


def test_technician_scope_denied_without_assignment():
    d = authorize(
        ctx=_ctx("technician"),
        action="jobs.complete",
        resource=ResourceRef(type="job", id="job-9", state="in_progress"),
    )
    assert d.allowed is False
    assert d.code == "SCOPE_DENIED"


def test_technician_scope_assigned_job():
    d = authorize(
        ctx=_ctx("technician", assigned=("job-9",)),
        action="jobs.complete",
        resource=ResourceRef(type="job", id="job-9", state="in_progress"),
    )
    assert d.allowed is True


def test_solo_cannot_invite_admin():
    d = authorize(ctx=_ctx("owner", plan="solo"), action="users.invite", invite_role="administrator")
    assert d.allowed is False
    assert d.code == "BUSINESS_RULE"


def test_solo_can_invite_ft():
    d = authorize(ctx=_ctx("owner", plan="solo"), action="users.invite", invite_role="founding_technician")
    assert d.allowed is True


def test_business_can_invite_admin():
    d = authorize(ctx=_ctx("owner", plan="business"), action="users.invite", invite_role="administrator")
    assert d.allowed is True


def test_inventory_feature_gated_on_solo():
    d = authorize(ctx=_ctx("owner", plan="solo"), action="inventory.view")
    assert d.allowed is False
    assert d.code == "FEATURE_NOT_INCLUDED"


def test_quote_locked_state():
    d = authorize(
        ctx=_ctx("sales"),
        action="quotes.edit",
        resource=ResourceRef(type="quote", id="q1", owner_user_id="user-1", state="approved"),
    )
    assert d.allowed is False
    assert d.code == "RESOURCE_STATE"


def test_quote_approved_cannot_be_deleted():
    d = authorize(
        ctx=_ctx("owner"),
        action="quotes.delete",
        resource=ResourceRef(type="quote", id="q1", owner_user_id="user-1", state="approved"),
    )
    assert d.allowed is False
    assert d.code == "RESOURCE_STATE"
    d = authorize(
        ctx=_ctx("owner"),
        action="quotes.delete",
        resource=ResourceRef(type="quote", id="q1", owner_user_id="user-1", state="draft"),
    )
    assert d.allowed is True
    d = authorize(ctx=_ctx("sales"), action="quotes.delete")
    assert d.allowed is False
    assert d.code == "PERMISSION_DENIED"
    d = authorize(
        ctx=_ctx("sales"),
        action="quotes.edit",
        resource=ResourceRef(type="quote", id="q1", owner_user_id="user-1", state="sent"),
    )
    assert d.allowed is False
    assert d.code == "RESOURCE_STATE"
    d = authorize(
        ctx=_ctx("sales"),
        action="quotes.send",
        resource=ResourceRef(type="quote", id="q1", owner_user_id="user-1", state="sent"),
    )
    assert d.allowed is False
    # Capability-only send (no resource) stays allowed — used by share remint / revoke-link.
    assert authorize(ctx=_ctx("sales"), action="quotes.send").allowed is True


def test_quote_revise_from_sent():
    d = authorize(
        ctx=_ctx("sales"),
        action="quotes.create",
        resource=ResourceRef(type="quote_revision", id="q1", owner_user_id="user-1", state="sent"),
    )
    assert d.allowed is True
    d = authorize(
        ctx=_ctx("sales"),
        action="quotes.create",
        resource=ResourceRef(type="quote_revision", id="q1", owner_user_id="user-1", state="draft"),
    )
    assert d.allowed is False
    assert d.code == "RESOURCE_STATE"


FOUNDATION_ACTIONS = (
    "dashboard.view",
    "settings.view",
    "settings.general",
    "workspace.edit",
    "workspace.billing",
    "workspace.delete",
    "users.view",
    "users.invite",
    "users.manage",
    "roles.manage",
    "audit.view",
)

FOUNDATION_MATRIX = {
    "owner": {action: True for action in FOUNDATION_ACTIONS},
    "administrator": {
        "dashboard.view": True,
        "settings.view": True,
        "settings.general": True,
        "workspace.edit": True,
        "workspace.billing": False,
        "workspace.delete": False,
        "users.view": True,
        "users.invite": True,
        "users.manage": True,
        "roles.manage": True,
        "audit.view": True,
    },
    "manager": {
        "dashboard.view": True,
        "settings.view": True,
        "settings.general": True,
        "workspace.edit": False,
        "workspace.billing": False,
        "workspace.delete": False,
        "users.view": True,
        "users.invite": False,
        "users.manage": False,
        "roles.manage": False,
        "audit.view": False,
    },
    "sales": {
        "dashboard.view": True,
        "settings.view": True,
        "settings.general": False,
        "workspace.edit": False,
        "workspace.billing": False,
        "workspace.delete": False,
        "users.view": False,
        "users.invite": False,
        "users.manage": False,
        "roles.manage": False,
        "audit.view": False,
    },
    "technician": {
        "dashboard.view": True,
        "settings.view": True,
        "settings.general": False,
        "workspace.edit": False,
        "workspace.billing": False,
        "workspace.delete": False,
        "users.view": False,
        "users.invite": False,
        "users.manage": False,
        "roles.manage": False,
        "audit.view": False,
    },
    "founding_technician": {
        "dashboard.view": True,
        "settings.view": True,
        "settings.general": True,
        "workspace.edit": False,
        "workspace.billing": False,
        "workspace.delete": False,
        "users.view": False,
        "users.invite": False,
        "users.manage": False,
        "roles.manage": False,
        "audit.view": False,
    },
    "viewer": {
        "dashboard.view": True,
        "settings.view": True,
        "settings.general": False,
        "workspace.edit": False,
        "workspace.billing": False,
        "workspace.delete": False,
        "users.view": False,
        "users.invite": False,
        "users.manage": False,
        "roles.manage": False,
        "audit.view": False,
    },
}


def test_foundation_role_matrix():
    for role, expected in FOUNDATION_MATRIX.items():
        for action, allowed in expected.items():
            decision = authorize(ctx=_ctx(role), action=action)
            assert decision.allowed is allowed, f"{role} {action} expected {allowed} got {decision.code}"


P0_ACTIONS = {
    "owner": {
        "quotes.create": True,
        "quotes.edit": True,
        "quotes.delete": True,
        "quotes.send": True,
        "quotes.view_cost": True,
        "catalog.view": True,
        "catalog.edit": True,
    },
    "administrator": {
        "quotes.create": True,
        "quotes.delete": True,
        "quotes.send": True,
        "quotes.view_cost": True,
        "catalog.edit": True,
    },
    "manager": {
        "quotes.create": True,
        "quotes.delete": True,
        "quotes.send": True,
        "quotes.view_cost": True,
        "catalog.edit": True,
    },
    "sales": {
        "quotes.create": True,
        "quotes.edit": True,
        "quotes.delete": False,
        "quotes.send": True,
        "quotes.view_cost": False,
        "catalog.view": True,
        "catalog.edit": False,
    },
    "technician": {
        "quotes.view": True,
        "quotes.create": False,
        "quotes.edit": False,
        "quotes.delete": False,
        "quotes.send": False,
        "quotes.view_cost": False,
        "catalog.view": True,
        "catalog.edit": False,
    },
    "founding_technician": {
        "quotes.view": True,
        "quotes.create": False,
        "quotes.edit": True,
        "quotes.delete": False,
        "quotes.send": False,
        "catalog.view": True,
        "catalog.edit": False,
    },
    "viewer": {
        "quotes.view": True,
        "quotes.create": False,
        "quotes.edit": False,
        "quotes.delete": False,
        "quotes.send": False,
        "catalog.view": True,
        "catalog.edit": False,
    },
}


def test_p0_quote_catalog_role_matrix():
    for role, expected in P0_ACTIONS.items():
        for action, allowed in expected.items():
            decision = authorize(ctx=_ctx(role), action=action)
            assert decision.allowed is allowed, f"{role} {action} expected {allowed} got {decision.code}"


def test_quotes_entitlement_comes_from_catalog_not_plan_name():
    from dataclasses import replace

    ctx = replace(_ctx("owner", plan="business"), features=frozenset({"core"}))
    d = authorize(ctx=ctx, action="quotes.create")
    assert d.allowed is False
    assert d.code == "FEATURE_NOT_INCLUDED"

