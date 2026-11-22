"""C1: plan capabilities gate — free denied, pro+ allowed; 409 + שדרג."""

import pytest

from app.authz.capabilities import evaluate_capability, plan_capability_enabled, require_capability
from app.authz.catalog import load_catalog
from app.authz.types import AuthzContext
from app.errors import ApiError

load_catalog.cache_clear()


def _ctx(plan_key: str) -> AuthzContext:
    return AuthzContext(
        workspace_id="ws",
        user_id="u1",
        role_key="owner",
        workspace_status="active",
        subscription_status="active",
        plan_key=plan_key,
        features=frozenset({"quotes", "core"}),
        grants=frozenset({"quotes.edit"}),
    )


def test_free_denies_quote_alternatives():
    assert plan_capability_enabled("free", "quotes.alternatives") is False
    decision = evaluate_capability(_ctx("free"), "quotes.alternatives")
    assert decision.allowed is False
    assert decision.details.get("upgrade_required") is True
    assert "שדרג" in (decision.message_he or "")


def test_pro_and_business_allow_quote_alternatives():
    assert plan_capability_enabled("pro", "quotes.alternatives") is True
    assert plan_capability_enabled("business", "quotes.alternatives") is True
    assert plan_capability_enabled("enterprise", "quotes.alternatives") is True
    assert evaluate_capability(_ctx("pro"), "quotes.alternatives").allowed is True


def test_legacy_solo_alias_matches_free():
    assert plan_capability_enabled("solo", "quotes.alternatives") is False


def test_require_capability_raises_409_with_upgrade():
    with pytest.raises(ApiError) as exc:
        require_capability(_ctx("free"), "quotes.alternatives")
    err = exc.value
    assert err.status_code == 409
    assert err.code == "PLAN_LIMIT_REACHED"
    assert "שדרג" in err.message
    assert (err.details or {}).get("upgrade_required") is True
