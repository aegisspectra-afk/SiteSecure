"""Warranty 60-day reminder runner against LOCAL Supabase."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from urllib.parse import urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.supabase_service import ServiceClient
from app.warranty_reminders import run_workspace_warranty_reminders
from tests.test_d1_dashboard_live import _owner_workspace, _svc, _svc_insert

pytestmark = pytest.mark.live


@pytest.fixture(scope="module")
def settings():
    get_settings.cache_clear()
    s = get_settings()
    assert urlparse(s.supabase_url).hostname in {"127.0.0.1", "localhost"}, "local Supabase only"
    return s


def _count(s, table: str, params: dict) -> int:
    res = httpx.get(
        f"{s.supabase_url}/rest/v1/{table}",
        headers={**_svc(s), "Prefer": "count=exact"},
        params={**params, "select": "id"},
        timeout=30,
    )
    assert res.status_code == 200, res.text
    total = res.headers.get("content-range", "").split("/")[-1]
    return int(total) if total.isdigit() else len(res.json())


def test_warranty_60_day_reminder_creates_event_and_notification(settings):
    s = settings
    api = TestClient(app)
    _token, ws = _owner_workspace(s, api, "war-rem")
    today = date.today()
    ends = today + timedelta(days=60)
    marker = uuid.uuid4().hex[:8]
    cust = _svc_insert(
        s,
        "customers",
        {"workspace_id": ws, "display_name": f"לקוח אחריות {marker}"},
    )["id"]
    site = _svc_insert(
        s,
        "sites",
        {"workspace_id": ws, "customer_id": cust, "code": f"W{marker}", "name": "אתר"},
    )["id"]
    warranty = _svc_insert(
        s,
        "warranties",
        {
            "workspace_id": ws,
            "customer_id": cust,
            "site_id": site,
            "number": f"WAR-{marker}",
            "starts_on": (today - timedelta(days=305)).isoformat(),
            "ends_on": ends.isoformat(),
            "status": "active",
        },
    )
    wid = str(warranty["id"])

    svc = ServiceClient(s)
    result = run_workspace_warranty_reminders(svc, ws, today=today)
    assert result["sent"] >= 1, result

    assert _count(s, "warranty_reminder_events", {"warranty_id": f"eq.{wid}", "days_before": "eq.60"}) == 1
    assert (
        _count(
            s,
            "notifications",
            {"workspace_id": f"eq.{ws}", "entity_type": "eq.warranty", "entity_id": f"eq.{wid}"},
        )
        >= 1
    )