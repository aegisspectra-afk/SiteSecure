"""Document type constants and template versioning."""

from __future__ import annotations

from enum import StrEnum


class DocumentType(StrEnum):
    QUOTE = "quote"
    PROFORMA = "proforma"
    TAX_INVOICE = "tax_invoice"
    TAX_INVOICE_RECEIPT = "tax_invoice_receipt"
    RECEIPT = "receipt"
    CREDIT = "credit"
    WORK_ORDER = "work_order"
    SERVICE_REPORT = "service_report"
    INSTALLATION_REPORT = "installation_report"
    SITE_REPORT = "site_report"
    WARRANTY = "warranty"
    SITE_FILE_EXPORT = "site_file_export"


DOCUMENT_TYPES = {m.value for m in DocumentType}

# Template versions are independent of quote revision numbers.
TEMPLATE_VERSIONS = {
    DocumentType.QUOTE: "quote-v2",
    DocumentType.PROFORMA: "proforma-il-v1",
    DocumentType.TAX_INVOICE: "invoice-il-v1",
    DocumentType.TAX_INVOICE_RECEIPT: "invoice-receipt-il-v1",
    DocumentType.RECEIPT: "receipt-il-v1",
    DocumentType.CREDIT: "credit-il-v1",
    DocumentType.WORK_ORDER: "work-order-v1",
    DocumentType.SERVICE_REPORT: "service-report-v1",
    DocumentType.INSTALLATION_REPORT: "installation-report-v1",
    DocumentType.SITE_REPORT: "site-report-v1",
    DocumentType.WARRANTY: "warranty-v1",
    DocumentType.SITE_FILE_EXPORT: "site-file-v1",
}


class AccountingIssuanceStatus(StrEnum):
    """Legal issuance is owned by AccountingProvider — not the PDF renderer."""

    DRAFT = "draft"
    PREVIEW = "preview"
    PENDING_PROVIDER = "pending_provider"
    ISSUED = "issued"
    VOID = "void"
    ERROR = "error"


# Document types that require accounting_documents entitlement + provider issuance.
STATUTORY_DOCUMENT_TYPES = {
    DocumentType.TAX_INVOICE,
    DocumentType.TAX_INVOICE_RECEIPT,
    DocumentType.RECEIPT,
    DocumentType.CREDIT,
}
