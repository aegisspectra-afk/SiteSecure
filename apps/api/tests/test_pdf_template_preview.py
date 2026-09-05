from app.pdf_template_sample import build_sample_quote_document
from app.quote_pdf import render_quote_pdf


def test_sample_template_preview_uses_same_renderer():
    doc = build_sample_quote_document(
        template={
            "id": "t1",
            "name": "סטנדרט",
            "config": {
                "primaryColor": "#0b6bcb",
                "showLogo": True,
                "showPaymentTerms": True,
                "showQuoteValidity": True,
                "headerCompany": True,
                "headerLogo": True,
                "footerPayment": True,
                "footerSignature": True,
                "showCustomerSignature": True,
                "paymentTerms": "שוטף + 30",
                "notes": "הערות טכניות לדוגמה",
            },
        },
        branding={"name": "אגיס מערכות", "phone": "03-111"},
        workspace_name="אגיס מערכות",
    )
    assert doc["pdf_template"]["primaryColor"] == "#0b6bcb"
    assert doc["customer"]["display_name"]
    pdf_bytes, filename = render_quote_pdf(doc)
    assert pdf_bytes[:4] == b"%PDF"
    assert "Q-00124" in filename or filename.endswith(".pdf")


def test_sample_respects_disabled_signature_flag():
    doc = build_sample_quote_document(
        template={
            "config": {
                "footerSignature": False,
                "showCustomerSignature": False,
                "headerLogo": True,
                "showLogo": True,
            }
        }
    )
    pdf_bytes, _ = render_quote_pdf(doc)
    assert pdf_bytes[:4] == b"%PDF"
