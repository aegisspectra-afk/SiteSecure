"""Template apply completeness — sections, pricing inputs, and helper behavior."""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import UUID, uuid4

import pytest

from app.errors import ApiError
from app.pricing import recalculate
from app.routers.quotes import (
    QuoteItemIn,
    _resolve_template_section_id,
    _section_name_key,
    _template_item_to_quote_item_in,
)

WS = UUID("00000000-0000-0000-0000-000000000101")
QUOTE = UUID("00000000-0000-0000-0000-000000000202")


def test_section_name_key_normalizes_blank():
    assert _section_name_key("  מצלמות  ") == "מצלמות"
    assert _section_name_key("") is None
    assert _section_name_key(None) is None


def test_template_item_maps_section_price_and_percent_discount():
    body = _template_item_to_quote_item_in(
        {
            "product_id": "p1",
            "description": "מצלמה",
            "qty": 2,
            "sort_order": 20,
            "section_name": "מצלמות",
            "unit_price": 450,
            "discount": 10,
            "discount_type": "percent",
            "item_type": "catalog",
        },
        sort_order=20,
        section_id="sec-1",
    )
    assert body is not None
    assert body.product_id == "p1"
    assert body.unit_price == 450
    assert body.discount == 10
    assert body.discount_type == "percent"
    assert body.section_id == "sec-1"


def test_template_item_skips_catalog_without_product():
    assert _template_item_to_quote_item_in({"item_type": "catalog", "qty": 1}, sort_order=1, section_id=None) is None


def test_template_item_allows_free_line_without_product():
    body = _template_item_to_quote_item_in(
        {"description": "התקנה", "qty": 1, "unit_price": 800, "item_type": "labor"},
        sort_order=30,
        section_id="sec-2",
    )
    assert body is not None
    assert body.item_type == "labor"
    assert body.unit_price == 800


def test_template_pricing_recalculates_from_inputs():
    item = {
        "item_type": "catalog",
        "qty": 2,
        "unit_price": 100,
        "discount": 10,
        "discount_type": "percent",
        "cost": 40,
    }
    result = recalculate([item], vat_percent=0, discount_type=None, discount_value=0)
    assert result["items"][0]["line_net"] == 180.0


def test_repeated_section_name_reuses_created_section():
    client = MagicMock()
    section_id = str(uuid4())
    response = MagicMock()
    response.status_code = 201
    response.json.return_value = {"id": section_id, "name": "מצלמות", "sort_order": 10}
    client.post.return_value = response
    by_name: dict[str, str] = {}
    existing: list[dict] = []

    first_id, next_sort = _resolve_template_section_id(
        client,
        WS,
        QUOTE,
        "מצלמות",
        section_by_name=by_name,
        existing_sections=existing,
        next_sort=10,
    )
    second_id, _ = _resolve_template_section_id(
        client,
        WS,
        QUOTE,
        "מצלמות",
        section_by_name=by_name,
        existing_sections=existing,
        next_sort=next_sort,
    )

    assert first_id == section_id
    assert second_id == section_id
    client.post.assert_called_once()


def test_existing_quote_section_is_reused_by_name():
    existing_id = str(uuid4())
    existing = [{"id": existing_id, "name": "הקלטה", "sort_order": 10}]
    client = MagicMock()
    by_name: dict[str, str] = {}

    section_id, next_sort = _resolve_template_section_id(
        client,
        WS,
        QUOTE,
        "הקלטה",
        section_by_name=by_name,
        existing_sections=existing,
        next_sort=20,
    )

    assert section_id == existing_id
    assert next_sort == 20
    client.post.assert_not_called()


def test_item_without_section_applies_safely():
    body = _template_item_to_quote_item_in(
        {"product_id": "p9", "qty": 1, "item_type": "catalog", "description": "כבל"},
        sort_order=15,
        section_id=None,
    )
    assert body is not None
    assert body.section_id is None


def test_invalid_template_discount_type_raises():
    from app.routers.quotes import _normalize_discount_type

    with pytest.raises(ApiError):
        _normalize_discount_type("bogus")
