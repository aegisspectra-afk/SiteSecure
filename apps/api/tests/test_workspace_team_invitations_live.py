"""BETA-ADMIN-2: workspace team invitations (owner/manager, not platform admin)."""

from __future__ import annotations

import uuid

import httpx
import pytest
from fastapi.testclient import TestClient

from app.authz.catalog import load_catalog
from app.authz.engine import authorize
from app.authz.types import AuthzContext
from app.config import get_settings
from app.main import app

pytestmark = pytest.mark.live

OWNER = ("ss.phase3.a@sitesecure.test", "Test-Pass-2026!")
OTHER = ("ss.phase3.b@sitesecure.test", "Test-Pass-2026!")


@pytest.fixture(scope="module")
def settings():
    try:
        get_settings.cache_clear()
        return get_settings()
    except Exception:
        pytest.skip("SUPABASE_URL / SUPABASE_ANON_KEY not configured")


def _password_grant(settings, email: str, password: str) -> str:
    with httpx.Client(timeout=30) as client:
        res = client.post(
            f"{settings.supabase_url}/auth/v1/token?grant_type=password",
            headers={"apikey": settings.supabase_anon_key, "Content-Type": "application/json"},
            json={"email": email, "password": password},
        )
    if res.status_code != 200:
        pytest.skip(f"password grant failed: {res.status_code}")
    return res.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _signup(settings, email: str, password: str) -> str:
    service_key = getattr(settings, "supabase_service_role_key", None) or ""
    if not service_key or service_key.startswith("test-"):
        pytest.skip("service role required")
    with httpx.Client(timeout=30) as client:
        res = client.post(
            f"{settings.supabase_url}/auth/v1/admin/users",
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
            },
            json={"email": email, "password": password, "email_confirm": True},
        )
    assert res.status_code in {200, 201}, res.text
    return _password_grant(settings, email, password)


def _ctx(role: str, plan: str = "business") -> AuthzContext:
    load_catalog.cache_clear()
    catalog = load_catalog()
    return AuthzContext(
        user_id="u1",
        workspace_id="w1",
        role_key=role,
        workspace_status="active",
        subscription_status="active",
        plan_key=plan,
        features=catalog["_plan_features"][plan],
    )


def test_authz_team_invite_roles():
    assert authorize(ctx=_ctx("owner"), action="users.invite").allowed
    assert authorize(ctx=_ctx("manager"), action="users.invite").allowed
    assert not authorize(ctx=_ctx("sales"), action="users.invite").allowed
    assert not authorize(ctx=_ctx("technician"), action="users.invite").allowed
    assert not authorize(ctx=_ctx("viewer"), action="users.invite").allowed


def test_owner_can_invite_technician_and_revoke_reissue(settings):
    api = TestClient(app)
    password = "Test-Pass-2026!"
    owner = _password_grant(settings, *OWNER)
    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(owner),
        json={"name": f"Team Invite {uuid.uuid4().hex[:6]}", "plan_key": "business"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]

    # Owner invite blocked
    blocked_owner = api.post(
        f"/api/v1/workspaces/{workspace_id}/invitations",
        headers=_auth(owner),
        json={"email": f"ss.team.owner.{uuid.uuid4().hex[:6]}@sitesecure.test", "role_key": "owner"},
    )
    assert blocked_owner.status_code == 403
    assert blocked_owner.json()["error"]["code"] == "BUSINESS_RULE"

    email = f"ss.team.tech.{uuid.uuid4().hex[:10]}@sitesecure.test"
    invite = api.post(
        f"/api/v1/workspaces/{workspace_id}/invitations",
        headers=_auth(owner),
        json={"email": email, "role_key": "technician"},
    )
    assert invite.status_code == 200, invite.text
    token = invite.json()["token"]
    invite_id = invite.json()["id"]
    assert invite.json().get("status") == "pending"

    listed = api.get(f"/api/v1/workspaces/{workspace_id}/invitations", headers=_auth(owner))
    assert listed.status_code == 200
    assert any(row["id"] == invite_id and row["status"] == "pending" for row in listed.json())

    # Cross-workspace: other owner's token cannot list this workspace invites
    other = _password_grant(settings, *OTHER)
    cross = api.get(f"/api/v1/workspaces/{workspace_id}/invitations", headers=_auth(other))
    assert cross.status_code in {403, 404}
    if cross.status_code == 403:
        assert cross.json()["error"]["code"] == "PERMISSION_DENIED"

    # Revoke
    revoked = api.post(
        f"/api/v1/workspaces/{workspace_id}/invitations/{invite_id}/revoke",
        headers=_auth(owner),
    )
    assert revoked.status_code == 200, revoked.text
    assert revoked.json()["status"] == "revoked"

    invitee = _signup(settings, email, password)
    rejected = api.post(
        "/api/v1/invitations/accept",
        headers=_auth(invitee),
        json={"token": token},
    )
    assert rejected.status_code == 400
    assert rejected.json()["error"]["code"] == "INVITE_REVOKED"

    # Reissue + accept
    reissued = api.post(
        f"/api/v1/workspaces/{workspace_id}/invitations/{invite_id}/reissue",
        headers=_auth(owner),
    )
    assert reissued.status_code == 200, reissued.text
    new_token = reissued.json()["token"]
    assert new_token and new_token != token

    accepted = api.post(
        "/api/v1/invitations/accept",
        headers=_auth(invitee),
        json={"token": new_token},
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["workspace_id"] == workspace_id

    # Duplicate membership
    dup = api.post(
        f"/api/v1/workspaces/{workspace_id}/invitations",
        headers=_auth(owner),
        json={"email": email, "role_key": "technician"},
    )
    assert dup.status_code == 403
    assert dup.json()["error"]["code"] == "INVITE_USER_EXISTS"


def test_manager_can_invite_technician(settings):
    """Promote OTHER to manager in owner's workspace, then invite."""
    api = TestClient(app)
    owner = _password_grant(settings, *OWNER)
    manager_tok = _password_grant(settings, *OTHER)
    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(owner),
        json={"name": f"Mgr Invite {uuid.uuid4().hex[:6]}", "plan_key": "business"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]

    # Invite OTHER as manager via owner
    mgr_email = OTHER[0]
    # OTHER may already exist as auth user — invite then accept if not member
    invite_mgr = api.post(
        f"/api/v1/workspaces/{workspace_id}/invitations",
        headers=_auth(owner),
        json={"email": mgr_email, "role_key": "manager"},
    )
    if invite_mgr.status_code == 200:
        token = invite_mgr.json()["token"]
        ok = api.post(
            "/api/v1/invitations/accept",
            headers=_auth(manager_tok),
            json={"token": token},
        )
        assert ok.status_code == 200, ok.text
    elif invite_mgr.status_code == 403 and invite_mgr.json()["error"]["code"] == "INVITE_USER_EXISTS":
        pass
    else:
        assert invite_mgr.status_code == 200, invite_mgr.text

    # Ensure role is manager
    members = api.get(f"/api/v1/workspaces/{workspace_id}/members", headers=_auth(owner))
    assert members.status_code == 200, members.text
    mgr_row = next((m for m in members.json() if (m.get("email") or "").lower() == mgr_email.lower()), None)
    assert mgr_row, members.text
    if mgr_row.get("role_key") != "manager" and mgr_row.get("workspace_role_key") != "manager":
        patched = api.patch(
            f"/api/v1/workspaces/{workspace_id}/members/{mgr_row['id']}",
            headers=_auth(owner),
            json={"workspace_role_key": "manager", "role_key": "manager"},
        )
        assert patched.status_code == 200, patched.text

    tech_email = f"ss.mgr.tech.{uuid.uuid4().hex[:10]}@sitesecure.test"
    invite = api.post(
        f"/api/v1/workspaces/{workspace_id}/invitations",
        headers=_auth(manager_tok),
        json={"email": tech_email, "role_key": "technician"},
    )
    assert invite.status_code == 200, invite.text
    assert invite.json()["role_key"] == "technician"
    assert invite.json()["token"]


def test_technician_cannot_invite(settings):
    api = TestClient(app)
    owner = _password_grant(settings, *OWNER)
    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(owner),
        json={"name": f"Tech Deny {uuid.uuid4().hex[:6]}", "plan_key": "business"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]

    tech_email = f"ss.deny.tech.{uuid.uuid4().hex[:10]}@sitesecure.test"
    invite = api.post(
        f"/api/v1/workspaces/{workspace_id}/invitations",
        headers=_auth(owner),
        json={"email": tech_email, "role_key": "technician"},
    )
    assert invite.status_code == 200, invite.text
    tech_tok = _signup(settings, tech_email, "Test-Pass-2026!")
    accept = api.post(
        "/api/v1/invitations/accept",
        headers=_auth(tech_tok),
        json={"token": invite.json()["token"]},
    )
    assert accept.status_code == 200, accept.text

    denied = api.post(
        f"/api/v1/workspaces/{workspace_id}/invitations",
        headers=_auth(tech_tok),
        json={"email": f"ss.deny.x.{uuid.uuid4().hex[:6]}@sitesecure.test", "role_key": "viewer"},
    )
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "PERMISSION_DENIED"
