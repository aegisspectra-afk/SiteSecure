"""Deterministic value normalization for catalog import (no AI)."""

from __future__ import annotations

import re
from typing import Any

# Verified Hebrew → form_factor (ambiguous compounds handled carefully).
_FORM_FACTOR_MAP: dict[str, str] = {
    "צינור": "bullet",
    "bullet": "bullet",
    "כיפה": "dome",
    "dome": "dome",
    "טורט": "turret",
    "turret": "turret",
    "כיפה טורט": "turret",
    "ptz": "ptz",
    "ממונעת": "ptz",
    "מצלמה ממונעת ptz": "ptz",
    "מצלמת ptz": "ptz",
}

_ENV_MAP: dict[str, str] = {
    "פנים": "indoor",
    "indoor": "indoor",
    "חוץ": "outdoor",
    "outdoor": "outdoor",
    "פנים וחוץ": "indoor_outdoor",
    "indoor_outdoor": "indoor_outdoor",
}

_BOOL_TRUE = {"כן", "yes", "true", "1", "√", "v", "y"}
_BOOL_FALSE = {"לא", "no", "false", "0", "x", "✗", "ללא"}


def _strip(val: Any) -> str:
    if val is None:
        return ""
    if isinstance(val, bool):
        return "true" if val else "false"
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        # Avoid 227.0 → "227.0" noise for ints
        if isinstance(val, float) and val.is_integer():
            return str(int(val))
        return str(val)
    s = str(val).strip()
    if s.upper() in {"#VALUE!", "#REF!", "#N/A", "#DIV/0!", "#NAME?"}:
        return ""
    return s


def normalize_resolution_mp(raw: Any) -> tuple[float | None, str]:
    """Return (value, class) where class is DIRECT|NORMALIZED|UNKNOWN."""
    s = _strip(raw)
    if not s:
        return None, "UNKNOWN"
    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        v = float(raw)
        if v > 0:
            return v, "DIRECT"
    # Dual sensors e.g. 4MP+4MP — do not invent a single number
    if "+" in s or "," in s:
        return None, "UNKNOWN"
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:mp|מגה|מ\"?פ)?", s, re.I)
    if m:
        return float(m.group(1)), "NORMALIZED"
    return None, "UNKNOWN"


def normalize_lens_mm(raw: Any) -> tuple[float | None, str]:
    s = _strip(raw)
    if not s:
        return None, "UNKNOWN"
    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        return float(raw), "DIRECT"
    # Ranges stay unknown for numeric lens_mm
    if re.search(r"\d+\s*[-–—]\s*\d+", s) or "~" in s:
        return None, "UNKNOWN"
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:mm|מ\"?מ)?", s, re.I)
    if m:
        return float(m.group(1)), "NORMALIZED"
    return None, "UNKNOWN"


def normalize_mbps(raw: Any) -> tuple[float | None, str]:
    s = _strip(raw)
    if not s:
        return None, "UNKNOWN"
    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        return float(raw), "DIRECT"
    # Multi-mode AI on/off blocks → unknown unless a single token
    if s.count("Mbps") + s.count("mbps") + s.count("MBPS") > 1:
        return None, "UNKNOWN"
    if "\n" in s and re.search(r"\d", s):
        # Prefer first simple "NMbps" if only one number-like Mbps
        matches = re.findall(r"(\d+(?:\.\d+)?)\s*Mbps", s, re.I)
        if len(matches) == 1:
            return float(matches[0]), "NORMALIZED"
        return None, "UNKNOWN"
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:Mbps|mbps|M)?", s)
    if m:
        return float(m.group(1)), "NORMALIZED"
    return None, "UNKNOWN"


def normalize_number(raw: Any, *, integer: bool = False) -> tuple[float | int | None, str]:
    s = _strip(raw)
    if not s:
        return None, "UNKNOWN"
    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        v = int(raw) if integer else float(raw)
        return v, "DIRECT"
    # Hebrew "ללא" for counts → 0
    if s.lower() in _BOOL_FALSE or s == "ללא":
        return (0 if integer else 0.0), "NORMALIZED"
    m = re.search(r"(-?\d+(?:\.\d+)?)", s.replace(",", ""))
    if not m:
        return None, "UNKNOWN"
    v = float(m.group(1))
    return (int(v) if integer else v), "NORMALIZED"


def normalize_bool_tristate(raw: Any) -> tuple[bool | None, str]:
    s = _strip(raw).lower()
    if not s:
        return None, "UNKNOWN"
    if isinstance(raw, bool):
        return raw, "DIRECT"
    if s in _BOOL_TRUE:
        return True, "NORMALIZED"
    if s in _BOOL_FALSE:
        return False, "NORMALIZED"
    if "poe" in s:
        return True, "NORMALIZED"
    return None, "UNKNOWN"


def normalize_form_factor(raw: Any) -> tuple[str | None, str, bool]:
    """Returns (value, class, needs_confirmation)."""
    s = _strip(raw)
    if not s:
        return None, "UNKNOWN", False
    low = s.lower().strip()
    # Prefer longer keys
    for key, mapped in sorted(_FORM_FACTOR_MAP.items(), key=lambda kv: -len(kv[0])):
        if key in low or key in s:
            # "כיפה אנטי-ואנדל" → dome (safe)
            if key == "כיפה" and "טורט" in s:
                return "turret", "NORMALIZED", False
            return mapped, "NORMALIZED", False
    if "אנטי" in s and "כיפה" in s:
        return "dome", "NORMALIZED", False
    return None, "UNKNOWN", True


def normalize_environment(raw: Any) -> tuple[str | None, str]:
    s = _strip(raw)
    if not s:
        return None, "UNKNOWN"
    low = s.lower()
    for key, mapped in _ENV_MAP.items():
        if key in low or key in s:
            return mapped, "NORMALIZED"
    return None, "UNKNOWN"


def normalize_poe_from_power(raw: Any) -> tuple[bool | None, str]:
    s = _strip(raw)
    if not s:
        return None, "UNKNOWN"
    if re.search(r"poe", s, re.I):
        return True, "NORMALIZED"
    return normalize_bool_tristate(raw)[:2]


def normalize_mapped_value(field: str, raw: Any) -> dict[str, Any]:
    """
    Normalize a mapped cell into SITE SECURE field value.
    Returns {value, provenance, warning?}.
    value None means UNKNOWN / omit from attributes.
    """
    if field in {"sku", "name", "description", "manufacturer", "model", "unit", "kind", "category"}:
        s = _strip(raw)
        if field == "sku" and s:
            # Numeric SKUs become strings
            return {"value": s, "provenance": "DIRECT"}
        if field == "unit" and s:
            return {"value": s.lower(), "provenance": "DIRECT"}
        return {"value": s or None, "provenance": "DIRECT" if s else "UNKNOWN"}

    if field in {"cost", "list_price"}:
        s = _strip(raw).replace(",", "").replace("₪", "").replace("NIS", "")
        if not s:
            return {"value": None, "provenance": "UNKNOWN"}
        if isinstance(raw, (int, float)) and not isinstance(raw, bool):
            return {"value": float(raw), "provenance": "DIRECT"}
        m = re.search(r"(\d+(?:\.\d+)?)", s)
        if m:
            return {"value": float(m.group(1)), "provenance": "NORMALIZED"}
        return {"value": None, "provenance": "UNKNOWN", "warning": "invalid_price"}

    attr = field.removeprefix("attributes.") if field.startswith("attributes.") else field

    if attr == "resolution_mp":
        v, prov = normalize_resolution_mp(raw)
        return {"value": v, "provenance": prov}
    if attr == "lens_mm":
        v, prov = normalize_lens_mm(raw)
        out: dict[str, Any] = {"value": v, "provenance": prov}
        if prov == "UNKNOWN" and _strip(raw):
            out["warning"] = "lens_range_or_unparsed"
        return out
    if attr == "max_incoming_bandwidth_mbps":
        v, prov = normalize_mbps(raw)
        return {"value": v, "provenance": prov}
    if attr in {
        "channels",
        "poe_ports",
        "drive_bays",
        "ports",
        "fps",
        "port_speed_mbps",
        "uplink_speed_mbps",
    }:
        v, prov = normalize_number(raw, integer=True)
        return {"value": v, "provenance": prov}
    if attr in {"max_power_w", "poe_budget_w", "max_hdd_tb", "capacity_tb"}:
        v, prov = normalize_number(raw, integer=False)
        return {"value": v, "provenance": prov}
    if attr == "form_factor":
        v, prov, needs = normalize_form_factor(raw)
        out = {"value": v, "provenance": prov}
        if needs and not v:
            out["warning"] = "form_factor_ambiguous"
        return out
    if attr == "environment":
        v, prov = normalize_environment(raw)
        return {"value": v, "provenance": prov}
    if attr == "poe":
        v, prov = normalize_poe_from_power(raw)
        return {"value": v, "provenance": prov}
    if attr in {"onvif", "surveillance_grade"}:
        v, prov = normalize_bool_tristate(raw)
        return {"value": v, "provenance": prov}
    if attr in {"codec", "codecs"}:
        s = _strip(raw)
        return {"value": s or None, "provenance": "DIRECT" if s else "UNKNOWN"}

    # Unknown target field — pass through as string only for commercial extras
    s = _strip(raw)
    return {"value": s or None, "provenance": "DIRECT" if s else "UNKNOWN"}
