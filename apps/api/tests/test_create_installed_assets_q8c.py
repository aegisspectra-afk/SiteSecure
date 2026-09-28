"""Q8-C: create installed Assets from project_planned_items."""

from __future__ import annotations

from uuid import UUID, uuid4

import httpx
import pytest

from app.errors import ApiError
from app.installed_assets_from_planned import (
    allocate_asset_code,
    build_create_plan,
    create_installed_assets_from_plan,
    map_planned_to_equipment_category,
    next_asset_code_candidates,
)
from app.project_scope_from_quote import plan_project_scope_from_snapshot, should_include_quote_item

WS = UUID("00000000-0000-0000-0000-0000000000aa")
SITE_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
SITE_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
PROJECT = "cccccccc-cccc-cccc-cccc-cccccccccccc"
PLANNED_CAM = "dddddddd-dddd-dddd-dddd-ddddddddddd1"
PLANNED_NVR = "dddddddd-dddd-dddd-dddd-ddddddddddd2"
PLANNED_LABOR = "dddddddd-dddd-dddd-dddd-ddddddddddd3"
PRODUCT = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
ACTOR = "11111111-1111-1111-1111-111111111111"


def _ok(data, status=200) -> httpx.Response:
    return httpx.Response(status, json=data)


class FakeClient:
    def __init__(self) -> None:
        self.tables: dict[str, list[dict]] = {
            "sites": [
                {"id": SITE_A, "workspace_id": str(WS)},
                {"id": SITE_B, "workspace_id": str(WS)},
            ],
            "projects": [{"id": PROJECT, "workspace_id": str(WS), "site_id": SITE_A}],
            "project_planned_items": [
                {
                    "id": PLANNED_CAM,
                    "workspace_id": str(WS),
                    "project_id": PROJECT,
                    "scope_kind": "equipment",
                    "name": "QA Camera 4MP",
                    "description": "מצלמה",
                    "sku": "CAM-4",
                    "qty": 4,
                    "product_id": PRODUCT,
                    "manufacturer": "QA Vision",
                    "model": "QV-T4",
                },
                {
                    "id": PLANNED_NVR,
                    "workspace_id": str(WS),
                    "project_id": PROJECT,
                    "scope_kind": "equipment",
                    "name": "NVR 16ch",
                    "description": "Network Video Recorder",
                    "sku": "NVR-16",
                    "qty": 1,
                    "product_id": None,
                    "manufacturer": "QA Vision",
                    "model": "NVR-16",
                },
                {
                    "id": PLANNED_LABOR,
                    "workspace_id": str(WS),
                    "project_id": PROJECT,
                    "scope_kind": "labor",
                    "name": "התקנה",
                    "description": "התקנת מצלמה",
                    "qty": 8,
                },
            ],
            "equipment": [],
        }
        self.force_collision_once: set[str] = set()

    def get(self, table: str, params: dict | None = None):
        params = params or {}
        rows = list(self.tables.get(table, []))
        for key, val in params.items():
            if key in {"select", "limit", "order"}:
                continue
            if isinstance(val, str) and val.startswith("eq."):
                want = val[3:]
                rows = [r for r in rows if str(r.get(key)) == want]
            elif isinstance(val, str) and val.startswith("like."):
                pattern = val[5:].replace("*", "")
                rows = [r for r in rows if str(r.get(key) or "").startswith(pattern.rstrip("%"))]
        limit = int(params.get("limit") or 100)
        return _ok(rows[:limit])

    def post(self, table: str, payload: dict, params: dict | None = None):
        if table == "equipment":
            code = str(payload.get("asset_code") or "")
            site = str(payload.get("site_id") or "")
            if code in self.force_collision_once:
                self.force_collision_once.discard(code)
                return httpx.Response(
                    409,
                    json={"code": "23505", "message": "duplicate key", "details": "equipment_site_asset_code"},
                )
            for existing in self.tables.get("equipment", []):
                if str(existing.get("site_id")) == site and str(existing.get("asset_code")) == code:
                    return httpx.Response(
                        409,
                        json={
                            "code": "23505",
                            "message": "duplicate key",
                            "details": "equipment_site_asset_code",
                        },
                    )
            row = {
                "id": str(uuid4()),
                "workspace_id": str(WS),
                "created_at": "2026-09-28T10:00:00Z",
                "updated_at": "2026-09-28T10:00:00Z",
                "system_id": None,
                "zone_id": None,
                "mac": None,
                "ip": None,
                "serial": None,
                "installed_at": None,
                "status": "installed",
                **payload,
            }
            self.tables.setdefault("equipment", []).append(row)
            return _ok([row], 201)
        return _ok([payload], 201)


# ── Category mapping ─────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "planned,expected",
    [
        ({"name": "Camera 4MP", "sku": "CAM"}, "camera"),
        ({"name": "NVR 16ch", "description": "recorder"}, "nvr"),
        ({"name": "DVR box"}, "dvr"),
        ({"name": "PoE Switch 8"}, "switch"),
        ({"name": "Alarm Panel"}, "panel"),
        ({"name": "RFID Reader"}, "reader"),
        ({"name": "Maglock"}, "lock"),
        ({"name": "PIR sensor"}, "pir"),
        ({"name": "UPS 1kVA"}, "power"),
        ({"name": "Cat6 cable"}, "cable"),
        ({"name": "Mystery widget"}, "other"),
    ],
)
def test_category_mapping(planned, expected):
    assert map_planned_to_equipment_category(planned) == expected


def test_asset_code_candidates_site_local():
    codes = next_asset_code_candidates(["CAM-001", "CAM-003"], category="camera", count=3)
    assert codes == ["CAM-004", "CAM-005", "CAM-006"]


def test_same_prefix_different_sites_independent():
    client = FakeClient()
    client.tables["equipment"] = [
        {"id": "1", "workspace_id": str(WS), "site_id": SITE_A, "asset_code": "CAM-005"},
    ]
    a = allocate_asset_code(client, workspace_id=str(WS), site_id=SITE_A, category="camera")
    b = allocate_asset_code(client, workspace_id=str(WS), site_id=SITE_B, category="camera")
    assert a == "CAM-006"
    assert b == "CAM-001"


# ── Qty expansion + labor skip ───────────────────────────────────────────────


def test_qty_4_creates_exactly_4():
    client = FakeClient()
    planned = [r for r in client.tables["project_planned_items"] if r["id"] == PLANNED_CAM]
    result = create_installed_assets_from_plan(
        client,
        workspace_id=str(WS),
        site_id=SITE_A,
        project_id=PROJECT,
        planned_items=planned,
    )
    assert result["requested"] == 4
    assert result["created"] == 4
    assert result["failed"] == 0
    eq = [e for e in client.tables["equipment"] if e.get("project_planned_item_id") == PLANNED_CAM]
    assert len(eq) == 4
    codes = sorted(e["asset_code"] for e in eq)
    assert codes == ["CAM-001", "CAM-002", "CAM-003", "CAM-004"]
    for e in eq:
        assert e["status"] == "installed"
        assert e["project_id"] == PROJECT
        assert e["product_id"] == PRODUCT
        assert e["manufacturer"] == "QA Vision"
        assert e["serial"] is None
        assert e.get("ip") is None


def test_labor_skipped():
    client = FakeClient()
    result = create_installed_assets_from_plan(
        client,
        workspace_id=str(WS),
        site_id=SITE_A,
        project_id=PROJECT,
        planned_items=client.tables["project_planned_items"],
    )
    labor_assets = [
        e for e in client.tables["equipment"] if e.get("project_planned_item_id") == PLANNED_LABOR
    ]
    assert labor_assets == []
    assert result["created"] == 5  # 4 cam + 1 nvr


def test_optional_excluded_upstream():
    assert should_include_quote_item({"item_type": "catalog", "qty": 1, "is_optional": True}) is False
    rows = plan_project_scope_from_snapshot(
        snapshot={
            "quote": {"id": "q", "version": 1},
            "sections": [],
            "items": [
                {
                    "id": "opt",
                    "item_type": "catalog",
                    "description": "opt cam",
                    "qty": 2,
                    "is_optional": True,
                },
                {
                    "id": "req",
                    "item_type": "catalog",
                    "description": "camera",
                    "name": "Cam",
                    "qty": 1,
                    "is_optional": False,
                },
            ],
        },
        workspace_id=str(WS),
        project_id=PROJECT,
        source_quote_id="q",
        source_quote_version=1,
    )
    assert len(rows) == 1
    assert rows[0]["source_quote_item_id"] == "req"


def test_retry_idempotent_no_duplicates():
    client = FakeClient()
    items = client.tables["project_planned_items"]
    first = create_installed_assets_from_plan(
        client,
        workspace_id=str(WS),
        site_id=SITE_A,
        project_id=PROJECT,
        planned_items=items,
    )
    assert first["created"] == 5
    second = create_installed_assets_from_plan(
        client,
        workspace_id=str(WS),
        site_id=SITE_A,
        project_id=PROJECT,
        planned_items=items,
    )
    assert second["requested"] == 0
    assert second["created"] == 0
    assert second["already_existing"] == 5
    assert second["message"] == "הציוד כבר נוצר"
    assert len(client.tables["equipment"]) == 5


def test_partial_existing_creates_only_missing():
    client = FakeClient()
    # Seed 2 of 4 cameras
    for i in range(2):
        client.tables["equipment"].append(
            {
                "id": str(uuid4()),
                "workspace_id": str(WS),
                "site_id": SITE_A,
                "project_id": PROJECT,
                "project_planned_item_id": PLANNED_CAM,
                "asset_code": f"CAM-{i+1:03d}",
                "name": "QA Camera 4MP",
                "category": "camera",
                "status": "installed",
            }
        )
    planned = [r for r in client.tables["project_planned_items"] if r["id"] == PLANNED_CAM]
    result = create_installed_assets_from_plan(
        client,
        workspace_id=str(WS),
        site_id=SITE_A,
        project_id=PROJECT,
        planned_items=planned,
    )
    assert result["requested"] == 2
    assert result["created"] == 2
    assert result["already_existing"] == 2
    cams = [e for e in client.tables["equipment"] if e.get("project_planned_item_id") == PLANNED_CAM]
    assert len(cams) == 4


def test_code_collision_retry():
    client = FakeClient()
    client.force_collision_once.add("CAM-001")
    planned = [r for r in client.tables["project_planned_items"] if r["id"] == PLANNED_CAM]
    # Only create 1 to observe collision recovery
    planned[0] = {**planned[0], "qty": 1}
    result = create_installed_assets_from_plan(
        client,
        workspace_id=str(WS),
        site_id=SITE_A,
        project_id=PROJECT,
        planned_items=planned,
    )
    assert result["created"] == 1
    assert result["failed"] == 0
    codes = [e["asset_code"] for e in client.tables["equipment"]]
    assert codes == ["CAM-002"]  # CAM-001 collided, reserved, next is CAM-002


def test_provenance_preserved():
    client = FakeClient()
    planned = [r for r in client.tables["project_planned_items"] if r["id"] == PLANNED_NVR]
    create_installed_assets_from_plan(
        client,
        workspace_id=str(WS),
        site_id=SITE_A,
        project_id=PROJECT,
        planned_items=planned,
    )
    row = client.tables["equipment"][0]
    assert row["project_planned_item_id"] == PLANNED_NVR
    assert row["project_id"] == PROJECT
    assert row["site_id"] == SITE_A
    assert row["workspace_id"] == str(WS)
    assert row["category"] == "nvr"
    assert row["asset_code"] == "NVR-001"


def test_build_create_plan_excludes_labor():
    client = FakeClient()
    plan = build_create_plan(client.tables["project_planned_items"], {})
    kinds = {p["planned_item"]["scope_kind"] for p in plan}
    assert kinds == {"equipment"}
    assert sum(p["remaining"] for p in plan) == 5


def test_warranty_picker_sees_created_via_list_shape():
    """Created assets are normal equipment rows — warranty picker lists by site."""
    client = FakeClient()
    create_installed_assets_from_plan(
        client,
        workspace_id=str(WS),
        site_id=SITE_A,
        project_id=PROJECT,
        planned_items=[r for r in client.tables["project_planned_items"] if r["id"] == PLANNED_CAM],
    )
    listed = client.get(
        "equipment",
        params={"workspace_id": f"eq.{WS}", "site_id": f"eq.{SITE_A}", "select": "id,asset_code,name"},
    ).json()
    assert len(listed) == 4
    assert all(r.get("asset_code") for r in listed)


def test_materialization_progress_counts():
    client = FakeClient()
    create_installed_assets_from_plan(
        client,
        workspace_id=str(WS),
        site_id=SITE_A,
        project_id=PROJECT,
        planned_items=client.tables["project_planned_items"],
    )
    from app.installed_assets_from_planned import count_assets_by_planned_item

    counts = count_assets_by_planned_item(client, str(WS), PROJECT)
    assert counts[PLANNED_CAM] == 4
    assert counts[PLANNED_NVR] == 1
    assert PLANNED_LABOR not in counts


def _require_ok(ctx, action, resource=None):
    return None


def test_endpoint_creates_assets(monkeypatch):
    from app.routers.ops_modules import create_installed_assets

    client = FakeClient()
    denied: list[str] = []

    def require_track(ctx, action, resource=None):
        denied.append(action)

    monkeypatch.setattr("app.routers.ops_modules._ctx", lambda *a, **k: object())
    monkeypatch.setattr("app.routers.ops_modules.require", require_track)
    monkeypatch.setattr("app.routers.ops_modules.write_audit", lambda *a, **k: None)
    monkeypatch.setattr("app.routers.ops_modules.actor_id", lambda u: ACTOR)

    out = create_installed_assets(WS, UUID(PROJECT), client, {"id": ACTOR})
    assert out["created"] == 5
    assert "projects.view" in denied
    assert "systems.edit" in denied
    assert len(client.tables["equipment"]) == 5


def test_endpoint_unauthorized_systems_edit(monkeypatch):
    from app.routers.ops_modules import create_installed_assets

    client = FakeClient()

    def require_deny(ctx, action, resource=None):
        if action == "systems.edit":
            raise ApiError(403, "PERMISSION_DENIED", "אין הרשאה")
        return None

    monkeypatch.setattr("app.routers.ops_modules._ctx", lambda *a, **k: object())
    monkeypatch.setattr("app.routers.ops_modules.require", require_deny)
    monkeypatch.setattr("app.routers.ops_modules.write_audit", lambda *a, **k: None)

    with pytest.raises(ApiError) as err:
        create_installed_assets(WS, UUID(PROJECT), client, {"id": ACTOR})
    assert err.value.status_code == 403
    assert client.tables["equipment"] == []


def test_endpoint_cross_workspace_site_rejected(monkeypatch):
    from app.routers.ops_modules import create_installed_assets

    client = FakeClient()
    client.tables["sites"] = [{"id": SITE_A, "workspace_id": "other-ws"}]

    monkeypatch.setattr("app.routers.ops_modules._ctx", lambda *a, **k: object())
    monkeypatch.setattr("app.routers.ops_modules.require", _require_ok)
    monkeypatch.setattr("app.routers.ops_modules.write_audit", lambda *a, **k: None)

    with pytest.raises(ApiError) as err:
        create_installed_assets(WS, UUID(PROJECT), client, {"id": ACTOR})
    # one_or_404 fails when site not in workspace filter → 404, or SCOPE_DENIED if found elsewhere
    assert err.value.status_code in {403, 404}
