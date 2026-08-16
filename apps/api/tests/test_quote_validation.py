from app.quote_validation import validate_for_send


def test_send_requires_customer_title_terms_and_item():
    quote = {
        "customer_id": None,
        "title": "",
        "valid_until": None,
        "payment_terms": "",
    }
    gaps = validate_for_send(quote, [], {"name": "Aegis"})
    codes = {gap["code"] for gap in gaps}
    assert codes == {"customer", "title", "valid_until", "payment_terms", "items"}


def test_send_accepts_complete_quote():
    quote = {
        "customer_id": "c1",
        "title": "התקנה",
        "valid_until": "2099-01-01",
        "payment_terms": "שוטף +30",
    }
    items = [{"item_type": "catalog", "qty": 2, "unit_price": 100, "discount": 0}]
    assert validate_for_send(quote, items, {"name": "Aegis"}) == []


def test_note_is_not_billable():
    quote = {
        "customer_id": "c1",
        "title": "התקנה",
        "valid_until": "2099-01-01",
        "payment_terms": "מזומן",
    }
    items = [{"item_type": "note", "qty": 1, "unit_price": 0, "discount": 0}]
    codes = {gap["code"] for gap in validate_for_send(quote, items, {"name": "עסק"})}
    assert "items" in codes


def test_company_name_required():
    quote = {
        "customer_id": "c1",
        "title": "התקנה",
        "valid_until": "2099-01-01",
        "payment_terms": "מזומן",
    }
    items = [{"item_type": "free", "qty": 1, "unit_price": 10, "discount": 0}]
    codes = {gap["code"] for gap in validate_for_send(quote, items, {"name": "  "})}
    assert "company" in codes
