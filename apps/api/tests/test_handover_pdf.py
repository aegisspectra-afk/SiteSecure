from io import BytesIO

from pypdf import PdfReader

from app.handover_pdf import SITE_SECURE_MARKETING, render_handover_pdf


def _pdf_text(raw: bytes) -> str:
    reader = PdfReader(BytesIO(raw))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def test_handover_pdf_uses_installer_brand_and_platform_credit():
    raw, filename = render_handover_pdf(
        {
            "number": "HO-1",
            "company": {
                "brand_name": "Alpha Security Brand",
                "brand_primary": "#0b6e4f",
                "phone": "03-1234567",
            },
            "customer": {"display_name": "Test Customer"},
            "site": {"name": "Main Site", "address": "Tel Aviv"},
            "technician_name": "Yossi",
            "completed_at": "2026-11-17",
            "warranty_label": "12 months",
            "equipment": [{"name": "Dome camera", "qty": 4}],
        }
    )
    assert filename.startswith("handover-")
    assert raw[:4] == b"%PDF"
    text = _pdf_text(raw)
    assert "Alpha Security Brand" in text
    assert "SITE SECURE" in text
    assert "utm_source=handover" in text or SITE_SECURE_MARKETING in text
