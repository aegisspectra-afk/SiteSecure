"""Q4: cancelled quotes are excluded from dashboard-visible KPI rows."""

from app.quote_visibility import quote_is_visible_row


def test_cancelled_quote_not_visible_on_active_dashboard():
    row = {"id": "1", "status": "cancelled", "deleted_at": None, "archived_at": None}
    assert quote_is_visible_row(row, mode="active") is False


def test_sent_quote_still_visible():
    row = {"id": "1", "status": "sent", "deleted_at": None, "archived_at": None}
    assert quote_is_visible_row(row, mode="active") is True
