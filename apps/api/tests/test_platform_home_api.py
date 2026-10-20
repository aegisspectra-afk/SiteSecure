"""API: GET /api/v1/platform/home — membership isolation + product filter (mocked)."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.deps import current_user, user_client
from app.main import app

WS_A = "11111111-1111-1111-1111-111111111111"
WS_B = "22222222-2222-2222-2222-222222222222"


@pytest.fixture
def api():
    return TestClient(app)


def _res(payload, status=200):
    m = MagicMock()
    m.status_code = status
    m.json.return_value = payload
    return m


def _client_for(
    *,
    profile: dict,
    memberships: list[dict],
    entitlements_by_ws: dict[str, dict],
    grants: list[str] | None = None,
):
    client = MagicMock()

    def _get(path, params=None):
        if path == "profiles":
            return _res([profile])
        if path == "workspace_memberships":
            return _res(memberships)
        return _res([])

    def _rpc(name, payload=None):
        if name == "my_workspace_entitlements":
            ws = (payload or {}).get("p_workspace_id")
            return _res(entitlements_by_ws.get(ws, {"plan_key": "solo", "status": "active", "features": []}))
        return _res({})

    client.get.side_effect = _get
    client.rpc.side_effect = _rpc
    return client, grants or ["dashboard.view", "crm.view"]


def test_platform_home_filters_products_and_prefers_last_workspace(api, monkeypatch):
    profile = {
        "id": "u1",
        "full_name": "Test",
        "locale": "he",
        "last_workspace_id": WS_B,
        "is_platform_admin": False,
    }
    memberships = [
        {
            "workspace_id": WS_A,
            "role_key": "owner",
            "workspace_role_key": "owner",
            "workspaces": {"id": WS_A, "name": "Alpha", "status": "active"},
        },
        {
            "workspace_id": WS_B,
            "role_key": "technician",
            "workspace_role_key": "technician",
            "workspaces": {"id": WS_B, "name": "Beta", "status": "active"},
        },
    ]
    entitlements = {
        WS_A: {"plan_key": "solo", "status": "active", "features": ["core", "crm", "ssp"]},
        WS_B: {"plan_key": "solo", "status": "active", "features": ["core", "crm"]},
    }
    client, _ = _client_for(profile=profile, memberships=memberships, entitlements_by_ws=entitlements)
    monkeypatch.setattr(
        "app.workspace_rbac.resolve_role_grants",
        lambda *_a, **_k: frozenset({"dashboard.view", "crm.view", "projects.view", "jobs.view", "service.view"}),
    )

    app.dependency_overrides[current_user] = lambda: {"id": "u1", "email": "t@x.com"}
    app.dependency_overrides[user_client] = lambda: client
    try:
        res = api.get("/api/v1/platform/home", headers={"Authorization": "Bearer t"})
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["active_workspace_id"] == WS_B
        assert {w["id"] for w in body["workspaces"]} == {WS_A, WS_B}
        ids = [p["id"] for p in body["products"]]
        assert ids == ["site_secure"]
        assert body["products"][0]["entry_path"] == "/app/today"
        assert body["links"]["platform_admin"] is None
        # Must not leak ssp from the non-active workspace entitlements
        assert "ssp" not in ids
    finally:
        app.dependency_overrides.clear()


def test_platform_home_omits_inactive_workspace(api, monkeypatch):
    profile = {
        "id": "u1",
        "full_name": "Test",
        "locale": "he",
        "last_workspace_id": WS_A,
        "is_platform_admin": False,
    }
    memberships = [
        {
            "workspace_id": WS_A,
            "role_key": "owner",
            "workspace_role_key": "owner",
            "workspaces": {"id": WS_A, "name": "Gone", "status": "suspended"},
        },
    ]
    client, _ = _client_for(
        profile=profile,
        memberships=memberships,
        entitlements_by_ws={WS_A: {"plan_key": "solo", "features": ["core"]}},
    )
    monkeypatch.setattr(
        "app.workspace_rbac.resolve_role_grants",
        lambda *_a, **_k: frozenset({"*"}),
    )
    app.dependency_overrides[current_user] = lambda: {"id": "u1", "email": "t@x.com"}
    app.dependency_overrides[user_client] = lambda: client
    try:
        res = api.get("/api/v1/platform/home", headers={"Authorization": "Bearer t"})
        assert res.status_code == 200
        body = res.json()
        assert body["workspaces"] == []
        assert body["products"] == []
        assert body["active_workspace_id"] is None
    finally:
        app.dependency_overrides.clear()


def test_platform_home_admin_link_only_for_platform_admin(api, monkeypatch):
    profile = {
        "id": "u-pa",
        "full_name": "Admin",
        "locale": "he",
        "last_workspace_id": WS_A,
        "is_platform_admin": True,
    }
    memberships = [
        {
            "workspace_id": WS_A,
            "role_key": "owner",
            "workspace_role_key": "owner",
            "workspaces": {"id": WS_A, "name": "Org", "status": "active"},
        },
    ]
    client, _ = _client_for(
        profile=profile,
        memberships=memberships,
        entitlements_by_ws={WS_A: {"plan_key": "solo", "features": ["core", "crm"]}},
    )
    monkeypatch.setattr(
        "app.workspace_rbac.resolve_role_grants",
        lambda *_a, **_k: frozenset({"*"}),
    )
    app.dependency_overrides[current_user] = lambda: {"id": "u-pa", "email": "pa@x.com"}
    app.dependency_overrides[user_client] = lambda: client
    try:
        res = api.get("/api/v1/platform/home", headers={"Authorization": "Bearer t"})
        assert res.status_code == 200
        assert res.json()["links"]["platform_admin"] == "/admin"
        assert res.json()["user"]["is_platform_admin"] is True
    finally:
        app.dependency_overrides.clear()


def test_platform_home_empty_products(api, monkeypatch):
    profile = {
        "id": "u1",
        "full_name": "Empty",
        "locale": "he",
        "last_workspace_id": WS_A,
        "is_platform_admin": False,
    }
    memberships = [
        {
            "workspace_id": WS_A,
            "role_key": "technician",
            "workspace_role_key": "technician",
            "workspaces": {"id": WS_A, "name": "Org", "status": "active"},
        },
    ]
    client, _ = _client_for(
        profile=profile,
        memberships=memberships,
        entitlements_by_ws={WS_A: {"plan_key": "solo", "features": []}},
    )
    monkeypatch.setattr(
        "app.workspace_rbac.resolve_role_grants",
        lambda *_a, **_k: frozenset({"dashboard.view"}),
    )
    app.dependency_overrides[current_user] = lambda: {"id": "u1", "email": "t@x.com"}
    app.dependency_overrides[user_client] = lambda: client
    try:
        res = api.get("/api/v1/platform/home", headers={"Authorization": "Bearer t"})
        assert res.status_code == 200
        assert res.json()["products"] == []
    finally:
        app.dependency_overrides.clear()
