"""D1 bug: "הצעות אחרונות" was empty although the workspace had quotes.

The API sent the 5 newest quotes and the web dropped every one already listed under
"needs attention"; when all 5 were there, the card claimed there were no quotes.
"""

from __future__ import annotations

from tests.test_dashboard import _build


def _quote(n: int, status: str, updated: str) -> dict:
    return {
        "id": f"q{n}",
        "number": f"Q-{n:05d}",
        "status": status,
        "customer_id": "c1",
        "site_id": "s1",
        "owner_user_id": "u1",
        "valid_until": "2026-12-01",
        "updated_at": updated,
        "total_gross": 100,
    }


def _attention_quote_ids(payload: dict) -> set[str]:
    return {
        item["entity_id"]
        for group in payload["attention"]
        for item in group["items"]
        if item["entity_type"] == "quote"
    }


def test_recent_quotes_skip_attention_and_fill_from_older_quotes():
    # Newest five need attention (approved without project / sent / viewed); older ones are drafts.
    newest = [
        _quote(i, status, f"2026-08-14T0{i}:00:00+00:00")
        for i, status in enumerate(["approved", "approved", "sent", "viewed", "viewed"], start=1)
    ]
    drafts = [_quote(10 + i, "draft", f"2026-08-1{i}T00:00:00+00:00") for i in range(3)]
    quotes = sorted(newest + drafts, key=lambda q: q["updated_at"], reverse=True)

    payload = _build("owner", quotes=quotes, project_source_quote_ids=frozenset())

    attention_ids = _attention_quote_ids(payload)
    assert {q["id"] for q in newest} <= attention_ids
    recent_ids = [q["id"] for q in payload["recent_quotes"]]
    assert recent_ids, "recent quotes must not be empty when the workspace has quotes"
    assert not set(recent_ids) & attention_ids
    assert recent_ids == [q["id"] for q in quotes if q["id"] not in attention_ids][:5]


def test_recent_quotes_fall_back_to_newest_when_all_need_attention():
    quotes = [_quote(i, "sent", f"2026-08-14T0{i}:00:00+00:00") for i in range(1, 4)]
    quotes.reverse()
    payload = _build("owner", quotes=quotes, project_source_quote_ids=frozenset())
    assert [q["id"] for q in payload["recent_quotes"]] == [q["id"] for q in quotes]


def test_recent_quotes_capped_at_five():
    quotes = [_quote(i, "draft", f"2026-08-0{i}T00:00:00+00:00") for i in range(1, 9)]
    quotes.reverse()
    payload = _build("owner", quotes=quotes)
    assert len(payload["recent_quotes"]) == 5
