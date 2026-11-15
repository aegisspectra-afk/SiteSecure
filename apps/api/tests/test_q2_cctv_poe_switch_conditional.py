"""Q2.5: the PoE switch is required only when the chosen recorder lacks PoE or budget.

No recorder chosen yet -> the switch is a conditional, optional, non-blocking item.
"""

from __future__ import annotations

from app.cctv_recommend import build_system_recommendation
from tests.test_cctv_recommend import _prod

RAW = {
    "camera_count": 6,
    "resolution_mp": 4,
    "environment": "outdoor",
    "retention_days": 14,
    "recording_mode": "continuous",
    "expansion_headroom": 0.2,
    "poe_required": True,
    "camera_max_power_w": 8,
    "architecture_intent": "prefer_nvr_integrated",
}
CAM = _prod("c1", "cameras_ip", "Cam", {"resolution_mp": 4, "environment": "outdoor", "poe": True, "max_power_w": 8})
HDD = _prod("h4", "hdd_recorders", "HDD 4", {"capacity_tb": 4, "surveillance_grade": True})
SWITCH = _prod("s8", "switch", "SW 8", {"ports": 8, "poe_ports": 8, "poe_budget_w": 120})


def _switch(rec):
    return next((c for c in rec["components"] if c["role"] == "poe_switch"), None)


def _codes(component):
    return [r.get("code") for r in component.get("reason_codes") or []]


def test_no_recorder_chosen_makes_the_switch_conditional_not_blocking():
    rec = build_system_recommendation(raw_input=RAW, catalog_products=[CAM, HDD, SWITCH])
    sw = _switch(rec)
    assert sw is not None
    assert sw["optional"] is True
    assert sw.get("blocking") is False
    assert "SWITCH_CONDITIONAL_ON_RECORDER" in _codes(sw)
    arch = rec["engineering"]["poeArchitecture"]
    assert arch["externalSwitchRequired"] is False
    assert arch["switchConditional"] is True
    assert not any(u.get("code") == "NVR_POE_UNKNOWN" for u in rec.get("unresolved") or [])


def test_empty_catalog_still_offers_a_conditional_switch():
    rec = build_system_recommendation(raw_input=RAW, catalog_products=[])
    sw = _switch(rec)
    assert sw is not None and sw["optional"] is True and sw.get("blocking") is False


def test_chosen_recorder_without_poe_requires_the_switch():
    nvr = _prod("n8", "nvr", "NVR 8 no PoE", {"channels": 16, "poe_ports": 0, "drive_bays": 4, "max_hdd_tb": 12})
    rec = build_system_recommendation(raw_input=RAW, catalog_products=[CAM, HDD, SWITCH, nvr])
    sw = _switch(rec)
    assert sw is not None
    assert sw["optional"] is False
    assert "EXTERNAL_SWITCH_REQUIRED" in _codes(sw)
    assert rec["engineering"]["poeArchitecture"]["externalSwitchRequired"] is True


def test_chosen_recorder_with_enough_poe_needs_no_switch():
    nvr = _prod("n8p", "nvr", "NVR 8 PoE", {"channels": 16, "poe_ports": 16, "poe_budget_w": 200, "drive_bays": 4, "max_hdd_tb": 12})
    rec = build_system_recommendation(raw_input=RAW, catalog_products=[CAM, HDD, SWITCH, nvr])
    assert _switch(rec) is None
    assert rec["engineering"]["poeArchitecture"]["externalSwitchRequired"] is False


def test_user_asked_for_an_external_switch_keeps_it_required():
    rec = build_system_recommendation(
        raw_input={**RAW, "architecture_intent": "prefer_external_switch"}, catalog_products=[CAM, HDD, SWITCH]
    )
    sw = _switch(rec)
    assert sw is not None and sw["optional"] is False
    assert rec["engineering"]["poeArchitecture"]["externalSwitchRequired"] is True
