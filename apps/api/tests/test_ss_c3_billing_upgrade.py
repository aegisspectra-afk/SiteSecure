"""C3 — beta billing upgrade request intake (mocked)."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.authz.engine import Decision
from app.authz.types import AuthzContext
from app.deps import current_user, user_client
from app.main import app

WS = "44444444-4444-4444-4444-444444444444"


@pytest.fixture
def api():
    return TestClient(app)


def test_owner_can_create_upgrade_request(api, monkeypatch):
    created: list[dict] = []

    def _ctx(*_a, **_k):
        return AuthzContext(
            user_id="u-owner",
            workspace_id=WS,
            role_key="owner",
            workspace_status="active",
            plan_key="free",
            subscription_status="active",
            features=frozenset({"core"}),
            grants=frozenset({"workspace.billing"}),
        )

    def _authz(ctx, action):
        if action == "workspace.billing":
            return Decision(True)
        return Decision(False, "PERMISSION_DENIED")

    monkeypatch.setattr("app.routers.billing.load_authz_context", _ctx)
    monkeypatch.setattr("app.routers.billing.authorize", _authz)

    client = MagicMock()

    def _post(table, payload):
        created.append(payload)
        m = MagicMock()
        m.status_code = 201
        m.json.return_value = [{**payload, "id": "req-1", "status": "pending", "created_at": "2026-01-01T00:00:00Z"}]
        return m

    client.post.side_effect = _post

    app.dependency_overrides[current_user] = lambda: {"id": "u-owner", "email": "o@x.com"}
    app.dependency_overrides[user_client] = lambda: client
    try:
        res = api.post(
            f"/api/v1/workspaces/{WS}/billing/upgrade-requests",
            headers={"Authorization": "Bearer t"},
            json={"message": "רוצים Pro"},
        )
        assert res.status_code == 200, res.text
        assert created and created[0]["workspace_id"] == WS
        assert created[0]["current_plan_key"] == "free"
        assert created[0]["message"] == "רוצים Pro"
    finally:
        app.dependency_overrides.clear()


def test_non_billing_role_denied(api, monkeypatch):
    def _ctx(*_a, **_k):
        return AuthzContext(
            user_id="u-view",
            workspace_id=WS,
            role_key="viewer",
            workspace_status="active",
            plan_key="free",
            subscription_status="active",
            features=frozenset({"core"}),
            grants=frozenset(),
        )

    def _authz(ctx, action):
        return Decision(False, "PERMISSION_DENIED")

    monkeypatch.setattr("app.routers.billing.load_authz_context", _ctx)
    monkeypatch.setattr("app.routers.billing.authorize", _authz)

    app.dependency_overrides[current_user] = lambda: {"id": "u-view", "email": "v@x.com"}
    app.dependency_overrides[user_client] = lambda: MagicMock()
    try:
        res = api.post(
            f"/api/v1/workspaces/{WS}/billing/upgrade-requests",
            headers={"Authorization": "Bearer t"},
            json={},
        )
        assert res.status_code == 403
    finally:
        app.dependency_overrides.clear()