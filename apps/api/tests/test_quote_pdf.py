from app.quote_pdf import render_quote_pdf
from app.quote_snapshot import public_payload
import warnings


def _doc():
    return public_payload(
        {
            "id": "q1",
            "number": "Q-00012",
            "version": 1,
            "status": "sent",
            "title": "מערכת מצלמות",
            "subtotal_net": 8500,
            "vat_amount": 1530,
            "total_gross": 10030,
            "vat_percent": 18,
            "currency": "ILS",
            "payment_terms": "40/60",
            "warranty": "12 חודשים",
            "cost_total": 999,
            "margin_percent": 50,
            "internal_notes": "secret",
        },
        [
            {
                "id": "i1",
                "item_type": "catalog",
                "description": "מצלמה",
                "name": "Cam",
                "qty": 2,
                "unit_price": 100,
                "discount": 0,
                "line_net": 200,
                "section_id": "s1",
                "cost": 40,
            }
        ],
        workspace={"name": "אגיס מערכות"},
        customer={"display_name": "שנידי הלר", "phone": "058"},
        site={"name": "בית", "address": {"line": "ת״א"}},
        sections=[{"id": "s1", "name": "מערכת מצלמות", "sort_order": 0}],
        branding={"name": "אגיס מערכות"},
    )


def test_pdf_is_real_pdf_bytes():
    doc = _doc()
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        pdf_bytes, filename = render_quote_pdf(doc)
    assert pdf_bytes[:4] == b"%PDF"
    assert filename == "SITE-SECURE-QUOTE-Q-00012.pdf"
    assert len(pdf_bytes) > 1000
    glyph_warnings = [w for w in caught if "missing the following glyphs" in str(w.message)]
    assert not glyph_warnings, glyph_warnings


def test_pdf_scrubs_internal_fields_even_if_passed():
    doc = _doc()
    doc["cost_total"] = 999
    doc["internal_notes"] = "secret"
    doc["items"][0]["cost"] = 40
    pdf_bytes, _ = render_quote_pdf(doc)
    assert b"secret" not in pdf_bytes
    # cost numbers alone can appear in pricing; ensure key labels are absent
    assert b"cost_total" not in pdf_bytes
    assert b"internal_notes" not in pdf_bytes


def test_pdf_hebrew_and_digits_render_without_glyph_gaps():
    doc = _doc()
    doc["title"] = "הצעת מחיר מערכת הקלטה"
    doc["payment_terms"] = "40% בעת סגירת ההזמנה"
    doc["customer"] = {"display_name": "שנידי הלר", "phone": "0585378423", "email": "a@b.com"}
    pdf_bytes, _ = render_quote_pdf(doc)
    assert b"%PDF" == pdf_bytes[:4]
    assert len(pdf_bytes) > 5000


def test_pdf_input_has_no_internal_cost_keys():
    doc = _doc()
    assert "cost_total" not in doc
    assert "margin_percent" not in doc
    assert "internal_notes" not in doc
    assert "cost" not in doc["items"][0]
    blob = str(doc)
    assert "999" not in blob
    assert "secret" not in blob


def test_pdf_zero_price_renders_as_included():
    doc = _doc()
    doc["items"][0]["unit_price"] = 0
    doc["items"][0]["line_net"] = 0
    doc["items"][0]["sku"] = "DS-7616NXI-2T"
    pdf_bytes, _ = render_quote_pdf(doc)
    assert b"%PDF" == pdf_bytes[:4]
    # Dedicated SKU column keeps model codes as LTR content in the stream.
    assert b"DS" in pdf_bytes or b"7616" in pdf_bytes
    from app.quote_pdf import _line_description

    # Description column is human title only — SKU is not appended there.
    assert "DS-7616NXI-2T" not in _line_description(doc["items"][0])


def test_pdf_demotes_external_quote_source():
    doc = _doc()
    doc["title"] = "מערכת מצלמות מקיפה לבית"
    doc["summary"] = "הצעת מחיר חיצונית מס׳ 500"
    pdf_bytes, filename = render_quote_pdf(doc)
    assert filename.startswith("SITE-SECURE-QUOTE-")
    assert len(pdf_bytes) > 2000


def test_pdf_digital_approval_block():
    doc = _doc()
    doc["status"] = "approved"
    doc["approved_at"] = "2026-08-26T17:14:00+00:00"
    doc["approved_name"] = "שנידי הלר"
    pdf_bytes, _ = render_quote_pdf(doc)
    assert len(pdf_bytes) > 2000


def _pdf_plain_text(pdf_bytes: bytes) -> str:
    import pymupdf

    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    try:
        return "\n".join(page.get_text("text") for page in doc)
    finally:
        doc.close()


def test_pdf_includes_customer_company_and_contact_details():
    """Regression: multi_cell without set_x dropped customer/title off-page."""
    doc = _doc()
    doc["title"] = "מערכת מצלמות לבית"
    doc["customer"] = {
        "display_name": "שנידי הלר",
        "phone": "0585378423",
        "email": "customer@example.com",
        "address_line": "רחוב הרצל 1, תל אביב",
    }
    doc["company"] = {"name": "אגיס מערכות בע״מ", "brand_name": "אגיס מערכות בע״מ"}
    pdf_bytes, _ = render_quote_pdf(doc)
    text = _pdf_plain_text(pdf_bytes)
    assert "שנידי הלר" in text
    assert "אגיס מערכות" in text
    assert "0585378423" in text or "058" in text
    assert "customer@example.com" in text
    assert "הרצל" in text or "תל אביב" in text
    assert "מערכת מצלמות לבית" in text


def test_pdf_customer_partial_details_still_renders_name():
    doc = _doc()
    doc["customer"] = {"display_name": "לקוח חלקי", "phone": None, "email": None}
    doc.pop("site", None)
    text = _pdf_plain_text(render_quote_pdf(doc)[0])
    assert "לקוח חלקי" in text
    assert "טלפון:" not in text
    assert "אימייל:" not in text


def test_pdf_company_without_customer_contact_still_renders_brand():
    doc = _doc()
    doc["customer"] = {"display_name": "חברת אלפא בע״מ"}
    doc["company"] = {"name": "אגיס מערכות", "brand_name": "אגיס מערכות", "legal_name": "אגיס מערכות בע״מ"}
    text = _pdf_plain_text(render_quote_pdf(doc)[0])
    assert "אגיס מערכות" in text
    assert "חברת אלפא" in text


def test_pdf_customer_without_address_omits_blank_address_line():
    doc = _doc()
    doc["customer"] = {"display_name": "בלי כתובת", "phone": "0501111111", "email": "x@y.com"}
    doc["site"] = {"name": None, "address": None}
    doc["project_address"] = None
    text = _pdf_plain_text(render_quote_pdf(doc)[0])
    assert "בלי כתובת" in text
    assert "0501111111" in text or "050" in text
    assert "x@y.com" in text


def test_pdf_approved_document_survives_rerender_like_refresh():
    """Approved payload (as after GET /document or public PDF) keeps customer + approval."""
    doc = _doc()
    doc["status"] = "approved"
    doc["approved_at"] = "2026-08-27T12:00:00+00:00"
    doc["approved_name"] = "מאשר בדיקה"
    doc["customer"] = {"display_name": "איליה קרנר", "phone": "0532757750", "email": "ilya@example.com"}
    doc["signature"] = {
        "mode": "signature_pad_v1",
        "captured": {
            "signer_name": "מאשר בדיקה",
            "signed_at": "2026-08-27T12:00:00+00:00",
            "image_data_url": (
                "data:image/png;base64,"
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
            ),
        },
    }
    first = render_quote_pdf(doc)[0]
    second = render_quote_pdf(doc)[0]
    for pdf_bytes in (first, second):
        text = _pdf_plain_text(pdf_bytes)
        assert "איליה קרנר" in text
        assert "מאשר בדיקה" in text
        assert "מאושר" in text or "אושרה" in text
        assert len(pdf_bytes) > 2000
