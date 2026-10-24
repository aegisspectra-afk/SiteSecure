"""L1 labor-rule catalog: versions, expiry, permissions. No assignment blocking."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.authz.engine import authorize
from app.errors import ApiError
from app.main import app
from app.workforce.catalog import (
    ENFORCED_ON_ASSIGNMENT,
    create_instrument,
    create_workspace_rule,
    expire_instrument,
    is_active_legal_block,
    list_rules,
    reject_policy_relaxing_legal,
    upsert_profile,
)
from app.workforce.validation import validate_assignment

from tests.test_workforce_stage3 import WS_A, WS_B, USER, StageStore, _bind, _ctx, _seed_directory
from tests.test_workforce_stage4b import StaffingStore, _range


@pytest.fixture(autouse=True)
def _clear_app_overrides():
    yield
    app.dependency_overrides.clear()


class CatalogStore(StaffingStore):
    def __init__(self) -> None:
        super().__init__()
        self.tables.update(
            {
                "workforce_rule_packs": [
                    {
                        "pack_code": "israel_hours_base",
                        "name_he": "בסיס",
                        "description_he": "",
                        "pack_kind": "legal",
                    },
                    {
                        "pack_code": "unverified_research",
                        "name_he": "מחקר",
                        "description_he": "",
                        "pack_kind": "operational",
                    },
                ],
                "workforce_rules": [],
                "workforce_workspace_packs": [],
                "workforce_legal_instruments": [],
                "workforce_employment_profiles": [],
            }
        )
        self.seed_rest_rule()

    def seed_rest_rule(self) -> dict:
        row = {
            "id": "11111111-1111-1111-1111-111111111111",
            "workspace_id": None,
            "pack_code": "israel_hours_base",
            "rule_code": "REST_BETWEEN_DAYS",
            "version": 1,
            "name_he": "מנוחה",
            "description_he": "8 שעות",
            "rule_type": "legal",
            "verification_status": "verified",
            "severity": "blocking",
            "source_kind": "statute",
            "source_citation": "Hours Law s.21",
            "source_section": "21",
            "source_url": "https://example.invalid/s21",
            "reviewed_on": "2026-10-21",
            "effective_from": "1951-09-28T00:00:00+03:00",
            "effective_to": None,
            "scope": {"hours_law_covered": True},
            "parameters": {"min_rest_hours": 8},
            "cannot_be_relaxed": True,
        }
        self.tables["workforce_rules"].append(row)
        return row

    def _filter(self, table: str, params: dict | None) -> list[dict]:
        raw = dict(params or {})
        or_val = raw.pop("or", None)
        null_keys = [key for key, val in raw.items() if val == "is.null"]
        for key in null_keys:
            raw.pop(key)
        rows = StageStore._filter(self, table, raw)
        if or_val and or_val.startswith("(") and or_val.endswith(")"):
            parts = or_val[1:-1].split(",")
            kept = []
            for row in rows:
                matched = False
                for part in parts:
                    field, op, value = part.split(".", 2)
                    cell = row.get(field)
                    if op == "is" and value == "null" and cell in {None, ""}:
                        matched = True
                    elif op == "eq" and str(cell or "") == value:
                        matched = True
                if matched:
                    kept.append(row)
            rows = kept
        for key in null_keys:
            rows = [row for row in rows if row.get(key) in {None, ""}]
        return rows


def _verified_rest(**overrides) -> dict:
    row = {
        "rule_code": "REST_BETWEEN_DAYS",
        "rule_type": "legal",
        "verification_status": "verified",
        "severity": "blocking",
        "effective_from": "1951-09-28T00:00:00+03:00",
        "effective_to": None,
        "parameters": {"min_rest_hours": 8},
    }
    row.update(overrides)
    return row


def test_draft_expired_superseded_are_not_legal_blocks():
    at = datetime(2026, 10, 21, tzinfo=timezone.utc)
    assert is_active_legal_block(_verified_rest(), at=at) is True
    assert is_active_legal_block(_verified_rest(verification_status="draft"), at=at) is False
    assert is_active_legal_block(_verified_rest(verification_status="expired"), at=at) is False
    assert is_active_legal_block(_verified_rest(verification_status="superseded"), at=at) is False
    assert is_active_legal_block(_verified_rest(severity="warning"), at=at) is False
    assert is_active_legal_block(_verified_rest(rule_type="employer_policy"), at=at) is False
    assert (
        is_active_legal_block(
            _verified_rest(effective_to="2026-03-19T23:59:59+02:00"),
            at=datetime(2026, 10, 21, tzinfo=timezone.utc),
        )
        is False
    )
    assert ENFORCED_ON_ASSIGNMENT is True


def test_verified_rest_blocks_short_gap_when_rule_applies():
    store = CatalogStore()
    ids = _seed_directory(store)
    first_s, first_e = _range(8, 8)
    second_s, second_e = _range(18, 8)
    store.post(
        "workforce_shifts",
        {
            "workspace_id": WS_A,
            "employee_id": ids["emp_a"],
            "site_id": ids["site_a"],
            "position_id": ids["pos_a"],
            "starts_at": first_s,
            "ends_at": first_e,
        },
    )
    result = validate_assignment(
        store,
        WS_A,
        {
            "employee_id": ids["emp_a"],
            "site_id": ids["site_a"],
            "position_id": ids["pos_a"],
            "starts_at": second_s,
            "ends_at": second_e,
        },
    )
    assert result["ok"] is False
    assert result["certified_legal"] is False
    assert result["legal_status"] == "not_certified"
    assert any(item["code"] == "rest_legal_insufficient" and item["category"] == "legal" for item in result["hard"])
    assert not any(item["code"] == "rest_insufficient" for item in result["issues"])


def test_policy_cannot_relax_verified_rest_when_enabled():
    rules = [_verified_rest()]
    reject_policy_relaxing_legal({"rest_rule_enabled": False, "min_rest_hours": 6}, rules)
    reject_policy_relaxing_legal({"rest_rule_enabled": True, "min_rest_hours": 11}, rules)
    with pytest.raises(ApiError) as exc:
        reject_policy_relaxing_legal({"rest_rule_enabled": True, "min_rest_hours": 6}, rules)
    assert exc.value.status_code == 400


def test_workspace_rule_versions_do_not_overwrite():
    store = CatalogStore()
    first = create_workspace_rule(
        store,
        WS_A,
        {
            "rule_code": "SITE_MAX_NIGHTS",
            "name_he": "רצף לילות",
            "rule_type": "employer_policy",
            "source_citation": "מדיניות G1",
            "parameters": {"max_consecutive_nights": 5},
        },
        actor_user_id=USER,
    )
    assert first["version"] == 1
    assert first["origin"] == "workspace"
    assert first["enforced_on_assignment"] is True
    second = create_workspace_rule(
        store,
        WS_A,
        {
            "rule_code": "SITE_MAX_NIGHTS",
            "name_he": "רצף לילות מעודכן",
            "rule_type": "employer_policy",
            "source_citation": "מדיניות G1 עדכון",
            "parameters": {"max_consecutive_nights": 4},
        },
        actor_user_id=USER,
    )
    assert second["version"] == 2
    versions = [row for row in store.tables["workforce_rules"] if row.get("rule_code") == "SITE_MAX_NIGHTS"]
    assert len(versions) == 2
    closed = next(row for row in versions if int(row["version"]) == 1)
    assert closed["verification_status"] == "superseded"
    assert closed["parameters"]["max_consecutive_nights"] == 5
    assert closed["effective_to"]


def test_cannot_create_verified_legal_as_tenant():
    store = CatalogStore()
    with pytest.raises(ApiError):
        create_workspace_rule(
            store,
            WS_A,
            {
                "rule_code": "FAKE_LAW",
                "name_he": "חוק מזויף",
                "rule_type": "legal",
                "verification_status": "verified",
                "source_citation": "אין",
            },
            actor_user_id=USER,
        )


def test_cannot_relax_rest_via_org_rule_parameters():
    store = CatalogStore()
    with pytest.raises(ApiError):
        create_workspace_rule(
            store,
            WS_A,
            {
                "rule_code": "REST_BETWEEN_DAYS",
                "name_he": "מנוחה קצרה",
                "rule_type": "employer_policy",
                "source_citation": "מדיניות",
                "parameters": {"min_rest_hours": 4},
            },
            actor_user_id=USER,
        )


def test_expired_instrument_is_not_in_force():
    store = CatalogStore()
    created = create_instrument(
        store,
        WS_A,
        {
            "instrument_kind": "permit",
            "code": "S12-TEST",
            "title_he": "היתר סעיף 12",
            "citation": "היתר מיוחד לבדיקה",
            "verification_status": "verified",
        },
        actor_user_id=USER,
    )
    assert created["in_force"] is True
    expired = expire_instrument(store, WS_A, created["id"], actor_user_id=USER)
    assert expired["verification_status"] == "expired"
    assert expired["in_force"] is False
    assert expired["enforced_on_assignment"] is True


def test_list_rules_hides_expired_unless_requested():
    store = CatalogStore()
    store.tables["workforce_rules"].append(
        {
            "id": "22222222-2222-2222-2222-222222222222",
            "workspace_id": None,
            "pack_code": "israel_hours_base",
            "rule_code": "EMERGENCY_OT_2026",
            "version": 1,
            "name_he": "חירום",
            "rule_type": "permit",
            "verification_status": "expired",
            "severity": "informational",
            "source_kind": "yalkut",
            "source_citation": "Yalkut 14318",
            "reviewed_on": "2026-10-21",
            "effective_from": "2026-03-02T00:00:00+02:00",
            "effective_to": "2026-03-19T23:59:59+02:00",
            "scope": {},
            "parameters": {"max_week_hours_including_ot": 67},
            "cannot_be_relaxed": False,
        }
    )
    live = list_rules(store, WS_A, include_expired=False)
    codes = {item["rule_code"] for item in live}
    assert "REST_BETWEEN_DAYS" in codes
    assert "EMERGENCY_OT_2026" not in codes
    all_rows = list_rules(store, WS_A, include_expired=True)
    assert any(item["rule_code"] == "EMERGENCY_OT_2026" for item in all_rows)
    emergency = next(item for item in all_rows if item["rule_code"] == "EMERGENCY_OT_2026")
    assert emergency["would_block_if_engine_on"] is False


def test_employment_profile_rejects_other_workspace_employee():
    store = CatalogStore()
    ids = _seed_directory(store)
    with pytest.raises(ApiError):
        upsert_profile(store, WS_A, ids["emp_b"], {"rest_weekday": 6}, actor_user_id=USER)


def test_settings_manage_is_owner_not_manager():
    owner = _ctx("owner")
    manager = _ctx("manager")
    assert authorize(ctx=owner, action="workforce.settings.manage").allowed is True
    assert authorize(ctx=manager, action="workforce.settings.manage").allowed is False


def test_api_manager_cannot_write_rules(monkeypatch):
    store = CatalogStore()
    client = _bind(
        monkeypatch,
        store,
        _ctx("manager", grants=frozenset({"workforce.schedules.view", "workforce.schedules.edit"})),
    )
    res = client.post(
        f"/api/v1/workspaces/{WS_A}/workforce/rules",
        json={"rule_code": "SITE_POLICY", "name_he": "מדיניות", "rule_type": "employer_policy", "source_citation": "x"},
    )
    assert res.status_code == 403


def test_api_owner_can_read_and_write_catalog(monkeypatch):
    store = CatalogStore()
    client = _bind(
        monkeypatch,
        store,
        _ctx(
            "owner",
            grants=frozenset(
                {
                    "workforce.settings.manage",
                    "workforce.schedules.view",
                    "workforce.schedules.edit",
                    "workforce.audit.view",
                }
            ),
        ),
    )
    listed = client.get(f"/api/v1/workspaces/{WS_A}/workforce/rules")
    assert listed.status_code == 200
    assert listed.json()["enforced_on_assignment"] is True
    created = client.post(
        f"/api/v1/workspaces/{WS_A}/workforce/rules",
        json={
            "rule_code": "SITE_POLICY",
            "name_he": "מדיניות אתר",
            "rule_type": "employer_policy",
            "source_citation": "נוהל פנימי",
            "severity": "warning",
        },
    )
    assert created.status_code == 201
    assert created.json()["version"] == 1
    policy = client.put(
        f"/api/v1/workspaces/{WS_A}/workforce/policy",
        json={"rest_rule_enabled": True, "min_rest_hours": 6},
    )
    assert policy.status_code == 400


def test_openapi_exposes_catalog_not_register():
    client = TestClient(app)
    paths = client.get("/api/openapi.json").json()["paths"]
    assert "/api/v1/workspaces/{workspace_id}/workforce/rules" in paths
    assert "/api/v1/workspaces/{workspace_id}/workforce/legal-instruments" in paths
    assert "/register" not in paths
