"""Company Document System — profile, snapshot, formatters, accounting boundary."""

from __future__ import annotations

from app.documents.accounting import accounting_issuance_allowed, refuse_statutory_pdf_without_issuance
from app.documents.company_profile import (
    BUSINESS_NUMBER_LABELS,
    company_snapshot_from_profile,
    missing_quote_company_fields,
    normalize_company_profile,
)
from app.documents.formatters import format_date_he, format_money
from app.documents.invoice_foundation import build_invoice_preview_context
from app.quote_pdf import render_quote_pdf
from app.quote_snapshot import public_payload, version_snapshot


def test_normalize_company_profile_backfills_workspace_name():
    profile = normalize_company_profile({"name": "אגיס מערכות"}, {})
    assert profile["displayName"] == "אגיס מערכות"
    assert profile["legalName"] == "אגיס מערכות"
    assert missing_quote_company_fields(profile) == []


def test_normalize_does_not_invent_business_number():
    profile = normalize_company_profile({"name": "Demo"}, {"phone": "03-1"})
    assert "businessNumber" not in profile or not profile.get("businessNumber")
    assert profile["phone"] == "03-1"


def test_business_number_label_by_type():
    profile = normalize_company_profile(
        {"name": "X"},
        {"displayName": "X", "businessNumber": "20XXXXXXX", "businessNumberType": "authorized_dealer"},
    )
    from app.documents.company_profile import company_block_from_profile

    block = company_block_from_profile(profile)
    assert block["business_number_label"] == BUSINESS_NUMBER_LABELS["authorized_dealer"]
    assert block["business_number"] == "20XXXXXXX"


def test_company_snapshot_stable_after_live_edit():
    profile = normalize_company_profile(
        {"name": "Old"},
        {
            "displayName": "Old Brand",
            "legalName": "Old Legal Ltd",
            "phone": "03-111",
            "brandPrimary": "#112233",
        },
    )
    snap = company_snapshot_from_profile(profile)
    # Live branding changes later
    live = normalize_company_profile(
        {"name": "New"},
        {"displayName": "New Brand", "phone": "03-999", "brandPrimary": "#ffffff"},
    )
    assert snap["displayName"] == "Old Brand"
    assert snap["phone"] == "03-111"
    assert live["displayName"] == "New Brand"
    # Historical public payload uses snapshot
    doc = public_payload(
        {
            "id": "q1",
            "number": "Q-1",
            "status": "sent",
            "subtotal_net": 100,
            "vat_amount": 18,
            "total_gross": 118,
            "vat_percent": 18,
            "currency": "ILS",
        },
        [],
        workspace={"name": "New"},
        customer={"display_name": "Cust"},
        site=None,
        branding={"displayName": "New Brand"},
        company_snapshot=snap,
    )
    assert doc["company"]["brand_name"] == "Old Brand"
    assert doc["company"]["phone"] == "03-111"


def test_version_snapshot_freezes_company_and_template_when_sent():
    snap = version_snapshot(
        {"id": "q1", "number": "Q-2", "status": "sent", "subtotal_net": 1, "vat_amount": 0, "total_gross": 1},
        [],
        workspace={"name": "אגיס"},
        customer=None,
        site=None,
        status="sent",
        branding={"displayName": "אגיס", "legalName": 'אגיס בע"מ', "phone": "03"},
        pdf_template={"id": "t1", "primaryColor": "#123456"},
    )
    public = snap["public"]
    assert public.get("company_snapshot")
    assert public["company_snapshot"]["displayName"] == "אגיס"
    assert public["pdf_template"]["primaryColor"] == "#123456"
    assert public["template_version"] == "quote-v2"


def test_draft_snapshot_does_not_require_frozen_company():
    snap = version_snapshot(
        {"id": "q1", "number": "Q-3", "status": "draft", "subtotal_net": 1, "vat_amount": 0, "total_gross": 1},
        [],
        workspace={"name": "אגיס"},
        customer=None,
        site=None,
        status="draft",
        branding={"displayName": "אגיס"},
    )
    assert "company_snapshot" not in snap["public"] or not snap["public"].get("company_snapshot")


def test_money_formatter_canonical():
    assert format_money(0) == "\u20660.00\u2069 ₪"
    assert format_money(59) == "\u206659.00\u2069 ₪"
    assert format_money(1180) == "\u20661,180.00\u2069 ₪"
    assert format_money(61309.26) == "\u206661,309.26\u2069 ₪"
    assert "‏" not in format_money(61_309.26)  # no Hebrew RLM artifacts


def test_date_formatter():
    assert format_date_he("2026-09-05") == "\u206605.09.2026\u2069"


def test_accounting_boundary_blocks_fake_invoice():
    err = refuse_statutory_pdf_without_issuance("tax_invoice")
    assert err is not None
    assert err["code"] == "ACCOUNTING_ISSUANCE_REQUIRED"
    assert accounting_issuance_allowed(features=["quotes"]) is False
    assert accounting_issuance_allowed(features=["accounting_documents"]) is True


def test_invoice_preview_marked_preview_only():
    ctx = build_invoice_preview_context(
        company={"legal_name": "X", "brand_name": "X"},
        customer={"display_name": "Y"},
        lines=[],
        totals={"total_gross": 100},
    )
    assert ctx["preview_only"] is True
    assert "תצוגה מקדימה" in ctx["preview_banner_he"]


def test_pdf_v2_with_company_identity_and_sections():
    doc = public_payload(
        {
            "id": "q1",
            "number": "Q-00046",
            "version": 1,
            "status": "sent",
            "title": "מערכת CCTV",
            "subtotal_net": 12000,
            "vat_amount": 2160,
            "total_gross": 14160,
            "vat_percent": 18,
            "currency": "ILS",
            "valid_until": "2026-09-19",
            "issued_at": "2026-09-05T10:00:00Z",
        },
        [
            {
                "id": "i1",
                "item_type": "equipment",
                "name": "Camera",
                "description": "מצלמת IP 4MP",
                "sku": "IPC3614SB-ADF28KM-DL-I1",
                "qty": 4,
                "unit_price": 1250,
                "discount": 0,
                "line_net": 5000,
                "section_id": "s1",
            },
            {
                "id": "i2",
                "item_type": "note",
                "description": "הערה ללא מחיר",
                "qty": 0,
                "unit_price": 0,
                "line_net": 0,
                "section_id": "s1",
            },
        ],
        workspace={"name": "אגיס מערכות"},
        customer={"display_name": "א.ב. פתרונות", "phone": "050-111"},
        site={"name": "Golda Meir School", "address": {"line": "רח׳ הדקל 1"}},
        sections=[{"id": "s1", "name": "מערכת CCTV", "sort_order": 0}],
        branding={
            "displayName": "אגיס מערכות",
            "legalName": 'אגיס מערכות בע"מ',
            "businessNumber": "515XXXXXX",
            "businessNumberType": "company_number",
            "phone": "03-555",
            "email": "office@example.com",
            "brandPrimary": "#1c4e80",
            "addressLine1": "רח׳ התעשייה 1",
        },
        freeze_company=True,
    )
    pdf_bytes, filename = render_quote_pdf(doc)
    assert pdf_bytes[:4] == b"%PDF"
    assert "Q-00046" in filename
    assert len(pdf_bytes) > 2000
    assert doc["company_snapshot"]["legalName"] == 'אגיס מערכות בע"מ'


def test_pdf_no_logo_wordmark_fallback():
    doc = public_payload(
        {
            "id": "q1",
            "number": "Q-9",
            "status": "draft",
            "subtotal_net": 10,
            "vat_amount": 1.8,
            "total_gross": 11.8,
            "vat_percent": 18,
            "currency": "ILS",
        },
        [{"id": "1", "item_type": "service", "name": "שירות", "qty": 1, "unit_price": 10, "line_net": 10}],
        workspace={"name": "חברה ללא לוגו"},
        customer={"display_name": "לקוח"},
        site=None,
        branding={"displayName": "חברה ללא לוגו"},
    )
    pdf_bytes, _ = render_quote_pdf(doc)
    assert pdf_bytes[:4] == b"%PDF"


def test_pdf_50_lines_multi_page():
    items = [
        {
            "id": str(i),
            "item_type": "equipment",
            "name": f"פריט {i}",
            "description": "תיאור ארוך מאוד " * 8,
            "sku": f"SKU-{i:03d}-NVR502",
            "qty": 1,
            "unit_price": 100 + i,
            "line_net": 100 + i,
        }
        for i in range(50)
    ]
    doc = public_payload(
        {
            "id": "qbig",
            "number": "Q-BIG",
            "status": "draft",
            "subtotal_net": 5000,
            "vat_amount": 900,
            "total_gross": 5900,
            "vat_percent": 18,
            "currency": "ILS",
        },
        items,
        workspace={"name": "אגיס מערכות"},
        customer={"display_name": "לקוח גדול"},
        site=None,
        branding={"displayName": "אגיס מערכות", "legalName": 'אגיס מערכות בע"מ'},
    )
    pdf_bytes, _ = render_quote_pdf(doc)
    assert pdf_bytes[:4] == b"%PDF"
    assert len(pdf_bytes) > 20_000
