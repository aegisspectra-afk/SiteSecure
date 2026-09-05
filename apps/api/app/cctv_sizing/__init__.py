"""Authoritative CCTV sizing engine (Task 13C) — parity with Task 13B TypeScript."""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

CCTV_SIZING_ENGINE_VERSION = 1
STORAGE_TB_CONVENTION = "decimal_TB"
RECORDER_TIERS = (4, 8, 16, 32, 64)

DEFAULT_MOTION_DUTY_CYCLE = 0.3
DEFAULT_STORAGE_OVERHEAD = 0.2
DEFAULT_POE_HEADROOM = 0.2
ENGINEERING_DEFAULT_CAMERA_POWER_W = 8.0
DEFAULT_CODEC = "h265"

BITRATE_DEFAULTS_H265_MBPS: dict[float, float] = {
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    8: 8,
    12: 10,
}

BYTES_PER_GB = 1e9
BYTES_PER_TB = 1e12
SECONDS_PER_HOUR = 3600

Provenance = Literal["USER_INPUT", "STRUCTURED_CATALOG", "ENGINEERING_DEFAULT", "DERIVED", "UNRESOLVED"]
RecordingMode = Literal["continuous", "scheduled", "motion"]
PoeArchitectureIntent = Literal["prefer_nvr_integrated", "prefer_external_switch", "unknown"]
NvrPoeEvaluation = Literal[
    "SUFFICIENT",
    "INSUFFICIENT_PORTS",
    "INSUFFICIENT_BUDGET",
    "INSUFFICIENT_BOTH",
    "UNKNOWN",
]


@dataclass
class ReasonEntry:
    code: str
    params: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {"code": self.code, "params": self.params}


def _finite(n: Any) -> bool:
    try:
        return n is not None and math.isfinite(float(n))
    except (TypeError, ValueError):
        return False


def default_bitrate_mbps(resolution_mp: float, codec: str | None) -> float | None:
    if not _finite(resolution_mp) or resolution_mp <= 0:
        return None
    keys = sorted(BITRATE_DEFAULTS_H265_MBPS.keys())
    nearest = keys[0]
    best = abs(resolution_mp - nearest)
    for k in keys:
        d = abs(resolution_mp - k)
        if d < best:
            best = d
            nearest = k
    if best > 0.6 and resolution_mp not in BITRATE_DEFAULTS_H265_MBPS:
        if best > 1.0:
            return None
    base = BITRATE_DEFAULTS_H265_MBPS.get(nearest)
    if base is None:
        return None
    c = (codec or DEFAULT_CODEC).lower()
    if c in {"h264", "avc"}:
        return base * 1.4
    return float(base)


def validate_cctv_sizing_input(inp: dict[str, Any]) -> list[dict[str, str]]:
    errors: list[dict[str, str]] = []
    count = inp.get("camera_count", inp.get("cameraCount"))
    if not isinstance(count, int) or isinstance(count, bool):
        # accept float that is integer
        if _finite(count) and float(count).is_integer():
            count = int(count)
        else:
            errors.append({"code": "INPUT_VALIDATION_ERROR", "field": "cameraCount", "message": "cameraCount must be a finite integer"})
            count = None
    if count is not None:
        if count < 0:
            errors.append({"code": "INPUT_VALIDATION_ERROR", "field": "cameraCount", "message": "cameraCount cannot be negative"})
        elif count == 0:
            errors.append({"code": "INPUT_VALIDATION_ERROR", "field": "cameraCount", "message": "cameraCount must be at least 1"})

    indoor = inp.get("indoor_count", inp.get("indoorCount"))
    outdoor = inp.get("outdoor_count", inp.get("outdoorCount"))
    if indoor is not None or outdoor is not None:
        if indoor is not None and (not isinstance(indoor, int) or indoor < 0):
            if not (_finite(indoor) and float(indoor).is_integer() and float(indoor) >= 0):
                errors.append({"code": "INPUT_VALIDATION_ERROR", "field": "indoorCount", "message": "indoorCount must be a non-negative integer"})
            else:
                indoor = int(indoor)
        if outdoor is not None and (not isinstance(outdoor, int) or outdoor < 0):
            if not (_finite(outdoor) and float(outdoor).is_integer() and float(outdoor) >= 0):
                errors.append({"code": "INPUT_VALIDATION_ERROR", "field": "outdoorCount", "message": "outdoorCount must be a non-negative integer"})
            else:
                outdoor = int(outdoor)
        if (
            isinstance(indoor, int)
            and isinstance(outdoor, int)
            and isinstance(count, int)
            and count > 0
            and indoor + outdoor != count
        ):
            errors.append(
                {
                    "code": "INPUT_VALIDATION_ERROR",
                    "field": "indoorCount+outdoorCount",
                    "message": "indoorCount + outdoorCount must equal cameraCount",
                }
            )

    retention = inp.get("retention_days", inp.get("retentionDays"))
    if retention is not None and (not _finite(retention) or float(retention) <= 0):
        errors.append({"code": "INPUT_VALIDATION_ERROR", "field": "retentionDays", "message": "retentionDays must be > 0"})

    for field_name, key_snake, key_camel in (
        ("bitrateMbpsOverride", "bitrate_mbps_override", "bitrateMbpsOverride"),
        ("bitrateMbps", "bitrate_mbps", "bitrateMbps"),
    ):
        val = inp.get(key_snake, inp.get(key_camel))
        if val is not None and not ( _finite(val) and float(val) > 0):
            errors.append({"code": "INPUT_VALIDATION_ERROR", "field": field_name, "message": f"{field_name} must be > 0"})

    headroom = inp.get("expansion_headroom", inp.get("expansionHeadroom"))
    if headroom is not None and (not _finite(headroom) or float(headroom) < 0):
        errors.append({"code": "INPUT_VALIDATION_ERROR", "field": "expansionHeadroom", "message": "expansionHeadroom must be ≥ 0"})

    duty = inp.get("motion_duty_cycle", inp.get("motionDutyCycle"))
    if duty is not None and (not _finite(duty) or float(duty) <= 0 or float(duty) > 1):
        errors.append({"code": "INPUT_VALIDATION_ERROR", "field": "motionDutyCycle", "message": "motionDutyCycle must be in (0, 1]"})

    hours = inp.get("recording_hours_per_day", inp.get("recordingHoursPerDay"))
    if hours is not None and (not _finite(hours) or float(hours) <= 0 or float(hours) > 24):
        errors.append({"code": "INPUT_VALIDATION_ERROR", "field": "recordingHoursPerDay", "message": "recordingHoursPerDay must be in (0, 24]"})

    return errors


def effective_camera_count(requested: int, headroom: float = 0) -> int:
    if headroom <= 0:
        return requested
    return math.ceil(requested * (1 + headroom))


def size_recorder(requested_cameras: int, expansion_headroom: float = 0) -> dict[str, Any]:
    headroom = expansion_headroom if expansion_headroom > 0 else 0.0
    effective = effective_camera_count(requested_cameras, headroom)
    reasons: list[ReasonEntry] = []
    if headroom > 0 and effective != requested_cameras:
        reasons.append(
            ReasonEntry("RECORDER_HEADROOM_APPLIED", {"requested": requested_cameras, "headroom": headroom, "effective": effective})
        )
    if effective > 64:
        reasons.append(ReasonEntry("RECORDER_UNSUPPORTED_COUNT", {"effective": effective, "maxSupported": 64}))
        return {
            "status": "unsupported",
            "requestedCameras": requested_cameras,
            "effectiveCameras": effective,
            "selectedChannelTier": None,
            "headroomApplied": headroom,
            "reasons": [r.to_dict() for r in reasons],
        }
    tier = 4
    for candidate in RECORDER_TIERS:
        if effective <= candidate:
            tier = candidate
            break
    reasons.append(ReasonEntry("RECORDER_TIER_SELECTED", {"requested": requested_cameras, "effective": effective, "tier": tier}))
    return {
        "status": "ok",
        "requestedCameras": requested_cameras,
        "effectiveCameras": effective,
        "selectedChannelTier": tier,
        "headroomApplied": headroom,
        "reasons": [r.to_dict() for r in reasons],
    }


def resolve_bitrate(inp: dict[str, Any]) -> dict[str, Any]:
    reasons: list[ReasonEntry] = []
    assumptions: list[ReasonEntry] = []
    override = inp.get("bitrate_mbps_override", inp.get("bitrateMbpsOverride"))
    structured = inp.get("bitrate_mbps", inp.get("bitrateMbps"))
    resolution = inp.get("resolution_mp", inp.get("resolutionMp"))
    codec = inp.get("codec")

    if override is not None and float(override) > 0:
        reasons.append(ReasonEntry("STORAGE_BITRATE_OVERRIDE", {"bitrateMbps": float(override)}))
        return {"bitrateMbps": float(override), "source": "USER_INPUT", "reasons": [r.to_dict() for r in reasons], "assumptions": []}

    if structured is not None and float(structured) > 0:
        return {"bitrateMbps": float(structured), "source": "STRUCTURED_CATALOG", "reasons": [], "assumptions": []}

    if resolution is not None:
        def_br = default_bitrate_mbps(float(resolution), codec)
        if def_br is not None:
            entry = ReasonEntry(
                "STORAGE_BITRATE_DEFAULTED",
                {"resolutionMp": float(resolution), "codec": codec or "h265", "bitrateMbps": def_br},
            )
            reasons.append(entry)
            assumptions.append(entry)
            return {
                "bitrateMbps": def_br,
                "source": "ENGINEERING_DEFAULT",
                "reasons": [r.to_dict() for r in reasons],
                "assumptions": [a.to_dict() for a in assumptions],
            }

    reasons.append(ReasonEntry("STORAGE_UNRESOLVED_BITRATE", {}))
    return {"bitrateMbps": None, "source": "UNRESOLVED", "reasons": [r.to_dict() for r in reasons], "assumptions": []}


def recording_seconds_per_day(inp: dict[str, Any]) -> dict[str, Any]:
    mode = inp.get("recording_mode", inp.get("recordingMode")) or "continuous"
    assumptions: list[ReasonEntry] = []
    if mode == "continuous":
        return {"seconds": 24 * SECONDS_PER_HOUR, "assumptions": [], "invalid": False}
    if mode == "scheduled":
        hours = inp.get("recording_hours_per_day", inp.get("recordingHoursPerDay"))
        if hours is None or not (_finite(hours) and float(hours) > 0 and float(hours) <= 24):
            return {"seconds": None, "assumptions": [], "invalid": True}
        return {"seconds": float(hours) * SECONDS_PER_HOUR, "assumptions": [], "invalid": False}
    duty = inp.get("motion_duty_cycle", inp.get("motionDutyCycle"))
    if duty is None:
        duty = DEFAULT_MOTION_DUTY_CYCLE
        assumptions.append(ReasonEntry("STORAGE_MOTION_DUTY_DEFAULTED", {"dutyCycle": duty}))
    return {"seconds": 24 * SECONDS_PER_HOUR * float(duty), "assumptions": [a.to_dict() for a in assumptions], "invalid": False}


def calculate_storage(inp: dict[str, Any]) -> dict[str, Any]:
    overhead_raw = inp.get("storage_overhead", inp.get("storageOverhead"))
    overhead = float(overhead_raw) if overhead_raw is not None and _finite(overhead_raw) else DEFAULT_STORAGE_OVERHEAD
    bitrate = resolve_bitrate(inp)
    recording = recording_seconds_per_day(inp)
    reasons = list(bitrate["reasons"])
    assumptions = list(bitrate["assumptions"]) + list(recording["assumptions"])
    retention = inp.get("retention_days", inp.get("retentionDays"))
    camera_count = int(inp.get("camera_count", inp.get("cameraCount")))

    base = {
        "bitrateMbps": bitrate["bitrateMbps"],
        "bitrateSource": bitrate["source"],
        "recordingSecondsPerDay": recording["seconds"],
        "retentionDays": float(retention) if retention is not None else None,
        "cameraCount": camera_count,
        "overhead": overhead,
        "rawBytes": None,
        "rawGb": None,
        "rawTb": None,
        "requiredBytesWithOverhead": None,
        "requiredGbWithOverhead": None,
        "requiredTbWithOverhead": None,
        "tbConvention": STORAGE_TB_CONVENTION,
        "reasons": reasons,
        "assumptions": assumptions,
    }
    if recording["invalid"]:
        return {**base, "status": "invalid"}
    if retention is None or not (_finite(retention) and float(retention) > 0) or bitrate["bitrateMbps"] is None or recording["seconds"] is None:
        return {**base, "status": "unresolved"}

    raw_bits = camera_count * float(bitrate["bitrateMbps"]) * 1_000_000 * float(recording["seconds"]) * float(retention)
    raw_bytes = raw_bits / 8
    required_bytes = raw_bytes * (1 + overhead)
    reasons.append(ReasonEntry("STORAGE_OVERHEAD_APPLIED", {"overhead": overhead, "rawBytes": raw_bytes, "requiredBytes": required_bytes}).to_dict())
    return {
        **base,
        "status": "ok",
        "rawBytes": raw_bytes,
        "rawGb": raw_bytes / BYTES_PER_GB,
        "rawTb": raw_bytes / BYTES_PER_TB,
        "requiredBytesWithOverhead": required_bytes,
        "requiredGbWithOverhead": required_bytes / BYTES_PER_GB,
        "requiredTbWithOverhead": required_bytes / BYTES_PER_TB,
        "reasons": reasons,
        "assumptions": assumptions,
    }


def pack_hdds(
    *,
    required_tb: float,
    available_capacities_tb: list[float],
    drive_bays: float | int | None,
    max_hdd_tb: float | None,
) -> dict[str, Any]:
    reasons: list[ReasonEntry] = []
    bay_limit = drive_bays
    max_drive_tb = max_hdd_tb
    sizes = sorted({float(n) for n in available_capacities_tb if _finite(n) and float(n) > 0})

    def unresolved(code: str, **params: Any) -> dict[str, Any]:
        reasons.append(ReasonEntry(code, params))
        return {
            "status": "unresolved",
            "requiredTb": required_tb,
            "driveCount": None,
            "driveCapacityTb": None,
            "totalCapacityTb": None,
            "excessTb": None,
            "baysUsed": None,
            "bayLimit": bay_limit,
            "maxDriveTb": max_drive_tb,
            "reasons": [r.to_dict() for r in reasons],
        }

    if not sizes:
        return unresolved("HDD_OPTIONS_EMPTY", requiredTb=required_tb)
    if bay_limit is None or not _finite(bay_limit) or float(bay_limit) < 1:
        return unresolved("HDD_BAYS_UNKNOWN", requiredTb=required_tb, bayLimit=bay_limit)

    max_bays = math.floor(float(bay_limit))
    candidates: list[dict[str, float | int]] = []
    for size in sizes:
        if max_drive_tb is not None and size > float(max_drive_tb):
            continue
        for count in range(1, max_bays + 1):
            total = size * count
            if total + 1e-12 >= required_tb:
                candidates.append(
                    {
                        "driveCount": count,
                        "driveCapacityTb": size,
                        "totalCapacityTb": total,
                        "excessTb": total - required_tb,
                    }
                )
    if not candidates:
        reasons.append(
            ReasonEntry(
                "HDD_CAPACITY_IMPOSSIBLE",
                {
                    "requiredTb": required_tb,
                    "bayLimit": max_bays,
                    "maxDriveTb": max_drive_tb,
                    "largestOption": sizes[-1] if sizes else None,
                },
            )
        )
        return {
            "status": "impossible",
            "requiredTb": required_tb,
            "driveCount": None,
            "driveCapacityTb": None,
            "totalCapacityTb": None,
            "excessTb": None,
            "baysUsed": None,
            "bayLimit": max_bays,
            "maxDriveTb": max_drive_tb,
            "reasons": [r.to_dict() for r in reasons],
        }

    candidates.sort(key=lambda c: (c["excessTb"], c["driveCount"], c["driveCapacityTb"]))
    best = candidates[0]
    reasons.append(
        ReasonEntry(
            "HDD_PACKED",
            {
                "requiredTb": required_tb,
                "driveCount": best["driveCount"],
                "driveCapacityTb": best["driveCapacityTb"],
                "totalCapacityTb": best["totalCapacityTb"],
                "excessTb": best["excessTb"],
            },
        )
    )
    return {
        "status": "ok",
        "requiredTb": required_tb,
        "driveCount": best["driveCount"],
        "driveCapacityTb": best["driveCapacityTb"],
        "totalCapacityTb": best["totalCapacityTb"],
        "excessTb": best["excessTb"],
        "baysUsed": best["driveCount"],
        "bayLimit": max_bays,
        "maxDriveTb": max_drive_tb,
        "reasons": [r.to_dict() for r in reasons],
    }


def calculate_poe(inp: dict[str, Any]) -> dict[str, Any]:
    headroom_raw = inp.get("poe_headroom", inp.get("poeHeadroom"))
    headroom = float(headroom_raw) if headroom_raw is not None and _finite(headroom_raw) else DEFAULT_POE_HEADROOM
    reasons: list[ReasonEntry] = []
    camera_count = int(inp.get("camera_count", inp.get("cameraCount")))
    extra_ports = inp.get("additional_poe_ports", inp.get("additionalPoePorts")) or 0
    required_ports = camera_count + (int(extra_ports) if float(extra_ports) > 0 else 0)

    power = inp.get("camera_max_power_w", inp.get("cameraMaxPowerW"))
    power_source = inp.get("camera_max_power_source", inp.get("cameraMaxPowerSource")) or "UNRESOLVED"
    allow_default = bool(inp.get("allow_engineering_power_default", inp.get("allowEngineeringPowerDefault")))

    if power is None or not (_finite(power) and float(power) >= 0):
        if allow_default:
            power = ENGINEERING_DEFAULT_CAMERA_POWER_W
            power_source = "ENGINEERING_DEFAULT"
            reasons.append(ReasonEntry("POE_POWER_ENGINEERING_DEFAULT", {"watts": power}))
        else:
            reasons.append(ReasonEntry("POE_POWER_UNRESOLVED", {}))
            return {
                "status": "unresolved",
                "cameraCount": camera_count,
                "powerPerCameraW": None,
                "powerSource": "UNRESOLVED",
                "rawLoadW": None,
                "headroom": headroom,
                "requiredBudgetW": None,
                "requiredPorts": required_ports,
                "reasons": [r.to_dict() for r in reasons],
            }
    elif not inp.get("camera_max_power_source", inp.get("cameraMaxPowerSource")):
        power_source = "USER_INPUT"

    extra_w = inp.get("additional_device_power_w", inp.get("additionalDevicePowerW")) or 0
    raw_load = camera_count * float(power) + (float(extra_w) if float(extra_w) > 0 else 0)
    required_budget = raw_load * (1 + headroom)
    reasons.append(ReasonEntry("POE_HEADROOM_APPLIED", {"rawLoadW": raw_load, "headroom": headroom, "requiredBudgetW": required_budget}))
    return {
        "status": "ok",
        "cameraCount": camera_count,
        "powerPerCameraW": float(power),
        "powerSource": power_source,
        "rawLoadW": raw_load,
        "headroom": headroom,
        "requiredBudgetW": required_budget,
        "requiredPorts": required_ports,
        "reasons": [r.to_dict() for r in reasons],
    }


def evaluate_nvr_poe(
    *,
    required_ports: int,
    required_budget_w: float | None,
    poe_ports: float | int | None,
    poe_budget_w: float | None,
) -> dict[str, Any]:
    reasons: list[ReasonEntry] = []
    ports_known = poe_ports is not None and _finite(poe_ports)
    budget_known = poe_budget_w is not None and _finite(poe_budget_w)
    budget_needed = required_budget_w is not None and _finite(required_budget_w)

    if not ports_known and (not budget_known or not budget_needed):
        reasons.append(ReasonEntry("NVR_POE_UNKNOWN", {}))
        return {"evaluation": "UNKNOWN", "reasons": [r.to_dict() for r in reasons]}

    ports_ok = (float(poe_ports) >= required_ports) if ports_known else None
    budget_ok = (float(poe_budget_w) + 1e-9 >= float(required_budget_w)) if budget_known and budget_needed else None

    if ports_ok is False and budget_ok is False:
        reasons.append(
            ReasonEntry(
                "NVR_POE_BOTH_INSUFFICIENT",
                {
                    "poePorts": poe_ports,
                    "requiredPorts": required_ports,
                    "poeBudgetW": poe_budget_w,
                    "requiredBudgetW": required_budget_w,
                },
            )
        )
        return {"evaluation": "INSUFFICIENT_BOTH", "reasons": [r.to_dict() for r in reasons]}
    if ports_ok is False:
        reasons.append(ReasonEntry("NVR_POE_PORTS_INSUFFICIENT", {"poePorts": poe_ports, "requiredPorts": required_ports}))
        return {"evaluation": "INSUFFICIENT_PORTS", "reasons": [r.to_dict() for r in reasons]}
    if budget_ok is False:
        reasons.append(
            ReasonEntry("NVR_POE_BUDGET_INSUFFICIENT", {"poeBudgetW": poe_budget_w, "requiredBudgetW": required_budget_w})
        )
        return {"evaluation": "INSUFFICIENT_BUDGET", "reasons": [r.to_dict() for r in reasons]}
    if ports_ok is True and budget_needed and not budget_known:
        reasons.append(ReasonEntry("NVR_POE_UNKNOWN", {"reason": "budget_unknown"}))
        return {"evaluation": "UNKNOWN", "reasons": [r.to_dict() for r in reasons]}
    if ports_ok is None and budget_ok is True:
        reasons.append(ReasonEntry("NVR_POE_UNKNOWN", {"reason": "ports_unknown"}))
        return {"evaluation": "UNKNOWN", "reasons": [r.to_dict() for r in reasons]}

    reasons.append(
        ReasonEntry(
            "NVR_POE_SUFFICIENT",
            {
                "poePorts": poe_ports,
                "poeBudgetW": poe_budget_w,
                "requiredPorts": required_ports,
                "requiredBudgetW": required_budget_w,
            },
        )
    )
    return {"evaluation": "SUFFICIENT", "reasons": [r.to_dict() for r in reasons]}


def evaluate_poe_architecture(opts: dict[str, Any]) -> dict[str, Any]:
    reasons: list[ReasonEntry] = []
    poe_required = opts.get("poe_required", True)
    intent = opts.get("intent") or "unknown"
    required_ports = int(opts["required_ports"])
    required_budget_w = opts.get("required_budget_w")
    recorder_poe_ports = opts.get("recorder_poe_ports")
    recorder_poe_budget_w = opts.get("recorder_poe_budget_w")

    if not poe_required:
        reasons.append(ReasonEntry("EXTERNAL_SWITCH_NOT_REQUIRED", {"reason": "poe_not_required"}))
        return {
            "evaluation": "SUFFICIENT",
            "externalSwitchRequired": False,
            "switchRequirement": None,
            "reasons": [r.to_dict() for r in reasons],
        }

    if intent == "prefer_external_switch":
        reasons.append(ReasonEntry("EXTERNAL_SWITCH_REQUIRED", {"reason": "user_architecture_intent"}))
        return {
            "evaluation": "INSUFFICIENT_PORTS",
            "externalSwitchRequired": True,
            "switchRequirement": {
                "minPorts": required_ports,
                "minPoePorts": required_ports,
                "minPoeBudgetW": required_budget_w,
            },
            "reasons": [r.to_dict() for r in reasons],
        }

    nvr = evaluate_nvr_poe(
        required_ports=required_ports,
        required_budget_w=required_budget_w,
        poe_ports=recorder_poe_ports,
        poe_budget_w=recorder_poe_budget_w,
    )
    for r in nvr["reasons"]:
        reasons.append(ReasonEntry(r["code"], r.get("params") or {}))
    need_switch = nvr["evaluation"] in {
        "INSUFFICIENT_PORTS",
        "INSUFFICIENT_BUDGET",
        "INSUFFICIENT_BOTH",
        "UNKNOWN",
    } or (recorder_poe_ports is not None and float(recorder_poe_ports) == 0)

    if need_switch:
        reasons.append(ReasonEntry("EXTERNAL_SWITCH_REQUIRED", {"evaluation": nvr["evaluation"]}))
        return {
            "evaluation": nvr["evaluation"],
            "externalSwitchRequired": True,
            "switchRequirement": {
                "minPorts": required_ports,
                "minPoePorts": required_ports,
                "minPoeBudgetW": required_budget_w,
            },
            "reasons": [r.to_dict() for r in reasons],
        }

    reasons.append(ReasonEntry("EXTERNAL_SWITCH_NOT_REQUIRED", {"evaluation": nvr["evaluation"]}))
    return {
        "evaluation": nvr["evaluation"],
        "externalSwitchRequired": False,
        "switchRequirement": None,
        "reasons": [r.to_dict() for r in reasons],
    }


def evaluate_infrastructure(cable_distance_meters: float | None) -> dict[str, Any]:
    if cable_distance_meters is not None and _finite(cable_distance_meters) and float(cable_distance_meters) > 0:
        return {"cableMeters": float(cable_distance_meters), "cableStatus": "ok", "reasons": []}
    return {
        "cableMeters": None,
        "cableStatus": "unresolved",
        "reasons": [ReasonEntry("CABLE_DISTANCE_UNRESOLVED", {}).to_dict()],
    }


def build_service_requirements(opts: dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    camera_count = int(opts["camera_count"])
    install = opts.get("installation_requested")
    if install is not False:
        out.append({"role": "camera_install", "qty": camera_count})
        out.append({"role": "recorder_setup", "qty": 1})
    if opts.get("remote_viewing"):
        out.append({"role": "remote_viewing_setup", "qty": 1})
    if opts.get("testing_requested") is not False and install is not False:
        out.append({"role": "testing", "qty": 1})
    if opts.get("commissioning_requested"):
        out.append({"role": "commissioning", "qty": 1})
    if opts.get("ups_requested"):
        out.append({"role": "ups", "qty": 1})
    return out


def _get(inp: dict[str, Any], *keys: str) -> Any:
    for k in keys:
        if k in inp and inp[k] is not None:
            return inp[k]
    return None


def normalize_input(inp: dict[str, Any]) -> dict[str, Any]:
    """Accept camelCase or snake_case API payloads."""
    recorder = _get(inp, "recorder") or {}
    return {
        "cameraCount": int(_get(inp, "camera_count", "cameraCount") or 0),
        "indoorCount": _get(inp, "indoor_count", "indoorCount"),
        "outdoorCount": _get(inp, "outdoor_count", "outdoorCount"),
        "resolutionMp": _get(inp, "resolution_mp", "resolutionMp"),
        "retentionDays": _get(inp, "retention_days", "retentionDays"),
        "recordingMode": _get(inp, "recording_mode", "recordingMode"),
        "recordingHoursPerDay": _get(inp, "recording_hours_per_day", "recordingHoursPerDay"),
        "motionDutyCycle": _get(inp, "motion_duty_cycle", "motionDutyCycle"),
        "fps": _get(inp, "fps"),
        "codec": _get(inp, "codec"),
        "bitrateMbpsOverride": _get(inp, "bitrate_mbps_override", "bitrateMbpsOverride"),
        "bitrateMbps": _get(inp, "bitrate_mbps", "bitrateMbps"),
        "poeRequired": _get(inp, "poe_required", "poeRequired"),
        "architectureIntent": _get(inp, "architecture_intent", "architectureIntent") or "unknown",
        "expansionHeadroom": _get(inp, "expansion_headroom", "expansionHeadroom") or 0,
        "cableDistanceMeters": _get(inp, "cable_distance_meters", "cableDistanceMeters"),
        "remoteViewing": _get(inp, "remote_viewing", "remoteViewing"),
        "upsRequested": _get(inp, "ups_requested", "upsRequested"),
        "installationRequested": _get(inp, "installation_requested", "installationRequested"),
        "commissioningRequested": _get(inp, "commissioning_requested", "commissioningRequested"),
        "testingRequested": _get(inp, "testing_requested", "testingRequested"),
        "cameraMaxPowerW": _get(inp, "camera_max_power_w", "cameraMaxPowerW"),
        "cameraMaxPowerSource": _get(inp, "camera_max_power_source", "cameraMaxPowerSource"),
        "poeHeadroom": _get(inp, "poe_headroom", "poeHeadroom"),
        "storageOverhead": _get(inp, "storage_overhead", "storageOverhead"),
        "allowEngineeringPowerDefault": _get(inp, "allow_engineering_power_default", "allowEngineeringPowerDefault"),
        "manufacturerPreference": _get(inp, "manufacturer_preference", "manufacturerPreference"),
        "formFactor": _get(inp, "form_factor", "formFactor"),
        "environment": _get(inp, "environment"),
        "availableHddCapacitiesTb": _get(inp, "available_hdd_capacities_tb", "availableHddCapacitiesTb") or [],
        "recorder": {
            "channels": _get(recorder, "channels"),
            "poePorts": _get(recorder, "poe_ports", "poePorts"),
            "poeBudgetW": _get(recorder, "poe_budget_w", "poeBudgetW"),
            "driveBays": _get(recorder, "drive_bays", "driveBays"),
            "maxHddTb": _get(recorder, "max_hdd_tb", "maxHddTb"),
        },
    }


def build_cctv_requirements(raw_input: dict[str, Any]) -> dict[str, Any]:
    inp = normalize_input(raw_input)
    validation_errors = validate_cctv_sizing_input(inp)
    assumptions: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []

    if validation_errors:
        return {
            "version": CCTV_SIZING_ENGINE_VERSION,
            "input": inp,
            "valid": False,
            "validationErrors": validation_errors,
            "recorder": None,
            "storage": None,
            "hdd": None,
            "poe": None,
            "poeArchitecture": None,
            "infrastructure": evaluate_infrastructure(inp.get("cableDistanceMeters")),
            "serviceRequirements": [],
            "compatibility": [],
            "assumptions": [],
            "warnings": [],
            "unresolved": [{"code": e["code"], "params": {"field": e["field"]}} for e in validation_errors],
        }

    headroom = float(inp.get("expansionHeadroom") or 0)
    recorder = size_recorder(inp["cameraCount"], headroom)
    if recorder["status"] == "unsupported":
        unresolved.extend([r for r in recorder["reasons"] if r["code"] == "RECORDER_UNSUPPORTED_COUNT"])

    storage = calculate_storage(inp)
    assumptions.extend(storage.get("assumptions") or [])
    if storage.get("bitrateSource") == "ENGINEERING_DEFAULT":
        warnings.extend([r for r in storage["reasons"] if r["code"] == "STORAGE_BITRATE_DEFAULTED"])
    if storage["status"] in {"unresolved", "invalid"}:
        unresolved.extend([r for r in storage["reasons"] if r["code"] == "STORAGE_UNRESOLVED_BITRATE"])
        if storage["status"] == "invalid":
            unresolved.append({"code": "STORAGE_UNRESOLVED_BITRATE", "params": {"reason": "invalid_recording"}})

    hdd = None
    if storage["status"] == "ok" and storage.get("requiredTbWithOverhead") is not None:
        hdd = pack_hdds(
            required_tb=float(storage["requiredTbWithOverhead"]),
            available_capacities_tb=list(inp.get("availableHddCapacitiesTb") or []),
            drive_bays=(inp.get("recorder") or {}).get("driveBays"),
            max_hdd_tb=(inp.get("recorder") or {}).get("maxHddTb"),
        )
        if hdd["status"] != "ok":
            unresolved.extend(hdd["reasons"])

    poe_required = inp.get("poeRequired") is not False
    poe = calculate_poe(inp)
    if poe.get("powerSource") == "ENGINEERING_DEFAULT":
        warnings.extend([r for r in poe["reasons"] if r["code"] == "POE_POWER_ENGINEERING_DEFAULT"])
    if poe["status"] == "unresolved":
        unresolved.extend([r for r in poe["reasons"] if r["code"] == "POE_POWER_UNRESOLVED"])

    poe_architecture = evaluate_poe_architecture(
        {
            "poe_required": poe_required,
            "intent": inp.get("architectureIntent") or "unknown",
            "required_ports": poe["requiredPorts"],
            "required_budget_w": poe.get("requiredBudgetW"),
            "recorder_poe_ports": (inp.get("recorder") or {}).get("poePorts"),
            "recorder_poe_budget_w": (inp.get("recorder") or {}).get("poeBudgetW"),
        }
    )
    if poe_architecture["evaluation"] == "UNKNOWN" and poe_required:
        unresolved.append({"code": "NVR_POE_UNKNOWN", "params": {}})

    infrastructure = evaluate_infrastructure(inp.get("cableDistanceMeters"))
    if infrastructure["cableStatus"] == "unresolved":
        warnings.extend(infrastructure["reasons"])

    services = build_service_requirements(
        {
            "camera_count": inp["cameraCount"],
            "installation_requested": inp.get("installationRequested"),
            "remote_viewing": inp.get("remoteViewing"),
            "testing_requested": inp.get("testingRequested"),
            "commissioning_requested": inp.get("commissioningRequested"),
            "ups_requested": inp.get("upsRequested"),
        }
    )

    return {
        "version": CCTV_SIZING_ENGINE_VERSION,
        "input": inp,
        "valid": True,
        "validationErrors": [],
        "recorder": recorder,
        "storage": storage,
        "hdd": hdd,
        "poe": poe,
        "poeArchitecture": poe_architecture,
        "infrastructure": infrastructure,
        "serviceRequirements": services,
        "compatibility": [],
        "assumptions": assumptions,
        "warnings": warnings,
        "unresolved": unresolved,
    }
