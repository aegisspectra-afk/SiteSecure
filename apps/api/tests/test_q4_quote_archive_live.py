"""Q4: non-draft delete blocked; archive hides from dashboard; restore brings back (LOCAL)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from tests.test_d1_dashboard_live import _owner_workspace, _svc
from tests.test_ssp_c5_e2e_connection import _auth, _snippet

pytestmark = pytest.mark.live


@pytest.fixture(scope="module")
def settings():
    get_settings.cache_clear()
    s = get_settings()
    assert urlparse(s.supabase_url).hostname in {"127.0.0.1", "localhost"}
    return s


def _svc_insert(s, table: str, body: dict) -> dict:
    res = httpx.post(
        f"{s.supabase_url}/rest/v1/{table}",
        headers={**_svc(s), "Prefer": "return=representation"},
        json=body,
        timeout=30,
    )
    assert res.status_code in {200, 201}, res.text
    data = res.json()
    return data[0] if isinstance(data, list) else data


def _patch_status(s, quote_id: str, status: str) -> None:
    res = httpx.patch(
        f"{s.supabase_url}/rest/v1/quotes",
        headers={**_svc(s), "Prefer": "return=minimal"},
        params={"id": f"eq.{quote_id}"},
        json={"status": status},
        timeout=30,
    )
    assert res.status_code in {200, 204}, res.text


def _make_quote(api, tok, ws, *, total: float = 1500.0) -> str:
    cust = api.post(
        f"/api/v1/workspaces/{ws}/customers",
        headers=_auth(tok),
        json={"display_name": f"Q4 לקוח {uuid.uuid4().hex[:6]}"},
    )
    assert cust.status_code == 200, _snippet(cust)
    q = api.post(
        f"/api/v1/workspaces/{ws}/quotes",
        headers=_auth(tok),
        json={"customer_id": cust.json()["id"], "title": "Q4 archive"},
    )
    assert q.status_code == 200, _snippet(q)
    qid = q.json()["id"]
    valid = (datetime.now(UTC) + timedelta(days=30)).date().isoformat()
    api.patch(
        f"/api/v1/workspaces/{ws}/quotes/{qid}",
        headers=_auth(tok),
        json={"valid_until": valid, "payment_terms": "שוטף + 30"},
    ).raise_for_status()
    item = api.post(
        f"/api/v1/workspaces/{ws}/quotes/{qid}/items",
        headers=_auth(tok),
        json={"description": "פריט", "qty": 1, "unit_price": total},
    )
    assert item.status_code == 200, _snippet(item)
    return qid


def test_sent_quote_delete_blocked_api_and_db(settings):
    s, api = settings, TestClient(app)
    tok, ws = _owner_workspace(s, api, "q4-del")
    qid = _make_quote(api, tok, ws)
    _patch_status(s, qid, "sent")

    blocked = api.delete(f"/api/v1/workspaces/{ws}/quotes/{qid}", headers=_auth(tok))
    assert blocked.status_code == 409, _snippet(blocked)
    assert blocked.json()["error"]["code"] == "RESOURCE_STATE"

    # DB soft-delete trigger also blocks non-draft.
    hard = httpx.patch(
        f"{s.supabase_url}/rest/v1/quotes",
        headers={**_svc(s), "Prefer": "return=minimal"},
        params={"id": f"eq.{qid}"},
        json={"deleted_at": datetime.now(UTC).isoformat()},
        timeout=30,
    )
    assert hard.status_code >= 400, hard.text

    still = httpx.get(
        f"{s.supabase_url}/rest/v1/quotes",
        headers=_svc(s),
        params={"id": f"eq.{qid}", "select": "id,deleted_at,status"},
        timeout=30,
    )
    assert still.status_code == 200
    row = still.json()[0]
    assert row["deleted_at"] is None
    assert row["status"] == "sent"


def test_archive_drops_dashboard_and_shows_on_customer_restore_returns(settings):
    s, api = settings, TestClient(app)
    tok, ws = _owner_workspace(s, api, "q4-arch")
    qid = _make_quote(api, tok, ws, total=2200.0)
    _patch_status(s, qid, "approved")
    # Keep totals consistent for KPI (service may recompute; stamp total_gross).
    httpx.patch(
        f"{s.supabase_url}/rest/v1/quotes",
        headers={**_svc(s), "Prefer": "return=minimal"},
        params={"id": f"eq.{qid}"},
        json={"total_gross": 2200, "status": "approved"},
        timeout=30,
    ).raise_for_status()

    before = api.get(f"/api/v1/workspaces/{ws}/dashboard", headers=_auth(tok))
    assert before.status_code == 200, _snippet(before)
    assert before.json()["summary"]["quotes_approved_value"] >= 2200

    archived = api.post(f"/api/v1/workspaces/{ws}/quotes/{qid}/archive", headers=_auth(tok))
    assert archived.status_code == 200, _snippet(archived)

    after = api.get(f"/api/v1/workspaces/{ws}/dashboard", headers=_auth(tok))
    assert after.status_code == 200, _snippet(after)
    assert after.json()["summary"]["quotes_approved_value"] == 0

    main = api.get(f"/api/v1/workspaces/{ws}/quotes", headers=_auth(tok))
    assert all(str(r["id"]) != qid for r in main.json()["items"])

    cust_id = httpx.get(
        f"{s.supabase_url}/rest/v1/quotes",
        headers=_svc(s),
        params={"id": f"eq.{qid}", "select": "customer_id"},
        timeout=30,
    ).json()[0]["customer_id"]
    on_customer = api.get(
        f"/api/v1/workspaces/{ws}/quotes",
        headers=_auth(tok),
        params={"customer_id": cust_id, "include_archived": True},
    )
    assert on_customer.status_code == 200, _snippet(on_customer)
    hit = next(r for r in on_customer.json()["items"] if str(r["id"]) == qid)
    assert hit.get("archived_at")

    restored = api.post(f"/api/v1/workspaces/{ws}/quotes/{qid}/restore", headers=_auth(tok))
    assert restored.status_code == 200, _snippet(restored)

    back = api.get(f"/api/v1/workspaces/{ws}/dashboard", headers=_auth(tok))
    assert back.json()["summary"]["quotes_approved_value"] >= 2200


def test_draft_still_deletable(settings):
    s, api = settings, TestClient(app)
    tok, ws = _owner_workspace(s, api, "q4-draft")
    qid = _make_quote(api, tok, ws)
    deleted = api.delete(f"/api/v1/workspaces/{ws}/quotes/{qid}", headers=_auth(tok))
    assert deleted.status_code == 200, _snippet(deleted)
