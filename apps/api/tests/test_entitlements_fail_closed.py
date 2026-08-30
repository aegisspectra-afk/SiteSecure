"""Fail-closed entitlement RPC parsing (Task 03B)."""

from __future__ import annotations

import pytest

from app.authz.catalog import load_catalog
from app.authz.engine import authorize
from app.authz.types import AuthzContext
from app.deps import parse_entitlements_rpc
from app.errors import ApiError


class _FakeResponse:
    def __init__(self, status_code: int, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


def test_parse_success_returns_effective_features():
    plan, status, features = parse_entitlements_rpc(
        _FakeResponse(200, {"plan_key": "business", "status": "active", "features": ["quotes", "audit"]}),
        workspace_id="w1",
    )
    assert plan == "business"
    assert status == "active"
    assert features == frozenset({"quotes", "audit"})


def test_parse_empty_features_is_valid_not_failure():
    plan, status, features = parse_entitlements_rpc(
        _FakeResponse(200, {"plan_key": "solo", "status": "canceled", "features": []}),
        workspace_id="w1",
    )
    assert plan == "solo"
    assert status == "canceled"
    assert features == frozenset()


def test_parse_http_failure_raises_unavailable():
    with pytest.raises(ApiError) as exc:
        parse_entitlements_rpc(_FakeResponse(503, {"message": "down"}), workspace_id="w1")
    assert exc.value.status_code == 503
    assert exc.value.code == "ENTITLEMENTS_UNAVAILABLE"


def test_parse_null_payload_raises_unavailable():
    with pytest.raises(ApiError) as exc:
        parse_entitlements_rpc(_FakeResponse(200, None), workspace_id="w1")
    assert exc.value.code == "ENTITLEMENTS_UNAVAILABLE"
    assert exc.value.details.get("reason") == "rpc_null"


def test_parse_malformed_without_features_key_raises():
    with pytest.raises(ApiError) as exc:
        parse_entitlements_rpc(_FakeResponse(200, {"plan_key": "business"}), workspace_id="w1")
    assert exc.value.details.get("reason") == "rpc_malformed"


def test_rpc_failure_cannot_reenable_via_catalog_fallback():
    """Regression: old path loaded business catalog features when RPC failed."""
    with pytest.raises(ApiError) as exc:
        parse_entitlements_rpc(_FakeResponse(500, None), workspace_id="w1")
    assert exc.value.code == "ENTITLEMENTS_UNAVAILABLE"
    # Authorize never sees invented business features from catalog.
    catalog = load_catalog()
    business = catalog["_plan_features"]["business"]
    assert "audit" in business
    # Empty features (safe session shape) still denies.
    d = authorize(
        ctx=AuthzContext(
            user_id="u1",
            workspace_id="w1",
            role_key="owner",
            workspace_status="active",
            subscription_status="active",
            plan_key="business",
            features=frozenset(),
        ),
        action="audit.view",
    )
    assert d.allowed is False
    assert d.code == "FEATURE_NOT_INCLUDED"


def test_session_safe_empty_features_does_not_grant_plan_only():
    """Session fail-closed shape: empty features + solo default plan label."""
    catalog = load_catalog()
    assert "inventory" not in catalog["_plan_features"]["solo"]
    d = authorize(
        ctx=AuthzContext(
            user_id="u1",
            workspace_id="w1",
            role_key="owner",
            workspace_status="active",
            subscription_status="active",
            plan_key="solo",
            features=frozenset(),
        ),
        action="inventory.view",
    )
    assert d.allowed is False
