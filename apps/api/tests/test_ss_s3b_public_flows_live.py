"""S3b: flows without a logged-in user still work after function EXECUTE was locked down.

Each RPC below is now service_role only (migration 20261113120000). These tests drive the
public API endpoints end to end against LOCAL Supabase and prove the API reaches them with
the service role (a grant regression would surface as 'invalid' / 5xx, not as success).
"""

from __future__ import annotations

import uuid
from urllib.parse import urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from tests.test_ssp_c5_e2e_connection import _auth, _create_local_user, _enable_ssp, _password_grant, _snippet

pytestmark = pytest.mark.live


@pytest.fixture(scope="module")
def settings():
    get_settings.cache_clear()
    s = get_settings()
    assert urlparse(s.supabase_url).hostname in {"127.0.0.1", "localhost"}, "local Supabase only"
    assert s.supabase_service_role_key, "local service role key required"
    return s


def _svc(s) -> dict[str, str]:
    key = s.supabase_service_role_key
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def _svc_get(s, table: str, query: str) -> list[dict]:
    res = httpx.get(f"{s.supabase_url}/rest/v1/{table}?{query}", headers=_svc(s), timeout=30)
    assert res.status_code == 200, res.text
    return res.json()


def _owner_workspace(s, api: TestClient, label: str) -> tuple[str, str]:
    marker = uuid.uuid4().hex[:10]
    email, password = f"ss.s3b.{label}.{marker}@sitesecure.test", f"S3b-{marker}-9x"
    _create_local_user(s, email, password)
    token = _password_grant(s, email, password)
    ws = api.post("/api/v1/workspaces", headers=_auth(token), json={"name": f"S3b {label} {marker}"})
    assert ws.status_code in {200, 201}, _snippet(ws)
    return token, str(ws.json()["id"])


def _ssp_workspace(s, api: TestClient, label: str) -> tuple[str, str]:
    token, ws_id = _owner_workspace(s, api, label)
    _enable_ssp(s, ws_id)
    boot = api.post(f"/api/v1/workspaces/{ws_id}/ssp/org/bootstrap", headers=_auth(token), json={"name": f"חברה {label}"})
    assert boot.status_code in {200, 201, 409}, _snippet(boot)
    return token, ws_id


def test_invitation_public_peek_and_accept(settings):
    """invitation_public_preview (service) + accept_invitation (member JWT)."""
    s, api = settings, TestClient(app)
    owner, ws_id = _owner_workspace(s, api, "invite")
    # Solo has one seat; this test is about the invite path, not plan quotas.
    httpx.patch(
        f"{s.supabase_url}/rest/v1/subscriptions?workspace_id=eq.{ws_id}",
        headers={**_svc(s), "Prefer": "return=minimal"},
        json={"plan_key": "business"},
        timeout=30,
    ).raise_for_status()
    marker = uuid.uuid4().hex[:10]
    invitee_email, password = f"ss.s3b.invitee.{marker}@sitesecure.test", f"S3b-{marker}-9x"
    invite = api.post(
        f"/api/v1/workspaces/{ws_id}/invitations",
        headers=_auth(owner),
        json={"email": invitee_email, "role_key": "sales"},
    )
    assert invite.status_code == 200, _snippet(invite)
    token = invite.json()["token"]
    assert token

    public = api.get("/api/v1/invitations/public-peek", params={"token": token})
    assert public.status_code == 200, _snippet(public)
    # 'invalid' is what the endpoint returns if the service RPC fails. The pre-auth preview
    # intentionally does not expose the workspace id.
    assert public.json()["status"] == "valid", public.json()

    _create_local_user(s, invitee_email, password)
    invitee = _password_grant(s, invitee_email, password)
    peek = api.get("/api/v1/invitations/peek", params={"token": token}, headers=_auth(invitee))
    assert peek.status_code == 200 and peek.json()["status"] == "valid", _snippet(peek)
    accepted = api.post("/api/v1/invitations/accept", headers=_auth(invitee), json={"token": token})
    assert accepted.status_code == 200, _snippet(accepted)
    rows = _svc_get(s, "workspace_memberships", f"workspace_id=eq.{ws_id}&role_key=eq.sales&select=user_id,status")
    assert len(rows) == 1 and rows[0]["status"] == "active", rows


def test_ssp_public_form_link_open_and_submit(settings):
    """GET/submit /public/ssp/assignments/{token} -> ssp_public_submit (service)."""
    s, api = settings, TestClient(app)
    owner, ws_id = _ssp_workspace(s, api, "form")
    form = api.post(
        f"/api/v1/workspaces/{ws_id}/ssp/forms",
        headers=_auth(owner),
        json={"title": "שאלון ציבורי", "description": "", "category": "personal_questionnaire"},
    )
    assert form.status_code in {200, 201}, _snippet(form)
    form_id = form.json()["id"]
    field_id = str(uuid.uuid4())
    defined = api.put(
        f"/api/v1/workspaces/{ws_id}/ssp/forms/{form_id}/definition",
        headers=_auth(owner),
        json={"definition": {"fields": [{"id": field_id, "type": "short_text", "label": "שם", "required": True}]}},
    )
    assert defined.status_code == 200, _snippet(defined)
    published = api.post(f"/api/v1/workspaces/{ws_id}/ssp/forms/{form_id}/publish", headers=_auth(owner))
    assert published.status_code == 200, _snippet(published)
    link = api.post(f"/api/v1/workspaces/{ws_id}/ssp/forms/{form_id}/assignments", headers=_auth(owner), json={"label": "קישור"})
    assert link.status_code == 201, _snippet(link)
    token = link.json()["public_token"]

    opened = api.get(f"/api/v1/public/ssp/assignments/{token}")
    assert opened.status_code == 200, _snippet(opened)
    submitted = api.post(
        f"/api/v1/public/ssp/assignments/{token}/submit",
        json={"answers": {field_id: "ישראל"}, "idempotency_key": uuid.uuid4().hex},
    )
    assert submitted.status_code == 201, _snippet(submitted)
    assert _svc_get(s, "ssp_form_submissions", f"workspace_id=eq.{ws_id}&select=id"), "submission not stored"

    bad = api.get(f"/api/v1/public/ssp/assignments/{uuid.uuid4().hex}{uuid.uuid4().hex}")
    assert bad.status_code == 404, _snippet(bad)


def test_ssp_site_activation_code_to_device_session(settings):
    """site-activate -> ssp_consume_activation_code, approve -> ssp_approve_site_enrollment (service)."""
    s, api = settings, TestClient(app)
    owner, ws_id = _ssp_workspace(s, api, "device")
    site = api.post(f"/api/v1/workspaces/{ws_id}/ssp/sites", headers=_auth(owner), json={"name": "עמדה ראשית", "kind": "office"})
    assert site.status_code in {200, 201}, _snippet(site)
    site_id = str(site.json()["id"])
    issued = api.post(f"/api/v1/workspaces/{ws_id}/ssp/sites/{site_id}/activation-codes", headers=_auth(owner), json={})
    assert issued.status_code == 201, _snippet(issued)
    code = issued.json()["code"]

    activated = api.post("/api/v1/public/ssp/site-activate", json={"code": code, "device_label": "טאבלט עמדה"})
    assert activated.status_code in {200, 201}, _snippet(activated)
    poll = activated.json()["poll_token"]
    pending = api.get(f"/api/v1/public/ssp/site-enrollments/{poll}")
    assert pending.status_code == 200 and pending.json()["status"] == "pending", _snippet(pending)

    approved = api.post(
        f"/api/v1/workspaces/{ws_id}/ssp/enrollments/{pending.json()['enrollment_id']}/approve",
        headers=_auth(owner),
    )
    assert approved.status_code == 200, _snippet(approved)
    claimed = api.post(f"/api/v1/public/ssp/site-enrollments/{poll}/claim")
    assert claimed.status_code in {200, 201}, _snippet(claimed)
    device_token = claimed.json()["device_token"]
    me = api.get("/api/v1/public/ssp/site-device/me", headers={"X-SSP-Device-Token": device_token})
    assert me.status_code == 200, _snippet(me)
    assert str(me.json()["site"]["id"]) == site_id

    reused = api.post("/api/v1/public/ssp/site-activate", json={"code": code, "device_label": "שני"})
    assert reused.status_code >= 400, _snippet(reused)
