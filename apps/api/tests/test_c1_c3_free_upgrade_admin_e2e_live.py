"""C1/C3 live E2E (ה): Free workspace → quote quota → upgrade request → admin queue.

Scenario (ז) live slice: public CCTV calculator + fresh Free workspace (draft handoff is vitest).
"""

from __future__ import annotations

import uuid
from urllib.parse import urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.routers import public_marketing as pub

pytestmark = pytest.mark.live

PASSWORD = "Test-Pass-2026!"


@pytest.fixture(scope="module")
def settings():
    get_settings.cache_clear()
    try:
        s = get_settings()
    except Exception:
        pytest.skip("SUPABASE_URL / SUPABASE_ANON_KEY not configured")
    if urlparse(s.supabase_url).hostname not in {"127.0.0.1", "localhost"}:
        pytest.skip("C1/C3 billing E2E runs against local Supabase only")
    if not s.supabase_service_role_key or str(s.supabase_service_role_key).startswith("test-"):
        pytest.skip("local service role key required")
    return s


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _svc_headers(settings) -> dict[str, str]:
    key = settings.supabase_service_role_key
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def _password_grant(settings, email: str, password: str) -> str:
    with httpx.Client(timeout=30) as client:
        res = client.post(
            f"{settings.supabase_url}/auth/v1/token?grant_type=password",
            headers={"apikey": settings.supabase_anon_key, "Content-Type": "application/json"},
            json={"email": email, "password": password},
        )
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _signup_owner(settings) -> tuple[str, str]:
    """Register-style user via Auth Admin API + workspace owner token."""
    email = f"ss.c1c3.free.{uuid.uuid4().hex[:12]}@sitesecure.test"
    with httpx.Client(timeout=30) as client:
        res = client.post(
            f"{settings.supabase_url}/auth/v1/admin/users",
            headers=_svc_headers(settings),
            json={"email": email, "password": PASSWORD, "email_confirm": True},
        )
    assert res.status_code in {200, 201}, res.text
    token = _password_grant(settings, email, PASSWORD)
    return email, token


def _user_id(settings, token: str) -> str:
    with httpx.Client(timeout=30) as client:
        res = client.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
        )
    assert res.status_code == 200, res.text
    return res.json()["id"]


def _grant_platform_admin(settings, user_id: str) -> None:
    with httpx.Client(timeout=30) as client:
        res = client.post(
            f"{settings.supabase_url}/rest/v1/rpc/grant_platform_admin",
            headers=_svc_headers(settings),
            json={"p_user_id": user_id},
        )
    assert res.status_code == 200, res.text


def _revoke_platform_admin(settings, user_id: str) -> None:
    with httpx.Client(timeout=30) as client:
        client.post(
            f"{settings.supabase_url}/rest/v1/rpc/revoke_platform_admin",
            headers=_svc_headers(settings),
            json={"p_user_id": user_id},
        )


def _plant_quotes_to_limit(settings, workspace_id: str, *, limit: int = 10) -> None:
    with httpx.Client(timeout=90) as client:
        for i in range(limit + 5):
            planted = client.post(
                f"{settings.supabase_url}/rest/v1/quotes",
                headers={**_svc_headers(settings), "Prefer": "return=minimal"},
                json={"workspace_id": workspace_id, "title": f"Seed {i} {uuid.uuid4().hex[:4]}"},
            )
            if planted.status_code not in {200, 201, 204}:
                if "PLAN_LIMIT_REACHED" in planted.text:
                    return
                assert False, planted.text


def test_c1_free_quote_limit_then_c3_upgrade_visible_in_admin_live(settings):
    """ה: register → Free workspace → quota block (upgrade_required) → admin billing queue."""
    api = TestClient(app)
    admin_email = f"ss.c1c3.admin.{uuid.uuid4().hex[:10]}@sitesecure.test"
    with httpx.Client(timeout=30) as client:
        client.post(
            f"{settings.supabase_url}/auth/v1/admin/users",
            headers=_svc_headers(settings),
            json={"email": admin_email, "password": PASSWORD, "email_confirm": True},
        )
    admin_token = _password_grant(settings, admin_email, PASSWORD)
    admin_uid = _user_id(settings, admin_token)

    _owner_email, owner_token = _signup_owner(settings)
    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(owner_token),
        json={"name": f"C1C3 Free {uuid.uuid4().hex[:6]}"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]

    session = api.get("/api/v1/auth/session", headers=_auth(owner_token))
    assert session.status_code == 200, session.text
    mine = next(m for m in session.json()["memberships"] if m["workspace_id"] == workspace_id)
    assert mine.get("plan_key") in {"free", "solo"}

    _plant_quotes_to_limit(settings, workspace_id, limit=10)

    blocked = api.post(
        f"/api/v1/workspaces/{workspace_id}/quotes",
        headers=_auth(owner_token),
        json={"title": "Over quota"},
    )
    assert blocked.status_code == 409, blocked.text
    err = blocked.json()["error"]
    assert err["code"] == "PLAN_LIMIT_REACHED"
    assert err.get("details", {}).get("upgrade_required") is True
    assert err.get("details", {}).get("resource") == "quotes"

    upgrade = api.post(
        f"/api/v1/workspaces/{workspace_id}/billing/upgrade-requests",
        headers=_auth(owner_token),
        json={"target_plan_key": "pro", "message": "הגענו למגבלת הצעות — רוצים Pro"},
    )
    assert upgrade.status_code == 200, upgrade.text
    request_id = upgrade.json()["id"]
    assert upgrade.json()["current_plan_key"] in {"free", "solo"}
    assert upgrade.json()["status"] == "pending"

    _grant_platform_admin(settings, admin_uid)
    try:
        listed = api.get(
            "/api/v1/admin/billing-upgrade-requests",
            headers=_auth(admin_token),
            params={"status": "pending"},
        )
        assert listed.status_code == 200, listed.text
        rows = listed.json()
        hit = next((r for r in rows if r["id"] == request_id), None)
        assert hit is not None, "upgrade request missing from admin queue"
        assert hit["workspace_id"] == workspace_id
        assert hit.get("message")
    finally:
        _revoke_platform_admin(settings, admin_uid)


def test_public_cctv_calculator_and_free_workspace_live(settings):
    """ז (API): public calculator + onboarding workspace stays on Free (draft consume = vitest)."""
    api = TestClient(app)
    pub.clear_rate_limit_buckets()

    calc = api.post(
        "/api/v1/public/tools/cctv-storage/calculate",
        json={
            "camera_count": 12,
            "resolution_mp": 4,
            "retention_days": 30,
            "recording_mode": "continuous",
            "codec": "h265",
        },
    )
    assert calc.status_code == 200, calc.text
    assert calc.json()["storage"]["status"] == "ok"
    assert calc.json()["recorder"]["channels"] >= 12

    _owner_email, owner_token = _signup_owner(settings)
    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(owner_token),
        json={"name": f"CCTV Draft WS {uuid.uuid4().hex[:6]}"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]

    session = api.get("/api/v1/auth/session", headers=_auth(owner_token))
    mine = next(m for m in session.json()["memberships"] if m["workspace_id"] == workspace_id)
    assert mine.get("plan_key") in {"free", "solo"}

    usage = api.get(
        f"/api/v1/workspaces/{workspace_id}/usage",
        headers=_auth(owner_token),
    )
    assert usage.status_code == 200, usage.text
    body = usage.json()
    assert body.get("plan_key") in {"free", "solo"}
    meters = body.get("meters") or []
    qq = next((m for m in meters if m.get("key") == "quota_quotes"), None)
    assert qq is not None
    assert qq.get("limit") == 10