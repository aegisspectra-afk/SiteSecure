"""Live: my_workspace_entitlements applies workspace_feature_overrides (G-021)."""

from __future__ import annotations

import uuid

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app

pytestmark = pytest.mark.live

OWNER_A = ("ss.phase3.a@sitesecure.test", "Test-Pass-2026!")
# Prefer B for session checks — A accumulates many memberships from other live suites.
OWNER_B = ("ss.phase3.b@sitesecure.test", "Test-Pass-2026!")


@pytest.fixture(scope="module")
def settings():
    try:
        get_settings.cache_clear()
        return get_settings()
    except Exception:
        pytest.skip("SUPABASE_URL / SUPABASE_ANON_KEY not configured")


def _password_grant(settings, email: str, password: str) -> str:
    with httpx.Client(timeout=30) as client:
        res = client.post(
            f"{settings.supabase_url}/auth/v1/token?grant_type=password",
            headers={"apikey": settings.supabase_anon_key, "Content-Type": "application/json"},
            json={"email": email, "password": password},
        )
    if res.status_code != 200:
        pytest.skip(f"password grant failed: {res.status_code}")
    return res.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _service_headers(settings) -> dict[str, str]:
    key = settings.supabase_service_role_key or ""
    if not key or key.startswith("test-"):
        pytest.skip("service role required to plant feature overrides")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


def _set_override(settings, workspace_id: str, feature_key: str, enabled: bool) -> None:
    with httpx.Client(timeout=30) as client:
        res = client.post(
            f"{settings.supabase_url}/rest/v1/workspace_feature_overrides"
            "?on_conflict=workspace_id,feature_key",
            headers={**_service_headers(settings), "Prefer": "resolution=merge-duplicates,return=minimal"},
            json={
                "workspace_id": workspace_id,
                "feature_key": feature_key,
                "enabled": enabled,
            },
        )
    assert res.status_code in {200, 201, 204}, res.text


def _clear_override(settings, workspace_id: str, feature_key: str) -> None:
    with httpx.Client(timeout=30) as client:
        client.delete(
            f"{settings.supabase_url}/rest/v1/workspace_feature_overrides",
            headers=_service_headers(settings),
            params={
                "workspace_id": f"eq.{workspace_id}",
                "feature_key": f"eq.{feature_key}",
            },
        )


def _rpc_features(settings, token: str, workspace_id: str) -> list[str]:
    with httpx.Client(timeout=30) as client:
        res = client.post(
            f"{settings.supabase_url}/rest/v1/rpc/my_workspace_entitlements",
            headers={
                "apikey": settings.supabase_anon_key,
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={"p_workspace_id": workspace_id},
        )
    assert res.status_code == 200, res.text
    payload = res.json() or {}
    return list(payload.get("features") or [])


def _set_plan(settings, workspace_id: str, plan_key: str) -> None:
    with httpx.Client(timeout=30) as client:
        patched = client.patch(
            f"{settings.supabase_url}/rest/v1/subscriptions",
            headers=_service_headers(settings),
            params={"workspace_id": f"eq.{workspace_id}"},
            json={"plan_key": plan_key, "status": "active"},
        )
    assert patched.status_code in {200, 204}, patched.text


def test_base_plan_features_without_override(settings):
    api = TestClient(app)
    token = _password_grant(settings, *OWNER_A)
    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(token),
        json={"name": f"Ent Base {uuid.uuid4().hex[:6]}"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]
    features = _rpc_features(settings, token, workspace_id)
    assert "quotes" in features
    assert "inventory" not in features  # Solo base


def test_disable_override_blocks_backend_authorize(settings):
    api = TestClient(app)
    token = _password_grant(settings, *OWNER_A)
    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(token),
        json={"name": f"Ent Dis {uuid.uuid4().hex[:6]}"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]
    _set_plan(settings, workspace_id, "business")

    before = _rpc_features(settings, token, workspace_id)
    assert "audit" in before

    _set_override(settings, workspace_id, "audit", False)
    try:
        after = _rpc_features(settings, token, workspace_id)
        assert "audit" not in after
        assert "quotes" in after

        audit = api.get(f"/api/v1/workspaces/{workspace_id}/audit", headers=_auth(token))
        assert audit.status_code in {403, 404}, audit.text
        if audit.status_code == 403:
            code = audit.json().get("error", {}).get("code")
            assert code in {"FEATURE_NOT_INCLUDED", "PERMISSION_DENIED"}
    finally:
        _clear_override(settings, workspace_id, "audit")


def test_enable_override_adds_feature_for_solo(settings):
    api = TestClient(app)
    token = _password_grant(settings, *OWNER_A)
    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(token),
        json={"name": f"Ent En {uuid.uuid4().hex[:6]}"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]
    assert "inventory" not in _rpc_features(settings, token, workspace_id)

    _set_override(settings, workspace_id, "inventory", True)
    try:
        features = _rpc_features(settings, token, workspace_id)
        assert "inventory" in features
    finally:
        _clear_override(settings, workspace_id, "inventory")


def test_session_receives_effective_override(settings):
    """Single session round-trip (same RPC as authorize); uses quieter test user."""
    api = TestClient(app)
    token = _password_grant(settings, *OWNER_B)
    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(token),
        json={"name": f"Ent Ses {uuid.uuid4().hex[:6]}"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]
    _set_override(settings, workspace_id, "inventory", True)
    try:
        assert "inventory" in _rpc_features(settings, token, workspace_id)
        session = api.get("/api/v1/auth/session", headers=_auth(token))
        assert session.status_code == 200, session.text
        mine = next(m for m in session.json()["memberships"] if m["workspace_id"] == workspace_id)
        assert "inventory" in mine["features"]
        assert "quotes" in mine["features"]
    finally:
        _clear_override(settings, workspace_id, "inventory")


def test_override_removal_restores_base_plan(settings):
    api = TestClient(app)
    token = _password_grant(settings, *OWNER_A)
    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(token),
        json={"name": f"Ent Rm {uuid.uuid4().hex[:6]}"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]
    _set_override(settings, workspace_id, "inventory", True)
    assert "inventory" in _rpc_features(settings, token, workspace_id)
    _clear_override(settings, workspace_id, "inventory")
    assert "inventory" not in _rpc_features(settings, token, workspace_id)


def test_plan_downgrade_recalculates_with_override(settings):
    api = TestClient(app)
    token = _password_grant(settings, *OWNER_A)
    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(token),
        json={"name": f"Ent Dow {uuid.uuid4().hex[:6]}"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]
    _set_plan(settings, workspace_id, "business")
    assert "audit" in _rpc_features(settings, token, workspace_id)
    _set_plan(settings, workspace_id, "solo")
    assert "audit" not in _rpc_features(settings, token, workspace_id)
    # Enable override still wins after downgrade (schema supports enable).
    _set_override(settings, workspace_id, "audit", True)
    try:
        assert "audit" in _rpc_features(settings, token, workspace_id)
    finally:
        _clear_override(settings, workspace_id, "audit")


def test_inactive_subscription_denies_plan_features_unless_override(settings):
    api = TestClient(app)
    token = _password_grant(settings, *OWNER_A)
    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(token),
        json={"name": f"Ent Sub {uuid.uuid4().hex[:6]}"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]
    with httpx.Client(timeout=30) as client:
        patched = client.patch(
            f"{settings.supabase_url}/rest/v1/subscriptions",
            headers=_service_headers(settings),
            params={"workspace_id": f"eq.{workspace_id}"},
            json={"plan_key": "business", "status": "canceled"},
        )
    assert patched.status_code in {200, 204}, patched.text
    feats = _rpc_features(settings, token, workspace_id)
    assert "audit" not in feats
    assert "quotes" not in feats
    _set_override(settings, workspace_id, "quotes", True)
    try:
        assert "quotes" in _rpc_features(settings, token, workspace_id)
    finally:
        _clear_override(settings, workspace_id, "quotes")
        _set_plan(settings, workspace_id, "solo")


def test_cross_tenant_cannot_read_other_workspace_entitlements(settings):
    api = TestClient(app)
    token_a = _password_grant(settings, *OWNER_A)
    token_b = _password_grant(settings, *OWNER_B)
    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(token_a),
        json={"name": f"Ent Iso {uuid.uuid4().hex[:6]}"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]
    _set_override(settings, workspace_id, "ai", True)
    try:
        assert "ai" in _rpc_features(settings, token_a, workspace_id)
        with httpx.Client(timeout=30) as client:
            res = client.post(
                f"{settings.supabase_url}/rest/v1/rpc/my_workspace_entitlements",
                headers={
                    "apikey": settings.supabase_anon_key,
                    "Authorization": f"Bearer {token_b}",
                    "Content-Type": "application/json",
                },
                json={"p_workspace_id": workspace_id},
            )
        assert res.status_code == 200
        assert res.json() in (None, {})
    finally:
        _clear_override(settings, workspace_id, "ai")


def test_unknown_feature_key_override_rejected_by_fk(settings):
    api = TestClient(app)
    token = _password_grant(settings, *OWNER_A)
    ws = api.post(
        "/api/v1/workspaces",
        headers=_auth(token),
        json={"name": f"Ent Unk {uuid.uuid4().hex[:6]}"},
    )
    assert ws.status_code == 200, ws.text
    workspace_id = ws.json()["id"]
    with httpx.Client(timeout=30) as client:
        res = client.post(
            f"{settings.supabase_url}/rest/v1/workspace_feature_overrides",
            headers=_service_headers(settings),
            json={
                "workspace_id": workspace_id,
                "feature_key": "not_a_real_feature_xyz",
                "enabled": True,
            },
        )
    assert res.status_code >= 400, res.text
