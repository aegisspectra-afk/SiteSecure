"""Quote list rows carry the net revenue the list margin KPI divides by."""

from app.routers import quotes


def test_list_select_includes_net_revenue_for_margin_percent():
    # Margin % = margin_amount / subtotal_net (pricing.recalculate); total_gross includes VAT.
    fields = quotes.QUOTE_LIST_SELECT.split(",")
    assert "subtotal_net" in fields
    assert "total_gross" in fields
    # Cost columns stay out of the member-readable list select.
    assert not {"cost_total", "margin_amount", "margin_percent"} & set(fields)
