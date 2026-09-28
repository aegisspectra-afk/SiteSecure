"""Live BETA-ADMIN-1: platform admin workspace + invitation lifecycle."""

from __future__ import annotations

import hashlib
import uuid

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app

pytestmark = pytest.mark.live


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


def _signup(settings, email: str, password: str) -> str:
    service_key = getattr(settings, "supabase_service_role_key", None) or ""
    if service_key and not service_key.startswith("test-"):
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
    pytest.skip("service role required for invitee signup")


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _service_headers(settings) -> dict[str, str]:
    key = settings.supabase_service_role_key or ""
    if not key or key.startswith("test-"):
        pytest.skip("service role required")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _as_temp_platform_admin(settings, email: str = "ss.phase3.b@sitesecure.test", password: str = "Test-Pass-2026!"):
    """Grant platform admin for the duration of a test; caller must revoke in finally."""
    token = _password_grant(settings, email, password)
    with httpx.Client(timeout=30) as client:
        user = client.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
        )
    assert user.status_code == 200, user.text
    user_id = user.json()["id"]
    headers = _service_headers(settings)
    with httpx.Client(timeout=30) as client:
        granted = client.post(
            f"{settings.supabase_url}/rest/v1/rpc/grant_platform_admin",
            headers=headers,
            json={"p_user_id": user_id},
        )
    assert granted.status_code == 200, granted.text
    return token, user_id


def _revoke_platform_admin(settings, user_id: str) -> None:
    with httpx.Client(timeout=30) as client:
        client.post(
            f"{settings.supabase_url}/rest/v1/rpc/revoke_platform_admin",
            headers=_service_headers(settings),
            json={"p_user_id": user_id},
        )


def test_owner_cannot_create_platform_invitations(settings):
    api = TestClient(app)
    owner = _password_grant(settings, "ss.phase3.a@sitesecure.test", "Test-Pass-2026!")
    for path, body in (
        ("/api/v1/admin/invitations", {"workspace_id": str(uuid.uuid4()), "email": "x@y.com", "role_key": "owner"}),
        ("/api/v1/admin/organizations", {"name": "Should Fail", "plan_key": "business"}),
    ):
        res = api.post(path, headers=_auth(owner), json=body)
        assert res.status_code == 403, path
        assert res.json()["error"]["code"] == "PERMISSION_DENIED"


def test_owner_cannot_invite_owner_via_workspace_api(settings):
    api = TestClient(app)
    owner = _password_grant(settings, "ss.phase3.a@sitesecure.test", "Test-Pass-2026!")
    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(owner),
        json={"name": f"Owner Invite Block {uuid.uuid4().hex[:6]}"},
    )
    assert ws.status_code == 200, ws.text
    invite = api.post(
        f"/api/v1/workspaces/{ws.json()['id']}/invitations",
        headers=_auth(owner),
        json={"email": f"blocked.{uuid.uuid4().hex[:6]}@sitesecure.test", "role_key": "owner"},
    )
    assert invite.status_code == 403
    assert invite.json()["error"]["code"] == "BUSINESS_RULE"


def test_beta_admin_provision_invite_accept_revoke_reuse(settings):
    api = TestClient(app)
    password = "Test-Pass-2026!"
    admin_token, admin_uid = _as_temp_platform_admin(settings)
    try:
        # 1) Create empty beta workspace
        org = api.post(
            "/api/v1/admin/organizations",
            headers=_auth(admin_token),
            json={
                "name": f"FT Beta {uuid.uuid4().hex[:6]}",
                "plan_key": "business",
                "is_beta": True,
                "beta_program": "early",
                "internal_note": "beta-admin-1 live",
            },
        )
        assert org.status_code == 200, org.text
        workspace_id = org.json()["id"]
        assert org.json()["is_beta"] is True

        with httpx.Client(timeout=30) as client:
            members = client.get(
                f"{settings.supabase_url}/rest/v1/workspace_memberships",
                headers=_service_headers(settings),
                params={"workspace_id": f"eq.{workspace_id}", "select": "id"},
            )
        assert members.status_code == 200
        assert members.json() == []

        invitee_email = f"ss.ft.owner.{uuid.uuid4().hex[:10]}@sitesecure.test"

        invite = api.post(
            "/api/v1/admin/invitations",
            headers=_auth(admin_token),
            json={"workspace_id": workspace_id, "email": invitee_email, "role_key": "owner"},
        )
        assert invite.status_code == 200, invite.text
        body = invite.json()
        token = body["token"]
        assert token
        invite_id = body["id"]
        assert body["status"] == "pending"
        assert "token_hash" not in body

        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        with httpx.Client(timeout=30) as client:
            row = client.get(
                f"{settings.supabase_url}/rest/v1/invitations",
                headers=_service_headers(settings),
                params={"id": f"eq.{invite_id}", "select": "token_hash,email,role_key,revoked_at,accepted_at"},
            )
        assert row.status_code == 200
        inv_row = row.json()[0]
        assert inv_row["token_hash"] == digest
        assert inv_row["token_hash"] != token

        peek = api.get("/api/v1/invitations/public-peek", params={"token": token})
        assert peek.status_code == 200
        assert peek.json()["status"] == "valid"
        assert peek.json()["email"] == invitee_email
        assert peek.json()["role_key"] == "owner"
        assert peek.json().get("workspace_id") is None

        wrong_email = f"ss.ft.wrong.{uuid.uuid4().hex[:8]}@sitesecure.test"
        wrong_tok = _signup(settings, wrong_email, password)
        bad = api.post(
            "/api/v1/invitations/accept",
            headers=_auth(wrong_tok),
            json={"token": token},
        )
        assert bad.status_code == 403
        assert bad.json()["error"]["code"] == "INVITE_EMAIL_MISMATCH"

        invitee_tok = _signup(settings, invitee_email, password)
        ok = api.post(
            "/api/v1/invitations/accept",
            headers=_auth(invitee_tok),
            json={"token": token},
        )
        assert ok.status_code == 200, ok.text
        assert ok.json()["workspace_id"] == workspace_id

        reuse = api.post(
            "/api/v1/invitations/accept",
            headers=_auth(invitee_tok),
            json={"token": token},
        )
        assert reuse.status_code in {200, 409}, reuse.text

        tech_email = f"ss.ft.tech.{uuid.uuid4().hex[:10]}@sitesecure.test"
        tech_invite = api.post(
            "/api/v1/admin/invitations",
            headers=_auth(admin_token),
            json={"workspace_id": workspace_id, "email": tech_email, "role_key": "technician"},
        )
        assert tech_invite.status_code == 200, tech_invite.text
        tech_token = tech_invite.json()["token"]
        tech_id = tech_invite.json()["id"]

        revoked = api.post(
            f"/api/v1/admin/invitations/{tech_id}/revoke",
            headers=_auth(admin_token),
        )
        assert revoked.status_code == 200, revoked.text
        assert revoked.json()["status"] == "revoked"

        tech_tok = _signup(settings, tech_email, password)
        rejected = api.post(
            "/api/v1/invitations/accept",
            headers=_auth(tech_tok),
            json={"token": tech_token},
        )
        assert rejected.status_code == 400
        assert rejected.json()["error"]["code"] == "INVITE_REVOKED"

        reissued = api.post(
            f"/api/v1/admin/invitations/{tech_id}/reissue",
            headers=_auth(admin_token),
        )
        assert reissued.status_code == 200, reissued.text
        new_token = reissued.json()["token"]
        assert new_token and new_token != tech_token

        accept_tech = api.post(
            "/api/v1/invitations/accept",
            headers=_auth(tech_tok),
            json={"token": new_token},
        )
        assert accept_tech.status_code == 200, accept_tech.text

        dup = api.post(
            "/api/v1/admin/invitations",
            headers=_auth(admin_token),
            json={"workspace_id": workspace_id, "email": tech_email, "role_key": "technician"},
        )
        assert dup.status_code == 403
        assert dup.json()["error"]["code"] == "INVITE_USER_EXISTS"

        expired_email = f"ss.ft.exp.{uuid.uuid4().hex[:8]}@sitesecure.test"
        exp_invite = api.post(
            "/api/v1/admin/invitations",
            headers=_auth(admin_token),
            json={"workspace_id": workspace_id, "email": expired_email, "role_key": "viewer"},
        )
        assert exp_invite.status_code == 200, exp_invite.text
        exp_id = exp_invite.json()["id"]
        exp_token = exp_invite.json()["token"]
        with httpx.Client(timeout=30) as client:
            client.patch(
                f"{settings.supabase_url}/rest/v1/invitations",
                headers={**_service_headers(settings), "Prefer": "return=minimal"},
                params={"id": f"eq.{exp_id}"},
                json={"expires_at": "2020-01-01T00:00:00Z"},
            )
        exp_user = _signup(settings, expired_email, password)
        expired = api.post(
            "/api/v1/invitations/accept",
            headers=_auth(exp_user),
            json={"token": exp_token},
        )
        assert expired.status_code == 400
        assert expired.json()["error"]["code"] == "INVITE_EXPIRED"

        memb = api.get(
            "/api/v1/admin/memberships",
            headers=_auth(admin_token),
            params={"workspace_id": workspace_id},
        )
        assert memb.status_code == 200
        emails = {m.get("email") for m in memb.json()}
        assert invitee_email in emails
        assert tech_email in emails
    finally:
        _revoke_platform_admin(settings, admin_uid)