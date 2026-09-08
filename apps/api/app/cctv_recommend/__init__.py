"""Server-authoritative CCTV catalog resolver → SystemRecommendation (Task 13C)."""

from __future__ import annotations

from typing import Any

from ..cctv_sizing import build_cctv_requirements, pack_hdds
from ..catalog_attrs import (
    parse_camera_technical_attrs,
    parse_hdd_technical_attrs,
    parse_nvr_technical_attrs,
    parse_switch_technical_attrs,
)

CAMERA_LEAF_KEYS = frozenset(
    {"cameras_ip", "cameras_analog", "cameras_ptz", "cameras_thermal", "cameras_special"}
)
NVR_LEAF_KEYS = frozenset({"nvr", "dvr_xvr"})
HDD_LEAF_KEYS = frozenset({"hdd_recorders"})
SWITCH_LEAF_KEYS = frozenset(
    {
        "switch",
        "poe",
        "poe_plus",
        "poe_plusplus",
        "switch_managed",
        "switch_unmanaged",
        "switch_industrial",
    }
)
CABLE_LEAF_KEYS = frozenset(
    {"cat5e", "cat6", "cat6a", "cat7", "fiber", "coax", "outdoor_network_cable"}
)
LABOR_LEAF_KEYS = frozenset(
    {
        "labor_install_cameras",
        "labor_install_nvr",
        "labor_remote_view",
        "labor_system_setup",
        "labor_tech_visit",
        "labor_hourly",
    }
)

MAX_CANDIDATES = 3


def _num(attrs: dict[str, Any], *keys: str) -> float | None:
    for k in keys:
        if k in attrs and attrs[k] is not None and attrs[k] != "":
            try:
                return float(attrs[k])
            except (TypeError, ValueError):
                continue
    return None


def _env_compatible(requested: str | None, product_env: str | None) -> bool | None:
    if not requested:
        return True
    if not product_env:
        return None  # unknown
    if requested == "outdoor":
        return product_env in {"outdoor", "indoor_outdoor"}
    if requested == "indoor":
        return product_env in {"indoor", "indoor_outdoor"}
    if requested == "indoor_outdoor":
        return product_env == "indoor_outdoor"
    return True


def _manufacturer_match(pref: str | None, product_mfr: str | None) -> bool:
    if not pref:
        return False
    return (product_mfr or "").strip().lower() == pref.strip().lower()


def _product_summary(product: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": product.get("id"),
        "sku": product.get("sku"),
        "name": product.get("name"),
        "manufacturer": product.get("manufacturer"),
        "model": product.get("model"),
        "category_key": product.get("category_key"),
        "unit": product.get("unit"),
        "list_price": product.get("list_price"),
        "attributes": product.get("attributes") if isinstance(product.get("attributes"), dict) else {},
    }


def _rank_key_stable(product: dict[str, Any]) -> tuple:
    return (
        (product.get("name") or "").lower(),
        (product.get("sku") or "").lower(),
        str(product.get("id") or ""),
    )


def resolve_cameras(
    *,
    products: list[dict[str, Any]],
    requested_mp: float | None,
    environment: str | None,
    form_factor: str | None,
    poe_required: bool,
    manufacturer_preference: str | None,
) -> dict[str, Any]:
    structured: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    for p in products:
        if p.get("category_key") not in CAMERA_LEAF_KEYS:
            continue
        cam = parse_camera_technical_attrs(p.get("attributes") or {})
        checks: dict[str, str] = {}
        ok = True

        if requested_mp is not None:
            if cam.resolution_mp is None:
                checks["resolution_mp"] = "UNKNOWN"
                ok = False
            elif cam.resolution_mp + 1e-9 < float(requested_mp):
                checks["resolution_mp"] = "FAIL"
                ok = False
            else:
                checks["resolution_mp"] = "PASS"

        env_ok = _env_compatible(environment, cam.environment)
        if environment:
            if env_ok is True:
                checks["environment"] = "PASS"
            elif env_ok is False:
                checks["environment"] = "FAIL"
                ok = False
            else:
                # Product lacks explicit indoor/outdoor metadata — keep as candidate
                # with PARTIAL confidence. Do NOT invent environment from IP67/prose.
                checks["environment"] = "UNKNOWN"

        if form_factor:
            if cam.form_factor is None:
                checks["form_factor"] = "UNKNOWN"
            elif cam.form_factor != form_factor:
                checks["form_factor"] = "FAIL"
                ok = False
            else:
                checks["form_factor"] = "PASS"

        if poe_required:
            if cam.poe is True:
                checks["poe"] = "PASS"
            elif cam.poe is False:
                checks["poe"] = "FAIL"
                ok = False
            else:
                checks["poe"] = "UNKNOWN"
                # unknown PoE is partial — allow with reduced confidence
                pass

        if not ok:
            continue

        overspec = 0.0
        if requested_mp is not None and cam.resolution_mp is not None:
            overspec = max(0.0, float(cam.resolution_mp) - float(requested_mp))

        pref = _manufacturer_match(manufacturer_preference, p.get("manufacturer"))
        completeness = sum(1 for v in checks.values() if v == "PASS")
        structured.append(
            {
                "product": _product_summary(p),
                "confidence": "STRUCTURED" if "UNKNOWN" not in checks.values() else "PARTIAL",
                "compatibility": checks,
                "reason_codes": [
                    {"code": "CAMERA_STRUCTURED_MATCH", "params": {"checks": checks}},
                ],
                "_rank": (
                    0 if pref else 1,
                    0 if "UNKNOWN" not in checks.values() else 1,
                    overspec,
                    *_rank_key_stable(p),
                ),
            }
        )

    structured.sort(key=lambda c: c["_rank"])
    for c in structured:
        c.pop("_rank", None)

    if manufacturer_preference and structured and not _manufacturer_match(
        manufacturer_preference, structured[0]["product"].get("manufacturer")
    ):
        warnings.append(
            {
                "code": "PREFERRED_MANUFACTURER_UNAVAILABLE",
                "params": {"preference": manufacturer_preference, "role": "camera"},
            }
        )

    selected = structured[0] if structured else None
    status = "RESOLVED" if selected and selected["confidence"] == "STRUCTURED" else (
        "PARTIAL" if selected else "UNRESOLVED"
    )
    if selected and (selected.get("compatibility") or {}).get("environment") == "UNKNOWN" and environment:
        warnings.append(
            {
                "code": "CAMERA_ENVIRONMENT_UNVERIFIED",
                "params": {"requested": environment},
            }
        )
    if not environment:
        warnings.append({"code": "ENVIRONMENT_UNSPECIFIED", "params": {}})
    return {
        "role": "camera",
        "status": status,
        "selected": selected,
        "candidates": structured[:MAX_CANDIDATES],
        "warnings": warnings,
        "blocking": status == "UNRESOLVED",
    }


def resolve_recorders(
    *,
    products: list[dict[str, Any]],
    min_channels: int,
    require_integrated_poe: bool,
    required_poe_ports: int | None,
    required_poe_budget_w: float | None,
    min_drive_bays: int | None,
    min_max_hdd_tb: float | None,
    manufacturer_preference: str | None,
) -> dict[str, Any]:
    structured: list[dict[str, Any]] = []
    text_assisted: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    for p in products:
        if p.get("category_key") not in NVR_LEAF_KEYS:
            continue
        nvr = parse_nvr_technical_attrs(p.get("attributes") or {})
        checks: dict[str, str] = {}

        if nvr.channels is None:
            # text-assisted only — never auto-certify
            text_assisted.append(
                {
                    "product": _product_summary(p),
                    "confidence": "TEXT_ASSISTED",
                    "compatibility": {"channels": "UNKNOWN"},
                    "reason_codes": [{"code": "NVR_TEXT_ASSISTED_REQUIRES_VERIFICATION", "params": {}}],
                }
            )
            continue

        if nvr.channels + 1e-9 < min_channels:
            continue
        checks["channels"] = "PASS"

        if min_drive_bays is not None:
            if nvr.drive_bays is None:
                checks["drive_bays"] = "UNKNOWN"
            elif nvr.drive_bays < min_drive_bays:
                checks["drive_bays"] = "FAIL"
                continue
            else:
                checks["drive_bays"] = "PASS"

        if min_max_hdd_tb is not None:
            if nvr.max_hdd_tb is None:
                checks["max_hdd_tb"] = "UNKNOWN"
            elif nvr.max_hdd_tb + 1e-9 < min_max_hdd_tb:
                checks["max_hdd_tb"] = "FAIL"
                continue
            else:
                checks["max_hdd_tb"] = "PASS"

        if require_integrated_poe:
            if required_poe_ports is not None:
                if nvr.poe_ports is None:
                    checks["poe_ports"] = "UNKNOWN"
                    continue
                if nvr.poe_ports < required_poe_ports:
                    checks["poe_ports"] = "FAIL"
                    continue
                checks["poe_ports"] = "PASS"
            if required_poe_budget_w is not None:
                if nvr.poe_budget_w is None:
                    checks["poe_budget_w"] = "UNKNOWN"
                    continue
                if nvr.poe_budget_w + 1e-9 < required_poe_budget_w:
                    checks["poe_budget_w"] = "FAIL"
                    continue
                checks["poe_budget_w"] = "PASS"

        excess_ch = float(nvr.channels) - float(min_channels)
        pref = _manufacturer_match(manufacturer_preference, p.get("manufacturer"))
        structured.append(
            {
                "product": _product_summary(p),
                "confidence": "STRUCTURED" if "UNKNOWN" not in checks.values() else "PARTIAL",
                "compatibility": checks,
                "reason_codes": [
                    {
                        "code": "RECORDER_STRUCTURED_MATCH",
                        "params": {"minChannels": min_channels, "channels": nvr.channels},
                    }
                ],
                "_rank": (0 if pref else 1, excess_ch, *_rank_key_stable(p)),
            }
        )

    structured.sort(key=lambda c: c["_rank"])
    for c in structured:
        c.pop("_rank", None)

    if manufacturer_preference and structured and not _manufacturer_match(
        manufacturer_preference, structured[0]["product"].get("manufacturer")
    ):
        warnings.append(
            {
                "code": "PREFERRED_MANUFACTURER_UNAVAILABLE",
                "params": {"preference": manufacturer_preference, "role": "recorder"},
            }
        )

    selected = structured[0] if structured else None
    candidates = structured[:MAX_CANDIDATES]
    if not selected and text_assisted:
        # expose text-assisted as manual review, not selected
        candidates = text_assisted[:MAX_CANDIDATES]
        status = "UNRESOLVED"
        warnings.append({"code": "NVR_ONLY_TEXT_ASSISTED", "params": {"count": len(text_assisted)}})
    else:
        status = "RESOLVED" if selected and selected["confidence"] == "STRUCTURED" else (
            "PARTIAL" if selected else "UNRESOLVED"
        )

    return {
        "role": "recorder",
        "status": status,
        "selected": selected,
        "candidates": candidates,
        "warnings": warnings,
        "blocking": status == "UNRESOLVED",
        "technical_requirements": {
            "minChannels": min_channels,
            "requireIntegratedPoe": require_integrated_poe,
            "requiredPoePorts": required_poe_ports,
            "requiredPoeBudgetW": required_poe_budget_w,
        },
    }


def resolve_hdds(
    *,
    products: list[dict[str, Any]],
    required_tb: float | None,
    drive_bays: int | None,
    max_hdd_tb: float | None,
    manufacturer_preference: str | None,
) -> dict[str, Any]:
    warnings: list[dict[str, Any]] = []
    if required_tb is None:
        return {
            "role": "storage",
            "status": "UNRESOLVED",
            "selected": None,
            "candidates": [],
            "warnings": [{"code": "STORAGE_UNRESOLVED_BITRATE", "params": {}}],
            "blocking": True,
            "packing": None,
        }

    capacity_products: dict[float, list[dict[str, Any]]] = {}
    for p in products:
        if p.get("category_key") not in HDD_LEAF_KEYS:
            continue
        hdd = parse_hdd_technical_attrs(p.get("attributes") or {})
        if hdd.capacity_tb is None:
            continue
        capacity_products.setdefault(float(hdd.capacity_tb), []).append(p)

    available = sorted(capacity_products.keys())
    packing = pack_hdds(
        required_tb=float(required_tb),
        available_capacities_tb=available,
        drive_bays=drive_bays,
        max_hdd_tb=max_hdd_tb,
    )
    if packing["status"] != "ok":
        return {
            "role": "storage",
            "status": "UNRESOLVED",
            "selected": None,
            "candidates": [],
            "warnings": packing["reasons"],
            "blocking": True,
            "packing": packing,
        }

    size = float(packing["driveCapacityTb"])
    qty = int(packing["driveCount"])
    pool = capacity_products.get(size, [])

    ranked: list[dict[str, Any]] = []
    for p in pool:
        hdd = parse_hdd_technical_attrs(p.get("attributes") or {})
        conf = "STRUCTURED"
        if hdd.surveillance_grade is True:
            grade_rank = 0
        elif hdd.surveillance_grade is False:
            grade_rank = 2
            conf = "PARTIAL"
            warnings.append({"code": "HDD_NOT_SURVEILLANCE_GRADE", "params": {"productId": p.get("id")}})
        else:
            grade_rank = 1
            conf = "PARTIAL"
            warnings.append({"code": "HDD_SURVEILLANCE_GRADE_UNKNOWN", "params": {"productId": p.get("id")}})
        pref = _manufacturer_match(manufacturer_preference, p.get("manufacturer"))
        ranked.append(
            {
                "product": _product_summary(p),
                "confidence": conf,
                "compatibility": {"capacity_tb": "PASS", "surveillance_grade": "PASS" if hdd.surveillance_grade is True else "UNKNOWN"},
                "reason_codes": [
                    {
                        "code": "HDD_STRUCTURED_MATCH",
                        "params": {"capacityTb": size, "qty": qty},
                    }
                ],
                "quantity": qty,
                "_rank": (0 if pref else 1, grade_rank, *_rank_key_stable(p)),
            }
        )
    ranked.sort(key=lambda c: c["_rank"])
    for c in ranked:
        c.pop("_rank", None)

    selected = ranked[0] if ranked else None
    status = "RESOLVED" if selected and selected["confidence"] == "STRUCTURED" else (
        "PARTIAL" if selected else "UNRESOLVED"
    )
    return {
        "role": "storage",
        "status": status,
        "selected": selected,
        "candidates": ranked[:MAX_CANDIDATES],
        "warnings": warnings,
        "blocking": status == "UNRESOLVED",
        "packing": packing,
        "quantity": qty,
    }


def resolve_switches(
    *,
    products: list[dict[str, Any]],
    min_ports: int,
    min_poe_ports: int,
    min_budget_w: float | None,
    manufacturer_preference: str | None,
) -> dict[str, Any]:
    structured: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    for p in products:
        if p.get("category_key") not in SWITCH_LEAF_KEYS:
            continue
        sw = parse_switch_technical_attrs(p.get("attributes") or {})
        checks: dict[str, str] = {}
        if sw.ports is None or sw.poe_ports is None:
            continue
        if sw.ports < min_ports or sw.poe_ports < min_poe_ports:
            continue
        checks["ports"] = "PASS"
        checks["poe_ports"] = "PASS"
        if min_budget_w is not None:
            if sw.poe_budget_w is None:
                continue  # unknown budget ≠ sufficient
            if sw.poe_budget_w + 1e-9 < min_budget_w:
                continue
            checks["poe_budget_w"] = "PASS"
        excess = (sw.ports - min_ports) + (sw.poe_ports - min_poe_ports)
        if min_budget_w is not None and sw.poe_budget_w is not None:
            excess += (sw.poe_budget_w - min_budget_w) / 100.0
        pref = _manufacturer_match(manufacturer_preference, p.get("manufacturer"))
        structured.append(
            {
                "product": _product_summary(p),
                "confidence": "STRUCTURED",
                "compatibility": checks,
                "reason_codes": [
                    {
                        "code": "SWITCH_STRUCTURED_MATCH",
                        "params": {
                            "minPorts": min_ports,
                            "minPoePorts": min_poe_ports,
                            "minBudgetW": min_budget_w,
                        },
                    }
                ],
                "_rank": (0 if pref else 1, excess, *_rank_key_stable(p)),
            }
        )
    structured.sort(key=lambda c: c["_rank"])
    for c in structured:
        c.pop("_rank", None)
    selected = structured[0] if structured else None
    status = "RESOLVED" if selected else "UNRESOLVED"
    if manufacturer_preference and selected and not _manufacturer_match(
        manufacturer_preference, selected["product"].get("manufacturer")
    ):
        warnings.append(
            {
                "code": "PREFERRED_MANUFACTURER_UNAVAILABLE",
                "params": {"preference": manufacturer_preference, "role": "poe_switch"},
            }
        )
    return {
        "role": "poe_switch",
        "status": status,
        "selected": selected,
        "candidates": structured[:MAX_CANDIDATES],
        "warnings": warnings,
        "blocking": status == "UNRESOLVED",
        "technical_requirements": {
            "minPorts": min_ports,
            "minPoePorts": min_poe_ports,
            "minPoeBudgetW": min_budget_w,
        },
    }


def _cable_unit_is_length(unit: str | None) -> bool | None:
    """True if unit is meters; False if discrete ea/box; None if unknown."""
    if not unit:
        return None
    u = str(unit).strip().lower()
    if u in {"m", "meter", "meters", "metre", "metres", "מטר", "מ'", "lm", "מטר רץ"}:
        return True
    if u in {"ea", "each", "unit", "pcs", "pc", "יח", "יחידה", "box", "קופסה", "גליל"}:
        return False
    return None


def resolve_cable(
    *,
    products: list[dict[str, Any]],
    meters: float | None,
) -> dict[str, Any]:
    if meters is None:
        return {
            "role": "cable",
            "status": "UNRESOLVED",
            "selected": None,
            "candidates": [],
            "warnings": [{"code": "CABLE_DISTANCE_UNRESOLVED", "params": {}}],
            "blocking": False,
            "quantity": None,
        }
    cables = [p for p in products if p.get("category_key") in CABLE_LEAF_KEYS]
    ranked: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    for p in cables:
        unit_kind = _cable_unit_is_length(p.get("unit"))
        if unit_kind is False:
            # Discrete package — cannot auto-convert meters → boxes without pack size
            ranked.append(
                {
                    "product": _product_summary(p),
                    "confidence": "PARTIAL",
                    "compatibility": {"unit": "UNKNOWN"},
                    "reason_codes": [
                        {
                            "code": "CABLE_UNIT_REQUIRES_MANUAL_QTY",
                            "params": {"meters": meters, "unit": p.get("unit")},
                        }
                    ],
                    "quantity": 1,
                    "_rank": (2, *_rank_key_stable(p)),
                }
            )
            continue
        qty = float(meters) if unit_kind is True else float(meters)
        conf = "STRUCTURED" if unit_kind is True else "PARTIAL"
        if unit_kind is None:
            warnings.append(
                {
                    "code": "CABLE_UNIT_UNKNOWN_ASSUMED_METERS",
                    "params": {"productId": p.get("id"), "unit": p.get("unit"), "meters": meters},
                }
            )
        ranked.append(
            {
                "product": _product_summary(p),
                "confidence": conf,
                "compatibility": {"unit": "PASS" if unit_kind is True else "UNKNOWN"},
                "reason_codes": [{"code": "CABLE_CATEGORY_MATCH", "params": {"meters": meters, "qty": qty}}],
                "quantity": qty,
                "_rank": (0 if unit_kind is True else 1, *_rank_key_stable(p)),
            }
        )
    ranked.sort(key=lambda c: c["_rank"])
    for c in ranked:
        c.pop("_rank", None)
    # Prefer length-priced cable for auto-select; never auto-select discrete pack as meters
    auto = next((c for c in ranked if c["confidence"] == "STRUCTURED"), None)
    selected = auto
    status = "RESOLVED" if selected else ("PARTIAL" if ranked else "UNRESOLVED")
    if not selected and ranked:
        warnings.append({"code": "CABLE_NO_METER_UNIT_PRODUCT", "params": {"meters": meters}})
    return {
        "role": "cable",
        "status": status,
        "selected": selected,
        "candidates": ranked[:MAX_CANDIDATES],
        "warnings": warnings,
        "blocking": False,
        "quantity": float(meters) if selected else None,
    }


UPS_LEAF_KEYS = frozenset({"ups", "battery", "power_backup", "pdu"})


def resolve_service(
    *,
    role: str,
    qty: int,
    products: list[dict[str, Any]],
    preferred_keys: frozenset[str],
) -> dict[str, Any]:
    keys = preferred_keys
    if role == "ups" and not keys:
        keys = UPS_LEAF_KEYS
    preferred = [p for p in products if p.get("category_key") in keys]
    # Do NOT fall back to arbitrary services/labor — wrong SKU is worse than unresolved
    preferred.sort(key=_rank_key_stable)
    if not preferred:
        return {
            "role": role,
            "status": "UNRESOLVED",
            "selected": None,
            "candidates": [],
            "warnings": [{"code": "SERVICE_UNRESOLVED", "params": {"role": role}}],
            "blocking": False,
            "quantity": qty,
        }
    candidates = [
        {
            "product": _product_summary(p),
            "confidence": "STRUCTURED",
            "compatibility": {"category": "PASS"},
            "reason_codes": [{"code": "SERVICE_CATEGORY_MATCH", "params": {"role": role, "qty": qty}}],
            "quantity": qty,
        }
        for p in preferred[:MAX_CANDIDATES]
    ]
    return {
        "role": role,
        "status": "RESOLVED",
        "selected": candidates[0],
        "candidates": candidates,
        "warnings": [],
        "blocking": False,
        "quantity": qty,
    }


SERVICE_ROLE_CATEGORIES = {
    "camera_install": frozenset({"labor_install_cameras"}),
    "recorder_setup": frozenset({"labor_install_nvr", "labor_system_setup"}),
    "remote_viewing_setup": frozenset({"labor_remote_view"}),
    "testing": frozenset({"labor_system_setup", "labor_tech_visit"}),
    "commissioning": frozenset({"labor_system_setup"}),
    "ups": UPS_LEAF_KEYS,
}


def _structured_count(products: list[dict[str, Any]], keys: frozenset[str], attr_key: str) -> int:
    n = 0
    for p in products:
        if p.get("category_key") not in keys:
            continue
        attrs = p.get("attributes") if isinstance(p.get("attributes"), dict) else {}
        if attrs.get(attr_key) is not None and attrs.get(attr_key) != "":
            n += 1
    return n


def catalog_readiness(products: list[dict[str, Any]]) -> dict[str, Any]:
    cameras = _structured_count(products, CAMERA_LEAF_KEYS, "resolution_mp")
    nvrs = _structured_count(products, NVR_LEAF_KEYS, "channels")
    hdds = _structured_count(products, HDD_LEAF_KEYS, "capacity_tb")
    switches = _structured_count(products, SWITCH_LEAF_KEYS, "poe_ports")
    empty = len(products) == 0
    return {
        "empty_catalog": empty,
        "camera_structured": cameras,
        "nvr_structured": nvrs,
        "hdd_structured": hdds,
        "switch_structured": switches,
        "ready_for_core": cameras > 0 and nvrs > 0 and hdds > 0,
        "missing_families": [
            name
            for name, count in (
                ("camera", cameras),
                ("recorder", nvrs),
                ("storage", hdds),
                ("poe_switch", switches),
            )
            if count == 0
        ],
    }


def build_system_recommendation(
    *,
    raw_input: dict[str, Any],
    catalog_products: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Authoritative flow:
    sizing → (re)pack HDD using actual catalog capacities → resolve products → SystemRecommendation
    """
    # First pass sizing without HDD capacities from catalog — storage TB still computed
    engineering = build_cctv_requirements(raw_input)
    if not engineering.get("valid"):
        return {
            "system_type": "cctv",
            "engine_version": engineering["version"],
            "input": engineering.get("input"),
            "engineering": engineering,
            "components": [],
            "warnings": [],
            "assumptions": [],
            "unresolved": engineering.get("unresolved") or [],
            "blocking": True,
            "status": "INVALID_INPUT",
        }

    inp = engineering["input"]
    manufacturer_preference = inp.get("manufacturerPreference")
    poe = engineering.get("poe") or {}
    intent = inp.get("architectureIntent") or "unknown"
    poe_required = inp.get("poeRequired") is not False

    # Prefer integrated NVR PoE when requested; only force external switch if no adequate NVR
    # or user explicitly prefers external switching.
    force_external = intent == "prefer_external_switch"
    try_integrated = poe_required and not force_external

    env = inp.get("environment")
    if not env and inp.get("outdoorCount") and inp.get("cameraCount") and inp["outdoorCount"] == inp["cameraCount"]:
        env = "outdoor"
    elif not env and inp.get("indoorCount") and inp.get("cameraCount") and inp["indoorCount"] == inp["cameraCount"]:
        env = "indoor"

    camera = resolve_cameras(
        products=catalog_products,
        requested_mp=float(inp["resolutionMp"]) if inp.get("resolutionMp") is not None else None,
        environment=env,
        form_factor=inp.get("formFactor"),
        poe_required=poe_required,
        manufacturer_preference=manufacturer_preference,
    )
    camera["quantity"] = inp["cameraCount"]
    camera["label"] = "camera"
    camera["optional"] = False
    camera["editable"] = True
    camera["technical_requirements"] = {
        "resolutionMpMin": inp.get("resolutionMp"),
        "environment": env,
        "formFactor": inp.get("formFactor"),
        "poe": poe_required,
    }
    camera["reason_codes"] = [{"code": "ROLE_CAMERA_FROM_COUNT", "params": {"qty": inp["cameraCount"]}}]

    min_channels = (engineering.get("recorder") or {}).get("selectedChannelTier") or 4
    storage = engineering.get("storage") or {}
    required_tb = storage.get("requiredTbWithOverhead")

    hdd_products = [p for p in catalog_products if p.get("category_key") in HDD_LEAF_KEYS]
    capacities = []
    for p in hdd_products:
        hdd = parse_hdd_technical_attrs(p.get("attributes") or {})
        if hdd.capacity_tb is not None:
            capacities.append(float(hdd.capacity_tb))

    # Provisional pack to know bay/size needs when capacities exist
    provisional_pack = None
    if required_tb is not None and capacities:
        provisional_pack = pack_hdds(
            required_tb=float(required_tb),
            available_capacities_tb=capacities,
            drive_bays=(inp.get("recorder") or {}).get("driveBays") or 8,
            max_hdd_tb=(inp.get("recorder") or {}).get("maxHddTb"),
        )

    min_bays = int(provisional_pack["driveCount"]) if provisional_pack and provisional_pack.get("status") == "ok" else None
    min_drive_tb = float(provisional_pack["driveCapacityTb"]) if provisional_pack and provisional_pack.get("status") == "ok" else None

    recorder = None
    external_switch = force_external
    if try_integrated and poe.get("status") == "ok":
        recorder = resolve_recorders(
            products=catalog_products,
            min_channels=int(min_channels),
            require_integrated_poe=True,
            required_poe_ports=poe.get("requiredPorts"),
            required_poe_budget_w=poe.get("requiredBudgetW"),
            min_drive_bays=min_bays,
            min_max_hdd_tb=min_drive_tb,
            manufacturer_preference=manufacturer_preference,
        )
        if recorder.get("selected"):
            external_switch = False
        else:
            external_switch = True

    if recorder is None or (external_switch and not recorder.get("selected")):
        recorder = resolve_recorders(
            products=catalog_products,
            min_channels=int(min_channels),
            require_integrated_poe=False,
            required_poe_ports=None,
            required_poe_budget_w=None,
            min_drive_bays=min_bays,
            min_max_hdd_tb=min_drive_tb,
            manufacturer_preference=manufacturer_preference,
        )
        if try_integrated and not force_external and not recorder.get("selected"):
            external_switch = True
        elif force_external:
            external_switch = True
        elif recorder.get("selected") and try_integrated and poe.get("status") != "ok":
            # PoE budget unknown → cannot certify integrated; require switch path
            external_switch = True

    # Re-pack using selected recorder bay limits when available
    drive_bays = (inp.get("recorder") or {}).get("driveBays")
    max_hdd = (inp.get("recorder") or {}).get("maxHddTb")
    if recorder.get("selected"):
        nvr_attrs = parse_nvr_technical_attrs(recorder["selected"]["product"].get("attributes") or {})
        if nvr_attrs.drive_bays is not None:
            drive_bays = nvr_attrs.drive_bays
        if nvr_attrs.max_hdd_tb is not None:
            max_hdd = nvr_attrs.max_hdd_tb

    hdd = resolve_hdds(
        products=catalog_products,
        required_tb=float(required_tb) if required_tb is not None else None,
        drive_bays=int(drive_bays) if drive_bays is not None else None,
        max_hdd_tb=float(max_hdd) if max_hdd is not None else None,
        manufacturer_preference=manufacturer_preference,
    )
    hdd["label"] = "storage"
    hdd["optional"] = False
    hdd["editable"] = True
    hdd["technical_requirements"] = {"requiredTb": required_tb}
    hdd["reason_codes"] = [{"code": "ROLE_STORAGE_FROM_RETENTION", "params": {"requiredTb": required_tb}}]

    recorder["quantity"] = 1
    recorder["label"] = "recorder"
    recorder["optional"] = False
    recorder["editable"] = True
    recorder["reason_codes"] = list(recorder.get("reason_codes") or []) + list(
        (engineering.get("recorder") or {}).get("reasons") or []
    )

    components: list[dict[str, Any]] = [camera, recorder, hdd]

    # Align engineering.poeArchitecture with final external_switch decision
    if external_switch:
        sw_req = {
            "minPorts": poe.get("requiredPorts") or inp["cameraCount"],
            "minPoePorts": poe.get("requiredPorts") or inp["cameraCount"],
            "minPoeBudgetW": poe.get("requiredBudgetW"),
        }
        engineering = {
            **engineering,
            "poeArchitecture": {
                "evaluation": "INSUFFICIENT_PORTS" if force_external else "UNKNOWN",
                "externalSwitchRequired": True,
                "switchRequirement": sw_req,
                "reasons": [{"code": "EXTERNAL_SWITCH_REQUIRED", "params": {"forced": force_external}}],
            },
        }
        switch = resolve_switches(
            products=catalog_products,
            min_ports=int(sw_req["minPorts"]),
            min_poe_ports=int(sw_req["minPoePorts"]),
            min_budget_w=sw_req.get("minPoeBudgetW"),
            manufacturer_preference=manufacturer_preference,
        )
        switch["quantity"] = 1
        switch["label"] = "poe_switch"
        switch["optional"] = False
        switch["editable"] = True
        switch["reason_codes"] = [{"code": "EXTERNAL_SWITCH_REQUIRED", "params": {}}]
        components.append(switch)
    else:
        engineering = {
            **engineering,
            "poeArchitecture": {
                "evaluation": "SUFFICIENT",
                "externalSwitchRequired": False,
                "switchRequirement": None,
                "reasons": [{"code": "EXTERNAL_SWITCH_NOT_REQUIRED", "params": {"reason": "integrated_nvr_poe"}}],
            },
        }

    cable = resolve_cable(
        products=catalog_products,
        meters=(engineering.get("infrastructure") or {}).get("cableMeters"),
    )
    cable["label"] = "cable"
    cable["optional"] = True
    cable["editable"] = True
    components.append(cable)

    for svc in engineering.get("serviceRequirements") or []:
        role = svc["role"]
        resolved = resolve_service(
            role=role,
            qty=int(svc["qty"]),
            products=catalog_products,
            preferred_keys=SERVICE_ROLE_CATEGORIES.get(role, frozenset()),
        )
        resolved["label"] = role
        resolved["optional"] = role in {"ups", "commissioning", "remote_viewing_setup"}
        resolved["editable"] = True
        components.append(resolved)

    warnings = list(engineering.get("warnings") or [])
    assumptions = list(engineering.get("assumptions") or [])
    unresolved = list(engineering.get("unresolved") or [])
    # Drop stale NVR_POE_UNKNOWN if we resolved integrated path
    if not external_switch:
        unresolved = [u for u in unresolved if u.get("code") != "NVR_POE_UNKNOWN"]

    for c in components:
        warnings.extend(c.get("warnings") or [])
        if c.get("status") == "UNRESOLVED" and c.get("blocking"):
            unresolved.append({"code": "COMPONENT_UNRESOLVED", "params": {"role": c["role"]}})

    blocking_roles = {"camera", "recorder", "storage"}
    if external_switch:
        blocking_roles.add("poe_switch")
    blocking = any(c.get("blocking") for c in components if c.get("role") in blocking_roles)

    if hdd.get("packing"):
        engineering = {**engineering, "hdd": hdd["packing"]}

    readiness = catalog_readiness(catalog_products)
    if readiness["empty_catalog"]:
        warnings.append({"code": "CATALOG_EMPTY", "params": {}})
    elif not readiness["ready_for_core"]:
        warnings.append(
            {
                "code": "CATALOG_CORE_INCOMPLETE",
                "params": {"missing": readiness["missing_families"]},
            }
        )

    return {
        "system_type": "cctv",
        "engine_version": engineering["version"],
        "input": inp,
        "engineering": engineering,
        "components": [
            {
                "role": c["role"],
                "label": c.get("label") or c["role"],
                "quantity": c.get("quantity")
                if c.get("quantity") is not None
                else ((c.get("selected") or {}).get("quantity") or 1),
                "technical_requirements": c.get("technical_requirements") or {},
                "selected_product": (c.get("selected") or {}).get("product"),
                "selected_confidence": (c.get("selected") or {}).get("confidence"),
                "selected_compatibility": (c.get("selected") or {}).get("compatibility"),
                "candidates": [
                    {
                        "product": x["product"],
                        "confidence": x["confidence"],
                        "compatibility": x.get("compatibility"),
                        "reason_codes": x.get("reason_codes"),
                        "quantity": x.get("quantity"),
                    }
                    for x in (c.get("candidates") or [])
                ],
                "resolution_status": c.get("status"),
                "reason_codes": c.get("reason_codes") or [],
                "optional": bool(c.get("optional")),
                "editable": bool(c.get("editable", True)),
                "blocking": bool(c.get("blocking")),
            }
            for c in components
        ],
        "warnings": warnings,
        "assumptions": assumptions,
        "unresolved": unresolved,
        "blocking": blocking,
        "status": "BLOCKED" if blocking else "OK",
        "catalog_readiness": readiness,
        "catalog_stats": {
            "products_examined": len(catalog_products),
            "by_family": {
                "camera": sum(1 for p in catalog_products if p.get("category_key") in CAMERA_LEAF_KEYS),
                "nvr": sum(1 for p in catalog_products if p.get("category_key") in NVR_LEAF_KEYS),
                "hdd": sum(1 for p in catalog_products if p.get("category_key") in HDD_LEAF_KEYS),
                "switch": sum(1 for p in catalog_products if p.get("category_key") in SWITCH_LEAF_KEYS),
                "cable": sum(1 for p in catalog_products if p.get("category_key") in CABLE_LEAF_KEYS),
                "labor": sum(1 for p in catalog_products if p.get("category_key") in LABOR_LEAF_KEYS),
            },
        },
    }
