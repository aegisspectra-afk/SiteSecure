"""Platform-admin authorization uses UUID flag — not email (G-030)."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.errors import ApiError
from app.platform import require_platform_admin


def test_require_platform_admin_allows_flagged_user():
    svc = MagicMock()
    svc.get.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [{"id": "u1", "is_platform_admin": True}],
    )
    require_platform_admin(svc, "u1")
    params = svc.get.call_args.kwargs.get("params") or svc.get.call_args[1]["params"]
    assert params["id"] == "eq.u1"
    assert "email" not in params


def test_require_platform_admin_denies_unflagged_user():
    svc = MagicMock()
    svc.get.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [{"id": "u1", "is_platform_admin": False}],
    )
    with pytest.raises(ApiError) as exc:
        require_platform_admin(svc, "u1")
    assert exc.value.status_code == 403
    assert exc.value.code == "PERMISSION_DENIED"


def test_require_platform_admin_denies_missing_profile():
    svc = MagicMock()
    svc.get.return_value = SimpleNamespace(status_code=200, json=lambda: [])
    with pytest.raises(ApiError) as exc:
        require_platform_admin(svc, "missing")
    assert exc.value.code == "PERMISSION_DENIED"
