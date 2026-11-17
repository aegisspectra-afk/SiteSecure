from datetime import date

from app.errors import ApiError
from app.installation_complete import (
    _completion_notes_match,
    _idempotency_conflict,
    handover_expires_at,
)


def test_handover_ttl_minimum_12_months_when_no_warranty_end():
    completed = date(2026, 11, 17)
    exp = handover_expires_at(warranty_ends=None, completed_on=completed)
    assert exp.date() >= date(2027, 11, 12)


def test_handover_ttl_warranty_end_plus_30_when_longer():
    completed = date(2026, 11, 17)
    warranty_ends = date(2028, 11, 17)
    exp = handover_expires_at(warranty_ends=warranty_ends, completed_on=completed)
    assert exp.date() == date(2028, 12, 17)


def test_completion_notes_match_prefers_stored_request():
    job = {"completion_notes": "ישן"}
    result = {"request": {"completion_notes": "מקור"}}
    assert _completion_notes_match(job, result, "מקור") is True
    assert _completion_notes_match(job, result, "אחר") is False


def test_completion_notes_match_falls_back_to_job_column():
    job = {"completion_notes": "מקור"}
    assert _completion_notes_match(job, {}, "מקור") is True
    assert _completion_notes_match(job, {}, "אחר") is False


def test_idempotency_conflict_shape():
    err = _idempotency_conflict()
    assert isinstance(err, ApiError)
    assert err.status_code == 409 and err.code == "IDEMPOTENCY_CONFLICT"
