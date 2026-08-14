from app.pricing import line_net, recalculate


def test_line_net_and_header_discount():
    assert float(line_net(qty=2, unit_price=100, discount=10, item_type="catalog")) == 190
    assert float(line_net(qty=1, unit_price=50, discount=0, item_type="note")) == 0

    result = recalculate(
        [
            {"qty": 2, "unit_price": 100, "discount": 0, "cost": 40, "item_type": "catalog"},
            {"qty": 1, "unit_price": 50, "discount": 0, "cost": 0, "item_type": "note"},
        ],
        vat_percent=18,
        discount_type="percent",
        discount_value=10,
    )
    assert result["subtotal_net"] == 180.0
    assert result["vat_amount"] == 32.4
    assert result["total_gross"] == 212.4
    assert result["cost_total"] == 80.0
    assert result["items"][0]["line_net"] == 200.0
    assert result["items"][1]["line_net"] == 0.0


def test_client_totals_are_not_inputs():
    result = recalculate(
        [{"qty": 1, "unit_price": 10, "discount": 0, "cost": 4, "item_type": "free"}],
        vat_percent=0,
        discount_type=None,
        discount_value=999,
    )
    assert result["total_gross"] == 10.0
    assert result["cost_total"] == 4.0
    assert result["margin_amount"] == 6.0
