"""D1 bug: "משתמשים במשרד 2/1". Only the invite path checked the seat limit; changing a
member's role into the office bucket, or reactivating a disabled one, did not.

LOCAL Supabase only. Solo plan from catalog.json: seats_operator=1 (the owner).
"""

from __future__ import annotations

import uuid
from urllib.parse import urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from tests.test_ssp_c5_e2e_connection import _auth, _create_local_user, _password_grant, _snippet

pytestmark = pytest.mark.live


@pytest.fixture(scope="module")
def settings():
    get_settings.cache_clear()
    s = get_settings()
    assert urlparse(s.supabase_url).hostname in {"127.0.0.1", "localhost"}, "local Supabase only"
    assert s.supabase_service_role_key
    return s


def _svc(s) -> dict[str, str]:
    key = s.supabase_service_role_key
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def _owner_workspace(s, api: TestClient, label: str) -> tuple[str, str]:
    marker = uuid.uuid4().hex[:10]
    email, password = f"ss.d1.{label}.{marker}@sitesecure.test", f"D1-{marker}-9x"
    _create_local_user(s, email, password)
    token = _password_grant(s, email, password)
    ws = api.post("/api/v1/workspaces", headers=_auth(token), json={"name": f"D1 {label} {marker}"})
    assert ws.status_code in {200, 201}, _snippet(ws)
    return token, str(ws.json()["id"])


def _member(s, ws_id: str, role: str, status: str = "active") -> str:
    marker = uuid.uuid4().hex[:10]
    uid = _create_local_user(s, f"ss.d1.m.{marker}@sitesecure.test", f"D1-{marker}-9x")
    res = httpx.post(
        f"{s.supabase_url}/rest/v1/workspace_memberships",
        headers={**_svc(s), "Prefer": "return=representation"},
        json={"workspace_id": ws_id, "user_id": uid, "role_key": role, "status": status},
        timeout=30,
    )
    assert res.status_code == 201, res.text
    return str(res.json()[0]["id"])


def _role_of(s, member_id: str) -> tuple[str, str]:
    res = httpx.get(
        f"{s.supabase_url}/rest/v1/workspace_memberships?id=eq.{member_id}&select=role_key,status",
        headers=_svc(s),
        timeout=30,
    )
    row = res.json()[0]
    return row["role_key"], row["status"]


def test_role_change_into_full_office_bucket_is_refused(settings):
    s, api = settings, TestClient(app)
    owner, ws_id = _owner_workspace(s, api, "role")
    tech = _member(s, ws_id, "technician")

    res = api.patch(f"/api/v1/workspaces/{ws_id}/members/{tech}", headers=_auth(owner), json={"role_key": "sales"})
    assert res.status_code == 409, _snippet(res)
    assert res.json()["error"]["code"] == "PLAN_LIMIT_REACHED"
    assert _role_of(s, tech) == ("technician", "active")

    usage = api.get(f"/api/v1/workspaces/{ws_id}/usage", headers=_auth(owner)).json()
    office = next(m for m in usage["meters"] if m["key"] == "seats_operator")
    assert office["current"] <= office["limit"], office


def test_change_within_the_same_bucket_is_allowed(settings):
    s, api = settings, TestClient(app)
    owner, ws_id = _owner_workspace(s, api, "same")
    tech = _member(s, ws_id, "technician")
    res = api.patch(f"/api/v1/workspaces/{ws_id}/members/{tech}", headers=_auth(owner), json={"role_key": "viewer"})
    assert res.status_code == 200, _snippet(res)
    assert _role_of(s, tech)[0] == "viewer"


def test_reactivating_into_full_bucket_is_refused_and_disabling_is_allowed(settings):
    s, api = settings, TestClient(app)
    owner, ws_id = _owner_workspace(s, api, "react")
    sales = _member(s, ws_id, "sales", status="disabled")
    res = api.patch(f"/api/v1/workspaces/{ws_id}/members/{sales}", headers=_auth(owner), json={"status": "active"})
    assert res.status_code == 409, _snippet(res)
    assert _role_of(s, sales) == ("sales", "disabled")

    tech = _member(s, ws_id, "technician")
    off = api.patch(f"/api/v1/workspaces/{ws_id}/members/{tech}", headers=_auth(owner), json={"status": "disabled"})
    assert off.status_code == 200, _snippet(off)


def test_cross_workspace_member_patch_is_not_found(settings):
    s, api = settings, TestClient(app)
    _owner_a, ws_a = _owner_workspace(s, api, "xa")
    owner_b, _ws_b = _owner_workspace(s, api, "xb")
    tech_a = _member(s, ws_a, "technician")
    res = api.patch(f"/api/v1/workspaces/{ws_a}/members/{tech_a}", headers=_auth(owner_b), json={"role_key": "viewer"})
    assert res.status_code in {403, 404}, _snippet(res)
    assert _role_of(s, tech_a)[0] == "technician"
