from app.pricing import recalculate
from app.routers.quotes import COST_FIELDS, ITEM_COST_FIELDS, _strip_cost
from app.quote_snapshot import public_items, public_payload


def test_optional_item_excluded_from_base_total():
    result = recalculate(
        [
            {
                "qty": 1,
                "unit_price": 1000,
                "discount": 0,
                "cost": 400,
                "item_type": "catalog",
                "is_optional": False,
            },
            {
                "qty": 1,
                "unit_price": 250,
                "discount": 0,
                "cost": 80,
                "item_type": "catalog",
                "is_optional": True,
            },
        ],
        vat_percent=18,
        discount_type=None,
        discount_value=0,
    )
    assert result["subtotal_net"] == 1000.0
    assert result["vat_amount"] == 180.0
    assert result["total_gross"] == 1180.0
    assert result["optional_subtotal"] == 250.0
    assert result["optional_vat_amount"] == 45.0
    assert result["optional_total_gross"] == 295.0
    assert result["total_with_options_gross"] == 1475.0
    assert result["cost_total"] == 400.0
    assert result["optional_cost_total"] == 80.0
    assert result["margin_amount"] == 600.0


def test_optional_with_line_section_quote_discount_order():
    result = recalculate(
        [
            {
                "qty": 1,
                "unit_price": 200,
                "discount": 10,
                "discount_type": "percent",
                "cost": 50,
                "item_type": "catalog",
                "section_id": "s1",
                "is_optional": False,
            },
            {
                "qty": 1,
                "unit_price": 100,
                "discount": 0,
                "cost": 20,
                "item_type": "catalog",
                "section_id": "s1",
                "is_optional": True,
            },
        ],
        vat_percent=0,
        discount_type="amount",
        discount_value=10,
        sections=[{"id": "s1", "discount_type": "percent", "discount_value": 10}],
    )
    # Required line: 200 − 10% = 180; section −10% = 162; quote −10 = 152
    # Optional: 100 (excluded from section/quote discounts)
    assert result["lines_subtotal"] == 162.0
    assert result["section_discount_amount"] == 18.0
    assert result["quote_discount_amount"] == 10.0
    assert result["subtotal_net"] == 152.0
    assert result["optional_subtotal"] == 100.0
    assert result["total_gross"] == 152.0
    assert result["total_with_options_gross"] == 252.0


def test_strip_cost_removes_profit_fields():
    quote = {
        "id": "q1",
        "subtotal_net": 100,
        "cost_total": 40,
        "margin_amount": 60,
        "margin_percent": 60,
        "optional_cost_total": 12,
        "gross_profit": 60,
    }
    items = [
        {
            "id": "i1",
            "cost": 40,
            "line_cost": 40,
            "gross_profit": 60,
            "margin_percent": 60,
            "unit_price": 100,
            "catalog_snapshot": {"list_price": 100, "cost": 40},
        }
    ]
    stripped = _strip_cost(quote, items, show_cost=False)
    for field in COST_FIELDS:
        assert field not in stripped
    assert "cost" not in stripped["items"][0]
    assert "line_cost" not in stripped["items"][0]
    assert "gross_profit" not in stripped["items"][0]
    assert "margin_percent" not in stripped["items"][0]
    assert "cost" not in (stripped["items"][0].get("catalog_snapshot") or {})
    assert stripped["items"][0]["unit_price"] == 100

    kept = _strip_cost(quote, items, show_cost=True)
    assert kept["cost_total"] == 40
    assert kept["items"][0]["cost"] == 40


def test_public_items_include_optional_flag_without_cost():
    rows = public_items(
        [
            {
                "id": "i1",
                "item_type": "catalog",
                "description": "Cam",
                "qty": 1,
                "unit_price": 100,
                "discount": 0,
                "line_net": 100,
                "cost": 40,
                "is_optional": True,
            }
        ]
    )
    assert rows[0]["is_optional"] is True
    assert "cost" not in rows[0]


def test_public_payload_optional_totals():
    payload = public_payload(
        {
            "id": "q1",
            "number": "Q-1",
            "version": 1,
            "status": "draft",
            "currency": "ILS",
            "vat_percent": 18,
            "subtotal_net": 100,
            "vat_amount": 18,
            "total_gross": 118,
            "optional_subtotal": 50,
            "optional_vat_amount": 9,
            "optional_total_gross": 59,
            "total_with_options_gross": 177,
        },
        [],
        workspace={"name": "Acme", "vat_percent": 18},
        customer=None,
        site=None,
    )
    assert payload["optional_subtotal"] == 50
    assert payload["total_with_options_gross"] == 177
    assert "cost_total" not in payload
    assert "margin_percent" not in payload


def test_postgrest_quote_items_select_has_no_column_mask():
    """Q4.3 historical: foundation RLS alone does not mask cost columns."""
    from pathlib import Path

    migration = Path(__file__).resolve().parents[3] / "supabase/migrations/0016_quotes.sql"
    text = migration.read_text(encoding="utf-8")
    assert "CREATE POLICY quote_items_select" in text
    assert "FOR SELECT" in text
    # No column-level REVOKE/GRANT for cost in foundation migration.
    assert "REVOKE SELECT (cost)" not in text
    assert "quote_items.cost" not in text or "cost numeric" in text


def test_q4s_cost_column_lockdown_migration():
    """Q4-S: authenticated cannot SELECT cost; service_role can; snapshot scrubbed."""
    from pathlib import Path

    root = Path(__file__).resolve().parents[3] / "supabase/migrations"
    v1 = (root / "20260927205033_quote_items_cost_column_lockdown.sql").read_text(encoding="utf-8")
    v2 = (root / "20260927210000_quote_items_cost_column_lockdown_v2.sql").read_text(encoding="utf-8")
    combined = v1 + "\n" + v2
    assert "REVOKE SELECT ON TABLE public.quote_items FROM authenticated" in combined
    assert "REVOKE SELECT ON TABLE public.quotes FROM authenticated" in combined
    assert "REVOKE SELECT ON TABLE public.products FROM authenticated" in combined
    assert "GRANT SELECT ON TABLE public.quote_items TO service_role" in combined
    assert "quote_items_scrub_catalog_cost" in v1
    assert "catalog_snapshot - 'cost'" in v1
    # Safe columns granted — cost omitted from authenticated SELECT list
    assert "unit_price" in combined
    assert "GRANT SELECT (\n  id, workspace_id, quote_id" in combined or "GRANT SELECT (\nid, workspace_id, quote_id" in combined.replace(" ", "")

def test_legacy_snapshot_missing_optional_keys_compatible():
    """Historical sent snapshots without is_optional / optional_* remain immutable-safe."""
    payload = public_payload(
        {
            "id": "q1",
            "number": "Q-1",
            "status": "sent",
            "currency": "ILS",
            "vat_percent": 18,
            "subtotal_net": 100,
            "vat_amount": 18,
            "total_gross": 118,
            "version": 1,
        },
        [
            {
                "id": "i1",
                "item_type": "catalog",
                "description": "מצלמה",
                "qty": 1,
                "unit_price": 100,
                "discount": 0,
                "line_net": 100,
                # intentionally no is_optional
            }
        ],
        workspace={"name": "Aegis"},
        customer={"display_name": "לקוח"},
        site=None,
    )
    assert payload["items"][0].get("is_optional") is False
    # optional aggregate keys may be absent on legacy snapshots — never invent cost
    assert "cost_total" not in payload
    assert "optional_cost_total" not in payload