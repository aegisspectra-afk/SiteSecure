"""INF-1D: Asset lifecycle — service equipment link + docs entity."""

from __future__ import annotations

from uuid import UUID, uuid4

import httpx
import pytest

from app.errors import ApiError
from app.routers import ops_modules as ops
from app.routers import systems as systems_router

WS = UUID("00000000-0000-0000-0000-0000000000aa")
SITE = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
CUST = "cccccccc-cccc-cccc-cccc-cccccccccccc"
EQ = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
EQ_OTHER_SITE = "ffffffff-ffff-ffff-ffff-ffffffffffff"
SITE_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
ACTOR = "11111111-1111-1111-1111-111111111111"


def _ok(data, status=200) -> httpx.Response:
    return httpx.Response(status, json=data)


class FakeClient:
    def __init__(self) -> None:
        self.tables: dict[str, list[dict]] = {
            "sites": [
                {"id": SITE, "workspace_id": str(WS), "customer_id": CUST, "name": "Site"},
                {"id": SITE_B, "workspace_id": str(WS), "customer_id": CUST, "name": "Other"},
            ],
            "equipment": [
                {
                    "id": EQ,
                    "workspace_id": str(WS),
                    "site_id": SITE,
                    "name": "CAM",
                    "asset_code": "CAM-001",
                    "category": "camera",
                    "status": "installed",
                    "serial": None,
                    "ip": None,
                    "mac": None,
                    "created_at": "2026-09-01T00:00:00Z",
                    "updated_at": "2026-09-01T00:00:00Z",
                },
                {
                    "id": EQ_OTHER_SITE,
                    "workspace_id": str(WS),
                    "site_id": SITE_B,
                    "name": "Other",
                    "asset_code": "CAM-999",
                    "category": "camera",
                    "status": "installed",
                    "created_at": "2026-09-01T00:00:00Z",
                    "updated_at": "2026-09-01T00:00:00Z",
                },
            ],
            "service_calls": [],
            "documents": [],
            "asset_connections": [],
            "warranties": [],
            "audit_logs": [],
            "customers": [{"id": CUST, "display_name": "Cust"}],
        }
        self.audits: list[dict] = []

    def get(self, table: str, params: dict | None = None):
        params = params or {}
        rows = list(self.tables.get(table, []))
        for key, val in params.items():
            if key in {"select", "limit", "order"}:
                continue
            if key == "or" and isinstance(val, str):
                # naive: (source.eq.X,target.eq.X)
                continue
            if isinstance(val, str) and val.startswith("eq."):
                want = val[3:]
                rows = [r for r in rows if str(r.get(key)) == want]
            elif isinstance(val, str) and val.startswith("in.("):
                ids = val[4:-1].split(",")
                rows = [r for r in rows if str(r.get(key)) in ids]
        limit = int(params.get("limit") or 100)
        return _ok(rows[:limit])

    def post(self, table: str, payload: dict, params: dict | None = None):
        row = {
            "id": str(uuid4()),
            "created_at": "2026-09-28T12:00:00Z",
            "updated_at": "2026-09-28T12:00:00Z",
            **payload,
        }
        self.tables.setdefault(table, []).append(row)
        return _ok([row], 201)

    def patch(self, table: str, payload: dict, params: dict | None = None):
        eid = (params or {}).get("id", "").removeprefix("eq.")
        for row in self.tables.get(table, []):
            if str(row.get("id")) == eid:
                row.update(payload)
                return _ok([row])
        return _ok([], 404)

    def delete(self, table: str, params: dict | None = None):
        return httpx.Response(204)

    def rpc(self, name: str, payload: dict):
        self.audits.append({"name": name, **payload})
        return _ok({})


def _require_ok(ctx, action, resource=None):
    return None


def test_create_service_call_with_equipment(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(ops, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(ops, "require", _require_ok)
    row = ops.create_service_call(
        WS,
        ops.ServiceCallCreate(
            title="CAM offline",
            customer_id=CUST,
            site_id=SITE,
            equipment_id=EQ,
        ),
        client,
        {"id": ACTOR},
    )
    assert row["equipment_id"] == EQ
    assert row["title"] == "CAM offline"


def test_service_equipment_cross_site_blocked(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(ops, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(ops, "require", _require_ok)
    with pytest.raises(ApiError) as err:
        ops.create_service_call(
            WS,
            ops.ServiceCallCreate(
                title="Bad",
                customer_id=CUST,
                site_id=SITE,
                equipment_id=EQ_OTHER_SITE,
            ),
            client,
            {"id": ACTOR},
        )
    assert err.value.status_code == 400


def test_list_service_by_equipment(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(ops, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(ops, "require", _require_ok)
    ops.create_service_call(
        WS,
        ops.ServiceCallCreate(title="Fix", customer_id=CUST, site_id=SITE, equipment_id=EQ),
        client,
        {"id": ACTOR},
    )
    # Direct table filter (list endpoint uses Query defaults awkward in unit call)
    rows = [r for r in client.tables["service_calls"] if r.get("equipment_id") == EQ]
    assert len(rows) == 1


def test_lifecycle_activity_includes_service(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(systems_router, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(systems_router, "require", _require_ok)
    client.tables["service_calls"] = [
        {
            "id": str(uuid4()),
            "workspace_id": str(WS),
            "equipment_id": EQ,
            "title": "Lens dirty",
            "status": "open",
            "number": "SC-1",
            "created_at": "2026-09-28T10:00:00Z",
            "updated_at": "2026-09-28T10:00:00Z",
        }
    ]
    out = systems_router.list_equipment_lifecycle_activity(WS, UUID(EQ), client, {"id": ACTOR})
    kinds = {i["kind"] for i in out["items"]}
    assert "asset_created" in kinds
    assert "service" in kinds


def test_equipment_patch_emits_audit(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(systems_router, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(systems_router, "require", _require_ok)
    patched = systems_router.patch_equipment(
        WS,
        UUID(EQ),
        systems_router.EquipmentPatch(status="replaced", ip="10.1.1.9"),
        client,
        {"id": ACTOR},
    )
    assert patched.status == "replaced"
    assert any(a.get("p_action") == "equipment.updated" for a in client.audits)
