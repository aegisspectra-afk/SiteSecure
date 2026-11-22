"""Public pricing payload — mirrors packages/authz catalog (C1)."""

from __future__ import annotations

from typing import Any

from .authz.catalog import load_catalog

ORDERED_KEYS = ("free", "pro", "business", "enterprise")

CAPABILITY_ROWS: list[dict[str, str]] = [
    {"key": "quota_display", "label_he": "הצעות בחודש"},
    {"key": "storage_gb", "label_he": "אחסון"},
    {"key": "max_members", "label_he": "משתמשי משרד"},
    {"key": "quotes.alternatives", "label_he": "חלופות לוועד בית"},
    {"key": "branding.custom_handover", "label_he": "תעודת מסירה במותג שלך"},
    {"key": "comms.whatsapp", "label_he": "שיתוף בוואטסאפ"},
    {"key": "quotes.sales_tracking", "label_he": "מעקב מכירה"},
    {"key": "field.technicians", "label_he": "טכנאים בשטח"},
    {"key": "jobs.checklist", "label_he": "צ׳קליסט וחתימה"},
    {"key": "sites.dossier", "label_he": "תיק אתר"},
    {"key": "service.reminders", "label_he": "תזכורות שירות"},
    {"key": "quotes.profitability", "label_he": "רווחיות להצעות"},
]


def _annual_monthly(monthly: int, bonus_months: int) -> int:
    if monthly <= 0:
        return 0
    return round((monthly * 12) / (12 + bonus_months))


def build_public_pricing_payload(catalog: dict[str, Any] | None = None) -> dict[str, Any]:
    data = catalog or load_catalog()
    billing = data.get("billing_public") or {}
    bonus = int(billing.get("annual_bonus_months") or 2)
    plans_by_key = {p["key"]: p for p in data.get("plans") or []}
    out_plans = []
    for key in ORDERED_KEYS:
        plan = plans_by_key.get(key)
        if not plan:
            continue
        commercial = plan.get("commercial") or {}
        monthly = commercial.get("monthly_ils_before_vat")
        custom = bool(commercial.get("custom_pricing"))
        annual = None
        if not custom and monthly is not None:
            annual = _annual_monthly(int(monthly), bonus)
        out_plans.append(
            {
                "key": plan["key"],
                "label_he": plan.get("label_he") or plan["key"],
                "limits": plan.get("limits") or {},
                "capabilities": plan.get("capabilities") or {},
                "commercial": commercial,
                "annual_monthly_ils_before_vat": annual,
            }
        )
    return {
        "billing": {
            "currency": billing.get("currency") or "ILS",
            "annual_bonus_months": bonus,
            "vat_note_he": billing.get("vat_note_he") or 'המחירים לא כוללים מע״מ.',
        },
        "plans": out_plans,
        "comparison_rows": CAPABILITY_ROWS,
    }