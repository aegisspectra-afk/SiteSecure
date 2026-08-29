"""Live invitation accept + seat re-check (Phase 0 Task 01)."""

from __future__ import annotations

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
    """Create a confirmed user for live invite tests.

    Prefer Auth Admin API (service role) so we avoid public signup email
    validation / confirmation rate limits on disposable domains.
    """
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

    with httpx.Client(timeout=30) as client:
        res = client.post(
            f"{settings.supabase_url}/auth/v1/signup",
            headers={"apikey": settings.supabase_anon_key, "Content-Type": "application/json"},
            json={"email": email, "password": password},
        )
    assert res.status_code in {200, 201}, res.text
    body = res.json()
    token = (body.get("access_token") or (body.get("session") or {}).get("access_token"))
    if token:
        return token
    return _password_grant(settings, email, password)


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_invite_accept_happy_path(settings):
    api = TestClient(app)
    password = "Test-Pass-2026!"
    owner_email = "ss.phase3.a@sitesecure.test"
    owner_token = _password_grant(settings, owner_email, password)
    invitee_email = f"ss.invite.accept.{uuid.uuid4().hex[:10]}@sitesecure.test"

    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(owner_token),
        json={"name": f"Invite Accept {uuid.uuid4().hex[:6]}"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]

    invite = api.post(
        f"/api/v1/workspaces/{workspace_id}/invitations",
        headers=_auth(owner_token),
        json={"email": invitee_email, "role_key": "technician"},
    )
    assert invite.status_code == 200, invite.text
    token = invite.json()["token"]
    assert token

    invitee_token = _signup(settings, invitee_email, password)

    peek = api.get(
        "/api/v1/invitations/peek",
        headers=_auth(invitee_token),
        params={"token": token},
    )
    assert peek.status_code == 200, peek.text
    assert peek.json()["status"] == "valid"
    assert peek.json()["role_key"] == "technician"

    accepted = api.post(
        "/api/v1/invitations/accept",
        headers=_auth(invitee_token),
        json={"token": token},
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["workspace_id"] == workspace_id

    again = api.post(
        "/api/v1/invitations/accept",
        headers=_auth(invitee_token),
        json={"token": token},
    )
    assert again.status_code == 200, again.text
    assert again.json()["workspace_id"] == workspace_id

    session = api.get("/api/v1/auth/session", headers=_auth(invitee_token))
    assert session.status_code == 200
    memberships = session.json()["memberships"]
    assert any(m["workspace_id"] == workspace_id and m["role_key"] == "technician" for m in memberships)
    assert session.json()["memberships"][0]["workspace_id"] == workspace_id


def test_invite_wrong_account_peek(settings):
    api = TestClient(app)
    password = "Test-Pass-2026!"
    owner_token = _password_grant(settings, "ss.phase3.a@sitesecure.test", password)
    other_token = _password_grant(settings, "ss.phase3.b@sitesecure.test", password)

    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(owner_token),
        json={"name": f"Invite Wrong {uuid.uuid4().hex[:6]}"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]
    invite = api.post(
        f"/api/v1/workspaces/{workspace_id}/invitations",
        headers=_auth(owner_token),
        json={"email": f"ss.invite.other.{uuid.uuid4().hex[:8]}@sitesecure.test", "role_key": "viewer"},
    )
    assert invite.status_code == 200, invite.text
    token = invite.json()["token"]

    peek = api.get(
        "/api/v1/invitations/peek",
        headers=_auth(other_token),
        params={"token": token},
    )
    assert peek.status_code == 200
    assert peek.json()["status"] == "wrong_account"
    assert peek.json().get("workspace_name") is None

    blocked = api.post(
        "/api/v1/invitations/accept",
        headers=_auth(other_token),
        json={"token": token},
    )
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "INVITE_EMAIL_MISMATCH"


def test_invite_accept_seat_limit_blocks_stale_invite(settings):
    """Stale invite after seats are full must be rejected at accept (server-side)."""
    api = TestClient(app)
    password = "Test-Pass-2026!"
    owner_token = _password_grant(settings, "ss.phase3.a@sitesecure.test", password)
    service_key = getattr(settings, "supabase_service_role_key", None) or ""
    if not service_key or service_key.startswith("test-"):
        pytest.skip("service role required to plant stale invitation past create-time seat check")

    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(owner_token),
        json={"name": f"Invite Stale {uuid.uuid4().hex[:6]}"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]

    for _ in range(3):
        email = f"ss.invite.stale.fill.{uuid.uuid4().hex[:8]}@sitesecure.test"
        inv = api.post(
            f"/api/v1/workspaces/{workspace_id}/invitations",
            headers=_auth(owner_token),
            json={"email": email, "role_key": "technician"},
        )
        assert inv.status_code == 200, inv.text
        member_token = _signup(settings, email, password)
        acc = api.post(
            "/api/v1/invitations/accept",
            headers=_auth(member_token),
            json={"token": inv.json()["token"]},
        )
        assert acc.status_code == 200, acc.text

    import hashlib
    import secrets

    raw = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    late_email = f"ss.invite.stale.{uuid.uuid4().hex[:8]}@sitesecure.test"
    with httpx.Client(timeout=30) as client:
        planted = client.post(
            f"{settings.supabase_url}/rest/v1/invitations",
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            json={
                "workspace_id": workspace_id,
                "email": late_email,
                "role_key": "technician",
                "token_hash": token_hash,
            },
        )
    assert planted.status_code in {200, 201}, planted.text

    late_token = _signup(settings, late_email, password)
    blocked = api.post(
        "/api/v1/invitations/accept",
        headers=_auth(late_token),
        json={"token": raw},
    )
    assert blocked.status_code == 403, blocked.text
    assert blocked.json()["error"]["code"] == "PLAN_LIMIT_REACHED"


def test_invite_invalid_token(settings):
    api = TestClient(app)
    token = _password_grant(settings, "ss.phase3.a@sitesecure.test", "Test-Pass-2026!")
    peek = api.get(
        "/api/v1/invitations/peek",
        headers=_auth(token),
        params={"token": "totally-invalid-token-value-xx"},
    )
    assert peek.status_code == 200
    assert peek.json()["status"] == "invalid"
    bad = api.post(
        "/api/v1/invitations/accept",
        headers=_auth(token),
        json={"token": "totally-invalid-token-value-xx"},
    )
    assert bad.status_code == 400
    assert bad.json()["error"]["code"] == "INVITE_INVALID"
