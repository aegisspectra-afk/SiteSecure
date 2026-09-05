"""Sample quote document for PDF template preview — same shape as public_payload + pdf_template."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any


def build_sample_quote_document(
    *,
    template: dict[str, Any] | None = None,
    branding: dict[str, Any] | None = None,
    workspace_name: str = "אגיס מערכות",
) -> dict[str, Any]:
    """Hebrew sample payload consumed by render_quote_pdf (identical path to quote PDF)."""
    from .documents.company_profile import company_block_from_profile, normalize_company_profile

    brand = branding if isinstance(branding, dict) else {}
    tpl_row = template if isinstance(template, dict) else {}
    config = tpl_row.get("config") if isinstance(tpl_row.get("config"), dict) else {}
    if not config and tpl_row and "primaryColor" in tpl_row:
        config = {k: v for k, v in tpl_row.items() if k not in {"id", "name", "doc_type", "status", "is_default"}}

    profile = normalize_company_profile({"name": workspace_name}, brand)
    company = company_block_from_profile(profile)
    # Demo contact fill only when branding is empty — preview UX needs something visible
    if not company.get("phone"):
        company["phone"] = "03-555-0100"
    if not company.get("email"):
        company["email"] = "office@aegis.demo"
    if not company.get("address") and not company.get("address_line"):
        company["address"] = "רח׳ התעשייה 12, ראשון לציון"
        company["address_line"] = company["address"]

    now = datetime.now(UTC)
    valid_until = (now + timedelta(days=14)).date().isoformat()

    subtotal = 22500.0
    vat = round(subtotal * 0.18, 2)
    total = round(subtotal + vat, 2)

    return {
        "id": "sample-quote",
        "number": "Q-00124",
        "version": 1,
        "status": "draft",
        "currency": "ILS",
        "title": "מערכת מצלמות ואבטחה — קניון הזהב",
        "intro": "הצעת מחיר לדוגמה לפי תבנית המסמך שנבחרה בהגדרות.",
        "issued_at": now.isoformat(),
        "created_at": now.isoformat(),
        "valid_until": valid_until,
        "vat_percent": 18,
        "subtotal_net": subtotal,
        "vat_amount": vat,
        "total_gross": total,
        "payment_terms": config.get("paymentTerms") or "שוטף + 30 · מקדמה 40% עם אישור ההצעה",
        "customer_notes": config.get("notes") or "ההצעה כוללת אספקה, התקנה והדרכה בסיסית.",
        "warranty": "12 חודשי אחריות על ציוד והתקנה.",
        "general_terms": "ההצעה כפופה לאישור סופי ולזמינות מלאי.",
        "company": company,
        "customer": {
            "display_name": "חברת נוף טכנולוגיות בע״מ",
            "address_line": "דרך השלום 45, תל אביב",
        },
        "site": {
            "name": "קניון הזהב · קומת חניה B2",
            "address": {"line": "דרך משה דיין 100, ראשון לציון"},
        },
        "items": [
            {
                "id": "1",
                "item_type": "product",
                "name": "מצלמת IP 4MP",
                "description": "מצלמת רשת חיצונית 4MP",
                "sku": "CAM-4MP-01",
                "qty": 12,
                "unit_price": 1200,
                "line_net": 14400,
                "sort_order": 10,
            },
            {
                "id": "2",
                "item_type": "product",
                "name": "NVR 16CH",
                "description": "מקליט רשת 16 ערוצים",
                "sku": "NVR-16",
                "qty": 1,
                "unit_price": 3900,
                "line_net": 3900,
                "sort_order": 20,
            },
            {
                "id": "3",
                "item_type": "service",
                "name": "התקנה והפעלה",
                "description": "עבודת התקנה, כיוון והדרכה",
                "sku": "LABOR",
                "qty": 1,
                "unit_price": 4200,
                "line_net": 4200,
                "sort_order": 30,
            },
        ],
        "sections": [],
        "signature": {
            "mode": "signature_pad_v1",
            "required": True,
            "title": "אישור והתחייבות",
            "consent_he": "בחתימתי אני מאשר/ת את פרטי ההצעה והתנאים.",
        },
        "pdf_template": {
            "id": tpl_row.get("id"),
            "name": tpl_row.get("name") or "תבנית לדוגמה",
            **config,
        },
        "pdf_ready": True,
        "template_version": "quote-v2",
        "document_type": "quote",
    }
