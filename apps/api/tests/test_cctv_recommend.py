"""Structured catalog resolver unit tests (Task 13C)."""

from __future__ import annotations

from app.cctv_recommend import (
    build_system_recommendation,
    resolve_cameras,
    resolve_hdds,
    resolve_recorders,
    resolve_switches,
)


def _prod(pid: str, key: str, name: str, attrs: dict, mfr: str = "Acme") -> dict:
    return {
        "id": pid,
        "sku": f"SKU-{pid}",
        "name": name,
        "manufacturer": mfr,
        "model": name,
        "category_key": key,
        "unit": "unit",
        "list_price": 100,
        "attributes": attrs,
        "kind": "product",
        "is_active": True,
    }


def test_camera_resolution_ranking_and_environment():
    products = [
        _prod("c1", "cameras_ip", "Cam 4MP Outdoor", {"resolution_mp": 4, "environment": "outdoor", "poe": True}),
        _prod("c2", "cameras_ip", "Cam 8MP Outdoor", {"resolution_mp": 8, "environment": "outdoor", "poe": True}),
        _prod("c3", "cameras_ip", "Cam 4MP Indoor", {"resolution_mp": 4, "environment": "indoor", "poe": True}),
        _prod("c4", "cameras_ip", "Cam Missing Res", {"environment": "outdoor", "poe": True}),
    ]
    r = resolve_cameras(
        products=products,
        requested_mp=4,
        environment="outdoor",
        form_factor=None,
        poe_required=True,
        manufacturer_preference=None,
    )
    assert r["status"] in {"RESOLVED", "PARTIAL"}
    assert r["selected"]["product"]["id"] == "c1"
    ids = [c["product"]["id"] for c in r["candidates"]]
    assert "c1" in ids
    assert "c2" in ids
    assert "c3" not in ids
    assert "c4" not in ids


def test_preferred_manufacturer_boost_and_invalid_does_not_win():
    products = [
        _prod("c1", "cameras_ip", "Other 4MP", {"resolution_mp": 4, "environment": "outdoor", "poe": True}, mfr="Other"),
        _prod("c2", "cameras_ip", "Pref 2MP", {"resolution_mp": 2, "environment": "outdoor", "poe": True}, mfr="PrefCo"),
        _prod("c3", "cameras_ip", "Pref 4MP", {"resolution_mp": 4, "environment": "outdoor", "poe": True}, mfr="PrefCo"),
    ]
    r = resolve_cameras(
        products=products,
        requested_mp=4,
        environment="outdoor",
        form_factor=None,
        poe_required=True,
        manufacturer_preference="PrefCo",
    )
    assert r["selected"]["product"]["id"] == "c3"

    r2 = resolve_cameras(
        products=products[:2],
        requested_mp=4,
        environment="outdoor",
        form_factor=None,
        poe_required=True,
        manufacturer_preference="PrefCo",
    )
    assert r2["selected"]["product"]["id"] == "c1"
    assert any(w["code"] == "PREFERRED_MANUFACTURER_UNAVAILABLE" for w in r2["warnings"])


def test_recorder_channel_and_poe_constraints():
    products = [
        _prod("n8", "nvr", "NVR 8", {"channels": 8, "drive_bays": 2, "max_hdd_tb": 10, "poe_ports": 8, "poe_budget_w": 100}),
        _prod("n16", "nvr", "NVR 16", {"channels": 16, "drive_bays": 4, "max_hdd_tb": 12, "poe_ports": 16, "poe_budget_w": 200}),
        _prod("n32", "nvr", "NVR 32", {"channels": 32, "drive_bays": 4, "max_hdd_tb": 12, "poe_ports": 16, "poe_budget_w": 200}),
        _prod("ntext", "nvr", "NVR Text 16CH", {}),
    ]
    r = resolve_recorders(
        products=products,
        min_channels=16,
        require_integrated_poe=True,
        required_poe_ports=12,
        required_poe_budget_w=115.2,
        min_drive_bays=2,
        min_max_hdd_tb=10,
        manufacturer_preference=None,
    )
    assert r["selected"]["product"]["id"] == "n16"
    ids = [c["product"]["id"] for c in r["candidates"]]
    assert "n8" not in ids
    assert "n16" in ids
    assert "n32" in ids
    # 16 ranks before 32
    assert ids.index("n16") < ids.index("n32")


def test_recorder_text_only_unresolved():
    products = [_prod("ntext", "nvr", "NVR maybe 16CH", {})]
    r = resolve_recorders(
        products=products,
        min_channels=16,
        require_integrated_poe=False,
        required_poe_ports=None,
        required_poe_budget_w=None,
        min_drive_bays=None,
        min_max_hdd_tb=None,
        manufacturer_preference=None,
    )
    assert r["status"] == "UNRESOLVED"
    assert r["selected"] is None
    assert r["candidates"][0]["confidence"] == "TEXT_ASSISTED"


def test_hdd_and_switch_resolution():
    products = [
        _prod("h8", "hdd_recorders", "HDD 8", {"capacity_tb": 8, "surveillance_grade": True}),
        _prod("h10", "hdd_recorders", "HDD 10", {"capacity_tb": 10, "surveillance_grade": True}),
        _prod("h12", "hdd_recorders", "HDD 12", {"capacity_tb": 12, "surveillance_grade": True}),
        _prod("s8", "switch", "SW 8", {"ports": 8, "poe_ports": 8, "poe_budget_w": 100}),
        _prod("s16_low", "switch", "SW 16 low", {"ports": 16, "poe_ports": 16, "poe_budget_w": 100}),
        _prod("s16", "switch", "SW 16 ok", {"ports": 16, "poe_ports": 16, "poe_budget_w": 180}),
        _prod("s24", "switch", "SW 24", {"ports": 24, "poe_ports": 24, "poe_budget_w": 250}),
    ]
    h = resolve_hdds(products=products, required_tb=18.6624, drive_bays=4, max_hdd_tb=12, manufacturer_preference=None)
    assert h["status"] in {"RESOLVED", "PARTIAL"}
    assert h["packing"]["driveCount"] == 2
    assert h["packing"]["driveCapacityTb"] == 10
    assert h["selected"]["product"]["id"] == "h10"
    assert h["quantity"] == 2

    s = resolve_switches(
        products=products,
        min_ports=12,
        min_poe_ports=12,
        min_budget_w=115.2,
        manufacturer_preference=None,
    )
    assert s["selected"]["product"]["id"] == "s16"
    ids = [c["product"]["id"] for c in s["candidates"]]
    assert "s8" not in ids
    assert "s16_low" not in ids
    assert ids.index("s16") < ids.index("s24")


def test_incomplete_catalog_partial_recommendation():
    products = [
        _prod("c1", "cameras_ip", "Cam", {"resolution_mp": 4, "environment": "outdoor", "poe": True, "max_power_w": 8}),
        _prod("ntext", "nvr", "NVR Text", {}),
        _prod("s16", "switch", "SW", {"ports": 16, "poe_ports": 16, "poe_budget_w": 180}),
        # HDD attrs missing — no capacity_tb products
        _prod("hmiss", "hdd_recorders", "HDD mystery", {}),
    ]
    rec = build_system_recommendation(
        raw_input={
            "camera_count": 12,
            "resolution_mp": 4,
            "environment": "outdoor",
            "retention_days": 30,
            "recording_mode": "continuous",
            "expansion_headroom": 0.2,
            "poe_required": True,
            "camera_max_power_w": 8,
            "architecture_intent": "prefer_nvr_integrated",
            "allow_engineering_power_default": False,
        },
        catalog_products=products,
    )
    roles = {c["role"]: c for c in rec["components"]}
    assert roles["camera"]["resolution_status"] in {"RESOLVED", "PARTIAL"}
    assert roles["recorder"]["resolution_status"] == "UNRESOLVED"
    assert roles["storage"]["resolution_status"] == "UNRESOLVED"
    assert roles["poe_switch"]["resolution_status"] == "RESOLVED"
    assert rec["blocking"] is True
    assert rec["status"] == "BLOCKED"


def test_integrated_nvr_poe_skips_external_switch():
    products = [
        _prod("c1", "cameras_ip", "Cam", {"resolution_mp": 4, "environment": "outdoor", "poe": True, "max_power_w": 8}),
        _prod(
            "n16",
            "nvr",
            "NVR 16 PoE",
            {"channels": 16, "poe_ports": 16, "poe_budget_w": 200, "drive_bays": 4, "max_hdd_tb": 12},
        ),
        _prod("h10", "hdd_recorders", "HDD 10", {"capacity_tb": 10, "surveillance_grade": True}),
        _prod("s16", "switch", "SW", {"ports": 16, "poe_ports": 16, "poe_budget_w": 180}),
    ]
    rec = build_system_recommendation(
        raw_input={
            "camera_count": 12,
            "resolution_mp": 4,
            "environment": "outdoor",
            "retention_days": 30,
            "recording_mode": "continuous",
            "expansion_headroom": 0.2,
            "poe_required": True,
            "camera_max_power_w": 8,
            "architecture_intent": "prefer_nvr_integrated",
        },
        catalog_products=products,
    )
    roles = {c["role"]: c for c in rec["components"]}
    assert roles["recorder"]["selected_product"]["id"] == "n16"
    assert "poe_switch" not in roles
    assert rec["engineering"]["poeArchitecture"]["externalSwitchRequired"] is False
    assert rec["blocking"] is False


def test_determinism_stable_ordering():
    products = [
        _prod("b", "cameras_ip", "B Cam", {"resolution_mp": 4, "environment": "outdoor", "poe": True}),
        _prod("a", "cameras_ip", "A Cam", {"resolution_mp": 4, "environment": "outdoor", "poe": True}),
    ]
    r1 = resolve_cameras(
        products=products,
        requested_mp=4,
        environment="outdoor",
        form_factor=None,
        poe_required=True,
        manufacturer_preference=None,
    )
    r2 = resolve_cameras(
        products=list(reversed(products)),
        requested_mp=4,
        environment="outdoor",
        form_factor=None,
        poe_required=True,
        manufacturer_preference=None,
    )
    assert [c["product"]["id"] for c in r1["candidates"]] == [c["product"]["id"] for c in r2["candidates"]]


def test_tenant_isolation_products_must_be_workspace_scoped():
    """Resolver only sees products passed in; cross-tenant IDs never appear."""
    ws_a = [
        _prod("a-cam", "cameras_ip", "A Cam", {"resolution_mp": 4, "environment": "outdoor", "poe": True}),
        _prod("a-nvr", "nvr", "A NVR", {"channels": 16, "drive_bays": 4, "max_hdd_tb": 12}),
        _prod("a-hdd", "hdd_recorders", "A HDD", {"capacity_tb": 10, "surveillance_grade": True}),
    ]
    ws_b = [
        _prod("b-cam", "cameras_ip", "B Cam", {"resolution_mp": 4, "environment": "outdoor", "poe": True}),
        _prod("b-nvr", "nvr", "B NVR", {"channels": 16, "drive_bays": 4, "max_hdd_tb": 12}),
        _prod("b-hdd", "hdd_recorders", "B HDD", {"capacity_tb": 10, "surveillance_grade": True}),
    ]
    raw = {
        "camera_count": 4,
        "resolution_mp": 4,
        "environment": "outdoor",
        "retention_days": 14,
        "recording_mode": "continuous",
        "expansion_headroom": 0.2,
        "architecture_intent": "prefer_external_switch",
    }
    rec_a = build_system_recommendation(raw_input=raw, catalog_products=ws_a)
    rec_b = build_system_recommendation(raw_input=raw, catalog_products=ws_b)
    ids_a = {c.get("selected_product", {}).get("id") for c in rec_a["components"] if c.get("selected_product")}
    ids_b = {c.get("selected_product", {}).get("id") for c in rec_b["components"] if c.get("selected_product")}
    assert ids_a.isdisjoint(ids_b)
    assert "b-cam" not in ids_a and "a-cam" not in ids_b


def test_null_environment_does_not_reject_unknown_env_cameras():
    products = [
        _prod("c1", "cameras_ip", "Cam Unknown Env", {"resolution_mp": 4, "poe": True}),
        _prod("c2", "cameras_ip", "Cam Outdoor", {"resolution_mp": 4, "environment": "outdoor", "poe": True}),
    ]
    r = resolve_cameras(
        products=products,
        requested_mp=4,
        environment=None,
        form_factor=None,
        poe_required=True,
        manufacturer_preference=None,
    )
    ids = {c["product"]["id"] for c in r["candidates"]}
    assert ids == {"c1", "c2"}
    assert any(w["code"] == "ENVIRONMENT_UNSPECIFIED" for w in r["warnings"])
    assert r["selected"] is not None


def test_explicit_outdoor_unknown_product_env_is_partial_not_verified():
    products = [
        _prod("c1", "cameras_ip", "Cam Unknown Env", {"resolution_mp": 4, "poe": True}),
        _prod("c2", "cameras_ip", "Cam Outdoor", {"resolution_mp": 4, "environment": "outdoor", "poe": True}),
        _prod("c3", "cameras_ip", "Cam Indoor", {"resolution_mp": 4, "environment": "indoor", "poe": True}),
    ]
    r = resolve_cameras(
        products=products,
        requested_mp=4,
        environment="outdoor",
        form_factor=None,
        poe_required=True,
        manufacturer_preference=None,
    )
    ids = {c["product"]["id"] for c in r["candidates"]}
    assert "c1" in ids
    assert "c2" in ids
    assert "c3" not in ids
    unknown = next(c for c in r["candidates"] if c["product"]["id"] == "c1")
    assert unknown["compatibility"]["environment"] == "UNKNOWN"
    assert unknown["confidence"] == "PARTIAL"
    # Verified outdoor ranks above unknown-env
    assert r["selected"]["product"]["id"] == "c2"
    assert r["selected"]["confidence"] == "STRUCTURED"


def test_explicit_outdoor_only_unknown_env_emits_unverified_warning():
    products = [
        _prod("c1", "cameras_ip", "Cam Unknown Env", {"resolution_mp": 4, "poe": True}),
    ]
    r = resolve_cameras(
        products=products,
        requested_mp=4,
        environment="outdoor",
        form_factor=None,
        poe_required=True,
        manufacturer_preference=None,
    )
    assert r["status"] == "PARTIAL"
    assert r["selected"]["compatibility"]["environment"] == "UNKNOWN"
    assert any(w["code"] == "CAMERA_ENVIRONMENT_UNVERIFIED" for w in r["warnings"])


def test_partial_catalog_preserves_unresolved_storage_and_switch():
    products = [
        _prod("c1", "cameras_ip", "Cam", {"resolution_mp": 4, "poe": True, "max_power_w": 8}),
        _prod("n1", "nvr", "NVR 8", {"channels": 8, "drive_bays": 2, "max_hdd_tb": 10, "poe_ports": 4, "poe_budget_w": 40}),
    ]
    raw = {
        "camera_count": 4,
        "resolution_mp": 4,
        "environment": None,
        "retention_days": 14,
        "recording_mode": "continuous",
        "expansion_headroom": 0.2,
        "architecture_intent": "prefer_external_switch",
        "camera_max_power_w": 8,
    }
    rec = build_system_recommendation(raw_input=raw, catalog_products=products)
    by_role = {c["role"]: c for c in rec["components"]}
    assert by_role["camera"]["resolution_status"] in {"RESOLVED", "PARTIAL"}
    assert by_role["camera"]["selected_product"]["id"] == "c1"
    assert by_role["recorder"]["resolution_status"] in {"RESOLVED", "PARTIAL"}
    assert by_role["storage"]["resolution_status"] == "UNRESOLVED"
    assert by_role["storage"]["selected_product"] is None
    assert "poe_switch" in by_role
    assert by_role["poe_switch"]["resolution_status"] == "UNRESOLVED"
    assert by_role["poe_switch"]["selected_product"] is None
    assert rec["status"] == "BLOCKED"
    # Engineering still present — not collapsed into catalog failure
    assert rec["engineering"]["storage"]["requiredTbWithOverhead"] is not None
    assert (rec["engineering"].get("poe") or {}).get("requiredBudgetW") is not None
    assert (rec["engineering"].get("poeArchitecture") or {}).get("externalSwitchRequired") is True


def test_full_catalog_still_resolves_all_core_roles():
    products = [
        _prod("c1", "cameras_ip", "Cam", {"resolution_mp": 4, "environment": "outdoor", "poe": True, "max_power_w": 8}),
        _prod(
            "n1",
            "nvr",
            "NVR 16",
            {"channels": 16, "drive_bays": 4, "max_hdd_tb": 12, "poe_ports": 16, "poe_budget_w": 200},
        ),
        _prod("h1", "hdd_recorders", "HDD 10", {"capacity_tb": 10, "surveillance_grade": True}),
        _prod("s1", "switch", "SW 16", {"ports": 16, "poe_ports": 16, "poe_budget_w": 200}),
    ]
    raw = {
        "camera_count": 4,
        "resolution_mp": 4,
        "environment": "outdoor",
        "retention_days": 14,
        "recording_mode": "continuous",
        "expansion_headroom": 0.2,
        "architecture_intent": "prefer_external_switch",
    }
    rec = build_system_recommendation(raw_input=raw, catalog_products=products)
    by_role = {c["role"]: c for c in rec["components"]}
    for role in ("camera", "recorder", "storage", "poe_switch"):
        assert by_role[role]["selected_product"] is not None, role
        assert by_role[role]["resolution_status"] in {"RESOLVED", "PARTIAL"}, role
    assert rec["status"] in {"OK", "PARTIAL"}


def test_empty_catalog_does_not_fabricate_products():
    raw = {
        "camera_count": 4,
        "resolution_mp": 4,
        "environment": None,
        "retention_days": 14,
        "recording_mode": "continuous",
        "expansion_headroom": 0.2,
    }
    rec = build_system_recommendation(raw_input=raw, catalog_products=[])
    assert all(c.get("selected_product") is None for c in rec["components"])
    assert rec["engineering"]["storage"]["requiredTbWithOverhead"] is not None
