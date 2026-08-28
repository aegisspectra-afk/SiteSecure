from app.authz.usage import _quote_detail_he, customers_meter, quotes_meter


def test_quotes_meter_reads_catalog_limit():
    meter = quotes_meter(plan_key="solo", current=3, detail_he="טיוטה: 2 · נשלח: 1")
    assert meter["key"] == "quota_quotes"
    assert meter["label_he"] == "הצעות מחיר"
    assert meter["current"] == 3
    assert meter["limit"] == 50
    assert meter["unit"] == "quotes"
    assert meter["at_limit"] is False
    assert meter["detail_he"] == "טיוטה: 2 · נשלח: 1"


def test_clients_meter_reads_catalog_limit():
    meter = customers_meter(plan_key="solo", current=2, detail_he="פעילים: 2")
    assert meter["key"] == "quota_clients"
    assert meter["label_he"] == "לקוחות"
    assert meter["current"] == 2
    assert meter["limit"] == 30
    assert meter["unit"] == "customers"
    assert meter["at_limit"] is False


def test_quote_detail_he_formats_status_breakdown():
    detail = _quote_detail_he({"draft": 5, "sent": 4, "approved": 2, "rejected": 1})
    assert detail == "טיוטה: 5 · נשלח: 4 · אושר: 2 · נדחה: 1"
