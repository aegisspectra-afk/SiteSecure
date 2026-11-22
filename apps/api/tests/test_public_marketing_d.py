"""Stage D public marketing API — pricing + storage calculator."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.routers import public_marketing as pub

client = TestClient(app)


def test_public_pricing_matches_catalog():
    res = client.get("/api/v1/public/pricing")
    assert res.status_code == 200
    body = res.json()
    assert body["billing"]["annual_bonus_months"] == 2
    keys = [p["key"] for p in body["plans"]]
    assert keys == ["free", "pro", "business", "enterprise"]
    pro = next(p for p in body["plans"] if p["key"] == "pro")
    assert pro["commercial"]["monthly_ils_before_vat"] == 129
    assert pro["annual_monthly_ils_before_vat"] == round((129 * 12) / 14)


def test_public_cctv_storage_calculate():
    pub.clear_rate_limit_buckets()
    res = client.post(
        "/api/v1/public/tools/cctv-storage/calculate",
        json={
            "camera_count": 8,
            "resolution_mp": 4,
            "retention_days": 30,
            "recording_mode": "continuous",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["storage"]["status"] == "ok"
    assert body["storage"]["required_tb"] > 0
    assert body["recorder"]["channels"] in (8, 16)
    assert "price" not in str(body).lower()


def test_beta_signup_validation():
    pub.clear_rate_limit_buckets()
    bad = client.post("/api/v1/public/beta-signups", json={"full_name": "x"})
    assert bad.status_code == 400