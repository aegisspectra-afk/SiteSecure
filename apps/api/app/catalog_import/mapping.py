"""Header auto-mapping suggestions (deterministic keyword rules)."""

from __future__ import annotations

import re
from typing import Any

# Ordered: first match wins. More specific patterns first.
_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"מק.?ט|sku|part\s*no|item\s*code|קוד", re.I), "sku"),
    (re.compile(r"דגם|model", re.I), "model"),
    (re.compile(r"יצרן|manufacturer|מותג|brand", re.I), "manufacturer"),
    (re.compile(r"תאור\s*מקוצר|שם|name|product\s*name|תאור מוצר", re.I), "name"),
    (re.compile(r"תאור\s*מורחב|description|תיאור", re.I), "description"),
    (re.compile(r"מחיר\s*מתקין|עלות|cost|purchase|dealer|מחירון\s*מתקין", re.I), "cost"),
    (re.compile(r"מחיר\s*מכירה|list\s*price|sale|מחירון\s*לקוח|selling", re.I), "list_price"),
    (re.compile(r"יחידה|unit", re.I), "unit"),
    (re.compile(r"קטגור|category", re.I), "category"),
    (re.compile(r"רזולוצ|resolution", re.I), "attributes.resolution_mp"),
    (re.compile(r"סוג\s*מצלמה|form\s*factor|camera\s*type", re.I), "attributes.form_factor"),
    (re.compile(r"גודל\s*עדשה|lens|עדשה", re.I), "attributes.lens_mm"),
    (re.compile(r"סביבה|environment|פנים.?חוץ", re.I), "attributes.environment"),
    (re.compile(r"דחיסת|codec|קידוד", re.I), "attributes.codec"),
    (re.compile(r"onvif", re.I), "attributes.onvif"),
    (re.compile(r"הספק|max\s*power|צריכת|watt", re.I), "attributes.max_power_w"),
    (re.compile(r"מתח\s*הפעלה|poe|power", re.I), "attributes.poe"),
    (re.compile(r"fps|פריים", re.I), "attributes.fps"),
    (re.compile(r"ערוצ|channel", re.I), "attributes.channels"),
    (re.compile(r"יציאות\s*poe|poe\s*ports", re.I), "attributes.poe_ports"),
    (re.compile(r"תקציב\s*poe|poe\s*budget", re.I), "attributes.poe_budget_w"),
    (re.compile(r"כמות\s*כוננ|מפרצ|drive\s*bay|hdd\s*bay|מקום\s*לכוננ", re.I), "attributes.drive_bays"),
    (re.compile(r"נפח\s*דיסק\s*מרבי|max\s*hdd|max\s*tb", re.I), "attributes.max_hdd_tb"),
    (re.compile(r"רוחב\s*פס|bandwidth|incoming", re.I), "attributes.max_incoming_bandwidth_mbps"),
    (re.compile(r"קודקים|codecs", re.I), "attributes.codecs"),
    (re.compile(r"נפח|capacity|tb", re.I), "attributes.capacity_tb"),
    (re.compile(r"surveillance|מעקב", re.I), "attributes.surveillance_grade"),
    (re.compile(r"^ports$|מספר\s*פורט|ports", re.I), "attributes.ports"),
    (re.compile(r"port\s*speed|מהירות\s*פורט", re.I), "attributes.port_speed_mbps"),
    (re.compile(r"uplink|אפלינק", re.I), "attributes.uplink_speed_mbps"),
]

_SKIP_HEADERS = re.compile(
    r"תמונה|image|picture|photo|#value|חזרה|מפרט\s*טכני|url|link|קופסת\s*חיבור",
    re.I,
)


TARGET_FIELDS: list[dict[str, str]] = [
    {"key": "sku", "label_he": "מק״ט"},
    {"key": "manufacturer", "label_he": "יצרן"},
    {"key": "model", "label_he": "דגם"},
    {"key": "name", "label_he": "שם"},
    {"key": "description", "label_he": "תיאור"},
    {"key": "unit", "label_he": "יחידה"},
    {"key": "cost", "label_he": "עלות / מחיר מתקין"},
    {"key": "list_price", "label_he": "מחיר מכירה"},
    {"key": "attributes.resolution_mp", "label_he": "רזולוציה (MP)"},
    {"key": "attributes.environment", "label_he": "סביבה"},
    {"key": "attributes.form_factor", "label_he": "מבנה מצלמה"},
    {"key": "attributes.poe", "label_he": "PoE"},
    {"key": "attributes.max_power_w", "label_he": "הספק (W)"},
    {"key": "attributes.codec", "label_he": "קודק"},
    {"key": "attributes.fps", "label_he": "FPS"},
    {"key": "attributes.onvif", "label_he": "ONVIF"},
    {"key": "attributes.lens_mm", "label_he": "עדשה (מ״מ)"},
    {"key": "attributes.channels", "label_he": "ערוצים"},
    {"key": "attributes.poe_ports", "label_he": "יציאות PoE"},
    {"key": "attributes.poe_budget_w", "label_he": "תקציב PoE"},
    {"key": "attributes.drive_bays", "label_he": "מפרצי דיסק"},
    {"key": "attributes.max_hdd_tb", "label_he": "נפח דיסק מרבי"},
    {"key": "attributes.max_incoming_bandwidth_mbps", "label_he": "רוחב פס נכנס"},
    {"key": "attributes.codecs", "label_he": "קודקים"},
    {"key": "attributes.capacity_tb", "label_he": "נפח HDD"},
    {"key": "attributes.surveillance_grade", "label_he": "דיסק מעקב"},
    {"key": "attributes.ports", "label_he": "פורטים"},
    {"key": "attributes.port_speed_mbps", "label_he": "מהירות פורט"},
    {"key": "attributes.uplink_speed_mbps", "label_he": "אפלינק"},
]


_COMMERCIAL_EXACT = {
    "sku",
    "manufacturer",
    "model",
    "name",
    "description",
    "unit",
    "cost",
    "list_price",
    "kind",
    "category",
}

_ATTR_EXACT = {
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


def suggest_field_for_header(header: str | None) -> str | None:
    if header is None:
        return None
    h = str(header).strip()
    if not h or _SKIP_HEADERS.search(h):
        return None
    key = h.lower()
    if key in _COMMERCIAL_EXACT:
        return key
    if key in _ATTR_EXACT:
        return f"attributes.{key}"
    for pattern, field in _RULES:
        if pattern.search(h):
            return field
    return None


def suggest_column_map(headers: list[Any]) -> dict[str, str]:
    """Map column index (str) → target field. Unique targets preferred."""
    used: set[str] = set()
    out: dict[str, str] = {}
    for i, h in enumerate(headers):
        field = suggest_field_for_header(h if isinstance(h, str) else (str(h) if h is not None else None))
        if not field or field in used:
            continue
        used.add(field)
        out[str(i)] = field
    return out


def suggest_sheet_include(name: str) -> bool:
    n = (name or "").strip().lower()
    if not n:
        return False
    skip_tokens = (
        "תפריט",
        "menu",
        "wps",
        "cellimg",
        "reserved",
        "cover",
        "הוראות",
    )
    if n.startswith("!"):
        return False
    for t in skip_tokens:
        if t in n:
            return False
    # Empty accessory-looking sheets still includeable if user wants
    return True


def suggest_category_key(sheet_name: str) -> str | None:
    n = (sheet_name or "").lower()
    if "dvr" in n or "xvr" in n:
        return "dvr_xvr"
    if "nvr" in n or "מקליט" in n or ("הקלטה" in n and "מצלמ" not in n):
        return "nvr"
    if "ptz" in n or "ממונע" in n:
        return "cameras_ptz"
    if "tvi" in n or "אנלוג" in n or "analog" in n:
        return "cameras_analog"
    if "ipc" in n or "מצלמ" in n or "camera" in n or "lpr" in n:
        return "cameras_ip"
    if "hdd" in n or "disk" in n or "כונן" in n:
        return "hdd_recorders"
    if "switch" in n or "מתג" in n:
        return "switch"
    if "אביז" in n or "access" in n or "כללי" in n or "הוראות" in n:
        return None
    return None
