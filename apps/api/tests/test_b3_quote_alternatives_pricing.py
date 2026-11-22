"""B3: per-alternative pricing isolation (unit, no DB)."""

from __future__ import annotations

from app.pricing import recalculate, recalculate_alternatives


def test_recalculate_alternatives_isolates_tiers():
    alts = [
        {"id": "a1", "label": "בסיסי", "sort_order": 1, "is_recommended": False},
        {"id": "a2", "label": "מומלץ", "sort_order": 2, "is_recommended": True},
        {"id": "a3", "label": "מתקדם", "sort_order": 3, "is_recommended": False},
    ]
    items = [
        {
            "id": "i1",
            "alternative_id": "a1",
            "item_type": "catalog",
            "qty": 1,
            "unit_price": 1000,
            "cost": 600,
            "discount": 0,
            "discount_type": "amount",
        },
        {
            "id": "i2",
            "alternative_id": "a2",
            "item_type": "catalog",
            "qty": 1,
            "unit_price": 2000,
            "cost": 1000,
            "discount": 0,
            "discount_type": "amount",
        },
        {
            "id": "i3",
            "alternative_id": "a3",
            "item_type": "catalog",
            "qty": 1,
            "unit_price": 3000,
            "cost": 1500,
            "discount": 0,
            "discount_type": "amount",
        },
        {
            "id": "note",
            "alternative_id": None,
            "item_type": "note",
            "qty": 1,
            "unit_price": 0,
            "cost": 0,
            "discount": 0,
            "description": "הערה משותפת",
        },
    ]
    breakdown = recalculate_alternatives(
        items,
        alts,
        vat_percent=17,
        discount_type="amount",
        discount_value=0,
        sections=[],
    )
    assert len(breakdown) == 3
    by_id = {row["alternative_id"]: row for row in breakdown}
    assert by_id["a1"]["subtotal_net"] == 1000.0
    assert by_id["a2"]["subtotal_net"] == 2000.0
    assert by_id["a3"]["subtotal_net"] == 3000.0
    assert by_id["a2"]["is_recommended"] is True
    # Shared note must not inflate any tier.
    assert by_id["a1"]["total_gross"] == recalculate(
        [items[0]], vat_percent=17, discount_type="amount", discount_value=0
    )["total_gross"]


def test_recalculate_alternatives_inherits_section_alternative():
    alts = [{"id": "a1", "label": "בסיסי", "sort_order": 1, "is_recommended": True}]
    sections = [{"id": "s1", "alternative_id": "a1", "discount_type": "amount", "discount_value": 0}]
    items = [
        {
            "id": "i1",
            "section_id": "s1",
            "alternative_id": None,
            "item_type": "catalog",
            "qty": 2,
            "unit_price": 500,
            "cost": 200,
            "discount": 0,
            "discount_type": "amount",
        }
    ]
    breakdown = recalculate_alternatives(
        items,
        alts,
        vat_percent=17,
        discount_type="amount",
        discount_value=0,
        sections=sections,
    )
    assert breakdown[0]["subtotal_net"] == 1000.0
