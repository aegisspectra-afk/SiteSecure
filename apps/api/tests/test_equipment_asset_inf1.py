"""INF-1 Asset foundation: equipment provenance + asset_code uniqueness."""

from __future__ import annotations

from uuid import UUID

import httpx
import pytest

from app.errors import ApiError
from app.equipment_asset import normalize_asset_code, validate_equipment_provenance
from app.routers.systems import EquipmentCreate, EquipmentOut, EquipmentPatch, _equipment_out, create_equipment, get_equipment, patch_equipment


WS = UUID("00000000-0000-0000-0000-0000000000aa")
SITE_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
SITE_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
PROJECT = "cccccccc-cccc-cccc-cccc-cccccccccccc"
PLANNED = "dddddddd-dddd-dddd-dddd-dddddddddddd"
PRODUCT = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
EQUIPMENT = "ffffffff-ffff-ffff-ffff-ffffffffffff"
ACTOR = "11111111-1111-1111-1111-111111111111"


def _ok(data, status=200) -> httpx.Response:
    return httpx.Response(status, json=data)


class FakeClient:
    def __init__(self) -> None:
        self.tables: dict[str, list[dict]] = {
            "sites": [{"id": SITE_A, "workspace_id": str(WS)}, {"id": SITE_B, "workspace_id": str(WS)}],
            "projects": [{"id": PROJECT, "workspace_id": str(WS), "site_id": SITE_A}],
            "project_planned_items": [
                {"id": PLANNED, "workspace_id": str(WS), "project_id": PROJECT}
            ],
            "products": [{"id": PRODUCT, "workspace_id": str(WS)}],
            "systems": [],
            "site_zones": [],
            "equipment": [],
        }
        self.posts: list[tuple[str, dict]] = []
        self.patches: list[tuple[str, dict]] = []

    def get(self, table: str, params: dict | None = None):
        params = params or {}
        rows = list(self.tables.get(table, []))
        for key, val in params.items():
            if key in {"select", "limit", "order"}:
                continue
            if isinstance(val, str) and val.startswith("eq."):
                want = val[3:]
                rows = [r for r in rows if str(r.get(key)) == want]
            elif isinstance(val, str) and val.startswith("neq."):
                want = val[4:]
                rows = [r for r in rows if str(r.get(key)) != want]
        limit = int(params.get("limit") or 100)
        return _ok(rows[:limit])

    def post(self, table: str, payload: dict, params: dict | None = None):
        self.posts.append((table, payload))
        row = {
            "id": EQUIPMENT,
            "workspace_id": str(WS),
            "created_at": "2026-09-28T10:00:00Z",
            "updated_at": "2026-09-28T10:00:00Z",
            "system_id": None,
            "zone_id": None,
            "mac": None,
            "ip": None,
            "location_note": None,
            "installed_at": None,
            "product_id": None,
            "project_id": None,
            "project_planned_item_id": None,
            "asset_code": None,
            "manufacturer": None,
            "model": None,
            "serial": None,
            **payload,
        }
        self.tables.setdefault(table, []).append(row)
        return _ok([row], 201)

    def patch(self, table: str, payload: dict, params: dict | None = None):
        self.patches.append((table, payload))
        eid = (params or {}).get("id", "").removeprefix("eq.")
        rows = self.tables.get(table, [])
        for row in rows:
            if str(row.get("id")) == eid:
                row.update(payload)
                return _ok([row])
        return _ok([], 404)


def _user():
    return {"id": ACTOR}


def _require_ok(ctx, action, resource=None):
    return None


def test_normalize_asset_code():
    assert normalize_asset_code(" CAM-001 ") == "CAM-001"
    assert normalize_asset_code("") is None
    assert normalize_asset_code(None) is None


def test_validate_rejects_cross_workspace_product():
    client = FakeClient()
    client.tables["products"] = [{"id": PRODUCT, "workspace_id": "other-ws"}]
    with pytest.raises(ApiError) as err:
        validate_equipment_provenance(
            client,
            workspace_id=WS,
            site_id=SITE_A,
            product_id=PRODUCT,
        )
    assert err.value.status_code == 400


def test_validate_rejects_project_site_mismatch():
    client = FakeClient()
    client.tables["projects"] = [{"id": PROJECT, "workspace_id": str(WS), "site_id": SITE_B}]
    with pytest.raises(ApiError) as err:
        validate_equipment_provenance(
            client,
            workspace_id=WS,
            site_id=SITE_A,
            project_id=PROJECT,
        )
    assert "אתר" in err.value.message


def test_validate_rejects_planned_item_project_mismatch():
    client = FakeClient()
    with pytest.raises(ApiError) as err:
        validate_equipment_provenance(
            client,
            workspace_id=WS,
            site_id=SITE_A,
            project_id="99999999-9999-9999-9999-999999999999",
            project_planned_item_id=PLANNED,
        )
    assert err.value.status_code == 400


def test_validate_asset_code_unique_per_site():
    client = FakeClient()
    client.tables["equipment"] = [
        {"id": "e1", "workspace_id": str(WS), "site_id": SITE_A, "asset_code": "CAM-001"}
    ]
    with pytest.raises(ApiError) as err:
        validate_equipment_provenance(
            client,
            workspace_id=WS,
            site_id=SITE_A,
            asset_code="CAM-001",
        )
    assert err.value.status_code == 409
    # Same code on other site is fine
    out = validate_equipment_provenance(
        client,
        workspace_id=WS,
        site_id=SITE_B,
        asset_code="CAM-001",
    )
    assert out["asset_code"] == "CAM-001"


def test_create_equipment_with_provenance(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr("app.routers.systems._ctx", lambda *a, **k: object())
    monkeypatch.setattr("app.routers.systems.require", _require_ok)
    body = EquipmentCreate(
        site_id=SITE_A,
        name="מצלמה 1",
        category="camera",
        status="installed",
        product_id=PRODUCT,
        project_id=PROJECT,
        project_planned_item_id=PLANNED,
        asset_code="CAM-001",
        mac="AA:BB:CC:DD:EE:FF",
        installed_at="2026-09-28",
    )
    out = create_equipment(WS, body, client, _user())
    assert out.asset_code == "CAM-001"
    assert out.product_id == PRODUCT
    assert out.project_id == PROJECT
    assert out.project_planned_item_id == PLANNED
    assert out.mac == "AA:BB:CC:DD:EE:FF"
    assert out.installed_at == "2026-09-28"
    assert client.posts[0][0] == "equipment"


def test_get_equipment_returns_row(monkeypatch):
    client = FakeClient()
    client.tables["equipment"] = [
        {
            "id": EQUIPMENT,
            "workspace_id": str(WS),
            "site_id": SITE_A,
            "category": "camera",
            "status": "installed",
            "name": "מצלמה",
            "manufacturer": None,
            "model": None,
            "serial": None,
            "mac": None,
            "ip": None,
            "location_note": None,
            "installed_at": None,
            "system_id": None,
            "zone_id": None,
            "product_id": PRODUCT,
            "project_id": PROJECT,
            "project_planned_item_id": PLANNED,
            "asset_code": "CAM-001",
            "created_at": "2026-09-28T10:00:00Z",
            "updated_at": "2026-09-28T10:00:00Z",
        }
    ]
    monkeypatch.setattr("app.routers.systems._ctx", lambda *a, **k: object())
    monkeypatch.setattr("app.routers.systems.require", _require_ok)
    out = get_equipment(WS, UUID(EQUIPMENT), client, _user())
    assert out.id == EQUIPMENT
    assert out.asset_code == "CAM-001"
    assert out.project_id == PROJECT


def test_patch_equipment_updates_fields(monkeypatch):
    client = FakeClient()
    client.tables["equipment"] = [
        {
            "id": EQUIPMENT,
            "workspace_id": str(WS),
            "site_id": SITE_A,
            "category": "camera",
            "status": "installed",
            "name": "מצלמה",
            "manufacturer": None,
            "model": None,
            "serial": None,
            "mac": None,
            "ip": None,
            "location_note": None,
            "installed_at": None,
            "system_id": None,
            "zone_id": None,
            "product_id": None,
            "project_id": None,
            "project_planned_item_id": None,
            "asset_code": None,
            "created_at": "2026-09-28T10:00:00Z",
            "updated_at": "2026-09-28T10:00:00Z",
        }
    ]
    monkeypatch.setattr("app.routers.systems._ctx", lambda *a, **k: object())
    monkeypatch.setattr("app.routers.systems.require", _require_ok)
    out = patch_equipment(
        WS,
        UUID(EQUIPMENT),
        EquipmentPatch(serial="SN-9", asset_code="CAM-002", mac="11:22:33:44:55:66"),
        client,
        _user(),
    )
    assert out.serial == "SN-9"
    assert out.asset_code == "CAM-002"
    assert out.mac == "11:22:33:44:55:66"


def test_legacy_equipment_out_serializes_null_provenance():
    row = {
        "id": EQUIPMENT,
        "workspace_id": str(WS),
        "site_id": SITE_A,
        "category": "other",
        "status": "planned",
        "name": "ישן",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }
    out = _equipment_out(row)
    assert isinstance(out, EquipmentOut)
    assert out.product_id is None
    assert out.project_id is None
    assert out.project_planned_item_id is None
    assert out.asset_code is None
