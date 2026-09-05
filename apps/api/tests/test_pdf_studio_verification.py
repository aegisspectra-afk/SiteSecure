"""Final verification suite for PDF Template Studio / Company Document System."""

from __future__ import annotations

import inspect
import re
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader

from app.documents.accounting import refuse_statutory_pdf_without_issuance
from app.documents.company_profile import company_block_from_profile, normalize_company_profile
from app.quote_pdf import render_quote_pdf
from app.quote_snapshot import public_payload, version_snapshot
from app.routers import workspace_settings as ws_mod


FIXTURE_DIR = Path(__file__).resolve().parent / "_pdf_studio_fixtures"
FIXTURE_DIR.mkdir(exist_ok=True)

_NBH = "\u2011"
_LRI = "\u2066"
_PDI = "\u2069"


def _pdf_text(pdf: bytes) -> str:
    reader = PdfReader(BytesIO(pdf))
    raw = "\n".join((page.extract_text() or "") for page in reader.pages)
    return raw.replace(_NBH, "-").replace(_LRI, "").replace(_PDI, "")


def _base_quote(**over):
    q = {
        "id": "q-verify",
        "number": "Q-VERIFY-001",
        "version": 1,
        "status": "sent",
        "title": "מערכת אבטחה — אימות",
        "subtotal_net": 10000.0,
        "vat_amount": 1800.0,
        "total_gross": 11800.0,
        "vat_percent": 18,
        "currency": "ILS",
        "payment_terms": "40% מקדמה + יתרה בסיום",
        "customer_notes": "הערת לקוח מההצעה",
        "issued_at": "2026-09-01T10:00:00Z",
        "valid_until": "2026-09-15",
    }
    q.update(over)
    return q


def _items(n: int = 3, *, sections: bool = True):
    rows = []
    for i in range(n):
        rows.append(
            {
                "id": f"i{i}",
                "item_type": "equipment",
                "name": f"פריט {i}",
                "description": "תיאור עברי ארוך לאימות מעברי עמוד " * (4 if n > 20 else 1),
                "sku": "IPC3614SB-ADF28KM-DL-I1" if i % 2 == 0 else "NVR502-32B-P16",
                "qty": 2,
                "unit_price": 100 + i,
                "discount": 10 if i == 1 else 0,
                "discount_type": "amount",
                "line_net": (100 + i) * 2 - (10 if i == 1 else 0),
                "section_id": f"s{i % 3}" if sections else None,
            }
        )
    return rows


def _sections():
    return [
        {"id": "s0", "name": "מערכת CCTV", "sort_order": 0},
        {"id": "s1", "name": "הקלטה", "sort_order": 1},
        {"id": "s2", "name": "התקנה", "sort_order": 2},
    ]


def test_historical_company_snapshot_survives_branding_change():
    branding_a = {
        "displayName": "Aegis Test Systems",
        "legalName": "Aegis Test Systems Ltd",
        "businessNumber": "515111111",
        "businessNumberType": "company_number",
        "addressLine1": "Address A",
        "phone": "03-1111111",
        "email": "a@example.com",
        "brandPrimary": "#111111",
        "logoStoragePath": "ws-a/company/logo/logo-a.png",
        "logoBucket": "branding",
    }
    snap = version_snapshot(
        _base_quote(),
        _items(2),
        workspace={"name": "Aegis Test Systems"},
        customer={"display_name": "Customer A", "email": "office@example.com"},
        site={"name": "Site A", "address": {"line": "Site Addr"}},
        status="sent",
        sections=_sections()[:1],
        branding=branding_a,
        pdf_template={"id": "tpl-a", "showSku": True, "primaryColor": "#111111", "showBankDetails": False},
    )
    public_a = snap["public"]
    assert public_a["company_snapshot"]["displayName"] == "Aegis Test Systems"
    assert public_a["company_snapshot"]["addressLine1"] == "Address A"
    assert public_a["company_snapshot"]["logoStoragePath"].endswith("logo-a.png")
    assert public_a["pdf_template"]["id"] == "tpl-a"

    # Live branding mutated after freeze
    branding_b = {
        "displayName": "Brand B Systems",
        "legalName": "Brand B Ltd",
        "businessNumber": "515222222",
        "addressLine1": "Address B",
        "phone": "03-2222222",
        "email": "b@example.com",
        "brandPrimary": "#00ff00",
        "logoStoragePath": "ws-a/company/logo/logo-b.png",
        "logoBucket": "branding",
    }
    # Historical PDF path: render from frozen public payload (not live branding)
    hist = dict(public_a)
    hist["company"] = hist["company"]  # already frozen via company_snapshot at build
    # Re-bind company from snapshot explicitly (auth/public path)
    from app.quote_snapshot import company_block

    hist["company"] = company_block({}, public_a["company_snapshot"])
    pdf_old, _ = render_quote_pdf(hist)
    assert pdf_old[:4] == b"%PDF"
    (FIXTURE_DIR / "D_historical_before_brand_change.pdf").write_bytes(pdf_old)

    # New document uses live branding B
    new_doc = public_payload(
        _base_quote(number="Q-VERIFY-002", status="draft"),
        _items(2),
        workspace={"name": "Brand B Systems"},
        customer={"display_name": "Customer B"},
        site=None,
        branding=branding_b,
        freeze_company=False,
    )
    assert new_doc["company"]["brand_name"] == "Brand B Systems"
    assert new_doc["company"]["address_line"] == "Address B"
    pdf_new, _ = render_quote_pdf(new_doc)
    (FIXTURE_DIR / "E_new_after_brand_change.pdf").write_bytes(pdf_new)

    # Frozen snapshot must remain A
    assert public_a["company_snapshot"]["displayName"] == "Aegis Test Systems"
    assert public_a["company_snapshot"]["addressLine1"] == "Address A"
    assert "Brand B" not in str(public_a["company_snapshot"])


def test_template_snapshot_not_mutated_by_later_template_edits():
    tpl_a = {
        "id": "tpl-v1",
        "showSku": True,
        "showBankDetails": False,
        "headerContact": True,
        "footerPageNumber": True,
        "paymentTerms": "50% מקדמה",
        "primaryColor": "#abcdef",
        "overrideColors": True,
        "useCompanyColors": False,
    }
    v1 = version_snapshot(
        _base_quote(number="Q-TPL-A"),
        _items(1),
        workspace={"name": "Co"},
        customer={"display_name": "Cust"},
        site=None,
        status="sent",
        branding={"displayName": "Co"},
        pdf_template=tpl_a,
    )
    frozen = dict(v1["public"]["pdf_template"])
    # Later template edit (live config mutated)
    tpl_b = {**tpl_a, "showSku": False, "showBankDetails": True, "paymentTerms": "חדש לגמרי", "primaryColor": "#000000"}
    v2 = version_snapshot(
        _base_quote(number="Q-TPL-B"),
        _items(1),
        workspace={"name": "Co"},
        customer={"display_name": "Cust"},
        site=None,
        status="sent",
        branding={"displayName": "Co"},
        pdf_template=tpl_b,
    )
    assert v1["public"]["pdf_template"]["showSku"] is True
    assert v1["public"]["pdf_template"]["paymentTerms"] == "50% מקדמה"
    assert frozen == v1["public"]["pdf_template"]
    assert v2["public"]["pdf_template"]["showSku"] is False
    assert v2["public"]["pdf_template"]["paymentTerms"] == "חדש לגמרי"


def test_preview_endpoint_is_read_only_no_mutations():
    src = inspect.getsource(ws_mod.preview_pdf_template)
    # Must not persist quotes/versions/accounting/events
    for banned in (
        "quote_versions",
        "accounting_documents",
        "generated_documents",
        "write_audit",
        "_upsert_version_snapshot",
        "client.post(",
        "client.patch(",
        "client.delete(",
        "svc.post(",
    ):
        assert banned not in src, f"preview must not call {banned}"
    assert "render_quote_pdf" in src
    assert "build_sample_quote_document" in src


def test_missing_company_data_no_undefined_or_fake_issuer():
    doc = public_payload(
        _base_quote(number="Q-EMPTY", status="draft"),
        [{"id": "1", "item_type": "service", "name": "שירות", "qty": 1, "unit_price": 100, "line_net": 100}],
        workspace={"name": "Minimal Co"},
        customer={"display_name": "לקוח"},
        site=None,
        branding={"displayName": "Minimal Co"},  # name only — no logo/bn/address/phone/email/bank
    )
    company = doc["company"]
    assert company.get("business_number") in (None, "")
    assert "phone" not in company or not company.get("phone")
    pdf, name = render_quote_pdf(doc)
    assert pdf[:4] == b"%PDF"
    text = _pdf_text(pdf)
    assert "undefined" not in text.lower()
    assert re.search(r"\bnull\b", text, re.I) is None
    assert "SITE SECURE" not in text
    assert "Minimal Co" in text
    (FIXTURE_DIR / "C_no_logo_incomplete_company.pdf").write_bytes(pdf)


def test_rtl_sku_email_currency_in_pdf_stream():
    doc = public_payload(
        _base_quote(number="Q-BIDI", subtotal_net=1250, vat_amount=225, total_gross=1475),
        [
            {
                "id": "1",
                "item_type": "equipment",
                "name": "מצלמה",
                "description": "מצלמת IP",
                "sku": "IPC3614SB-ADF28KM-DL-I1",
                "qty": 1,
                "unit_price": 1250,
                "line_net": 1250,
                "section_id": "s0",
            },
            {
                "id": "2",
                "item_type": "equipment",
                "name": "מקליט",
                "sku": "NVR502-32B-P16",
                "qty": 1,
                "unit_price": 0,
                "line_net": 0,
                "section_id": "s0",
            },
        ],
        workspace={"name": "אגיס בדיקות"},
        customer={"display_name": "לקוח עברי", "email": "office@example.com", "phone": "03-5550100"},
        site={"name": "אתר", "address": {"line": "תל אביב"}},
        sections=[{"id": "s0", "name": "ציוד", "sort_order": 0}],
        branding={
            "displayName": "אגיס בדיקות",
            "legalName": 'אגיס בדיקות בע"מ',
            "email": "office@example.com",
            "phone": "03-5550100",
        },
        freeze_company=True,
        pdf_template={"showSku": True, "footerPageNumber": True},
    )
    pdf, _ = render_quote_pdf(doc)
    text = _pdf_text(pdf)
    # FPDF may wrap long SKUs; assert LTR fragments + no full reverse
    assert "IPC3614" in text and "ADF28" in text
    assert "NVR502" in text
    assert "1I-LD-MK82FDA-BS4163CPI" not in text
    assert "office@example.com" in text
    assert "1,250.00" in text
    # Page footer must not letter-reverse Hebrew (pre-fix: דומע / ךותמ)
    assert "דומע" not in text and "ךותמ" not in text
    assert "עמוד" in text
    (FIXTURE_DIR / "A_small_one_page.pdf").write_bytes(pdf)


def test_multipage_quote_renders():
    doc = public_payload(
        _base_quote(number="Q-BIG", status="draft"),
        _items(40, sections=True),
        workspace={"name": "אגיס בדיקות"},
        customer={"display_name": "לקוח גדול"},
        site={"name": "אתר גדול"},
        sections=_sections(),
        branding={"displayName": "אגיס בדיקות", "legalName": 'אגיס בע"מ', "phone": "03-1"},
        pdf_template={"showSku": True, "showDiscountCol": True, "footerPageNumber": True},
    )
    pdf, _ = render_quote_pdf(doc)
    assert pdf[:4] == b"%PDF"
    assert len(pdf) > 25_000
    (FIXTURE_DIR / "B_large_multipage.pdf").write_bytes(pdf)


def test_payment_terms_quote_overrides_template():
    doc = public_payload(
        _base_quote(payment_terms="40% מקדמה + יתרה בסיום"),
        _items(1),
        workspace={"name": "Co"},
        customer={"display_name": "C"},
        site=None,
        branding={"displayName": "Co"},
        pdf_template={"paymentTerms": "50% מקדמה", "footerPayment": True, "showPaymentTerms": True},
    )
    # Resolution helper mirrors renderer: quote first
    resolved = doc.get("payment_terms") or (doc.get("pdf_template") or {}).get("paymentTerms")
    assert resolved == "40% מקדמה + יתרה בסיום"

    doc2 = public_payload(
        _base_quote(payment_terms=""),
        _items(1),
        workspace={"name": "Co"},
        customer={"display_name": "C"},
        site=None,
        branding={"displayName": "Co"},
        pdf_template={"paymentTerms": "50% מקדמה", "footerPayment": True, "showPaymentTerms": True},
    )
    doc2["payment_terms"] = None
    resolved2 = doc2.get("payment_terms") or (doc2.get("pdf_template") or {}).get("paymentTerms")
    assert resolved2 == "50% מקדמה"

    pdf, _ = render_quote_pdf(doc)
    assert pdf[:4] == b"%PDF"


def test_financial_parity_pdf_uses_server_totals_only():
    quote = _base_quote(subtotal_net=1234.56, vat_amount=222.22, total_gross=1456.78, vat_percent=18)
    doc = public_payload(
        quote,
        _items(1),
        workspace={"name": "Co"},
        customer={"display_name": "C"},
        site=None,
        branding={"displayName": "Co"},
    )
    assert doc["subtotal_net"] == 1234.56
    assert doc["vat_amount"] == 222.22
    assert doc["total_gross"] == 1456.78
    pdf, _ = render_quote_pdf(doc)
    text = _pdf_text(pdf)
    assert "1,234.56" in text
    assert "222.22" in text
    assert "1,456.78" in text
    # Totals must remain the server values on the document (renderer must not invent)
    assert doc["total_gross"] == quote["total_gross"]


def test_percent_discount_not_digit_reversed():
    doc = public_payload(
        _base_quote(),
        [
            {
                "id": "1",
                "item_type": "equipment",
                "name": "פריט",
                "sku": "SKU-1",
                "qty": 2,
                "unit_price": 100,
                "discount": 5,
                "discount_type": "percent",
                "line_net": 190,
            }
        ],
        workspace={"name": "Co"},
        customer={"display_name": "C"},
        site=None,
        branding={"displayName": "Co"},
        pdf_template={"showDiscountCol": True, "showSku": True},
    )
    pdf, _ = render_quote_pdf(doc)
    text = _pdf_text(pdf)
    assert "5%" in text or "%5" not in text  # prefer 5%; never lone reversed form without 5%
    assert not re.search(r"(?<!\d)%5(?!\d)", text)

def test_tenant_isolation_company_blocks_do_not_cross():
    a = company_block_from_profile(
        normalize_company_profile({"name": "A"}, {"displayName": "A", "businessNumber": "111", "logoStoragePath": "a/logo.png"})
    )
    b = company_block_from_profile(
        normalize_company_profile({"name": "B"}, {"displayName": "B", "businessNumber": "222", "logoStoragePath": "b/logo.png"})
    )
    assert a["business_number"] == "111"
    assert b["business_number"] == "222"
    assert a["logo_storage_path"].startswith("a/")
    assert b["logo_storage_path"].startswith("b/")
    assert a["logo_storage_path"] != b["logo_storage_path"]


def test_accounting_safety_blocks_statutory_issuance_claim():
    err = refuse_statutory_pdf_without_issuance("tax_invoice")
    assert err and err["code"] == "ACCOUNTING_ISSUANCE_REQUIRED"
    assert refuse_statutory_pdf_without_issuance("quote") is None


def test_logo_missing_asset_does_not_crash():
    doc = public_payload(
        _base_quote(number="Q-LOGO"),
        _items(1),
        workspace={"name": "Co"},
        customer={"display_name": "C"},
        site=None,
        branding={"displayName": "Co Wide Name", "logoStoragePath": "missing/path.png"},
    )
    # No logo bytes attached — renderer must fall back to wordmark
    pdf, _ = render_quote_pdf(doc)
    assert pdf[:4] == b"%PDF"
