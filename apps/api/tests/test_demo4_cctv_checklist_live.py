"""DEMO-4.3: CCTV installation checklist template, live on LOCAL Supabase.

Built on job_checklist_items: required items, a photo per item where the template asks,
notes, and "לא רלוונטי" only where the template allows it. Each item keeps who marked it
and when (set by the database from the signed-in user, also through PostgREST).
"""

from __future__ import annotations

import uuid
from urllib.parse import urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.routers.jobs import CCTV_INSTALLATION_TEMPLATE
from tests.test_d1_dashboard_live import _owner_workspace, _svc, _svc_insert
from tests.test_demo1_technician_scope_live import _member
from tests.test_ssp_c5_e2e_connection import _auth, _snippet

pytestmark = pytest.mark.live


@pytest.fixture(scope="module")
def env():
    get_settings.cache_clear()
    s = get_settings()
    assert urlparse(s.supabase_url).hostname in {"127.0.0.1", "localhost"}, "local Supabase only"
    api = TestClient(app)
    owner, ws = _owner_workspace(s, api, "demo4-chk")
    a_id, a = _member(s, ws, "technician")
    _, b = _member(s, ws, "technician")
    cust = _svc_insert(s, "customers", {"workspace_id": ws, "display_name": "לקוח"})["id"]
    site = _svc_insert(s, "sites", {"workspace_id": ws, "customer_id": cust, "code": "CHK", "name": "אתר"})["id"]
    quote = _svc_insert(s, "quotes", {"workspace_id": ws, "customer_id": cust, "site_id": site, "number": f"Q-{uuid.uuid4().hex[:6]}",
                                      "status": "approved"})["id"]
    _svc_insert(s, "quote_items", {"workspace_id": ws, "quote_id": quote, "description": "מצלמה", "qty": 4,
                                   "unit_price": 390, "package_name": "cctv-planned:camera_ip_main", "item_type": "free"})
    project = _svc_insert(s, "projects", {"workspace_id": ws, "customer_id": cust, "site_id": site, "name": "פרויקט",
                                          "source_quote_id": quote})["id"]
    plain_project = _svc_insert(s, "projects", {"workspace_id": ws, "customer_id": cust, "site_id": site, "name": "רגיל"})["id"]
    return dict(s=s, api=api, ws=ws, owner=owner, a=a, a_id=a_id, b=b, cust=cust, site=site,
                project=project, plain_project=plain_project)


def _job(env, project, status="in_progress"):
    res = env["api"].post(f"/api/v1/workspaces/{env['ws']}/jobs", headers=_auth(env["owner"]),
                          json={"title": "התקנה", "customer_id": env["cust"], "site_id": env["site"],
                                "kind": "installation", "project_id": project})
    assert res.status_code == 200, _snippet(res)
    jid = res.json()["id"]
    env["api"].post(f"/api/v1/workspaces/{env['ws']}/jobs/{jid}/assign", headers=_auth(env["owner"]),
                    json={"user_id": env["a_id"]}).raise_for_status()
    httpx.patch(f"{env['s'].supabase_url}/rest/v1/jobs", headers=_svc(env["s"]), params={"id": f"eq.{jid}"},
                json={"status": status}, timeout=30).raise_for_status()
    return jid


def _items(env, jid, tok=None):
    res = env["api"].get(f"/api/v1/workspaces/{env['ws']}/jobs/{jid}/checklist", headers=_auth(tok or env["a"]))
    assert res.status_code == 200, _snippet(res)
    return {i["item_key"]: i for i in res.json()}


def _patch(env, jid, item_id, tok=None, **body):
    return env["api"].patch(f"/api/v1/workspaces/{env['ws']}/jobs/{jid}/checklist/{item_id}",
                            headers=_auth(tok or env["a"]), json=body)


def _photo(env, jid) -> str:
    return _svc_insert(env["s"], "documents", {"workspace_id": env["ws"], "entity_type": "job", "entity_id": jid,
                                               "kind": "photo", "storage_bucket": "photos", "byte_size": 10,
                                               "storage_path": f"{env['ws']}/job/{jid}/{uuid.uuid4().hex}.jpg"})["id"]


def _key(pred):
    return next(i["key"] for i in CCTV_INSTALLATION_TEMPLATE if pred(i))


def test_cctv_project_gets_the_cctv_template(env):
    items = _items(env, _job(env, env["project"]))
    assert list(items) == [i["key"] for i in CCTV_INSTALLATION_TEMPLATE]
    first = items[CCTV_INSTALLATION_TEMPLATE[0]["key"]]
    assert first["template_key"] == "cctv_installation_v1" and first["label_he"]
    assert any(i["photo_required"] for i in items.values()) and any(i["allow_na"] for i in items.values())
    assert any(i["required"] for i in items.values())


def test_other_installations_keep_the_generic_list(env):
    items = _items(env, _job(env, env["plain_project"]))
    assert all(i["template_key"] is None for i in items.values())


def test_marking_records_who_and_when(env):
    jid = _job(env, env["project"])
    plain = _key(lambda i: not i["photo_required"])
    item = _items(env, jid)[plain]
    res = _patch(env, jid, item["id"], completed=True, notes="נבדק עם הלקוח")
    assert res.status_code == 200, _snippet(res)
    after = _items(env, jid)[plain]
    assert after["completed"] is True and after["completed_at"] and after["completed_by"] == env["a_id"]
    assert after["completed_by_name"] and after["notes"] == "נבדק עם הלקוח"
    assert _patch(env, jid, item["id"], completed=False).status_code == 200
    cleared = _items(env, jid)[plain]
    assert cleared["completed"] is False and cleared["completed_at"] is None and cleared["completed_by"] is None


def test_photo_item_needs_a_photo_of_this_job(env):
    jid = _job(env, env["project"])
    other_jid = _job(env, env["project"])
    key = _key(lambda i: i["photo_required"])
    item = _items(env, jid)[key]
    assert _patch(env, jid, item["id"], completed=True).status_code == 400
    assert _patch(env, jid, item["id"], photo_document_id=_photo(env, other_jid)).status_code == 400
    ok = _patch(env, jid, item["id"], photo_document_id=_photo(env, jid), completed=True)
    assert ok.status_code == 200, _snippet(ok)
    assert _items(env, jid)[key]["completed"] is True


def test_not_applicable_only_where_allowed(env):
    jid = _job(env, env["project"])
    allowed = _key(lambda i: i["allow_na"])
    strict = _key(lambda i: not i["allow_na"])
    items = _items(env, jid)
    assert _patch(env, jid, items[strict]["id"], not_applicable=True).status_code == 400
    res = _patch(env, jid, items[allowed]["id"], not_applicable=True, notes="אין מתג במערכת")
    assert res.status_code == 200, _snippet(res)
    after = _items(env, jid)[allowed]
    assert after["not_applicable"] is True and after["completed"] is False and after["completed_by"] == env["a_id"]


def test_other_technician_cannot_touch_the_checklist(env):
    jid = _job(env, env["project"])
    item = next(iter(_items(env, jid).values()))
    assert env["api"].get(f"/api/v1/workspaces/{env['ws']}/jobs/{jid}/checklist", headers=_auth(env["b"])).status_code == 404
    assert _patch(env, jid, item["id"], tok=env["b"], completed=True).status_code == 404


def test_locked_after_completion(env):
    jid = _job(env, env["project"], status="completed")
    item = next(iter(_items(env, jid, env["owner"]).values()))
    assert _patch(env, jid, item["id"], tok=env["owner"], notes="x").status_code in {403, 409}


def test_postgrest_cannot_forge_who_marked_or_change_the_template(env):
    jid = _job(env, env["project"])
    plain = _key(lambda i: not i["photo_required"] and not i["allow_na"])
    item = _items(env, jid)[plain]
    s = env["s"]
    h = {"apikey": s.supabase_anon_key, "Authorization": f"Bearer {env['a']}", "Content-Type": "application/json",
         "Prefer": "return=representation"}
    forged = httpx.patch(f"{s.supabase_url}/rest/v1/job_checklist_items", headers=h, timeout=30,
                         params={"id": f"eq.{item['id']}"},
                         json={"completed": True, "completed_by": str(uuid.uuid4()), "completed_at": "2020-01-01T00:00:00Z"})
    assert forged.status_code == 200, forged.text
    row = forged.json()[0]
    assert row["completed_by"] == env["a_id"] and not row["completed_at"].startswith("2020")
    structure = httpx.patch(f"{s.supabase_url}/rest/v1/job_checklist_items", headers=h, timeout=30,
                            params={"id": f"eq.{item['id']}"}, json={"required": False})
    assert structure.status_code in {400, 401, 403}, structure.text
