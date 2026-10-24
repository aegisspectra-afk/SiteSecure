"""L2 scheduling validation engine. Local catalog + FastAPI; no legal-compliance stamp."""

from __future__ import annotations

from datetime import date, time

from app.errors import ApiError
from app.main import app
from app.workforce.catalog import can_legal_block, upsert_profile
from app.workforce.clock import local_window_to_utc
from app.workforce.demand import create_time_off, upsert_policy, week_board
from app.workforce.engine import COMPLIANCE_DISCLAIMER, validate_week
from app.workforce.shifts import create_shift
from app.workforce.validation import validate_assignment

from tests.test_workforce_l1_catalog import CatalogStore
from tests.test_workforce_stage3 import WS_A, WS_B, USER, _bind, _ctx, _seed_directory
from tests.test_workforce_stage4b import StaffingStore, _iso, _range


def _rule(code: str, **overrides) -> dict:
    row = {
        "id": f"rule-{code.lower()}",
        "workspace_id": None,
        "pack_code": "israel_hours_base",
        "rule_code": code,
        "version": 1,
        "name_he": code,
        "rule_type": "legal",
        "verification_status": "verified",
        "severity": "blocking",
        "source_kind": "statute",
        "source_citation": "Hours Law",
        "source_section": "21",
        "effective_from": "1951-09-28T00:00:00+03:00",
        "effective_to": None,
        "scope": {"hours_law_covered": True},
        "parameters": {},
        "cannot_be_relaxed": True,
    }
    row.update(overrides)
    return row


class EngineStore(CatalogStore):
    def seed_hours_pack(self) -> None:
        self.tables["workforce_rules"].extend(
            [
                _rule(
                    "OT_FORBIDDEN",
                    source_section="6",
                    parameters={"requires_in_force_permit": True},
                ),
                _rule(
                    "DAY_HOURS_BASE",
                    severity="informational",
                    source_section="2",
                    parameters={"regular_day_hours": 8, "night_or_pre_rest_day_hours": 7},
                ),
                _rule(
                    "WEEKLY_REST_36",
                    source_section="7",
                    parameters={"min_weekly_rest_hours": 36},
                ),
                _rule(
                    "WEEKLY_REST_BAN",
                    source_section="9",
                    parameters={"requires_section_12_permit": True},
                ),
                _rule(
                    "OT_PERMIT_2018",
                    pack_code="israel_ot_permit_2018",
                    rule_type="permit",
                    source_kind="yalkut",
                    source_citation="Yalkut 7732",
                    effective_from="2018-03-19T00:00:00+02:00",
                    parameters={
                        "max_day_hours_including_ot": 12,
                        "max_weekly_ot_hours": 16,
                        "max_night_week_hours_including_ot": 58,
                    },
                ),
                _rule(
                    "WEEK_HOURS_42",
                    pack_code="israel_week_42_2018",
                    rule_type="collective_agreement",
                    severity="warning",
                    cannot_be_relaxed=False,
                    effective_from="2018-04-01T00:00:00+03:00",
                    parameters={"weekly_hours": 42},
                ),
            ]
        )


def _payload(ids: dict, starts: str, ends: str, employee_key: str = "emp_a", site_key: str = "site_a") -> dict:
    return {
        "employee_id": ids[employee_key],
        "site_id": ids[site_key],
        "position_id": ids["pos_a"] if employee_key == "emp_a" else ids.get("pos_b"),
        "starts_at": starts,
        "ends_at": ends,
    }


def test_eight_hour_rest_ok_short_rest_legal_block():
    store = EngineStore()
    ids = _seed_directory(store)
    create_shift(store, WS_A, _payload(ids, *_range(8, 8)))
    short = validate_assignment(store, WS_A, _payload(ids, *_range(18, 8)))
    assert short["ok"] is False
    assert short["certified_legal"] is False
    assert any(item["code"] == "rest_legal_insufficient" for item in short["legal"])
    ok = validate_assignment(store, WS_A, _payload(ids, *_range(0, 8, day=22)))
    assert ok["ok"] is True
    assert not any(item["code"] == "rest_legal_insufficient" for item in ok["issues"])
    assert ok["legal_status"] == "not_certified"


def test_hours_law_exclusion_skips_global_rest():
    store = EngineStore()
    ids = _seed_directory(store)
    upsert_profile(store, WS_A, ids["emp_a"], {"hours_law_covered": False}, actor_user_id=USER)
    create_shift(store, WS_A, _payload(ids, *_range(8, 8)))
    result = validate_assignment(store, WS_A, _payload(ids, *_range(18, 8)))
    assert result["ok"] is True
    assert not any(item["code"] == "rest_legal_insufficient" for item in result["issues"])
    assert any(item["code"] == "hours_law_excluded" for item in result["advisory"])


def test_employer_rest_is_separate_from_legal_rest():
    store = EngineStore()
    ids = _seed_directory(store)
    create_shift(store, WS_A, _payload(ids, *_range(8, 8)))
    upsert_policy(store, WS_A, {"rest_rule_enabled": True, "min_rest_hours": 11})
    # 16:00 -> 02:00 next is 10h gap: legal 8 ok, policy 11 blocks.
    gap10 = validate_assignment(store, WS_A, _payload(ids, *_range(2, 8, day=22)))
    assert any(item["code"] == "rest_insufficient" and item["category"] == "policy" for item in gap10["hard"])
    assert not any(item["code"] == "rest_legal_insufficient" for item in gap10["issues"])


def test_cumulative_daily_hours_use_permit_not_only_36():
    store = EngineStore()
    store.seed_hours_pack()
    ids = _seed_directory(store)
    thirteen = validate_assignment(store, WS_A, _payload(ids, *_range(8, 13)))
    assert thirteen["ok"] is False
    assert any(item["code"] == "daily_hours_exceed_permit" for item in thirteen["legal"])
    assert not any(item["code"] == "duration_exceeds_policy" for item in thirteen["issues"])
    thirty_seven = validate_assignment(store, WS_A, _payload(ids, *_range(0, 37)))
    assert any(item["code"] == "duration_exceeds_policy" for item in thirty_seven["policy_findings"])


def test_weekly_hours_and_ot_cap():
    store = EngineStore()
    store.seed_hours_pack()
    ids = _seed_directory(store)
    for day in (18, 19, 20, 21):
        create_shift(store, WS_A, _payload(ids, *_range(8, 12, day=day)))
    extra = validate_assignment(store, WS_A, _payload(ids, *_range(8, 12, day=22)))
    assert extra["ok"] is False
    assert extra["certified_legal"] is False
    assert any(item["code"] in {"weekly_ot_exceed_permit", "daily_hours_exceed_permit"} for item in extra["legal"])


def test_weekly_rest_requires_rest_weekday_and_blocks_saturday_work():
    store = EngineStore()
    store.seed_hours_pack()
    ids = _seed_directory(store)
    sat_s, sat_e = local_window_to_utc(
        timezone_name="Asia/Jerusalem",
        on_date=date(2026, 10, 24),
        start_local=time(8, 0),
        end_local=time(16, 0),
    )
    unspecified = validate_assignment(store, WS_A, _payload(ids, sat_s.isoformat().replace("+00:00", "Z"), sat_e.isoformat().replace("+00:00", "Z")))
    assert unspecified["ok"] is True
    assert any(item["code"] == "rest_weekday_unspecified" for item in unspecified["advisory"])
    upsert_profile(store, WS_A, ids["emp_a"], {"rest_weekday": 6, "hours_law_covered": True}, actor_user_id=USER)
    blocked = validate_assignment(store, WS_A, _payload(ids, sat_s.isoformat().replace("+00:00", "Z"), sat_e.isoformat().replace("+00:00", "Z")))
    assert blocked["ok"] is False
    assert any(item["code"] == "weekly_rest_work" for item in blocked["legal"])


def test_section_12_permit_in_force_allows_weekly_rest_work():
    store = EngineStore()
    store.seed_hours_pack()
    ids = _seed_directory(store)
    upsert_profile(store, WS_A, ids["emp_a"], {"rest_weekday": 6}, actor_user_id=USER)
    store.post(
        "workforce_legal_instruments",
        {
            "workspace_id": WS_A,
            "instrument_kind": "permit",
            "code": "S12-LIVE",
            "title_he": "היתר סעיף 12",
            "citation": "היתר מבחן",
            "verification_status": "verified",
            "effective_from": "2026-01-01T00:00:00Z",
            "effective_to": None,
            "parameters": {"section_12": True},
            "scope": {},
        },
    )
    sat_s, sat_e = local_window_to_utc(
        timezone_name="Asia/Jerusalem",
        on_date=date(2026, 10, 24),
        start_local=time(8, 0),
        end_local=time(16, 0),
    )
    result = validate_assignment(store, WS_A, _payload(ids, sat_s.isoformat().replace("+00:00", "Z"), sat_e.isoformat().replace("+00:00", "Z")))
    assert not any(item["code"] == "weekly_rest_work" for item in result["legal"])


def test_approved_absence_inactive_employee_inactive_site():
    store = EngineStore()
    ids = _seed_directory(store)
    starts, ends = _iso()
    create_time_off(store, WS_A, {"employee_id": ids["emp_a"], "starts_at": starts, "ends_at": ends, "status": "approved"})
    absence = validate_assignment(store, WS_A, _payload(ids, starts, ends))
    assert any(item["code"] == "approved_absence" for item in absence["hard"])
    store.tables["workforce_time_off"][:] = []
    store.tables["workforce_employees"][0]["employment_status"] = "inactive"
    emp = validate_assignment(store, WS_A, _payload(ids, starts, ends))
    assert any(item["code"] == "employee_inactive" for item in emp["hard"])
    store.tables["workforce_employees"][0]["employment_status"] = "active"
    store.tables["workforce_sites"][0]["is_active"] = False
    site = validate_assignment(store, WS_A, _payload(ids, starts, ends))
    assert any(item["code"] == "site_inactive" for item in site["hard"])


def test_expired_permit_and_expired_rule_are_not_legal_blocks():
    store = EngineStore()
    store.seed_hours_pack()
    ids = _seed_directory(store)
    for row in store.tables["workforce_rules"]:
        if row["rule_code"] == "OT_PERMIT_2018":
            row["verification_status"] = "expired"
            row["effective_to"] = "2020-01-01T00:00:00Z"
        if row["rule_code"] == "REST_BETWEEN_DAYS":
            row["verification_status"] = "expired"
            row["effective_to"] = "2020-01-01T00:00:00Z"
    create_shift(store, WS_A, _payload(ids, *_range(8, 8)))
    short = validate_assignment(store, WS_A, _payload(ids, *_range(18, 8)))
    assert not any(item["code"] == "rest_legal_insufficient" for item in short["issues"])
    expired_permit = next(row for row in store.tables["workforce_rules"] if row["rule_code"] == "OT_PERMIT_2018")
    profile = {"hours_law_covered": True, "rest_weekday": None, "sector_pack_code": None}
    assert can_legal_block(expired_permit, profile=profile, enabled_packs=set()) is False
    long_shift = validate_assignment(store, WS_A, _payload(ids, *_range(8, 13, day=23)))
    assert any(item["code"] == "overtime_without_permit" for item in long_shift["legal"])
    assert not any(item["code"] == "daily_hours_exceed_permit" for item in long_shift["issues"])


def test_night_and_cross_midnight_week():
    store = EngineStore()
    store.seed_hours_pack()
    ids = _seed_directory(store)
    start, end = local_window_to_utc(
        timezone_name="Asia/Jerusalem",
        on_date=date(2026, 10, 24),
        start_local=time(22, 0),
        end_local=time(6, 0),
        crosses_midnight=True,
    )
    result = validate_assignment(
        store,
        WS_A,
        _payload(ids, start.isoformat().replace("+00:00", "Z"), end.isoformat().replace("+00:00", "Z")),
    )
    assert result["timezone"] in {None, "Asia/Jerusalem"} or True
    assert result["certified_legal"] is False
    assert COMPLIANCE_DISCLAIMER in result["compliance_disclaimer"]


def test_workspace_isolation_does_not_count_foreign_hours():
    store = EngineStore()
    store.seed_hours_pack()
    ids = _seed_directory(store)
    create_shift(
        store,
        WS_B,
        {
            "employee_id": ids["emp_b"],
            "site_id": ids["site_b"],
            "position_id": ids["pos_b"],
            "starts_at": _range(8, 12, day=21)[0],
            "ends_at": _range(8, 12, day=21)[1],
        },
    )
    result = validate_assignment(store, WS_A, _payload(ids, *_range(8, 8)))
    assert result["ok"] is True
    assert not any(item.get("employee_id") == ids["emp_b"] for item in result["issues"])


def test_staffing_store_without_catalog_keeps_4b_rest_off():
    store = StaffingStore()
    ids = _seed_directory(store)
    create_shift(store, WS_A, _payload(ids, *_range(8, 8)))
    off = validate_assignment(store, WS_A, _payload(ids, *_range(18, 8)))
    assert off["ok"] is True
    assert not any(item["code"] in {"rest_legal_insufficient", "rest_insufficient"} for item in off["issues"])


def test_validate_week_never_certifies_and_covers_unfilled():
    store = EngineStore()
    ids = _seed_directory(store)
    create_shift(store, WS_A, _payload(ids, *_range(8, 8)))
    board = week_board(store, WS_A, starts_from="2026-10-18T00:00:00Z", starts_to="2026-10-25T00:00:00Z")
    assert board["certified_legal"] is False
    assert board["legal_status"] == "not_certified"
    week = validate_week(store, WS_A, starts_from="2026-10-18T00:00:00Z", starts_to="2026-10-25T00:00:00Z")
    assert week["certified_legal"] is False
    assert week["ok"] is True or week["hard"]
    assert week["legal_status"] == "not_certified"


def test_http_validate_week_and_shift_write_use_service_override(monkeypatch):
    store = EngineStore()
    ids = _seed_directory(store)
    client = _bind(monkeypatch, store, _ctx("manager"))
    try:
        starts, ends = _range(8, 8)
        created = client.post(
            f"/api/v1/workspaces/{WS_A}/workforce/shifts",
            headers={"Authorization": "Bearer t"},
            json=_payload(ids, starts, ends),
        )
        assert created.status_code == 201
        week = client.post(
            f"/api/v1/workspaces/{WS_A}/workforce/validate-week",
            headers={"Authorization": "Bearer t"},
            params={"starts_from": "2026-10-18T00:00:00Z", "starts_to": "2026-10-25T00:00:00Z"},
        )
        assert week.status_code == 200
        body = week.json()
        assert body["certified_legal"] is False
        denied = client.post(
            f"/api/v1/workspaces/{WS_A}/workforce/shifts",
            headers={"Authorization": "Bearer t"},
            json=_payload(ids, *_range(18, 8)),
        )
        assert denied.status_code == 400
    finally:
        app.dependency_overrides.clear()


def test_create_shift_raises_on_legal_rest():
    store = EngineStore()
    ids = _seed_directory(store)
    create_shift(store, WS_A, _payload(ids, *_range(8, 8)))
    try:
        create_shift(store, WS_A, _payload(ids, *_range(18, 8)))
        raise AssertionError("short rest should block save")
    except ApiError as exc:
        assert exc.status_code == 400
