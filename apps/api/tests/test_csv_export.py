"""SITE SECURE CSV export — BOM, formula guard, Hebrew, RBAC, workspace isolation."""

from __future__ import annotations

from uuid import UUID

import httpx
import pytest

from app.authz.types import AuthzContext
from app.csv_export import build_csv, csv_cell, csv_response
from app.errors import ApiError
from app.routers import customers as customers_mod
from app.routers import ops_modules as ops
from app.routers import quotes as quotes_mod
from app.routers.customers import _customer_list_filter_params
from urllib.parse import quote

from app.search_query import sanitize_search_q

WS = UUID("00000000-0000-0000-0000-0000000000aa")
OTHER_WS = UUID("00000000-0000-0000-0000-0000000000bb")
QID = "11111111-1111-1111-1111-111111111111"
CID = "22222222-2222-2222-2222-222222222222"
TID = "33333333-3333-3333-3333-333333333333"
ACTOR = "44444444-4444-4444-4444-444444444444"


def _ok(data, status=200) -> httpx.Response:
    return httpx.Response(status, json=data)


def _ctx(
    role: str,
    workspace_id: str = str(WS),
    assigned: tuple[str, ...] = (),
    plan: str = "business",
) -> AuthzContext:
    from app.authz.catalog import load_catalog

    catalog = load_catalog()
    return AuthzContext(
        user_id=ACTOR,
        workspace_id=workspace_id,
        role_key=role,
        workspace_status="active",
        subscription_status="active",
        plan_key=plan,
        features=catalog["_plan_features"][plan],
        assigned_resource_ids=frozenset(assigned),
    )


QUOTE_ROW = {
    "id": QID,
    "workspace_id": str(WS),
    "number": "Q-2026-0001",
    "status": "draft",
    "title": "=CMD|payload",
    "project_name": "אתר בדיקה",
    "total_gross": 1200,
    "currency": "ILS",
    "created_at": "2026-10-01T00:00:00+00:00",
    "valid_until": "2026-11-01",
    "customers": {"display_name": "לקוח בדיקה"},
    "sites": {"name": "אתר א"},
}


class FakeQuotes:
    def __init__(self, rows: list[dict] | None = None) -> None:
        self.gets: list[tuple[str, dict]] = []
        self.rpcs: list[tuple[str, dict]] = []
        self.rows = rows or [dict(QUOTE_ROW)]

    def get(self, table: str, params: dict | None = None):
        params = params or {}
        self.gets.append((table, params))
        ws = str(params.get("workspace_id") or "")
        if ws and str(WS) not in ws:
            return _ok([])
        if table == "quotes":
            return _ok(self.rows)
        if table == "customers":
            return _ok([])
        return _ok([])

    def rpc(self, name: str, payload: dict | None = None):
        self.rpcs.append((name, payload or {}))
        return _ok({})


class CostService:
    def get(self, table: str, params: dict | None = None):
        params = params or {}
        assert table == "quotes"
        assert str(WS) in str(params.get("workspace_id") or "")
        return _ok(
            [
                {
                    "id": QID,
                    "cost_total": 80,
                    "margin_amount": 20,
                    "margin_percent": 20,
                }
            ]
        )


class FakeCustomers:
    def __init__(self, rows: list[dict] | None = None) -> None:
        self.gets: list[tuple[str, dict]] = []
        self.rpcs: list[tuple[str, dict]] = []
        self.rows = rows or [
            {
                "id": CID,
                "workspace_id": str(WS),
                "display_name": "+CMD לקוח",
                "type": "private",
                "status": "active",
                "phone": "0500000000",
                "email": "a@example.com",
                "billing_address": {"city": "תל אביב"},
                "created_at": "2026-10-01T00:00:00+00:00",
            }
        ]

    def get(self, table: str, params: dict | None = None):
        params = params or {}
        self.gets.append((table, params))
        ws = str(params.get("workspace_id") or "")
        if ws and str(WS) not in ws:
            return _ok([])
        if table == "customers":
            return _ok(self.rows)
        return _ok([])

    def rpc(self, name: str, payload: dict | None = None):
        self.rpcs.append((name, payload or {}))
        return _ok({})


class FakeTasks:
    def __init__(self, rows: list[dict] | None = None) -> None:
        self.gets: list[tuple[str, dict]] = []
        self.rpcs: list[tuple[str, dict]] = []
        self.rows = rows or [
            {
                "id": TID,
                "workspace_id": str(WS),
                "title": "@SUM(A1)",
                "status": "open",
                "type": "other",
                "assignee_id": ACTOR,
                "due_at": "2026-10-15T10:00:00+00:00",
                "created_at": "2026-10-01T00:00:00+00:00",
                "customer_id": CID,
                "site_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            }
        ]

    def get(self, table: str, params: dict | None = None):
        params = params or {}
        self.gets.append((table, params))
        ws = str(params.get("workspace_id") or "")
        if ws and str(WS) not in ws:
            return _ok([])
        if table == "tasks":
            items = list(self.rows)
            blob = str(params)
            items = [
                row
                for row in items
                if f"assignee_id.eq.{row.get('assignee_id')}" in blob
                or "assignee_id.eq." not in blob
            ]
            return _ok(items)
        return _ok([])

    def rpc(self, name: str, payload: dict | None = None):
        self.rpcs.append((name, payload or {}))
        return _ok({})


def _csv_text(response) -> str:
    return bytes(response.body).decode("utf-8-sig")


def _export_quotes(ws, client, user):
    return quotes_mod.export_quotes_csv(
        ws,
        client,
        user,
        q=None,
        status=None,
        exclude_status=None,
        customer_id=None,
        lead_id=None,
        site_id=None,
    )


def _export_customers(ws, client, user):
    return customers_mod.export_customers_csv(ws, client, user, q=None, status=None)


def _export_tasks(ws, client, user):
    return ops.export_tasks_csv(ws, client, user, status=None, type=None, lead_id=None, q=None)


def test_csv_cell_guards_formula_prefixes():
    assert csv_cell("=1+1") == "'=1+1"
    assert csv_cell("+cmd") == "'+cmd"
    assert csv_cell("-1") == "'-1"
    assert csv_cell("@SUM") == "'@SUM"
    assert csv_cell("רגיל") == "רגיל"
    assert csv_cell(None) == ""


def test_build_csv_bom_and_hebrew_headers():
    raw = build_csv(["שם", "סטטוס"], [["=CMD", "פעיל"]])
    assert raw.startswith(b"\xef\xbb\xbf")
    text = raw.decode("utf-8-sig")
    assert "שם" in text
    assert "סטטוס" in text
    assert "'=CMD" in text
    assert "=CMD" in text
    assert not text.splitlines()[1].startswith("=")


def test_csv_response_filename_is_latin1_safe():
    res = csv_response(build_csv(["שם"], []), "הצעות-מחיר.csv")
    header = res.headers["content-disposition"]
    header.encode("latin-1")
    assert "filename=\"export.csv\"" in header
    assert "filename*=UTF-8''" in header
    assert quote("הצעות-מחיר.csv") in header


def test_customer_search_q_is_sanitized():
    assert "*" not in sanitize_search_q("a%b*c")
    params = _customer_list_filter_params(workspace_id=WS, q="שם%*", status=None)
    needle = params["or"]
    assert "%" not in needle
    assert "*" in needle  # PostgREST wrap, not user wildcard


def test_quotes_export_forbidden_without_perm(monkeypatch):
    monkeypatch.setattr(quotes_mod, "_ctx", lambda *a, **k: _ctx("technician"))
    with pytest.raises(ApiError) as ei:
        _export_quotes(WS, FakeQuotes(), {"sub": ACTOR})
    assert ei.value.status_code == 403


def test_quotes_export_forbidden_for_viewer(monkeypatch):
    monkeypatch.setattr(quotes_mod, "_ctx", lambda *a, **k: _ctx("viewer"))
    with pytest.raises(ApiError) as ei:
        _export_quotes(WS, FakeQuotes(), {"sub": ACTOR})
    assert ei.value.status_code == 403


def test_quotes_export_hides_cost_without_view_cost(monkeypatch):
    monkeypatch.setattr(quotes_mod, "_ctx", lambda *a, **k: _ctx("sales", plan="free"))
    res = _export_quotes(WS, FakeQuotes(), {"sub": ACTOR})
    text = _csv_text(res)
    assert "מספר" in text
    assert "טיוטה" in text
    assert "לקוח בדיקה" in text
    assert "'=CMD|payload" in text
    assert "עלות" not in text
    assert "מרווח" not in text
    assert "80" not in text


def test_quotes_export_includes_cost_when_allowed(monkeypatch):
    monkeypatch.setattr(quotes_mod, "_ctx", lambda *a, **k: _ctx("manager"))
    monkeypatch.setattr(quotes_mod, "_service", lambda: CostService())
    res = _export_quotes(WS, FakeQuotes(), {"sub": ACTOR})
    text = _csv_text(res)
    assert "עלות" in text
    assert "מרווח" in text
    assert "80" in text
    assert "20" in text


def test_quotes_export_other_workspace_empty(monkeypatch):
    client = FakeQuotes()
    monkeypatch.setattr(quotes_mod, "_ctx", lambda *a, **k: _ctx("manager", workspace_id=str(OTHER_WS)))
    res = _export_quotes(OTHER_WS, client, {"sub": ACTOR})
    text = _csv_text(res)
    assert "Q-2026-0001" not in text
    assert any(str(OTHER_WS) in str(params.get("workspace_id") or "") for _, params in client.gets)


def test_customers_export_forbidden_for_viewer(monkeypatch):
    monkeypatch.setattr(customers_mod, "_ctx", lambda *a, **k: _ctx("viewer"))
    with pytest.raises(ApiError) as ei:
        _export_customers(WS, FakeCustomers(), {"sub": ACTOR})
    assert ei.value.status_code == 403


def test_customers_export_hebrew_and_formula_guard(monkeypatch):
    monkeypatch.setattr(customers_mod, "_ctx", lambda *a, **k: _ctx("manager"))
    res = _export_customers(WS, FakeCustomers(), {"sub": ACTOR})
    text = _csv_text(res)
    assert "שם" in text
    assert "פעיל" in text
    assert "תל אביב" in text
    assert "'+CMD לקוח" in text


def test_customers_export_assigned_empty(monkeypatch):
    monkeypatch.setattr(customers_mod, "_ctx", lambda *a, **k: _ctx("technician"))
    monkeypatch.setattr(customers_mod, "require", lambda *a, **k: None)
    client = FakeCustomers()
    res = _export_customers(WS, client, {"sub": ACTOR})
    text = _csv_text(res)
    assert "שם" in text
    data_lines = [ln for ln in text.splitlines() if ln.strip() and not ln.startswith("שם")]
    assert data_lines == []
    assert client.gets == []


def test_customers_export_other_workspace_empty(monkeypatch):
    client = FakeCustomers()
    monkeypatch.setattr(customers_mod, "_ctx", lambda *a, **k: _ctx("manager", workspace_id=str(OTHER_WS)))
    res = _export_customers(OTHER_WS, client, {"sub": ACTOR})
    text = _csv_text(res)
    assert "+CMD" not in text
    assert any(str(OTHER_WS) in str(params.get("workspace_id") or "") for _, params in client.gets)


def test_tasks_export_forbidden_for_viewer(monkeypatch):
    monkeypatch.setattr(ops, "_ctx", lambda *a, **k: _ctx("viewer"))
    with pytest.raises(ApiError) as ei:
        _export_tasks(WS, FakeTasks(), {"sub": ACTOR})
    assert ei.value.status_code == 403


def test_tasks_export_hebrew_and_formula_guard(monkeypatch):
    monkeypatch.setattr(ops, "_ctx", lambda *a, **k: _ctx("manager"))
    res = _export_tasks(WS, FakeTasks(), {"sub": ACTOR})
    text = _csv_text(res)
    assert "כותרת" in text
    assert "פתוחה" in text
    assert "'@SUM(A1)" in text


def test_tasks_export_other_workspace_empty(monkeypatch):
    client = FakeTasks()
    monkeypatch.setattr(ops, "_ctx", lambda *a, **k: _ctx("manager", workspace_id=str(OTHER_WS)))
    res = _export_tasks(OTHER_WS, client, {"sub": ACTOR})
    text = _csv_text(res)
    assert "@SUM" not in text
    assert any(str(OTHER_WS) in str(params.get("workspace_id") or "") for _, params in client.gets)


def test_customers_export_forbidden_for_technician(monkeypatch):
    monkeypatch.setattr(customers_mod, "_ctx", lambda *a, **k: _ctx("technician"))
    with pytest.raises(ApiError) as ei:
        _export_customers(WS, FakeCustomers(), {"sub": ACTOR})
    assert ei.value.status_code == 403


def test_quotes_export_writes_audit(monkeypatch):
    client = FakeQuotes()
    monkeypatch.setattr(quotes_mod, "_ctx", lambda *a, **k: _ctx("sales", plan="free"))
    res = _export_quotes(WS, client, {"sub": ACTOR})
    assert res.headers["x-export-truncated"] == "false"
    assert res.headers["x-export-row-count"] == "1"
    assert res.headers["x-export-max-rows"] == "2000"
    assert client.rpcs
    name, payload = client.rpcs[0]
    assert name == "write_audit_log"
    assert payload["p_action"] == "quotes.export"
    assert payload["p_workspace_id"] == str(WS)
    assert payload["p_metadata"]["row_count"] == 1
    assert payload["p_metadata"]["truncated"] is False


def test_customers_and_tasks_export_write_audit(monkeypatch):
    customers = FakeCustomers()
    tasks = FakeTasks()
    monkeypatch.setattr(customers_mod, "_ctx", lambda *a, **k: _ctx("manager"))
    monkeypatch.setattr(ops, "_ctx", lambda *a, **k: _ctx("manager"))
    _export_customers(WS, customers, {"sub": ACTOR})
    _export_tasks(WS, tasks, {"sub": ACTOR})
    assert customers.rpcs[0][0] == "write_audit_log"
    assert customers.rpcs[0][1]["p_action"] == "customers.export"
    assert tasks.rpcs[0][0] == "write_audit_log"
    assert tasks.rpcs[0][1]["p_action"] == "tasks.export"


def test_quotes_export_truncates_at_max(monkeypatch):
    extra = [
        {**QUOTE_ROW, "id": f"11111111-1111-1111-1111-11111111111{i}", "number": f"Q-MAX-{i}", "created_at": f"2026-10-0{i}T00:00:00+00:00"}
        for i in (1, 2)
    ]
    client = FakeQuotes(extra)
    monkeypatch.setattr(quotes_mod, "_ctx", lambda *a, **k: _ctx("sales", plan="free"))
    monkeypatch.setattr(quotes_mod, "EXPORT_MAX", 1)
    monkeypatch.setattr(quotes_mod, "EXPORT_PAGE", 1)
    res = _export_quotes(WS, client, {"sub": ACTOR})
    text = _csv_text(res)
    assert text.count("Q-MAX-") == 1
    assert res.headers["x-export-truncated"] == "true"
    assert res.headers["x-export-row-count"] == "1"
    assert client.rpcs[0][1]["p_metadata"]["truncated"] is True


def test_tasks_export_technician_scope_hides_foreign_and_customer_columns(monkeypatch):
    other_task = {
        "id": "99999999-9999-9999-9999-999999999999",
        "workspace_id": str(WS),
        "title": "משימה של אחר",
        "status": "open",
        "type": "other",
        "assignee_id": "55555555-5555-5555-5555-555555555555",
        "due_at": "2026-10-16T10:00:00+00:00",
        "created_at": "2026-10-02T00:00:00+00:00",
        "customer_id": CID,
        "site_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    }
    client = FakeTasks([*FakeTasks().rows, other_task])
    monkeypatch.setattr(ops, "_ctx", lambda *a, **k: _ctx("technician", assigned=()))
    res = _export_tasks(WS, client, {"sub": ACTOR})
    text = _csv_text(res)
    header = text.splitlines()[0]
    assert "לקוח" not in header
    assert "אתר" not in header
    assert "customer" not in header.casefold()
    assert "site" not in header.casefold()
    assert CID not in text
    assert "משימה של אחר" not in text
    assert "'@SUM(A1)" in text
    assert any("assignee_id.eq." + ACTOR in str(params) for _, params in client.gets)


def test_tasks_export_technician_assigned_site_does_not_include_other_tech_tasks(monkeypatch):
    """Assigned site/customer must not expand export to other technicians' tasks."""
    site_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    other_on_assigned_site = {
        "id": "99999999-9999-9999-9999-999999999999",
        "workspace_id": str(WS),
        "title": "משימה של טכנאי אחר באתר משויך",
        "status": "open",
        "type": "other",
        "assignee_id": "55555555-5555-5555-5555-555555555555",
        "due_at": "2026-10-16T10:00:00+00:00",
        "created_at": "2026-10-02T00:00:00+00:00",
        "customer_id": CID,
        "site_id": site_id,
    }
    client = FakeTasks([*FakeTasks().rows, other_on_assigned_site])
    monkeypatch.setattr(ops, "_ctx", lambda *a, **k: _ctx("technician", assigned=(site_id, CID)))
    res = _export_tasks(WS, client, {"sub": ACTOR})
    text = _csv_text(res)
    assert "משימה של טכנאי אחר באתר משויך" not in text
    blobs = [str(params) for _, params in client.gets]
    assert any(f"assignee_id.eq.{ACTOR}" in blob for blob in blobs)
    assert not any("site_id.in." in blob for blob in blobs)
    assert not any("customer_id.in." in blob for blob in blobs)
