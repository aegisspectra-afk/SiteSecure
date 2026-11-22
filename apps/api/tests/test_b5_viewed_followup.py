"""B5: viewed quotes older than 3 days surface as follow-up attention."""

from datetime import UTC, datetime, timedelta

from app.dashboard import _quote_attention


NOW = datetime(2026, 11, 22, 12, 0, tzinfo=UTC)


def test_viewed_within_3_days_stays_awaiting_us():
    quotes = [
        {
            "id": "q1",
            "number": "Q-1",
            "status": "viewed",
            "customer_id": None,
            "site_id": None,
            "viewed_at": (NOW - timedelta(days=1)).isoformat(),
            "updated_at": (NOW - timedelta(days=1)).isoformat(),
        }
    ]
    groups = _quote_attention(quotes, {}, NOW, "sales", frozenset())
    kinds = {g["kind"] for g in groups}
    assert "quote_awaiting_us" in kinds
    assert "quote_viewed_followup" not in kinds


def test_viewed_older_than_3_days_is_followup():
    quotes = [
        {
            "id": "q2",
            "number": "Q-2",
            "status": "viewed",
            "customer_id": None,
            "site_id": None,
            "viewed_at": (NOW - timedelta(days=4)).isoformat(),
            "updated_at": (NOW - timedelta(days=4)).isoformat(),
        }
    ]
    groups = _quote_attention(quotes, {}, NOW, "sales", frozenset())
    by_kind = {g["kind"]: g for g in groups}
    assert "quote_viewed_followup" in by_kind
    assert "quote_awaiting_us" not in by_kind
    item = by_kind["quote_viewed_followup"]["items"][0]
    assert item["title_he"] == "כדאי לחזור ללקוח"
    assert "whatsapp_followup" in (item.get("actions") or [])
