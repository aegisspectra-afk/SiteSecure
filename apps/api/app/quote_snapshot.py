from __future__ import annotations

from datetime import UTC, datetime

PUBLIC_ITEM_KEYS = (
    "id",
    "item_type",
    "description",
    "name",
    "sku",
    "unit",
    "qty",
    "unit_price",
    "discount",
    "discount_type",
    "line_net",
    "sort_order",
    "section_id",
    "package_instance_id",
    "package_name",
    "is_optional",
    "alternative_id",
)

# Customer-facing alternative totals — never include cost / margin.
PUBLIC_ALTERNATIVE_KEYS = (
    "id",
    "label",
    "sort_order",
    "is_recommended",
    "customer_summary",
    "subtotal_net",
    "vat_amount",
    "total_gross",
)

OPTIONAL_PUBLIC_TOTAL_KEYS = (
    "items_subtotal",
    "lines_subtotal",
    "section_discount_amount",
    "quote_discount_amount",
    "optional_subtotal",
    "optional_vat_amount",
    "optional_total_gross",
    "total_with_options_gross",
)

# Approval UX today; future: SignaturePad → signed_at + immutable version bound to N.
SIGNATURE_BLOCK = {
    "mode": "signature_pad_v1",
    "required": True,
    "title": "אישור והתחייבות",
    "consent_he": "בחתימתי / באישורי אני מאשר/ת את פרטי ההצעה, התנאים והסכום כפי שמופיעים במסמך זה.",
    "consent_text": "בחתימתי / באישורי אני מאשר/ת את פרטי ההצעה, התנאים והסכום כפי שמופיעים במסמך זה.",
    "fields": ["full_name", "signature", "date"],
}


def _num(value: object) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _text(value: object) -> str:
    return str(value or "").strip()


def catalog_line_snapshot(product: dict) -> dict:
    attrs = product.get("attributes")
    return {
        "product_id": product.get("id"),
        "sku": product.get("sku"),
        "name": product.get("name"),
        "description": product.get("description") or "",
        "unit": product.get("unit") or "unit",
        "kind": product.get("kind") or "product",
        "list_price": _num(product.get("list_price")),
        "cost": _num(product.get("cost")),
        "vat_eligible": bool(product.get("vat_eligible", True)),
        "manufacturer": product.get("manufacturer"),
        "model": product.get("model"),
        "attributes": attrs if isinstance(attrs, dict) else {},
        "snapshotted_at": datetime.now(UTC).isoformat(),
    }


def public_items(items: list[dict]) -> list[dict]:
    rows = []
    for item in items:
        row = {key: item.get(key) for key in PUBLIC_ITEM_KEYS}
        row["qty"] = _num(item.get("qty"))
        row["unit_price"] = _num(item.get("unit_price"))
        row["discount"] = _num(item.get("discount"))
        row["line_net"] = _num(item.get("line_net"))
        row["is_optional"] = bool(item.get("is_optional"))
        rows.append(row)
    return rows


def public_sections(sections: list[dict] | None) -> list[dict]:
    rows: list[dict] = []
    for section in sections or []:
        sid = section.get("id")
        if not sid:
            continue
        rows.append(
            {
                "id": sid,
                "name": section.get("name"),
                "sort_order": section.get("sort_order"),
                "alternative_id": section.get("alternative_id"),
            }
        )
    return rows


def public_alternatives(alternatives: list[dict] | None) -> list[dict]:
    """Freeze ועד-בית tiers for the customer document — money only, no office cost."""
    rows: list[dict] = []
    for alt in alternatives or []:
        if not isinstance(alt, dict) or not alt.get("id"):
            continue
        row = {key: alt.get(key) for key in PUBLIC_ALTERNATIVE_KEYS}
        row["id"] = str(alt["id"])
        row["sort_order"] = int(alt.get("sort_order") or 0)
        row["is_recommended"] = bool(alt.get("is_recommended"))
        for money_key in ("subtotal_net", "vat_amount", "total_gross"):
            row[money_key] = _num(alt.get(money_key))
        rows.append(row)
    rows.sort(key=lambda r: (int(r.get("sort_order") or 0), str(r.get("id"))))
    return rows


def _address_line(address: object) -> str:
    if not isinstance(address, dict):
        return _text(address)
    return _text(address.get("line") or address.get("formatted") or address.get("street") or "")


def company_block(workspace: dict, branding: dict | None = None) -> dict:
    """Build public company identity from canonical Company Profile (never invents IDs)."""
    from .documents.company_profile import company_block_from_profile, normalize_company_profile

    profile = normalize_company_profile(workspace, branding)
    return company_block_from_profile(profile)


def customer_block(customer: dict | None) -> dict | None:
    if not customer:
        return None
    out: dict = {
        "display_name": customer.get("display_name"),
        "email": customer.get("email"),
        "phone": customer.get("phone"),
    }
    for key in ("tax_id", "business_number", "contact_name", "legal_name"):
        val = customer.get(key)
        if val not in (None, ""):
            out[key] = val
    billing = customer.get("billing_address")
    if isinstance(billing, dict) and billing:
        out["address"] = billing
        line = _address_line(billing)
        if line:
            out["address_line"] = line
    return out


def public_payload(
    quote: dict,
    items: list[dict],
    *,
    workspace: dict,
    customer: dict | None,
    site: dict | None,
    status: str | None = None,
    superseded: bool = False,
    sections: list[dict] | None = None,
    alternatives: list[dict] | None = None,
    branding: dict | None = None,
    company_snapshot: dict | None = None,
    pdf_template: dict | None = None,
    template_version: str = "quote-v2",
    freeze_company: bool = False,
) -> dict:
    from .documents.company_profile import company_snapshot_from_profile, normalize_company_profile
    from .documents.types import TEMPLATE_VERSIONS, DocumentType

    address = (site or {}).get("address") or {}
    site_address = _address_line(address)
    if company_snapshot and isinstance(company_snapshot, dict) and company_snapshot:
        company = company_block({}, company_snapshot)
        snap = dict(company_snapshot)
    else:
        profile = normalize_company_profile(workspace, branding)
        company = company_block(workspace, branding)
        snap = company_snapshot_from_profile(profile) if freeze_company else None

    tpl_ver = template_version or TEMPLATE_VERSIONS[DocumentType.QUOTE]
    payload = {
        "id": quote.get("id"),
        "number": quote.get("number"),
        "version": quote.get("version") or 1,
        "status": status or quote.get("status"),
        "superseded": superseded,
        "title": quote.get("title"),
        "summary": quote.get("summary"),
        "key_points": quote.get("key_points"),
        "project_name": quote.get("project_name") or (site or {}).get("name"),
        "project_address": quote.get("project_address") or site_address or None,
        "valid_until": quote.get("valid_until"),
        "payment_terms": quote.get("payment_terms"),
        "warranty": quote.get("warranty"),
        "general_terms": quote.get("general_terms"),
        "customer_notes": quote.get("customer_notes"),
        "currency": quote.get("currency") or "ILS",
        "vat_percent": _num(quote.get("vat_percent")),
        "discount_type": quote.get("discount_type"),
        "discount_value": _num(quote.get("discount_value")),
        "subtotal_net": _num(quote.get("subtotal_net")),
        "vat_amount": _num(quote.get("vat_amount")),
        "total_gross": _num(quote.get("total_gross")),
        "issued_at": quote.get("sent_at") or quote.get("created_at"),
        "sent_at": quote.get("sent_at"),
        "company": company,
        "customer": customer_block(customer),
        "site": None
        if not site
        else {"name": site.get("name"), "address": site.get("address") or {}},
        "sections": public_sections(sections),
        "items": public_items(items),
        "presentation_mode": quote.get("presentation_mode") or "single",
        "alternatives": public_alternatives(alternatives),
        "signature": dict(SIGNATURE_BLOCK),
        "pdf_ready": True,
        "viewed_at": quote.get("viewed_at"),
        "approved_at": quote.get("approved_at"),
        "approved_name": quote.get("approved_name"),
        "rejected_at": quote.get("rejected_at"),
        "template_version": tpl_ver,
        "document_type": DocumentType.QUOTE.value,
    }
    for key in OPTIONAL_PUBLIC_TOTAL_KEYS:
        if key in quote and quote[key] is not None:
            payload[key] = _num(quote[key])
    if isinstance(quote.get("sections_breakdown"), list):
        payload["sections_breakdown"] = [
            {
                "section_id": str(row.get("section_id")),
                "lines_net": _num(row.get("lines_net")),
                "discount_amount": _num(row.get("discount_amount")),
                "net": _num(row.get("net")),
            }
            for row in quote["sections_breakdown"]
            if isinstance(row, dict)
        ]
    if snap:
        payload["company_snapshot"] = snap
    if pdf_template and isinstance(pdf_template, dict):
        payload["pdf_template"] = pdf_template
    return payload


def version_snapshot(
    quote: dict,
    items: list[dict],
    *,
    workspace: dict,
    customer: dict | None,
    site: dict | None,
    status: str,
    sections: list[dict] | None = None,
    alternatives: list[dict] | None = None,
    branding: dict | None = None,
    pdf_template: dict | None = None,
) -> dict:
    """Freeze customer document at send/share time — company + template included."""
    freeze = status not in {"draft"}
    public_alts = public_alternatives(alternatives)
    return {
        "status": status,
        "quote": dict(quote),
        "items": list(items),
        "sections": public_sections(sections),
        "alternatives": public_alts,
        "public": public_payload(
            quote,
            items,
            workspace=workspace,
            customer=customer,
            site=site,
            status=status,
            sections=sections,
            alternatives=alternatives,
            branding=branding,
            pdf_template=pdf_template,
            freeze_company=freeze,
        ),
    }
