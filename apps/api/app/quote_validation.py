"""Server-side send gates. Client UX may preview these; it cannot bypass them."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal


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


def validate_for_send(
    quote: dict,
    items: list[dict],
    workspace: dict,
) -> list[dict[str, str]]:
    gaps: list[dict[str, str]] = []

    if not _text(workspace.get("name")):
        gaps.append(
            {"field": "company", "code": "company", "message": "חסרים פרטי העסק. עדכנו את שם הסביבה בהגדרות."}
        )
    if not _text(quote.get("customer_id")):
        gaps.append({"field": "customer_id", "code": "customer", "message": "בחרו לקוח."})
    if not _text(quote.get("title")):
        gaps.append({"field": "title", "code": "title", "message": "הוסיפו כותרת להצעה."})
    valid_until = _as_date(quote.get("valid_until"))
    if valid_until is None:
        gaps.append({"field": "valid_until", "code": "valid_until", "message": "בחרו תוקף להצעה."})
    elif valid_until < datetime.now().date():
        gaps.append({"field": "valid_until", "code": "valid_until", "message": "תוקף ההצעה כבר עבר."})
    if not _text(quote.get("payment_terms")):
        gaps.append({"field": "payment_terms", "code": "payment_terms", "message": "הוסיפו תנאי תשלום."})

    billable = 0
    prices_ok = True
    for item in items:
        item_type = item.get("item_type") or "catalog"
        if item_type == "note":
            continue
        qty = _money(item.get("qty"))
        unit_price = _money(item.get("unit_price"))
        discount = _money(item.get("discount"))
        if qty <= 0:
            prices_ok = False
            continue
        if unit_price < 0 or discount < 0 or discount > (qty * unit_price):
            prices_ok = False
            continue
        billable += 1

    if billable == 0:
        gaps.append(
            {"field": "items", "code": "items", "message": "הוסיפו לפחות פריט חיוב אחד."}
        )
    elif not prices_ok:
        gaps.append({"field": "items", "code": "prices", "message": "יש שורות עם כמות או מחיר לא תקינים."})

    return gaps
