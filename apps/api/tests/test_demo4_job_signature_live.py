"""DEMO-4.1: customer signature on a job, live on LOCAL Supabase.

Signer name + date + PNG, stored in the private "signatures" bucket under
{workspace}/job/{job}/..., linked to the job and shown on it. Only the assigned technician
(or managers) can collect it, only while the job is on site, and the signature columns can
not be written straight through PostgREST.
"""

from __future__ import annotations

import base64
import uuid
from urllib.parse import urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from tests.test_d1_dashboard_live import _owner_workspace, _svc, _svc_insert
from tests.test_demo1_technician_scope_live import _member
from tests.test_ssp_c5_e2e_connection import _auth, _snippet

pytestmark = pytest.mark.live

# 1x1 white PNG
PNG = "data:image/png;base64," + base64.b64encode(
    bytes.fromhex(
        "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
        "1f15c4890000000d49444154789c63f8ffffff7f0009fb03fd2a86e38a0000000049454e44ae426082"
    )
).decode()


@pytest.fixture(scope="module")
def env():
    get_settings.cache_clear()
    s = get_settings()
    assert urlparse(s.supabase_url).hostname in {"127.0.0.1", "localhost"}, "local Supabase only"
    api = TestClient(app)
    owner, ws = _owner_workspace(s, api, "demo4-sig")
    a_id, a = _member(s, ws, "technician")
    _, b = _member(s, ws, "technician")
    cust = _svc_insert(s, "customers", {"workspace_id": ws, "display_name": "לקוח"})["id"]
    site = _svc_insert(s, "sites", {"workspace_id": ws, "customer_id": cust, "code": "SIG", "name": "אתר"})["id"]

    def job(status):
        jid = _svc_insert(s, "jobs", {"workspace_id": ws, "number": f"J-{uuid.uuid4().hex[:6]}", "title": "התקנה",
                                      "customer_id": cust, "site_id": site, "status": status})["id"]
        _svc_insert(s, "assignments", {"workspace_id": ws, "user_id": a_id, "resource_type": "job", "resource_id": jid})
        return jid

    return dict(s=s, api=api, ws=ws, owner=owner, a=a, b=b, a_id=a_id, job=job)


def _sign(env, tok, jid, **body):
    payload = {"signer_name": "דני אורן", "signature_data_url": PNG, **body}
    return env["api"].post(f"/api/v1/workspaces/{env['ws']}/jobs/{jid}/signature", headers=_auth(tok), json=payload)


def test_technician_collects_signature_and_it_shows_on_the_job(env):
    jid = env["job"]("in_progress")
    res = _sign(env, env["a"], jid)
    assert res.status_code == 200, _snippet(res)
    body = res.json()
    assert body["signer_name"] == "דני אורן" and body["signed_at"] and body["document_id"]

    job = env["api"].get(f"/api/v1/workspaces/{env['ws']}/jobs/{jid}", headers=_auth(env["owner"])).json()
    assert job["customer_signer_name"] == "דני אורן"
    assert job["customer_signed_at"] and job["customer_signature_document_id"] == body["document_id"]
    assert job["customer_signed_by"] == env["a_id"]

    doc = httpx.get(f"{env['s'].supabase_url}/rest/v1/documents", headers=_svc(env["s"]), timeout=30,
                    params={"id": f"eq.{body['document_id']}", "select": "*"}).json()[0]
    assert doc["entity_type"] == "job" and doc["entity_id"] == jid and doc["kind"] == "signature"
    assert doc["storage_bucket"] == "signatures"
    assert doc["storage_path"].startswith(f"{env['ws']}/job/{jid}/")
    for tok in (env["a"], env["owner"]):
        url = env["api"].get(f"/api/v1/workspaces/{env['ws']}/documents/{body['document_id']}/url", headers=_auth(tok))
        assert url.status_code == 200, _snippet(url)


def test_other_technician_cannot_sign_or_see_it(env):
    jid = env["job"]("in_progress")
    assert _sign(env, env["b"], jid).status_code == 404
    doc_id = _sign(env, env["a"], jid).json()["document_id"]
    assert env["api"].get(f"/api/v1/workspaces/{env['ws']}/documents/{doc_id}/url", headers=_auth(env["b"])).status_code == 404


@pytest.mark.parametrize(
    "body",
    [
        {"signer_name": ""},
        {"signer_name": "   "},
        {"signature_data_url": "not-an-image"},
        {"signature_data_url": "data:text/plain;base64,aGVsbG8="},
    ],
)
def test_invalid_signature_is_rejected(env, body):
    jid = env["job"]("in_progress")
    assert _sign(env, env["a"], jid, **body).status_code in {400, 422}


@pytest.mark.parametrize("status", ["scheduled", "completed", "cancelled"])
def test_signature_only_while_on_site(env, status):
    jid = env["job"](status)
    res = _sign(env, env["a"], jid)
    # not on site yet: 409; completed / cancelled: the engine's RESOURCE_STATE (403) first.
    assert res.status_code in {403, 409}, _snippet(res)
    assert res.json()["error"]["code"] in {"BUSINESS_RULE", "RESOURCE_STATE"}
    row = httpx.get(f"{env['s'].supabase_url}/rest/v1/jobs", headers=_svc(env["s"]), timeout=30,
                    params={"id": f"eq.{jid}", "select": "customer_signer_name"}).json()[0]
    assert row["customer_signer_name"] is None


def test_signature_columns_cannot_be_forged_through_postgrest(env):
    jid = env["job"]("in_progress")
    s = env["s"]
    res = httpx.patch(f"{s.supabase_url}/rest/v1/jobs", params={"id": f"eq.{jid}"}, timeout=30,
                      headers={"apikey": s.supabase_anon_key, "Authorization": f"Bearer {env['a']}",
                               "Content-Type": "application/json", "Prefer": "return=representation"},
                      json={"customer_signer_name": "מזויף", "customer_signed_at": "2026-11-17T08:00:00Z"})
    assert res.status_code in {400, 401, 403}, res.text
    row = httpx.get(f"{s.supabase_url}/rest/v1/jobs", headers=_svc(s), timeout=30,
                    params={"id": f"eq.{jid}", "select": "customer_signer_name"}).json()[0]
    assert row["customer_signer_name"] is None
