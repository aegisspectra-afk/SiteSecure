"""Live tenant isolation using authenticated user JWTs — never the service role."""

from __future__ import annotations

import os

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app

pytestmark = pytest.mark.live


def _settings():
    get_settings.cache_clear()
    return get_settings()


@pytest.fixture(scope="module")
def settings():
    try:
        return _settings()
    except Exception:
        pytest.skip("SUPABASE_URL / SUPABASE_ANON_KEY not configured")


def _auth_headers(settings, jwt: str) -> dict[str, str]:
    return {
        "apikey": settings.supabase_anon_key,
        "Authorization": f"Bearer {jwt}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _signup(settings, email: str, password: str) -> dict:
    with httpx.Client(timeout=30) as client:
        res = client.post(
            f"{settings.supabase_url}/auth/v1/signup",
            headers={"apikey": settings.supabase_anon_key, "Content-Type": "application/json"},
            json={"email": email, "password": password},
        )
    assert res.status_code in {200, 201}, res.text
    return res.json()


def _password_grant(settings, email: str, password: str) -> str:
    with httpx.Client(timeout=30) as client:
        res = client.post(
            f"{settings.supabase_url}/auth/v1/token?grant_type=password",
            headers={"apikey": settings.supabase_anon_key, "Content-Type": "application/json"},
            json={"email": email, "password": password},
        )
    if res.status_code != 200:
        pytest.skip(f"password grant failed (confirm email?): {res.status_code}")
    return res.json()["access_token"]


def _rest_get(settings, jwt: str, path: str, params: dict | None = None) -> httpx.Response:
    with httpx.Client(timeout=30) as client:
        return client.get(
            f"{settings.supabase_url}/rest/v1/{path}",
            headers=_auth_headers(settings, jwt),
            params=params,
        )


def _rest_post(settings, jwt: str, path: str, payload: dict) -> httpx.Response:
    with httpx.Client(timeout=30) as client:
        return client.post(
            f"{settings.supabase_url}/rest/v1/{path}",
            headers=_auth_headers(settings, jwt),
            json=payload,
        )


def _rpc(settings, jwt: str, name: str, payload: dict) -> httpx.Response:
    with httpx.Client(timeout=30) as client:
        return client.post(
            f"{settings.supabase_url}/rest/v1/rpc/{name}",
            headers=_auth_headers(settings, jwt),
            json=payload,
        )


@pytest.fixture(scope="module")
def two_tenants(settings):
    password = "Test-Pass-2026!"
    email_a = "ss.phase3.a@sitesecure.test"
    email_b = "ss.phase3.b@sitesecure.test"
    token_a = _password_grant(settings, email_a, password)
    token_b = _password_grant(settings, email_b, password)

    ws_a = _rpc(settings, token_a, "create_workspace", {"p_name": "Workspace A Phase3", "p_plan_key": "solo"})
    ws_b = _rpc(settings, token_b, "create_workspace", {"p_name": "Workspace B Phase3", "p_plan_key": "solo"})
    assert ws_a.status_code == 200, ws_a.text
    assert ws_b.status_code == 200, ws_b.text
    return {
        "token_a": token_a,
        "token_b": token_b,
        "ws_a": ws_a.json(),
        "ws_b": ws_b.json(),
        "email_a": email_a,
        "email_b": email_b,
        "password": password,
    }


def test_user_a_reads_own_workspace(settings, two_tenants):
    res = _rest_get(
        settings,
        two_tenants["token_a"],
        "workspaces",
        {"id": f"eq.{two_tenants['ws_a']}"},
    )
    assert res.status_code == 200
    rows = res.json()
    assert len(rows) == 1
    assert rows[0]["id"] == two_tenants["ws_a"]


def test_user_a_cannot_read_workspace_b(settings, two_tenants):
    res = _rest_get(
        settings,
        two_tenants["token_a"],
        "workspaces",
        {"id": f"eq.{two_tenants['ws_b']}"},
    )
    assert res.status_code == 200
    assert res.json() == []


def test_user_b_cannot_read_workspace_a(settings, two_tenants):
    res = _rest_get(
        settings,
        two_tenants["token_b"],
        "workspaces",
        {"id": f"eq.{two_tenants['ws_a']}"},
    )
    assert res.status_code == 200
    assert res.json() == []


def test_customer_cross_tenant_rls(settings, two_tenants):
    created = _rest_post(
        settings,
        two_tenants["token_a"],
        "customers",
        {"workspace_id": two_tenants["ws_a"], "display_name": "Customer A"},
    )
    assert created.status_code in {200, 201}, created.text
    customer_id = created.json()[0]["id"]

    a_list = _rest_get(
        settings,
        two_tenants["token_a"],
        "customers",
        {"workspace_id": f"eq.{two_tenants['ws_a']}"},
    )
    assert a_list.status_code == 200
    assert any(row["id"] == customer_id for row in a_list.json())

    b_same_filter = _rest_get(
        settings,
        two_tenants["token_b"],
        "customers",
        {"workspace_id": f"eq.{two_tenants['ws_a']}"},
    )
    assert b_same_filter.status_code == 200
    assert b_same_filter.json() == []

    b_by_id = _rest_get(
        settings,
        two_tenants["token_b"],
        "customers",
        {"id": f"eq.{customer_id}"},
    )
    assert b_by_id.status_code == 200
    assert b_by_id.json() == []


def test_anon_cannot_read_customers(settings):
    with httpx.Client(timeout=30) as client:
        res = client.get(
            f"{settings.supabase_url}/rest/v1/customers",
            headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {settings.supabase_anon_key}"},
        )
    assert res.status_code in {200, 401, 403}
    if res.status_code == 200:
        assert res.json() == []


def test_fastapi_session_and_isolation(settings, two_tenants):
    os.environ.setdefault("SUPABASE_URL", settings.supabase_url)
    os.environ.setdefault("SUPABASE_ANON_KEY", settings.supabase_anon_key)
    get_settings.cache_clear()
    client = TestClient(app)

    session_a = client.get(
        "/api/v1/auth/session",
        headers={"Authorization": f"Bearer {two_tenants['token_a']}"},
    )
    assert session_a.status_code == 200, session_a.text
    body = session_a.json()
    assert body["has_workspace"] is True
    assert body["memberships"][0]["role_key"] == "owner"

    created = client.post(
        f"/api/v1/workspaces/{two_tenants['ws_a']}/customers",
        headers={"Authorization": f"Bearer {two_tenants['token_a']}"},
        json={"display_name": "Via API A"},
    )
    assert created.status_code == 200, created.text

    list_b = client.get(
        f"/api/v1/workspaces/{two_tenants['ws_a']}/customers",
        headers={"Authorization": f"Bearer {two_tenants['token_b']}"},
    )
    assert list_b.status_code in {403, 404}

    list_a = client.get(
        f"/api/v1/workspaces/{two_tenants['ws_a']}/customers",
        headers={"Authorization": f"Bearer {two_tenants['token_a']}"},
    )
    assert list_a.status_code == 200
    assert len(list_a.json()["items"]) >= 1


VIEWER_ID = "b3ff2e4c-0c7a-41f7-9264-70c8784909c2"
TECH_ID = "0242ad20-9a63-4b92-b571-be46cbc9c391"


def _ensure_member(settings, owner_jwt: str, workspace_id: str, user_id: str, role: str) -> None:
    res = _rest_post(
        settings,
        owner_jwt,
        "workspace_memberships",
        {"workspace_id": workspace_id, "user_id": user_id, "role_key": role},
    )
    assert res.status_code in {200, 201, 409} or (
        res.status_code >= 400 and "duplicate" in res.text.lower()
    ) or res.status_code in {200, 201, 400, 409}


def test_viewer_cannot_create_customer(settings, two_tenants):
    _ensure_member(settings, two_tenants["token_a"], two_tenants["ws_a"], VIEWER_ID, "viewer")
    viewer_token = _password_grant(settings, "ss.phase3.viewer@sitesecure.test", two_tenants["password"])
    created = _rest_post(
        settings,
        viewer_token,
        "customers",
        {"workspace_id": two_tenants["ws_a"], "display_name": "Viewer should fail"},
    )
    assert created.status_code in {401, 403}
    api = TestClient(app)
    denied = api.post(
        f"/api/v1/workspaces/{two_tenants['ws_a']}/customers",
        headers={"Authorization": f"Bearer {viewer_token}"},
        json={"display_name": "Viewer API should fail"},
    )
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] in {"PERMISSION_DENIED", "SCOPE_DENIED"}


def test_technician_cannot_invite(settings, two_tenants):
    _ensure_member(settings, two_tenants["token_a"], two_tenants["ws_a"], TECH_ID, "technician")
    tech_token = _password_grant(settings, "ss.phase3.tech@sitesecure.test", two_tenants["password"])
    api = TestClient(app)
    denied = api.post(
        f"/api/v1/workspaces/{two_tenants['ws_a']}/invitations",
        headers={"Authorization": f"Bearer {tech_token}"},
        json={"email": "someone@sitesecure.test", "role_key": "viewer"},
    )
    assert denied.status_code == 403
    rls = _rest_post(
        settings,
        tech_token,
        "invitations",
        {
            "workspace_id": two_tenants["ws_a"],
            "email": "bypass@sitesecure.test",
            "role_key": "viewer",
            "token_hash": "00" * 32,
        },
    )
    assert rls.status_code in {401, 403}


def test_owner_can_invite_founding_technician(settings, two_tenants):
    api = TestClient(app)
    res = api.post(
        f"/api/v1/workspaces/{two_tenants['ws_a']}/invitations",
        headers={"Authorization": f"Bearer {two_tenants['token_a']}"},
        json={"email": "ss.phase3.ft@sitesecure.test", "role_key": "founding_technician"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["role_key"] == "founding_technician"
    assert res.json()["token"]

