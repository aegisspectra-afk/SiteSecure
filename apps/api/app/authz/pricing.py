"""Commercial seat-tier math — mirrors packages/authz public-pricing (catalog.json)."""

from __future__ import annotations

from typing import Any

from .catalog import load_catalog

_DEFAULT_TIERS: list[dict[str, Any]] = [
    {"min_extra": 1, "max_extra": 2, "ils_before_vat": 49},
    {"min_extra": 3, "max_extra": 4, "ils_before_vat": 39},
    {"min_extra": 5, "max_extra": 9, "ils_before_vat": 29},
    {"min_extra": 10, "max_extra": None, "ils_before_vat": 24},
]


def billing_public() -> dict[str, Any]:
    raw = load_catalog().get("billing_public") or {}
    tiers = raw.get("extra_seat_tiers")
    if not isinstance(tiers, list) or not tiers:
        tiers = list(_DEFAULT_TIERS)
    return {
        "currency": raw.get("currency") or "ILS",
        "vat_note_he": raw.get("vat_note_he") or 'המחירים לא כוללים מע״מ.',
        "pro_launch_active": bool(raw.get("pro_launch_active", True)),
        "extra_seat_tiers": tiers,
    }


def _plan_by_key(plan_key: str) -> dict[str, Any] | None:
    key = (plan_key or "").strip()
    if key == "solo":
        key = "free"
    for plan in load_catalog().get("plans") or []:
        if plan.get("key") == key:
            return plan
    return None


def plan_allows_extra_seats(plan_key: str) -> bool:
    key = (plan_key or "").strip()
    if key in {"free", "solo", "enterprise"}:
        return False
    plan = _plan_by_key(key)
    if not plan:
        return key in {"pro", "business"}
    commercial = plan.get("commercial") or {}
    if "allows_extra_seats" in commercial:
        return bool(commercial.get("allows_extra_seats"))
    return key in {"pro", "business"}


def extra_seat_unit_price(extra_count: int, tiers: list[dict[str, Any]] | None = None) -> int:
    n = max(0, int(extra_count or 0))
    if n <= 0:
        return 0
    rows = tiers if tiers is not None else billing_public()["extra_seat_tiers"]
    for tier in rows:
        mn = int(tier.get("min_extra") or 0)
        mx = tier.get("max_extra")
        if n >= mn and (mx is None or n <= int(mx)):
            return int(tier.get("ils_before_vat") or 0)
    if rows:
        return int(rows[-1].get("ils_before_vat") or 0)
    return 0


def extra_seats_total_ils(extra_count: int, tiers: list[dict[str, Any]] | None = None) -> int:
    n = max(0, int(extra_count or 0))
    if n <= 0:
        return 0
    return n * extra_seat_unit_price(n, tiers)


def plan_display_base_ils(plan_key: str, *, prefer_launch: bool = True) -> int | None:
    plan = _plan_by_key(plan_key)
    if not plan:
        return None
    commercial = plan.get("commercial") or {}
    if commercial.get("custom_pricing"):
        return None
    monthly = commercial.get("monthly_ils_before_vat")
    if monthly is None:
        return None
    if prefer_launch and billing_public().get("pro_launch_active"):
        launch = commercial.get("launch_monthly_ils_before_vat")
        if launch is not None:
            return int(launch)
    return int(monthly)


def monthly_total_ils(
    *,
    plan_key: str,
    extra_seats: int = 0,
    locked_price_ils_before_vat: int | float | None = None,
    prefer_launch: bool = True,
) -> int | None:
    plan = _plan_by_key(plan_key)
    if not plan:
        return None
    commercial = plan.get("commercial") or {}
    if commercial.get("custom_pricing"):
        return None
    extras = max(0, int(extra_seats or 0))
    if extras > 0 and not plan_allows_extra_seats(plan_key):
        return None
    if locked_price_ils_before_vat is not None:
        base = int(locked_price_ils_before_vat)
    else:
        base_val = plan_display_base_ils(plan_key, prefer_launch=prefer_launch)
        if base_val is None:
            return None
        base = base_val
    return base + extra_seats_total_ils(extras)


def effective_member_cap(max_members: int, extra_seats: int = 0) -> int:
    max_m = int(max_members or 0)
    if max_m <= 0:
        return 0
    return max_m + max(0, int(extra_seats or 0))
