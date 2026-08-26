"""Share link must not mark a quote as sent."""

from __future__ import annotations

from app.routers import quotes as quotes_router


def test_shareable_states_exclude_draft():
    assert "draft" not in quotes_router.SHAREABLE_STATES
    assert "sent" in quotes_router.SHAREABLE_STATES


def test_share_quote_docstring_forbids_auto_sent():
    doc = (quotes_router.share_quote.__doc__ or "").lower()
    assert "must not mark" in doc or "לא" in (quotes_router.share_quote.__doc__ or "")
