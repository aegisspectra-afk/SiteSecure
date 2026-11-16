"""Q2.7 starter catalog, live on LOCAL Supabase (migration 20261115120000 applied locally).

New workspaces get it automatically; POST /catalog/starter loads it for existing ones,
idempotently; sample prices are marked until the price is edited.
"""

from __future__ import annotations

import uuid
from urllib.parse import urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from tests.test_d1_dashboard_live import _owner_workspace, _svc
from tests.test_ssp_c5_e2e_connection import _auth, _create_local_user, _password_grant, _snippet

pytestmark = pytest.mark.live
MARKER = "מחיר לדוגמה – עדכן"
STARTER_COUNT = 15


@pytest.fixture(scope="module")
def settings():
    get_settings.cache_clear()
    s = get_settings()
    assert urlparse(s.supabase_url).hostname in {"127.0.0.1", "localhost"}, "local Supabase only"
    return s


def _products(s, ws_id: str) -> list[dict]:
    res = httpx.get(
        f"{s.supabase_url}/rest/v1/products?workspace_id=eq.{ws_id}&select=id,sku,name,list_price,description,metadata,category_id,attributes&order=sku",
        headers=_svc(s),
        timeout=30,
    )
    assert res.status_code == 200, res.text
    return res.json()


def _sales_token(s, ws_id: str) -> str:
    marker = uuid.uuid4().hex[:10]
    email, password = f"ss.q2.cat.sales.{marker}@sitesecure.test", f"Q2-{marker}-9x"
    uid = _create_local_user(s, email, password)
    httpx.post(
        f"{s.supabase_url}/rest/v1/workspace_memberships",
        headers={**_svc(s), "Prefer": "return=minimal"},
        json={"workspace_id": ws_id, "user_id": uid, "role_key": "sales", "status": "active"},
        timeout=30,
    ).raise_for_status()
    return _password_grant(s, email, password)


def test_new_workspace_gets_the_starter_catalog(settings):
    s, api = settings, TestClient(app)
    _owner, ws = _owner_workspace(s, api, "starter-new")
    rows = _products(s, ws)
    starter = [r for r in rows if (r.get("metadata") or {}).get("starter_catalog") == "v1"]
    assert len(starter) == STARTER_COUNT, [r["sku"] for r in rows]
    assert all(r["description"] == MARKER and (r["metadata"] or {}).get("sample_price") is True for r in starter)
    assert all(r["category_id"] for r in starter), "every starter item is placed in a category"
    by_sku = {r["sku"]: r for r in starter}
    assert by_sku["SS-NVR-8CH-POE"]["attributes"]["poe_ports"] == 8
    assert by_sku["SS-HDD-4TB"]["attributes"]["capacity_tb"] == 4


def test_loading_again_skips_existing_items_and_keeps_edits(settings):
    s, api = settings, TestClient(app)
    owner, ws = _owner_workspace(s, api, "starter-again")
    url = f"/api/v1/workspaces/{ws}/catalog/starter"
    first = api.post(url, headers=_auth(owner))
    assert first.status_code == 200, _snippet(first)
    assert first.json() == {"inserted": 0, "skipped": STARTER_COUNT, "missing_category": 0}

    cam = next(r for r in _products(s, ws) if r["sku"] == "SS-CAM-4MP-DOME")
    edited = api.patch(f"/api/v1/workspaces/{ws}/catalog/products/{cam['id']}", headers=_auth(owner), json={"list_price": 455})
    assert edited.status_code == 200, _snippet(edited)
    httpx.delete(f"{s.supabase_url}/rest/v1/products?workspace_id=eq.{ws}&sku=eq.SS-HDD-6TB", headers=_svc(s), timeout=30).raise_for_status()

    again = api.post(url, headers=_auth(owner))
    assert again.json() == {"inserted": 1, "skipped": STARTER_COUNT - 1, "missing_category": 0}
    cam_after = next(r for r in _products(s, ws) if r["sku"] == "SS-CAM-4MP-DOME")
    assert float(cam_after["list_price"]) == 455, "an edited price is never overwritten"
    assert len(_products(s, ws)) == STARTER_COUNT


def test_editing_the_price_clears_the_sample_marker(settings):
    s, api = settings, TestClient(app)
    owner, ws = _owner_workspace(s, api, "starter-marker")
    sw = next(r for r in _products(s, ws) if r["sku"] == "SS-SW-8P-POE")
    assert sw["description"] == MARKER
    res = api.patch(f"/api/v1/workspaces/{ws}/catalog/products/{sw['id']}", headers=_auth(owner), json={"list_price": 520})
    assert res.status_code == 200, _snippet(res)
    after = next(r for r in _products(s, ws) if r["sku"] == "SS-SW-8P-POE")
    assert after["description"] == "" and (after["metadata"] or {}).get("sample_price") is False
    # Renaming only keeps the marker: the price is still a sample.
    hdd = next(r for r in _products(s, ws) if r["sku"] == "SS-HDD-2TB")
    api.patch(f"/api/v1/workspaces/{ws}/catalog/products/{hdd['id']}", headers=_auth(owner), json={"name": "HDD 2TB"})
    assert next(r for r in _products(s, ws) if r["sku"] == "SS-HDD-2TB")["description"] == MARKER


def test_starter_load_needs_catalog_edit_and_is_workspace_scoped(settings):
    s, api = settings, TestClient(app)
    owner_a, ws_a = _owner_workspace(s, api, "starter-a")
    owner_b, _ws_b = _owner_workspace(s, api, "starter-b")
    sales = _sales_token(s, ws_a)
    denied = api.post(f"/api/v1/workspaces/{ws_a}/catalog/starter", headers=_auth(sales))
    assert denied.status_code == 403, _snippet(denied)
    other = api.post(f"/api/v1/workspaces/{ws_a}/catalog/starter", headers=_auth(owner_b))
    assert other.status_code in {403, 404}, _snippet(other)
    assert len(_products(s, ws_a)) == STARTER_COUNT
    ok = api.post(f"/api/v1/workspaces/{ws_a}/catalog/starter", headers=_auth(owner_a))
    assert ok.status_code == 200, _snippet(ok)
