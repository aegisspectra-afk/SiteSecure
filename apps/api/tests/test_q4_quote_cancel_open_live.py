"""Q4: cancel sets status=cancelled; GET still returns 200 (not 403). LOCAL."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from tests.test_d1_dashboard_live import _owner_workspace
from tests.test_ssp_c5_e2e_connection import _auth, _snippet

pytestmark = pytest.mark.live


@pytest.fixture(scope="module")
def settings():
    get_settings.cache_clear()
    s = get_settings()
    assert urlparse(s.supabase_url).hostname in {"127.0.0.1", "localhost"}
    return s


def _make_draft(api, tok, ws) -> str:
    cust = api.post(
        f"/api/v1/workspaces/{ws}/customers",
        headers=_auth(tok),
        json={"display_name": f"Q4 cancel {uuid.uuid4().hex[:6]}"},
    )
    assert cust.status_code == 200, _snippet(cust)
    q = api.post(
        f"/api/v1/workspaces/{ws}/quotes",
        headers=_auth(tok),
        json={"customer_id": cust.json()["id"], "title": "Q4 ביטול"},
    )
    assert q.status_code == 200, _snippet(q)
    qid = q.json()["id"]
    valid = (datetime.now(UTC) + timedelta(days=30)).date().isoformat()
    api.patch(
        f"/api/v1/workspaces/{ws}/quotes/{qid}",
        headers=_auth(tok),
        json={"valid_until": valid, "payment_terms": "שוטף + 30"},
    ).raise_for_status()
    return qid


def test_cancel_quote_then_get_returns_200(settings):
    api = TestClient(app)
    tok, ws = _owner_workspace(settings, api, "q4-cancel")
    qid = _make_draft(api, tok, ws)

    cancelled = api.post(
        f"/api/v1/workspaces/{ws}/quotes/{qid}/cancel",
        headers=_auth(tok),
    )
    assert cancelled.status_code == 200, _snippet(cancelled)
    body = cancelled.json()
    assert body.get("status") == "cancelled"
    assert body.get("deleted_at") in (None, "")

    opened = api.get(
        f"/api/v1/workspaces/{ws}/quotes/{qid}",
        headers=_auth(tok),
    )
    assert opened.status_code == 200, _snippet(opened)
    assert opened.json().get("status") == "cancelled"
