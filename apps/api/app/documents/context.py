"""Document context builder — normalized contract for all PDF templates."""

from __future__ import annotations

from typing import Any

from .company_profile import (
    company_block_from_profile,
    company_snapshot_from_profile,
    normalize_company_profile,
)
from .types import TEMPLATE_VERSIONS, DocumentType


def _template_version(document_type: str) -> str:
    try:
        return TEMPLATE_VERSIONS[DocumentType(document_type)]
    except ValueError:
        return f"{document_type}-v1"


def build_document_context(
    *,
    document_type: str = DocumentType.QUOTE,
    workspace: dict,
    branding: dict | None,
    customer: dict | None,
    site: dict | None,
    document: dict,
    lines: list[dict],
    sections: list[dict] | None = None,
    pdf_template: dict | None = None,
    freeze_company: bool = False,
    company_snapshot: dict | None = None,
) -> dict[str, Any]:
    """Build the stable DocumentContext object consumed by templates/renderers.

    Historical documents pass ``company_snapshot`` so live branding never mutates them.
    """
    if company_snapshot and isinstance(company_snapshot, dict) and company_snapshot:
        profile = normalize_company_profile(
            {"name": company_snapshot.get("displayName") or company_snapshot.get("legalName")},
            company_snapshot,
        )
    else:
        profile = normalize_company_profile(workspace, branding)

    company = company_block_from_profile(profile)
    snapshot = company_snapshot if company_snapshot else company_snapshot_from_profile(profile)
    tpl_version = _template_version(document_type)
    payment = company.get("payment") if isinstance(company.get("payment"), dict) else None

    ctx: dict[str, Any] = {
        "document_type": document_type,
        "template_version": tpl_version,
        "company": company,
        "customer": customer,
        "site": site,
        "document": document,
        "lines": lines,
        "sections": sections or [],
        "totals": {
            "currency": document.get("currency") or profile.get("documentCurrency") or "ILS",
            "vat_percent": document.get("vat_percent"),
            "subtotal_net": document.get("subtotal_net"),
            "vat_amount": document.get("vat_amount"),
            "total_gross": document.get("total_gross"),
            "discount_type": document.get("discount_type"),
            "discount_value": document.get("discount_value"),
        },
        "payment": payment,
        "metadata": {
            "template_version": tpl_version,
            "frozen_company": bool(freeze_company or company_snapshot),
        },
        "pdf_template": pdf_template,
    }
    if freeze_company or company_snapshot:
        ctx["company_snapshot"] = dict(snapshot)
    return ctx
