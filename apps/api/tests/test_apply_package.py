"""Package list helper and apply-package route registration."""

from __future__ import annotations

from app.routers.quote_cpq import _package_out


def test_package_out_maps_nested_count():
    row = {
        "id": "pkg-1",
        "name": "CCTV 4 Cameras",
        "quote_package_items": [{"count": 6}],
    }
    out = _package_out(row)
    assert out["item_count"] == 6
    assert "quote_package_items" not in out
    assert out["name"] == "CCTV 4 Cameras"


def test_package_out_handles_empty_items():
    out = _package_out({"id": "pkg-2", "name": "Empty", "quote_package_items": []})
    assert out["item_count"] == 0
