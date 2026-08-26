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
            }
        )
    return rows


def _address_line(address: object) -> str:
    if not isinstance(address, dict):
        return _text(address)
    return _text(address.get("line") or address.get("formatted") or address.get("street") or "")


def company_block(workspace: dict, branding: dict | None = None) -> dict:
    brand = branding if isinstance(branding, dict) else {}
    name = _text(workspace.get("name")) or None
    brand_name = _text(brand.get("name") or brand.get("brand_name")) or name
    company: dict = {
        "name": name,
        "brand_name": brand_name,
        "logo_url": brand.get("logo_url") or None,
    }
    # Only surface contact fields when already stored — never invent.
    for key in ("phone", "email", "address", "website"):
        raw = brand.get(key)
        if raw in (None, "", {}):
            continue
        company[key] = raw
    return company


def customer_block(customer: dict | None) -> dict | None:
    if not customer:
        return None
    out: dict = {
        "display_name": customer.get("display_name"),
        "email": customer.get("email"),
        "phone": customer.get("phone"),
    }
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
    branding: dict | None = None,
) -> dict:
    address = (site or {}).get("address") or {}
    site_address = _address_line(address)
    return {
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
        "company": company_block(workspace, branding),
        "customer": customer_block(customer),
        "site": None
        if not site
        else {"name": site.get("name"), "address": site.get("address") or {}},
        "sections": public_sections(sections),
        "items": public_items(items),
        "signature": dict(SIGNATURE_BLOCK),
        "pdf_ready": True,
        "viewed_at": quote.get("viewed_at"),
        "approved_at": quote.get("approved_at"),
        "approved_name": quote.get("approved_name"),
        "rejected_at": quote.get("rejected_at"),
    }


def version_snapshot(
    quote: dict,
    items: list[dict],
    *,
    workspace: dict,
    customer: dict | None,
    site: dict | None,
    status: str,
    sections: list[dict] | None = None,
    branding: dict | None = None,
) -> dict:
    return {
        "status": status,
        "quote": dict(quote),
        "items": list(items),
        "sections": public_sections(sections),
        "public": public_payload(
            quote,
            items,
            workspace=workspace,
            customer=customer,
            site=site,
            status=status,
            sections=sections,
            branding=branding,
        ),
    }
