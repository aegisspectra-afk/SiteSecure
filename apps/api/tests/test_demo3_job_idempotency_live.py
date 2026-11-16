"""DEMO-3.3: a second click never creates a second job, live on LOCAL Supabase.

POST /jobs with the same Idempotency-Key returns the same job (sequential and concurrent).
A different key, or no key, still creates a new job.
"""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from tests.test_d1_dashboard_live import _owner_workspace, _svc, _svc_insert
from tests.test_ssp_c5_e2e_connection import _auth, _snippet

pytestmark = pytest.mark.live


@pytest.fixture(scope="module")
def env():
    get_settings.cache_clear()
    s = get_settings()
    assert urlparse(s.supabase_url).hostname in {"127.0.0.1", "localhost"}, "local Supabase only"
    api = TestClient(app)
    owner, ws = _owner_workspace(s, api, "demo3-idem")
    cust = _svc_insert(s, "customers", {"workspace_id": ws, "display_name": "לקוח"})["id"]
    site = _svc_insert(s, "sites", {"workspace_id": ws, "customer_id": cust, "code": "IDM", "name": "אתר"})["id"]
    project = _svc_insert(s, "projects", {"workspace_id": ws, "customer_id": cust, "site_id": site, "name": "פרויקט"})["id"]
    body = {"title": "התקנה", "customer_id": cust, "site_id": site, "kind": "installation", "project_id": project}
    return dict(s=s, api=api, owner=owner, ws=ws, project=project, body=body)


def _count(env) -> int:
    res = httpx.get(f"{env['s'].supabase_url}/rest/v1/jobs", headers=_svc(env["s"]), timeout=30,
                    params={"project_id": f"eq.{env['project']}", "select": "id"})
    return len(res.json())


def _post(env, key: str | None):
    headers = _auth(env["owner"])
    if key:
        headers = {**headers, "Idempotency-Key": key}
    return env["api"].post(f"/api/v1/workspaces/{env['ws']}/jobs", headers=headers, json=env["body"])


def test_same_key_twice_returns_the_same_job(env):
    before = _count(env)
    key = uuid.uuid4().hex
    first, second = _post(env, key), _post(env, key)
    assert first.status_code == 200 and second.status_code == 200, (_snippet(first), _snippet(second))
    assert first.json()["id"] == second.json()["id"]
    assert _count(env) == before + 1


def test_same_key_at_the_same_time_creates_one_job(env):
    before = _count(env)
    key = uuid.uuid4().hex
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: _post(env, key), range(4)))
    assert all(r.status_code == 200 for r in results), [_snippet(r) for r in results]
    assert len({r.json()["id"] for r in results}) == 1
    assert _count(env) == before + 1


def test_different_keys_or_no_key_create_new_jobs(env):
    before = _count(env)
    assert _post(env, uuid.uuid4().hex).status_code == 200
    assert _post(env, uuid.uuid4().hex).status_code == 200
    assert _post(env, None).status_code == 200
    assert _count(env) == before + 3


def test_key_is_scoped_to_the_workspace(env):
    key = uuid.uuid4().hex
    mine = _post(env, key)
    other_owner, other_ws = _owner_workspace(env["s"], env["api"], "demo3-idem-b")
    s = env["s"]
    cust = _svc_insert(s, "customers", {"workspace_id": other_ws, "display_name": "x"})["id"]
    site = _svc_insert(s, "sites", {"workspace_id": other_ws, "customer_id": cust, "code": "IDB", "name": "x"})["id"]
    theirs = env["api"].post(f"/api/v1/workspaces/{other_ws}/jobs",
                             headers={**_auth(other_owner), "Idempotency-Key": key},
                             json={"title": "x", "customer_id": cust, "site_id": site})
    assert theirs.status_code == 200, _snippet(theirs)
    assert theirs.json()["id"] != mine.json()["id"]


def test_rejects_an_oversized_key(env):
    assert _post(env, "k" * 300).status_code == 400
