"""Generate PDF Template Studio verification fixtures + PNG previews."""

from __future__ import annotations

from pathlib import Path

import pymupdf

from app.quote_pdf import render_quote_pdf
from app.quote_snapshot import company_block, public_payload, version_snapshot

FIX = Path(__file__).resolve().parents[1] / "tests" / "_pdf_studio_fixtures"
FIX.mkdir(exist_ok=True)


def base(**kw):
    q = {
        "id": "q1",
        "number": "Q-BIDI",
        "version": 1,
        "status": "sent",
        "title": "אימות",
        "subtotal_net": 1250,
        "discount_total": 0,
        "vat_rate": 0.18,
        "vat_percent": 18,
        "vat_amount": 225,
        "total_gross": 1475,
        "currency": "ILS",
        "payment_terms": "40% מקדמה + יתרה בסיום",
        "customer_notes": "הערות",
        "issued_at": "2026-09-01T10:00:00Z",
        "valid_until": "2026-09-15",
    }
    q.update(kw)
    return q


def raster(name: str, max_pages: int = 1) -> None:
    docp = pymupdf.open(FIX / name)
    print(name, "pages=", docp.page_count)
    for pi in range(min(docp.page_count, max_pages)):
        pix = docp[pi].get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5))
        out = FIX / f"{Path(name).stem}_p{pi + 1}.png"
        pix.save(out)
        print(" wrote", out.name, pix.width, pix.height)


def main() -> None:
    doc = public_payload(
        base(),
        [
            {
                "id": "1",
                "item_type": "equipment",
                "name": "מצלמה IPC",
                "description": "מצלמת IP חיצונית",
                "sku": "IPC3614SB-ADF28KM-DL-I1",
                "qty": 2,
                "unit_price": 1250,
                "line_net": 2500,
                "section_id": "s0",
            },
            {
                "id": "2",
                "item_type": "equipment",
                "name": "מקליט NVR",
                "sku": "NVR502-32B-P16",
                "qty": 1,
                "unit_price": 890,
                "line_net": 890,
                "section_id": "s0",
            },
        ],
        workspace={"name": "אגיס בדיקות"},
        customer={
            "display_name": "לקוח עברי בע״מ",
            "email": "office@example.com",
            "phone": "03-5550100",
        },
        site={"name": "אתר תל אביב", "address": {"line": "רחוב הרצל 1"}},
        sections=[{"id": "s0", "name": "ציוד רשת", "sort_order": 0}],
        branding={
            "displayName": "אגיס בדיקות",
            "legalName": "אגיס בדיקות בע״מ",
            "email": "office@example.com",
            "phone": "03-5550100",
            "businessNumber": "515111111",
        },
        freeze_company=True,
        pdf_template={
            "showSku": True,
            "footerPageNumber": True,
            "footerPayment": True,
            "showPaymentTerms": True,
        },
    )
    pdf, _ = render_quote_pdf(doc)
    (FIX / "rtl_live.pdf").write_bytes(pdf)
    (FIX / "A_small_one_page.pdf").write_bytes(pdf)

    big = public_payload(
        base(number="Q-BIG", subtotal_net=50000, vat_amount=9000, total_gross=59000),
        [
            {
                "id": f"i{i}",
                "item_type": "equipment",
                "name": f"פריט ארוך מספר {i}",
                "description": "תיאור עברי ארוך מאוד לאימות מעברי עמוד ושבירת שורות בטבלה המסמך " * 3,
                "sku": "IPC3614SB-ADF28KM-DL-I1" if i % 2 == 0 else "NVR502-32B-P16",
                "qty": 2,
                "unit_price": 100 + i,
                "discount": 5 if i % 7 == 0 else 0,
                "discount_type": "percent",
                "line_net": (100 + i) * 2 * 0.95 if i % 7 == 0 else (100 + i) * 2,
                "section_id": f"s{i % 3}",
            }
            for i in range(40)
        ],
        workspace={"name": "אגיס"},
        customer={"display_name": "לקוח גדול"},
        site={"name": "אתר"},
        sections=[
            {"id": "s0", "name": "מערכת CCTV", "sort_order": 0},
            {"id": "s1", "name": "הקלטה", "sort_order": 1},
            {"id": "s2", "name": "התקנה", "sort_order": 2},
        ],
        branding={"displayName": "אגיס בדיקות", "legalName": "אגיס בע״מ", "phone": "03-1"},
        pdf_template={"showSku": True, "showDiscountCol": True, "footerPageNumber": True},
    )
    pdfb, _ = render_quote_pdf(big)
    (FIX / "B_large_multipage.pdf").write_bytes(pdfb)

    empty = public_payload(
        base(number="Q-EMPTY"),
        [{"id": "1", "item_type": "service", "name": "שירות", "qty": 1, "unit_price": 100, "line_net": 100}],
        workspace={"name": "Minimal Co"},
        customer={"display_name": "לקוח"},
        site=None,
        branding={"displayName": "Minimal Co"},
    )
    pdfe, _ = render_quote_pdf(empty)
    (FIX / "C_no_logo_incomplete_company.pdf").write_bytes(pdfe)

    branding_a = {
        "displayName": "Aegis Test Systems",
        "legalName": "Aegis Test Systems Ltd",
        "businessNumber": "515111111",
        "addressLine1": "Address A",
        "phone": "03-1111111",
        "email": "a@example.com",
        "brandPrimary": "#111111",
        "logoStoragePath": "ws-a/company/logo/logo-a.png",
        "logoBucket": "branding",
    }
    snap = version_snapshot(
        base(),
        [{"id": "1", "item_type": "equipment", "name": "Cam", "sku": "IPC3614", "qty": 1, "unit_price": 100, "line_net": 100}],
        workspace={"name": "Aegis Test Systems"},
        customer={"display_name": "Customer A"},
        site=None,
        status="sent",
        branding=branding_a,
        pdf_template={"id": "tpl-a", "showSku": True, "primaryColor": "#111111"},
    )
    hist = dict(snap["public"])
    hist["company"] = company_block({}, snap["public"]["company_snapshot"])
    pdfd, _ = render_quote_pdf(hist)
    (FIX / "D_historical_before_brand_change.pdf").write_bytes(pdfd)

    ne = public_payload(
        base(number="Q2", status="draft"),
        [{"id": "1", "item_type": "equipment", "name": "Cam", "qty": 1, "unit_price": 100, "line_net": 100}],
        workspace={"name": "Brand B"},
        customer={"display_name": "B"},
        site=None,
        branding={
            "displayName": "Brand B Systems",
            "legalName": "Brand B Ltd",
            "businessNumber": "515222222",
            "addressLine1": "Address B",
            "phone": "03-2222222",
            "email": "b@example.com",
            "brandPrimary": "#00ff00",
            "logoStoragePath": "ws-a/company/logo/logo-b.png",
            "logoBucket": "branding",
        },
        freeze_company=False,
    )
    pdfe2, _ = render_quote_pdf(ne)
    (FIX / "E_new_after_brand_change.pdf").write_bytes(pdfe2)

    raster("rtl_live.pdf", 1)
    raster("A_small_one_page.pdf", 1)
    raster("B_large_multipage.pdf", 3)
    raster("C_no_logo_incomplete_company.pdf", 1)
    raster("D_historical_before_brand_change.pdf", 1)
    raster("E_new_after_brand_change.pdf", 1)


if __name__ == "__main__":
    main()
