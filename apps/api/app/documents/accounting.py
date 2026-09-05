"""Accounting issuance boundary — provider adapter interface (no fake compliance)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

from .types import AccountingIssuanceStatus, DocumentType, STATUTORY_DOCUMENT_TYPES


@dataclass
class AccountingDocumentResult:
    external_document_id: str
    document_number: str
    document_type: str
    issued_at: str
    status: str
    allocation_number: str | None = None
    pdf_url: str | None = None
    pdf_bytes: bytes | None = None
    provider_payload: dict[str, Any] = field(default_factory=dict)


@dataclass
class AllocationFields:
    """Displayed by PDF only when supplied by accounting issuance — never invented."""

    allocation_number: str | None = None
    allocation_status: str | None = None
    allocation_requested_at: str | None = None
    allocation_provider: str | None = None
    allocation_error: str | None = None


class AccountingProvider(Protocol):
    """Approved Israeli accounting provider adapter (Morning / iCount / …).

    SITE SECURE owns customer/site/quote/project linkage and document UX.
    The provider owns statutory numbering, ITA allocation, and legal issuance.
    """

    def create_invoice(self, *, workspace_id: str, payload: dict[str, Any]) -> AccountingDocumentResult: ...

    def create_receipt(self, *, workspace_id: str, payload: dict[str, Any]) -> AccountingDocumentResult: ...

    def create_invoice_receipt(self, *, workspace_id: str, payload: dict[str, Any]) -> AccountingDocumentResult: ...

    def create_credit_document(self, *, workspace_id: str, payload: dict[str, Any]) -> AccountingDocumentResult: ...

    def get_document(self, *, workspace_id: str, external_document_id: str) -> AccountingDocumentResult: ...

    def cancel_or_credit(self, *, workspace_id: str, external_document_id: str, payload: dict[str, Any]) -> AccountingDocumentResult: ...


def is_statutory_document(document_type: str) -> bool:
    try:
        return DocumentType(document_type) in STATUTORY_DOCUMENT_TYPES
    except ValueError:
        return False


def accounting_issuance_allowed(*, features: list[str] | None, entitlement_flag: bool = False) -> bool:
    """Gate statutory issuance. Requires accounting_documents feature — not quotes alone."""
    if entitlement_flag:
        return True
    return "accounting_documents" in set(features or [])


def refuse_statutory_pdf_without_issuance(document_type: str) -> dict[str, Any] | None:
    """Return an API error body if renderer alone is asked to produce a legal invoice PDF."""
    if not is_statutory_document(document_type):
        return None
    return {
        "code": "ACCOUNTING_ISSUANCE_REQUIRED",
        "message_he": "הפקת מסמך חשבונאי מחייבת מנוע הנפקה מאושר — לא ניתן להפיק חשבונית מס מהמחולל בלבד.",
        "document_type": document_type,
        "issuance_status": AccountingIssuanceStatus.PREVIEW,
    }
