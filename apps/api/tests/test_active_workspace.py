"""API: active workspace switching (mocked, no live DB)."""

from __future__ import annotations

from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.deps import current_user, user_client
from app.main import app


class _Res:
    def __init__(self, status_code: int, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


def test_set_active_workspace_requires_membership():
    client = MagicMock()
    client.get.return_value = _Res(200, [])
    app.dependency_overrides[current_user] = lambda: {"id": "u1", "email": "a@b.com"}
    app.dependency_overrides[user_client] = lambda: client
    api = TestClient(app)
    try:
        res = api.put(
            "/api/v1/me/active-workspace",
            headers={"Authorization": "Bearer t"},
            json={"workspace_id": "ws-missing"},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "PERMISSION_DENIED"
    finally:
        app.dependency_overrides.clear()


def test_set_active_workspace_rejects_inactive_tenant():
    client = MagicMock()
    client.get.return_value = _Res(
        200,
        [{"workspace_id": "ws-1", "workspaces": {"id": "ws-1", "status": "suspended"}}],
    )
    app.dependency_overrides[current_user] = lambda: {"id": "u1", "email": "a@b.com"}
    app.dependency_overrides[user_client] = lambda: client
    api = TestClient(app)
    try:
        res = api.put(
            "/api/v1/me/active-workspace",
            headers={"Authorization": "Bearer t"},
            json={"workspace_id": "ws-1"},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "TENANT_INACTIVE"
    finally:
        app.dependency_overrides.clear()


def test_set_active_workspace_persists_preference():
    client = MagicMock()
    client.get.return_value = _Res(
        200,
        [{"workspace_id": "ws-2", "workspaces": {"id": "ws-2", "status": "active"}}],
    )
    client.patch.return_value = _Res(200, [{"id": "u1", "last_workspace_id": "ws-2"}])
    app.dependency_overrides[current_user] = lambda: {"id": "u1", "email": "a@b.com"}
    app.dependency_overrides[user_client] = lambda: client
    api = TestClient(app)
    try:
        res = api.put(
            "/api/v1/me/active-workspace",
            headers={"Authorization": "Bearer t"},
            json={"workspace_id": "ws-2"},
        )
        assert res.status_code == 200, res.text
        assert res.json()["workspace_id"] == "ws-2"
        assert res.json()["last_workspace_id"] == "ws-2"
        client.patch.assert_called()
        args, kwargs = client.patch.call_args
        assert args[0] == "profiles"
        assert args[1] == {"last_workspace_id": "ws-2"}
    finally:
        app.dependency_overrides.clear()


def test_session_sort_ignores_stale_last_workspace():
    """Invalid last_workspace_id must not invent memberships; [0] stays a real membership."""
    client = MagicMock()

    def _get(table, params=None):
        if table == "profiles":
            return _Res(
                200,
                [
                    {
                        "id": "u1",
                        "full_name": "A",
                        "phone": None,
                        "locale": "he",
                        "last_workspace_id": "ws-gone",
                        "recognition_badges": [],
                        "is_platform_admin": False,
                    }
                ],
            )
        if table == "workspace_memberships":
            return _Res(
                200,
                [
                    {
                        "workspace_id": "ws-a",
                        "role_key": "technician",
                        "workspace_role_key": "technician",
                        "technician_code": None,
                        "program_type": None,
                        "workspaces": {
                            "id": "ws-a",
                            "name": "A",
                            "status": "active",
                            "is_beta": False,
                            "beta_program": None,
                        },
                    },
                    {
                        "workspace_id": "ws-b",
                        "role_key": "owner",
                        "workspace_role_key": "owner",
                        "technician_code": None,
                        "program_type": None,
                        "workspaces": {
                            "id": "ws-b",
                            "name": "B",
                            "status": "active",
                            "is_beta": False,
                            "beta_program": None,
                        },
                    },
                ],
            )
        return _Res(404, [])

    client.get.side_effect = _get
    client.rpc.return_value = _Res(200, {"plan_key": "solo", "status": "active", "features": ["core"]})

    app.dependency_overrides[current_user] = lambda: {"id": "u1", "email": "a@b.com"}
    app.dependency_overrides[user_client] = lambda: client
    api = TestClient(app)
    try:
        res = api.get("/api/v1/auth/session", headers={"Authorization": "Bearer t"})
        assert res.status_code == 200, res.text
        body = res.json()
        assert len(body["memberships"]) == 2
        # Prefer invalid id ignored → order remains created_at.desc from API (ws-a then ws-b as mocked).
        assert body["memberships"][0]["workspace_id"] in {"ws-a", "ws-b"}
        assert body["profile"]["last_workspace_id"] in {None, "ws-a", "ws-b"}
        assert body["profile"]["last_workspace_id"] != "ws-gone"
    finally:
        app.dependency_overrides.clear()
