"""QUOTE-11 / SYSTEM-DESIGNER-1F — planned CCTV equipment send-block."""

from app.quote_rules import planned_equipment_rule


def test_planned_equipment_blocks_with_count_and_clean_names():
    items = [
        {
            "name": "NVR",
            "description": "NVR",
            "package_name": "cctv-planned:recorder",
            "is_optional": False,
        },
        {
            "name": "כונן HDD",
            "description": "כונן HDD",
            "package_name": "cctv-planned:storage",
            "is_optional": False,
        },
        {
            "name": "מתג PoE",
            "description": "מתג PoE",
            "package_name": "cctv-planned:poe_switch",
            "is_optional": False,
        },
        {
            "name": "UPS",
            "description": "UPS",
            "package_name": "cctv-planned:ups",
            "is_optional": True,
        },
    ]
    gaps = planned_equipment_rule({}, items, {}, {})
    assert len(gaps) == 1
    msg = gaps[0]["message"]
    assert "יש להשלים 3 רכיבי חובה לפני שליחת ההצעה." in msg
    assert "NVR" in msg
    assert "כונן HDD" in msg
    assert "מתג PoE" in msg
    assert "UPS" not in msg
    assert "cctv-planned:" not in msg


def test_planned_equipment_optional_only_does_not_block():
    items = [
        {
            "name": "UPS",
            "description": "UPS",
            "package_name": "cctv-planned:ups",
            "is_optional": True,
        }
    ]
    assert planned_equipment_rule({}, items, {}, {}) == []


def test_planned_equipment_strips_legacy_polluted_description():
    items = [
        {
            "name": "",
            "description": "נדרש ציוד · מתג PoE · נדרש ≥2 יציאות",
            "package_name": "cctv-planned:poe_switch",
            "is_optional": False,
        }
    ]
    gaps = planned_equipment_rule({}, items, {}, {})
    assert len(gaps) == 1
    assert "מתג PoE" in gaps[0]["message"]
    assert "cctv-planned:" not in gaps[0]["message"]
    assert "יש להשלים 1 רכיבי חובה" in gaps[0]["message"]
