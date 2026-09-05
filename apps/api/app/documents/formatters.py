"""Canonical money / date formatters for customer documents."""

from __future__ import annotations

_LRI = "\u2066"
_PDI = "\u2069"


def format_money(amount: object, currency: str = "ILS", *, locale: str = "he-IL") -> str:
    """Canonical document money presentation: ``1,250.00 ₪`` with LTR isolation."""
    del locale  # reserved for future multi-locale; ILS/he-IL is product default
    try:
        value = float(amount or 0)
    except (TypeError, ValueError):
        value = 0.0
    raw = f"{value:,.2f}"
    if currency == "ILS":
        return f"{_LRI}{raw}{_PDI} ₪"
    return f"{_LRI}{raw} {currency}{_PDI}"


def format_date_he(value: object) -> str:
    """Customer-facing date: ``05.09.2026`` (LTR-isolated)."""
    raw = str(value or "").strip()
    if len(raw) >= 10 and raw[4] == "-" and raw[7] == "-":
        y, m, d = raw[:10].split("-")
        return f"{_LRI}{d}.{m}.{y}{_PDI}"
    if raw:
        return f"{_LRI}{raw[:10]}{_PDI}"
    return ""
