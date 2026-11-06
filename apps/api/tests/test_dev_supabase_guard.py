"""Dev/test refuses a hosted Supabase target unless explicitly allowed."""

from __future__ import annotations

import pytest

from app.config import ALLOW_REMOTE_SUPABASE_ENV, Settings, assert_dev_supabase_target


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1:54321",
        "http://localhost:54321",
        "http://supabase.local:8000",
        "https://example.supabase.co",
    ],
)
def test_local_and_offline_placeholder_targets_allowed_in_dev(url, monkeypatch):
    monkeypatch.delenv(ALLOW_REMOTE_SUPABASE_ENV, raising=False)
    assert_dev_supabase_target(url, "development")


@pytest.mark.parametrize("app_env", ["development", "dev", "test", "DEVELOPMENT"])
def test_hosted_project_refused_in_dev_envs(app_env, monkeypatch):
    monkeypatch.delenv(ALLOW_REMOTE_SUPABASE_ENV, raising=False)
    with pytest.raises(ValueError, match="Refusing non-local SUPABASE_URL"):
        assert_dev_supabase_target("https://abcdefghijklmnop.supabase.co", app_env)


def test_empty_url_refused_in_dev(monkeypatch):
    monkeypatch.delenv(ALLOW_REMOTE_SUPABASE_ENV, raising=False)
    with pytest.raises(ValueError):
        assert_dev_supabase_target("", "development")


@pytest.mark.parametrize("app_env", ["staging", "production"])
def test_deployed_envs_unaffected(app_env, monkeypatch):
    monkeypatch.delenv(ALLOW_REMOTE_SUPABASE_ENV, raising=False)
    assert_dev_supabase_target("https://abcdefghijklmnop.supabase.co", app_env)


def test_explicit_opt_in_allows_remote(monkeypatch):
    monkeypatch.setenv(ALLOW_REMOTE_SUPABASE_ENV, "1")
    assert_dev_supabase_target("https://abcdefghijklmnop.supabase.co", "development")


def test_settings_construction_enforces_guard(monkeypatch):
    monkeypatch.delenv(ALLOW_REMOTE_SUPABASE_ENV, raising=False)
    with pytest.raises(ValueError, match="Refusing non-local SUPABASE_URL"):
        Settings(
            SUPABASE_URL="https://abcdefghijklmnop.supabase.co",
            SUPABASE_ANON_KEY="k",
            APP_ENV="development",
        )
