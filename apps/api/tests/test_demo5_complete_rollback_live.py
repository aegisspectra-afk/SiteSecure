"""DEMO-5 §4.8: mid-complete failure rolls back — no partial state (LOCAL).

Inject a failure after the job is claimed and warranty/billing would otherwise stick.
Without _rollback_partial_completion the job stays completed with orphan side effects.
"""

from __future__ import annotations

import uuid
from urllib.parse import urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.errors import ApiError
from app.main import app
from tests.test_d1_dashboard_live import _owner_workspace, _svc, _svc_insert
from tests.test_demo1_technician_scope_live import _member
from tests.test_demo4_job_signature_live import PNG
from tests.test_demo5_complete_idempotency_live import _count, _svc_patch
from tests.test_ssp_c5_e2e_connection import _auth, _snippet

pytestmark = pytest.mark.live


@pytest.fixture(scope="module")
def env():
    get_settings.cache_clear()
    s = get_settings()
    assert urlparse(s.supabase_url).hostname in {"127.0.0.1", "localhost"}
    api = TestClient(app)
    owner, ws = _owner_workspace(s, api, "d5-rb")
    tech_id, tech = _member(s, ws, "technician")
    _member(s, ws, "manager")
    _svc_patch(s, "workspaces", {"id": f"eq.{ws}"}, {"field_ops": {"warranty_months": 12}})
    cust = _svc_insert(
        s,
        "customers",
        {"workspace_id": ws, "display_name": "לקוח כשל", "email": "rb@example.invalid"},
    )["id"]
    site = _svc_insert(s, "sites", {"workspace_id": ws, "customer_id": cust, "code": "RB1", "name": "אתר"})["id"]
    return dict(s=s, api=api, owner=owner, tech=tech, tech_id=tech_id, ws=ws, cust=cust, site=site)


def _ready_job(env) -> str:
    jid = _svc_insert(
        env["s"],
        "jobs",
        {
            "workspace_id": env["ws"],
            "number": f"J-{uuid.uuid4().hex[:6]}",
            "title": "התקנה",
            "customer_id": env["cust"],
            "site_id": env["site"],
            "status": "in_progress",
            "kind": "installation",
        },
    )["id"]
    _svc_insert(
        env["s"],
        "assignments",
        {
            "workspace_id": env["ws"],
            "user_id": env["tech_id"],
            "resource_type": "job",
            "resource_id": jid,
        },
    )
    sig = env["api"].post(
        f"/api/v1/workspaces/{env['ws']}/jobs/{jid}/signature",
        headers=_auth(env["tech"]),
        json={"signer_name": "לקוח", "signature_data_url": PNG},
    )
    assert sig.status_code == 200, _snippet(sig)
    return jid


def test_injected_failure_mid_complete_leaves_no_partial_state(env, monkeypatch):
    jid = _ready_job(env)

    def boom(*_a, **_k):
        raise ApiError(500, "INTERNAL", "כשל מכוון באמצע סיום")

    monkeypatch.setattr("app.installation_complete.mint_handover_link", boom)

    res = env["api"].post(
        f"/api/v1/workspaces/{env['ws']}/jobs/{jid}/complete",
        headers={**_auth(env["owner"]), "Idempotency-Key": uuid.uuid4().hex},
        json={"completion_notes": "לא אמור להישמר"},
    )
    assert res.status_code == 500, _snippet(res)

    s, ws = env["s"], env["ws"]
    job = httpx.get(
        f"{s.supabase_url}/rest/v1/jobs",
        headers=_svc(s),
        params={"id": f"eq.{jid}", "select": "status,completion_idempotency_key,completion_result,completed_at"},
        timeout=30,
    ).json()[0]
    assert job["status"] == "in_progress", job
    assert job["completion_idempotency_key"] is None
    assert job["completion_result"] is None
    assert job["completed_at"] is None

    assert _count(s, "warranties", {"workspace_id": f"eq.{ws}", "job_id": f"eq.{jid}"}) == 0
    assert _count(s, "billing_pending_items", {"workspace_id": f"eq.{ws}", "job_id": f"eq.{jid}"}) == 0
    assert (
        _count(
            s,
            "handover_public_access",
            {"workspace_id": f"eq.{ws}", "job_id": f"eq.{jid}", "revoked_at": "is.null"},
        )
        == 0
    )
    assert (
        _count(
            s,
            "notifications",
            {"workspace_id": f"eq.{ws}", "entity_id": f"eq.{jid}", "type": "eq.job.completed"},
        )
        == 0
    )
    assert _count(s, "outbound_messages", {"workspace_id": f"eq.{ws}", "job_id": f"eq.{jid}"}) == 0
