"""API: product override endpoints — authz + plan gate (mocked, no live DB)."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.authz.types import AuthzContext
from app.deps import current_user, service_client, user_client
from app.main import app

WS = "11111111-1111-1111-1111-111111111111"
WS_OTHER = "22222222-2222-2222-2222-222222222222"
SOLO_ELIGIBLE = frozenset({"core", "crm", "quotes", "fleet", "ssp", "settings"})


def _owner_ctx(*, features: frozenset[str], plan: str = "solo", workspace_id: str = WS) -> AuthzContext:
    return AuthzContext(
        user_id="u-owner",
        workspace_id=workspace_id,
        role_key="owner",
        workspace_status="active",
        subscription_status="active",
        plan_key=plan,
        features=features,
        grants=frozenset({"*"}),
    )


def _admin_ctx(*, features: frozenset[str]) -> AuthzContext:
    return AuthzContext(
        user_id="u-admin",
        workspace_id=WS,
        role_key="administrator",
        workspace_status="active",
        subscription_status="active",
        plan_key="solo",
        features=features,
        grants=frozenset({"*"}),
    )


def _tech_ctx(*, features: frozenset[str]) -> AuthzContext:
    return AuthzContext(
        user_id="u-tech",
        workspace_id=WS,
        role_key="technician",
        workspace_status="active",
        subscription_status="active",
        plan_key="solo",
        features=features,
        grants=frozenset({"dashboard.view", "settings.view"}),
    )


@pytest.fixture
def api():
    return TestClient(app)


def _patch_plan_eligible(monkeypatch, eligible: frozenset[str] = SOLO_ELIGIBLE):
    monkeypatch.setattr(
        "app.routers.workspace_products.fetch_plan_feature_keys",
        lambda *_a, **_k: eligible,
    )


def test_owner_can_list_products(api, monkeypatch):
    solo_features = frozenset({"core", "quotes"})
    monkeypatch.setattr(
        "app.routers.workspace_products.load_authz_context",
        lambda *a, **k: _owner_ctx(features=solo_features),
    )
    monkeypatch.setattr(
        "app.routers.workspace_products._load_overrides",
        lambda *a, **k: {"fleet": False, "ssp": False},
    )
    _patch_plan_eligible(monkeypatch)
    app.dependency_overrides[current_user] = lambda: {"id": "u-owner", "email": "o@x.com"}
    app.dependency_overrides[user_client] = lambda: MagicMock()
    app.dependency_overrides[service_client] = lambda: MagicMock()
    try:
        res = api.get(f"/api/v1/workspaces/{WS}/products", headers={"Authorization": "Bearer t"})
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["plan_key"] == "solo"
        keys = {p["feature_key"] for p in body["products"]}
        assert "fleet" in keys and "ssp" in keys
        fleet = next(p for p in body["products"] if p["feature_key"] == "fleet")
        assert fleet["eligible"] is True
        assert fleet["enabled"] is False
    finally:
        app.dependency_overrides.clear()


def test_technician_cannot_list_or_override_products(api, monkeypatch):
    monkeypatch.setattr(
        "app.routers.workspace_products.load_authz_context",
        lambda *a, **k: _tech_ctx(features=frozenset({"core"})),
    )
    _patch_plan_eligible(monkeypatch)
    app.dependency_overrides[current_user] = lambda: {"id": "u-tech", "email": "t@x.com"}
    app.dependency_overrides[user_client] = lambda: MagicMock()
    app.dependency_overrides[service_client] = lambda: MagicMock()
    try:
        listed = api.get(f"/api/v1/workspaces/{WS}/products", headers={"Authorization": "Bearer t"})
        assert listed.status_code == 403
        put = api.put(
            f"/api/v1/workspaces/{WS}/products/overrides",
            headers={"Authorization": "Bearer t"},
            json={"feature_key": "fleet", "enabled": True},
        )
        assert put.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_owner_cannot_enable_product_via_workspace_api(api, monkeypatch):
    monkeypatch.setattr(
        "app.routers.workspace_products.load_authz_context",
        lambda *a, **k: _owner_ctx(features=frozenset({"core", "quotes"})),
    )
    app.dependency_overrides[current_user] = lambda: {"id": "u-owner", "email": "o@x.com"}
    app.dependency_overrides[user_client] = lambda: MagicMock()
    app.dependency_overrides[service_client] = lambda: MagicMock()
    try:
        res = api.put(
            f"/api/v1/workspaces/{WS}/products/overrides",
            headers={"Authorization": "Bearer t"},
            json={"feature_key": "fleet", "enabled": True},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "PERMISSION_DENIED"
        assert res.json()["error"]["details"]["reason"] == "product_overrides_platform_admin_only"
    finally:
        app.dependency_overrides.clear()


def test_administrator_cannot_enable_product_via_workspace_api(api, monkeypatch):
    monkeypatch.setattr(
        "app.routers.workspace_products.load_authz_context",
        lambda *a, **k: _admin_ctx(features=frozenset({"core", "quotes"})),
    )
    app.dependency_overrides[current_user] = lambda: {"id": "u-admin", "email": "a@x.com"}
    app.dependency_overrides[user_client] = lambda: MagicMock()
    app.dependency_overrides[service_client] = lambda: MagicMock()
    try:
        res = api.put(
            f"/api/v1/workspaces/{WS}/products/overrides",
            headers={"Authorization": "Bearer t"},
            json={"feature_key": "fleet", "enabled": True},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "PERMISSION_DENIED"
    finally:
        app.dependency_overrides.clear()


def test_workspace_put_rejects_even_when_plan_would_allow(api, monkeypatch):
    """Plan-ineligible checks moved to admin path; workspace PUT always 403 first."""
    monkeypatch.setattr(
        "app.routers.workspace_products.load_authz_context",
        lambda *a, **k: _owner_ctx(features=frozenset({"core"})),
    )
    _patch_plan_eligible(monkeypatch, frozenset({"core", "quotes"}))
    app.dependency_overrides[current_user] = lambda: {"id": "u-owner", "email": "o@x.com"}
    app.dependency_overrides[user_client] = lambda: MagicMock()
    app.dependency_overrides[service_client] = lambda: MagicMock()
    try:
        res = api.put(
            f"/api/v1/workspaces/{WS}/products/overrides",
            headers={"Authorization": "Bearer t"},
            json={"feature_key": "fleet", "enabled": True},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "PERMISSION_DENIED"
    finally:
        app.dependency_overrides.clear()


def test_cross_workspace_uses_path_workspace_in_authz(api, monkeypatch):
    seen: list[str] = []

    def _authz(_client, _uid, workspace_id: str):
        seen.append(workspace_id)
        return _owner_ctx(features=frozenset({"core"}), workspace_id=workspace_id)

    monkeypatch.setattr("app.routers.workspace_products.load_authz_context", _authz)
    monkeypatch.setattr("app.routers.workspace_products._load_overrides", lambda *a, **k: {})
    _patch_plan_eligible(monkeypatch, frozenset({"core"}))
    app.dependency_overrides[current_user] = lambda: {"id": "u-owner", "email": "o@x.com"}
    app.dependency_overrides[user_client] = lambda: MagicMock()
    app.dependency_overrides[service_client] = lambda: MagicMock()
    try:
        res = api.get(f"/api/v1/workspaces/{WS_OTHER}/products", headers={"Authorization": "Bearer t"})
        assert res.status_code == 200
        assert seen == [WS_OTHER]
    finally:
        app.dependency_overrides.clear()
