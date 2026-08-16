"""Server-authoritative quote totals. Client-supplied totals are ignored."""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

TWOPLACES = Decimal("0.01")


def _money(value: object) -> Decimal:
    try:
        raw = Decimal(str(0 if value is None else value))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal("0.00")
    if not raw.is_finite() or raw < 0:
        raw = Decimal("0")
    return raw.quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def line_net(*, qty: object, unit_price: object, discount: object, item_type: str) -> Decimal:
    if item_type == "note":
        return Decimal("0.00")
    raw = _money(qty) * _money(unit_price) - _money(discount)
    if raw < 0:
        return Decimal("0.00")
    return raw.quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def recalculate(
    items: list[dict],
    *,
    vat_percent: object,
    discount_type: str | None,
    discount_value: object,
) -> dict[str, float]:
    subtotal = Decimal("0.00")
    cost_total = Decimal("0.00")
    computed_items: list[dict] = []
    for item in items:
        item_type = item.get("item_type") or "catalog"
        net = line_net(
            qty=item.get("qty"),
            unit_price=item.get("unit_price"),
            discount=item.get("discount"),
            item_type=item_type,
        )
        if item_type != "note":
            cost_total += _money(item.get("qty")) * _money(item.get("cost"))
        subtotal += net
        computed_items.append({**item, "line_net": float(net)})

    after_discount = subtotal
    dtype = (discount_type or "").lower()
    dvalue = _money(discount_value)
    if dtype == "percent":
        if dvalue > Decimal("100"):
            dvalue = Decimal("100")
        after_discount = subtotal * (Decimal("1") - (dvalue / Decimal("100")))
    elif dtype in {"amount", "fixed"}:
        after_discount = subtotal - dvalue
    if after_discount < 0:
        after_discount = Decimal("0.00")
    after_discount = after_discount.quantize(TWOPLACES, rounding=ROUND_HALF_UP)

    vat = (after_discount * _money(vat_percent) / Decimal("100")).quantize(
        TWOPLACES, rounding=ROUND_HALF_UP
    )
    total_gross = (after_discount + vat).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
    cost_total = cost_total.quantize(TWOPLACES, rounding=ROUND_HALF_UP)
    margin_amount = (after_discount - cost_total).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
    margin_percent = Decimal("0.00")
    if after_discount > 0:
        margin_percent = (margin_amount / after_discount * Decimal("100")).quantize(
            TWOPLACES, rounding=ROUND_HALF_UP
        )

    return {
        "items": computed_items,
        "subtotal_net": float(after_discount),
        "vat_amount": float(vat),
        "total_gross": float(total_gross),
        "cost_total": float(cost_total),
        "margin_amount": float(margin_amount),
        "margin_percent": float(margin_percent),
    }
