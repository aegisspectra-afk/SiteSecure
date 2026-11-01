"""B3: task/equipment delete, customer CSV import, cross-workspace isolation."""

from __future__ import annotations

from uuid import UUID

import httpx
import pytest

from app.authz.types import AuthzContext
from app.errors import ApiError
from app.routers.customers import (
    CustomerImportIn,
    analyze_customer_import,
    import_customers_csv,
    parse_customer_import_rows,
    preview_customers_csv,
)
from app.routers.ops_modules import delete_task
from app.routers.systems import delete_equipment
from app.routers import customers as customers_mod
from app.routers import ops_modules as ops
from app.routers import systems as systems_mod

WS = UUID("00000000-0000-0000-0000-0000000000aa")
OTHER_WS = UUID("00000000-0000-0000-0000-0000000000bb")
ACTOR = "44444444-4444-4444-4444-444444444444"
TID = "33333333-3333-3333-3333-333333333333"
EID = "55555555-5555-5555-5555-555555555555"
SITE = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"


def _ok(data, status=200) -> httpx.Response:
    return httpx.Response(status, json=data)


def _ctx(role: str = "manager", workspace_id: str = str(WS)) -> AuthzContext:
    from app.authz.catalog import load_catalog

    catalog = load_catalog()
    return AuthzContext(
        user_id=ACTOR,
        workspace_id=workspace_id,
        role_key=role,
        workspace_status="active",
        subscription_status="active",
        plan_key="solo",
        features=catalog["_plan_features"]["solo"],
    )


class FakeRest:
    def __init__(self, rows: dict[str, list[dict]] | None = None) -> None:
        self.rows = rows or {}
        self.gets: list[tuple[str, dict]] = []
        self.posts: list[tuple[str, dict]] = []
        self.deletes: list[tuple[str, dict]] = []
        self.rpcs: list[tuple[str, dict]] = []

    def get(self, table: str, params: dict | None = None):
        params = params or {}
        self.gets.append((table, params))
        ws = str(params.get("workspace_id") or "")
        if ws and str(WS) not in ws:
            return _ok([])
        return _ok(list(self.rows.get(table, [])))

    def post(self, table: str, payload: dict):
        self.posts.append((table, payload))
        row = {"id": "99999999-9999-9999-9999-999999999999", **payload}
        self.rows.setdefault(table, []).append(row)
        return _ok([row], 201)

    def delete(self, table: str, params: dict | None = None, **kwargs):
        params = params or {}
        self.deletes.append((table, params))
        return httpx.Response(204)

    def rpc(self, name: str, payload: dict | None = None):
        self.rpcs.append((name, payload or {}))
        return _ok({})


def test_parse_customer_import_accepts_hebrew_headers():
    rows = parse_customer_import_rows("שם,טלפון,דואל\nמייק,050111,a@b.c\n")
    assert rows[0]["display_name"] == "מייק"
    assert rows[0]["phone"] == "050111"
    assert rows[0]["email"] == "a@b.c"


def test_parse_customer_import_rejects_empty():
    with pytest.raises(ApiError) as err:
        parse_customer_import_rows("display_name,phone\n,")
    assert err.value.status_code == 400


def test_delete_task_writes_audit_and_scopes_workspace(monkeypatch):
    client = FakeRest({"tasks": [{"id": TID, "title": "לבדיקה"}]})
    monkeypatch.setattr(ops, "_ctx", lambda *a, **k: _ctx())
    monkeypatch.setattr(ops, "require", lambda *a, **k: None)
    out = delete_task(WS, UUID(TID), client, {"id": ACTOR})
    assert out == {"ok": True}
    assert client.deletes[0][0] == "tasks"
    assert f"eq.{TID}" in str(client.deletes[0][1])
    assert f"eq.{WS}" in str(client.deletes[0][1])
    assert client.rpcs[0][0] == "write_audit_log"
    assert client.rpcs[0][1]["p_action"] == "tasks.deleted"


def test_delete_task_cross_workspace_404(monkeypatch):
    client = FakeRest({"tasks": [{"id": TID, "title": "לבדיקה"}]})
    monkeypatch.setattr(ops, "_ctx", lambda *a, **k: _ctx(workspace_id=str(OTHER_WS)))
    monkeypatch.setattr(ops, "require", lambda *a, **k: None)
    with pytest.raises(ApiError) as err:
        delete_task(OTHER_WS, UUID(TID), client, {"id": ACTOR})
    assert err.value.status_code == 404
    assert client.deletes == []


def test_delete_equipment_writes_audit_and_scopes_workspace(monkeypatch):
    client = FakeRest({"equipment": [{"id": EID, "site_id": SITE, "name": "מצלמה"}]})
    monkeypatch.setattr(systems_mod, "_ctx", lambda *a, **k: _ctx())
    monkeypatch.setattr(systems_mod, "require", lambda *a, **k: None)
    out = delete_equipment(WS, UUID(EID), client, {"id": ACTOR}, client)
    assert out == {"ok": True}
    assert client.deletes[0][0] == "equipment"
    assert f"eq.{EID}" in str(client.deletes[0][1])
    assert f"eq.{WS}" in str(client.deletes[0][1])
    assert client.rpcs[0][1]["p_action"] == "equipment.deleted"


def test_delete_equipment_cross_workspace_404(monkeypatch):
    client = FakeRest({"equipment": [{"id": EID, "site_id": SITE, "name": "מצלמה"}]})
    monkeypatch.setattr(systems_mod, "_ctx", lambda *a, **k: _ctx(workspace_id=str(OTHER_WS)))
    monkeypatch.setattr(systems_mod, "require", lambda *a, **k: None)
    with pytest.raises(ApiError) as err:
        delete_equipment(OTHER_WS, UUID(EID), client, {"id": ACTOR}, client)
    assert err.value.status_code == 404
    assert client.deletes == []


def test_import_customers_creates_and_audits(monkeypatch):
    client = FakeRest()
    monkeypatch.setattr(customers_mod, "_ctx", lambda *a, **k: _ctx())
    monkeypatch.setattr(customers_mod, "require", lambda *a, **k: None)
    monkeypatch.setattr(customers_mod, "fetch_customers_count", lambda *a, **k: 0)
    monkeypatch.setattr(
        customers_mod,
        "evaluate_count_limit",
        lambda **k: type("D", (), {"allowed": True})(),
    )
    result = import_customers_csv(
        WS,
        CustomerImportIn(csv_text="display_name,phone\nלקוח א,050\nלקוח ב,051\n"),
        client,
        {"id": ACTOR},
    )
    assert result.created == 2
    assert result.skipped == 0
    assert all(row[1]["workspace_id"] == str(WS) for row in client.posts)
    assert client.rpcs[0][1]["p_action"] == "customers.import"


def test_import_customers_cross_workspace_payload_stays_on_path(monkeypatch):
    client = FakeRest()
    monkeypatch.setattr(customers_mod, "_ctx", lambda *a, **k: _ctx())
    monkeypatch.setattr(customers_mod, "require", lambda *a, **k: None)
    monkeypatch.setattr(customers_mod, "fetch_customers_count", lambda *a, **k: 0)
    monkeypatch.setattr(
        customers_mod,
        "evaluate_count_limit",
        lambda **k: type("D", (), {"allowed": True})(),
    )
    import_customers_csv(
        WS,
        CustomerImportIn(csv_text="display_name\nזר\n"),
        client,
        {"id": ACTOR},
    )
    assert client.posts[0][1]["workspace_id"] == str(WS)
    assert str(OTHER_WS) not in str(client.posts)


def test_import_customers_stops_at_quota(monkeypatch):
    client = FakeRest()
    monkeypatch.setattr(customers_mod, "_ctx", lambda *a, **k: _ctx())
    monkeypatch.setattr(customers_mod, "require", lambda *a, **k: None)
    monkeypatch.setattr(customers_mod, "fetch_customers_count", lambda *a, **k: 1)

    def _limit(**kwargs):
        return type("D", (), {"allowed": kwargs["current"] < 1})()

    monkeypatch.setattr(customers_mod, "evaluate_count_limit", _limit)
    result = import_customers_csv(
        WS,
        CustomerImportIn(csv_text="display_name\nא\nב\n"),
        client,
        {"id": ACTOR},
    )
    assert result.created == 0
    assert result.skipped == 2
    assert client.posts == []


def test_analyze_rejects_csv_injection():
    preview = analyze_customer_import("display_name,phone\n=HYPERLINK(\"http://x\"),050\nלקוח,051\n")
    assert preview.valid_count == 1
    assert preview.error_count == 1
    assert any("נוסחת CSV" in item for item in preview.errors)


def test_analyze_flags_duplicate_phone_and_email():
    preview = analyze_customer_import(
        "שם,טלפון,דואל\nא,0501112222,a@b.c\nב,050-111-2222,A@B.C\n",
        existing_phones=set(),
        existing_emails=set(),
    )
    assert preview.valid_count == 1
    assert preview.error_count == 1
    assert any("כפול" in item for item in preview.errors)


def test_analyze_flags_existing_workspace_duplicate():
    preview = analyze_customer_import(
        "display_name,phone,email\nחדש,0501112222,old@ex.com\n",
        existing_phones={"501112222"},
        existing_emails={"old@ex.com"},
    )
    assert preview.valid_count == 0
    assert any("טלפון כפול" in item or "דוא״ל כפול" in item for item in preview.errors)


def test_analyze_rejects_oversize_row_count():
    lines = ["display_name"] + [f"לקוח{i}" for i in range(201)]
    preview = analyze_customer_import("\n".join(lines))
    assert preview.too_large is True
    assert preview.valid_count == 200


def test_preview_customers_does_not_create(monkeypatch):
    client = FakeRest()
    monkeypatch.setattr(customers_mod, "_ctx", lambda *a, **k: _ctx())
    monkeypatch.setattr(customers_mod, "require", lambda *a, **k: None)
    out = preview_customers_csv(
        WS,
        CustomerImportIn(csv_text="שם,טלפון\nמייק,050\n"),
        client,
        {"id": ACTOR},
    )
    assert out.valid_count == 1
    assert client.posts == []


def test_import_skips_duplicate_existing_phone(monkeypatch):
    client = FakeRest({"customers": [{"phone": "0501112222", "email": None}]})
    monkeypatch.setattr(customers_mod, "_ctx", lambda *a, **k: _ctx())
    monkeypatch.setattr(customers_mod, "require", lambda *a, **k: None)
    monkeypatch.setattr(customers_mod, "fetch_customers_count", lambda *a, **k: 1)
    monkeypatch.setattr(
        customers_mod,
        "evaluate_count_limit",
        lambda **k: type("D", (), {"allowed": True})(),
    )
    result = import_customers_csv(
        WS,
        CustomerImportIn(csv_text="display_name,phone\nכפול,050-111-2222\n"),
        client,
        {"id": ACTOR},
    )
    assert result.created == 0
    assert result.skipped == 1
    assert client.posts == []


def test_delete_equipment_blocked_when_service_call_linked(monkeypatch):
    client = FakeRest(
        {
            "equipment": [{"id": EID, "site_id": SITE, "name": "מצלמה"}],
            "service_calls": [{"id": "sc1", "equipment_id": EID}],
        }
    )
    monkeypatch.setattr(systems_mod, "_ctx", lambda *a, **k: _ctx())
    monkeypatch.setattr(systems_mod, "require", lambda *a, **k: None)
    with pytest.raises(ApiError) as err:
        delete_equipment(WS, UUID(EID), client, {"id": ACTOR}, client)
    assert err.value.status_code == 409
    assert "שירות" in err.value.message
    assert client.deletes == []


def test_delete_equipment_blocked_when_warranty_linked(monkeypatch):
    client = FakeRest(
        {
            "equipment": [{"id": EID, "site_id": SITE, "name": "מצלמה"}],
            "warranties": [{"id": "w1", "installed_equipment_id": EID}],
        }
    )
    monkeypatch.setattr(systems_mod, "_ctx", lambda *a, **k: _ctx())
    monkeypatch.setattr(systems_mod, "require", lambda *a, **k: None)
    with pytest.raises(ApiError) as err:
        delete_equipment(WS, UUID(EID), client, {"id": ACTOR}, client)
    assert err.value.status_code == 409
    assert client.deletes == []


def test_delete_task_viewer_denied_by_catalog(monkeypatch):
    client = FakeRest({"tasks": [{"id": TID, "title": "x", "assignee_id": ACTOR}]})
    monkeypatch.setattr(ops, "_ctx", lambda *a, **k: _ctx(role="viewer"))
    with pytest.raises(ApiError) as err:
        delete_task(WS, UUID(TID), client, {"id": ACTOR})
    assert err.value.status_code == 403
    assert client.deletes == []


def test_delete_task_technician_cannot_delete_others(monkeypatch):
    client = FakeRest({"tasks": [{"id": TID, "title": "של אחר", "assignee_id": "other-user"}]})
    monkeypatch.setattr(ops, "_ctx", lambda *a, **k: _ctx(role="technician"))
    with pytest.raises(ApiError) as err:
        delete_task(WS, UUID(TID), client, {"id": ACTOR})
    assert err.value.status_code == 403
    assert "טכנאי" in err.value.message
    assert client.deletes == []


def test_delete_task_technician_can_delete_own(monkeypatch):
    client = FakeRest({"tasks": [{"id": TID, "title": "שלי", "assignee_id": ACTOR}]})
    monkeypatch.setattr(ops, "_ctx", lambda *a, **k: _ctx(role="technician"))
    out = delete_task(WS, UUID(TID), client, {"id": ACTOR})
    assert out == {"ok": True}
    assert client.deletes[0][0] == "tasks"
