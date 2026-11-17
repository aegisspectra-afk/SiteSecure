"""Q6A: send/approve of empty or zero-total quotes must return 409."""

from app.quote_value_guard import assert_quote_has_billable_value, quote_has_billable_value
from app.errors import ApiError
import pytest


def test_empty_items_have_no_billable_value():
    assert quote_has_billable_value({"total_gross": 100}, []) is False
    assert quote_has_billable_value({"total_gross": 100}, [{"item_type": "note", "qty": 1, "unit_price": 0}]) is False


def test_zero_total_with_priced_lines_still_fails_when_header_and_lines_are_zero():
    items = [{"item_type": "free", "qty": 1, "unit_price": 0}]
    assert quote_has_billable_value({"total_gross": 0}, items) is False


def test_positive_quote_passes():
    items = [{"item_type": "free", "qty": 2, "unit_price": 50, "line_net": 100}]
    assert quote_has_billable_value({"total_gross": 117}, items) is True


def test_assert_raises_409():
    with pytest.raises(ApiError) as exc:
        assert_quote_has_billable_value({"total_gross": 0}, [])
    assert exc.value.status_code == 409
    assert exc.value.code == "QUOTE_EMPTY_OR_ZERO"
