"""Portal GET /workforce/me/shifts: own assignments only, server-side bind."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.deps import current_user
from app.errors import ApiError
from app.main import app
from app.workforce.shifts import list_my_shifts

from tests.test_workforce_stage3 import USER, WS_A, WS_B, StageStore, _bind, _ctx, _iso, _seed_directory

PORTAL = frozenset({"workforce.portal.view"})
VIEWER = frozenset({"workforce.view", "workforce.sites.view", "workforce.schedules.view"})


def _week() -> tuple[str, str]:
    start = datetime(2026, 10, 18, 0, 0, tzinfo=timezone.utc)
    return start.isoformat().replace("+00:00", "Z"), (start + timedelta(days=7)).isoformat().replace("+00:00", "Z")


def _seed_own_shifts(store: StageStore) -> dict[str, str]:
    ids = _seed_directory(store)
    store._filter("workforce_sites", {"id": f"eq.{ids['site_a']}"})[0]["timezone"] = "Asia/Jerusalem"
    mine = store.post(
        "workforce_employees",
        {
            "workspace_id": WS_A,
            "user_id": USER,
            "first_name": "דנה",
            "last_name": "פורטל",
            "employment_status": "active",
        },
    ).json()[0]
    ids["emp_self"] = mine["id"]
    starts, ends = _iso()
    later_start = datetime(2026, 10, 28, 8, 0, tzinfo=timezone.utc)
    later_end = later_start + timedelta(hours=8)
    overnight_start = datetime(2026, 10, 21, 19, 0, tzinfo=timezone.utc)
    overnight_end = datetime(2026, 10, 22, 3, 0, tzinfo=timezone.utc)
    ids["own_shift"] = store.post(
        "workforce_shifts",
        {
            "workspace_id": WS_A,
            "employee_id": ids["emp_self"],
            "site_id": ids["site_a"],
            "position_id": ids["pos_a"],
            "starts_at": starts,
            "ends_at": ends,
            "notes": "שער דרום",
        },
    ).json()[0]["id"]
    ids["overnight"] = store.post(
        "workforce_shifts",
        {
            "workspace_id": WS_A,
            "employee_id": ids["emp_self"],
            "site_id": ids["site_a"],
            "starts_at": overnight_start.isoformat().replace("+00:00", "Z"),
            "ends_at": overnight_end.isoformat().replace("+00:00", "Z"),
        },
    ).json()[0]["id"]
    ids["outside"] = store.post(
        "workforce_shifts",
        {
            "workspace_id": WS_A,
            "employee_id": ids["emp_self"],
            "site_id": ids["site_a"],
            "starts_at": later_start.isoformat().replace("+00:00", "Z"),
            "ends_at": later_end.isoformat().replace("+00:00", "Z"),
        },
    ).json()[0]["id"]
    ids["coworker"] = store.post(
        "workforce_shifts",
        {
            "workspace_id": WS_A,
            "employee_id": ids["emp_a"],
            "site_id": ids["site_a"],
            "starts_at": starts,
            "ends_at": ends,
            "notes": "לא אמור להופיע",
        },
    ).json()[0]["id"]
    ids["foreign"] = store.post(
        "workforce_shifts",
        {
            "workspace_id": WS_B,
            "employee_id": ids["emp_b"],
            "site_id": ids["site_b"],
            "starts_at": starts,
            "ends_at": ends,
        },
    ).json()[0]["id"]
    return ids


def test_list_my_shifts_filters_to_linked_employee_and_range():
    store = StageStore()
    ids = _seed_own_shifts(store)
    starts_from, starts_to = _week()
    payload = list_my_shifts(store, WS_A, USER, starts_from=starts_from, starts_to=starts_to)
    assert payload["employee"]["id"] == ids["emp_self"]
    returned = {row["id"] for row in payload["items"]}
    assert ids["own_shift"] in returned
    assert ids["overnight"] in returned
    assert ids["outside"] not in returned
    assert ids["coworker"] not in returned
    assert ids["foreign"] not in returned
    own = next(row for row in payload["items"] if row["id"] == ids["own_shift"])
    assert own["status"] == "assigned"
    assert own["site_name"] == "אתר א"
    assert own["notes"] == "שער דרום"
    assert "employee_name" not in own
    overnight = next(row for row in payload["items"] if row["id"] == ids["overnight"])
    assert overnight["overnight"] is True


def test_unlinked_user_does_not_invent_employee_bind():
    store = StageStore()
    _seed_directory(store)
    with pytest.raises(ApiError) as exc:
        list_my_shifts(store, WS_A, USER, starts_from=_week()[0], starts_to=_week()[1])
    assert exc.value.status_code == 404
    assert exc.value.code == "WORKFORCE_EMPLOYEE_NOT_LINKED"


def test_empty_range_returns_items_list():
    store = StageStore()
    ids = _seed_directory(store)
    store.post(
        "workforce_employees",
        {"workspace_id": WS_A, "user_id": USER, "first_name": "דנה", "last_name": "ריק", "employment_status": "active"},
    )
    starts_from, starts_to = _week()
    payload = list_my_shifts(store, WS_A, USER, starts_from=starts_from, starts_to=starts_to)
    assert payload["items"] == []
    assert payload["employee"]["id"] != ids["emp_a"]


def test_http_portal_sees_own_shifts_only(monkeypatch):
    store = StageStore()
    ids = _seed_own_shifts(store)
    client = _bind(monkeypatch, store, _ctx("workforce_member", grants=PORTAL))
    try:
        res = client.get(
            f"/api/v1/workspaces/{WS_A}/workforce/me/shifts",
            headers={"Authorization": "Bearer t"},
            params={"starts_from": _week()[0], "starts_to": _week()[1]},
        )
        assert res.status_code == 200
        body = res.json()
        returned = {row["id"] for row in body["items"]}
        assert returned == {ids["own_shift"], ids["overnight"]}
        assert body["employee"]["id"] == ids["emp_self"]
        org = client.get(
            f"/api/v1/workspaces/{WS_A}/workforce/shifts",
            headers={"Authorization": "Bearer t"},
            params={"starts_from": _week()[0], "starts_to": _week()[1]},
        )
        assert org.status_code == 403
        week = client.get(
            f"/api/v1/workspaces/{WS_A}/workforce/week",
            headers={"Authorization": "Bearer t"},
            params={"starts_from": _week()[0], "starts_to": _week()[1]},
        )
        assert week.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_http_rejects_client_employee_id(monkeypatch):
    store = StageStore()
    ids = _seed_own_shifts(store)
    client = _bind(monkeypatch, store, _ctx("workforce_member", grants=PORTAL))
    try:
        res = client.get(
            f"/api/v1/workspaces/{WS_A}/workforce/me/shifts",
            headers={"Authorization": "Bearer t"},
            params={
                "starts_from": _week()[0],
                "starts_to": _week()[1],
                "employee_id": ids["emp_a"],
            },
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "VALIDATION_ERROR"
    finally:
        app.dependency_overrides.clear()


def test_http_missing_portal_view_denied(monkeypatch):
    store = StageStore()
    _seed_own_shifts(store)
    client = _bind(monkeypatch, store, _ctx("technician"))
    try:
        res = client.get(
            f"/api/v1/workspaces/{WS_A}/workforce/me/shifts",
            headers={"Authorization": "Bearer t"},
            params={"starts_from": _week()[0], "starts_to": _week()[1]},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "PERMISSION_DENIED"
        assert "items" not in res.json()
    finally:
        app.dependency_overrides.clear()


def test_http_viewer_without_employee_row_is_not_linked(monkeypatch):
    store = StageStore()
    _seed_own_shifts(store)
    client = _bind(monkeypatch, store, _ctx("viewer", grants=VIEWER | PORTAL))
    app.dependency_overrides[current_user] = lambda: {"id": "00000000-0000-0000-0000-0000000000aa"}
    try:
        res = client.get(
            f"/api/v1/workspaces/{WS_A}/workforce/me/shifts",
            headers={"Authorization": "Bearer t"},
            params={"starts_from": _week()[0], "starts_to": _week()[1]},
        )
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "WORKFORCE_EMPLOYEE_NOT_LINKED"
    finally:
        app.dependency_overrides.clear()


def test_http_tenant_isolation(monkeypatch):
    store = StageStore()
    _seed_own_shifts(store)
    client = _bind(monkeypatch, store, _ctx("workforce_member", grants=PORTAL))
    try:
        res = client.get(
            f"/api/v1/workspaces/{WS_B}/workforce/me/shifts",
            headers={"Authorization": "Bearer t"},
            params={"starts_from": _week()[0], "starts_to": _week()[1]},
        )
        assert res.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_http_unauthenticated():
    res = TestClient(app).get(
        f"/api/v1/workspaces/{WS_A}/workforce/me/shifts",
        params={"starts_from": _week()[0], "starts_to": _week()[1]},
    )
    assert res.status_code == 401


def test_http_invalid_date_range(monkeypatch):
    store = StageStore()
    _seed_own_shifts(store)
    client = _bind(monkeypatch, store, _ctx("workforce_member", grants=PORTAL))
    try:
        res = client.get(
            f"/api/v1/workspaces/{WS_A}/workforce/me/shifts",
            headers={"Authorization": "Bearer t"},
            params={"starts_from": _week()[1], "starts_to": _week()[0]},
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "VALIDATION_ERROR"
    finally:
        app.dependency_overrides.clear()


def test_openapi_includes_me_shifts_get_only():
    paths = TestClient(app).get("/api/openapi.json").json()["paths"]
    path = "/api/v1/workspaces/{workspace_id}/workforce/me/shifts"
    assert path in paths
    assert "get" in paths[path]
    assert "post" not in paths[path]
