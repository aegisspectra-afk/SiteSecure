"""Service warranty reminders: 60/14 days, dedupe, dashboard card (TDD)."""

from __future__ import annotations

from datetime import date, timedelta

from app.warranty_reminders import (
    REMINDER_DAYS,
    due_reminder_windows,
    reminder_title_he,
)


def test_reminder_windows_are_60_and_14():
    assert REMINDER_DAYS == (60, 14)


def test_due_on_exact_day_matches_window():
    today = date(2026, 11, 22)
    ends = today + timedelta(days=60)
    assert due_reminder_windows(ends_on=ends, today=today) == (60,)
    ends14 = today + timedelta(days=14)
    assert due_reminder_windows(ends_on=ends14, today=today) == (14,)


def test_not_due_on_other_days():
    today = date(2026, 11, 22)
    assert due_reminder_windows(ends_on=today + timedelta(days=59), today=today) == ()
    assert due_reminder_windows(ends_on=today + timedelta(days=15), today=today) == ()
    assert due_reminder_windows(ends_on=None, today=today) == ()


def test_hebrew_titles():
    assert "60" in reminder_title_he(60)
    assert "14" in reminder_title_he(14)
    assert "אחריות" in reminder_title_he(60)
