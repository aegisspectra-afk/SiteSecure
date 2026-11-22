"""B3: project planned scope includes only the customer-chosen alternative."""

from __future__ import annotations

from app.project_scope_from_quote import plan_project_scope_from_snapshot, should_include_quote_item


def test_should_include_filters_other_tiers():
    assert should_include_quote_item(
        {"item_type": "catalog", "qty": 1, "alternative_id": "a1"},
        approved_alternative_id="a1",
    )
    assert not should_include_quote_item(
        {"item_type": "catalog", "qty": 1, "alternative_id": "a2"},
        approved_alternative_id="a1",
    )
    assert not should_include_quote_item(
        {"item_type": "catalog", "qty": 1, "alternative_id": None},
        approved_alternative_id="a1",
    )


def test_plan_scope_chosen_alternative_only():
    snapshot = {
        "approved_alternative_id": "a2",
        "sections": [
            {"id": "s1", "name": "בסיסי", "alternative_id": "a1"},
            {"id": "s2", "name": "מומלץ", "alternative_id": "a2"},
        ],
        "items": [
            {
                "id": "i1",
                "item_type": "catalog",
                "qty": 1,
                "unit_price": 100,
                "alternative_id": "a1",
                "section_id": "s1",
                "description": "מצלמה 2MP",
                "sku": "CAM-2",
            },
            {
                "id": "i2",
                "item_type": "catalog",
                "qty": 2,
                "unit_price": 200,
                "alternative_id": "a2",
                "section_id": "s2",
                "description": "מצלמה 4MP",
                "sku": "CAM-4",
            },
            {
                "id": "i3",
                "item_type": "catalog",
                "qty": 1,
                "unit_price": 300,
                "alternative_id": "a3",
                "description": "מצלמה 8MP",
                "sku": "CAM-8",
            },
        ],
    }
    rows = plan_project_scope_from_snapshot(
        snapshot=snapshot,
        workspace_id="ws",
        project_id="p1",
        source_quote_id="q1",
        source_quote_version=1,
    )
    assert len(rows) == 1
    assert rows[0]["sku"] == "CAM-4"
    assert "CAM-2" not in {r.get("sku") for r in rows}
    assert "CAM-8" not in {r.get("sku") for r in rows}
