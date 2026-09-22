from __future__ import annotations

import pytest

from app.errors import ApiError
from app.job_lifecycle import OPEN_JOB_STATUSES, assert_transition


def test_en_route_from_scheduled():
    assert assert_transition("en_route", "scheduled") == "en_route"


def test_arrived_from_en_route():
    assert assert_transition("arrived", "en_route") == "arrived"


def test_start_from_arrived():
    assert assert_transition("start", "arrived") == "in_progress"


def test_start_from_en_route_legacy():
    assert assert_transition("start", "en_route") == "in_progress"


def test_complete_from_in_progress():
    assert assert_transition("complete", "in_progress") == "completed"


def test_invalid_complete_from_scheduled():
    with pytest.raises(ApiError) as exc:
        assert_transition("complete", "scheduled")
    assert exc.value.code == "BUSINESS_RULE"


def test_invalid_en_route_from_in_progress():
    with pytest.raises(ApiError) as exc:
        assert_transition("en_route", "in_progress")
    assert exc.value.code == "BUSINESS_RULE"


def test_cancel_from_open_states():
    for status in ("scheduled", "en_route", "arrived", "in_progress", "blocked"):
        assert assert_transition("cancel", status) == "cancelled"


def test_open_job_set_includes_arrived():
    assert "arrived" in OPEN_JOB_STATUSES
    assert "blocked" in OPEN_JOB_STATUSES


def test_invalid_complete_from_en_route():
    with pytest.raises(ApiError) as exc:
        assert_transition("complete", "en_route")
    assert exc.value.code == "BUSINESS_RULE"


def test_invalid_arrived_from_scheduled():
    with pytest.raises(ApiError) as exc:
        assert_transition("arrived", "scheduled")
    assert exc.value.code == "BUSINESS_RULE"


def test_invalid_start_from_completed():
    with pytest.raises(ApiError) as exc:
        assert_transition("start", "completed")
    assert exc.value.code == "BUSINESS_RULE"
