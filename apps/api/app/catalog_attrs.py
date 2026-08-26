"""Catalog attribute schemas and unit labels — dynamic fields by category family."""

from __future__ import annotations

# App-side unit keys (stored on products.unit)
CATALOG_UNITS: dict[str, str] = {
    "unit": "יחידה",
    "m": "מטר",
    "roll": "גליל",
    "hour": "שעה",
    "job": "עבודה",
    "pack": "חבילה",
}

# Map leaf category key → attribute field definitions (label_he, type)
# Root family inferred from key prefixes when leaf not listed.
_ATTR_CAMERA = [
    {"key": "resolution", "label_he": "Resolution", "type": "text"},
    {"key": "lens", "label_he": "סוג עדשה", "type": "text"},
    {"key": "ir", "label_he": "IR", "type": "text"},
    {"key": "color_at_night", "label_he": "Color at Night", "type": "bool"},
    {"key": "audio", "label_he": "Audio", "type": "bool"},
    {"key": "poe", "label_he": "PoE", "type": "bool"},
    {"key": "ip_rating", "label_he": "IP Rating", "type": "text"},
    {"key": "ik_rating", "label_he": "IK Rating", "type": "text"},
]

_ATTR_SWITCH = [
    {"key": "ports", "label_he": "מספר פורטים", "type": "text"},
    {"key": "poe", "label_he": "PoE", "type": "bool"},
    {"key": "poe_plus", "label_he": "PoE+", "type": "bool"},
    {"key": "poe_plusplus", "label_he": "PoE++", "type": "bool"},
    {"key": "poe_budget", "label_he": "PoE Budget", "type": "text"},
    {"key": "gigabit", "label_he": "Gigabit", "type": "bool"},
    {"key": "sfp", "label_he": "SFP", "type": "bool"},
]

_ATTR_CABLE = [
    {"key": "length_m", "label_he": "אורך (מ׳)", "type": "text"},
    {"key": "outdoor", "label_he": "חוץ", "type": "bool"},
    {"key": "shielded", "label_he": "מסוכך", "type": "bool"},
]

_ATTR_NVR = [
    {"key": "channels", "label_he": "ערוצים", "type": "text"},
    {"key": "hdd_bays", "label_he": "מפרצי דיסק", "type": "text"},
    {"key": "poe_ports", "label_he": "פורטי PoE", "type": "text"},
]

_LEAF_SCHEMAS: dict[str, list[dict]] = {
    "cameras_ip": _ATTR_CAMERA,
    "cameras_analog": _ATTR_CAMERA,
    "cameras_ptz": _ATTR_CAMERA,
    "cameras_thermal": _ATTR_CAMERA,
    "cameras_special": _ATTR_CAMERA,
    "nvr": _ATTR_NVR,
    "dvr_xvr": _ATTR_NVR,
    "switch": _ATTR_SWITCH,
    "poe": _ATTR_SWITCH,
    "poe_plus": _ATTR_SWITCH,
    "poe_plusplus": _ATTR_SWITCH,
    "switch_managed": _ATTR_SWITCH,
    "switch_unmanaged": _ATTR_SWITCH,
    "switch_industrial": _ATTR_SWITCH,
    "cat5e": _ATTR_CABLE,
    "cat6": _ATTR_CABLE,
    "cat6a": _ATTR_CABLE,
    "cat7": _ATTR_CABLE,
    "fiber": _ATTR_CABLE,
    "coax": _ATTR_CABLE,
    "outdoor_network_cable": _ATTR_CABLE,
}

_ROOT_FALLBACK: dict[str, list[dict]] = {
    "video": _ATTR_CAMERA,
    "network": _ATTR_SWITCH,
    "cabling": _ATTR_CABLE,
}


def attribute_schema_for_category(*, category_key: str | None, parent_key: str | None = None) -> list[dict]:
    key = (category_key or "").strip()
    if key in _LEAF_SCHEMAS:
        return list(_LEAF_SCHEMAS[key])
    parent = (parent_key or "").strip()
    if parent in _ROOT_FALLBACK:
        return list(_ROOT_FALLBACK[parent])
    return []


def normalize_unit(raw: str | None) -> str:
    value = (raw or "unit").strip().lower()
    if value in CATALOG_UNITS:
        return value
    # legacy aliases
    if value in {"ea", "each", "pcs", "pc"}:
        return "unit"
    if value in {"meter", "metre", "meters"}:
        return "m"
    if value in {"hr", "hrs"}:
        return "hour"
    if value in {"package", "pkg"}:
        return "pack"
    return "unit"
