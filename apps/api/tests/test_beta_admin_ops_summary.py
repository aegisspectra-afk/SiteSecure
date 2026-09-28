"""BETA-ADMIN-3 — Founding Beta ops summary shape (unit, mocked service)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app import deps


def _auth(token: str = "admin-token") -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_admin_summary_ops_payload_and_attention():
    now = datetime.now(timezone.utc)
    ws_id = str(uuid4())
    invite_id = str(uuid4())
    fb_id = str(uuid4())

    def fake_get(table: str, params=None):
        params = params or {}
        select = str(params.get("select") or "")
        if table == "profiles" and "is_platform_admin" in select:
            return SimpleNamespace(
                status_code=200,
                json=lambda: [{"id": "admin-1", "is_platform_admin": True}],
            )
        if table == "workspaces":
            return SimpleNamespace(
                status_code=200,
                json=lambda: [
                    {
                        "id": ws_id,
                        "name": "Beta WS",
                        "status": "active",
                        "is_beta": True,
                        "beta_program": "early",
                        "created_at": (now - timedelta(days=3)).isoformat(),
                    }
                ],
            )
        if table == "profiles":
            return SimpleNamespace(
                status_code=200,
                json=lambda: [
                    {
                        "id": str(uuid4()),
                        "recognition_badges": ["founding_technician"],
                        "created_at": now.isoformat(),
                    }
                ],
            )
        if table == "feedback_reports":
            return SimpleNamespace(
                status_code=200,
                json=lambda: [
                    {
                        "id": fb_id,
                        "ticket_id": "FB-1",
                        "title": "Critical stuck",
                        "severity": "high",
                        "status": "new",
                        "is_beta": True,
                        "workspace_id": ws_id,
                        "created_at": now.isoformat(),
                    }
                ],
            )
        if table == "beta_participants":
            return SimpleNamespace(status_code=200, json=lambda: [{"id": "p1", "status": "active", "user_id": "u1"}])
        if table == "invitations":
            return SimpleNamespace(
                status_code=200,
                json=lambda: [
                    {
                        "id": invite_id,
                        "workspace_id": ws_id,
                        "email": "owner@example.com",
                        "role_key": "owner",
                        "expires_at": (now + timedelta(days=7)).isoformat(),
                        "accepted_at": None,
                        "revoked_at": None,
                        "created_at": (now - timedelta(hours=30)).isoformat(),
                        "workspaces": {"name": "Beta WS"},
                    }
                ],
            )
        if table == "workspace_memberships":
            return SimpleNamespace(status_code=200, json=lambda: [])
        if table == "platform_admin_events":
            return SimpleNamespace(
                status_code=200,
                json=lambda: [
                    {
                        "id": str(uuid4()),
                        "actor_user_id": "admin-1",
                        "action": "workspace.provisioned",
                        "target_user_id": None,
                        "target_workspace_id": ws_id,
                        "metadata": {"name": "Beta WS"},
                        "created_at": now.isoformat(),
                    }
                ],
            )
        return SimpleNamespace(status_code=200, json=lambda: [])

    svc = MagicMock()
    svc.get.side_effect = fake_get

    class FakeUser:
        def get(self, path: str, **kwargs):
            return SimpleNamespace(status_code=200, json=lambda: {"id": "admin-1", "email": "a@b.com"})

    app.dependency_overrides[deps.bearer_token] = lambda: "admin-token"
    app.dependency_overrides[deps.current_user] = lambda: {"id": "admin-1", "email": "a@b.com"}
    app.dependency_overrides[deps.service_client] = lambda: svc
    app.dependency_overrides[deps.user_client] = lambda: FakeUser()
    try:
        client = TestClient(app)
        res = client.get("/api/v1/admin/summary", headers=_auth())
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["beta_workspaces_active"] == 1
        assert body["founding_technicians"] == 1
        assert body["invites_pending"] == 1
        assert body["feedback_open"] == 1
        assert body["funnel"]["owner_pending"] == 1
        assert body["system"]["backup_status"] == "unavailable"
        assert body["system"]["auth_status"] == "unknown"
        assert body["system"]["api_ok"] is True
        kinds = {item["kind"] for item in body["attention"]}
        assert "owner_invite_stale" in kinds
        assert "workspace_no_members" in kinds
        assert "feedback_high" in kinds
        assert len(body["pending_invites"]) == 1
        assert "token" not in body["pending_invites"][0]
        assert len(body["recent_activity"]) >= 1
    finally:
        app.dependency_overrides.clear()
