"""DEMO-5 §4.6 + §4.25: parallel / replayed complete creates one of each side effect (LOCAL).

Same Idempotency-Key twice (sequential) and two concurrent completes → exactly one
warranty, one billing_pending_item, one job.completed notification, one active handover.
Without claim + unique indexes these counts blow up.
"""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from urllib.parse import urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from tests.test_d1_dashboard_live import _owner_workspace, _svc, _svc_insert
from tests.test_demo1_technician_scope_live import _member
from tests.test_demo4_job_signature_live import PNG
from tests.test_ssp_c5_e2e_connection import _auth, _snippet

pytestmark = pytest.mark.live


def _svc_patch(s, table: str, params: dict, body: dict) -> None:
    res = httpx.patch(
        f"{s.supabase_url}/rest/v1/{table}",
        headers=_svc(s),
        params=params,
        json=body,
        timeout=30,
    )
    assert res.status_code in {200, 204}, res.text


def _count(s, table: str, params: dict) -> int:
    res = httpx.get(
        f"{s.supabase_url}/rest/v1/{table}",
        headers={**_svc(s), "Prefer": "count=exact"},
        params={**params, "select": "id"},
        timeout=30,
    )
    assert res.status_code == 200, res.text
    total = res.headers.get("content-range", "").split("/")[-1]
    if total.isdigit():
        return int(total)
    return len(res.json())


@pytest.fixture(scope="module")
def env():
    get_settings.cache_clear()
    s = get_settings()
    assert urlparse(s.supabase_url).hostname in {"127.0.0.1", "localhost"}
    api = TestClient(app)
    owner, ws = _owner_workspace(s, api, "d5-idem")
    tech_id, tech = _member(s, ws, "technician")
    _mgr_id, _mgr = _member(s, ws, "manager")
    _svc_patch(s, "workspaces", {"id": f"eq.{ws}"}, {"field_ops": {"warranty_months": 12}})
    cust = _svc_insert(
        s,
        "customers",
        {"workspace_id": ws, "display_name": "לקוח סיום", "email": "d5@example.invalid"},
    )["id"]
    site = _svc_insert(s, "sites", {"workspace_id": ws, "customer_id": cust, "code": "CMP", "name": "אתר"})["id"]
    return dict(s=s, api=api, owner=owner, tech=tech, tech_id=tech_id, ws=ws, cust=cust, site=site)


def _ready_job(env) -> str:
    """in_progress job with signature, no checklist blockers (direct insert)."""
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
        json={"signer_name": "לקוח דמו", "signature_data_url": PNG},
    )
    assert sig.status_code == 200, _snippet(sig)
    return jid


def _complete(env, jid: str, key: str):
    return env["api"].post(
        f"/api/v1/workspaces/{env['ws']}/jobs/{jid}/complete",
        headers={**_auth(env["owner"]), "Idempotency-Key": key},
        json={"completion_notes": "סיום"},
    )


def _assert_one_each(env, jid: str) -> None:
    s, ws = env["s"], env["ws"]
    assert _count(s, "warranties", {"workspace_id": f"eq.{ws}", "job_id": f"eq.{jid}"}) == 1
    assert _count(s, "billing_pending_items", {"workspace_id": f"eq.{ws}", "job_id": f"eq.{jid}"}) == 1
    assert (
        _count(
            s,
            "notifications",
            {
                "workspace_id": f"eq.{ws}",
                "entity_id": f"eq.{jid}",
                "type": "eq.job.completed",
            },
        )
        == 1
    )
    assert (
        _count(
            s,
            "handover_public_access",
            {"workspace_id": f"eq.{ws}", "job_id": f"eq.{jid}", "revoked_at": "is.null"},
        )
        == 1
    )
    assert _count(s, "outbound_messages", {"workspace_id": f"eq.{ws}", "job_id": f"eq.{jid}"}) == 1


def test_same_idempotency_key_twice_creates_one_of_each(env):
    jid = _ready_job(env)
    key = uuid.uuid4().hex
    first, second = _complete(env, jid, key), _complete(env, jid, key)
    assert first.status_code == 200, _snippet(first)
    assert second.status_code == 200, _snippet(second)
    assert second.json().get("replay") is True
    assert first.json()["warranty_id"] == second.json()["warranty_id"]
    assert first.json()["handover_url"] == second.json()["handover_url"]
    _assert_one_each(env, jid)


def test_two_parallel_completes_same_key_create_one_of_each(env):
    jid = _ready_job(env)
    key = uuid.uuid4().hex
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: _complete(env, jid, key), range(2)))
    assert all(r.status_code == 200 for r in results), [_snippet(r) for r in results]
    urls = {r.json().get("handover_url") for r in results}
    warranties = {r.json().get("warranty_id") for r in results}
    assert len(urls) == 1 and len(warranties) == 1
    _assert_one_each(env, jid)
