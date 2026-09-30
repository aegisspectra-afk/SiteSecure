"""Unit tests for reversible platform user soft-archive."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.errors import ApiError
from app.user_archive import (
    assert_archive_allowed,
    profile_lifecycle_status,
    raise_if_archived_profile,
    raise_if_email_archived,
)


def test_lifecycle_status_from_archived_at():
    assert profile_lifecycle_status({}) == "active"
    assert profile_lifecycle_status({"archived_at": None}) == "active"
    assert profile_lifecycle_status({"archived_at": "2026-01-01T00:00:00Z"}) == "archived"


def test_raise_if_archived_profile():
    raise_if_archived_profile({"archived_at": None})
    with pytest.raises(ApiError) as exc:
        raise_if_archived_profile({"archived_at": "2026-01-01T00:00:00Z"})
    assert exc.value.code == "ACCOUNT_INACTIVE"
    assert exc.value.status_code == 403


def test_raise_if_email_archived_blocks():
    svc = MagicMock()
    svc.get.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [{"id": "u1", "email": "a@b.com", "archived_at": "2026-01-01T00:00:00Z"}],
    )
    with pytest.raises(ApiError) as exc:
        raise_if_email_archived(svc, "a@b.com")
    assert exc.value.code == "USER_ARCHIVED"


def test_raise_if_email_archived_allows_active():
    svc = MagicMock()
    svc.get.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [{"id": "u1", "email": "a@b.com", "archived_at": None}],
    )
    raise_if_email_archived(svc, "a@b.com")


def test_assert_archive_blocks_self():
    svc = MagicMock()
    with pytest.raises(ApiError) as exc:
        assert_archive_allowed(
            svc,
            actor_user_id="u1",
            target={"id": "u1", "archived_at": None, "is_platform_admin": False},
        )
    assert exc.value.code == "ARCHIVE_SELF"


def test_assert_archive_blocks_last_platform_admin():
    svc = MagicMock()

    def _get(table, params=None):
        if table == "profiles" and params and params.get("is_platform_admin") == "eq.true":
            return SimpleNamespace(status_code=200, json=lambda: [{"id": "admin-only"}])
        return SimpleNamespace(status_code=200, json=lambda: [])

    svc.get.side_effect = _get
    with pytest.raises(ApiError) as exc:
        assert_archive_allowed(
            svc,
            actor_user_id="other",
            target={"id": "admin-only", "archived_at": None, "is_platform_admin": True},
        )
    assert exc.value.code == "ARCHIVE_LAST_ADMIN"


def test_assert_archive_allows_sole_owner_precheck():
    """Sole-owner orphan is handled by suspending workspaces in archive_platform_user, not blocked here."""
    svc = MagicMock()

    def _get(table, params=None):
        if table == "workspace_memberships" and params and "user_id" in (params or {}):
            return SimpleNamespace(
                status_code=200,
                json=lambda: [
                    {
                        "id": "m1",
                        "user_id": "owner-1",
                        "workspace_id": "ws-1",
                        "role_key": "owner",
                        "status": "active",
                        "workspaces": {"id": "ws-1", "name": "Acme", "status": "active"},
                    }
                ],
            )
        return SimpleNamespace(status_code=200, json=lambda: [])

    svc.get.side_effect = _get
    memberships = assert_archive_allowed(
        svc,
        actor_user_id="admin",
        target={"id": "owner-1", "archived_at": None, "is_platform_admin": False},
    )
    assert len(memberships) == 1


def test_archive_suspends_sole_owner_workspaces():
    from app.user_archive import archive_platform_user

    svc = MagicMock()
    memberships_payload = [
        {
            "id": "m1",
            "user_id": "owner-1",
            "workspace_id": "ws-1",
            "role_key": "owner",
            "status": "active",
            "workspaces": {"id": "ws-1", "name": "Acme", "status": "active"},
        }
    ]

    def _get(table, params=None):
        if table == "profiles" and params and params.get("id") == "eq.owner-1":
            return SimpleNamespace(
                status_code=200,
                json=lambda: [
                    {
                        "id": "owner-1",
                        "email": "o@x.com",
                        "full_name": "Owner",
                        "is_platform_admin": False,
                        "recognition_badges": [],
                        "created_at": "2026-01-01T00:00:00Z",
                        "archived_at": None,
                        "archived_by": None,
                        "archive_reason": None,
                    }
                ],
            )
        if table == "workspace_memberships" and params and params.get("role_key") == "eq.owner":
            return SimpleNamespace(status_code=200, json=lambda: [{"user_id": "owner-1"}])
        if table == "workspace_memberships":
            return SimpleNamespace(status_code=200, json=lambda: memberships_payload)
        return SimpleNamespace(status_code=200, json=lambda: [])

    svc.get.side_effect = _get

    def _patch(table, body, params=None):
        if table == "workspaces":
            return SimpleNamespace(
                status_code=200,
                json=lambda: [{"id": "ws-1", "name": "Acme", "status": "suspended"}],
            )
        if table == "profiles":
            return SimpleNamespace(
                status_code=200,
                json=lambda: [
                    {
                        "id": "owner-1",
                        "email": "o@x.com",
                        "full_name": "Owner",
                        "is_platform_admin": False,
                        "recognition_badges": [],
                        "created_at": "2026-01-01T00:00:00Z",
                        "archived_at": "2026-09-30T12:00:00Z",
                        "archived_by": "admin-1",
                        "archive_reason": "cleanup",
                    }
                ],
            )
        return SimpleNamespace(status_code=200, json=lambda: [])

    svc.patch.side_effect = _patch
    svc.auth_admin_update_user.return_value = SimpleNamespace(status_code=200, text="")
    svc.auth_admin_logout_user.return_value = SimpleNamespace(status_code=200, text="")

    with patch("app.platform.write_platform_admin_event"):
        archived = archive_platform_user(
            svc, actor_user_id="admin-1", target_id="owner-1", reason="cleanup"
        )
    assert archived["lifecycle_status"] == "archived"
    assert archived["suspended_workspaces"]
    assert archived["suspended_workspaces"][0]["workspace_id"] == "ws-1"
    ws_patches = [c for c in svc.patch.call_args_list if c[0][0] == "workspaces"]
    assert ws_patches
    assert ws_patches[0][0][1]["status"] == "suspended"


def test_current_user_rejects_archived(monkeypatch):
    from app import deps
    from app.errors import ApiError

    client = MagicMock()
    client.get_user.return_value = {"id": "u-arch"}
    client.get.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [{"archived_at": "2026-09-30T00:00:00Z"}],
    )
    with pytest.raises(ApiError) as exc:
        deps.current_user(client)
    assert exc.value.code == "ACCOUNT_INACTIVE"


def test_archive_and_restore_roundtrip_mock():
    from app.user_archive import archive_platform_user, restore_platform_user

    svc = MagicMock()
    memberships_payload = [
        {
            "id": "m1",
            "user_id": "tech-1",
            "workspace_id": "ws-1",
            "role_key": "technician",
            "status": "active",
            "workspaces": {"id": "ws-1", "name": "Shop", "status": "active"},
        }
    ]

    def _get(table, params=None):
        if table == "profiles" and params and params.get("id") == "eq.tech-1":
            return SimpleNamespace(
                status_code=200,
                json=lambda: [
                    {
                        "id": "tech-1",
                        "email": "t@x.com",
                        "full_name": "Tech",
                        "is_platform_admin": False,
                        "recognition_badges": [],
                        "created_at": "2026-01-01T00:00:00Z",
                        "archived_at": None,
                        "archived_by": None,
                        "archive_reason": None,
                    }
                ],
            )
        if table == "workspace_memberships":
            return SimpleNamespace(status_code=200, json=lambda: memberships_payload)
        return SimpleNamespace(status_code=200, json=lambda: [])

    svc.get.side_effect = _get
    svc.patch.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [
            {
                "id": "tech-1",
                "email": "t@x.com",
                "full_name": "Tech",
                "is_platform_admin": False,
                "recognition_badges": [],
                "created_at": "2026-01-01T00:00:00Z",
                "archived_at": "2026-09-30T12:00:00Z",
                "archived_by": "admin-1",
                "archive_reason": "left",
            }
        ],
    )
    svc.auth_admin_update_user.return_value = SimpleNamespace(status_code=200, text="")
    svc.auth_admin_logout_user.return_value = SimpleNamespace(status_code=200, text="")

    with patch("app.platform.write_platform_admin_event"):
        archived = archive_platform_user(
            svc, actor_user_id="admin-1", target_id="tech-1", reason="left"
        )
    assert archived["lifecycle_status"] == "archived"
    assert svc.auth_admin_update_user.called
    ban_body = svc.auth_admin_update_user.call_args[0][1]
    assert ban_body["ban_duration"] != "none"

    def _get_archived(table, params=None):
        if table == "profiles" and params and params.get("id") == "eq.tech-1":
            return SimpleNamespace(
                status_code=200,
                json=lambda: [
                    {
                        "id": "tech-1",
                        "email": "t@x.com",
                        "full_name": "Tech",
                        "is_platform_admin": False,
                        "recognition_badges": [],
                        "created_at": "2026-01-01T00:00:00Z",
                        "archived_at": "2026-09-30T12:00:00Z",
                        "archived_by": "admin-1",
                        "archive_reason": "left",
                    }
                ],
            )
        if table == "workspace_memberships":
            return SimpleNamespace(status_code=200, json=lambda: memberships_payload)
        return SimpleNamespace(status_code=200, json=lambda: [])

    svc.get.side_effect = _get_archived
    svc.patch.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [
            {
                "id": "tech-1",
                "email": "t@x.com",
                "full_name": "Tech",
                "is_platform_admin": False,
                "recognition_badges": [],
                "created_at": "2026-01-01T00:00:00Z",
                "archived_at": None,
                "archived_by": None,
                "archive_reason": None,
            }
        ],
    )
    with patch("app.platform.write_platform_admin_event"):
        restored = restore_platform_user(svc, actor_user_id="admin-1", target_id="tech-1")
    assert restored["lifecycle_status"] == "active"
    unban = [c for c in svc.auth_admin_update_user.call_args_list if c[0][1].get("ban_duration") == "none"]
    assert unban
