from __future__ import annotations

from fastapi.testclient import TestClient

from app.authz.catalog import load_catalog, resolve_catalog_path
from app.authz.engine import authorize
from app.authz.types import AuthzContext
from app.config import parse_cors_origins
from app.main import app


def _ctx(role: str) -> AuthzContext:
    from app.authz.catalog import load_catalog

    catalog = load_catalog()
    return AuthzContext(
        user_id="u1",
        workspace_id="w1",
        role_key=role,
        workspace_status="active",
        subscription_status="active",
        plan_key="business",
        features=catalog["_plan_features"]["business"],
    )


def test_health():
    client = TestClient(app)
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["ok"] is True
    assert "X-Request-Id" in res.headers


def test_authz_catalog_resolves_from_repo():
    path = resolve_catalog_path()
    assert path.is_file()
    assert path.name == "catalog.json"
    assert "crm.view" in load_catalog()["_grants"]["owner"]


def test_missing_bearer_is_401():
    client = TestClient(app)
    res = client.get("/api/v1/auth/session")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHENTICATED"


def test_role_matrix_server_not_ui():
    assert authorize(ctx=_ctx("owner"), action="users.manage").allowed
    assert not authorize(ctx=_ctx("technician"), action="users.manage").allowed
    assert not authorize(ctx=_ctx("viewer"), action="crm.edit").allowed
    assert authorize(ctx=_ctx("sales"), action="quotes.create").allowed
    assert not authorize(ctx=_ctx("sales"), action="jobs.assign").allowed
    assert authorize(ctx=_ctx("manager"), action="jobs.assign").allowed
    assert not authorize(ctx=_ctx("administrator"), action="workspace.delete").allowed
    assert authorize(ctx=_ctx("owner"), action="workspace.delete").allowed


def test_solo_owner_cannot_view_audit_without_feature():
    catalog = load_catalog()
    ctx = AuthzContext(
        user_id="u1",
        workspace_id="w1",
        role_key="owner",
        workspace_status="active",
        subscription_status="active",
        plan_key="solo",
        features=catalog["_plan_features"]["solo"],
    )
    denied = authorize(ctx=ctx, action="audit.view")
    assert not denied.allowed
    assert denied.code == "FEATURE_NOT_INCLUDED"


def test_cors_staging_excludes_localhost():
    origins = parse_cors_origins("https://staging.example.com", extra="", app_env="staging")
    assert origins == ["https://staging.example.com"]
    assert "http://localhost:5173" not in origins


def test_cors_extra_and_dev_localhost():
    origins = parse_cors_origins(
        "https://app.example.com",
        extra="https://preview.example.com, ",
        app_env="production",
    )
    assert origins == ["https://app.example.com", "https://preview.example.com"]
    dev = parse_cors_origins("http://localhost:5173", app_env="development")
    assert "http://localhost:8081" in dev


def test_cors_preflight_allows_web_origin():
    from app.config import get_settings

    client = TestClient(app)
    origin = get_settings().cors_allow_origins()[0]
    res = client.options(
        "/health",
        headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
    )
    assert res.status_code in {200, 204}
    assert res.headers.get("access-control-allow-origin") == origin


def test_foundation_routes_require_bearer():
    client = TestClient(app)
    ws = "00000000-0000-0000-0000-000000000001"
    for path in (
        f"/api/v1/workspaces/{ws}/members",
        f"/api/v1/workspaces/{ws}/audit",
        f"/api/v1/workspaces/{ws}/security",
        "/api/v1/authz/catalog",
        "/api/v1/me",
        "/api/v1/feedback",
        "/api/v1/feature-flags",
        "/api/v1/admin/summary",
        "/api/v1/admin/organizations",
        "/api/v1/admin/users",
        "/api/v1/admin/feedback",
        "/api/v1/admin/feature-flags",
    ):
        res = client.get(path) if path != "/api/v1/me" else client.patch(path, json={"full_name": "x"})
        assert res.status_code == 401, path
        assert res.json()["error"]["code"] == "UNAUTHENTICATED"
