"""Catalog attribute schemas, unit labels, and CCTV technical validation.

Attribute shapes are code-defined over products.attributes JSONB.
Missing keys mean unknown — never coerce to 0/false.
No DB migration; no schema versioning subsystem (CCTV_ATTR_SCHEMA_REVISION is docs-only).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

# Docs-only revision marker for Task 13A/13B consumers (not stored on products).
CCTV_ATTR_SCHEMA_REVISION = 1

# App-side unit keys (stored on products.unit)
CATALOG_UNITS: dict[str, str] = {
    "unit": "יחידה",
    "m": "מטר",
    "roll": "גליל",
    "hour": "שעה",
    "job": "עבודה",
    "pack": "חבילה",
}

CAMERA_ENVIRONMENTS = ("indoor", "outdoor", "indoor_outdoor")
CAMERA_FORM_FACTORS = ("bullet", "dome", "turret", "ptz", "other")

# Technical keys reserved for CCTV sizing — rejected when sent under the wrong leaf schema.
_CCTV_TECHNICAL_KEYS: frozenset[str] = frozenset(
    {
        "resolution_mp",
        "environment",
        "form_factor",
        "poe",
        "max_power_w",
        "codec",
        "fps",
        "onvif",
        "lens_mm",
        "channels",
        "poe_ports",
        "poe_budget_w",
        "drive_bays",
        "max_hdd_tb",
        "max_incoming_bandwidth_mbps",
        "codecs",
        "capacity_tb",
        "surveillance_grade",
        "ports",
        "port_speed_mbps",
        "uplink_speed_mbps",
    }
)

_ATTR_CAMERA: list[dict[str, Any]] = [
    {
        "key": "resolution_mp",
        "label_he": "רזולוציה (MP)",
        "type": "number",
        "integer": False,
        "minimum": 0.1,
        "maximum": 128,
    },
    {
        "key": "environment",
        "label_he": "סביבת התקנה",
        "type": "enum",
        "enum": list(CAMERA_ENVIRONMENTS),
        "enum_labels_he": {
            "indoor": "פנים",
            "outdoor": "חוץ",
            "indoor_outdoor": "פנים וחוץ",
        },
    },
    {
        "key": "form_factor",
        "label_he": "מבנה מצלמה",
        "type": "enum",
        "enum": list(CAMERA_FORM_FACTORS),
        "enum_labels_he": {
            "bullet": "קנה",
            "dome": "כיפה",
            "turret": "טורט",
            "ptz": "PTZ",
            "other": "אחר",
        },
    },
    {"key": "poe", "label_he": "תמיכה ב־PoE", "type": "bool", "tristate": True},
    {
        "key": "max_power_w",
        "label_he": "צריכת הספק מרבית (W)",
        "type": "number",
        "integer": False,
        "minimum": 0,
        "maximum": 200,
    },
    {"key": "codec", "label_he": "קודק", "type": "text", "max_length": 80},
    {
        "key": "fps",
        "label_he": "קצב פריימים (FPS)",
        "type": "number",
        "integer": False,
        "minimum": 1,
        "maximum": 120,
    },
    {"key": "onvif", "label_he": "תמיכה ב־ONVIF", "type": "bool", "tristate": True},
    {
        "key": "lens_mm",
        "label_he": "עדשה (מ״מ)",
        "type": "number",
        "integer": False,
        "minimum": 0.1,
        "maximum": 500,
    },
]

_ATTR_NVR: list[dict[str, Any]] = [
    {
        "key": "channels",
        "label_he": "מספר ערוצים",
        "type": "number",
        "integer": True,
        "minimum": 1,
        "maximum": 256,
    },
    {
        "key": "poe_ports",
        "label_he": "יציאות PoE",
        "type": "number",
        "integer": True,
        "minimum": 0,
        "maximum": 256,
    },
    {
        "key": "poe_budget_w",
        "label_he": "תקציב PoE (W)",
        "type": "number",
        "integer": False,
        "minimum": 0,
        "maximum": 2000,
    },
    {
        "key": "drive_bays",
        "label_he": "מפרצי דיסקים",
        "type": "number",
        "integer": True,
        "minimum": 0,
        "maximum": 64,
    },
    {
        "key": "max_hdd_tb",
        "label_he": "נפח דיסק מרבי (TB)",
        "type": "number",
        "integer": False,
        "minimum": 0.1,
        "maximum": 100,
    },
    {
        "key": "max_incoming_bandwidth_mbps",
        "label_he": "רוחב פס נכנס מרבי (Mbps)",
        "type": "number",
        "integer": False,
        "minimum": 1,
        "maximum": 10000,
    },
    {"key": "codecs", "label_he": "קודקים נתמכים", "type": "text", "max_length": 160},
]

_ATTR_HDD: list[dict[str, Any]] = [
    {
        "key": "capacity_tb",
        "label_he": "נפח דיסק (TB)",
        "type": "number",
        "integer": False,
        "minimum": 0.1,
        "maximum": 100,
    },
    {
        "key": "surveillance_grade",
        "label_he": "דיסק לדרגת מעקב",
        "type": "bool",
        "tristate": True,
    },
]

_ATTR_SWITCH: list[dict[str, Any]] = [
    {
        "key": "ports",
        "label_he": "מספר פורטים",
        "type": "number",
        "integer": True,
        "minimum": 1,
        "maximum": 128,
    },
    {
        "key": "poe_ports",
        "label_he": "יציאות PoE",
        "type": "number",
        "integer": True,
        "minimum": 0,
        "maximum": 128,
    },
    {
        "key": "poe_budget_w",
        "label_he": "תקציב PoE (W)",
        "type": "number",
        "integer": False,
        "minimum": 0,
        "maximum": 2000,
    },
    {
        "key": "port_speed_mbps",
        "label_he": "מהירות פורט (Mbps)",
        "type": "number",
        "integer": True,
        "minimum": 10,
        "maximum": 100000,
    },
    {
        "key": "uplink_speed_mbps",
        "label_he": "מהירות אפלינק (Mbps)",
        "type": "number",
        "integer": True,
        "minimum": 10,
        "maximum": 100000,
    },
]

_ATTR_CABLE: list[dict[str, Any]] = [
    {
        "key": "length_m",
        "label_he": "אורך בגליל (מ׳)",
        "type": "number",
        "integer": False,
        "minimum": 0.1,
        "maximum": 5000,
    },
    {"key": "outdoor", "label_he": "מיועד לחוץ", "type": "bool", "tristate": True},
    {"key": "shielded", "label_he": "מסוכך", "type": "bool", "tristate": True},
]

_LEAF_SCHEMAS: dict[str, list[dict[str, Any]]] = {
    "cameras_ip": _ATTR_CAMERA,
    "cameras_analog": _ATTR_CAMERA,
    "cameras_ptz": _ATTR_CAMERA,
    "cameras_thermal": _ATTR_CAMERA,
    "cameras_special": _ATTR_CAMERA,
    "nvr": _ATTR_NVR,
    "dvr_xvr": _ATTR_NVR,
    "hdd_recorders": _ATTR_HDD,
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

# Parent fallback only for families without a dedicated leaf.
# Intentionally NO "video" → camera fallback (would mis-schema hdd_recorders / accessories).
_ROOT_FALLBACK: dict[str, list[dict[str, Any]]] = {
    "network": _ATTR_SWITCH,
    "cabling": _ATTR_CABLE,
}


def attribute_schema_for_category(*, category_key: str | None, parent_key: str | None = None) -> list[dict]:
    key = (category_key or "").strip()
    if key in _LEAF_SCHEMAS:
        return [dict(f) for f in _LEAF_SCHEMAS[key]]
    parent = (parent_key or "").strip()
    if parent in _ROOT_FALLBACK:
        return [dict(f) for f in _ROOT_FALLBACK[parent]]
    return []


def normalize_unit(raw: str | None) -> str:
    value = (raw or "unit").strip().lower()
    if value in CATALOG_UNITS:
        return value
    if value in {"ea", "each", "pcs", "pc"}:
        return "unit"
    if value in {"meter", "metre", "meters"}:
        return "m"
    if value in {"hr", "hrs"}:
        return "hour"
    if value in {"package", "pkg"}:
        return "pack"
    return "unit"


def _schema_keys(schema: list[dict[str, Any]]) -> set[str]:
    return {str(f["key"]) for f in schema if f.get("key")}


def _field_by_key(schema: list[dict[str, Any]], key: str) -> dict[str, Any] | None:
    for field in schema:
        if field.get("key") == key:
            return field
    return None


def _is_blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and value.strip() == "":
        return True
    return False


def _parse_number(value: Any, *, integer: bool) -> float | int:
    if isinstance(value, bool):
        raise ValueError("מספר לא תקין")
    if isinstance(value, int):
        num: float | int = value
    elif isinstance(value, float):
        num = value
    elif isinstance(value, str):
        text = value.strip().replace(",", "")
        if not text:
            raise ValueError("מספר חסר")
        num = float(text)
    else:
        raise ValueError("מספר לא תקין")
    if integer:
        if isinstance(num, float) and not num.is_integer():
            raise ValueError("נדרש מספר שלם")
        return int(num)
    return float(num)


def _validate_field_value(field: dict[str, Any], value: Any) -> Any:
    ftype = field.get("type")
    if ftype == "bool":
        if value is None:
            return None
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {"", "unknown", "null"}:
                return None
            if lowered in {"true", "1", "yes", "כן"}:
                return True
            if lowered in {"false", "0", "no", "לא"}:
                return False
        raise ValueError("ערך בוליאני לא תקין")

    if ftype == "enum":
        if not isinstance(value, str):
            raise ValueError("ערך בחירה לא תקין")
        choice = value.strip()
        allowed = field.get("enum") or []
        if choice not in allowed:
            raise ValueError("ערך לא ברשימה המותרת")
        return choice

    if ftype == "number":
        num = _parse_number(value, integer=bool(field.get("integer")))
        minimum = field.get("minimum")
        maximum = field.get("maximum")
        if minimum is not None and num < minimum:
            raise ValueError(f"ערך קטן מהמינימום ({minimum})")
        if maximum is not None and num > maximum:
            raise ValueError(f"ערך גדול מהמקסימום ({maximum})")
        return num

    if ftype == "text":
        if not isinstance(value, str):
            raise ValueError("טקסט לא תקין")
        text = value.strip()
        max_length = int(field.get("max_length") or 200)
        if len(text) > max_length:
            raise ValueError("טקסט ארוך מדי")
        return text

    # Legacy / unknown field types — store trimmed string
    if isinstance(value, (bool, int, float)):
        return value
    return str(value).strip()


def validate_product_attributes(
    attributes: dict[str, Any] | None,
    *,
    category_key: str | None,
    parent_key: str | None = None,
) -> dict[str, Any]:
    """Validate and normalize attributes for a category.

    - Missing / blank / null optional values are omitted (unknown).
    - Reserved CCTV technical keys belonging to other schemas are rejected.
    - Non-technical unknown keys are preserved (legacy / forward-compat).
    """
    raw = attributes if isinstance(attributes, dict) else {}
    schema = attribute_schema_for_category(category_key=category_key, parent_key=parent_key)
    allowed = _schema_keys(schema)
    out: dict[str, Any] = {}
    field_errors: dict[str, str] = {}

    for key, value in raw.items():
        if key in allowed:
            if _is_blank(value):
                continue
            field = _field_by_key(schema, key)
            if not field:
                continue
            try:
                parsed = _validate_field_value(field, value)
            except ValueError as exc:
                field_errors[key] = str(exc)
                continue
            if parsed is None:
                continue
            out[key] = parsed
            continue

        if key in _CCTV_TECHNICAL_KEYS:
            field_errors[key] = "שדה טכני שאינו שייך לקטגוריה זו"
            continue

        # Preserve non-technical / legacy keys without coercion.
        if value is None:
            continue
        out[key] = value

    # Cross-field: PoE ports cannot exceed total ports when both known (switch).
    ports = out.get("ports")
    poe_ports = out.get("poe_ports")
    if (
        isinstance(ports, int)
        and isinstance(poe_ports, int)
        and "ports" in allowed
        and "poe_ports" in allowed
        and poe_ports > ports
    ):
        field_errors["poe_ports"] = "יציאות PoE לא יכולות לעלות על מספר הפורטים"

    if field_errors:
        raise AttributeValidationError(field_errors)

    return out


class AttributeValidationError(ValueError):
    def __init__(self, field_errors: dict[str, str]) -> None:
        self.field_errors = field_errors
        super().__init__("שגיאת ולידציית מאפיינים")


@dataclass(frozen=True)
class CameraTechnicalAttrs:
    resolution_mp: float | None = None
    environment: str | None = None
    form_factor: str | None = None
    poe: bool | None = None
    max_power_w: float | None = None
    codec: str | None = None
    fps: float | None = None
    onvif: bool | None = None
    lens_mm: float | None = None


@dataclass(frozen=True)
class NvrTechnicalAttrs:
    channels: int | None = None
    poe_ports: int | None = None
    poe_budget_w: float | None = None
    drive_bays: int | None = None
    max_hdd_tb: float | None = None
    max_incoming_bandwidth_mbps: float | None = None
    codecs: str | None = None


@dataclass(frozen=True)
class HddTechnicalAttrs:
    capacity_tb: float | None = None
    surveillance_grade: bool | None = None


@dataclass(frozen=True)
class SwitchTechnicalAttrs:
    ports: int | None = None
    poe_ports: int | None = None
    poe_budget_w: float | None = None
    port_speed_mbps: int | None = None
    uplink_speed_mbps: int | None = None


def _get_number(attrs: dict[str, Any], key: str, *aliases: str) -> float | None:
    for k in (key, *aliases):
        if k not in attrs or attrs[k] is None:
            continue
        try:
            return float(attrs[k])
        except (TypeError, ValueError):
            continue
    return None


def _get_int(attrs: dict[str, Any], key: str, *aliases: str) -> int | None:
    num = _get_number(attrs, key, *aliases)
    if num is None:
        return None
    if float(num).is_integer():
        return int(num)
    return None


def _get_bool(attrs: dict[str, Any], key: str) -> bool | None:
    if key not in attrs or attrs[key] is None:
        return None
    value = attrs[key]
    if isinstance(value, bool):
        return value
    return None


def _get_str(attrs: dict[str, Any], key: str) -> str | None:
    value = attrs.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def parse_camera_technical_attrs(attributes: dict[str, Any] | None) -> CameraTechnicalAttrs:
    attrs = attributes if isinstance(attributes, dict) else {}
    return CameraTechnicalAttrs(
        resolution_mp=_get_number(attrs, "resolution_mp"),
        environment=_get_str(attrs, "environment"),
        form_factor=_get_str(attrs, "form_factor"),
        poe=_get_bool(attrs, "poe"),
        max_power_w=_get_number(attrs, "max_power_w"),
        codec=_get_str(attrs, "codec"),
        fps=_get_number(attrs, "fps"),
        onvif=_get_bool(attrs, "onvif"),
        lens_mm=_get_number(attrs, "lens_mm"),
    )


def parse_nvr_technical_attrs(attributes: dict[str, Any] | None) -> NvrTechnicalAttrs:
    attrs = attributes if isinstance(attributes, dict) else {}
    return NvrTechnicalAttrs(
        channels=_get_int(attrs, "channels"),
        poe_ports=_get_int(attrs, "poe_ports"),
        poe_budget_w=_get_number(attrs, "poe_budget_w", "poe_budget"),
        drive_bays=_get_int(attrs, "drive_bays", "hdd_bays"),
        max_hdd_tb=_get_number(attrs, "max_hdd_tb"),
        max_incoming_bandwidth_mbps=_get_number(attrs, "max_incoming_bandwidth_mbps"),
        codecs=_get_str(attrs, "codecs"),
    )


def parse_hdd_technical_attrs(attributes: dict[str, Any] | None) -> HddTechnicalAttrs:
    attrs = attributes if isinstance(attributes, dict) else {}
    return HddTechnicalAttrs(
        capacity_tb=_get_number(attrs, "capacity_tb"),
        surveillance_grade=_get_bool(attrs, "surveillance_grade"),
    )


def parse_switch_technical_attrs(attributes: dict[str, Any] | None) -> SwitchTechnicalAttrs:
    attrs = attributes if isinstance(attributes, dict) else {}
    return SwitchTechnicalAttrs(
        ports=_get_int(attrs, "ports"),
        poe_ports=_get_int(attrs, "poe_ports"),
        poe_budget_w=_get_number(attrs, "poe_budget_w", "poe_budget"),
        port_speed_mbps=_get_int(attrs, "port_speed_mbps"),
        uplink_speed_mbps=_get_int(attrs, "uplink_speed_mbps"),
    )


def technical_attrs_completeness(
    *,
    category_key: str | None,
    parent_key: str | None = None,
    attributes: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Tiny signal for Task 13B: structured vs incomplete — not a quality score UI."""
    schema = attribute_schema_for_category(category_key=category_key, parent_key=parent_key)
    if not schema:
        return {"family": None, "complete": True, "present": 0, "expected": 0, "missing_keys": []}
    attrs = attributes if isinstance(attributes, dict) else {}
    # Core keys for sizing readiness (optional schema fields excluded from "required for complete")
    core_by_prefix: dict[str, tuple[str, ...]] = {
        "cameras_": ("resolution_mp", "environment", "form_factor", "poe", "max_power_w"),
        "nvr": ("channels", "drive_bays", "max_hdd_tb"),
        "dvr_xvr": ("channels", "drive_bays", "max_hdd_tb"),
        "hdd_recorders": ("capacity_tb",),
        "switch": ("ports", "poe_ports", "poe_budget_w"),
        "poe": ("ports", "poe_ports", "poe_budget_w"),
    }
    key = (category_key or "").strip()
    core: tuple[str, ...] = ()
    family: str | None = None
    if key.startswith("cameras_"):
        core = core_by_prefix["cameras_"]
        family = "camera"
    elif key in core_by_prefix:
        core = core_by_prefix[key]
        family = {
            "nvr": "nvr",
            "dvr_xvr": "nvr",
            "hdd_recorders": "hdd",
            "switch": "switch",
            "poe": "switch",
            "poe_plus": "switch",
            "poe_plusplus": "switch",
            "switch_managed": "switch",
            "switch_unmanaged": "switch",
            "switch_industrial": "switch",
        }.get(key, key)
    elif key.startswith("switch") or key.startswith("poe"):
        core = ("ports", "poe_ports", "poe_budget_w")
        family = "switch"

    missing = [k for k in core if k not in attrs or attrs[k] is None or attrs[k] == ""]
    return {
        "family": family,
        "complete": len(missing) == 0 and bool(core),
        "present": len(core) - len(missing),
        "expected": len(core),
        "missing_keys": missing,
        "schema_revision": CCTV_ATTR_SCHEMA_REVISION,
    }
