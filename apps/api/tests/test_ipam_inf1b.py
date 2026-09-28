"""INF-1B: Network / IPAM validation + API behavior."""

from __future__ import annotations

from uuid import UUID, uuid4

import httpx
import pytest

from app.errors import ApiError
from app.ipam import (
    assert_ip_in_network,
    normalize_cidr,
    normalize_ip,
    validate_vlan_number,
)
from app.routers import ipam as ipam_router

WS = UUID("00000000-0000-0000-0000-0000000000aa")
SITE_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
SITE_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
VLAN = "cccccccc-cccc-cccc-cccc-cccccccccccc"
NET = "dddddddd-dddd-dddd-dddd-dddddddddddd"
EQ = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
EQ_OTHER = "ffffffff-ffff-ffff-ffff-ffffffffffff"
ACTOR = "11111111-1111-1111-1111-111111111111"


def _ok(data, status=200) -> httpx.Response:
    return httpx.Response(status, json=data)


class FakeClient:
    def __init__(self) -> None:
        self.tables: dict[str, list[dict]] = {
            "sites": [
                {"id": SITE_A, "workspace_id": str(WS), "name": "Site A"},
                {"id": SITE_B, "workspace_id": str(WS), "name": "Site B"},
            ],
            "site_vlans": [],
            "site_networks": [],
            "site_ip_addresses": [],
            "equipment": [
                {"id": EQ, "workspace_id": str(WS), "site_id": SITE_A, "name": "CAM-001", "asset_code": "CAM-001", "ip": "10.0.0.9", "mac": None},
                {"id": EQ_OTHER, "workspace_id": str(WS), "site_id": SITE_B, "name": "Other", "asset_code": "CAM-999", "ip": None, "mac": None},
            ],
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
        if table == "site_vlans":
            for existing in self.tables["site_vlans"]:
                if (
                    str(existing.get("site_id")) == str(payload.get("site_id"))
                    and int(existing.get("vlan_number")) == int(payload.get("vlan_number"))
                ):
                    return httpx.Response(409, json={"code": "23505", "message": "duplicate", "details": "site_vlans_site_number"})
        if table == "site_ip_addresses":
            for existing in self.tables["site_ip_addresses"]:
                if (
                    str(existing.get("site_id")) == str(payload.get("site_id"))
                    and str(existing.get("ip_address")) == str(payload.get("ip_address"))
                ):
                    return httpx.Response(409, json={"code": "23505", "message": "duplicate", "details": "site_ip_addresses_site_ip"})
        row = {"id": str(uuid4()), "created_at": "2026-09-28T12:00:00Z", "updated_at": "2026-09-28T12:00:00Z", **payload}
        self.tables.setdefault(table, []).append(row)
        return _ok([row], 201)

    def patch(self, table: str, payload: dict, params: dict | None = None):
        eid = (params or {}).get("id", "").removeprefix("eq.")
        for row in self.tables.get(table, []):
            if str(row.get("id")) == eid:
                merged = {**row, **payload}
                if table == "site_ip_addresses":
                    for other in self.tables["site_ip_addresses"]:
                        if other is row:
                            continue
                        if str(other.get("site_id")) == str(merged.get("site_id")) and str(other.get("ip_address")) == str(
                            merged.get("ip_address")
                        ):
                            return httpx.Response(
                                409, json={"code": "23505", "message": "duplicate", "details": "site_ip_addresses_site_ip"}
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


def test_normalize_cidr_and_ip():
    assert normalize_cidr("10.10.20.0/24") == "10.10.20.0/24"
    assert normalize_ip("10.10.20.10") == "10.10.20.10"
    with pytest.raises(ApiError):
        normalize_cidr("not-a-cidr")
    with pytest.raises(ApiError):
        normalize_ip("999.1.1.1")


def test_ip_must_belong_to_subnet():
    assert assert_ip_in_network("10.10.20.101", "10.10.20.0/24") == "10.10.20.101"
    with pytest.raises(ApiError) as err:
        assert_ip_in_network("10.10.30.10", "10.10.20.0/24")
    assert err.value.status_code == 400


def test_vlan_number_range():
    assert validate_vlan_number(20) == 20
    with pytest.raises(ApiError):
        validate_vlan_number(0)
    with pytest.raises(ApiError):
        validate_vlan_number(5000)


def test_create_network_and_invalid_cidr(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(ipam_router, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(ipam_router, "require", _require_ok)
    body = ipam_router.NetworkCreate(site_id=SITE_A, name="CCTV", cidr="10.10.20.0/24")
    row = ipam_router.create_network(WS, body, client, {"id": ACTOR})
    assert row["cidr"] == "10.10.20.0/24"
    with pytest.raises(ApiError):
        ipam_router.create_network(
            WS,
            ipam_router.NetworkCreate(site_id=SITE_A, name="Bad", cidr="nope"),
            client,
            {"id": ACTOR},
        )


def test_create_vlan_and_duplicate(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(ipam_router, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(ipam_router, "require", _require_ok)
    first = ipam_router.create_vlan(
        WS, ipam_router.VlanCreate(site_id=SITE_A, vlan_number=20, name="CCTV"), client, {"id": ACTOR}
    )
    assert first["vlan_number"] == 20
    with pytest.raises(ApiError) as err:
        ipam_router.create_vlan(
            WS, ipam_router.VlanCreate(site_id=SITE_A, vlan_number=20, name="Dup"), client, {"id": ACTOR}
        )
    assert err.value.status_code == 409


def test_create_ip_assign_and_duplicate(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(ipam_router, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(ipam_router, "require", _require_ok)
    client.tables["site_networks"] = [
        {"id": NET, "workspace_id": str(WS), "site_id": SITE_A, "cidr": "10.10.20.0/24", "vlan_id": None, "name": "CCTV"}
    ]
    created = ipam_router.create_ip_address(
        WS,
        ipam_router.IpCreate(
            site_id=SITE_A,
            network_id=NET,
            ip_address="10.10.20.101",
            equipment_id=EQ,
            assignment_type="static",
        ),
        client,
        {"id": ACTOR},
    )
    assert created["status"] == "assigned"
    assert created["equipment_id"] == EQ
    with pytest.raises(ApiError) as err:
        ipam_router.create_ip_address(
            WS,
            ipam_router.IpCreate(site_id=SITE_A, network_id=NET, ip_address="10.10.20.101"),
            client,
            {"id": ACTOR},
        )
    assert err.value.status_code == 409


def test_ip_outside_subnet_rejected(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(ipam_router, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(ipam_router, "require", _require_ok)
    client.tables["site_networks"] = [
        {"id": NET, "workspace_id": str(WS), "site_id": SITE_A, "cidr": "10.10.20.0/24", "vlan_id": None, "name": "CCTV"}
    ]
    with pytest.raises(ApiError):
        ipam_router.create_ip_address(
            WS,
            ipam_router.IpCreate(site_id=SITE_A, network_id=NET, ip_address="10.10.30.10"),
            client,
            {"id": ACTOR},
        )


def test_cross_site_equipment_rejected(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(ipam_router, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(ipam_router, "require", _require_ok)
    client.tables["site_networks"] = [
        {"id": NET, "workspace_id": str(WS), "site_id": SITE_A, "cidr": "10.10.20.0/24", "vlan_id": None, "name": "CCTV"}
    ]
    with pytest.raises(ApiError) as err:
        ipam_router.create_ip_address(
            WS,
            ipam_router.IpCreate(
                site_id=SITE_A,
                network_id=NET,
                ip_address="10.10.20.50",
                equipment_id=EQ_OTHER,
            ),
            client,
            {"id": ACTOR},
        )
    assert err.value.status_code == 400


def test_unassign_reassign(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(ipam_router, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(ipam_router, "require", _require_ok)
    client.tables["site_networks"] = [
        {"id": NET, "workspace_id": str(WS), "site_id": SITE_A, "cidr": "10.10.20.0/24", "vlan_id": None, "name": "CCTV"}
    ]
    created = ipam_router.create_ip_address(
        WS,
        ipam_router.IpCreate(site_id=SITE_A, network_id=NET, ip_address="10.10.20.10", equipment_id=EQ),
        client,
        {"id": ACTOR},
    )
    ip_id = UUID(created["id"])
    cleared = ipam_router.patch_ip_address(
        WS, ip_id, ipam_router.IpPatch(clear_equipment=True), client, {"id": ACTOR}
    )
    assert cleared.get("equipment_id") is None
    assert cleared["status"] == "available"
    reassigned = ipam_router.patch_ip_address(
        WS, ip_id, ipam_router.IpPatch(equipment_id=EQ), client, {"id": ACTOR}
    )
    assert reassigned["equipment_id"] == EQ
    assert reassigned["status"] == "assigned"


def test_equipment_ip_list_includes_legacy(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(ipam_router, "_ctx", lambda *a, **k: object())
    monkeypatch.setattr(ipam_router, "require", _require_ok)
    out = ipam_router.list_equipment_ip_addresses(WS, UUID(EQ), client, {"id": ACTOR})
    assert out["legacy_ip"] == "10.0.0.9"
    assert out["items"] == []
