"""Modular quote validation rules. Critical blocks send; warning/info do not."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Callable, Protocol


def _text(value: object) -> str:
    return str(value or "").strip()


def _money(value: object) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal("0")


def _as_date(value: object) -> date | None:
    raw = _text(value)
    if not raw:
        return None
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        return None


def gap(field: str, code: str, message: str, *, severity: str = "critical", action: str = "fix") -> dict:
    return {
        "field": field,
        "code": code,
        "message": message,
        "severity": severity,
        "action": action,  # fix | review | ignore
    }


class QuoteRule(Protocol):
    def __call__(self, quote: dict, items: list[dict], workspace: dict, settings: dict) -> list[dict]:
        ...


def required_field_rule(quote: dict, items: list[dict], workspace: dict, settings: dict) -> list[dict]:
    gaps: list[dict] = []
    if not _text(workspace.get("name")):
        gaps.append(gap("company", "company", "חסרים פרטי העסק. עדכנו את שם הסביבה בהגדרות."))
    if not _text(quote.get("customer_id")):
        gaps.append(gap("customer_id", "customer", "בחרו לקוח."))
    if not _text(quote.get("title")):
        gaps.append(gap("title", "title", "הוסיפו כותרת להצעה."))
    valid_until = _as_date(quote.get("valid_until"))
    if valid_until is None:
        gaps.append(gap("valid_until", "valid_until", "בחרו תוקף להצעה."))
    elif valid_until < datetime.now().date():
        gaps.append(gap("valid_until", "valid_until", "תוקף ההצעה כבר עבר."))
    if not _text(quote.get("payment_terms")):
        gaps.append(gap("payment_terms", "payment_terms", "הוסיפו תנאי תשלום."))
    return gaps


def line_price_rule(quote: dict, items: list[dict], workspace: dict, settings: dict) -> list[dict]:
    billable = 0
    prices_ok = True
    for item in items:
        item_type = item.get("item_type") or "catalog"
        if item_type == "note":
            continue
        qty = _money(item.get("qty"))
        unit_price = _money(item.get("unit_price"))
        discount = _money(item.get("discount"))
        dtype = str(item.get("discount_type") or "amount").lower()
        if qty <= 0:
            prices_ok = False
            continue
        if unit_price < 0 or discount < 0:
            prices_ok = False
            continue
        if dtype == "percent" and discount > 100:
            prices_ok = False
            continue
        if dtype != "percent" and discount > (qty * unit_price):
            prices_ok = False
            continue
        billable += 1
    if billable == 0:
        return [gap("items", "items", "הוסיפו לפחות פריט חיוב אחד.")]
    if not prices_ok:
        return [gap("items", "prices", "יש שורות עם כמות או מחיר לא תקינים.")]
    return []


def _item_blob(items: list[dict]) -> str:
    return " ".join(
        f"{item.get('description') or ''} {item.get('name') or ''} {item.get('sku') or ''}".lower()
        for item in items
    )


def _camera_qty(items: list[dict]) -> int:
    total = 0
    for item in items:
        text = f"{item.get('description') or ''} {item.get('name') or ''}".lower()
        if any(token in text for token in ("מצלמ", "camera", "ipc")):
            try:
                total += int(float(item.get("qty") or 0))
            except (TypeError, ValueError):
                total += 1
    return total


def camera_recorder_capacity_rule(quote: dict, items: list[dict], workspace: dict, settings: dict) -> list[dict]:
    blob = _item_blob(items)
    has_nvr = any(token in blob for token in ("nvr", "מקליט", "dvr"))
    cameras = _camera_qty(items)
    gaps: list[dict] = []
    if cameras >= 5 and not has_nvr:
        gaps.append(
            gap(
                "items",
                "advisory_nvr_capacity",
                f"זוהו כ־{cameras} מצלמות ללא מקליט מזוהה — בדקו התאמת ערוצים.",
                severity="warning",
                action="review",
            )
        )
    if cameras > 0 and has_nvr:
        gaps.append(
            gap(
                "items",
                "advisory_review_channels",
                "ודאו שמספר ערוצי ה־NVR מספיק למספר המצלמות בהצעה.",
                severity="info",
                action="review",
            )
        )
    # Soft critical-style advisory when cameras clearly exceed common 8-channel wording
    if cameras > 8 and any(token in blob for token in ("8ch", "8-ch", "8 ערוץ", "8ch")):
        gaps.append(
            gap(
                "items",
                "nvr_channel_mismatch",
                f"מספר מצלמות ({cameras}) עולה על מקליט 8 ערוצים שזוהה — תקנו לפני שליחה.",
                severity="critical",
                action="fix",
            )
        )
    return gaps


def recording_storage_rule(quote: dict, items: list[dict], workspace: dict, settings: dict) -> list[dict]:
    blob = _item_blob(items)
    has_hdd = any(token in blob for token in ("hdd", "כונן", "אחסון", "storage", "tb"))
    summary = _text(quote.get("summary")).lower()
    cameras = _camera_qty(items)
    needs_recording = "הקלטה" in summary or cameras > 0
    if needs_recording and cameras > 0 and not has_hdd and ("הקלטה" in summary or cameras >= 4):
        return [
            gap(
                "items",
                "advisory_storage",
                "נדרשת הקלטה אך לא זוהה אחסון/HDD בקטלוג ההצעה.",
                severity="warning",
                action="review",
            )
        ]
    return []


def remote_access_rule(quote: dict, items: list[dict], workspace: dict, settings: dict) -> list[dict]:
    summary = _text(quote.get("summary")).lower()
    notes = _text(quote.get("customer_notes")).lower()
    blob = _item_blob(items)
    wants_remote = any(token in summary or token in notes for token in ("מרחוק", "remote", "מובייל", "אפליקצ"))
    has_remote = any(token in blob for token in ("remote", "p2p", "ענן", "cloud", "מובייל", "app"))
    if wants_remote and not has_remote:
        return [
            gap(
                "items",
                "advisory_remote",
                "צוינה צפייה מרחוק — ודאו שורת רישוי/ענן/גישה מרחוק בקטלוג.",
                severity="info",
                action="review",
            )
        ]
    return []


def missing_infrastructure_rule(quote: dict, items: list[dict], workspace: dict, settings: dict) -> list[dict]:
    blob = _item_blob(items)
    cameras = _camera_qty(items)
    has_infra = any(token in blob for token in ("כבל", "cable", "poe", "מחבר", "תשתית", "utp", "cat6"))
    summary = _text(quote.get("summary")).lower()
    new_infra = "תשתית חדשה" in summary or "אין תשתית" in summary or "new infra" in summary
    if cameras >= 4 and (new_infra or not has_infra):
        if not has_infra:
            return [
                gap(
                    "items",
                    "advisory_infrastructure",
                    "מערכת מצלמות ללא שורות תשתית מזוהות — בדקו כבלים/PoE/מחברים.",
                    severity="warning",
                    action="review",
                )
            ]
    return []


def margin_rule(quote: dict, items: list[dict], workspace: dict, settings: dict) -> list[dict]:
    from ..pricing import margin_status

    quotes_cfg = settings.get("quotes") if isinstance(settings.get("quotes"), dict) else {}
    target = quotes_cfg.get("margin_target", 30)
    minimum = quotes_cfg.get("margin_minimum", 15)
    pct = quote.get("margin_percent")
    if pct is None:
        return []
    status = margin_status(pct, target=target, minimum=minimum)
    if status == "healthy":
        return []
    if quote.get("margin_override_reason") and quote.get("margin_override_at"):
        return [
            gap(
                "margin",
                "margin_overridden",
                f"מרווח {pct}% אושר עם דריסת אזהרה.",
                severity="info",
                action="ignore",
            )
        ]
    if status == "warning":
        return [
            gap(
                "margin",
                "margin_below_target",
                f"מרווח {pct}% מתחת ליעד ({target}%).",
                severity="warning",
                action="review",
            )
        ]
    return [
        gap(
            "margin",
            "margin_below_minimum",
            f"מרווח {pct}% מתחת למינימום ({minimum}%). דרשו אישור מנהל או תקנו מחירים.",
            severity="warning",
            action="review",
        )
    ]


CRITICAL_RULES: list[Callable[..., list[dict]]] = [
    required_field_rule,
    line_price_rule,
    camera_recorder_capacity_rule,  # may emit critical channel mismatch
]

ADVISORY_RULES: list[Callable[..., list[dict]]] = [
    recording_storage_rule,
    remote_access_rule,
    missing_infrastructure_rule,
    margin_rule,
]


def run_rules(
    rules: list[Callable[..., list[dict]]],
    quote: dict,
    items: list[dict],
    workspace: dict,
    settings: dict | None = None,
) -> list[dict]:
    cfg = settings or {}
    gaps: list[dict] = []
    for rule in rules:
        gaps.extend(rule(quote, items, workspace, cfg))
    return gaps
