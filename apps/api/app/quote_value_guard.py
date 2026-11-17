"""Block send/approve when a quote has no billable lines or a zero total."""

from __future__ import annotations

from .errors import ApiError, MESSAGES


def _money(value: object) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def billable_item_count(items: list[dict] | None) -> int:
    count = 0
    for item in items or []:
        if (item.get("item_type") or "catalog") == "note":
            continue
        if _money(item.get("qty")) <= 0:
            continue
        count += 1
    return count


def quote_has_billable_value(quote: dict, items: list[dict] | None) -> bool:
    if billable_item_count(items) < 1:
        return False
    total = _money(quote.get("total_gross"))
    if total <= 0:
        # Fallback: sum line nets / unit*qty when header total is missing or stale.
        line_sum = 0.0
        for item in items or []:
            if (item.get("item_type") or "catalog") == "note":
                continue
            qty = _money(item.get("qty"))
            if qty <= 0:
                continue
            line_net = item.get("line_net")
            if line_net is not None:
                line_sum += _money(line_net)
            else:
                line_sum += qty * _money(item.get("unit_price"))
        if line_sum <= 0:
            return False
    return True


def assert_quote_has_billable_value(quote: dict, items: list[dict] | None) -> None:
    if quote_has_billable_value(quote, items):
        return
    raise ApiError(
        409,
        "QUOTE_EMPTY_OR_ZERO",
        MESSAGES["QUOTE_EMPTY_OR_ZERO"],
        {
            "billable_items": billable_item_count(items),
            "total_gross": _money(quote.get("total_gross")),
        },
    )
