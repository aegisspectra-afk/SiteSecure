"""DEMO-5 §4.10: RLS on billing_pending_items and outbound_messages (LOCAL only).

- Technician cannot SELECT billing (managerial only).
- Manager can SELECT billing + outbound in their workspace.
- User from another workspace cannot SELECT or INSERT into either table for this workspace.
Without the RLS policies these assertions fail open.
"""

from __future__ import annotations

import uuid
from urllib.parse import urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from tests.test_d1_dashboard_live import _owner_workspace, _svc_insert
from tests.test_demo1_technician_scope_live import _member

pytestmark = pytest.mark.live


@pytest.fixture(scope="module")
def env():
    get_settings.cache_clear()
    s = get_settings()
    assert urlparse(s.supabase_url).hostname in {"127.0.0.1", "localhost"}
    api = TestClient(app)
    _owner, ws = _owner_workspace(s, api, "d5-rls")
    _tech_id, tech_tok = _member(s, ws, "technician")
    _, mgr_tok = _member(s, ws, "manager")
    other_owner, other_ws = _owner_workspace(s, api, "d5-rls-b")
    cust = _svc_insert(s, "customers", {"workspace_id": ws, "display_name": "לקוח דמו5"})["id"]
    site = _svc_insert(s, "sites", {"workspace_id": ws, "customer_id": cust, "code": "D5R", "name": "אתר"})["id"]
    job = _svc_insert(
        s,
        "jobs",
        {
            "workspace_id": ws,
            "number": f"J-{uuid.uuid4().hex[:6]}",
            "title": "התקנה",
            "customer_id": cust,
            "site_id": site,
            "status": "completed",
        },
    )["id"]
    billing = _svc_insert(
        s,
        "billing_pending_items",
        {
            "workspace_id": ws,
            "job_id": job,
            "amount_gross": 1000,
            "currency": "ILS",
            "status": "pending",
        },
    )["id"]
    outbound = _svc_insert(
        s,
        "outbound_messages",
        {
            "workspace_id": ws,
            "job_id": job,
            "channel": "email",
            "status": "preview",
            "recipient": "x@example.invalid",
            "subject": "תעודה",
            "body": "preview",
        },
    )["id"]
    return dict(
        s=s,
        ws=ws,
        other_ws=other_ws,
        tech=tech_tok,
        mgr=mgr_tok,
        other=other_owner,
        billing=billing,
        outbound=outbound,
        job=job,
    )


def _rest(env, tok: str, table: str, *, method: str = "GET", json=None, params=None):
    return httpx.request(
        method,
        f"{env['s'].supabase_url}/rest/v1/{table}",
        headers={
            "apikey": env["s"].supabase_anon_key,
            "Authorization": f"Bearer {tok}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        params=params,
        json=json,
        timeout=30,
    )


def test_technician_cannot_read_billing_or_outbound(env):
    for table in ("billing_pending_items", "outbound_messages"):
        res = _rest(
            env,
            env["tech"],
            table,
            params={"workspace_id": f"eq.{env['ws']}", "select": "id"},
        )
        assert res.status_code == 200, res.text
        assert res.json() == [], f"technician must not see {table}"


def test_manager_can_read_billing_and_outbound(env):
    bill = _rest(
        env,
        env["mgr"],
        "billing_pending_items",
        params={"id": f"eq.{env['billing']}", "select": "id"},
    )
    out = _rest(
        env,
        env["mgr"],
        "outbound_messages",
        params={"id": f"eq.{env['outbound']}", "select": "id"},
    )
    assert bill.status_code == 200 and [r["id"] for r in bill.json()] == [env["billing"]], bill.text
    assert out.status_code == 200 and [r["id"] for r in out.json()] == [env["outbound"]], out.text


def test_other_workspace_cannot_read_or_write_billing_or_outbound(env):
    for table, row_id in (("billing_pending_items", env["billing"]), ("outbound_messages", env["outbound"])):
        read = _rest(
            env,
            env["other"],
            table,
            params={"id": f"eq.{row_id}", "select": "id"},
        )
        assert read.status_code == 200, read.text
        assert read.json() == [], f"cross-tenant must not read {table}"

    insert_bill = _rest(
        env,
        env["other"],
        "billing_pending_items",
        method="POST",
        json={
            "workspace_id": env["ws"],
            "job_id": env["job"],
            "amount_gross": 1,
            "currency": "ILS",
            "status": "pending",
        },
    )
    assert insert_bill.status_code in {401, 403, 404}, insert_bill.text

    insert_out = _rest(
        env,
        env["other"],
        "outbound_messages",
        method="POST",
        json={
            "workspace_id": env["ws"],
            "job_id": env["job"],
            "channel": "email",
            "status": "preview",
            "subject": "x",
            "body": "x",
        },
    )
    assert insert_out.status_code in {401, 403, 404}, insert_out.text
