"""Admin workspace product overrides — Platform Admin only (mocked)."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.deps import current_user, service_client
from app.errors import ApiError
from app.main import app

WS = "11111111-1111-1111-1111-111111111111"
SOLO_ELIGIBLE = frozenset({"core", "crm", "quotes", "fleet", "ssp", "settings"})


@pytest.fixture
def api():
    return TestClient(app)


def _ok_res(payload=None, status=200):
    m = MagicMock()
    m.status_code = status
    m.json.return_value = payload if payload is not None else []
    return m


def _workspace_row(plan_key: str = "solo"):
    return {
        "id": WS,
        "name": "Demo",
        "status": "active",
        "subscriptions": {"plan_key": plan_key, "status": "active"},
    }


def _patch_admin_ok(monkeypatch):
    monkeypatch.setattr("app.routers.admin.require_platform_admin", lambda *_a, **_k: None)


def test_non_platform_admin_denied_list_and_put(api, monkeypatch):
    def _deny(_svc, _uid):
        raise ApiError(403, "PERMISSION_DENIED", "אין הרשאה לפעולה זו")

    monkeypatch.setattr("app.routers.admin.require_platform_admin", _deny)
    app.dependency_overrides[current_user] = lambda: {"id": "u-owner", "email": "o@x.com"}
    app.dependency_overrides[service_client] = lambda: MagicMock()
    try:
        listed = api.get(f"/api/v1/admin/workspaces/{WS}/products", headers={"Authorization": "Bearer t"})
        assert listed.status_code == 403
        put = api.put(
            f"/api/v1/admin/workspaces/{WS}/products/overrides",
            headers={"Authorization": "Bearer t"},
            json={"feature_key": "fleet", "enabled": True},
        )
        assert put.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_platform_admin_can_list_products(api, monkeypatch):
    _patch_admin_ok(monkeypatch)
    monkeypatch.setattr(
        "app.routers.admin._workspace_plan_key",
        lambda *_a, **_k: (_workspace_row(), "solo"),
    )
    monkeypatch.setattr(
        "app.routers.workspace_products.fetch_plan_feature_keys",
        lambda *_a, **_k: SOLO_ELIGIBLE,
    )
    monkeypatch.setattr(
        "app.routers.workspace_products._load_overrides",
        lambda *_a, **_k: {"fleet": False, "ssp": False},
    )
    app.dependency_overrides[current_user] = lambda: {"id": "u-pa", "email": "pa@x.com"}
    app.dependency_overrides[service_client] = lambda: MagicMock()
    try:
        res = api.get(f"/api/v1/admin/workspaces/{WS}/products", headers={"Authorization": "Bearer t"})
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["plan_key"] == "solo"
        fleet = next(p for p in body["products"] if p["feature_key"] == "fleet")
        assert fleet["eligible"] is True
        assert fleet["enabled"] is False
    finally:
        app.dependency_overrides.clear()


def test_platform_admin_can_enable_eligible_product(api, monkeypatch):
    calls: list[tuple[str, bool]] = []
    audit: list[dict] = []

    _patch_admin_ok(monkeypatch)
    monkeypatch.setattr(
        "app.routers.admin._workspace_plan_key",
        lambda *_a, **_k: (_workspace_row(), "solo"),
    )
    monkeypatch.setattr(
        "app.routers.workspace_products.fetch_plan_feature_keys",
        lambda *_a, **_k: SOLO_ELIGIBLE,
    )
    monkeypatch.setattr(
        "app.routers.workspace_products._upsert_override_merge",
        lambda _svc, _ws, key, enabled: calls.append((key, enabled)),
    )
    monkeypatch.setattr(
        "app.routers.workspace_products._load_overrides",
        lambda *_a, **_k: {"fleet": True},
    )

    def _audit(service, **kwargs):
        audit.append(kwargs)

    monkeypatch.setattr("app.routers.admin.write_platform_admin_event", _audit)

    app.dependency_overrides[current_user] = lambda: {"id": "u-pa", "email": "pa@x.com"}
    app.dependency_overrides[service_client] = lambda: MagicMock()
    try:
        res = api.put(
            f"/api/v1/admin/workspaces/{WS}/products/overrides",
            headers={"Authorization": "Bearer t"},
            json={"feature_key": "fleet", "enabled": True},
        )
        assert res.status_code == 200, res.text
        assert calls == [("fleet", True)]
        fleet = next(p for p in res.json()["products"] if p["feature_key"] == "fleet")
        assert fleet["enabled"] is True
        assert len(audit) == 1
        assert audit[0]["action"] == "workspace_product_override"
        assert audit[0]["target_workspace_id"] == WS
        assert audit[0]["metadata"]["feature_key"] == "fleet"
        assert audit[0]["metadata"]["enabled"] is True
        assert audit[0]["strict"] is True
    finally:
        app.dependency_overrides.clear()


def test_platform_admin_cannot_enable_product_not_in_plan(api, monkeypatch):
    _patch_admin_ok(monkeypatch)
    monkeypatch.setattr(
        "app.routers.admin._workspace_plan_key",
        lambda *_a, **_k: (_workspace_row(), "solo"),
    )
    monkeypatch.setattr(
        "app.routers.workspace_products.fetch_plan_feature_keys",
        lambda *_a, **_k: frozenset({"core", "quotes", "fleet", "ssp"}),
    )
    upsert = MagicMock()
    monkeypatch.setattr("app.routers.workspace_products._upsert_override_merge", upsert)
    app.dependency_overrides[current_user] = lambda: {"id": "u-pa", "email": "pa@x.com"}
    app.dependency_overrides[service_client] = lambda: MagicMock()
    try:
        res = api.put(
            f"/api/v1/admin/workspaces/{WS}/products/overrides",
            headers={"Authorization": "Bearer t"},
            json={"feature_key": "inventory", "enabled": True},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "FEATURE_NOT_INCLUDED"
        upsert.assert_not_called()
    finally:
        app.dependency_overrides.clear()


def test_platform_admin_cannot_enable_when_db_plan_diverges(api, monkeypatch):
    _patch_admin_ok(monkeypatch)
    monkeypatch.setattr(
        "app.routers.admin._workspace_plan_key",
        lambda *_a, **_k: (_workspace_row(), "solo"),
    )
    # Catalog may include fleet; DB plan_features does not.
    monkeypatch.setattr(
        "app.routers.workspace_products.fetch_plan_feature_keys",
        lambda *_a, **_k: frozenset({"core", "quotes"}),
    )
    upsert = MagicMock()
    monkeypatch.setattr("app.routers.workspace_products._upsert_override_merge", upsert)
    app.dependency_overrides[current_user] = lambda: {"id": "u-pa", "email": "pa@x.com"}
    app.dependency_overrides[service_client] = lambda: MagicMock()
    try:
        res = api.put(
            f"/api/v1/admin/workspaces/{WS}/products/overrides",
            headers={"Authorization": "Bearer t"},
            json={"feature_key": "fleet", "enabled": True},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "FEATURE_NOT_INCLUDED"
        upsert.assert_not_called()
    finally:
        app.dependency_overrides.clear()


def test_audit_failure_does_not_report_success(api, monkeypatch):
    _patch_admin_ok(monkeypatch)
    monkeypatch.setattr(
        "app.routers.admin._workspace_plan_key",
        lambda *_a, **_k: (_workspace_row(), "solo"),
    )
    monkeypatch.setattr(
        "app.routers.workspace_products.fetch_plan_feature_keys",
        lambda *_a, **_k: SOLO_ELIGIBLE,
    )
    monkeypatch.setattr(
        "app.routers.workspace_products._upsert_override_merge",
        lambda *_a, **_k: None,
    )

    def _audit_fail(*_a, **_k):
        raise ApiError(503, "API_UNAVAILABLE", "השירות אינו זמין")

    monkeypatch.setattr("app.routers.admin.write_platform_admin_event", _audit_fail)
    app.dependency_overrides[current_user] = lambda: {"id": "u-pa", "email": "pa@x.com"}
    app.dependency_overrides[service_client] = lambda: MagicMock()
    try:
        res = api.put(
            f"/api/v1/admin/workspaces/{WS}/products/overrides",
            headers={"Authorization": "Bearer t"},
            json={"feature_key": "fleet", "enabled": True},
        )
        assert res.status_code == 503
    finally:
        app.dependency_overrides.clear()
