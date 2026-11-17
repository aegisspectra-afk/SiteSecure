from app.public_quote_extras import item_thumbnail_url, plain_cctv_system_summary


def test_plain_cctv_summary_from_requirements():
    line = plain_cctv_system_summary(
        {"cameraCount": 8, "environment": "indoor", "retentionDays": 14}
    )
    assert line is not None
    assert "8 מצלמות" in line
    assert "בפנים" in line
    assert "14" in line


def test_plain_cctv_summary_missing_cameras():
    assert plain_cctv_system_summary({"environment": "outdoor"}) is None
    assert plain_cctv_system_summary(None) is None


def test_item_thumbnail_from_snapshot():
    assert (
        item_thumbnail_url(
            {"catalog_snapshot": {"image_url": "https://cdn.example/cam.jpg"}}
        )
        == "https://cdn.example/cam.jpg"
    )
    assert item_thumbnail_url({"description": "x"}) is None
