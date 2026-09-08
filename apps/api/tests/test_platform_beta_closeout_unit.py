from app.platform import PLATFORM_SUPER_ADMIN, platform_role_for
from app.routers.admin import _apply_beta_timestamps


def test_platform_role_mapping():
    assert platform_role_for(True) == PLATFORM_SUPER_ADMIN
    assert platform_role_for(False) is None


def test_beta_timestamps_active_sets_joined():
    patch = _apply_beta_timestamps(None, "active")
    assert patch["status"] == "active"
    assert "activated_at" in patch
    assert "joined_at" in patch


def test_beta_timestamps_paused_sets_paused_at():
    patch = _apply_beta_timestamps({"status": "active", "joined_at": "2026-01-01"}, "paused")
    assert patch["status"] == "paused"
    assert "paused_at" in patch
    assert "joined_at" not in patch
