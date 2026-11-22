"""Workspace-level quote terms templates and create-quote defaults (Master Brief B7)."""

from __future__ import annotations

from typing import Any, Literal

TermsKind = Literal["payment_terms", "warranty", "notes"]

# Stable IDs for built-in library entries (persisted in workspace_settings.quotes.terms_templates).
BUILTIN_TERMS_TEMPLATES: list[dict[str, str]] = [
    {
        "id": "pay_net30",
        "kind": "payment_terms",
        "name_he": "שוטף + 30",
        "body": "תשלום שוטף + 30 ימים ממועד החשבונית.",
    },
    {
        "id": "pay_50_50",
        "kind": "payment_terms",
        "name_he": "מקדמה 50%",
        "body": "50% מקדמה עם אישור ההזמנה, 50% עם סיום העבודה במקום.",
    },
    {
        "id": "pay_annual",
        "kind": "payment_terms",
        "name_he": "תשלום שנתי",
        "body": "תשלום שנתי מראש לתקופת החוזה.",
    },
    {
        "id": "warr_install_12",
        "kind": "warranty",
        "name_he": "אחריות התקנה 12 חודשים",
        "body": "אחריות התקנה — 12 חודשים מיום ההפעלה. אחריות יצרן לציוד לפי תעודת היצרן.",
    },
    {
        "id": "warr_cctv_24",
        "kind": "warranty",
        "name_he": "אחריות ציוד 24 חודשים",
        "body": "אחריות יצרן על ציוד — 24 חודשים. אחריות התקנה — 12 חודשים.",
    },
    {
        "id": "warr_maintenance",
        "kind": "warranty",
        "name_he": "כיסוי תחזוקה",
        "body": "כיסוי ביקורים מונעים ותיקון תקלות שוטפות בהתאם לנספח השירות.",
    },
    {
        "id": "notes_standard",
        "kind": "notes",
        "name_he": "הערה ללקוח",
        "body": "המחירים אינם כוללים מיסים אלא אם צוין אחרת. ההצעה כפופה לסיור ואישור סופי בשטח.",
    },
]

DEFAULT_GENERAL_TERMS = (
    "ההצעה ניתנת לביטול בכתב עד 7 ימים לפני מועד ביצוע העבודה. "
    "שינויים בהיקף לאחר אישור ההזמנה יחויבו בנפרד."
)

MAINTENANCE_ANNUAL_TEMPLATE_KEY = "maintenance_annual"


def _text(value: object) -> str:
    return str(value or "").strip()


def workspace_terms_library(quotes_cfg: dict | None) -> list[dict[str, Any]]:
    cfg = quotes_cfg if isinstance(quotes_cfg, dict) else {}
    raw = cfg.get("terms_templates")
    if isinstance(raw, list) and raw:
        return [dict(x) for x in raw if isinstance(x, dict)]
    return [dict(x) for x in BUILTIN_TERMS_TEMPLATES]


def merge_workspace_quote_terms_defaults(quotes_cfg: dict | None) -> dict[str, Any]:
    """Ensure quotes JSON has library + default text fields when missing."""
    cfg = dict(quotes_cfg or {})
    if not cfg.get("terms_templates"):
        cfg["terms_templates"] = workspace_terms_library(cfg)
    if not _text(cfg.get("warranty")):
        cfg["warranty"] = BUILTIN_TERMS_TEMPLATES[3]["body"]
    if not _text(cfg.get("general_terms")):
        cfg["general_terms"] = DEFAULT_GENERAL_TERMS
    # customer_notes: empty is valid — do not invent per-quote notes
    if "customer_notes" not in cfg:
        cfg["customer_notes"] = ""
    return cfg


def apply_workspace_terms_to_create(payload: dict, quotes_cfg: dict | None) -> None:
    """Fill unset quote term fields from workspace_settings.quotes (B7)."""
    cfg = merge_workspace_quote_terms_defaults(quotes_cfg)

    for field, key in (
        ("payment_terms", "payment_terms"),
        ("warranty", "warranty"),
        ("general_terms", "general_terms"),
        ("customer_notes", "customer_notes"),
    ):
        if _text(payload.get(field)):
            continue
        value = cfg.get(key)
        if isinstance(value, str) and _text(value):
            payload[field] = _text(value)


def apply_template_terms_to_quote(quote: dict, template: dict, *, overwrite: bool = False) -> dict[str, str]:
    """Return patch dict for quote term fields from quote_templates default_* columns."""
    patch: dict[str, str] = {}
    mapping = (
        ("payment_terms", "default_payment_terms"),
        ("warranty", "default_warranty"),
        ("general_terms", "default_general_terms"),
        ("customer_notes", "default_notes"),
    )
    for quote_key, tmpl_key in mapping:
        tmpl_val = _text(template.get(tmpl_key))
        if not tmpl_val:
            continue
        if overwrite or not _text(quote.get(quote_key)):
            patch[quote_key] = tmpl_val
    return patch