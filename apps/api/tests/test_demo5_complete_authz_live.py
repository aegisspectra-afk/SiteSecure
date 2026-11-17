"""DEMO-5 authz/idempotency hardening around completed jobs (LOCAL).

Covers the 9e17c33 authz change that allows jobs.complete on status=completed
so Idempotency-Key replay can reach the handler — without weakening isolation.

Each assertion fails open without the matching guard:
1. different key after complete → JOB_ALREADY_COMPLETED, no new side effects
2. same key + different body → IDEMPOTENCY_CONFLICT
3. other / unassigned technician on a completed job → 404 (scope), not 409
"""

from __future__ import annotations

import uuid
from urllib.parse import urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from tests.test_d1_dashboard_live import _owner_workspace, _svc, _svc_insert
from tests.test_demo1_technician_scope_live import _member
from tests.test_demo4_job_signature_live import PNG
from tests.test_demo5_complete_idempotency_live import _count, _ready_job, _svc_patch
from tests.test_ssp_c5_e2e_connection import _auth, _snippet

pytestmark = pytest.mark.live


@pytest.fixture(scope="module")
def env():
    get_settings.cache_clear()
    s = get_settings()
    assert urlparse(s.supabase_url).hostname in {"127.0.0.1", "localhost"}
    api = TestClient(app)
    owner, ws = _owner_workspace(s, api, "d5-authz")
    tech_a_id, tech_a = _member(s, ws, "technician")
    _tech_b_id, tech_b = _member(s, ws, "technician")
    _member(s, ws, "manager")
    _svc_patch(s, "workspaces", {"id": f"eq.{ws}"}, {"field_ops": {"warranty_months": 12}})
    cust = _svc_insert(
        s,
        "customers",
        {"workspace_id": ws, "display_name": "לקוח authz", "email": "authz@example.invalid"},
    )["id"]
    site = _svc_insert(s, "sites", {"workspace_id": ws, "customer_id": cust, "code": "AZ1", "name": "אתר"})["id"]
    # Adapt shared helper env shape (uses tech / tech_id).
    return dict(
        s=s,
        api=api,
        owner=owner,
        tech=tech_a,
        tech_id=tech_a_id,
        tech_b=tech_b,
        ws=ws,
        cust=cust,
        site=site,
    )


def _complete(env, jid: str, key: str, *, tok: str | None = None, notes: str | None = "סיום"):
    body = {} if notes is None else {"completion_notes": notes}
    return env["api"].post(
        f"/api/v1/workspaces/{env['ws']}/jobs/{jid}/complete",
        headers={**_auth(tok or env["owner"]), "Idempotency-Key": key},
        json=body,
    )


def _side_effect_counts(env, jid: str) -> dict[str, int]:
    s, ws = env["s"], env["ws"]
    return {
        "warranties": _count(s, "warranties", {"workspace_id": f"eq.{ws}", "job_id": f"eq.{jid}"}),
        "billing": _count(s, "billing_pending_items", {"workspace_id": f"eq.{ws}", "job_id": f"eq.{jid}"}),
        "notifications": _count(
            s,
            "notifications",
            {"workspace_id": f"eq.{ws}", "entity_id": f"eq.{jid}", "type": "eq.job.completed"},
        ),
        "handover": _count(
            s,
            "handover_public_access",
            {"workspace_id": f"eq.{ws}", "job_id": f"eq.{jid}", "revoked_at": "is.null"},
        ),
        "outbound": _count(s, "outbound_messages", {"workspace_id": f"eq.{ws}", "job_id": f"eq.{jid}"}),
    }


def test_different_key_after_complete_is_409_and_creates_nothing(env):
    jid = _ready_job(env)
    first = _complete(env, jid, uuid.uuid4().hex, notes="סיום א")
    assert first.status_code == 200, _snippet(first)
    before = _side_effect_counts(env, jid)
    assert before == {"warranties": 1, "billing": 1, "notifications": 1, "handover": 1, "outbound": 1}

    second = _complete(env, jid, uuid.uuid4().hex, notes="סיום ב")
    assert second.status_code == 409, _snippet(second)
    assert second.json()["error"]["code"] == "JOB_ALREADY_COMPLETED"
    assert _side_effect_counts(env, jid) == before

    job = httpx.get(
        f"{env['s'].supabase_url}/rest/v1/jobs",
        headers=_svc(env["s"]),
        params={"id": f"eq.{jid}", "select": "completion_notes,completion_idempotency_key"},
        timeout=30,
    ).json()[0]
    assert job["completion_notes"] == "סיום א"
    assert job["completion_idempotency_key"] == first.request.headers["Idempotency-Key"]


def test_same_key_different_payload_is_409_conflict(env):
    jid = _ready_job(env)
    key = uuid.uuid4().hex
    first = _complete(env, jid, key, notes="הערות מקור")
    assert first.status_code == 200, _snippet(first)
    before = _side_effect_counts(env, jid)

    conflict = _complete(env, jid, key, notes="הערות אחרות")
    assert conflict.status_code == 409, _snippet(conflict)
    assert conflict.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"
    assert _side_effect_counts(env, jid) == before

    replay = _complete(env, jid, key, notes="הערות מקור")
    assert replay.status_code == 200, _snippet(replay)
    assert replay.json().get("replay") is True
    assert _side_effect_counts(env, jid) == before


def test_other_or_unassigned_technician_gets_404_on_completed_job(env):
    jid = _ready_job(env)
    done = _complete(env, jid, uuid.uuid4().hex)
    assert done.status_code == 200, _snippet(done)
    before = _side_effect_counts(env, jid)

    # Tech B is in the workspace but not assigned to this job.
    other = _complete(env, jid, uuid.uuid4().hex, tok=env["tech_b"], notes="x")
    assert other.status_code == 404, _snippet(other)
    assert other.json()["error"]["code"] == "NOT_FOUND"

    # Unassigned technician: create a third tech with no assignments.
    _uid, lonely = _member(env["s"], env["ws"], "technician")
    lonely_res = _complete(env, jid, uuid.uuid4().hex, tok=lonely, notes="y")
    assert lonely_res.status_code == 404, _snippet(lonely_res)
    assert lonely_res.json()["error"]["code"] == "NOT_FOUND"

    assert _side_effect_counts(env, jid) == before
