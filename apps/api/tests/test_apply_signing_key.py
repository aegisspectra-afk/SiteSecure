"""Apply confirmation tokens are signed with a secret, never the public anon key or a constant."""

from __future__ import annotations

import hashlib

import pytest

from app.config import ALLOW_REMOTE_SUPABASE_ENV, Settings
from app.errors import ApiError
from app.system_designs import apply as apply_mod

ANON = "anon-key-that-ships-to-browsers"
SECRET = "sb_secret_unit_test_only"


def _settings(app_env: str, service: str | None) -> Settings:
    kwargs = {"SUPABASE_URL": "http://127.0.0.1:54321", "SUPABASE_ANON_KEY": ANON, "APP_ENV": app_env}
    if service is not None:
        kwargs["SUPABASE_SERVICE_ROLE_KEY"] = service
    return Settings(**kwargs)


@pytest.fixture(autouse=True)
def _no_service_env(monkeypatch):
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.setenv(ALLOW_REMOTE_SUPABASE_ENV, "1")


@pytest.mark.parametrize("app_env", ["staging", "production"])
def test_deployed_api_refuses_to_start_without_service_key(app_env, monkeypatch):
    monkeypatch.setattr(Settings, "model_config", {**Settings.model_config, "env_file": None})
    with pytest.raises(ValueError, match="SUPABASE_SERVICE_ROLE_KEY"):
        _settings(app_env, None)
    with pytest.raises(ValueError, match="SUPABASE_SERVICE_ROLE_KEY"):
        _settings(app_env, ANON)  # a non-service key is discarded, so it still fails


def test_deployed_api_starts_with_service_key(monkeypatch):
    monkeypatch.setattr(Settings, "model_config", {**Settings.model_config, "env_file": None})
    s = _settings("staging", SECRET)
    assert apply_mod._signing_key(s) == hashlib.sha256(SECRET.encode()).digest()


def test_signing_key_never_derives_from_anon_or_constant(monkeypatch):
    monkeypatch.setattr(Settings, "model_config", {**Settings.model_config, "env_file": None})
    s = _settings("development", None)
    key = apply_mod._signing_key(s)
    assert key != hashlib.sha256(ANON.encode()).digest()
    assert key != hashlib.sha256(b"site-secure-dev-apply-confirm").digest()
    assert len(key) == 32


def test_signing_key_fails_closed_outside_dev_if_secret_missing():
    s = Settings.model_construct(app_env="production", supabase_service_role_key=None, supabase_anon_key=ANON)
    with pytest.raises(RuntimeError):
        apply_mod._signing_key(s)


def test_token_signed_with_anon_derived_key_is_rejected(monkeypatch):
    monkeypatch.setattr(Settings, "model_config", {**Settings.model_config, "env_file": None})
    s = _settings("staging", SECRET)
    forged = Settings.model_construct(app_env="staging", supabase_service_role_key=ANON, supabase_anon_key=ANON)
    token, _ = apply_mod.issue_confirmation_token(
        workspace_id="w",
        quote_id="q",
        design_id="d",
        revision=1,
        divergence_hash_value="dh",
        proposed_hash_value="ph",
        settings=forged,
    )
    # Same payload, valid for the real key: proves the rejection is the signature, not the payload.
    good, _ = apply_mod.issue_confirmation_token(
        workspace_id="w",
        quote_id="q",
        design_id="d",
        revision=1,
        divergence_hash_value="dh",
        proposed_hash_value="ph",
        settings=s,
    )
    apply_mod.verify_confirmation_token(
        good,
        workspace_id="w",
        quote_id="q",
        design_id="d",
        revision=1,
        divergence_hash_value="dh",
        proposed_hash_value="ph",
        settings=s,
    )
    with pytest.raises(ApiError) as exc:
        apply_mod.verify_confirmation_token(
            token,
            workspace_id="w",
            quote_id="q",
            design_id="d",
            revision=1,
            divergence_hash_value="dh",
            proposed_hash_value="ph",
            settings=s,
        )
    assert exc.value.code == "CONFIRMATION_STALE"
