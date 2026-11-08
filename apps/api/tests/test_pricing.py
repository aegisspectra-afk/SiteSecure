from app.pricing import apply_discount, line_net, margin_status, recalculate


def test_line_net_and_header_discount():
    assert float(line_net(qty=2, unit_price=100, discount=10, item_type="catalog")) == 190
    assert float(line_net(qty=1, unit_price=50, discount=0, item_type="note")) == 0
    assert float(line_net(qty=2, unit_price=700, discount=0, item_type="catalog")) == 1400
    assert (
        float(line_net(qty=2, unit_price=100, discount=10, item_type="catalog", discount_type="percent"))
        == 180
    )

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
    assert result["margin_amount"] == 100.0
    assert result["margin_percent"] == 55.56


def test_example_camera_line_profitability():
    # Cost 400, sale 700, qty 2 → revenue 1400, cost 800, GP 600, margin 42.86%
    result = recalculate(
        [{"qty": 2, "unit_price": 700, "discount": 0, "cost": 400, "item_type": "catalog"}],
        vat_percent=18,
        discount_type=None,
        discount_value=0,
    )
    assert result["subtotal_net"] == 1400.0
    assert result["cost_total"] == 800.0
    assert result["margin_amount"] == 600.0
    assert result["margin_percent"] == 42.86
    assert result["items"][0]["gross_profit"] == 600.0


def test_section_discount_then_quote_discount():
    result = recalculate(
        [
            {
                "qty": 1,
                "unit_price": 100,
                "discount": 0,
                "cost": 40,
                "item_type": "catalog",
                "section_id": "s1",
            },
            {
                "qty": 1,
                "unit_price": 100,
                "discount": 0,
                "cost": 40,
                "item_type": "catalog",
                "section_id": "s1",
            },
        ],
        vat_percent=0,
        discount_type="amount",
        discount_value=10,
        sections=[{"id": "s1", "discount_type": "percent", "discount_value": 10}],
    )
    # Section: 200 − 10% = 180; quote −10 = 170
    assert result["lines_subtotal"] == 180.0
    assert result["section_discount_amount"] == 20.0
    assert result["quote_discount_amount"] == 10.0
    assert result["subtotal_net"] == 170.0


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


def test_invalid_inputs_do_not_produce_nan_or_negative_totals():
    result = recalculate(
        [
            {"qty": -2, "unit_price": "nan", "discount": -5, "cost": "inf", "item_type": "catalog"},
            {"qty": 1, "unit_price": 100, "discount": 0, "cost": 10, "item_type": "catalog"},
        ],
        vat_percent=18,
        discount_type="percent",
        discount_value=150,
    )
    assert result["subtotal_net"] == 0.0
    assert result["vat_amount"] == 0.0
    assert result["total_gross"] == 0.0
    assert result["items"][0]["line_net"] == 0.0
    assert result["items"][1]["line_net"] == 100.0


def test_amount_discount_cannot_go_negative():
    result = recalculate(
        [{"qty": 1, "unit_price": 50, "discount": 0, "cost": 10, "item_type": "free"}],
        vat_percent=0,
        discount_type="amount",
        discount_value=80,
    )
    assert result["subtotal_net"] == 0.0
    assert result["total_gross"] == 0.0
    assert result["cost_total"] == 10.0


def test_apply_discount_and_margin_status():
    after, amount = apply_discount(__import__("decimal").Decimal("100"), discount_type="percent", discount_value=25)
    assert float(after) == 75.0
    assert float(amount) == 25.0
    assert margin_status(35, target=30, minimum=15) == "healthy"
    assert margin_status(20, target=30, minimum=15) == "warning"
    assert margin_status(10, target=30, minimum=15) == "critical"


def test_breakdown_lines_sections_and_options():
    # Section S: 2 x 500 = 1000, 10% section discount -> 900. Optional 300 in S is excluded.
    # Loose: 200. Quote discount 50 (amount). VAT 18%.
    items = [
        {"id": "a", "item_type": "catalog", "qty": 2, "unit_price": 500, "section_id": "S", "cost": 300},
        {"id": "b", "item_type": "catalog", "qty": 1, "unit_price": 300, "section_id": "S", "is_optional": True},
        {"id": "c", "item_type": "labor", "qty": 1, "unit_price": 200},
    ]
    sections = [{"id": "S", "discount_type": "percent", "discount_value": 10}]
    out = recalculate(items, vat_percent=18, discount_type="amount", discount_value=50, sections=sections)
    assert out["items_subtotal"] == 1200.0  # lines before section discounts, options excluded
    assert out["section_discount_amount"] == 100.0
    assert out["lines_subtotal"] == 1100.0
    assert out["quote_discount_amount"] == 50.0
    assert out["subtotal_net"] == 1050.0
    assert out["vat_amount"] == 189.0
    assert out["total_gross"] == 1239.0
    assert out["sections_breakdown"] == [
        {"section_id": "S", "lines_net": 1000.0, "discount_amount": 100.0, "net": 900.0}
    ]
    assert out["optional_subtotal"] == 300.0
    assert out["optional_total_gross"] == 354.0
    assert out["total_with_options_gross"] == 1593.0
