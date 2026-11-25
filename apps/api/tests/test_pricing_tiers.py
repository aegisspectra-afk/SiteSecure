from __future__ import annotations

import pytest

from app.authz.pricing import (
    billing_public,
    extra_seat_unit_price,
    extra_seats_total_ils,
    monthly_total_ils,
    plan_display_base_ils,
    plan_allows_extra_seats,
)

EXTRA_CASES = (1, 2, 3, 4, 5, 9, 10, 20)
EXPECTED_UNIT = {1: 49, 2: 49, 3: 39, 4: 39, 5: 29, 9: 29, 10: 24, 20: 24}


def test_billing_public_tiers_and_no_annual():
    bp = billing_public()
    assert bp["pro_launch_active"] is True
    assert len(bp["extra_seat_tiers"]) == 4
    assert "annual_bonus_months" not in bp or bp.get("annual_bonus_months") in (None, 0)


def test_plan_allows_extra_seats():
    assert plan_allows_extra_seats("free") is False
    assert plan_allows_extra_seats("solo") is False
    assert plan_allows_extra_seats("pro") is True
    assert plan_allows_extra_seats("business") is True
    assert plan_allows_extra_seats("enterprise") is False


def test_extra_seat_unit_and_total():
    for n in EXTRA_CASES:
        assert extra_seat_unit_price(n) == EXPECTED_UNIT[n]
        assert extra_seats_total_ils(n) == n * EXPECTED_UNIT[n]


@pytest.mark.parametrize("plan_key,base_launch,base_regular", [("pro", 99, 129), ("business", 349, 349)])
def test_monthly_totals_pro_business(plan_key: str, base_launch: int, base_regular: int):
    assert plan_display_base_ils(plan_key) == base_launch
    assert plan_display_base_ils(plan_key, prefer_launch=False) == base_regular
    for n in EXTRA_CASES:
        assert monthly_total_ils(plan_key=plan_key, extra_seats=n) == base_launch + n * EXPECTED_UNIT[n]
        assert (
            monthly_total_ils(plan_key=plan_key, extra_seats=n, prefer_launch=False)
            == base_regular + n * EXPECTED_UNIT[n]
        )
    assert monthly_total_ils(plan_key=plan_key, extra_seats=2, locked_price_ils_before_vat=99) == 99 + 98


def test_free_rejects_extras_total():
    assert monthly_total_ils(plan_key="free", extra_seats=1) is None
