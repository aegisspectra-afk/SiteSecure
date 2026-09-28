"""BETA-ADMIN-1: platform admin invitations + workspace provision."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.errors import ApiError
from app.main import app
from app.platform import require_platform_admin
from app.routers.admin import _invite_status, _serialize_admin_invite


def test_require_platform_admin_still_uuid_gated():
    svc = MagicMock()
    svc.get.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [{"id": "u1", "is_platform_admin": False}],
    )
    with pytest.raises(ApiError) as exc:
        require_platform_admin(svc, "u1")
    assert exc.value.code == "PERMISSION_DENIED"


def test_invite_status_derivation():
    now = datetime.now(timezone.utc)
    assert _invite_status({"revoked_at": now.isoformat()}) == "revoked"
    assert _invite_status({"accepted_at": now.isoformat()}) == "accepted"
    assert (
        _invite_status({"expires_at": (now - timedelta(hours=1)).isoformat()})
        == "expired"
    )
    assert (
        _invite_status({"expires_at": (now + timedelta(days=7)).isoformat()})
        == "pending"
    )


def test_serialize_admin_invite_includes_token_only_when_provided():
    future = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    row = {
        "id": "inv1",
        "workspace_id": "ws1",
        "email": "a@b.com",
        "role_key": "owner",
        "created_at": "2026-01-01T00:00:00Z",
        "expires_at": future,
        "accepted_at": None,
        "revoked_at": None,
        "invited_by": "u1",
    }
    plain = _serialize_admin_invite(row, workspace_name="Acme")
    assert "token" not in plain
    assert plain["status"] == "pending"
    with_token = _serialize_admin_invite(row, workspace_name="Acme", token="raw-token-value")
    assert with_token["token"] == "raw-token-value"
    assert with_token["invite_path"] == "/invite/raw-token-value"


def test_token_hash_never_equals_plaintext():
    token = secrets.token_urlsafe(32)
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    assert digest != token
    assert len(digest) == 64


def test_non_admin_denied_admin_invitation_routes():
    """Workspace owner JWT cannot hit platform invitation endpoints (mocked authz)."""
    from app import deps

    class FakeUser:
        def get_user(self):
            return {"id": "owner-1", "email": "owner@example.com"}

    svc = MagicMock()
    svc.get.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [{"id": "owner-1", "is_platform_admin": False}],
    )

    app.dependency_overrides[deps.bearer_token] = lambda: "fake"
    app.dependency_overrides[deps.current_user] = lambda: {"id": "owner-1", "email": "owner@example.com"}
    app.dependency_overrides[deps.service_client] = lambda: svc
    app.dependency_overrides[deps.user_client] = lambda: FakeUser()
    try:
        client = TestClient(app)
        for path in (
            "/api/v1/admin/invitations",
            "/api/v1/admin/memberships",
            "/api/v1/admin/summary",
        ):
            res = client.get(path, headers={"Authorization": "Bearer fake"})
            assert res.status_code == 403, (path, res.status_code, res.text)
            assert res.json()["error"]["code"] == "PERMISSION_DENIED"

        res = client.post(
            "/api/v1/admin/organizations",
            headers={"Authorization": "Bearer fake"},
            json={"name": "Should Fail", "plan_key": "business"},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "PERMISSION_DENIED"

        res = client.post(
            "/api/v1/admin/invitations",
            headers={"Authorization": "Bearer fake"},
            json={
                "workspace_id": str(uuid.uuid4()),
                "email": "a@b.com",
                "role_key": "owner",
            },
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "PERMISSION_DENIED"
    finally:
        app.dependency_overrides.clear()


def test_public_peek_rejects_short_token():
    from app import deps

    svc = MagicMock()
    app.dependency_overrides[deps.service_client] = lambda: svc
    try:
        client = TestClient(app)
        res = client.get("/api/v1/invitations/public-peek", params={"token": "short"})
        assert res.status_code == 200
        assert res.json()["status"] == "invalid"
        svc.rpc.assert_not_called()
    finally:
        app.dependency_overrides.clear()


def test_public_peek_maps_revoked():
    from app import deps

    svc = MagicMock()
    svc.rpc.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: {"status": "revoked"},
    )
    app.dependency_overrides[deps.service_client] = lambda: svc
    try:
        client = TestClient(app)
        token = "a" * 32
        res = client.get("/api/v1/invitations/public-peek", params={"token": token})
        assert res.status_code == 200
        assert res.json()["status"] == "revoked"
    finally:
        app.dependency_overrides.clear()
