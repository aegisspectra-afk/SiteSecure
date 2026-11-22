"""C1 §8: capability × plan matrix — Free/Pro/Business/Enterprise; 409 + שדרג."""

from __future__ import annotations

import pytest

from app.authz.capabilities import (
    PLAN_CAPABILITIES,
    capability_matrix,
    evaluate_capability,
    normalize_plan_key,
    plan_capability_enabled,
    require_capability,
)
from app.authz.catalog import load_catalog
from app.authz.limits import evaluate_count_limit, evaluate_seat_limit, plan_limit_value
from app.authz.types import AuthzContext
from app.errors import ApiError

load_catalog.cache_clear()

# Expected §8 matrix (capability → enabled on free / pro / business / enterprise)
EXPECTED_CAPS: dict[str, tuple[bool, bool, bool, bool]] = {
    "quotes.alternatives": (False, True, True, True),
    "branding.custom_handover": (False, True, True, True),
    "comms.whatsapp": (False, True, True, True),
    "quotes.sales_tracking": (False, True, True, True),
    "field.technicians": (False, False, True, True),
    "field.dispatch": (False, False, True, True),
    "jobs.checklist": (False, False, True, True),
    "sites.dossier": (False, False, True, True),
    "service.reminders": (False, False, True, True),
    "quotes.profitability": (False, False, True, True),
}

EXPECTED_LIMITS: dict[str, dict[str, int]] = {
    "free": {"max_members": 1, "storage_gb": 1, "quota_quotes": 10},
    "pro": {"max_members": 2, "storage_gb": 10, "quota_quotes": 0},
    "business": {"max_members": 5, "storage_gb": 50, "quota_quotes": 0},
    "enterprise": {"max_members": 0, "storage_gb": 0, "quota_quotes": 0},
}


def _ctx(plan_key: str) -> AuthzContext:
    return AuthzContext(
        workspace_id="ws",
        user_id="u1",
        role_key="owner",
        workspace_status="active",
        subscription_status="active",
        plan_key=plan_key,
        features=frozenset({"quotes", "core", "team"}),
        grants=frozenset({"quotes.edit", "quotes.view_cost"}),
    )


def test_capability_matrix_matches_section8():
    matrix = capability_matrix()
    for cap, expected in EXPECTED_CAPS.items():
        assert cap in PLAN_CAPABILITIES
        for plan, want in zip(("free", "pro", "business", "enterprise"), expected, strict=True):
            assert matrix[plan][cap] is want, f"{plan}/{cap}: got {matrix[plan][cap]} want {want}"
            assert plan_capability_enabled(plan, cap) is want


def test_limits_match_section8():
    for plan, limits in EXPECTED_LIMITS.items():
        for key, want in limits.items():
            assert plan_limit_value(plan, key) == want, f"{plan}.{key}"


def test_solo_normalizes_to_free():
    assert normalize_plan_key("solo") == "free"
    assert plan_capability_enabled("solo", "quotes.alternatives") is False
    assert plan_limit_value("solo", "quota_quotes") == 10
    assert plan_limit_value("solo", "max_members") == 1


@pytest.mark.parametrize("cap", list(EXPECTED_CAPS))
def test_free_denies_each_off_capability_with_upgrade(cap: str):
    free_on = EXPECTED_CAPS[cap][0]
    if free_on:
        assert evaluate_capability(_ctx("free"), cap).allowed is True
        return
    decision = evaluate_capability(_ctx("free"), cap)
    assert decision.allowed is False
    assert decision.details.get("upgrade_required") is True
    assert "שדרג" in (decision.message_he or "")
    with pytest.raises(ApiError) as exc:
        require_capability(_ctx("free"), cap)
    err = exc.value
    assert err.status_code == 409
    assert err.code == "PLAN_LIMIT_REACHED"
    assert "שדרג" in err.message
    assert (err.details or {}).get("upgrade_required") is True


def test_pro_allows_mid_tier_denies_business_only():
    for cap in (
        "quotes.alternatives",
        "branding.custom_handover",
        "comms.whatsapp",
        "quotes.sales_tracking",
    ):
        assert evaluate_capability(_ctx("pro"), cap).allowed is True
    for cap in (
        "field.technicians",
        "field.dispatch",
        "jobs.checklist",
        "sites.dossier",
        "service.reminders",
        "quotes.profitability",
    ):
        with pytest.raises(ApiError) as exc:
            require_capability(_ctx("pro"), cap)
        assert exc.value.status_code == 409
        assert "שדרג" in exc.value.message


def test_business_allows_full_matrix():
    for cap in PLAN_CAPABILITIES:
        assert evaluate_capability(_ctx("business"), cap).allowed is True


def test_free_quote_quota_blocks_at_10():
    d = evaluate_count_limit(
        plan_key="free", limit_key="quota_quotes", resource="quotes", current=10
    )
    assert d.allowed is False
    assert d.details.get("upgrade_required") is True
    assert d.details.get("limit") == 10


def test_free_blocks_second_member_and_technician():
    seat = evaluate_seat_limit(
        plan_key="free", invite_role="viewer", occupied_roles=["owner"]
    )
    assert seat.allowed is False
    assert seat.details.get("limit_key") == "max_members"

    tech = evaluate_seat_limit(
        plan_key="free", invite_role="technician", occupied_roles=["owner"]
    )
    assert tech.allowed is False
    # Either member cap or technicians capability
    assert tech.details.get("upgrade_required") is True


def test_pro_allows_second_member_blocks_technician():
    ok = evaluate_seat_limit(
        plan_key="pro", invite_role="sales", occupied_roles=["owner"]
    )
    assert ok.allowed is True
    tech = evaluate_seat_limit(
        plan_key="pro", invite_role="technician", occupied_roles=["owner"]
    )
    assert tech.allowed is False
    assert tech.details.get("capability") == "field.technicians" or tech.details.get(
        "limit_key"
    ) in {"max_technicians", "max_members"}


def test_business_allows_technician_within_five():
    d = evaluate_seat_limit(
        plan_key="business",
        invite_role="technician",
        occupied_roles=["owner", "sales"],
    )
    assert d.allowed is True
    full = evaluate_seat_limit(
        plan_key="business",
        invite_role="viewer",
        occupied_roles=["owner", "sales", "technician", "manager", "administrator"],
    )
    assert full.allowed is False
    assert full.details.get("limit") == 5


def test_catalog_has_no_solo_plan_row():
    catalog = load_catalog()
    keys = {p["key"] for p in catalog["plans"]}
    assert "solo" not in keys
    assert {"free", "pro", "business", "enterprise"} <= keys
    # Alias maps still resolve solo → free
    assert "solo" in catalog["_plan_capabilities"]
    assert catalog["_plan_capabilities"]["solo"] == catalog["_plan_capabilities"]["free"]
