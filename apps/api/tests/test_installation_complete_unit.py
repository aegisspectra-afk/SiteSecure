from datetime import date

from app.installation_complete import handover_expires_at


def test_handover_ttl_minimum_12_months_when_no_warranty_end():
    completed = date(2026, 11, 17)
    exp = handover_expires_at(warranty_ends=None, completed_on=completed)
    assert exp.date() >= date(2027, 11, 12)


def test_handover_ttl_warranty_end_plus_30_when_longer():
    completed = date(2026, 11, 17)
    warranty_ends = date(2028, 11, 17)
    exp = handover_expires_at(warranty_ends=warranty_ends, completed_on=completed)
    assert exp.date() == date(2028, 12, 17)
