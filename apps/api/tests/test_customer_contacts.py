"""Customer contact list/create/patch/delete (T2-2)."""

from __future__ import annotations

from uuid import UUID

import httpx
import pytest

from app.authz.types import AuthzContext
from app.errors import ApiError
from app.routers import customers as customers_mod
from app.routers.customers import (
    ContactCreate,
    ContactPatch,
    create_contact,
    delete_contact,
    list_contacts,
    patch_contact,
)

WS = UUID("00000000-0000-0000-0000-0000000000aa")
OTHER_WS = UUID("00000000-0000-0000-0000-0000000000bb")
CUSTOMER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
CONTACT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
OTHER_CONTACT = "cccccccc-cccc-cccc-cccc-cccccccccccc"
ACTOR = "11111111-1111-1111-1111-111111111111"


def _ok(data, status=200) -> httpx.Response:
    return httpx.Response(status, json=data)


class FakeClient:
    def __init__(self) -> None:
        self.posts: list[tuple[str, dict]] = []
        self.patches: list[tuple[str, dict, dict]] = []
        self.deletes: list[tuple[str, dict]] = []
        self.gets: list[tuple[str, dict]] = []

    def get(self, table: str, params: dict | None = None):
        params = params or {}
        self.gets.append((table, params))
        ws = params.get("workspace_id")
        if ws and ws != f"eq.{WS}":
            return _ok([])
        if table == "customers":
            if params.get("id") == f"eq.{CUSTOMER}":
                return _ok([{"id": CUSTOMER}])
            return _ok([])
        if table == "customer_contacts":
            row = {
                "id": CONTACT,
                "customer_id": CUSTOMER,
                "full_name": "דנה כהן",
                "role_title": "מנהלת",
                "email": "dana@example.com",
                "phone": "0500000000",
                "is_primary": True,
            }
            if params.get("id") == f"eq.{CONTACT}":
                if params.get("customer_id") == f"eq.{CUSTOMER}":
                    return _ok([row])
                return _ok([])
            if params.get("id"):
                return _ok([])
            if params.get("customer_id") == f"eq.{CUSTOMER}":
                return _ok([row])
            return _ok([])
        return _ok([])

    def post(self, table: str, payload: dict):
        self.posts.append((table, payload))
        return _ok([{**payload, "id": CONTACT, "is_primary": bool(payload.get("is_primary"))}])

    def patch(self, table: str, payload: dict, params: dict | None = None):
        params = params or {}
        self.patches.append((table, payload, params))
        return _ok(
            [
                {
                    "id": CONTACT,
                    "customer_id": CUSTOMER,
                    "full_name": payload.get("full_name", "דנה כהן"),
                    "role_title": payload.get("role_title", "מנהלת"),
                    "email": payload.get("email", "dana@example.com"),
                    "phone": payload.get("phone", "0500000000"),
                    "is_primary": payload.get("is_primary", True),
                }
            ]
        )

    def delete(self, table: str, params: dict | None = None, **kwargs):
        params = params or {}
        self.deletes.append((table, params))
        return _ok([], status=204)


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
    monkeypatch.setattr(customers_mod, "_ctx", lambda *a, **k: ctx or _ctx())
    monkeypatch.setattr(customers_mod, "require", lambda *a, **k: None)


def test_list_and_create_contact(monkeypatch):
    client = FakeClient()
    _patch_auth(monkeypatch)
    listed = list_contacts(WS, UUID(CUSTOMER), client, {"id": ACTOR})
    assert listed[0].full_name == "דנה כהן"
    created = create_contact(
        WS,
        UUID(CUSTOMER),
        ContactCreate(full_name="יוסי", phone="0511111111"),
        client,
        {"id": ACTOR},
    )
    assert client.posts[0][0] == "customer_contacts"
    assert client.posts[0][1]["workspace_id"] == str(WS)
    assert created.full_name == "יוסי"


def test_patch_contact_updates_supplied_fields_only(monkeypatch):
    client = FakeClient()
    _patch_auth(monkeypatch)
    row = patch_contact(
        WS,
        UUID(CUSTOMER),
        UUID(CONTACT),
        ContactPatch(phone="0522222222"),
        client,
        {"id": ACTOR},
    )
    assert client.patches[0][1] == {"phone": "0522222222"}
    assert "full_name" not in client.patches[0][1]
    assert row.phone == "0522222222"


def test_patch_empty_rejected(monkeypatch):
    client = FakeClient()
    _patch_auth(monkeypatch)
    with pytest.raises(ApiError) as err:
        patch_contact(WS, UUID(CUSTOMER), UUID(CONTACT), ContactPatch(), client, {"id": ACTOR})
    assert err.value.status_code == 400


def test_patch_missing_contact_is_404(monkeypatch):
    client = FakeClient()
    _patch_auth(monkeypatch)
    with pytest.raises(ApiError) as err:
        patch_contact(WS, UUID(CUSTOMER), UUID(OTHER_CONTACT), ContactPatch(full_name="אחר"), client, {"id": ACTOR})
    assert err.value.status_code == 404


def test_patch_wrong_workspace_is_404(monkeypatch):
    client = FakeClient()
    _patch_auth(monkeypatch)
    with pytest.raises(ApiError) as err:
        patch_contact(OTHER_WS, UUID(CUSTOMER), UUID(CONTACT), ContactPatch(full_name="אחר"), client, {"id": ACTOR})
    assert err.value.status_code == 404


def test_patch_forbidden_for_viewer(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(customers_mod, "_ctx", lambda *a, **k: _ctx("viewer"))
    with pytest.raises(ApiError) as err:
        patch_contact(WS, UUID(CUSTOMER), UUID(CONTACT), ContactPatch(phone="050"), client, {"id": ACTOR})
    assert err.value.status_code == 403
    assert client.patches == []


def test_delete_contact(monkeypatch):
    client = FakeClient()
    svc = FakeClient()
    _patch_auth(monkeypatch)
    out = delete_contact(WS, UUID(CUSTOMER), UUID(CONTACT), client, {"id": ACTOR}, svc)
    assert out == {"ok": True}
    assert svc.deletes[0][0] == "customer_contacts"
    assert svc.deletes[0][1]["id"] == f"eq.{CONTACT}"
    assert svc.deletes[0][1]["workspace_id"] == f"eq.{WS}"
    assert client.deletes == []


def test_delete_forbidden_without_crm_delete(monkeypatch):
    client = FakeClient()
    svc = FakeClient()
    monkeypatch.setattr(customers_mod, "_ctx", lambda *a, **k: _ctx("sales"))
    with pytest.raises(ApiError) as err:
        delete_contact(WS, UUID(CUSTOMER), UUID(CONTACT), client, {"id": ACTOR}, svc)
    assert err.value.status_code == 403
    assert svc.deletes == []


def test_delete_missing_is_404(monkeypatch):
    client = FakeClient()
    svc = FakeClient()
    _patch_auth(monkeypatch)
    with pytest.raises(ApiError) as err:
        delete_contact(WS, UUID(CUSTOMER), UUID(OTHER_CONTACT), client, {"id": ACTOR}, svc)
    assert err.value.status_code == 404
    assert svc.deletes == []
