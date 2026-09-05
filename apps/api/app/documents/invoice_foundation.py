"""Invoice / statutory document visual foundation (preview-only until issuance)."""

from __future__ import annotations

from typing import Any

from .accounting import AllocationFields, refuse_statutory_pdf_without_issuance
from .types import DocumentType


INVOICE_REQUIRED_VISUAL_FIELDS = (
    "issuer_legal_name",
    "issuer_address",
    "business_number",
    "tax_status",
    "document_title",
    "document_number",
    "issue_date",
    "customer",
    "lines",
    "subtotal_net",
    "vat_rate",
    "vat_amount",
    "total",
)


def build_invoice_preview_context(
    *,
    company: dict[str, Any],
    customer: dict | None,
    lines: list[dict],
    totals: dict[str, Any],
    document_number: str = "INV-PREVIEW",
    issue_date: str | None = None,
    allocation: AllocationFields | None = None,
    mark_preview: bool = True,
) -> dict[str, Any]:
    """Visual structure for Israeli Tax Invoice — always marked preview unless issued by provider."""
    alloc = allocation or AllocationFields()
    return {
        "document_type": DocumentType.TAX_INVOICE,
        "template_version": "invoice-il-v1",
        "preview_only": mark_preview,
        "preview_banner_he": "תצוגה מקדימה בלבד — אינה חשבונית מס שהונפקה כדין",
        "issuer": {
            "legal_name": company.get("legal_name") or company.get("brand_name"),
            "display_name": company.get("brand_name") or company.get("name"),
            "address": company.get("address_line") or company.get("address"),
            "business_number": company.get("business_number"),
            "business_number_label": company.get("business_number_label"),
            "tax_status": company.get("tax_status"),
            "phone": company.get("phone"),
            "email": company.get("email"),
        },
        "document_title": "חשבונית מס",
        "document_number": document_number,
        "issue_date": issue_date,
        "customer": customer,
        "lines": lines,
        "totals": totals,
        "allocation_number": alloc.allocation_number,
        "allocation_status": alloc.allocation_status,
        "amount_due": totals.get("total_gross") or totals.get("total"),
        "payment": company.get("payment"),
    }


def assert_can_render_statutory(document_type: str, *, issued: bool) -> dict[str, Any] | None:
    if issued:
        return None
    return refuse_statutory_pdf_without_issuance(document_type)
