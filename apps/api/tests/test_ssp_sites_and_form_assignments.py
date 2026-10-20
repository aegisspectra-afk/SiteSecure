"""Sites, form field types, site assignments, snapshot freeze, and authz (no live DB)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

import pytest

from app.errors import ApiError
from app.ssp.forms_schema import validate_answers, validate_definition
from app.ssp.product_authz import (
    assert_site_in_scope,
    filter_sites_for_membership,
    product_grants,
)
from app.ssp.site_assignments import (
    classify_assignment,
    duplicate_submit_blocked,
    snapshot_uses_assigned_version,
    user_may_fill,
)
from app.ssp.site_ids import SITE_ID_RE, is_valid_site_id, new_site_id

ROOT = Path(__file__).resolve().parents[3]
SITES_SQL = ROOT / "supabase" / "migrations" / "20261020120000_ssp_sites_and_form_assignments.sql"
WS = UUID("11111111-1111-4111-8111-111111111111")
FID = "11111111-1111-4111-8111-111111111111"


def _field(fid: str, ftype: str, **kwargs):
    base = {
        "id": fid,
        "type": ftype,
        "label": "שאלה",
        "help_text": "",
        "required": False,
    }
    base.update(kwargs)
    return base


def test_local_migration_defines_sites_and_frozen_assignments():
    text = SITES_SQL.read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS public.ssp_sites" in text
    assert "sit_[a-f0-9]{32}" in text
    assert "ssp_site_members" in text
    assert "ssp_form_site_assignments" in text
    assert "definition_snapshot" in text
    assert "ALTER COLUMN assignment_id DROP NOT NULL" in text
    assert "site_assignment_id" in text
    assert "ENABLE ROW LEVEL SECURITY" in text
    assert "auth_is_member(workspace_id)" in text
    assert "CREATE TABLE IF NOT EXISTS public.sites" not in text
    assert "ssp_vehicles" not in text.lower()
    assert "CREATE POLICY ssp_sites_select" in text
    assert "cadence text NOT NULL DEFAULT 'once'" in text
    assert "DROP TABLE" not in text
    assert "ssp_submissions_site_assign_user_uid" in text
    assert "REFERENCES public.ssp_forms" in text
    assert "REFERENCES public.ssp_form_versions" in text
    assert "REFERENCES public.ssp_companies" in text


def test_site_id_is_stable_random_not_g1_barcode():
    a = new_site_id()
    b = new_site_id()
    assert a != b
    assert is_valid_site_id(a)
    assert SITE_ID_RE.fullmatch(a)
    assert not is_valid_site_id("050-000000")
    assert not is_valid_site_id("שפלה 2")
    assert not is_valid_site_id("g1-site")


def test_number_time_notes_field_types():
    nid = "aaaaaaaa-1111-4111-8111-111111111111"
    tid = "bbbbbbbb-1111-4111-8111-111111111111"
    oid = "cccccccc-1111-4111-8111-111111111111"
    definition = validate_definition(
        {
            "fields": [
                _field(nid, "number", required=True, label="כמות"),
                _field(tid, "time", required=True, label="שעה"),
                _field(oid, "notes", required=False, label="הערות"),
            ]
        }
    )
    answers, _ = validate_answers(definition, {nid: "12.5", tid: "08:30", oid: "בסדר"})
    assert answers[nid] == 12.5
    assert answers[tid] == "08:30"
    assert answers[oid] == "בסדר"
    with pytest.raises(ApiError) as bad_num:
        validate_answers(definition, {nid: "x", tid: "08:30"})
    assert bad_num.value.status_code == 400
    with pytest.raises(ApiError) as bad_time:
        validate_answers(definition, {nid: "1", tid: "25:99"})
    assert bad_time.value.status_code == 400


def test_assignment_status_and_due_dates():
    now = datetime(2026, 10, 20, 12, tzinfo=timezone.utc)
    assert (
        classify_assignment(
            status="active",
            starts_at=None,
            due_at=(now + timedelta(days=1)).isoformat(),
            has_submission=False,
            now=now,
        )
        == "available"
    )
    assert (
        classify_assignment(
            status="active",
            starts_at=None,
            due_at=(now - timedelta(hours=1)).isoformat(),
            has_submission=False,
            now=now,
        )
        == "overdue"
    )
    assert (
        classify_assignment(
            status="active",
            starts_at=None,
            due_at=None,
            has_submission=True,
            now=now,
        )
        == "submitted"
    )
    assert classify_assignment(status="paused", starts_at=None, due_at=None, has_submission=False) == "paused"


def test_duplicate_submit_once_cadence():
    assert duplicate_submit_blocked(
        filler_mode="site", existing_for_assignment=True, existing_for_user=False
    )
    assert not duplicate_submit_blocked(
        filler_mode="users", existing_for_assignment=True, existing_for_user=False
    )
    assert duplicate_submit_blocked(
        filler_mode="users", existing_for_assignment=True, existing_for_user=True
    )


def test_snapshot_stays_on_assigned_version():
    snap = {"fields": [_field(FID, "short_text")]}
    assert snapshot_uses_assigned_version("ver-old", snap, "ver-new") is True
    assert snapshot_uses_assigned_version("ver-new", snap, "ver-new") is True
    assert snapshot_uses_assigned_version("ver-old", None, "ver-new") is False


def test_cross_site_officer_denied():
    membership = {"product_role": "patrol_officer", "user_id": "u1", "department_id": "d1"}
    with pytest.raises(ApiError) as exc:
        assert_site_in_scope(
            membership,
            {"id": "site-b", "department_id": "d1"},
            catalog_unscoped=False,
            member_site_ids={"site-a"},
            actor_user_id="u1",
        )
    assert exc.value.code == "SCOPE_DENIED"


def test_manager_sees_department_sites_not_other_dept():
    items = [
        {"id": "s1", "department_id": "d1"},
        {"id": "s2", "department_id": "d2"},
        {"id": "s3", "department_id": None},
    ]
    membership = {"product_role": "patrol_manager", "department_id": "d1", "user_id": "mgr"}
    out = filter_sites_for_membership(
        items, membership, catalog_unscoped=False, member_site_ids=set(), actor_user_id="mgr"
    )
    assert {x["id"] for x in out} == {"s1", "s3"}


def test_officer_only_member_sites():
    items = [{"id": "s1"}, {"id": "s2"}]
    membership = {"product_role": "patrol_officer", "user_id": "off"}
    out = filter_sites_for_membership(
        items, membership, catalog_unscoped=False, member_site_ids={"s2"}, actor_user_id="off"
    )
    assert [x["id"] for x in out] == ["s2"]


def test_product_grants_sites_not_parallel_tenancy():
    assert "ssp.sites.view" in product_grants("org_admin")
    assert "ssp.sites.edit" in product_grants("patrol_manager")
    assert "ssp.sites.view" in product_grants("patrol_officer")
    assert "ssp.sites.edit" not in product_grants("patrol_officer")
    assert "ssp.assignments.manage" in product_grants("patrol_manager")


def test_user_may_fill_modes():
    assert user_may_fill(
        filler_mode="site",
        user_id="u1",
        is_site_member=True,
        is_manager=False,
        target_user_ids=set(),
        user_department_id=None,
        assignment_department_id=None,
    )
    assert not user_may_fill(
        filler_mode="users",
        user_id="u1",
        is_site_member=True,
        is_manager=False,
        target_user_ids={"u2"},
        user_department_id=None,
        assignment_department_id=None,
    )
    assert user_may_fill(
        filler_mode="group",
        user_id="u1",
        is_site_member=False,
        is_manager=False,
        target_user_ids=set(),
        user_department_id="d1",
        assignment_department_id="d1",
    )


def test_load_company_missing_table_is_none():
    from app.ssp.product_authz import load_company

    client = MagicMock()
    client.get.return_value = SimpleNamespace(status_code=404, json=lambda: {"message": "does not exist"})
    assert load_company(client, workspace_id=str(WS)) is None


def test_dashboard_tolerates_missing_ops_tables(monkeypatch):
    from app.routers import ssp_ops as r

    ctx = SimpleNamespace(
        user_id="u-admin",
        workspace_id=str(WS),
        features=frozenset({"ssp"}),
        workspace_status="active",
        role_key="owner",
        permissions=frozenset(),
    )
    monkeypatch.setattr(r, "_ctx", lambda *_a, **_k: ctx)
    monkeypatch.setattr(r, "require_ssp_action", lambda *_a, **_k: {"product_role": "org_admin"})
    monkeypatch.setattr(r, "catalog_allows", lambda *_a, **_k: True)
    monkeypatch.setattr(
        r, "load_company", lambda *_a, **_k: {"id": "co-1", "company_id": "cmp_x", "name": "Co"}
    )
    client = MagicMock()
    client.get.return_value = SimpleNamespace(status_code=400, json=lambda: {"message": "missing"})
    out = r.ops_dashboard(WS, user={"sub": "u-admin"}, client=client)
    assert out["data_mode"] == "live"
    assert out["company"]["id"] == "co-1"
    assert out["runs"] == {"planned": 0, "active": 0, "completed": 0, "late": 0}
    assert out["sites_active"] == 0


def test_dashboard_empty_when_company_missing(monkeypatch):
    from app.routers import ssp_ops as r

    ctx = SimpleNamespace(user_id="u-admin", workspace_id=str(WS), features=frozenset({"ssp"}))
    monkeypatch.setattr(r, "_ctx", lambda *_a, **_k: ctx)
    monkeypatch.setattr(r, "require_ssp_action", lambda *_a, **_k: {"product_role": "org_admin"})
    monkeypatch.setattr(r, "load_company", lambda *_a, **_k: None)
    out = r.ops_dashboard(WS, user={"sub": "u-admin"}, client=MagicMock())
    assert out["data_mode"] == "empty"
    assert out["sites_active"] == 0
    assert out["company"] is None
    assert out["site_members_active"] == 0
    assert out["user_joins_pending"] == 0


def test_create_site_and_patch_use_server_company(monkeypatch):
    from app.routers import ssp_sites as r

    ctx = SimpleNamespace(user_id="u-admin", workspace_id=str(WS), features=frozenset({"ssp"}))
    monkeypatch.setattr(r, "_ctx", lambda *_a, **_k: ctx)
    monkeypatch.setattr(
        r,
        "require_ssp_action",
        lambda *_a, **_k: {"product_role": "org_admin", "org_unit_id": None, "department_id": None},
    )
    monkeypatch.setattr(r, "_require_company", lambda *_a, **_k: {"id": "co-1", "company_id": "cmp_ab"})
    monkeypatch.setattr(r, "write_audit", lambda *_a, **_k: None)

    stored: dict = {}

    def post(_table, json=None, params=None):
        stored["create"] = json
        return SimpleNamespace(status_code=201, json=lambda: [{**json, "id": "pk-1", "created_at": "t", "updated_at": "t"}])

    def patch(_table, json=None, params=None):
        stored["patch"] = json
        return SimpleNamespace(status_code=200, json=lambda: [{**stored["create"], **json, "id": "pk-1"}])

    client = MagicMock()
    client.post.side_effect = post
    client.patch.side_effect = patch
    monkeypatch.setattr(r, "created_or_403", lambda res: res.json()[0])
    monkeypatch.setattr(r, "patched_or_403", lambda res: res.json()[0])
    monkeypatch.setattr(
        r,
        "_load_site",
        lambda *_a, **_k: {
            "id": "pk-1",
            "workspace_id": str(WS),
            "company_pk": "co-1",
            "site_id": "sit_" + "a" * 32,
            "name": "שפלה 2",
            "department_id": None,
            "manager_user_id": None,
        },
    )
    monkeypatch.setattr(r, "_guard_site", lambda *_a, **_k: None)

    created = r.create_site(
        WS,
        r.SiteCreate(name="שפלה 2", phone="050-000000"),
        user={"sub": "u-admin"},
        client=client,
    )
    assert created["name"] == "שפלה 2"
    assert created["site_id"].startswith("sit_")
    assert stored["create"]["company_pk"] == "co-1"
    assert "company_id" not in stored["create"]

    updated = r.patch_site(
        WS,
        UUID("22222222-2222-4222-8222-222222222222"),
        r.SitePatch(name="שפלה 2ב", phone="050-111111"),
        user={"sub": "u-admin"},
        client=client,
    )
    assert updated["name"] == "שפלה 2ב"
    assert stored["patch"]["phone"] == "050-111111"


def test_create_site_blocks_officer(monkeypatch):
    from app.routers import ssp_sites as r

    ctx = SimpleNamespace(user_id="off", workspace_id=str(WS), features=frozenset({"ssp"}))
    monkeypatch.setattr(r, "_ctx", lambda *_a, **_k: ctx)
    monkeypatch.setattr(r, "require_ssp_action", lambda *_a, **_k: {"product_role": "patrol_officer"})
    with pytest.raises(ApiError) as exc:
        r.create_site(WS, r.SiteCreate(name="X"), user={"sub": "off"}, client=MagicMock())
    assert exc.value.status_code == 403


def test_create_site_assignment_snapshots_published_version(monkeypatch):
    from app.routers import ssp_sites as r

    ctx = SimpleNamespace(user_id="mgr", workspace_id=str(WS), features=frozenset({"ssp"}))
    monkeypatch.setattr(r, "_ctx", lambda *_a, **_k: ctx)
    monkeypatch.setattr(r, "require_ssp_action", lambda *_a, **_k: {"product_role": "patrol_manager"})
    monkeypatch.setattr(r, "_require_company", lambda *_a, **_k: {"id": "co-1"})
    monkeypatch.setattr(r, "write_audit", lambda *_a, **_k: None)
    monkeypatch.setattr(r, "assert_form_in_scope", lambda *_a, **_k: None)
    monkeypatch.setattr(r, "catalog_allows", lambda *_a, **_k: False)
    monkeypatch.setattr(
        r,
        "_published_version",
        lambda *_a, **_k: (
            {"id": "form-1", "status": "published"},
            {"id": "ver-frozen", "definition": {"fields": [_field(FID, "short_text")]}},
        ),
    )
    monkeypatch.setattr(
        r,
        "_load_site",
        lambda *_a, **_k: {"id": "site-1", "company_pk": "co-1", "department_id": None, "manager_user_id": None},
    )
    monkeypatch.setattr(r, "_guard_site", lambda *_a, **_k: None)

    posted: list[dict] = []

    def post(_table, json=None, params=None):
        posted.append(json)
        return SimpleNamespace(status_code=201, json=lambda: [{**json, "id": "asg-1"}])

    client = MagicMock()
    client.post.side_effect = post
    monkeypatch.setattr(r, "created_or_403", lambda res: res.json()[0])

    out = r.create_site_assignments(
        WS,
        r.SiteAssignmentCreate(form_id="form-1", site_ids=["22222222-2222-4222-8222-222222222222"]),
        user={"sub": "mgr"},
        client=client,
    )
    assert out["items"][0]["form_version_id"] == "ver-frozen"
    assert posted[0]["definition_snapshot"]["fields"][0]["id"] == FID
    assert posted[0]["cadence"] == "once"
    assert posted[0]["company_pk"] == "co-1"


def test_submit_blocks_duplicate_and_unauthorized(monkeypatch):
    from app.routers import ssp_sites as r

    ctx = SimpleNamespace(user_id="u1", workspace_id=str(WS), features=frozenset({"ssp"}))
    monkeypatch.setattr(r, "_ctx", lambda *_a, **_k: ctx)
    monkeypatch.setattr(
        r, "require_ssp_action", lambda *_a, **_k: {"product_role": "patrol_officer", "department_id": "d1"}
    )
    monkeypatch.setattr(r, "catalog_allows", lambda *_a, **_k: False)
    monkeypatch.setattr(r, "_member_ids", lambda *_a, **_k: {"site-1"})
    monkeypatch.setattr(
        r,
        "_load_site",
        lambda *_a, **_k: {"id": "site-1", "company_pk": "co-1", "department_id": "d1", "manager_user_id": None},
    )
    monkeypatch.setattr(r, "_guard_site", lambda *_a, **_k: None)

    assignment = {
        "id": "asg-1",
        "site_pk": "22222222-2222-4222-8222-222222222222",
        "status": "active",
        "filler_mode": "site",
        "starts_at": None,
        "form_id": "form-1",
        "form_version_id": "ver-1",
        "definition_snapshot": {"fields": [_field(FID, "short_text", required=True)]},
        "department_id": None,
    }
    client = MagicMock()
    client.get.side_effect = [
        SimpleNamespace(status_code=200, json=lambda: [assignment]),
        SimpleNamespace(status_code=200, json=lambda: []),
        SimpleNamespace(status_code=200, json=lambda: [{"id": "sub-1", "submitted_by": "u1"}]),
    ]
    monkeypatch.setattr(r, "one_or_404", lambda res: res.json()[0])
    monkeypatch.setattr(r, "as_list", lambda res: res.json() if res.status_code == 200 else [])

    with pytest.raises(ApiError) as exc:
        r.submit_site_assignment(
            WS,
            UUID("33333333-3333-4333-8333-333333333333"),
            r.SiteSubmitIn(answers={FID: "ok"}),
            user={"sub": "u1"},
            client=client,
            svc=MagicMock(),
        )
    assert exc.value.status_code == 409


def test_as_list_schema_missing_is_not_business_rule():
    from app.rest import as_list, schema_missing

    res = SimpleNamespace(
        status_code=404,
        text='{"code":"PGRST205","message":"Could not find the table \'public.ssp_form_submissions\' in the schema cache"}',
        json=lambda: {
            "code": "PGRST205",
            "message": "Could not find the table 'public.ssp_form_submissions' in the schema cache",
        },
    )
    assert schema_missing(res) is True
    with pytest.raises(ApiError) as exc:
        as_list(res)
    assert exc.value.status_code == 503
    assert exc.value.code == "SSP_SCHEMA_UNAVAILABLE"


def test_schema_missing_is_not_permission_denied():
    from app.rest import created_or_403, schema_missing

    res = SimpleNamespace(
        status_code=404,
        text='{"code":"PGRST205","message":"Could not find the table \'public.ssp_sites\' in the schema cache"}',
        json=lambda: {
            "code": "PGRST205",
            "message": "Could not find the table 'public.ssp_sites' in the schema cache",
        },
    )
    assert schema_missing(res) is True
    with pytest.raises(ApiError) as exc:
        created_or_403(res)
    assert exc.value.status_code == 503
    assert exc.value.code == "SSP_SCHEMA_UNAVAILABLE"
    assert "אין זו שגיאת הרשאה" in exc.value.message


def test_list_submissions_missing_table_is_unavailable(monkeypatch):
    from app.routers import ssp_forms as r

    ctx = SimpleNamespace(user_id="u-admin", workspace_id=str(WS), features=frozenset({"ssp"}))
    monkeypatch.setattr(r, "_ctx", lambda *_a, **_k: ctx)
    monkeypatch.setattr(r, "_ssp_require", lambda *_a, **_k: {"product_role": "org_admin"})
    monkeypatch.setattr(
        "app.ssp.product_authz.feature_gate",
        lambda *_a, **_k: None,
    )
    monkeypatch.setattr(
        "app.ssp.product_authz.load_ssp_membership",
        lambda *_a, **_k: {"product_role": "org_admin"},
    )
    client = MagicMock()
    client.get.return_value = SimpleNamespace(
        status_code=404,
        text='{"code":"PGRST205"}',
        json=lambda: {
            "code": "PGRST205",
            "message": "Could not find the table 'public.ssp_form_submissions' in the schema cache",
        },
    )
    out = r.list_submissions(WS, user={"sub": "u-admin"}, client=client)
    assert out == {"items": [], "data_mode": "unavailable"}


def test_create_site_missing_table_is_schema_unavailable(monkeypatch):
    from app.routers import ssp_sites as r
    from app.rest import created_or_403 as real_created_or_403

    ctx = SimpleNamespace(user_id="u-admin", workspace_id=str(WS), features=frozenset({"ssp"}))
    monkeypatch.setattr(r, "_ctx", lambda *_a, **_k: ctx)
    monkeypatch.setattr(
        r,
        "require_ssp_action",
        lambda *_a, **_k: {"product_role": "org_admin", "org_unit_id": None, "department_id": None},
    )
    monkeypatch.setattr(r, "_require_company", lambda *_a, **_k: {"id": "co-1"})
    monkeypatch.setattr(r, "created_or_403", real_created_or_403)
    client = MagicMock()
    client.post.return_value = SimpleNamespace(
        status_code=404,
        text='{"code":"PGRST205"}',
        json=lambda: {"code": "PGRST205", "message": "Could not find the table 'public.ssp_sites' in the schema cache"},
    )
    with pytest.raises(ApiError) as exc:
        r.create_site(
            WS,
            r.SiteCreate(name="אתר לקוח", kind="physical_site"),
            user={"sub": "u-admin"},
            client=client,
        )
    assert exc.value.status_code == 503
    assert exc.value.code == "SSP_SCHEMA_UNAVAILABLE"


def test_list_ops_alerts_uses_real_rows_only(monkeypatch):
    from app.routers import ssp_ops as r

    ctx = SimpleNamespace(
        user_id="u-admin",
        workspace_id=str(WS),
        features=frozenset({"ssp"}),
        workspace_status="active",
        role_key="owner",
        permissions=frozenset(),
    )
    monkeypatch.setattr(r, "_ctx", lambda *_a, **_k: ctx)
    monkeypatch.setattr(r, "require_ssp_action", lambda *_a, **_k: {"product_role": "org_admin"})
    monkeypatch.setattr(r, "catalog_allows", lambda *_a, **_k: True)
    monkeypatch.setattr(r, "load_company", lambda *_a, **_k: {"id": "co-1"})
    monkeypatch.setattr(r, "filter_sites_for_membership", lambda sites, *_a, **_k: sites)
    monkeypatch.setattr(r, "load_member_site_ids", lambda *_a, **_k: set())

    def try_list(_client, table, _params):
        if table == "ssp_sites":
            return [{"id": "s1", "name": "משרד סיור"}]
        if table == "ssp_events":
            return [
                {
                    "id": "e1",
                    "title": "אירוע",
                    "status": "open",
                    "severity": "high",
                    "created_at": "2026-01-01T00:00:00Z",
                }
            ]
        if table == "ssp_patrol_runs":
            return [{"id": "p1", "status": "late", "created_at": "2026-01-01T00:00:00Z"}]
        return []

    monkeypatch.setattr(r, "_try_list", try_list)
    out = r.list_ops_alerts(WS, user={"sub": "u-admin"}, client=MagicMock())
    sources = {item["source"] for item in out["items"]}
    assert sources == {"event", "patrol"}
    assert all(item["id"].startswith(("event:", "patrol:")) for item in out["items"])
