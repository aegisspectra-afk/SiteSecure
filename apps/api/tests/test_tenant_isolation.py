"""Live tenant isolation using authenticated user JWTs — never the service role."""

from __future__ import annotations

import os
import uuid

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


def _new_workspace(token: str, name: str) -> str:
    api = TestClient(app)
    res = api.post(
        "/api/v1/workspaces",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": name},
    )
    assert res.status_code == 200, res.text
    return res.json()["id"]


def test_owner_can_invite_founding_technician(settings, two_tenants):
    api = TestClient(app)
    workspace_id = _new_workspace(two_tenants["token_a"], f"FT Invite {uuid.uuid4().hex[:8]}")
    res = api.post(
        f"/api/v1/workspaces/{workspace_id}/invitations",
        headers={"Authorization": f"Bearer {two_tenants['token_a']}"},
        json={"email": f"ss.phase3.ft.{uuid.uuid4().hex[:8]}@sitesecure.test", "role_key": "founding_technician"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["role_key"] == "founding_technician"
    assert res.json()["token"]


def test_invite_defaults_to_technician(settings, two_tenants):
    api = TestClient(app)
    workspace_id = _new_workspace(two_tenants["token_a"], f"Default Invite {uuid.uuid4().hex[:8]}")
    res = api.post(
        f"/api/v1/workspaces/{workspace_id}/invitations",
        headers={"Authorization": f"Bearer {two_tenants['token_a']}"},
        json={"email": f"ss.phase3.default.{uuid.uuid4().hex[:8]}@sitesecure.test"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["role_key"] == "technician"


def test_solo_field_seat_limit_reached(settings, two_tenants):
    api = TestClient(app)
    token = two_tenants["token_a"]
    workspace_id = _new_workspace(token, f"Seat Limit {uuid.uuid4().hex[:8]}")
    for index in range(3):
        res = api.post(
            f"/api/v1/workspaces/{workspace_id}/invitations",
            headers={"Authorization": f"Bearer {token}"},
            json={"email": f"ss.limit.{index}.{uuid.uuid4().hex[:8]}@sitesecure.test", "role_key": "technician"},
        )
        assert res.status_code == 200, res.text
    blocked = api.post(
        f"/api/v1/workspaces/{workspace_id}/invitations",
        headers={"Authorization": f"Bearer {token}"},
        json={"email": f"ss.limit.full.{uuid.uuid4().hex[:8]}@sitesecure.test", "role_key": "technician"},
    )
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "PLAN_LIMIT_REACHED"
    assert blocked.json()["error"]["details"]["limit_key"] == "seats_field"


def test_duplicate_pending_invite_is_rejected(settings, two_tenants):
    api = TestClient(app)
    token = two_tenants["token_a"]
    workspace_id = _new_workspace(token, f"Dup Invite {uuid.uuid4().hex[:8]}")
    email = f"ss.dup.{uuid.uuid4().hex[:8]}@sitesecure.test"
    first = api.post(
        f"/api/v1/workspaces/{workspace_id}/invitations",
        headers={"Authorization": f"Bearer {token}"},
        json={"email": email, "role_key": "technician"},
    )
    assert first.status_code == 200, first.text
    usage = api.get(
        f"/api/v1/workspaces/{workspace_id}/usage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert usage.status_code == 200, usage.text
    field = next(row for row in usage.json()["meters"] if row["key"] == "seats_field")
    assert field["current"] == 1
    assert field["occupants"][0]["email"] == email
    assert field["occupants"][0]["kind"] == "invite"
    office = next(row for row in usage.json()["meters"] if row["key"] == "seats_operator")
    assert all(row["role_key"] != "owner" for row in field["occupants"])
    assert any(row["role_key"] == "owner" for row in office["occupants"])
    second = api.post(
        f"/api/v1/workspaces/{workspace_id}/invitations",
        headers={"Authorization": f"Bearer {token}"},
        json={"email": email.upper(), "role_key": "technician"},
    )
    assert second.status_code == 403
    assert second.json()["error"]["code"] == "INVITE_ALREADY_PENDING"
    again = api.get(
        f"/api/v1/workspaces/{workspace_id}/usage",
        headers={"Authorization": f"Bearer {token}"},
    )
    field_again = next(row for row in again.json()["meters"] if row["key"] == "seats_field")
    assert field_again["current"] == 1


def test_cannot_invite_owner_role(settings, two_tenants):
    api = TestClient(app)
    res = api.post(
        f"/api/v1/workspaces/{two_tenants['ws_a']}/invitations",
        headers={"Authorization": f"Bearer {two_tenants['token_a']}"},
        json={"email": "ss.phase3.owner.invite@sitesecure.test", "role_key": "owner"},
    )
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "BUSINESS_RULE"


def test_create_workspace_assigns_owner(settings, two_tenants):
    api = TestClient(app)
    session = api.get(
        "/api/v1/auth/session",
        headers={"Authorization": f"Bearer {two_tenants['token_a']}"},
    )
    assert session.status_code == 200
    membership = next(m for m in session.json()["memberships"] if m["workspace_id"] == two_tenants["ws_a"])
    assert membership["role_key"] == "owner"


def test_owner_usage_meters_are_catalog_seats(settings, two_tenants):
    api = TestClient(app)
    res = api.get(
        f"/api/v1/workspaces/{two_tenants['ws_a']}/usage",
        headers={"Authorization": f"Bearer {two_tenants['token_a']}"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["plan_key"] == "solo"
    assert body["active_members"] >= 1
    keys = {row["key"] for row in body["meters"]}
    # Catalog meters: seat buckets + storage entitlement (see workspace_meters / test_limits).
    assert keys == {"seats_operator", "seats_field", "storage_gb"}
    office = next(row for row in body["meters"] if row["key"] == "seats_operator")
    assert office["current"] >= 1
    assert office["limit"] == 1
    assert office["current"] == len(office["occupants"])
    assert all(row["kind"] in {"member", "invite"} for row in office["occupants"])
    field = next(row for row in body["meters"] if row["key"] == "seats_field")
    assert field["current"] == len(field["occupants"])
    storage = next(row for row in body["meters"] if row["key"] == "storage_gb")
    assert storage["unit"] == "bytes"
    assert storage["current"] >= 0
    assert isinstance(storage["limit"], int)


def test_self_role_change_denied(settings, two_tenants):
    api = TestClient(app)
    members = api.get(
        f"/api/v1/workspaces/{two_tenants['ws_a']}/members",
        headers={"Authorization": f"Bearer {two_tenants['token_a']}"},
    )
    assert members.status_code == 200, members.text
    rows = members.json()
    assert any(row.get("email") for row in rows)
    me = next(row for row in rows if row["user_id"] and row["role_key"] == "owner")
    denied = api.patch(
        f"/api/v1/workspaces/{two_tenants['ws_a']}/members/{me['id']}",
        headers={"Authorization": f"Bearer {two_tenants['token_a']}"},
        json={"role_key": "technician"},
    )
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "BUSINESS_RULE"


def test_technician_cannot_list_members_or_audit(settings, two_tenants):
    _ensure_member(settings, two_tenants["token_a"], two_tenants["ws_a"], TECH_ID, "technician")
    tech_token = _password_grant(settings, "ss.phase3.tech@sitesecure.test", two_tenants["password"])
    api = TestClient(app)
    members = api.get(
        f"/api/v1/workspaces/{two_tenants['ws_a']}/members",
        headers={"Authorization": f"Bearer {tech_token}"},
    )
    assert members.status_code == 403
    usage = api.get(
        f"/api/v1/workspaces/{two_tenants['ws_a']}/usage",
        headers={"Authorization": f"Bearer {tech_token}"},
    )
    assert usage.status_code == 403
    audit = api.get(
        f"/api/v1/workspaces/{two_tenants['ws_a']}/audit",
        headers={"Authorization": f"Bearer {tech_token}"},
    )
    assert audit.status_code == 403
    with httpx.Client(timeout=30) as client:
        mutated = client.patch(
            f"{settings.supabase_url}/rest/v1/workspace_memberships",
            headers=_auth_headers(settings, tech_token),
            params={"id": f"eq.{TECH_ID}"},
            json={"role_key": "owner"},
        )
    assert mutated.status_code in {200, 204, 401, 403, 404}
    if mutated.status_code in {200, 204}:
        body = mutated.json() if mutated.content else []
        assert body in ([], None) or body == []


def test_write_audit_log_member_only(settings, two_tenants):
    ok = _rpc(
        settings,
        two_tenants["token_a"],
        "write_audit_log",
        {
            "p_workspace_id": two_tenants["ws_a"],
            "p_action": "users.manage",
            "p_entity_type": "membership",
            "p_metadata": {"result": "success"},
        },
    )
    assert ok.status_code == 200, ok.text
    denied = _rpc(
        settings,
        two_tenants["token_b"],
        "write_audit_log",
        {
            "p_workspace_id": two_tenants["ws_a"],
            "p_action": "users.manage",
            "p_metadata": {"result": "denied"},
        },
    )
    assert denied.status_code >= 400
    assert "PERMISSION_DENIED" in denied.text or denied.status_code in {401, 403}

