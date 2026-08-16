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
    "line_net",
    "sort_order",
)


def _num(value: object) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def catalog_line_snapshot(product: dict) -> dict:
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


def public_payload(
    quote: dict,
    items: list[dict],
    *,
    workspace: dict,
    customer: dict | None,
    site: dict | None,
    status: str | None = None,
    superseded: bool = False,
) -> dict:
    address = (site or {}).get("address") or {}
    site_address = ""
    if isinstance(address, dict):
        site_address = str(address.get("line") or address.get("formatted") or "").strip()
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
        "project_address": quote.get("project_address") or site_address,
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
        "company": {"name": workspace.get("name")},
        "customer": None
        if not customer
        else {
            "display_name": customer.get("display_name"),
            "email": customer.get("email"),
            "phone": customer.get("phone"),
        },
        "site": None
        if not site
        else {"name": site.get("name"), "address": site.get("address") or {}},
        "items": public_items(items),
        "sent_at": quote.get("sent_at"),
        "viewed_at": quote.get("viewed_at"),
        "approved_at": quote.get("approved_at"),
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
) -> dict:
    return {
        "status": status,
        "quote": dict(quote),
        "items": list(items),
        "public": public_payload(
            quote, items, workspace=workspace, customer=customer, site=site, status=status
        ),
    }
