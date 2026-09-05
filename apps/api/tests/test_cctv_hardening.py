"""Task 14 — CCTV Build System hardening: cable units, services, empty catalog, boundaries."""

from __future__ import annotations

from app.cctv_recommend import (
    build_system_recommendation,
    catalog_readiness,
    resolve_cable,
    resolve_service,
)
from app.cctv_sizing import calculate_poe, pack_hdds, size_recorder


def _prod(pid, key, name, attrs, unit="ea", kind="product"):
    return {
        "id": pid,
        "sku": pid,
        "name": name,
        "category_key": key,
        "attributes": attrs,
        "unit": unit,
        "kind": kind,
        "manufacturer": "QA",
    }


def test_empty_catalog_still_returns_engineering():
    rec = build_system_recommendation(
        raw_input={
            "camera_count": 4,
            "resolution_mp": 4,
            "environment": "outdoor",
            "retention_days": 14,
            "recording_mode": "continuous",
            "poe_required": True,
            "camera_max_power_w": 8,
            "architecture_intent": "prefer_nvr_integrated",
            "installation_requested": False,
        },
        catalog_products=[],
    )
    assert rec["engineering"]["recorder"]["selectedChannelTier"] == 4
    assert rec["catalog_readiness"]["empty_catalog"] is True
    assert rec["catalog_readiness"]["ready_for_core"] is False
    assert rec["blocking"] is True
    assert any(w["code"] == "CATALOG_EMPTY" for w in rec["warnings"])


def test_catalog_readiness_partial_structured():
    products = [
        _prod("c1", "cameras_ip", "Cam", {"resolution_mp": 4, "environment": "outdoor"}),
        _prod("n1", "nvr", "NVR text only", {}),
    ]
    r = catalog_readiness(products)
    assert r["camera_structured"] == 1
    assert r["nvr_structured"] == 0
    assert r["ready_for_core"] is False
    assert "recorder" in r["missing_families"]


def test_cable_meter_unit_selected_discrete_not_auto():
    meter = _prod("cab-m", "cat6", "Cat6 /m", {}, unit="m")
    box = _prod("cab-box", "cat6", "Cat6 box", {}, unit="ea")
    resolved = resolve_cable(products=[box, meter], meters=120)
    assert resolved["status"] == "RESOLVED"
    assert resolved["selected"]["product"]["id"] == "cab-m"
    assert resolved["selected"]["quantity"] == 120
    assert resolved["selected"]["confidence"] == "STRUCTURED"
    # discrete still listed as candidate requiring manual qty
    assert any(c["product"]["id"] == "cab-box" for c in resolved["candidates"])


def test_cable_only_discrete_no_auto_select():
    box = _prod("cab-box", "cat6", "Cat6 box", {}, unit="box")
    resolved = resolve_cable(products=[box], meters=80)
    assert resolved["selected"] is None
    assert resolved["status"] == "UNRESOLVED" or resolved["status"] == "PARTIAL"
    assert any(w["code"] == "CABLE_NO_METER_UNIT_PRODUCT" for w in resolved["warnings"])


def test_service_does_not_pick_random_labor():
    labor = _prod("lab1", "labor_hourly", "Hourly", {}, kind="service")
    resolved = resolve_service(
        role="camera_install",
        qty=4,
        products=[labor],
        preferred_keys=frozenset({"labor_install_cameras"}),
    )
    assert resolved["status"] == "UNRESOLVED"
    assert resolved["selected"] is None


def test_service_matches_preferred_leaf_only():
    wrong = _prod("lab1", "labor_hourly", "Hourly", {}, kind="service")
    right = _prod("lab2", "labor_install_cameras", "Install cam", {}, kind="service")
    resolved = resolve_service(
        role="camera_install",
        qty=4,
        products=[wrong, right],
        preferred_keys=frozenset({"labor_install_cameras"}),
    )
    assert resolved["selected"]["product"]["id"] == "lab2"
    assert resolved["status"] == "RESOLVED"


def test_poe_budget_boundary_exact_fit():
    # 4 cams * 8W * 1.2 headroom = 38.4W
    poe = calculate_poe({"cameraCount": 4, "cameraMaxPowerW": 8, "poeHeadroom": 0.2})
    assert poe["status"] == "ok"
    assert abs(poe["requiredBudgetW"] - 38.4) < 1e-9


def test_hdd_exact_fit_and_bay_failure():
    ok = pack_hdds(required_tb=10, available_capacities_tb=[10], drive_bays=1, max_hdd_tb=10)
    assert ok["status"] == "ok"
    assert ok["driveCount"] == 1
    fail = pack_hdds(required_tb=20, available_capacities_tb=[10], drive_bays=1, max_hdd_tb=10)
    assert fail["status"] != "ok"


def test_recorder_unsupported_boundary():
    assert size_recorder(65)["status"] == "unsupported"
    assert size_recorder(64)["selectedChannelTier"] == 64
