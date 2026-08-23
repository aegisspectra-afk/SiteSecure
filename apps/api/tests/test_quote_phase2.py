from app.pricing import margin_status, recalculate
from app.quote_validation import advisory_checks, validate_for_send


def test_margin_rule_warns_below_target():
    quote = {
        "customer_id": "c1",
        "title": "התקנה",
        "valid_until": "2099-01-01",
        "payment_terms": "מזומן",
        "margin_percent": 20,
    }
    items = [{"item_type": "catalog", "qty": 1, "unit_price": 100, "discount": 0, "description": "x"}]
    soft = advisory_checks(quote, items, {"name": "Aegis"}, {"quotes": {"margin_target": 30, "margin_minimum": 15}})
    codes = {g["code"] for g in soft}
    assert "margin_below_target" in codes
    assert validate_for_send(quote, items, {"name": "Aegis"}) == []


def test_nvr_channel_mismatch_is_critical():
    quote = {
        "customer_id": "c1",
        "title": "CCTV",
        "valid_until": "2099-01-01",
        "payment_terms": "מזומן",
        "summary": "",
    }
    items = [
        {"description": "מצלמת IPC", "name": "Camera", "qty": 9, "item_type": "catalog", "unit_price": 1, "discount": 0},
        {"description": "NVR 8CH", "name": "Recorder", "qty": 1, "item_type": "catalog", "unit_price": 1, "discount": 0},
    ]
    gaps = validate_for_send(quote, items, {"name": "Aegis"})
    assert any(g["code"] == "nvr_channel_mismatch" for g in gaps)


def test_percent_line_discount_in_engine():
    result = recalculate(
        [{"qty": 2, "unit_price": 100, "discount": 10, "discount_type": "percent", "cost": 40, "item_type": "catalog"}],
        vat_percent=0,
        discount_type=None,
        discount_value=0,
    )
    assert result["items"][0]["line_net"] == 180.0
    assert margin_status(10, target=30, minimum=15) == "critical"
