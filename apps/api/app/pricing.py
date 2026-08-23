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


def _discount_type(raw: object) -> str:
    value = str(raw or "amount").lower().strip()
    if value in {"percent", "%"}:
        return "percent"
    if value in {"amount", "fixed"}:
        return "amount"
    return "amount"


def apply_discount(base: Decimal, *, discount_type: object, discount_value: object) -> tuple[Decimal, Decimal]:
    """Return (after_discount, discount_amount). Never negative."""
    if base <= 0:
        return Decimal("0.00"), Decimal("0.00")
    dtype = _discount_type(discount_type)
    dvalue = _money(discount_value)
    if dtype == "percent":
        if dvalue > Decimal("100"):
            dvalue = Decimal("100")
        amount = (base * dvalue / Decimal("100")).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
    else:
        amount = dvalue
    if amount > base:
        amount = base
    after = (base - amount).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
    if after < 0:
        after = Decimal("0.00")
        amount = base
    return after, amount


def line_gross(*, qty: object, unit_price: object, item_type: str) -> Decimal:
    if item_type == "note":
        return Decimal("0.00")
    return (_money(qty) * _money(unit_price)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def line_net(
    *,
    qty: object,
    unit_price: object,
    discount: object,
    item_type: str,
    discount_type: object = "amount",
) -> Decimal:
    if item_type == "note":
        return Decimal("0.00")
    gross = line_gross(qty=qty, unit_price=unit_price, item_type=item_type)
    after, _ = apply_discount(gross, discount_type=discount_type, discount_value=discount)
    return after


def line_profitability(
    *,
    qty: object,
    unit_price: object,
    cost: object,
    discount: object,
    item_type: str,
    discount_type: object = "amount",
) -> dict[str, float]:
    net = line_net(
        qty=qty,
        unit_price=unit_price,
        discount=discount,
        item_type=item_type,
        discount_type=discount_type,
    )
    line_cost = Decimal("0.00")
    if item_type != "note":
        line_cost = (_money(qty) * _money(cost)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
    gp = (net - line_cost).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
    margin = Decimal("0.00")
    if net > 0:
        margin = (gp / net * Decimal("100")).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
    return {
        "line_net": float(net),
        "line_cost": float(line_cost),
        "gross_profit": float(gp),
        "margin_percent": float(margin),
    }


def margin_status(
    margin_percent: object,
    *,
    target: object = 30,
    minimum: object = 15,
) -> str:
    """healthy | warning | critical — thresholds from workspace config."""
    pct = _money(margin_percent)
    tgt = _money(target)
    mn = _money(minimum)
    if mn > tgt:
        mn = tgt
    if pct >= tgt:
        return "healthy"
    if pct >= mn:
        return "warning"
    return "critical"


def recalculate(
    items: list[dict],
    *,
    vat_percent: object,
    discount_type: str | None,
    discount_value: object,
    sections: list[dict] | None = None,
) -> dict[str, float | list | str]:
    """
    Canonical order:
      1) line net (qty * price − line discount)
      2) section discount on section subtotals
      3) quote discount on grand subtotal
      4) VAT on after-quote-discount
      5) cost / margin on after-quote-discount revenue
    """
    section_map = {str(s.get("id")): s for s in (sections or []) if s.get("id")}
    section_subtotals: dict[str | None, Decimal] = {}
    cost_total = Decimal("0.00")
    computed_items: list[dict] = []

    for item in items:
        item_type = item.get("item_type") or "catalog"
        net = line_net(
            qty=item.get("qty"),
            unit_price=item.get("unit_price"),
            discount=item.get("discount"),
            item_type=item_type,
            discount_type=item.get("discount_type") or "amount",
        )
        if item_type != "note":
            cost_total += _money(item.get("qty")) * _money(item.get("cost"))
        section_id = item.get("section_id")
        key: str | None = str(section_id) if section_id else None
        section_subtotals[key] = section_subtotals.get(key, Decimal("0.00")) + net
        profit = line_profitability(
            qty=item.get("qty"),
            unit_price=item.get("unit_price"),
            cost=item.get("cost"),
            discount=item.get("discount"),
            item_type=item_type,
            discount_type=item.get("discount_type") or "amount",
        )
        computed_items.append({**item, **profit})

    lines_subtotal = Decimal("0.00")
    section_discount_total = Decimal("0.00")
    for key, sub in section_subtotals.items():
        if key and key in section_map:
            section = section_map[key]
            after, disc = apply_discount(
                sub,
                discount_type=section.get("discount_type"),
                discount_value=section.get("discount_value"),
            )
            lines_subtotal += after
            section_discount_total += disc
        else:
            lines_subtotal += sub

    lines_subtotal = lines_subtotal.quantize(TWOPLACES, rounding=ROUND_HALF_UP)
    quote_discount_amount = Decimal("0.00")
    after_discount = lines_subtotal
    if discount_type:
        after_discount, quote_discount_amount = apply_discount(
            lines_subtotal,
            discount_type=discount_type,
            discount_value=discount_value,
        )

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
        "lines_subtotal": float(lines_subtotal),
        "section_discount_amount": float(section_discount_total.quantize(TWOPLACES, rounding=ROUND_HALF_UP)),
        "quote_discount_amount": float(quote_discount_amount),
        "subtotal_net": float(after_discount),
        "vat_amount": float(vat),
        "total_gross": float(total_gross),
        "cost_total": float(cost_total),
        "margin_amount": float(margin_amount),
        "margin_percent": float(margin_percent),
        "revenue": float(after_discount),
    }
