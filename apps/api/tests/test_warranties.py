"""Warranty create/get/patch enrichment and equipment_id mapping (WAR-1/4)."""

from __future__ import annotations

from uuid import UUID

import httpx
import pytest

from app.authz.types import AuthzContext
from app.errors import ApiError
from app.routers import ops_modules as ops
from app.routers.ops_modules import (
    WarrantyCreate,
    WarrantyPatch,
    create_warranty,
    get_warranty,
    list_warranties,
    patch_warranty,
)

WS = UUID("00000000-0000-0000-0000-0000000000aa")
CUSTOMER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
SITE = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
OTHER_SITE = "cccccccc-cccc-cccc-cccc-cccccccccccc"
EQUIPMENT = "dddddddd-dddd-dddd-dddd-dddddddddddd"
WARRANTY = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
ACTOR = "11111111-1111-1111-1111-111111111111"


def _ok(data, status=200) -> httpx.Response:
    return httpx.Response(status, json=data)


class FakeClient:
    def __init__(self) -> None:
        self.posts: list[tuple[str, dict]] = []
        self.patches: list[tuple[str, dict, dict]] = []
        self.gets: list[tuple[str, dict]] = []

    def get(self, table: str, params: dict | None = None):
        params = params or {}
        self.gets.append((table, params))
        if table == "sites":
            select = str(params.get("select") or "")
            if "name" in select:
                return _ok([{"id": SITE, "name": "אתר בדיקה"}])
            return _ok([{"id": SITE}])
        if table == "equipment":
            if "id" in params and EQUIPMENT in str(params.get("id")):
                select = str(params.get("select") or "")
                if "serial" in select or "name" in select:
                    return _ok(
                        [
                            {
                                "id": EQUIPMENT,
                                "name": "מצלמה כניסה",
                                "manufacturer": "Hikvision",
                                "model": "DS-2",
                                "serial": "SN-100",
                            }
                        ]
                    )
                return _ok([{"id": EQUIPMENT, "site_id": SITE}])
            return _ok([])
        if table == "customers":
            return _ok([{"id": CUSTOMER, "display_name": "לקוח בדיקה"}])
        if table == "warranties":
            if params.get("id") == f"eq.{WARRANTY}":
                return _ok(
                    [
                        {
                            "id": WARRANTY,
                            "workspace_id": str(WS),
                            "number": "W-00001",
                            "type": "installation",
                            "status": "active",
                            "customer_id": CUSTOMER,
                            "site_id": SITE,
                            "installed_equipment_id": EQUIPMENT,
                            "starts_on": "2026-01-01",
                            "ends_on": "2027-01-01",
                            "document_id": None,
                            "created_at": "2026-09-27T00:00:00+00:00",
                            "updated_at": "2026-09-27T00:00:00+00:00",
                        }
                    ]
                )
            return _ok(
                [
                    {
                        "id": WARRANTY,
                        "workspace_id": str(WS),
                        "number": "W-00001",
                        "type": "installation",
                        "status": "active",
                        "customer_id": CUSTOMER,
                        "site_id": SITE,
                        "installed_equipment_id": EQUIPMENT,
                        "starts_on": "2026-01-01",
                        "ends_on": "2027-01-01",
                        "document_id": None,
                        "created_at": "2026-09-27T00:00:00+00:00",
                        "updated_at": "2026-09-27T00:00:00+00:00",
                    }
                ]
            )
        return _ok([])

    def post(self, table: str, payload: dict):
        self.posts.append((table, payload))
        row = {
            "id": WARRANTY,
            "number": "W-00001",
            "status": "active",
            "document_id": None,
            "created_at": "2026-09-27T00:00:00+00:00",
            "updated_at": "2026-09-27T00:00:00+00:00",
            **payload,
        }
        return _ok([row])

    def patch(self, table: str, payload: dict, params: dict | None = None):
        self.patches.append((table, payload, params or {}))
        row = {
            "id": WARRANTY,
            "workspace_id": str(WS),
            "number": "W-00001",
            "type": payload.get("type", "installation"),
            "status": payload.get("status", "active"),
            "customer_id": CUSTOMER,
            "site_id": SITE,
            "installed_equipment_id": payload.get("installed_equipment_id", EQUIPMENT),
            "starts_on": payload.get("starts_on", "2026-01-01"),
            "ends_on": payload.get("ends_on", "2027-01-01"),
            "document_id": None,
            "created_at": "2026-09-27T00:00:00+00:00",
            "updated_at": "2026-09-27T00:00:00+00:00",
        }
        return _ok([row])


def _ctx(role: str = "manager") -> AuthzContext:
    from app.authz.catalog import load_catalog

    catalog = load_catalog()
    return AuthzContext(
        user_id=ACTOR,
        workspace_id=str(WS),
        role_key=role,
        workspace_status="active",
        subscription_status="active",
        plan_key="solo",
        features=catalog["_plan_features"]["solo"],
    )


def _patch_auth(monkeypatch, ctx: AuthzContext | None = None) -> None:
    monkeypatch.setattr(ops, "_ctx", lambda *a, **k: ctx or _ctx())
    monkeypatch.setattr(ops, "require", lambda *a, **k: None)


def test_create_warranty_maps_equipment_id(monkeypatch):
    client = FakeClient()
    _patch_auth(monkeypatch)
    row = create_warranty(
        WS,
        WarrantyCreate(
            customer_id=CUSTOMER,
            site_id=SITE,
            starts_on="2026-01-01",
            ends_on="2027-01-01",
            equipment_id=EQUIPMENT,
            type="manufacturer",
        ),
        client,
        {"id": ACTOR},
    )
    assert client.posts[0][0] == "warranties"
    payload = client.posts[0][1]
    assert payload["installed_equipment_id"] == EQUIPMENT
    assert "equipment_id" not in payload
    assert row["equipment_id"] == EQUIPMENT
    assert row["equipment_serial"] == "SN-100"
    assert row["customer_name"] == "לקוח בדיקה"


def test_create_warranty_without_equipment_still_works(monkeypatch):
    client = FakeClient()
    _patch_auth(monkeypatch)
    row = create_warranty(
        WS,
        WarrantyCreate(
            customer_id=CUSTOMER,
            site_id=SITE,
            starts_on="2026-01-01",
            ends_on="2027-01-01",
        ),
        client,
        {"id": ACTOR},
    )
    assert "installed_equipment_id" not in client.posts[0][1]
    assert row["equipment_id"] is None


def test_create_rejects_equipment_on_other_site(monkeypatch):
    client = FakeClient()

    def get(table: str, params: dict | None = None):
        params = params or {}
        if table == "sites":
            return _ok([{"id": SITE}])
        if table == "equipment":
            return _ok([{"id": EQUIPMENT, "site_id": OTHER_SITE}])
        return _ok([])

    client.get = get  # type: ignore[method-assign]
    _patch_auth(monkeypatch)
    with pytest.raises(ApiError) as err:
        create_warranty(
            WS,
            WarrantyCreate(
                customer_id=CUSTOMER,
                site_id=SITE,
                starts_on="2026-01-01",
                ends_on="2027-01-01",
                equipment_id=EQUIPMENT,
            ),
            client,
            {"id": ACTOR},
        )
    assert err.value.status_code == 400


def test_list_and_get_enrich_equipment(monkeypatch):
    client = FakeClient()
    _patch_auth(monkeypatch)
    listed = list_warranties(
        WS,
        client,
        {"id": ACTOR},
        limit=50,
        cursor=None,
        status=None,
        site_id=None,
        customer_id=None,
    )
    assert listed["items"][0]["equipment_id"] == EQUIPMENT
    assert listed["items"][0]["equipment_serial"] == "SN-100"
    assert listed["items"][0]["customer_name"] == "לקוח בדיקה"
    assert listed["items"][0]["site_name"] == "אתר בדיקה"
    assert "installed_equipment_id" not in listed["items"][0]

    detail = get_warranty(WS, UUID(WARRANTY), client, {"id": ACTOR})
    assert detail["equipment_name"] == "מצלמה כניסה"
    assert detail["site_name"] == "אתר בדיקה"


def test_patch_warranty_status(monkeypatch):
    client = FakeClient()
    _patch_auth(monkeypatch)
    row = patch_warranty(
        WS,
        UUID(WARRANTY),
        WarrantyPatch(status="expired", ends_on="2026-06-01"),
        client,
        {"id": ACTOR},
    )
    assert client.patches[0][0] == "warranties"
    assert client.patches[0][1]["status"] == "expired"
    assert client.patches[0][1]["ends_on"] == "2026-06-01"
    assert row["status"] == "expired"
