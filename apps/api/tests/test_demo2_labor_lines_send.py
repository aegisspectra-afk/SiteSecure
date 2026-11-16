"""DEMO-2.2: priced labor lines from the CCTV wizard are work, not "missing equipment".

Sending is blocked only by required equipment that was not actually chosen.
"""

from app.quote_rules import planned_equipment_rule


def _line(pkg, name, price, item_type="free", optional=False):
    return {"package_name": pkg, "name": name, "description": name, "unit_price": price,
            "item_type": item_type, "is_optional": optional}


def test_new_labor_lines_never_block():
    items = [
        _line("cctv-labor:installation_camera", "התקנת מצלמות · 3 שעות × ₪250", 250, "labor"),
        _line("cctv-labor:testing_main", "בדיקות ומסירה · 0.5 שעות", 0, "labor"),
    ]
    assert planned_equipment_rule({}, items, {}, {}) == []


def test_legacy_priced_labor_lines_do_not_block():
    """Quotes made before the fix stored labor under cctv-planned:."""
    items = [
        _line("cctv-planned:installation_camera", "התקנת מצלמות · 3 שעות × ₪250", 250),
        _line("cctv-planned:recorder_setup_main", "הגדרת מקליט · 0.5 שעות × ₪250", 250),
        _line("cctv-planned:testing_main", "בדיקות ומסירה · 0.5 שעות × ₪250", 250),
    ]
    assert planned_equipment_rule({}, items, {}, {}) == []


def test_unchosen_equipment_still_blocks():
    items = [
        _line("cctv-labor:installation_camera", "התקנת מצלמות · 3 שעות × ₪250", 250, "labor"),
        _line("cctv-planned:recorder_main", "מקליט", 0),
        _line("cctv-planned:storage_main", "כונן", 0),
    ]
    gaps = planned_equipment_rule({}, items, {}, {})
    assert len(gaps) == 1
    msg = gaps[0]["message"]
    assert "2 רכיבי חובה" in msg and "מקליט" in msg and "התקנת" not in msg
