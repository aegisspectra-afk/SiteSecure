"""Q2.6 hourly labor rate (workspace_settings.quotes.labor_hourly_rate), live on LOCAL Supabase.

Readable by quote builders, editable with workspace.edit, no default, workspace scoped.
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


@pytest.fixture(scope="module")
def settings():
    get_settings.cache_clear()
    s = get_settings()
    assert urlparse(s.supabase_url).hostname in {"127.0.0.1", "localhost"}, "local Supabase only"
    return s


def _member_token(s, ws_id: str, role: str) -> str:
    marker = uuid.uuid4().hex[:10]
    email, password = f"ss.q2.{role}.{marker}@sitesecure.test", f"Q2-{marker}-9x"
    uid = _create_local_user(s, email, password)
    httpx.post(
        f"{s.supabase_url}/rest/v1/workspace_memberships",
        headers={**_svc(s), "Prefer": "return=minimal"},
        json={"workspace_id": ws_id, "user_id": uid, "role_key": role, "status": "active"},
        timeout=30,
    ).raise_for_status()
    return _password_grant(s, email, password)


def test_owner_sets_rate_and_quote_builders_read_it(settings):
    s, api = settings, TestClient(app)
    owner, ws = _owner_workspace(s, api, "rate")
    url = f"/api/v1/workspaces/{ws}/settings/labor-rate"

    first = api.get(url, headers=_auth(owner))
    assert first.status_code == 200, _snippet(first)
    assert first.json() == {"labor_hourly_rate": None, "can_edit": True}  # no default

    put = api.put(url, headers=_auth(owner), json={"labor_hourly_rate": 250})
    assert put.status_code == 200, _snippet(put)
    assert put.json()["labor_hourly_rate"] == 250
    assert api.get(url, headers=_auth(owner)).json()["labor_hourly_rate"] == 250

    # Other quote settings are kept.
    full = api.get(f"/api/v1/workspaces/{ws}/settings", headers=_auth(owner)).json()
    assert full["quotes"]["labor_hourly_rate"] == 250

    sales = _member_token(s, ws, "sales")
    read = api.get(url, headers=_auth(sales))
    assert read.status_code == 200, _snippet(read)
    assert read.json() == {"labor_hourly_rate": 250, "can_edit": False}
    denied = api.put(url, headers=_auth(sales), json={"labor_hourly_rate": 1})
    assert denied.status_code == 403, _snippet(denied)
    assert api.get(url, headers=_auth(owner)).json()["labor_hourly_rate"] == 250

    cleared = api.put(url, headers=_auth(owner), json={"labor_hourly_rate": None})
    assert cleared.status_code == 200 and cleared.json()["labor_hourly_rate"] is None


def test_invalid_rates_are_rejected(settings):
    s, api = settings, TestClient(app)
    owner, ws = _owner_workspace(s, api, "rate-bad")
    url = f"/api/v1/workspaces/{ws}/settings/labor-rate"
    for bad in (0, -5, 20000, "abc"):
        res = api.put(url, headers=_auth(owner), json={"labor_hourly_rate": bad})
        assert res.status_code in {400, 422}, (bad, _snippet(res))
    patched = api.patch(f"/api/v1/workspaces/{ws}/settings", headers=_auth(owner), json={"quotes": {"labor_hourly_rate": "abc"}})
    assert patched.status_code == 400, _snippet(patched)


def test_rate_is_workspace_scoped(settings):
    s, api = settings, TestClient(app)
    owner_a, ws_a = _owner_workspace(s, api, "rate-a")
    owner_b, _ws_b = _owner_workspace(s, api, "rate-b")
    api.put(f"/api/v1/workspaces/{ws_a}/settings/labor-rate", headers=_auth(owner_a), json={"labor_hourly_rate": 300})
    other = api.get(f"/api/v1/workspaces/{ws_a}/settings/labor-rate", headers=_auth(owner_b))
    assert other.status_code in {403, 404}, _snippet(other)
    write = api.put(f"/api/v1/workspaces/{ws_a}/settings/labor-rate", headers=_auth(owner_b), json={"labor_hourly_rate": 1})
    assert write.status_code in {403, 404}, _snippet(write)
    assert api.get(f"/api/v1/workspaces/{ws_a}/settings/labor-rate", headers=_auth(owner_a)).json()["labor_hourly_rate"] == 300


def test_technician_cannot_read_rate(settings):
    s, api = settings, TestClient(app)
    _owner, ws = _owner_workspace(s, api, "rate-tech")
    tech = _member_token(s, ws, "technician")
    res = api.get(f"/api/v1/workspaces/{ws}/settings/labor-rate", headers=_auth(tech))
    assert res.status_code == 403, _snippet(res)
