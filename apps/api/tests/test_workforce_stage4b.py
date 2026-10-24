"""Stage 4B: demand vs assignment, validation, overnight, policy, isolation."""

from __future__ import annotations

from datetime import date, time

from fastapi.testclient import TestClient

from app.errors import ApiError
from app.main import app
from app.workforce.clock import local_window_to_utc
from app.workforce.demand import (
    create_coverage,
    create_slot,
    create_time_off,
    delete_slot,
    materialize_slots,
    update_slot,
    upsert_policy,
    week_board,
)
from app.workforce.engine import validate_week
from app.workforce.shifts import create_shift, delete_shift, list_shifts, update_shift
from app.workforce.validation import validate_assignment

from tests.test_workforce_stage3 import (
    WS_A,
    WS_B,
    StageStore,
    _bind,
    _ctx,
    _iso,
    _seed_directory,
)


class StaffingStore(StageStore):
    def __init__(self) -> None:
        super().__init__()
        self.tables.update(
            {
                "workforce_coverage_requirements": [],
                "workforce_shift_slots": [],
                "workforce_schedule_policies": [],
                "workforce_time_off": [],
                "workforce_qualifications": [],
                "workforce_position_requirements": [],
            }
        )


def _range(hour: int, duration: int = 8, day: int = 21) -> tuple[str, str]:
    from datetime import datetime, timedelta, timezone

    start = datetime(2026, 10, day, hour, 0, tzinfo=timezone.utc)
    end = start + timedelta(hours=duration)
    return start.isoformat().replace("+00:00", "Z"), end.isoformat().replace("+00:00", "Z")


def test_dst_overnight_templates_use_site_timezone():
    start, end = local_window_to_utc(
        timezone_name="Asia/Jerusalem",
        on_date=date(2026, 3, 26),
        start_local=time(22, 0),
        end_local=time(6, 0),
        crosses_midnight=True,
    )
    assert end > start
    hours = (end - start).total_seconds() / 3600
    assert hours in {7.0, 8.0, 9.0}


def test_demand_is_not_a_null_employee_shift():
    store = StaffingStore()
    ids = _seed_directory(store)
    starts, ends = _range(22, 8)
    slot = create_slot(
        store,
        WS_A,
        {"site_id": ids["site_a"], "position_id": ids["pos_a"], "starts_at": starts, "ends_at": ends},
    )
    assert slot["unfilled_count"] == 1
    assert "employee_id" not in slot or slot.get("employee_id") in {None, ""}
    assert store.tables["workforce_shifts"] == []
    board = week_board(store, WS_A, starts_from="2026-10-21T00:00:00Z", starts_to="2026-10-23T00:00:00Z")
    assert board["slots"]
    assert any(item["code"] == "unfilled_slot" for item in board["issues"])
    assert board["assignments"] == []


def test_coverage_materializes_unfilled_slots_without_employees():
    store = StaffingStore()
    ids = _seed_directory(store)
    create_coverage(
        store,
        WS_A,
        {
            "site_id": ids["site_a"],
            "position_id": ids["pos_a"],
            "weekday": 3,
            "start_local": "22:00",
            "end_local": "06:00",
            "crosses_midnight": True,
            "required_count": 2,
        },
    )
    created = materialize_slots(
        store,
        WS_A,
        starts_from="2026-10-18T00:00:00Z",
        starts_to="2026-10-25T00:00:00Z",
    )
    assert created
    assert created[0]["required_count"] == 2
    assert created[0]["unfilled_count"] == 2
    again = materialize_slots(
        store,
        WS_A,
        starts_from="2026-10-18T00:00:00Z",
        starts_to="2026-10-25T00:00:00Z",
    )
    assert again == []


def test_overnight_assignment_listed_on_next_calendar_day():
    store = StaffingStore()
    ids = _seed_directory(store)
    starts, ends = _range(22, 8)
    created = create_shift(
        store,
        WS_A,
        {
            "employee_id": ids["emp_a"],
            "site_id": ids["site_a"],
            "position_id": ids["pos_a"],
            "starts_at": starts,
            "ends_at": ends,
        },
    )
    listed = list_shifts(store, WS_A, starts_from="2026-10-22T00:00:00Z", starts_to="2026-10-23T00:00:00Z")
    assert {row["id"] for row in listed} == {created["id"]}


def test_overlap_is_hard_and_validate_does_not_write():
    store = StaffingStore()
    ids = _seed_directory(store)
    starts, ends = _iso()
    create_shift(
        store,
        WS_A,
        {
            "employee_id": ids["emp_a"],
            "site_id": ids["site_a"],
            "position_id": ids["pos_a"],
            "starts_at": starts,
            "ends_at": ends,
        },
    )
    before = len(store.tables["workforce_shifts"])
    result = validate_assignment(
        store,
        WS_A,
        {
            "employee_id": ids["emp_a"],
            "site_id": ids["site_a"],
            "position_id": ids["pos_a"],
            "starts_at": starts,
            "ends_at": ends,
        },
    )
    assert result["ok"] is False
    assert any(item["code"] == "overlap" and item["severity"] == "hard" for item in result["issues"])
    assert len(store.tables["workforce_shifts"]) == before
    try:
        create_shift(
            store,
            WS_A,
            {
                "employee_id": ids["emp_a"],
                "site_id": ids["site_a"],
                "position_id": ids["pos_a"],
                "starts_at": starts,
                "ends_at": ends,
            },
        )
        raise AssertionError("overlap should block save")
    except ApiError as exc:
        assert exc.status_code == 400
        assert "חופפת" in exc.message


def test_approved_absence_blocks_pending_is_soft():
    store = StaffingStore()
    ids = _seed_directory(store)
    starts, ends = _iso()
    create_time_off(
        store,
        WS_A,
        {"employee_id": ids["emp_a"], "starts_at": starts, "ends_at": ends, "status": "pending"},
    )
    soft = validate_assignment(
        store,
        WS_A,
        {
            "employee_id": ids["emp_a"],
            "site_id": ids["site_a"],
            "position_id": ids["pos_a"],
            "starts_at": starts,
            "ends_at": ends,
        },
    )
    assert soft["ok"] is True
    assert any(item["code"] == "pending_absence" for item in soft["soft"])
    store.tables["workforce_time_off"][0]["status"] = "approved"
    hard = validate_assignment(
        store,
        WS_A,
        {
            "employee_id": ids["emp_a"],
            "site_id": ids["site_a"],
            "position_id": ids["pos_a"],
            "starts_at": starts,
            "ends_at": ends,
        },
    )
    assert hard["ok"] is False
    assert any(item["code"] == "approved_absence" for item in hard["hard"])


def test_expired_qualification_is_hard():
    store = StaffingStore()
    ids = _seed_directory(store)
    store.post(
        "workforce_position_requirements",
        {"workspace_id": WS_A, "position_id": ids["pos_a"], "qualification_key": "gun", "enforcement": "required"},
    )
    store.post(
        "workforce_qualifications",
        {
            "workspace_id": WS_A,
            "employee_id": ids["emp_a"],
            "qualification_key": "gun",
            "expires_on": "2020-01-01",
            "is_active": True,
        },
    )
    starts, ends = _iso()
    result = validate_assignment(
        store,
        WS_A,
        {
            "employee_id": ids["emp_a"],
            "site_id": ids["site_a"],
            "position_id": ids["pos_a"],
            "starts_at": starts,
            "ends_at": ends,
        },
    )
    assert result["ok"] is False
    assert any(item["code"] == "expired_qualification" for item in result["hard"])


def test_rest_rule_only_when_enabled():
    store = StaffingStore()
    ids = _seed_directory(store)
    first_s, first_e = _range(8, 8)
    second_s, second_e = _range(18, 8)
    create_shift(
        store,
        WS_A,
        {
            "employee_id": ids["emp_a"],
            "site_id": ids["site_a"],
            "position_id": ids["pos_a"],
            "starts_at": first_s,
            "ends_at": first_e,
        },
    )
    payload = {
        "employee_id": ids["emp_a"],
        "site_id": ids["site_a"],
        "position_id": ids["pos_a"],
        "starts_at": second_s,
        "ends_at": second_e,
    }
    off = validate_assignment(store, WS_A, payload)
    assert off["ok"] is True
    assert not any(item["code"] == "rest_insufficient" for item in off["issues"])
    upsert_policy(store, WS_A, {"rest_rule_enabled": True, "min_rest_hours": 11})
    on = validate_assignment(store, WS_A, payload)
    assert on["ok"] is False
    assert any(item["code"] == "rest_insufficient" for item in on["hard"])
    upsert_policy(store, WS_A, {"rest_rule_enabled": False})
    again = validate_assignment(store, WS_A, payload)
    assert again["ok"] is True


def test_inactive_site_and_employee_are_hard():
    store = StaffingStore()
    ids = _seed_directory(store)
    starts, ends = _iso()
    store.tables["workforce_sites"][0]["is_active"] = False
    site_res = validate_assignment(
        store,
        WS_A,
        {
            "employee_id": ids["emp_a"],
            "site_id": ids["site_a"],
            "position_id": ids["pos_a"],
            "starts_at": starts,
            "ends_at": ends,
        },
    )
    assert any(item["code"] == "site_inactive" for item in site_res["hard"])
    store.tables["workforce_sites"][0]["is_active"] = True
    store.tables["workforce_employees"][0]["employment_status"] = "inactive"
    emp_res = validate_assignment(
        store,
        WS_A,
        {
            "employee_id": ids["emp_a"],
            "site_id": ids["site_a"],
            "position_id": ids["pos_a"],
            "starts_at": starts,
            "ends_at": ends,
        },
    )
    assert any(item["code"] == "employee_inactive" for item in emp_res["hard"])


def test_http_tenant_and_entitlement_for_slots(monkeypatch):
    store = StaffingStore()
    ids = _seed_directory(store)
    starts, ends = _range(8)
    manager = _bind(monkeypatch, store, _ctx("manager"))
    try:
        created = manager.post(
            f"/api/v1/workspaces/{WS_A}/workforce/slots",
            headers={"Authorization": "Bearer t"},
            json={"site_id": ids["site_a"], "position_id": ids["pos_a"], "starts_at": starts, "ends_at": ends},
        )
        assert created.status_code == 201
        foreign = manager.post(
            f"/api/v1/workspaces/{WS_B}/workforce/slots",
            headers={"Authorization": "Bearer t"},
            json={"site_id": ids["site_b"], "position_id": ids["pos_b"], "starts_at": starts, "ends_at": ends},
        )
        assert foreign.status_code == 404
        week = manager.get(
            f"/api/v1/workspaces/{WS_A}/workforce/week",
            headers={"Authorization": "Bearer t"},
            params={"starts_from": "2026-10-21T00:00:00Z", "starts_to": "2026-10-22T00:00:00Z"},
        )
        assert week.status_code == 200
        assert week.json()["slots"]
        assert all(row["workspace_id"] == WS_A for row in week.json()["slots"])
    finally:
        app.dependency_overrides.clear()

    viewer = _bind(monkeypatch, store, _ctx("viewer"))
    try:
        denied = viewer.post(
            f"/api/v1/workspaces/{WS_A}/workforce/slots",
            headers={"Authorization": "Bearer t"},
            json={"site_id": ids["site_a"], "position_id": ids["pos_a"], "starts_at": starts, "ends_at": ends},
        )
        assert denied.status_code == 403
    finally:
        app.dependency_overrides.clear()

    blocked = _bind(monkeypatch, store, _ctx("owner", features={"core", "crm"}))
    try:
        res = blocked.get(
            f"/api/v1/workspaces/{WS_A}/workforce/week",
            headers={"Authorization": "Bearer t"},
            params={"starts_from": "2026-10-21T00:00:00Z", "starts_to": "2026-10-22T00:00:00Z"},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "FEATURE_NOT_INCLUDED"
    finally:
        app.dependency_overrides.clear()


def test_http_null_employee_still_rejected(monkeypatch):
    store = StaffingStore()
    ids = _seed_directory(store)
    starts, ends = _iso()
    client = _bind(monkeypatch, store, _ctx("manager"))
    try:
        res = client.post(
            f"/api/v1/workspaces/{WS_A}/workforce/shifts",
            headers={"Authorization": "Bearer t"},
            json={"site_id": ids["site_a"], "starts_at": starts, "ends_at": ends},
        )
        assert res.status_code == 400
        assert store.tables["workforce_shifts"] == []
    finally:
        app.dependency_overrides.clear()


def test_openapi_includes_stage4b_paths():
    client = TestClient(app)
    paths = client.get("/api/openapi.json").json()["paths"]
    base = "/api/v1/workspaces/{workspace_id}/workforce"
    assert f"{base}/week" in paths
    assert f"{base}/slots" in paths
    assert "patch" in paths[f"{base}/slots/{{slot_id}}"]
    assert "delete" in paths[f"{base}/slots/{{slot_id}}"]
    assert f"{base}/validate" in paths
    assert f"{base}/coverage-requirements" in paths
    assert f"{base}/policy" in paths
    assert "post" not in paths[f"{base}/positions"]
    assert "/register" not in paths


def _emp2(store: StaffingStore) -> str:
    return store.post(
        "workforce_employees",
        {"workspace_id": WS_A, "first_name": "יוסי", "last_name": "ב", "employment_status": "active"},
    ).json()[0]["id"]


def test_zero_and_negative_required_count_rejected():
    store = StaffingStore()
    ids = _seed_directory(store)
    starts, ends = _range(8)
    body = {"site_id": ids["site_a"], "position_id": ids["pos_a"], "starts_at": starts, "ends_at": ends}
    for bad in (0, -2):
        try:
            create_slot(store, WS_A, {**body, "required_count": bad})
            raise AssertionError("invalid required_count should fail")
        except ApiError as exc:
            assert exc.status_code == 400
            assert "תקין" in exc.message
    assert store.tables["workforce_shift_slots"] == []


def test_patch_slot_updates_hours_and_headcount():
    store = StaffingStore()
    ids = _seed_directory(store)
    starts, ends = _range(8)
    slot = create_slot(store, WS_A, {"site_id": ids["site_a"], "position_id": ids["pos_a"], "starts_at": starts, "ends_at": ends})
    later_start, later_end = _range(22, 8)
    updated = update_slot(
        store,
        WS_A,
        slot["id"],
        {"starts_at": later_start, "ends_at": later_end, "required_count": 3},
    )
    assert updated["required_count"] == 3
    assert updated["starts_at"] == later_start
    assert updated["ends_at"] == later_end
    assert updated["unfilled_count"] == 3


def test_cannot_reduce_required_count_below_assigned_or_delete_filled_slot():
    store = StaffingStore()
    ids = _seed_directory(store)
    starts, ends = _range(8)
    slot = create_slot(
        store,
        WS_A,
        {"site_id": ids["site_a"], "position_id": ids["pos_a"], "starts_at": starts, "ends_at": ends, "required_count": 2},
    )
    create_shift(
        store,
        WS_A,
        {
            "employee_id": ids["emp_a"],
            "site_id": ids["site_a"],
            "position_id": ids["pos_a"],
            "slot_id": slot["id"],
            "starts_at": starts,
            "ends_at": ends,
        },
    )
    try:
        update_slot(store, WS_A, slot["id"], {"required_count": 0})
        raise AssertionError("zero required_count should fail")
    except ApiError as exc:
        assert exc.status_code == 400
    try:
        delete_slot(store, WS_A, slot["id"])
        raise AssertionError("filled slot delete should fail")
    except ApiError as exc:
        assert exc.status_code == 409
        assert exc.code == "WORKFORCE_SLOT_HAS_ASSIGNMENTS"
    assert store.tables["workforce_shift_slots"]
    assert store.tables["workforce_shifts"]


def test_duplicate_employee_on_same_slot_is_hard():
    store = StaffingStore()
    ids = _seed_directory(store)
    starts, ends = _range(8)
    slot = create_slot(
        store,
        WS_A,
        {"site_id": ids["site_a"], "position_id": ids["pos_a"], "starts_at": starts, "ends_at": ends, "required_count": 2},
    )
    payload = {
        "employee_id": ids["emp_a"],
        "site_id": ids["site_a"],
        "position_id": ids["pos_a"],
        "slot_id": slot["id"],
        "starts_at": starts,
        "ends_at": ends,
    }
    create_shift(store, WS_A, payload)
    result = validate_assignment(store, WS_A, payload)
    assert result["ok"] is False
    assert any(item["code"] == "duplicate_slot_assignment" and item["severity"] == "hard" for item in result["issues"])
    try:
        create_shift(store, WS_A, payload)
        raise AssertionError("duplicate assignment should fail")
    except ApiError as exc:
        assert exc.status_code == 400
        assert "כבר משובץ" in exc.message
    assert len(store.tables["workforce_shifts"]) == 1


def test_move_assignment_between_slots():
    store = StaffingStore()
    ids = _seed_directory(store)
    morning = _range(6)
    evening = _range(16)
    first = create_slot(
        store, WS_A, {"site_id": ids["site_a"], "position_id": ids["pos_a"], "starts_at": morning[0], "ends_at": morning[1]}
    )
    second = create_slot(
        store, WS_A, {"site_id": ids["site_a"], "position_id": ids["pos_a"], "starts_at": evening[0], "ends_at": evening[1]}
    )
    assigned = create_shift(
        store,
        WS_A,
        {
            "employee_id": ids["emp_a"],
            "site_id": ids["site_a"],
            "position_id": ids["pos_a"],
            "slot_id": first["id"],
            "starts_at": morning[0],
            "ends_at": morning[1],
        },
    )
    moved = update_shift(
        store,
        WS_A,
        assigned["id"],
        {"slot_id": second["id"], "starts_at": evening[0], "ends_at": evening[1]},
    )
    assert moved["slot_id"] == second["id"]
    assert moved["starts_at"] == evening[0]
    delete_shift(store, WS_A, moved["id"])
    delete_slot(store, WS_A, first["id"])
    delete_slot(store, WS_A, second["id"])
    assert store.tables["workforce_shifts"] == []
    assert store.tables["workforce_shift_slots"] == []


def test_week_hard_vs_soft_and_calendar_boundaries():
    store = StaffingStore()
    ids = _seed_directory(store)
    other = _emp2(store)
    day_start, day_end = _range(8)
    slot = create_slot(
        store,
        WS_A,
        {"site_id": ids["site_a"], "position_id": ids["pos_a"], "starts_at": day_start, "ends_at": day_end, "required_count": 2},
    )
    create_shift(
        store,
        WS_A,
        {
            "employee_id": ids["emp_a"],
            "site_id": ids["site_a"],
            "position_id": ids["pos_a"],
            "slot_id": slot["id"],
            "starts_at": day_start,
            "ends_at": day_end,
        },
    )
    week = validate_week(store, WS_A, starts_from="2026-10-18T00:00:00Z", starts_to="2026-10-25T00:00:00Z")
    assert week["certified_legal"] is False
    assert week["legal_status"] == "not_certified"
    assert any(item["code"] == "unfilled_slot" and item["severity"] == "soft" for item in week["issues"])
    night_start, night_end = "2026-12-31T22:00:00Z", "2027-01-01T06:00:00Z"
    night = create_slot(
        store,
        WS_A,
        {
            "site_id": ids["site_a"],
            "position_id": ids["pos_a"],
            "starts_at": night_start,
            "ends_at": night_end,
            "required_count": 1,
        },
    )
    create_shift(
        store,
        WS_A,
        {
            "employee_id": other,
            "site_id": ids["site_a"],
            "position_id": ids["pos_a"],
            "slot_id": night["id"],
            "starts_at": night_start,
            "ends_at": night_end,
        },
    )
    crossing = week_board(store, WS_A, starts_from="2026-12-27T00:00:00Z", starts_to="2027-01-03T00:00:00Z")
    assert any(row["id"] == night["id"] for row in crossing["slots"])
    assert any(row["employee_id"] == other for row in crossing["assignments"])
    jan = list_shifts(store, WS_A, starts_from="2027-01-01T00:00:00Z", starts_to="2027-01-02T00:00:00Z")
    assert any(row["employee_id"] == other for row in jan)


def test_http_patch_slot_permissions(monkeypatch):
    store = StaffingStore()
    ids = _seed_directory(store)
    starts, ends = _range(8)
    manager = _bind(monkeypatch, store, _ctx("manager"))
    try:
        created = manager.post(
            f"/api/v1/workspaces/{WS_A}/workforce/slots",
            headers={"Authorization": "Bearer t"},
            json={"site_id": ids["site_a"], "position_id": ids["pos_a"], "starts_at": starts, "ends_at": ends},
        )
        assert created.status_code == 201
        slot_id = created.json()["id"]
        patched = manager.patch(
            f"/api/v1/workspaces/{WS_A}/workforce/slots/{slot_id}",
            headers={"Authorization": "Bearer t"},
            json={"required_count": 4},
        )
        assert patched.status_code == 200
        assert patched.json()["required_count"] == 4
    finally:
        app.dependency_overrides.clear()

    viewer = _bind(monkeypatch, store, _ctx("viewer"))
    try:
        denied = viewer.patch(
            f"/api/v1/workspaces/{WS_A}/workforce/slots/{store.tables['workforce_shift_slots'][0]['id']}",
            headers={"Authorization": "Bearer t"},
            json={"required_count": 2},
        )
        assert denied.status_code == 403
        listed = viewer.get(
            f"/api/v1/workspaces/{WS_A}/workforce/week",
            headers={"Authorization": "Bearer t"},
            params={"starts_from": "2026-10-21T00:00:00Z", "starts_to": "2026-10-22T00:00:00Z"},
        )
        assert listed.status_code == 200
    finally:
        app.dependency_overrides.clear()
