"""DEMO-2.2: polluted «נדרש ציוד» descriptions must not block send for priced labor."""

from app.quote_rules import planned_equipment_rule


def _line(**kw):
    base = {
        "package_name": "",
        "name": "התקנת מצלמות · 3 שעות × ₪250",
        "description": "נדרש ציוד · התקנת מצלמות · 3 שעות × ₪250",
        "unit_price": 250,
        "item_type": "free",
        "is_optional": False,
    }
    base.update(kw)
    return base


def test_priced_labor_with_polluted_description_and_planned_package_does_not_block():
    items = [
        _line(package_name="cctv-planned:installation_camera"),
    ]
    assert planned_equipment_rule({}, items, {}, {}) == []


def test_priced_labor_item_type_labor_with_polluted_description_does_not_block():
    items = [_line(item_type="labor", package_name="cctv-labor:installation_camera")]
    assert planned_equipment_rule({}, items, {}, {}) == []


def test_polluted_description_only_priced_labor_hours_line_does_not_block():
    """Older rows sometimes kept the «נדרש ציוד» prefix but lost package_name after edits."""
    items = [_line(package_name="", name="התקנת מצלמות · 3 שעות × ₪250")]
    assert planned_equipment_rule({}, items, {}, {}) == []