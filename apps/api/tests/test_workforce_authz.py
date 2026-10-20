"""Unit: Workforce Intelligence catalog grants and feature gate."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.authz.catalog import load_catalog
from app.authz.engine import authorize
from app.authz.types import AuthzContext
from app.main import app

load_catalog.cache_clear()


def _ctx(role: str, plan: str = "business", **kwargs) -> AuthzContext:
    from app.authz.catalog import load_catalog

    catalog = load_catalog()
    features = catalog["_plan_features"][plan]
    if "features" in kwargs:
        features = frozenset(kwargs["features"])
    return AuthzContext(
        user_id="user-1",
        workspace_id="ws-1",
        role_key=role,
        workspace_status="active",
        subscription_status="active",
        plan_key=plan,
        features=features,
    )


def test_owner_can_view_workforce_when_entitled():
    d = authorize(ctx=_ctx("owner"), action="workforce.view")
    assert d.allowed is True


def test_owner_blocked_without_feature():
    d = authorize(ctx=_ctx("owner", features={"core", "crm"}), action="workforce.view")
    assert d.allowed is False
    assert d.code == "FEATURE_NOT_INCLUDED"


def test_administrator_can_create_user_permission():
    d = authorize(ctx=_ctx("administrator"), action="workforce.employees.create_user")
    assert d.allowed is True


def test_manager_cannot_publish_or_create_user():
    assert authorize(ctx=_ctx("manager"), action="workforce.employees.manage").allowed is True
    assert authorize(ctx=_ctx("manager"), action="workforce.employees.create_user").allowed is False
    assert authorize(ctx=_ctx("manager"), action="workforce.schedules.publish").allowed is False


def test_technician_has_no_workforce_grants():
    d = authorize(ctx=_ctx("technician"), action="workforce.view")
    assert d.allowed is False
    assert d.code == "PERMISSION_DENIED"


def test_viewer_can_view_not_manage():
    assert authorize(ctx=_ctx("viewer"), action="workforce.employees.view").allowed is True
    assert authorize(ctx=_ctx("viewer"), action="workforce.employees.manage").allowed is False


def test_sales_has_no_workforce_grants():
    d = authorize(ctx=_ctx("sales"), action="workforce.view")
    assert d.allowed is False


def test_technician_cannot_create_workforce_user():
    d = authorize(ctx=_ctx("technician"), action="workforce.employees.create_user")
    assert d.allowed is False
    assert d.code == "PERMISSION_DENIED"


def test_workforce_member_has_portal_only_no_crm():
    ctx = _ctx("workforce_member")
    assert authorize(ctx=ctx, action="workforce.portal.view").allowed is True
    assert authorize(ctx=ctx, action="workforce.employees.create_user").allowed is False
    assert authorize(ctx=ctx, action="crm.view").allowed is False
    assert authorize(ctx=ctx, action="crm.create").allowed is False
    assert authorize(ctx=ctx, action="quotes.view").allowed is False
    assert authorize(ctx=ctx, action="workforce.view").allowed is False


def test_clamp_strips_stale_crm_grants_from_workforce_member():
    from app.workspace_rbac import clamp_workforce_member_grants

    cleaned = clamp_workforce_member_grants(
        ["settings.view", "workforce.portal.view", "crm.view", "crm.create", "quotes.view"],
        role_key="workforce_member",
    )
    assert "crm.view" not in cleaned
    assert "crm.create" not in cleaned
    assert "quotes.view" not in cleaned
    assert "workforce.portal.view" in cleaned


def test_workforce_member_is_not_inviteable():
    from app.routers.workspaces import TEAM_INVITE_ROLES

    assert "workforce_member" not in TEAM_INVITE_ROLES


def test_create_employee_unauthenticated():
    client = TestClient(app)
    secret = "LeakMe99"
    res = client.post(
        "/api/v1/workspaces/00000000-0000-0000-0000-000000000001/workforce/employees",
        json={
            "first_name": "דנה",
            "last_name": "כהן",
            "email": "dana@g1.example",
            "username": "dana.k",
            "password": secret,
        },
    )
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHENTICATED"
    assert secret not in res.text


def test_validation_errors_redact_password_input():
    from app.main import _redact_validation_errors

    out = _redact_validation_errors(
        [{"loc": ("body", "password"), "input": "LeakMe99", "msg": "too short", "ctx": {"password": "LeakMe99"}}]
    )
    assert out[0]["input"] == "[redacted]"
    assert out[0]["ctx"]["password"] == "[redacted]"
    assert "LeakMe99" not in str(out)


def test_openapi_exposes_workforce_create_not_public_register():
    client = TestClient(app)
    paths = client.get("/api/openapi.json").json()["paths"]
    employees = "/api/v1/workspaces/{workspace_id}/workforce/employees"
    assert employees in paths
    assert "post" in paths[employees]
    assert "/register" not in paths
    assert "/api/v1/register" not in paths
