"""DEMO-1: a technician sees only the jobs assigned to them, live on LOCAL Supabase.

Setup in one workspace:
  site S1: job A (tech A), job B (tech B), project P1 (of job A), project P2 (of job B only),
           service call C1 (unlinked, unassigned)
  site S2 (other customer): job B2 (tech B)
Tech A must see A and what relates to A, nothing of B, through the API (404) and through
PostgREST directly (RLS). Owner and manager still see everything.
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
from tests.test_ssp_c5_e2e_connection import _auth, _create_local_user, _password_grant, _snippet

pytestmark = pytest.mark.live


@pytest.fixture(scope="module")
def settings():
    get_settings.cache_clear()
    s = get_settings()
    assert urlparse(s.supabase_url).hostname in {"127.0.0.1", "localhost"}, "local Supabase only"
    return s


def _member(s, ws: str, role: str) -> tuple[str, str]:
    marker = uuid.uuid4().hex[:10]
    email, password = f"ss.demo1.{role}.{marker}@sitesecure.test", f"D1x-{marker}-9x"
    uid = _create_local_user(s, email, password)
    _svc_insert(s, "workspace_memberships", {"workspace_id": ws, "user_id": uid, "role_key": role, "status": "active"})
    return uid, _password_grant(s, email, password)


def _num() -> str:
    return uuid.uuid4().hex[:8].upper()


@pytest.fixture(scope="module")
def world(settings):
    s, api = settings, TestClient(app)
    owner, ws = _owner_workspace(s, api, "demo1")
    a_id, a_tok = _member(s, ws, "technician")
    b_id, b_tok = _member(s, ws, "technician")
    _, mgr_tok = _member(s, ws, "manager")

    c1 = _svc_insert(s, "customers", {"workspace_id": ws, "display_name": "לקוח משותף"})["id"]
    c2 = _svc_insert(s, "customers", {"workspace_id": ws, "display_name": "לקוח של ב בלבד"})["id"]
    s1 = _svc_insert(s, "sites", {"workspace_id": ws, "customer_id": c1, "code": _num(), "name": "אתר משותף"})["id"]
    s2 = _svc_insert(s, "sites", {"workspace_id": ws, "customer_id": c2, "code": _num(), "name": "אתר של ב"})["id"]
    p1 = _svc_insert(s, "projects", {"workspace_id": ws, "customer_id": c1, "site_id": s1, "name": "פרויקט א"})["id"]
    p2 = _svc_insert(s, "projects", {"workspace_id": ws, "customer_id": c1, "site_id": s1, "name": "פרויקט ב"})["id"]

    def job(title, site, cust, project, assignee):
        jid = _svc_insert(s, "jobs", {"workspace_id": ws, "number": f"J-{_num()}", "title": title,
                                      "customer_id": cust, "site_id": site, "project_id": project})["id"]
        _svc_insert(s, "assignments", {"workspace_id": ws, "user_id": assignee, "resource_type": "job", "resource_id": jid})
        item = _svc_insert(s, "job_checklist_items", {"workspace_id": ws, "job_id": jid, "label_he": "בדיקה"})["id"]
        doc = _svc_insert(s, "documents", {"workspace_id": ws, "entity_type": "job", "entity_id": jid, "kind": "photo",
                                           "storage_bucket": "documents", "storage_path": f"{ws}/job/{jid}/x.jpg",
                                           "original_filename": "x.jpg"})["id"]
        return jid, item, doc

    ja, ja_item, ja_doc = job("עבודה של א", s1, c1, p1, a_id)
    jb, jb_item, jb_doc = job("עבודה של ב באותו אתר", s1, c1, p2, b_id)
    jb2, _, _ = job("עבודה של ב באתר אחר", s2, c2, None, b_id)
    sc1 = _svc_insert(s, "service_calls", {"workspace_id": ws, "customer_id": c1, "site_id": s1,
                                           "title": "קריאה לא משויכת", "number": f"S-{_num()}"})["id"]
    quote_doc = _svc_insert(s, "documents", {"workspace_id": ws, "entity_type": "quote", "entity_id": str(uuid.uuid4()),
                                             "kind": "document", "storage_bucket": "documents",
                                             "storage_path": f"{ws}/quote/q.pdf", "original_filename": "q.pdf"})["id"]
    return dict(s=s, api=api, ws=ws, owner=owner, mgr=mgr_tok, a=a_tok, b=b_tok, a_id=a_id,
                c1=c1, c2=c2, s1=s1, s2=s2, p1=p1, p2=p2, ja=ja, jb=jb, jb2=jb2, ja_item=ja_item,
                jb_item=jb_item, ja_doc=ja_doc, jb_doc=jb_doc, sc1=sc1, quote_doc=quote_doc)


def _ids(res) -> set[str]:
    assert res.status_code == 200, _snippet(res)
    body = res.json()
    rows = body["items"] if isinstance(body, dict) else body
    return {str(r["id"]) for r in rows}


def _rest(w, tok, table, **params):
    res = httpx.get(f"{w['s'].supabase_url}/rest/v1/{table}",
                    headers={"apikey": w["s"].supabase_anon_key, "Authorization": f"Bearer {tok}"},
                    params={"workspace_id": f"eq.{w['ws']}", "select": "id", **params}, timeout=30)
    assert res.status_code == 200, res.text
    return {r["id"] for r in res.json()}


# ---------------------------------------------------------------- API: jobs


def test_job_list_shows_only_own_jobs(world):
    w = world
    got = _ids(w["api"].get(f"/api/v1/workspaces/{w['ws']}/jobs", headers=_auth(w["a"])))
    assert got == {w["ja"]}


def test_other_technicians_job_is_404_on_read_and_write(world):
    w, base = world, f"/api/v1/workspaces/{world['ws']}/jobs"
    h = _auth(w["a"])
    for jid in (w["jb"], w["jb2"]):  # same site and other site
        assert w["api"].get(f"{base}/{jid}", headers=h).status_code == 404
        assert w["api"].get(f"{base}/{jid}/checklist", headers=h).status_code == 404
        assert w["api"].patch(f"{base}/{jid}", headers=h, json={"title": "x"}).status_code == 404
        assert w["api"].post(f"{base}/{jid}/en-route", headers=h).status_code == 404
    item = w["api"].patch(f"{base}/{w['jb']}/checklist/{w['jb_item']}", headers=h, json={"completed": True})
    assert item.status_code == 404, _snippet(item)
    # Own job still works.
    assert w["api"].get(f"{base}/{w['ja']}", headers=h).status_code == 200
    assert w["api"].get(f"{base}/{w['ja']}/checklist", headers=h).status_code == 200


def test_own_job_id_under_another_workspace_is_refused(world, settings):
    w = world
    _, other_ws = _owner_workspace(settings, w["api"], "demo1-other")
    res = w["api"].get(f"/api/v1/workspaces/{other_ws}/jobs/{w['ja']}", headers=_auth(w["a"]))
    assert res.status_code in {403, 404}, _snippet(res)


def test_files_of_other_job_are_hidden(world):
    w, base = world, f"/api/v1/workspaces/{world['ws']}/documents"
    h = _auth(w["a"])
    listed = _ids(w["api"].get(base, headers=h))
    assert w["ja_doc"] in listed
    assert w["jb_doc"] not in listed and w["quote_doc"] not in listed
    assert w["api"].get(f"{base}/{w['jb_doc']}/url", headers=h).status_code == 404
    up = w["api"].post(f"{base}/uploads", headers=h, json={"entity_type": "job", "entity_id": w["jb"],
                                                           "kind": "photo", "mime_type": "image/jpeg",
                                                           "original_filename": "p.jpg", "byte_size": 10})
    assert up.status_code == 404, _snippet(up)


# ------------------------------------------------- API: what relates to the job


def test_projects_service_calls_sites_customers_follow_own_jobs(world):
    w, base = world, f"/api/v1/workspaces/{world['ws']}"
    h = _auth(w["a"])
    assert _ids(w["api"].get(f"{base}/projects", headers=h)) == {w["p1"]}
    assert w["api"].get(f"{base}/projects/{w['p2']}", headers=h).status_code == 404
    assert w["api"].get(f"{base}/projects/{w['p1']}", headers=h).status_code == 200
    assert w["sc1"] not in _ids(w["api"].get(f"{base}/service-calls", headers=h))
    assert w["api"].get(f"{base}/service-calls/{w['sc1']}", headers=h).status_code == 404
    assert _ids(w["api"].get(f"{base}/sites", headers=h)) == {w["s1"]}
    assert w["api"].get(f"{base}/sites/{w['s2']}", headers=h).status_code == 404
    assert _ids(w["api"].get(f"{base}/customers", headers=h)) == {w["c1"]}
    assert w["api"].get(f"{base}/customers/{w['c2']}", headers=h).status_code == 404


def test_today_dashboard_lists_only_own_jobs(world):
    w = world
    res = w["api"].get(f"/api/v1/workspaces/{w['ws']}/dashboard", headers=_auth(w["a"]))
    assert res.status_code == 200, _snippet(res)
    text = res.text
    assert w["jb"] not in text and w["jb2"] not in text


# ------------------------------------------------------- RLS (PostgREST direct)


def test_rls_hides_other_jobs_and_their_children(world):
    w, tok = world, world["a"]
    assert _rest(w, tok, "jobs") == {w["ja"]}
    assert _rest(w, tok, "job_checklist_items") == {w["ja_item"]}
    docs = _rest(w, tok, "documents")
    assert w["ja_doc"] in docs and w["jb_doc"] not in docs and w["quote_doc"] not in docs
    assert _rest(w, tok, "projects") == {w["p1"]}
    assert _rest(w, tok, "service_calls") == set()
    assert _rest(w, tok, "sites") == {w["s1"]}
    assert _rest(w, tok, "customers") == {w["c1"]}


def test_rls_blocks_writes_to_other_job(world):
    w = world
    s = w["s"]
    h = {"apikey": s.supabase_anon_key, "Authorization": f"Bearer {w['a']}", "Content-Type": "application/json",
         "Prefer": "return=representation"}
    res = httpx.patch(f"{s.supabase_url}/rest/v1/jobs", headers=h, params={"id": f"eq.{w['jb']}"},
                      json={"title": "hacked"}, timeout=30)
    assert res.status_code == 200 and res.json() == []
    res = httpx.patch(f"{s.supabase_url}/rest/v1/job_checklist_items", headers=h,
                      params={"id": f"eq.{w['jb_item']}"}, json={"completed": True}, timeout=30)
    assert res.status_code == 200 and res.json() == []
    res = httpx.post(f"{s.supabase_url}/rest/v1/documents", headers=h, timeout=30,
                     json={"workspace_id": w["ws"], "entity_type": "job", "entity_id": w["jb"], "kind": "photo",
                           "storage_bucket": "documents", "storage_path": f"{w['ws']}/job/{w['jb']}/evil.jpg"})
    assert res.status_code in {401, 403}, res.text
    title = httpx.get(f"{s.supabase_url}/rest/v1/jobs", headers=_svc(s),
                      params={"id": f"eq.{w['jb']}", "select": "title"}, timeout=30).json()[0]["title"]
    assert title != "hacked"


# ------------------------------------------------------ managers still see all


@pytest.mark.parametrize("who", ["owner", "mgr"])
def test_owner_and_manager_still_see_everything(world, who):
    w, base = world, f"/api/v1/workspaces/{world['ws']}"
    h = _auth(w[who])
    assert {w["ja"], w["jb"], w["jb2"]} <= _ids(w["api"].get(f"{base}/jobs", headers=h))
    for jid in (w["ja"], w["jb"], w["jb2"]):
        assert w["api"].get(f"{base}/jobs/{jid}", headers=h).status_code == 200
    assert {w["p1"], w["p2"]} <= _ids(w["api"].get(f"{base}/projects", headers=h))
    assert w["sc1"] in _ids(w["api"].get(f"{base}/service-calls", headers=h))
    assert {w["s1"], w["s2"]} <= _ids(w["api"].get(f"{base}/sites", headers=h))
    assert {w["ja_doc"], w["jb_doc"]} <= _ids(w["api"].get(f"{base}/documents", headers=h))
    assert _rest(w, w[who], "jobs") >= {w["ja"], w["jb"], w["jb2"]}
