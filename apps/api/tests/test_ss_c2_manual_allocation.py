"""C2 — platform-admin manual subscription allocation (mocked)."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.deps import current_user, service_client
from app.errors import ApiError
from app.main import app

WS = "22222222-2222-2222-2222-222222222222"
SUB_ID = "33333333-3333-3333-3333-333333333333"


@pytest.fixture
def api():
    return TestClient(app)


def _patch_admin_ok(monkeypatch):
    monkeypatch.setattr("app.routers.admin.require_platform_admin", lambda *_a, **_k: None)


def test_non_platform_admin_denied_subscription_patch(api, monkeypatch):
    def _deny(_svc, _uid):
        raise ApiError(403, "PERMISSION_DENIED", "אין הרשאה לפעולה זו")

    monkeypatch.setattr("app.routers.admin.require_platform_admin", _deny)
    app.dependency_overrides[current_user] = lambda: {"id": "u1", "email": "x@y.com"}
    app.dependency_overrides[service_client] = lambda: MagicMock()
    try:
        res = api.patch(
            f"/api/v1/admin/organizations/{WS}/subscription",
            headers={"Authorization": "Bearer t"},
            json={"plan_key": "pro"},
        )
        assert res.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_platform_admin_patch_writes_subscription_and_audit(api, monkeypatch):
    patches: list[dict] = []
    logs: list[dict] = []
    events: list[dict] = []

    _patch_admin_ok(monkeypatch)
    svc = MagicMock()

    def _get(table, params=None):
        m = MagicMock()
        m.status_code = 200
        if table == "workspaces":
            m.json.return_value = [{"id": WS, "name": "Acme", "status": "active"}]
        elif table == "subscriptions":
            m.json.return_value = [
                {
                    "id": SUB_ID,
                    "workspace_id": WS,
                    "plan_key": "free",
                    "status": "active",
                    "source": "system",
                    "override_expires_at": None,
                    "override_reason": None,
                    "current_period_end": None,
                }
            ]
        elif table == "subscription_allocation_log":
            m.json.return_value = []
        else:
            m.json.return_value = []
        return m

    def _patch(table, payload, params=None):
        patches.append({"table": table, "payload": payload, "params": params})
        m = MagicMock()
        m.status_code = 200
        m.json.return_value = [
            {
                **payload,
                "id": SUB_ID,
                "workspace_id": WS,
                "plan_key": payload.get("plan_key", "free"),
                "status": payload.get("status", "active"),
            }
        ]
        return m

    def _post(table, payload):
        logs.append({"table": table, "payload": payload})
        m = MagicMock()
        m.status_code = 201
        m.json.return_value = [{**payload, "id": "log-1"}]
        return m

    svc.get.side_effect = _get
    svc.patch.side_effect = _patch
    svc.post.side_effect = _post

    monkeypatch.setattr(
        "app.routers.admin.write_platform_admin_event",
        lambda *_a, **kwargs: events.append(kwargs),
    )

    app.dependency_overrides[current_user] = lambda: {"id": "admin-1", "email": "pa@x.com"}
    app.dependency_overrides[service_client] = lambda: svc
    try:
        res = api.patch(
            f"/api/v1/admin/organizations/{WS}/subscription",
            headers={"Authorization": "Bearer t"},
            json={"plan_key": "pro", "note": "בטא פיילוט"},
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["subscription"]["plan_key"] == "pro"
        assert any(p["table"] == "subscriptions" and p["payload"].get("source") == "admin_override" for p in patches)
        assert logs and logs[0]["table"] == "subscription_allocation_log"
        assert events and events[0].get("action") == "subscription_allocation_updated"
    finally:
        app.dependency_overrides.clear()