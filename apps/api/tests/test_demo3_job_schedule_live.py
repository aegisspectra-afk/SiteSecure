"""DEMO-3.1: job date, time and duration (scheduled_for / scheduled_end), live on LOCAL Supabase.

Available on create, on edit and on assign ("שבץ טכנאי" sets the time too). The end must be
after the start; duration = end - start.
"""

from __future__ import annotations

from datetime import datetime
from urllib.parse import urlparse

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from tests.test_d1_dashboard_live import _owner_workspace, _svc_insert
from tests.test_demo1_technician_scope_live import _member
from tests.test_ssp_c5_e2e_connection import _auth, _snippet

pytestmark = pytest.mark.live

START, END = "2026-11-20T08:00:00+02:00", "2026-11-20T11:30:00+02:00"


@pytest.fixture(scope="module")
def env():
    get_settings.cache_clear()
    s = get_settings()
    assert urlparse(s.supabase_url).hostname in {"127.0.0.1", "localhost"}, "local Supabase only"
    api = TestClient(app)
    owner, ws = _owner_workspace(s, api, "demo3-sched")
    tech_id, tech = _member(s, ws, "technician")
    cust = _svc_insert(s, "customers", {"workspace_id": ws, "display_name": "לקוח תזמון"})["id"]
    site = _svc_insert(s, "sites", {"workspace_id": ws, "customer_id": cust, "code": "SCH1", "name": "אתר תזמון"})["id"]
    return dict(api=api, owner=owner, ws=ws, tech_id=tech_id, tech=tech, cust=cust, site=site)


def _same(a: str | None, b: str) -> bool:
    return a is not None and datetime.fromisoformat(a) == datetime.fromisoformat(b)


def _create(env, **extra):
    res = env["api"].post(f"/api/v1/workspaces/{env['ws']}/jobs", headers=_auth(env["owner"]),
                          json={"title": "התקנה", "customer_id": env["cust"], "site_id": env["site"],
                                "kind": "installation", **extra})
    return res


def test_create_with_date_time_and_duration(env):
    res = _create(env, scheduled_for=START, scheduled_end=END)
    assert res.status_code == 200, _snippet(res)
    job = res.json()
    assert _same(job["scheduled_for"], START) and _same(job["scheduled_end"], END)


def test_edit_the_schedule(env):
    job = _create(env).json()
    assert job["scheduled_for"] is None
    res = env["api"].patch(f"/api/v1/workspaces/{env['ws']}/jobs/{job['id']}", headers=_auth(env["owner"]),
                           json={"scheduled_for": START, "scheduled_end": END})
    assert res.status_code == 200, _snippet(res)
    assert _same(res.json()["scheduled_for"], START) and _same(res.json()["scheduled_end"], END)


def test_assign_sets_technician_and_time_together(env):
    job = _create(env).json()
    res = env["api"].post(f"/api/v1/workspaces/{env['ws']}/jobs/{job['id']}/assign", headers=_auth(env["owner"]),
                          json={"user_id": env["tech_id"], "scheduled_for": START, "scheduled_end": END})
    assert res.status_code == 200, _snippet(res)
    got = env["api"].get(f"/api/v1/workspaces/{env['ws']}/jobs/{job['id']}", headers=_auth(env["owner"])).json()
    assert _same(got["scheduled_for"], START) and _same(got["scheduled_end"], END)
    assert [a["user_id"] for a in got["assignees"]] == [env["tech_id"]]
    # The technician sees the time on their own job.
    mine = env["api"].get(f"/api/v1/workspaces/{env['ws']}/jobs/{job['id']}", headers=_auth(env["tech"]))
    assert mine.status_code == 200 and _same(mine.json()["scheduled_for"], START)


@pytest.mark.parametrize(
    "body",
    [
        {"scheduled_for": END, "scheduled_end": START},  # end before start
        {"scheduled_for": START, "scheduled_end": START},  # zero duration
        {"scheduled_end": END},  # end without start
        {"scheduled_for": "not-a-date"},
        {"scheduled_for": START, "scheduled_end": "2026-11-22T08:00:00+02:00"},  # longer than 24h
    ],
)
def test_invalid_schedules_are_rejected(env, body):
    job = _create(env).json()
    url = f"/api/v1/workspaces/{env['ws']}/jobs/{job['id']}"
    assert env["api"].patch(url, headers=_auth(env["owner"]), json=body).status_code == 400
    assert _create(env, **body).status_code == 400
    assign = env["api"].post(f"{url}/assign", headers=_auth(env["owner"]), json={"user_id": env["tech_id"], **body})
    assert assign.status_code == 400, _snippet(assign)


def test_technician_cannot_assign_or_schedule_through_assign(env):
    job = _create(env).json()
    res = env["api"].post(f"/api/v1/workspaces/{env['ws']}/jobs/{job['id']}/assign", headers=_auth(env["tech"]),
                          json={"user_id": env["tech_id"], "scheduled_for": START, "scheduled_end": END})
    assert res.status_code in {403, 404}
