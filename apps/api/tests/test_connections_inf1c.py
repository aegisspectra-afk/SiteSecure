"""INF-1C: Asset connections + topology validation."""

from __future__ import annotations

from uuid import UUID, uuid4

import httpx
import pytest

from app.errors import ApiError
from app.routers import connections as conn_router

WS = UUID("00000000-0000-0000-0000-0000000000aa")
SITE_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
SITE_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
FW = "11111111-1111-1111-1111-111111111101"
CORE = "11111111-1111-1111-1111-111111111102"
SW = "11111111-1111-1111-1111-111111111103"
CAM = "11111111-1111-1111-1111-111111111104"
CAM2 = "11111111-1111-1111-1111-111111111105"
OTHER_SITE = "11111111-1111-1111-1111-111111111199"
ACTOR = "11111111-1111-1111-1111-111111111111"


def _ok(data, status=200) -> httpx.Response:
    return httpx.Response(status, json=data)


def _dup_key(payload: dict) -> tuple:
    return (
        str(payload.get("site_id")),
        str(payload.get("source_equipment_id")),
        str(payload.get("target_equipment_id")),
        str(payload.get("connection_type")),
        str(payload.get("source_port") or ""),
        str(payload.get("target_port") or ""),
    )


class FakeClient:
    def __init__(self) -> None:
        self.tables: dict[str, list[dict]] = {
            "sites": [
                {"id": SITE_A, "workspace_id": str(WS), "name": "Site A"},
                {"id": SITE_B, "workspace_id": str(WS), "name": "Site B"},
            ],
            "equipment": [
                {
                    "id": FW,
                    "workspace_id": str(WS),
                    "site_id": SITE_A,
                    "name": "Firewall",
                    "asset_code": "FW-01",
                    "category": "other",
                    "status": "installed",
                    "ip": "10.10.10.1",
                    "mac": None,
                    "manufacturer": None,
                    "model": None,
                },
                {
                    "id": CORE,
                    "workspace_id": str(WS),
                    "site_id": SITE_A,
                    "name": "Core Switch",
                    "asset_code": "CORE-SW-01",
                    "category": "switch",
                    "status": "installed",
                    "ip": "10.10.10.2",
                    "mac": None,
                    "manufacturer": None,
                    "model": None,
                },
                {
                    "id": SW,
                    "workspace_id": str(WS),
                    "site_id": SITE_A,
                    "name": "CCTV Switch",
                    "asset_code": "SW-CCTV-01",
                    "category": "switch",
                    "status": "installed",
                    "ip": None,
                    "mac": None,
                    "manufacturer": None,
                    "model": None,
                },
                {
                    "id": CAM,
                    "workspace_id": str(WS),
                    "site_id": SITE_A,
                    "name": "Camera 1",
                    "asset_code": "CAM-001",
                    "category": "camera",
                    "status": "installed",
                    "ip": "10.10.20.101",
                    "mac": None,
                    "manufacturer": None,
                    "model": None,
                },
                {
                    "id": CAM2,
                    "workspace_id": str(WS),
                    "site_id": SITE_A,
                    "name": "Camera 2",
                    "asset_code": "CAM-002",
                    "category": "camera",
                    "status": "installed",
                    "ip": None,
                    "mac": None,
                    "manufacturer": None,
                    "model": None,
                },
                {
                    "id": OTHER_SITE,
                    "workspace_id": str(WS),
                    "site_id": SITE_B,
                    "name": "Other Cam",
                    "asset_code": "CAM-999",
                    "category": "camera",
                    "status": "installed",
                    "ip": None,
                    "mac": None,
                    "manufacturer": None,
                    "model": None,
                },
            ],
            "asset_connections": [],
            "site_ip_addresses": [],
        }

    def get(self, table: str, params: dict | None = None):
        params = params or {}
        rows = list(self.tables.get(table, []))
        for key, val in params.items():
            if key in {"select", "limit", "order"}:
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
        if table == "asset_connections":
            key = _dup_key(payload)
            for existing in self.tables["asset_connections"]:
                if _dup_key(existing) == key:
                    return httpx.Response(
                        409,
                        json={"code": "23505", "message": "duplicate", "details": "asset_connections_unique"},
                    )
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
                merged = {**row, **payload}
                if table == "asset_connections":
                    key = _dup_key(merged)
                    for other in self.tables["asset_connections"]:
                        if other is row:
                            continue
                        if _dup_key(other) == key:
                            return httpx.Response(
                                409,
                                json={"code": "23505", "message": "duplicate", "details": "asset_connections_unique"},
                            )
                row.update(payload)
                return _ok([row])
        return _ok([], 404)

    def delete(self, table: str, params: dict | None = None):
        eid = (params or {}).get("id", "").removeprefix("eq.")
        rows = self.tables.get(table, [])
        self.tables[table] = [r for r in rows if str(r.get("id")) != eid]
        return httpx.Response(204)


def _require_ok(ctx, action, resource=None):
    return None


def _denied(ctx, action, resource=None):
    raise ApiError(403, "PERMISSION_DENIED", "denied")


def test_create_connection(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(conn_router, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(conn_router, "require", _require_ok)
    row = conn_router.create_connection(
        WS,
        conn_router.ConnectionCreate(
            site_id=SITE_A,
            source_equipment_id=CAM,
            target_equipment_id=SW,
            connection_type="poe",
            source_port="eth0",
            target_port="1",
        ),
        client,
        {"id": ACTOR},
    )
    assert row["connection_type"] == "poe"
    assert row["source_port"] == "eth0"
    assert row["target_port"] == "1"


def test_same_site_ok_cross_site_blocked(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(conn_router, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(conn_router, "require", _require_ok)
    with pytest.raises(ApiError) as err:
        conn_router.create_connection(
            WS,
            conn_router.ConnectionCreate(
                site_id=SITE_A,
                source_equipment_id=CAM,
                target_equipment_id=OTHER_SITE,
                connection_type="ethernet",
            ),
            client,
            {"id": ACTOR},
        )
    assert err.value.status_code == 400


def test_self_connection_blocked(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(conn_router, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(conn_router, "require", _require_ok)
    with pytest.raises(ApiError) as err:
        conn_router.create_connection(
            WS,
            conn_router.ConnectionCreate(
                site_id=SITE_A,
                source_equipment_id=CAM,
                target_equipment_id=CAM,
                connection_type="ethernet",
            ),
            client,
            {"id": ACTOR},
        )
    assert err.value.status_code == 400


def test_duplicate_blocked(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(conn_router, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(conn_router, "require", _require_ok)
    body = conn_router.ConnectionCreate(
        site_id=SITE_A,
        source_equipment_id=CAM,
        target_equipment_id=SW,
        connection_type="ethernet",
        source_port="eth0",
        target_port="1",
    )
    conn_router.create_connection(WS, body, client, {"id": ACTOR})
    with pytest.raises(ApiError) as err:
        conn_router.create_connection(WS, body, client, {"id": ACTOR})
    assert err.value.status_code == 409


def test_edit_ports_and_type(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(conn_router, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(conn_router, "require", _require_ok)
    created = conn_router.create_connection(
        WS,
        conn_router.ConnectionCreate(
            site_id=SITE_A,
            source_equipment_id=SW,
            target_equipment_id=CORE,
            connection_type="uplink",
            source_port="24",
            target_port="12",
        ),
        client,
        {"id": ACTOR},
    )
    patched = conn_router.patch_connection(
        WS,
        UUID(created["id"]),
        conn_router.ConnectionPatch(connection_type="fiber", source_port="24", target_port="14"),
        client,
        {"id": ACTOR},
    )
    assert patched["connection_type"] == "fiber"
    assert patched["target_port"] == "14"


def test_delete_connection(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(conn_router, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(conn_router, "require", _require_ok)
    created = conn_router.create_connection(
        WS,
        conn_router.ConnectionCreate(
            site_id=SITE_A,
            source_equipment_id=FW,
            target_equipment_id=CORE,
            connection_type="wan",
        ),
        client,
        {"id": ACTOR},
    )
    out = conn_router.delete_connection(WS, UUID(created["id"]), client, {"id": ACTOR})
    assert out["ok"] is True
    assert client.tables["asset_connections"] == []


def test_list_equipment_connections(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(conn_router, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(conn_router, "require", _require_ok)
    conn_router.create_connection(
        WS,
        conn_router.ConnectionCreate(
            site_id=SITE_A,
            source_equipment_id=CAM,
            target_equipment_id=SW,
            connection_type="poe",
        ),
        client,
        {"id": ACTOR},
    )
    listed = conn_router.list_equipment_connections(WS, UUID(CAM), client, {"id": ACTOR})
    assert len(listed["items"]) == 1
    assert listed["items"][0]["target_asset_code"] == "SW-CCTV-01"


def test_topology_nodes_and_edges(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(conn_router, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(conn_router, "require", _require_ok)
    conn_router.create_connection(
        WS,
        conn_router.ConnectionCreate(
            site_id=SITE_A,
            source_equipment_id=FW,
            target_equipment_id=CORE,
            connection_type="wan",
        ),
        client,
        {"id": ACTOR},
    )
    topo = conn_router.get_site_topology(WS, UUID(SITE_A), client, {"id": ACTOR})
    assert topo["directional"] is True
    assert len(topo["nodes"]) >= 5
    assert len(topo["edges"]) == 1
    assert topo["edges"][0]["source_equipment_id"] == FW


def test_empty_topology_no_fake_edges(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(conn_router, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(conn_router, "require", _require_ok)
    topo = conn_router.get_site_topology(WS, UUID(SITE_A), client, {"id": ACTOR})
    assert topo["nodes"]
    assert topo["edges"] == []


def test_readonly_cannot_mutate(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(conn_router, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(conn_router, "require", _denied)
    with pytest.raises(ApiError) as err:
        conn_router.create_connection(
            WS,
            conn_router.ConnectionCreate(
                site_id=SITE_A,
                source_equipment_id=CAM,
                target_equipment_id=SW,
                connection_type="ethernet",
            ),
            client,
            {"id": ACTOR},
        )
    assert err.value.status_code == 403
