"""Public installation handover certificate PDF — installer brand + SITE SECURE credit."""

from __future__ import annotations

from fpdf.enums import XPos, YPos

from app.quote_pdf import ACCENT, INK, LINE, MUTED, QuotePdf, _hex_rgb, _txt, _ltr


SITE_SECURE_MARKETING = "https://site-secure.com/?utm_source=handover"
SITE_SECURE_CREDIT = "נוצר ב-SITE SECURE"


class HandoverPdf(QuotePdf):
    def footer(self) -> None:
        self.set_y(-18)
        self.set_draw_color(*LINE)
        self.set_line_width(0.3)
        self.line(self.l_margin, self.get_y(), self.l_margin + self.epw, self.get_y())
        self.ln(1.5)
        self.set_font("Doc", size=7)
        self.set_text_color(*MUTED)
        self.set_text_shaping(use_shaping_engine=True, direction="rtl")
        left = self._footer_bits or ""
        if left:
            self.cell(self.epw * 0.55, 4, text=left, align="R")
        self.set_font("Doc", size=6.5)
        self.cell(
            self.epw * (0.45 if left else 1.0),
            4,
            text=SITE_SECURE_CREDIT,
            align="L" if left else "C",
            new_x=XPos.LMARGIN,
            new_y=YPos.NEXT,
        )
        self.set_text_shaping(use_shaping_engine=True, direction="rtl")


def render_handover_pdf(document: dict) -> tuple[bytes, str]:
    """Render a Hebrew RTL handover certificate from a public snapshot dict."""
    company = document.get("company") if isinstance(document.get("company"), dict) else {}
    accent = _hex_rgb(company.get("brand_primary"), ACCENT)
    brand = _txt(company.get("brand_name") or company.get("display_name") or company.get("name")) or "—"
    legal = _txt(company.get("legal_name") or company.get("name"))
    phone = _txt(company.get("phone"))
    footer_bits = " · ".join(p for p in (legal or brand, phone) if p)

    pdf = HandoverPdf(
        brand=brand,
        number=_txt(document.get("number")) or "HANDOVER",
        footer_bits=footer_bits,
        accent=accent,
        show_page_numbers=False,
    )
    pdf.add_page()
    pdf.set_text_color(*INK)

    pdf.set_font("Doc", size=16)
    pdf.set_text_color(*accent)
    pdf.multi_cell(pdf.epw, 8, text=brand, align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(*INK)
    pdf.set_font("Doc", size=12)
    pdf.multi_cell(pdf.epw, 7, text="תעודת מסירה", align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2)

    customer = _txt((document.get("customer") or {}).get("display_name"))
    site = document.get("site") if isinstance(document.get("site"), dict) else {}
    site_name = _txt(site.get("name"))
    site_addr = _txt(site.get("address") if not isinstance(site.get("address"), dict) else site.get("address", {}).get("line"))
    tech = _txt(document.get("technician_name")) or "לא ידוע"
    completed = _txt(document.get("completed_at"))

    rows = [
        ("לקוח", customer),
        ("אתר", " · ".join(p for p in (site_name, site_addr) if p)),
        ("טכנאי", tech),
        ("תאריך סיום", completed),
        ("אחריות", _txt(document.get("warranty_label"))),
    ]
    pdf.set_font("Doc", size=10)
    for label, value in rows:
        if not value:
            continue
        pdf.set_text_color(*MUTED)
        pdf.cell(pdf.epw * 0.28, 6, text=label, align="R")
        pdf.set_text_color(*INK)
        pdf.multi_cell(pdf.epw * 0.72, 6, text=value, align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    equipment = document.get("equipment") if isinstance(document.get("equipment"), list) else []
    if equipment:
        pdf.ln(3)
        pdf.set_font("Doc", size=11)
        pdf.multi_cell(pdf.epw, 7, text="ציוד שהותקן", align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_font("Doc", size=9.5)
        for row in equipment:
            if not isinstance(row, dict):
                continue
            name = _txt(row.get("name"))
            if not name:
                continue
            qty = row.get("qty")
            line = f"{name} × {_ltr(qty)}" if qty not in (None, 1, "1") else name
            pdf.multi_cell(pdf.epw, 5.5, text=f"• {line}", align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # Platform credit (Hebrew label + Latin brand for extractable PDF text).
    pdf.ln(8)
    pdf.set_font("Doc", size=7)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(pdf.epw, 4, text=SITE_SECURE_CREDIT, align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Doc", size=7)
    pdf.multi_cell(pdf.epw, 4, text="SITE SECURE", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Doc", size=6)
    pdf.multi_cell(pdf.epw, 4, text=SITE_SECURE_MARKETING, align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    raw = pdf.output()
    data = raw if isinstance(raw, (bytes, bytearray)) else bytes(raw)
    filename = f"handover-{_txt(document.get('number')) or 'certificate'}.pdf"
    return bytes(data), filename
