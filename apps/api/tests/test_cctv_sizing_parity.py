"""Parity tests: Python CCTV sizing must match accepted Task 13B vectors."""

from __future__ import annotations

import math

from app.cctv_sizing import (
    CCTV_SIZING_ENGINE_VERSION,
    build_cctv_requirements,
    calculate_poe,
    calculate_storage,
    evaluate_nvr_poe,
    evaluate_poe_architecture,
    pack_hdds,
    size_recorder,
)


def test_engine_version():
    assert CCTV_SIZING_ENGINE_VERSION == 1


def test_recorder_tiers_parity():
    cases = [
        (1, 4),
        (4, 4),
        (5, 8),
        (8, 8),
        (9, 16),
        (16, 16),
        (17, 32),
        (32, 32),
        (33, 64),
        (64, 64),
    ]
    for cams, tier in cases:
        r = size_recorder(cams)
        assert r["status"] == "ok"
        assert r["selectedChannelTier"] == tier
    assert size_recorder(65)["status"] == "unsupported"
    assert size_recorder(65)["selectedChannelTier"] is None


def test_headroom_parity():
    assert size_recorder(12, 0.2)["effectiveCameras"] == 15
    assert size_recorder(12, 0.2)["selectedChannelTier"] == 16
    assert size_recorder(15, 0.2)["effectiveCameras"] == 18
    assert size_recorder(15, 0.2)["selectedChannelTier"] == 32


def test_storage_example_a_parity():
    s = calculate_storage(
        {
            "cameraCount": 12,
            "bitrateMbpsOverride": 4,
            "retentionDays": 30,
            "recordingMode": "continuous",
            "storageOverhead": 0.2,
        }
    )
    assert s["status"] == "ok"
    assert math.isclose(s["rawTb"], 15.552, rel_tol=0, abs_tol=1e-9)
    assert math.isclose(s["requiredTbWithOverhead"], 18.6624, rel_tol=0, abs_tol=1e-9)
    assert s["bitrateSource"] == "USER_INPUT"
    assert s["tbConvention"] == "decimal_TB"


def test_storage_example_b_parity():
    s = calculate_storage(
        {
            "cameraCount": 4,
            "bitrateMbpsOverride": 2,
            "retentionDays": 14,
            "recordingMode": "scheduled",
            "recordingHoursPerDay": 12,
            "storageOverhead": 0.2,
        }
    )
    assert s["status"] == "ok"
    assert math.isclose(s["rawTb"], 0.6048, rel_tol=0, abs_tol=1e-9)
    assert math.isclose(s["requiredTbWithOverhead"], 0.72576, rel_tol=0, abs_tol=1e-9)


def test_motion_default_duty_parity():
    s = calculate_storage(
        {
            "cameraCount": 2,
            "bitrateMbpsOverride": 4,
            "retentionDays": 7,
            "recordingMode": "motion",
            "storageOverhead": 0,
        }
    )
    assert s["status"] == "ok"
    assert s["recordingSecondsPerDay"] == 86400 * 0.3
    assert any(a["code"] == "STORAGE_MOTION_DUTY_DEFAULTED" for a in s["assumptions"])


def test_hdd_packing_parity():
    exact = pack_hdds(required_tb=8, available_capacities_tb=[4, 8, 10], drive_bays=2, max_hdd_tb=10)
    assert exact["status"] == "ok"
    assert exact["driveCount"] == 1
    assert exact["driveCapacityTb"] == 8

    multi = pack_hdds(required_tb=18, available_capacities_tb=[8, 10, 12], drive_bays=4, max_hdd_tb=12)
    assert multi["status"] == "ok"
    assert multi["driveCount"] == 2
    assert multi["driveCapacityTb"] == 10

    assert (
        pack_hdds(required_tb=40, available_capacities_tb=[8], drive_bays=2, max_hdd_tb=8)["status"]
        == "impossible"
    )
    assert (
        pack_hdds(required_tb=10, available_capacities_tb=[12], drive_bays=2, max_hdd_tb=8)["status"]
        == "impossible"
    )
    assert pack_hdds(required_tb=5, available_capacities_tb=[], drive_bays=2, max_hdd_tb=10)["status"] == "unresolved"
    assert pack_hdds(required_tb=5, available_capacities_tb=[8], drive_bays=None, max_hdd_tb=10)["status"] == "unresolved"


def test_poe_parity():
    p = calculate_poe({"cameraCount": 12, "cameraMaxPowerW": 8, "poeHeadroom": 0.2})
    assert p["status"] == "ok"
    assert p["rawLoadW"] == 96
    assert math.isclose(p["requiredBudgetW"], 115.2, rel_tol=0, abs_tol=1e-9)

    assert calculate_poe({"cameraCount": 4, "cameraMaxPowerW": None})["status"] == "unresolved"

    assert (
        evaluate_nvr_poe(required_ports=12, required_budget_w=100, poe_ports=16, poe_budget_w=200)["evaluation"]
        == "SUFFICIENT"
    )
    assert (
        evaluate_nvr_poe(required_ports=12, required_budget_w=100, poe_ports=8, poe_budget_w=200)["evaluation"]
        == "INSUFFICIENT_PORTS"
    )
    assert (
        evaluate_nvr_poe(required_ports=12, required_budget_w=200, poe_ports=16, poe_budget_w=100)["evaluation"]
        == "INSUFFICIENT_BUDGET"
    )
    assert (
        evaluate_nvr_poe(required_ports=12, required_budget_w=200, poe_ports=8, poe_budget_w=50)["evaluation"]
        == "INSUFFICIENT_BOTH"
    )
    assert (
        evaluate_nvr_poe(required_ports=12, required_budget_w=100, poe_ports=None, poe_budget_w=None)["evaluation"]
        == "UNKNOWN"
    )


def test_external_switch_unknown_not_safe():
    unknown = evaluate_poe_architecture(
        {
            "poe_required": True,
            "intent": "unknown",
            "required_ports": 12,
            "required_budget_w": 115.2,
            "recorder_poe_ports": None,
            "recorder_poe_budget_w": None,
        }
    )
    assert unknown["externalSwitchRequired"] is True
    assert unknown["evaluation"] == "UNKNOWN"


def test_integration_build_parity():
    result = build_cctv_requirements(
        {
            "camera_count": 12,
            "outdoor_count": 12,
            "indoor_count": 0,
            "resolution_mp": 4,
            "retention_days": 30,
            "recording_mode": "continuous",
            "expansion_headroom": 0.2,
            "poe_required": True,
            "camera_max_power_w": 8,
            "camera_max_power_source": "STRUCTURED_CATALOG",
            "architecture_intent": "prefer_nvr_integrated",
            "storage_overhead": 0.2,
            "poe_headroom": 0.2,
            "available_hdd_capacities_tb": [4, 6, 8, 10, 12],
            "recorder": {
                "channels": 16,
                "poe_ports": 8,
                "poe_budget_w": 100,
                "drive_bays": 4,
                "max_hdd_tb": 12,
            },
        }
    )
    assert result["valid"] is True
    assert result["version"] == 1
    assert result["recorder"]["selectedChannelTier"] == 16
    assert result["recorder"]["effectiveCameras"] == 15
    assert result["storage"]["bitrateSource"] == "ENGINEERING_DEFAULT"
    assert math.isclose(result["storage"]["requiredTbWithOverhead"], 18.6624, rel_tol=0, abs_tol=1e-6)
    assert result["hdd"]["status"] == "ok"
    assert result["hdd"]["driveCount"] == 2
    assert result["hdd"]["driveCapacityTb"] == 10
    assert math.isclose(result["poe"]["requiredBudgetW"], 115.2, rel_tol=0, abs_tol=1e-6)
    assert result["poeArchitecture"]["externalSwitchRequired"] is True
