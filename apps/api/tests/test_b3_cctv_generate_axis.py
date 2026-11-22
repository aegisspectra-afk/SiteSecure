"""B3: CCTV generate-alternatives axis summaries stay customer-safe."""

from app.routers.quote_cpq import _CCTV_AXIS_SUMMARIES
from app.routers.quotes import QuoteItemIn


def test_cctv_axis_summaries_cover_resolution_and_retention():
    assert len(_CCTV_AXIS_SUMMARIES["resolution"]) == 3
    assert len(_CCTV_AXIS_SUMMARIES["retention"]) == 3
    joined = " ".join(_CCTV_AXIS_SUMMARIES["resolution"] + _CCTV_AXIS_SUMMARIES["retention"])
    assert "2MP" in joined and "4MP" in joined and "8MP" in joined
    assert "7" in joined and "14" in joined and "30" in joined
    for banned in ("עלות", "רווח", "cost", "margin", "profit"):
        assert banned not in joined.lower()


def test_quote_item_in_accepts_alternative_id():
    body = QuoteItemIn(
        description="מצלמה",
        qty=1,
        unit_price=100,
        alternative_id="alt-1",
    )
    assert body.alternative_id == "alt-1"
