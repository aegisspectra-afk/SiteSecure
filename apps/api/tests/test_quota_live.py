"""Live hard quota enforcement for customers / quotes / storage (Phase 0 Task 02)."""

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


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _set_plan(settings, workspace_id: str, plan_key: str) -> None:
    service_key = settings.supabase_service_role_key or ""
    if not service_key or service_key.startswith("test-"):
        pytest.skip("service role required to set plan for quota tests")
    with httpx.Client(timeout=30) as client:
        res = client.patch(
            f"{settings.supabase_url}/rest/v1/subscriptions",
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            params={"workspace_id": f"eq.{workspace_id}"},
            json={"plan_key": plan_key, "status": "active"},
        )
    assert res.status_code in {200, 204}, res.text


def test_customer_quota_enforced_live(settings):
    api = TestClient(app)
    token = _password_grant(settings, "ss.phase3.a@sitesecure.test", "Test-Pass-2026!")
    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(token),
        json={"name": f"Quota Cust {uuid.uuid4().hex[:6]}"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]
    # Tiny synthetic ceiling: plant plan_limits override is not available per-ws;
    # instead fill to solo limit is too heavy. Use service role to insert 30 customers
    # then assert the 31st fails via API.
    service_key = settings.supabase_service_role_key or ""
    if not service_key:
        pytest.skip("service role required")
    with httpx.Client(timeout=60) as client:
        for i in range(30):
            planted = client.post(
                f"{settings.supabase_url}/rest/v1/customers",
                headers={
                    "apikey": service_key,
                    "Authorization": f"Bearer {service_key}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                },
                json={
                    "workspace_id": workspace_id,
                    "display_name": f"Seed {i} {uuid.uuid4().hex[:4]}",
                },
            )
            # Service role bypasses trigger? Triggers still fire for service role.
            # If plant hits quota mid-way, stop.
            if planted.status_code not in {200, 201, 204}:
                if "PLAN_LIMIT_REACHED" in planted.text:
                    break
                assert False, planted.text

    blocked = api.post(
        f"/api/v1/workspaces/{workspace_id}/customers",
        headers=_auth(token),
        json={"display_name": f"Over {uuid.uuid4().hex[:6]}"},
    )
    assert blocked.status_code == 403, blocked.text
    body = blocked.json()["error"]
    assert body["code"] == "PLAN_LIMIT_REACHED"
    assert body.get("details", {}).get("resource") == "customers"


def test_quote_quota_enforced_live(settings):
    api = TestClient(app)
    token = _password_grant(settings, "ss.phase3.a@sitesecure.test", "Test-Pass-2026!")
    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(token),
        json={"name": f"Quota Quote {uuid.uuid4().hex[:6]}"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]
    service_key = settings.supabase_service_role_key or ""
    if not service_key:
        pytest.skip("service role required")
    with httpx.Client(timeout=90) as client:
        for i in range(50):
            planted = client.post(
                f"{settings.supabase_url}/rest/v1/quotes",
                headers={
                    "apikey": service_key,
                    "Authorization": f"Bearer {service_key}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                },
                json={
                    "workspace_id": workspace_id,
                    "title": f"Seed quote {i}",
                },
            )
            if planted.status_code not in {200, 201, 204}:
                if "PLAN_LIMIT_REACHED" in planted.text:
                    break
                assert False, planted.text

    blocked = api.post(
        f"/api/v1/workspaces/{workspace_id}/quotes",
        headers=_auth(token),
        json={},
    )
    assert blocked.status_code == 403, blocked.text
    assert blocked.json()["error"]["code"] == "PLAN_LIMIT_REACHED"
    assert blocked.json()["error"]["details"]["resource"] == "quotes"


def test_enterprise_quote_unlimited_live(settings):
    api = TestClient(app)
    token = _password_grant(settings, "ss.phase3.a@sitesecure.test", "Test-Pass-2026!")
    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(token),
        json={"name": f"Quota Ent {uuid.uuid4().hex[:6]}"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]
    _set_plan(settings, workspace_id, "enterprise")
    created = api.post(
        f"/api/v1/workspaces/{workspace_id}/quotes",
        headers=_auth(token),
        json={"title": "Enterprise unlimited"},
    )
    assert created.status_code == 200, created.text


def test_storage_upload_rejects_when_over_quota_live(settings):
    api = TestClient(app)
    token = _password_grant(settings, "ss.phase3.a@sitesecure.test", "Test-Pass-2026!")
    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(token),
        json={"name": f"Quota Stor {uuid.uuid4().hex[:6]}"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]
    customer = api.post(
        f"/api/v1/workspaces/{workspace_id}/customers",
        headers=_auth(token),
        json={"display_name": f"Doc host {uuid.uuid4().hex[:4]}"},
    )
    assert customer.status_code == 200, customer.text
    customer_id = customer.json()["id"]
    service_key = settings.supabase_service_role_key or ""
    if not service_key:
        pytest.skip("service role required")

    solo_bytes = 15 * (1024**3)
    # Fill almost the entire Solo storage quota with a pending reservation.
    with httpx.Client(timeout=30) as client:
        planted = client.post(
            f"{settings.supabase_url}/rest/v1/documents",
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            json={
                "workspace_id": workspace_id,
                "entity_type": "customer",
                "entity_id": customer_id,
                "kind": "document",
                "storage_bucket": "documents",
                "storage_path": f"{workspace_id}/customer/{customer_id}/{uuid.uuid4()}/pad.bin",
                "reserved_bytes": solo_bytes - 100,
            },
        )
    assert planted.status_code in {200, 201, 204}, planted.text

    blocked = api.post(
        f"/api/v1/workspaces/{workspace_id}/documents/uploads",
        headers=_auth(token),
        json={
            "entity_type": "customer",
            "entity_id": customer_id,
            "kind": "document",
            "original_filename": "over.bin",
            "byte_size": 200,
        },
    )
    assert blocked.status_code == 403, blocked.text
    assert blocked.json()["error"]["code"] == "PLAN_LIMIT_REACHED"
    assert blocked.json()["error"]["details"]["resource"] == "storage"


def test_storage_upload_below_quota_live(settings):
    api = TestClient(app)
    token = _password_grant(settings, "ss.phase3.a@sitesecure.test", "Test-Pass-2026!")
    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(token),
        json={"name": f"Quota Ok {uuid.uuid4().hex[:6]}"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]
    customer = api.post(
        f"/api/v1/workspaces/{workspace_id}/customers",
        headers=_auth(token),
        json={"display_name": f"Doc ok {uuid.uuid4().hex[:4]}"},
    )
    assert customer.status_code == 200, customer.text
    intent = api.post(
        f"/api/v1/workspaces/{workspace_id}/documents/uploads",
        headers=_auth(token),
        json={
            "entity_type": "customer",
            "entity_id": customer.json()["id"],
            "kind": "document",
            "original_filename": "small.txt",
            "byte_size": 128,
        },
    )
    assert intent.status_code == 200, intent.text
    assert intent.json()["upload_url"]
    assert intent.json().get("reserved_bytes") == 128
