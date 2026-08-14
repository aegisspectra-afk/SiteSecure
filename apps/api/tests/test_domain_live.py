"""Live domain API tests with authenticated user JWTs — never the service role."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from test_tenant_isolation import TECH_ID, VIEWER_ID, _ensure_member, _password_grant, _rpc

from app.config import get_settings
from app.main import app

pytestmark = pytest.mark.live


@pytest.fixture(scope="module")
def two_tenants(settings):
    password = "Test-Pass-2026!"
    token_a = _password_grant(settings, "ss.phase3.a@sitesecure.test", password)
    token_b = _password_grant(settings, "ss.phase3.b@sitesecure.test", password)
    ws_a = _rpc(settings, token_a, "create_workspace", {"p_name": "Workspace A Phase4", "p_plan_key": "solo"})
    ws_b = _rpc(settings, token_b, "create_workspace", {"p_name": "Workspace B Phase4", "p_plan_key": "solo"})
    assert ws_a.status_code == 200, ws_a.text
    assert ws_b.status_code == 200, ws_b.text
    return {
        "token_a": token_a,
        "token_b": token_b,
        "ws_a": ws_a.json(),
        "ws_b": ws_b.json(),
        "password": password,
    }


@pytest.fixture(scope="module")
def settings():
    try:
        get_settings.cache_clear()
        return get_settings()
    except Exception:
        pytest.skip("SUPABASE_URL / SUPABASE_ANON_KEY not configured")


@pytest.fixture(scope="module")
def api():
    get_settings.cache_clear()
    return TestClient(app)


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_user_jwt_customer_site_job_quote_isolation(settings, two_tenants, api):
    ws_a = two_tenants["ws_a"]
    ws_b = two_tenants["ws_b"]
    a = _auth(two_tenants["token_a"])
    b = _auth(two_tenants["token_b"])

    customer = api.post(f"/api/v1/workspaces/{ws_a}/customers", headers=a, json={"display_name": "לקוח א"})
    assert customer.status_code == 200, customer.text
    customer_id = customer.json()["id"]
    assert customer.json()["workspace_id"] == ws_a

    denied = api.get(f"/api/v1/workspaces/{ws_a}/customers/{customer_id}", headers=b)
    assert denied.status_code in {403, 404}

    other_ws = api.get(f"/api/v1/workspaces/{ws_b}/customers/{customer_id}", headers=a)
    assert other_ws.status_code in {403, 404}

    site = api.post(
        f"/api/v1/workspaces/{ws_a}/sites",
        headers=a,
        json={"customer_id": customer_id, "name": "אתר א"},
    )
    assert site.status_code == 200, site.text
    site_id = site.json()["id"]
    assert site.json()["code"].startswith("AS-S-")

    assert api.get(f"/api/v1/workspaces/{ws_a}/sites/{site_id}", headers=b).status_code in {403, 404}

    job = api.post(
        f"/api/v1/workspaces/{ws_a}/jobs",
        headers=a,
        json={"title": "התקנה", "customer_id": customer_id, "site_id": site_id, "kind": "installation"},
    )
    assert job.status_code == 200, job.text
    job_id = job.json()["id"]
    started = api.post(f"/api/v1/workspaces/{ws_a}/jobs/{job_id}/start", headers=a)
    assert started.status_code == 200, started.text
    assert started.json()["status"] == "in_progress"
    assert api.post(f"/api/v1/workspaces/{ws_a}/jobs/{job_id}/start", headers=b).status_code in {403, 404}

    quote = api.post(
        f"/api/v1/workspaces/{ws_a}/quotes",
        headers=a,
        json={"customer_id": customer_id, "site_id": site_id},
    )
    assert quote.status_code == 200, quote.text
    quote_id = quote.json()["id"]
    assert "cost_total" in quote.json()

    spoof = api.patch(
        f"/api/v1/workspaces/{ws_a}/quotes/{quote_id}",
        headers=a,
        json={"total_gross": 99999},
    )
    assert spoof.status_code == 400
    assert spoof.json()["error"]["code"] == "VALIDATION_ERROR"

    with_item = api.post(
        f"/api/v1/workspaces/{ws_a}/quotes/{quote_id}/items",
        headers=a,
        json={"item_type": "free", "description": "מצלמה", "qty": 2, "unit_price": 100, "cost": 40},
    )
    assert with_item.status_code == 200, with_item.text
    assert with_item.json()["total_gross"] == 236.0
    assert with_item.json()["cost_total"] == 80.0

    assert api.get(f"/api/v1/workspaces/{ws_a}/quotes/{quote_id}", headers=b).status_code in {403, 404}

    listed = api.get(f"/api/v1/workspaces/{ws_a}/customers", headers=a)
    assert listed.status_code == 200
    assert "items" in listed.json()
    assert listed.json()["next_cursor"] is None or isinstance(listed.json()["next_cursor"], str)


def test_viewer_and_technician_authorization(settings, two_tenants, api):

    ws_a = two_tenants["ws_a"]
    _ensure_member(settings, two_tenants["token_a"], ws_a, VIEWER_ID, "viewer")
    _ensure_member(settings, two_tenants["token_a"], ws_a, TECH_ID, "technician")
    viewer = _password_grant(settings, "ss.phase3.viewer@sitesecure.test", two_tenants["password"])
    tech = _password_grant(settings, "ss.phase3.tech@sitesecure.test", two_tenants["password"])

    denied_viewer = api.post(
        f"/api/v1/workspaces/{ws_a}/customers",
        headers=_auth(viewer),
        json={"display_name": "צופה"},
    )
    assert denied_viewer.status_code == 403

    denied_tech_quote = api.post(
        f"/api/v1/workspaces/{ws_a}/quotes",
        headers=_auth(tech),
        json={"customer_notes": "לא"},
    )
    assert denied_tech_quote.status_code == 403

    owner_customer = api.post(
        f"/api/v1/workspaces/{ws_a}/customers",
        headers=_auth(two_tenants["token_a"]),
        json={"display_name": "לטכנאי"},
    )
    assert owner_customer.status_code == 200
    listed_tech = api.get(
        f"/api/v1/workspaces/{ws_a}/customers",
        headers=_auth(tech),
    )
    assert listed_tech.status_code == 200
    assert listed_tech.json()["items"] == []


def test_storage_upload_intent_uses_user_jwt(settings, two_tenants, api):
    ws_a = two_tenants["ws_a"]
    a = _auth(two_tenants["token_a"])
    customer = api.post(
        f"/api/v1/workspaces/{ws_a}/customers",
        headers=a,
        json={"display_name": "מסמכים"},
    )
    assert customer.status_code == 200, customer.text
    intent = api.post(
        f"/api/v1/workspaces/{ws_a}/documents/uploads",
        headers=a,
        json={
            "entity_type": "customer",
            "entity_id": customer.json()["id"],
            "kind": "document",
            "original_filename": "spec.pdf",
        },
    )
    assert intent.status_code == 200, intent.text
    body = intent.json()
    assert body["upload_url"]
    assert str(ws_a) in body["storage_path"]
    assert "service_role" not in body["upload_url"]

    b = _auth(two_tenants["token_b"])
    assert api.get(
        f"/api/v1/workspaces/{ws_a}/documents/{body['document_id']}/url",
        headers=b,
    ).status_code in {403, 404}


def test_dashboard_isolation_and_no_vanity(two_tenants, api):
    ws_a = two_tenants["ws_a"]
    ws_b = two_tenants["ws_b"]
    a = _auth(two_tenants["token_a"])
    b = _auth(two_tenants["token_b"])

    mine = api.get(f"/api/v1/workspaces/{ws_a}/dashboard", headers=a)
    assert mine.status_code == 200, mine.text
    body = mine.json()
    assert body["home_variant"] == "ops"
    assert "kpis" not in body
    assert "revenue" not in body
    assert "cost_total" not in str(body)

    other = api.get(f"/api/v1/workspaces/{ws_a}/dashboard", headers=b)
    assert other.status_code in {403, 404}

    wrong_path = api.get(f"/api/v1/workspaces/{ws_b}/dashboard", headers=a)
    assert wrong_path.status_code in {403, 404}
