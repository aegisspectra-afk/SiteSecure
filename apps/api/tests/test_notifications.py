"""SITE SECURE in-app notifications — RBAC, workspace isolation, prefs, emit."""

from __future__ import annotations

from uuid import UUID

import httpx
import pytest

from app.authz.types import AuthzContext
from app.errors import ApiError
from app.notify import emit_notification, notify_quote_event, notify_task_assigned
from app.routers import notifications as notif


WS = UUID("00000000-0000-0000-0000-0000000000aa")
OTHER_WS = UUID("00000000-0000-0000-0000-0000000000bb")
ACTOR = "44444444-4444-4444-4444-444444444444"
OTHER = "55555555-5555-5555-5555-555555555555"
NID = "66666666-6666-6666-6666-666666666666"


def _ok(data, status=200) -> httpx.Response:
    return httpx.Response(status, json=data)


def _ctx(role: str, workspace_id: str = str(WS)) -> AuthzContext:
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
        assigned_resource_ids=frozenset(),
    )


class FakeStore:
    def __init__(self, rows: list[dict] | None = None, prefs: list[dict] | None = None) -> None:
        self.rows = rows or []
        self.prefs = prefs or []
        self.gets: list[tuple[str, dict]] = []
        self.posts: list[tuple[str, dict]] = []
        self.patches: list[tuple[str, dict, dict]] = []

    def get(self, table: str, params: dict | None = None):
        params = params or {}
        self.gets.append((table, params))
        ws = str(params.get("workspace_id") or "")
        if table == "notifications":
            items = list(self.rows)
            if ws and str(WS) not in ws:
                items = []
            recipient = str(params.get("recipient_user_id") or "")
            if recipient:
                uid = recipient.replace("eq.", "")
                items = [r for r in items if str(r.get("recipient_user_id")) == uid]
            if params.get("read_at") == "is.null":
                items = [r for r in items if not r.get("read_at")]
            nid = str(params.get("id") or "")
            if nid.startswith("eq."):
                items = [r for r in items if str(r["id"]) == nid[3:]]
            return _ok(items)
        if table == "notification_preferences":
            items = list(self.prefs)
            if ws and str(WS) not in ws:
                items = []
            return _ok(items)
        return _ok([])

    def post(self, table: str, payload: dict | None = None, params: dict | None = None):
        self.posts.append((table, payload or {}))
        row = {"id": NID, **(payload or {})}
        if table == "notifications":
            self.rows.append(row)
        if table == "notification_preferences":
            self.prefs.append(row)
        return _ok([row], 201)

    def patch(self, table: str, payload: dict, params: dict | None = None, *, prefer: str | None = None):
        params = params or {}
        self.patches.append((table, payload, params))
        if table == "notifications":
            updated = []
            for row in self.rows:
                if str(row.get("recipient_user_id")) != ACTOR:
                    continue
                if params.get("id") and str(row["id"]) not in str(params.get("id")):
                    continue
                row.update(payload)
                updated.append(row)
            return _ok(updated)
        return _ok([])


def test_list_only_own_workspace_and_recipient(monkeypatch):
    store = FakeStore(
        rows=[
            {
                "id": NID,
                "workspace_id": str(WS),
                "recipient_user_id": ACTOR,
                "type": "quote.viewed",
                "title": "הצעת מחיר נצפתה",
                "body": "הצעה Q-1",
                "entity_type": "quote",
                "entity_id": "11111111-1111-1111-1111-111111111111",
                "payload": {},
                "read_at": None,
                "created_at": "2026-11-01T00:00:00+00:00",
            },
            {
                "id": "77777777-7777-7777-7777-777777777777",
                "workspace_id": str(WS),
                "recipient_user_id": OTHER,
                "type": "quote.viewed",
                "title": "לא שלי",
                "body": None,
                "entity_type": "quote",
                "entity_id": None,
                "payload": {},
                "read_at": None,
                "created_at": "2026-11-01T00:00:00+00:00",
            },
        ]
    )
    monkeypatch.setattr(notif, "_ctx", lambda *a, **k: _ctx("viewer"))
    page = notif.list_notifications(WS, store, {"id": ACTOR}, unread_only=False, limit=30, cursor=None)
    assert len(page.items) == 1
    assert page.items[0].title == "הצעת מחיר נצפתה"
    assert page.unread_count == 1


def test_list_other_workspace_empty(monkeypatch):
    store = FakeStore(
        rows=[
            {
                "id": NID,
                "workspace_id": str(WS),
                "recipient_user_id": ACTOR,
                "type": "quote.sent",
                "title": "נשלחה",
                "body": None,
                "entity_type": "quote",
                "entity_id": None,
                "payload": {},
                "read_at": None,
                "created_at": "2026-11-01T00:00:00+00:00",
            }
        ]
    )
    monkeypatch.setattr(notif, "_ctx", lambda *a, **k: _ctx("manager", workspace_id=str(OTHER_WS)))
    page = notif.list_notifications(OTHER_WS, store, {"id": ACTOR}, unread_only=False, limit=30, cursor=None)
    assert page.items == []
    assert any(str(OTHER_WS) in str(params.get("workspace_id") or "") for _, params in store.gets)


def test_mark_read_and_read_all(monkeypatch):
    store = FakeStore(
        rows=[
            {
                "id": NID,
                "workspace_id": str(WS),
                "recipient_user_id": ACTOR,
                "type": "task.assigned",
                "title": "משימה",
                "body": None,
                "entity_type": "task",
                "entity_id": None,
                "payload": {},
                "read_at": None,
                "created_at": "2026-11-01T00:00:00+00:00",
            }
        ]
    )
    monkeypatch.setattr(notif, "_ctx", lambda *a, **k: _ctx("sales"))
    out = notif.mark_read(WS, UUID(NID), store, {"id": ACTOR})
    assert out.read_at
    all_read = notif.mark_all_read(WS, store, {"id": ACTOR})
    assert all_read.unread_count == 0


def test_prefs_default_in_app_and_reject_unknown(monkeypatch):
    store = FakeStore()
    monkeypatch.setattr(notif, "_ctx", lambda *a, **k: _ctx("technician"))
    prefs = notif.get_preferences(WS, store, {"id": ACTOR})
    assert {item.event_type for item in prefs.items} >= {
        "quote.viewed",
        "quote.approved",
        "quote.rejected",
        "quote.expired",
        "quote.sent",
        "task.assigned",
    }
    assert all(item.in_app and item.email is False and item.push is False for item in prefs.items)
    with pytest.raises(ApiError) as ei:
        notif.put_preferences(
            WS,
            notif.PreferencesPut(items=[notif.PreferenceOut(event_type="smtp.send", in_app=True)]),
            store,
            {"id": ACTOR},
        )
    assert ei.value.status_code == 400


def test_emit_skips_self_and_disabled_pref():
    store = FakeStore()
    emit_notification(
        store,
        workspace_id=str(WS),
        recipient_user_id=ACTOR,
        event_type="quote.sent",
        title="נשלחה",
        actor_user_id=ACTOR,
    )
    assert store.posts == []
    store.prefs = [{"in_app": False}]
    emit_notification(
        store,
        workspace_id=str(WS),
        recipient_user_id=OTHER,
        event_type="quote.viewed",
        title="נצפתה",
        actor_user_id=ACTOR,
    )
    assert store.posts == []
    store.prefs = []
    notify_quote_event(
        store,
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "workspace_id": str(WS),
            "owner_user_id": OTHER,
            "number": "Q-9",
            "status": "viewed",
        },
        "quote.viewed",
    )
    assert store.posts[0][0] == "notifications"
    assert store.posts[0][1]["recipient_user_id"] == OTHER
    assert store.posts[0][1]["type"] == "quote.viewed"
    notify_task_assigned(
        store,
        {"id": NID, "assignee_id": OTHER, "title": "בדיקה"},
        workspace_id=str(WS),
        actor_user_id=ACTOR,
    )
    assert store.posts[-1][1]["type"] == "task.assigned"
    assert "בדיקה" in (store.posts[-1][1].get("body") or "")


def test_task_assigned_goes_only_to_assignee():
    store = FakeStore()
    notify_task_assigned(
        store,
        {"id": NID, "assignee_id": OTHER, "title": "ביקור", "owner_user_id": ACTOR},
        workspace_id=str(WS),
        actor_user_id=ACTOR,
    )
    assert len(store.posts) == 1
    assert store.posts[0][1]["recipient_user_id"] == OTHER
    assert store.posts[0][1]["recipient_user_id"] != ACTOR


def test_notify_copy_has_no_cost_or_margin():
    store = FakeStore()
    notify_quote_event(
        store,
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "workspace_id": str(WS),
            "owner_user_id": OTHER,
            "number": "Q-9",
            "status": "sent",
            "total_gross": 9999,
            "cost": 4000,
            "margin": 0.4,
        },
        "quote.sent",
        actor_user_id=ACTOR,
    )
    payload = store.posts[0][1]
    blob = f"{payload.get('title')} {payload.get('body')} {payload.get('payload')}"
    assert "cost" not in blob.casefold()
    assert "margin" not in blob.casefold()
    assert "4000" not in blob
    assert "9999" not in blob
    assert "0.4" not in blob
    assert set(payload["payload"]) <= {"number", "status"}


def test_emit_failure_is_best_effort():
    class Boom(FakeStore):
        def post(self, table, payload=None, params=None):
            raise RuntimeError("notify down")

    boom = Boom()
    emit_notification(
        boom,
        workspace_id=str(WS),
        recipient_user_id=OTHER,
        event_type="quote.sent",
        title="נשלחה",
        actor_user_id=ACTOR,
    )
    from app.notify import try_notify

    try_notify(
        notify_quote_event,
        boom,
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "workspace_id": str(WS),
            "owner_user_id": OTHER,
            "number": "Q-1",
            "status": "sent",
        },
        "quote.sent",
        actor_user_id=ACTOR,
    )


def test_send_survives_notify_failure(monkeypatch):
    from unittest.mock import MagicMock, patch
    from types import SimpleNamespace
    from uuid import uuid4

    from app.routers import quotes as quotes_router

    client = MagicMock()
    svc = MagicMock()
    user = {"id": ACTOR}
    workspace_id = uuid4()
    qid = str(uuid4())
    existing = {
        "id": qid,
        "workspace_id": str(workspace_id),
        "status": "draft",
        "version": 1,
        "vat_percent": 18,
        "customer_id": "c1",
        "title": "T",
        "payment_terms": "x",
    }
    items = [{"id": "i1", "item_type": "catalog", "qty": 1, "unit_price": 10, "discount": 0, "cost": 80}]
    sent_row = {**existing, "status": "sent", "sent_at": "2026-11-01T12:00:00+00:00"}
    client.patch.return_value = SimpleNamespace(status_code=200, json=lambda: [sent_row])

    def _boom(*_a, **_k):
        raise RuntimeError("notify down")

    monkeypatch.setattr(quotes_router, "notify_quote_event", _boom)
    with (
        patch.object(quotes_router, "_quote_writer", return_value=client),
        patch.object(quotes_router, "_load_items", return_value=items),
        patch.object(quotes_router, "_persist_totals", return_value=(existing, items)),
        patch.object(quotes_router, "_related", return_value=({"name": "W"}, {"display_name": "C"}, None)),
        patch.object(quotes_router, "_load_quote_settings", return_value={}),
        patch.object(quotes_router, "validate_for_send", return_value=[]),
        patch.object(quotes_router, "advisory_checks", return_value=[]),
        patch.object(quotes_router, "_upsert_version_snapshot"),
        patch.object(quotes_router, "_mint_access"),
        patch.object(quotes_router, "new_public_token", return_value="tok"),
        patch.object(quotes_router, "_record_event"),
        patch.object(quotes_router, "write_audit"),
    ):
        row, _items, token = quotes_router._transition_to_sent(
            client, svc, user, workspace_id, existing
        )
    assert row["status"] == "sent"
    assert token == "tok"


def test_mark_read_does_not_touch_other_recipient(monkeypatch):
    store = FakeStore(
        rows=[
            {
                "id": NID,
                "workspace_id": str(WS),
                "recipient_user_id": OTHER,
                "type": "quote.sent",
                "title": "לא שלי",
                "body": None,
                "entity_type": "quote",
                "entity_id": None,
                "payload": {},
                "read_at": None,
                "created_at": "2026-11-01T00:00:00+00:00",
            }
        ]
    )
    monkeypatch.setattr(notif, "_ctx", lambda *a, **k: _ctx("sales"))
    from app.errors import ApiError as Err

    with pytest.raises(Err) as ei:
        notif.mark_read(WS, UUID(NID), store, {"id": ACTOR})
    assert ei.value.status_code == 404
