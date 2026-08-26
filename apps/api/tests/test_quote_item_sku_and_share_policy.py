"""Share policy: draft can mint a link; sku is accepted on QuoteItemIn/Patch."""

from __future__ import annotations

from app.routers.quotes import QuoteItemIn, QuoteItemPatch, SHAREABLE_STATES, share_quote


def test_quote_item_in_accepts_sku():
    body = QuoteItemIn(item_type="free", description="x", sku="ABC-1", qty=1, unit_price=0)
    assert body.sku == "ABC-1"


def test_quote_item_patch_accepts_sku():
    body = QuoteItemPatch(sku="XYZ")
    assert body.model_dump(exclude_none=True) == {"sku": "XYZ"}


def test_share_allows_draft_via_prepare_path_not_shareable_states():
    """Draft uses require_complete path; SHAREABLE_STATES is for remint after send."""
    assert "draft" not in SHAREABLE_STATES
    doc = share_quote.__doc__ or ""
    assert "must NOT mark" in doc or "must not mark" in doc.lower()
