"""Live: platform-admin bootstrap hygiene (G-030 / R-009)."""

from __future__ import annotations

import uuid

import httpx
import pytest
from fastapi.testclient import TestClient

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


def _user_id(settings, token: str) -> str:
    with httpx.Client(timeout=30) as client:
        res = client.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
        )
    assert res.status_code == 200, res.text
    return res.json()["id"]


def _service_headers(settings) -> dict[str, str]:
    key = settings.supabase_service_role_key or ""
    if not key or key.startswith("test-"):
        pytest.skip("service role required")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def test_workspace_owner_denied_admin_routes(settings):
    api = TestClient(app)
    token = _password_grant(settings, *OWNER)
    for path in (
        "/api/v1/admin/summary",
        "/api/v1/admin/organizations",
        "/api/v1/admin/users",
        "/api/v1/admin/feedback",
        "/api/v1/admin/feature-flags",
    ):
        res = api.get(path, headers=_auth(token))
        assert res.status_code == 403, path
        assert res.json()["error"]["code"] == "PERMISSION_DENIED"


def test_user_cannot_self_grant_platform_admin_via_profile_patch(settings):
    token = _password_grant(settings, *OWNER)
    user_id = _user_id(settings, token)
    with httpx.Client(timeout=30) as client:
        res = client.patch(
            f"{settings.supabase_url}/rest/v1/profiles",
            headers={
                "apikey": settings.supabase_anon_key,
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            params={"id": f"eq.{user_id}"},
            json={"is_platform_admin": True},
        )
    # Trigger blocks authenticated role; PostgREST surfaces as error.
    assert res.status_code >= 400, res.text
    api = TestClient(app)
    denied = api.get("/api/v1/admin/summary", headers=_auth(token))
    assert denied.status_code == 403


def test_authenticated_user_cannot_call_grant_rpc(settings):
    token = _password_grant(settings, *OWNER)
    user_id = _user_id(settings, token)
    with httpx.Client(timeout=30) as client:
        res = client.post(
            f"{settings.supabase_url}/rest/v1/rpc/grant_platform_admin",
            headers={
                "apikey": settings.supabase_anon_key,
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={"p_user_id": user_id},
        )
    assert res.status_code >= 400, res.text


def test_service_role_grant_revoke_idempotent(settings):
    """Explicit bootstrap path: grant → admin route works → duplicate grant ok → revoke."""
    api = TestClient(app)
    token = _password_grant(settings, *OTHER)
    user_id = _user_id(settings, token)
    headers = _service_headers(settings)

    # Ensure clean start
    with httpx.Client(timeout=30) as client:
        client.post(
            f"{settings.supabase_url}/rest/v1/rpc/revoke_platform_admin",
            headers=headers,
            json={"p_user_id": user_id},
        )

    assert api.get("/api/v1/admin/summary", headers=_auth(token)).status_code == 403

    with httpx.Client(timeout=30) as client:
        granted = client.post(
            f"{settings.supabase_url}/rest/v1/rpc/grant_platform_admin",
            headers=headers,
            json={"p_user_id": user_id},
        )
        assert granted.status_code == 200, granted.text
        again = client.post(
            f"{settings.supabase_url}/rest/v1/rpc/grant_platform_admin",
            headers=headers,
            json={"p_user_id": user_id},
        )
        assert again.status_code == 200, again.text

    try:
        ok = api.get("/api/v1/admin/summary", headers=_auth(token))
        assert ok.status_code == 200, ok.text
        assert "organizations" in ok.json()
    finally:
        with httpx.Client(timeout=30) as client:
            revoked = client.post(
                f"{settings.supabase_url}/rest/v1/rpc/revoke_platform_admin",
                headers=headers,
                json={"p_user_id": user_id},
            )
        assert revoked.status_code == 200, revoked.text
        assert api.get("/api/v1/admin/summary", headers=_auth(token)).status_code == 403


def test_grant_unknown_user_fails_safely(settings):
    headers = _service_headers(settings)
    fake = str(uuid.uuid4())
    with httpx.Client(timeout=30) as client:
        res = client.post(
            f"{settings.supabase_url}/rest/v1/rpc/grant_platform_admin",
            headers=headers,
            json={"p_user_id": fake},
        )
    assert res.status_code >= 400, res.text


def test_existing_seeded_admin_still_authorized_if_present(settings):
    """Production-like: if a UUID already has the flag, /admin works. UNVERIFIED skip if none."""
    headers = _service_headers(settings)
    with httpx.Client(timeout=30) as client:
        rows = client.get(
            f"{settings.supabase_url}/rest/v1/profiles",
            headers=headers,
            params={"is_platform_admin": "eq.true", "select": "id,email", "limit": "1"},
        )
    assert rows.status_code == 200, rows.text
    admins = rows.json() or []
    if not admins:
        pytest.skip("no existing platform admin in this environment")
    # Cannot password-grant unknown emails; assert flag exists and owner path still denied.
    assert admins[0]["id"]
    api = TestClient(app)
    owner = _password_grant(settings, *OWNER)
    assert api.get("/api/v1/admin/summary", headers=_auth(owner)).status_code == 403
