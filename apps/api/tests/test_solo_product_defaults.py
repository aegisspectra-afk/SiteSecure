"""Solo default-off seed: fail closed (no silent skip). No live DB."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.errors import ApiError, MESSAGES
from app.routers.workspace_products import (
    assert_solo_default_off_ready,
    seed_solo_default_product_overrides,
)


class _Res:
    def __init__(self, status_code: int, payload, text: str = ""):
        self.status_code = status_code
        self._payload = payload
        self.text = text

    def json(self):
        return self._payload


def test_empty_features_lookup_does_not_skip_when_plan_eligible(monkeypatch):
    """H1: empty registry when plan lists fleet/ssp ג†’ explicit error, not silent skip."""

    def _plan(_svc, plan_key):
        assert plan_key == "solo"
        return frozenset({"core", "fleet", "ssp"})

    def _registry(_svc, keys):
        return frozenset()  # empty ג€” missing required keys

    monkeypatch.setattr("app.routers.workspace_products.fetch_plan_feature_keys", _plan)
    monkeypatch.setattr("app.routers.workspace_products.fetch_feature_registry_keys", _registry)

    with pytest.raises(ApiError) as exc:
        assert_solo_default_off_ready(MagicMock(), "solo")
    assert exc.value.code == "PRODUCT_DEFAULTS_UNAVAILABLE"
    assert exc.value.details.get("reason") == "required_features_missing_from_registry"
    assert "fleet" in exc.value.details.get("missing", [])


def test_features_lookup_http_failure_fails_closed(monkeypatch):
    monkeypatch.setattr(
        "app.routers.workspace_products.fetch_plan_feature_keys",
        lambda *_a, **_k: frozenset({"fleet", "ssp"}),
    )

    def _boom(*_a, **_k):
        raise ApiError(503, "PRODUCT_DEFAULTS_UNAVAILABLE", "x", details={"reason": "features_lookup_failed"})

    monkeypatch.setattr("app.routers.workspace_products.fetch_feature_registry_keys", _boom)

    with pytest.raises(ApiError) as exc:
        assert_solo_default_off_ready(MagicMock(), "solo")
    assert exc.value.code == "PRODUCT_DEFAULTS_UNAVAILABLE"
    assert exc.value.details.get("reason") == "features_lookup_failed"


def test_plan_features_lookup_failure_fails_before_create(monkeypatch):
    def _boom(*_a, **_k):
        raise ApiError(
            503,
            "PRODUCT_DEFAULTS_UNAVAILABLE",
            "x",
            details={"reason": "plan_features_lookup_failed"},
        )

    monkeypatch.setattr("app.routers.workspace_products.fetch_plan_feature_keys", _boom)

    with pytest.raises(ApiError) as exc:
        assert_solo_default_off_ready(MagicMock(), "solo")
    assert exc.value.details.get("reason") == "plan_features_lookup_failed"


def test_not_plan_eligible_requires_no_seed(monkeypatch):
    monkeypatch.setattr(
        "app.routers.workspace_products.fetch_plan_feature_keys",
        lambda *_a, **_k: frozenset({"core", "quotes"}),
    )
    called = []

    monkeypatch.setattr(
        "app.routers.workspace_products.fetch_feature_registry_keys",
        lambda *_a, **_k: called.append("registry") or frozenset(),
    )
    required = assert_solo_default_off_ready(MagicMock(), "solo")
    assert required == frozenset()
    assert called == []  # no registry lookup when nothing required


def test_plan_eligible_missing_registry_fails_closed(monkeypatch):
    monkeypatch.setattr(
        "app.routers.workspace_products.fetch_plan_feature_keys",
        lambda *_a, **_k: frozenset({"fleet"}),
    )
    monkeypatch.setattr(
        "app.routers.workspace_products.fetch_feature_registry_keys",
        lambda *_a, **_k: frozenset(),
    )
    with pytest.raises(ApiError) as exc:
        assert_solo_default_off_ready(MagicMock(), "solo")
    assert exc.value.code == "PRODUCT_DEFAULTS_UNAVAILABLE"
    assert exc.value.details.get("missing") == ["fleet"]


def test_seed_upsert_failure_raises(monkeypatch):
    monkeypatch.setattr(
        "app.routers.workspace_products.assert_solo_default_off_ready",
        lambda *_a, **_k: frozenset({"fleet"}),
    )

    def _fail(*_a, **_k):
        raise ApiError(400, "PRODUCT_DEFAULTS_UNAVAILABLE", "x", details={"reason": "override_upsert_failed"})

    monkeypatch.setattr("app.routers.workspace_products._upsert_override_merge", _fail)

    with pytest.raises(ApiError) as exc:
        seed_solo_default_product_overrides(MagicMock(), "ws-1", "solo")
    assert exc.value.details.get("reason") == "override_upsert_failed"


def test_dual_write_upsert_always_sets_enabled_false(monkeypatch):
    """Compatibility dual-write must force enabled=false for each required key."""
    monkeypatch.setattr(
        "app.routers.workspace_products.assert_solo_default_off_ready",
        lambda *_a, **_k: frozenset({"fleet", "ssp"}),
    )
    calls: list[tuple[str, str, bool]] = []

    def _capture(_svc, workspace_id, feature_key, enabled):
        calls.append((workspace_id, feature_key, enabled))

    monkeypatch.setattr("app.routers.workspace_products._upsert_override_merge", _capture)
    seed_solo_default_product_overrides(MagicMock(), "ws-1", "solo")
    assert sorted(calls) == [("ws-1", "fleet", False), ("ws-1", "ssp", False)]


def test_seed_fleet_only_when_plan_eligible(monkeypatch):
    monkeypatch.setattr(
        "app.routers.workspace_products.assert_solo_default_off_ready",
        lambda *_a, **_k: frozenset({"fleet"}),
    )
    calls: list[str] = []

    def _capture(_svc, _ws, feature_key, enabled):
        assert enabled is False
        calls.append(feature_key)

    monkeypatch.setattr("app.routers.workspace_products._upsert_override_merge", _capture)
    seed_solo_default_product_overrides(MagicMock(), "ws-1", "solo")
    assert calls == ["fleet"]


def test_seed_ssp_when_plan_eligible(monkeypatch):
    monkeypatch.setattr(
        "app.routers.workspace_products.assert_solo_default_off_ready",
        lambda *_a, **_k: frozenset({"ssp"}),
    )
    calls: list[str] = []

    def _capture(_svc, _ws, feature_key, enabled):
        assert enabled is False
        calls.append(feature_key)

    monkeypatch.setattr("app.routers.workspace_products._upsert_override_merge", _capture)
    seed_solo_default_product_overrides(MagicMock(), "ws-1", "solo")
    assert calls == ["ssp"]


def test_non_solo_preflight_requires_no_seed(monkeypatch):
    called = []
    monkeypatch.setattr(
        "app.routers.workspace_products.fetch_plan_feature_keys",
        lambda *_a, **_k: called.append("plan") or frozenset({"fleet", "ssp"}),
    )
    required = assert_solo_default_off_ready(MagicMock(), "business")
    assert required == frozenset()
    assert called == []


def test_create_workspace_preflight_blocks_rpc(monkeypatch):
    from fastapi.testclient import TestClient

    from app.deps import current_user, service_client, user_client
    from app.main import app

    rpc = MagicMock()

    def _preflight(*_a, **_k):
        raise ApiError(
            503,
            "PRODUCT_DEFAULTS_UNAVAILABLE",
            "blocked",
            details={"reason": "required_features_missing_from_registry", "missing": ["fleet"]},
        )

    # create_workspace imports from workspace_products at call time.
    monkeypatch.setattr(
        "app.routers.workspace_products.assert_solo_default_off_ready",
        _preflight,
    )

    client = MagicMock()
    client.rpc = rpc
    app.dependency_overrides[current_user] = lambda: {"id": "u1", "email": "a@b.com"}
    app.dependency_overrides[user_client] = lambda: client
    app.dependency_overrides[service_client] = lambda: MagicMock()
    api = TestClient(app)
    try:
        res = api.post("/api/v1/workspaces", headers={"Authorization": "Bearer t"}, json={"name": "Solo Co"})
        assert res.status_code == 503
        assert res.json()["error"]["code"] == "PRODUCT_DEFAULTS_UNAVAILABLE"
        rpc.assert_not_called()
    finally:
        app.dependency_overrides.clear()


def test_create_workspace_rpc_product_defaults_maps_to_stable_503(monkeypatch):
    """RPC PRODUCT_DEFAULTS_UNAVAILABLE ג†’ 503 with stable message; no SQL DETAIL leak."""
    from fastapi.testclient import TestClient

    from app.deps import current_user, service_client, user_client
    from app.main import app

    monkeypatch.setattr(
        "app.routers.workspace_products.assert_solo_default_off_ready",
        lambda *_a, **_k: frozenset({"fleet"}),
    )
    seed = MagicMock()
    monkeypatch.setattr("app.routers.workspace_products.seed_solo_default_product_overrides", seed)

    leak = 'P0001: PRODUCT_DEFAULTS_UNAVAILABLE DETAIL: secret_table_name hint=internal'
    client = MagicMock()
    client.rpc.return_value = _Res(400, None, text=leak)

    app.dependency_overrides[current_user] = lambda: {"id": "u1", "email": "a@b.com"}
    app.dependency_overrides[user_client] = lambda: client
    app.dependency_overrides[service_client] = lambda: MagicMock()
    api = TestClient(app)
    try:
        res = api.post("/api/v1/workspaces", headers={"Authorization": "Bearer t"}, json={"name": "Solo Co"})
        assert res.status_code == 503
        body = res.json()
        assert body["error"]["code"] == "PRODUCT_DEFAULTS_UNAVAILABLE"
        assert body["error"]["message"] == MESSAGES["PRODUCT_DEFAULTS_UNAVAILABLE"]
        dumped = res.text
        assert "secret_table_name" not in dumped
        assert "DETAIL" not in dumped
        seed.assert_not_called()
    finally:
        app.dependency_overrides.clear()


def test_create_workspace_success_dual_writes_fleet_and_ssp(monkeypatch):
    """Happy path: post-RPC dual-write seeds fleet/ssp enabled=false when required."""
    from fastapi.testclient import TestClient

    from app.deps import current_user, service_client, user_client
    from app.main import app

    ws_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    upserts: list[tuple[str, bool]] = []

    monkeypatch.setattr(
        "app.routers.workspace_products.assert_solo_default_off_ready",
        lambda *_a, **_k: frozenset({"fleet", "ssp"}),
    )

    def _seed(svc, workspace_id, plan_key):
        assert plan_key == "solo"
        assert workspace_id == ws_id
        for key in ("fleet", "ssp"):
            upserts.append((key, False))

    monkeypatch.setattr("app.routers.workspace_products.seed_solo_default_product_overrides", _seed)
    monkeypatch.setattr("app.routers.workspaces.write_audit", lambda *a, **k: None)

    client = MagicMock()
    client.rpc.return_value = _Res(200, ws_id)
    client.get.return_value = _Res(200, [{"id": ws_id, "name": "Solo Co", "status": "active"}])

    app.dependency_overrides[current_user] = lambda: {"id": "u1", "email": "a@b.com"}
    app.dependency_overrides[user_client] = lambda: client
    app.dependency_overrides[service_client] = lambda: MagicMock()
    api = TestClient(app)
    try:
        res = api.post("/api/v1/workspaces", headers={"Authorization": "Bearer t"}, json={"name": "Solo Co"})
        assert res.status_code == 200
        assert upserts == [("fleet", False), ("ssp", False)]
    finally:
        app.dependency_overrides.clear()


def test_create_workspace_seed_failure_surfaces_workspace_id(monkeypatch):
    """H2: post-RPC seed failure returns explicit error with workspace_id (no silent success)."""
    from fastapi.testclient import TestClient

    from app.deps import current_user, service_client, user_client
    from app.main import app

    ws_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

    monkeypatch.setattr(
        "app.routers.workspace_products.assert_solo_default_off_ready",
        lambda *_a, **_k: frozenset({"fleet", "ssp"}),
    )

    def _seed_fail(*_a, **_k):
        raise ApiError(400, "PRODUCT_DEFAULTS_UNAVAILABLE", "x", details={"reason": "override_upsert_failed"})

    monkeypatch.setattr(
        "app.routers.workspace_products.seed_solo_default_product_overrides",
        _seed_fail,
    )

    client = MagicMock()
    client.rpc.return_value = _Res(200, ws_id)
    client.get.return_value = _Res(200, [{"id": ws_id, "name": "Solo Co", "status": "active"}])

    app.dependency_overrides[current_user] = lambda: {"id": "u1", "email": "a@b.com"}
    app.dependency_overrides[user_client] = lambda: client
    app.dependency_overrides[service_client] = lambda: MagicMock()
    api = TestClient(app)
    try:
        res = api.post("/api/v1/workspaces", headers={"Authorization": "Bearer t"}, json={"name": "Solo Co"})
        assert res.status_code == 503
        err = res.json()["error"]
        assert err["code"] == "WORKSPACE_PRODUCT_DEFAULTS_FAILED"
        assert err["details"]["workspace_id"] == ws_id
    finally:
        app.dependency_overrides.clear()
