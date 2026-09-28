"""Task create defaults assignee_id to actor so technicians can complete own tasks (C0)."""

from __future__ import annotations

from uuid import UUID

import httpx

from app.authz.types import AuthzContext
from app.routers import ops_modules as ops
from app.routers.ops_modules import TaskCreate, create_task

WS = UUID("00000000-0000-0000-0000-0000000000aa")
TECH = "11111111-1111-1111-1111-111111111111"
MANAGER = "33333333-3333-3333-3333-333333333333"
OTHER = "22222222-2222-2222-2222-222222222222"


def _ok(data, status=200) -> httpx.Response:
    return httpx.Response(status, json=data)


class FakeClient:
    def __init__(self) -> None:
        self.posts: list[tuple[str, dict]] = []

    def post(self, table: str, payload: dict):
        self.posts.append((table, payload))
        row = {
            "id": "00000000-0000-0000-0000-000000000099",
            "created_at": "2026-09-26T00:00:00+00:00",
            "updated_at": "2026-09-26T00:00:00+00:00",
            "type": payload.get("type") or "other",
            "status": "open",
            **payload,
        }
        return _ok([row])


def _ctx(role: str, user_id: str) -> AuthzContext:
    from app.authz.catalog import load_catalog

    catalog = load_catalog()
    return AuthzContext(
        user_id=user_id,
        workspace_id=str(WS),
        role_key=role,
        workspace_status="active",
        subscription_status="active",
        plan_key="solo",
        features=catalog["_plan_features"]["solo"],
    )


def _patch_auth(monkeypatch, ctx: AuthzContext) -> None:
    monkeypatch.setattr(ops, "_ctx", lambda *a, **k: ctx)
    monkeypatch.setattr(ops, "require", lambda *a, **k: None)


def test_technician_create_without_assignee_defaults_to_actor(monkeypatch):
    client = FakeClient()
    _patch_auth(monkeypatch, _ctx("technician", TECH))
    row = create_task(WS, TaskCreate(title="בדיקת C0"), client, {"id": TECH})
    assert client.posts[0][0] == "tasks"
    payload = client.posts[0][1]
    assert payload["workspace_id"] == str(WS)
    assert payload["created_by"] == TECH
    assert payload["assignee_id"] == TECH
    assert row["assignee_id"] == TECH
    assert row["created_by"] == TECH


def test_explicit_assignee_id_is_preserved(monkeypatch):
    client = FakeClient()
    _patch_auth(monkeypatch, _ctx("manager", MANAGER))
    create_task(
        WS,
        TaskCreate(title="משימה לטכנאי", assignee_id=OTHER),
        client,
        {"id": MANAGER},
    )
    payload = client.posts[0][1]
    assert payload["created_by"] == MANAGER
    assert payload["assignee_id"] == OTHER


def test_manager_create_without_assignee_defaults_to_manager(monkeypatch):
    client = FakeClient()
    _patch_auth(monkeypatch, _ctx("manager", MANAGER))
    create_task(WS, TaskCreate(title="משימת מנהל"), client, {"id": MANAGER})
    payload = client.posts[0][1]
    assert payload["assignee_id"] == MANAGER
    assert payload["created_by"] == MANAGER


def test_lead_visit_create_defaults_assignee_when_omitted(monkeypatch):
    """ScheduleVisitSheet omits assignee_id — creator must still be able to update under RLS."""
    client = FakeClient()
    _patch_auth(monkeypatch, _ctx("sales", MANAGER))
    create_task(
        WS,
        TaskCreate(
            title="ביקור · ליד",
            type="visit",
            lead_id="00000000-0000-0000-0000-000000000001",
            time_window="afternoon",
            visit_status="pending_schedule",
        ),
        client,
        {"id": MANAGER},
    )
    payload = client.posts[0][1]
    assert payload["type"] == "visit"
    assert payload["lead_id"] == "00000000-0000-0000-0000-000000000001"
    assert payload["assignee_id"] == MANAGER
    assert "workspace_id" in payload
    assert payload["workspace_id"] == str(WS)


def test_workspace_id_always_from_path_not_body(monkeypatch):
    client = FakeClient()
    _patch_auth(monkeypatch, _ctx("technician", TECH))
    create_task(WS, TaskCreate(title="בידוד"), client, {"id": TECH})
    assert client.posts[0][1]["workspace_id"] == str(WS)
