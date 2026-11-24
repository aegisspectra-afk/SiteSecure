"""D1-V3 e2e: visitor beta form → row visible to platform admin."""

from __future__ import annotations

import uuid

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.routers import public_marketing as pub

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
    token = _password_grant(settings, email, password)
    with httpx.Client(timeout=30) as client:
        user = client.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
        )
    assert user.status_code == 200, user.text
    user_id = user.json()["id"]
    with httpx.Client(timeout=30) as client:
        granted = client.post(
            f"{settings.supabase_url}/rest/v1/rpc/grant_platform_admin",
            headers=_service_headers(settings),
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


def test_visitor_beta_form_appears_in_admin_panel(settings):
    """Visitor POSTs landing form → admin GET marketing-beta-signups sees the row."""
    pub.clear_rate_limit_buckets()
    api = TestClient(app)
    marker = uuid.uuid4().hex[:8]
    phone = f"050{marker[:7]}"
    name = f"D1V3 Visitor {marker}"

    created = api.post(
        "/api/v1/public/beta-signups",
        json={
            "full_name": name,
            "phone": phone,
            "technician_count": "3",
            "source": "landing",
        },
    )
    assert created.status_code == 200, created.text
    body = created.json()
    assert body.get("ok") is True
    signup_id = body.get("id")
    assert signup_id

    admin_token, admin_uid = _as_temp_platform_admin(settings)
    try:
        listed = api.get(
            "/api/v1/admin/marketing-beta-signups",
            headers=_auth(admin_token),
        )
        assert listed.status_code == 200, listed.text
        rows = listed.json()
        match = next((r for r in rows if r.get("id") == signup_id), None)
        assert match is not None, "signup missing from admin list"
        assert match["full_name"] == name
        assert match["phone"] == phone
        assert match["technician_count"] == "3"
        assert match["status"] == "new"
    finally:
        _revoke_platform_admin(settings, admin_uid)
