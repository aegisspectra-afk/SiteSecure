"""Unit tests for quote signature artifact helpers."""

from __future__ import annotations

import base64

import pytest

from app.errors import ApiError
from app.quote_signature import parse_signature_data_url


# 1x1 transparent PNG
_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
_PNG_DATA_URL = f"data:image/png;base64,{_PNG_B64}"


def test_parse_signature_data_url_png():
    raw, mime = parse_signature_data_url(_PNG_DATA_URL)
    assert mime == "image/png"
    assert raw == base64.b64decode(_PNG_B64)


def test_parse_signature_data_url_rejects_non_image():
    with pytest.raises(ApiError) as exc:
        parse_signature_data_url("data:text/plain;base64,YQ==")
    assert exc.value.status_code == 400


def test_pdf_embeds_captured_signature_ink():
    from app.quote_pdf import render_quote_pdf

    doc = {
        "number": "Q-SIG-1",
        "version": 1,
        "status": "approved",
        "currency": "ILS",
        "vat_percent": 17,
        "subtotal_net": 100,
        "vat_amount": 17,
        "total_gross": 117,
        "company": {"name": "אגיס"},
        "customer": {"display_name": "לקוח"},
        "items": [
            {
                "name": "מצלמה",
                "qty": 1,
                "unit_price": 100,
                "line_total": 100,
                "item_type": "catalog",
            }
        ],
        "approved_at": "2026-08-27T12:00:00+00:00",
        "approved_name": "ישראל ישראלי",
        "signature": {
            "mode": "signature_pad_v1",
            "captured": {
                "signer_name": "ישראל ישראלי",
                "signed_at": "2026-08-27T12:00:00+00:00",
                "image_data_url": _PNG_DATA_URL,
                "document_id": "00000000-0000-0000-0000-000000000001",
            },
        },
    }
    pdf_bytes, filename = render_quote_pdf(doc)
    assert filename.startswith("SITE-SECURE-QUOTE-")
    assert len(pdf_bytes) > 2000
