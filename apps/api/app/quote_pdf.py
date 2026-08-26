"""Production quote PDF — A4 RTL commercial export of the Quote Document model.

Not the primary customer UX (that is /q/{token}). This file is the official
export of the same public payload: hierarchy, lines, totals, terms, approval.
"""

from __future__ import annotations

import re
from io import BytesIO
from pathlib import Path

from fpdf import FPDF
from fpdf.enums import TableCellFillMode, XPos, YPos
from fpdf.fonts import FontFace

FONTS_DIR = Path(__file__).resolve().parent / "assets" / "fonts"
FONT_REGULAR = FONTS_DIR / "DejaVuSans.ttf"
FONT_BOLD = FONTS_DIR / "DejaVuSans-Bold.ttf"

_LRI = "\u2066"
_PDI = "\u2069"
_NBH = "\u2011"  # non-breaking hyphen — keep SKUs intact

# Calm enterprise palette (Stripe / Linear adjacent — not loud invoice colors)
INK = (22, 32, 42)
MUTED = (100, 112, 125)
LINE = (220, 226, 234)
ACCENT = (28, 78, 128)
ACCENT_SOFT = (236, 243, 250)
SURFACE = (248, 250, 252)
WHITE = (255, 255, 255)
TOTAL_BG = (28, 78, 128)
SUCCESS = (15, 118, 78)
SUCCESS_SOFT = (232, 246, 239)

_SOURCE_META_RE = re.compile(
    r"חיצונית|מקור\s*:|external\s*quote|imported",
    re.IGNORECASE,
)
_SOURCE_NUM_RE = re.compile(r"מס[׳'`]?\s*\d+")


def _txt(value: object) -> str:
    return str(value or "").strip()


def _ltr(value: object) -> str:
    text = _txt(value)
    if not text:
        return ""
    return f"{_LRI}{text}{_PDI}"


def _sku_ltr(value: object) -> str:
    """LTR isolate + non-breaking hyphens so SKUs do not wrap mid-token."""
    text = _txt(value)
    if not text:
        return ""
    return _ltr(text.replace("-", _NBH))


def _money(value: object, currency: str = "ILS") -> str:
    try:
        amount = float(value or 0)
    except (TypeError, ValueError):
        amount = 0.0
    raw = f"{amount:,.2f}"
    if currency == "ILS":
        return f"{_LRI}{raw}{_PDI} ₪"
    return f"{_LRI}{raw} {currency}{_PDI}"


def _money_cell(value: object, currency: str = "ILS") -> str:
    """Zero prices read as included — ₪0.00 looks unfinished to customers."""
    try:
        amount = float(value or 0)
    except (TypeError, ValueError):
        amount = 0.0
    if abs(amount) < 0.005:
        return "כלול"
    return _money(amount, currency)


def _qty(value: object) -> str:
    try:
        amount = float(value or 0)
    except (TypeError, ValueError):
        return _ltr(value)
    if amount == int(amount):
        return _ltr(str(int(amount)))
    return _ltr(f"{amount:g}")


def _date_he(value: object) -> str:
    raw = _txt(value)
    if len(raw) >= 10 and raw[4] == "-" and raw[7] == "-":
        y, m, d = raw[:10].split("-")
        return _ltr(f"{d}.{m}.{y}")
    return _ltr(raw[:10]) if raw else ""


def _filename(number: object) -> str:
    raw = _txt(number) or "QUOTE"
    safe = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in raw)
    return f"SITE-SECURE-QUOTE-{safe}.pdf"


def _resolve_fonts() -> tuple[Path, Path]:
    if FONT_REGULAR.exists() and FONT_BOLD.exists():
        return FONT_REGULAR, FONT_BOLD
    raise FileNotFoundError("PDF fonts missing: app/assets/fonts/DejaVuSans*.ttf")


def _is_source_meta(text: str) -> bool:
    t = _txt(text)
    if not t:
        return False
    return bool(_SOURCE_META_RE.search(t) or _SOURCE_NUM_RE.search(t))


def _split_intro(document: dict) -> tuple[str, str, list[str]]:
    """Primary title + demoted source/meta lines (external quote refs, etc.)."""
    title = _txt(document.get("title"))
    summary = _txt(document.get("summary"))
    key_points = _txt(document.get("key_points"))
    meta_bits: list[str] = []

    def take(raw: str) -> str | None:
        if not raw:
            return None
        if _is_source_meta(raw):
            meta_bits.append(raw)
            return None
        return raw

    summary_kept = take(summary)
    kp_kept = take(key_points)
    lead = summary_kept or ""
    if kp_kept and kp_kept != lead:
        if lead:
            meta_bits.append(kp_kept)
        else:
            lead = kp_kept
    if lead and title and lead == title:
        lead = ""
    return title, lead, meta_bits


def _scrub_internal(document: dict) -> dict:
    banned = {
        "cost_total",
        "margin_amount",
        "margin_percent",
        "internal_notes",
        "cost",
        "gross_profit",
        "gp",
        "validation",
        "gaps",
        "audit",
    }
    out = {k: v for k, v in document.items() if k not in banned}
    items = []
    for item in out.get("items") or []:
        if not isinstance(item, dict):
            continue
        items.append({k: v for k, v in item.items() if k not in banned})
    out["items"] = items
    return out


def _status_he(status: object) -> str:
    mapping = {
        "draft": "טיוטה",
        "sent": "נשלחה",
        "viewed": "נצפתה",
        "approved": "אושרה",
        "rejected": "נדחתה",
        "expired": "פג תוקף",
        "cancelled": "בוטלה",
        "superseded": "הוחלפה",
    }
    return mapping.get(_txt(status), "")


class QuotePdf(FPDF):
    def __init__(self, *, brand: str, number: str) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self._brand = brand
        self._number = number
        self.set_auto_page_break(auto=True, margin=18)
        self.set_margins(14, 14, 14)
        regular, bold = _resolve_fonts()
        self.add_font("Doc", style="", fname=str(regular))
        self.add_font("Doc", style="B", fname=str(bold))
        self.set_text_shaping(use_shaping_engine=True, direction="rtl")
        self.alias_nb_pages()

    def header(self) -> None:
        # Top brand accent bar on every page
        self.set_fill_color(*ACCENT)
        self.rect(0, 0, self.w, 2.2, style="F")
        if self.page_no() <= 1:
            self.set_y(10)
            return
        self.set_y(8)
        self.set_draw_color(*LINE)
        self.set_line_width(0.35)
        self.line(self.l_margin, 12, self.l_margin + self.epw, 12)
        self.set_font("Doc", size=8)
        self.set_text_color(*MUTED)
        self.set_y(13)
        self.set_text_shaping(use_shaping_engine=True, direction="rtl")
        self.cell(self.epw * 0.55, 5, text=self._brand, align="R")
        self.set_text_shaping(False)
        self.cell(
            self.epw * 0.45,
            5,
            text=_ltr(self._number),
            align="L",
            new_x=XPos.LMARGIN,
            new_y=YPos.NEXT,
        )
        self.set_text_shaping(use_shaping_engine=True, direction="rtl")
        self.ln(3)

    def footer(self) -> None:
        self.set_y(-13)
        self.set_draw_color(*LINE)
        self.set_line_width(0.3)
        self.line(self.l_margin, self.get_y(), self.l_margin + self.epw, self.get_y())
        self.ln(1.5)
        # Split RTL brand from LTR product mark — same-cell mix was reversing Hebrew glyphs.
        self.set_font("Doc", size=7.5)
        self.set_text_color(*MUTED)
        self.set_text_shaping(use_shaping_engine=True, direction="rtl")
        self.cell(self.epw * 0.42, 5, text=self._brand, align="R")
        self.set_text_shaping(False)
        mark = f" · {_LRI}SITE SECURE{_PDI}  ·  {self.page_no()}/{{nb}}"
        self.cell(self.epw * 0.58, 5, text=mark, align="L", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_shaping(use_shaping_engine=True, direction="rtl")


def _font(pdf: QuotePdf, *, size: float = 10, bold: bool = False) -> None:
    pdf.set_font("Doc", style="B" if bold else "", size=size)


def _right_text(pdf: QuotePdf, text: str, *, size: float = 10, bold: bool = False, h: float = 5.5) -> None:
    text = _txt(text)
    if not text:
        return
    _font(pdf, size=size, bold=bold)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(pdf.epw, h, text=text, align="R")


def _section_label(pdf: QuotePdf, title: str) -> None:
    pdf.ln(1.5)
    pdf.set_fill_color(*ACCENT_SOFT)
    pdf.set_text_color(*ACCENT)
    _font(pdf, size=9.5, bold=True)
    pdf.set_x(pdf.l_margin)
    pdf.cell(pdf.epw, 6.5, text=title, align="R", fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(*INK)
    pdf.ln(1)


def _card(pdf: QuotePdf, title: str, body: str) -> None:
    text = _txt(body)
    if not text:
        return
    lines = [ln.strip() for ln in text.replace("\r", "").split("\n") if ln.strip()]
    line_h = 4.6
    needed = 9 + max(1, len(lines)) * line_h + 2
    _ensure_space(pdf, needed)
    pdf.set_fill_color(*SURFACE)
    pdf.set_draw_color(*LINE)
    pdf.set_line_width(0.3)
    pdf.set_x(pdf.l_margin)
    pdf.set_text_color(*ACCENT)
    _font(pdf, size=9, bold=True)
    pdf.cell(pdf.epw, 6, text=title, align="R", fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(*INK)
    _font(pdf, size=9)
    for ln in lines:
        bullet = f"• {ln}" if len(lines) > 1 else ln
        pdf.set_x(pdf.l_margin + 1)
        pdf.multi_cell(pdf.epw - 2, line_h, text=bullet, align="R")
    pdf.ln(1.5)
    pdf.set_draw_color(*LINE)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + pdf.epw, pdf.get_y())
    pdf.ln(2)


def _ensure_space(pdf: QuotePdf, needed: float) -> None:
    if pdf.get_y() + needed > pdf.page_break_trigger:
        pdf.add_page()


def _line_description(item: dict) -> str:
    """Human title only — SKU lives in its own column."""
    name = _txt(item.get("name"))
    desc = _txt(item.get("description"))
    sku = _txt(item.get("sku"))
    if sku and sku in desc:
        desc = desc.replace(sku, "").replace("  ", " ").strip(" -–—|/")
    if desc and name and desc != name and name not in desc:
        primary = desc
        secondary = name
    else:
        primary = desc or name or "—"
        secondary = ""
    parts = [primary]
    if secondary and secondary not in primary:
        parts.append(secondary)
    return "\n".join(p for p in parts if p)


def render_quote_pdf(document: dict) -> tuple[bytes, str]:
    document = _scrub_internal(document)
    company = document.get("company") or {}
    customer = document.get("customer") or {}
    site = document.get("site") or {}
    brand = _txt(company.get("brand_name") or company.get("name")) or "SITE SECURE"
    legal = _txt(company.get("legal_name") or company.get("name"))
    number = _txt(document.get("number")) or "—"
    version = document.get("version") or 1
    currency = _txt(document.get("currency")) or "ILS"
    status = _txt(document.get("status"))
    status_label = _status_he(status)
    title, lead, source_meta = _split_intro(document)
    customer_name = _txt(customer.get("display_name"))
    site_name = _txt(site.get("name") or document.get("project_name"))
    raw_addr = site.get("address")
    if isinstance(raw_addr, dict):
        addr_from_site = raw_addr.get("line") or raw_addr.get("formatted")
    else:
        addr_from_site = raw_addr
    site_addr = _txt(document.get("project_address") or customer.get("address_line") or addr_from_site)
    # Avoid repeating the quote title as "site"
    if site_name and title and site_name == title:
        site_name = ""

    pdf = QuotePdf(brand=brand, number=number)
    pdf.add_page()
    pdf.set_text_color(*INK)

    # ── Compact brand row ───────────────────────────────────────
    pdf.set_text_color(*ACCENT)
    _font(pdf, size=11, bold=True)
    pdf.cell(pdf.epw * 0.62, 6, text=brand, align="R")
    if status_label:
        pdf.set_fill_color(*ACCENT_SOFT)
        pdf.set_text_color(*ACCENT)
        _font(pdf, size=8, bold=True)
        pdf.cell(pdf.epw * 0.38, 6, text=status_label, align="L", fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    else:
        pdf.ln(6)
    if legal and legal != brand:
        pdf.set_text_color(*MUTED)
        _font(pdf, size=8)
        pdf.cell(pdf.epw, 4, text=legal, align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # ── Hero identity (single title stack) ───────────────────────
    pdf.ln(2)
    pdf.set_text_color(*INK)
    _font(pdf, size=18, bold=True)
    pdf.multi_cell(pdf.epw, 8, text=f"הצעת מחיר {_ltr(f'#{number}')}", align="R")
    if title:
        pdf.set_text_color(*INK)
        _font(pdf, size=13, bold=True)
        pdf.multi_cell(pdf.epw, 6.5, text=title, align="R")

    # Customer · site on one subdued line
    who_bits = [b for b in (customer_name, site_name or site_addr) if b]
    if who_bits:
        pdf.set_text_color(*MUTED)
        _font(pdf, size=10)
        pdf.multi_cell(pdf.epw, 5.5, text=" · ".join(who_bits), align="R")

    issued = _date_he(document.get("issued_at") or document.get("sent_at") or document.get("created_at"))
    until = _date_he(document.get("valid_until"))
    meta = [m for m in (issued, f"בתוקף עד {until}" if until else "", f"גרסה {_ltr(version)}") if m]
    meta.extend(source_meta)
    if meta:
        pdf.set_text_color(*MUTED)
        _font(pdf, size=8.5)
        pdf.multi_cell(pdf.epw, 4.5, text=" · ".join(meta), align="R")

    if lead:
        pdf.ln(0.5)
        pdf.set_text_color(*MUTED)
        _right_text(pdf, lead, size=9, h=4.5)

    # Contact strip (phone only — keep quiet)
    phone = _txt(customer.get("phone"))
    if phone:
        pdf.set_text_color(*MUTED)
        _font(pdf, size=8.5)
        pdf.multi_cell(pdf.epw, 4.5, text=f"טלפון: {_ltr(phone)}", align="R")

    pdf.ln(1)
    pdf.set_draw_color(*ACCENT)
    pdf.set_line_width(0.55)
    y = pdf.get_y()
    pdf.line(pdf.l_margin, y, pdf.l_margin + pdf.epw, y)
    pdf.ln(4)

    # ── Line items ──────────────────────────────────────────────
    _section_label(pdf, "פירוט ההצעה")

    sections = {s["id"]: s for s in (document.get("sections") or []) if isinstance(s, dict) and s.get("id")}
    by_section: dict[str, list] = {sid: [] for sid in sections}
    loose: list = []
    for item in document.get("items") or []:
        if not isinstance(item, dict):
            continue
        sid = item.get("section_id")
        if sid and sid in by_section:
            by_section[sid].append(item)
        else:
            loose.append(item)

    show_discount = any(float(i.get("discount") or 0) for i in (document.get("items") or []) if isinstance(i, dict))

    def emit_table(rows: list[dict], *, start_index: int) -> int:
        if not rows:
            return start_index
        # Physical LTR cols → visual RTL: # | מק״ט | תיאור | כמות | מחיר | [הנחה] | סה״כ
        if show_discount:
            headers = ("סה״כ", "הנחה", "מחיר", "כמות", "תיאור", "מק״ט", "#")
            widths = (
                pdf.epw * 0.13,
                pdf.epw * 0.08,
                pdf.epw * 0.12,
                pdf.epw * 0.08,
                pdf.epw * 0.34,
                pdf.epw * 0.17,
                pdf.epw * 0.08,
            )
            aligns = ("R", "C", "R", "C", "R", "L", "C")
        else:
            headers = ("סה״כ", "מחיר", "כמות", "תיאור", "מק״ט", "#")
            widths = (
                pdf.epw * 0.14,
                pdf.epw * 0.14,
                pdf.epw * 0.09,
                pdf.epw * 0.36,
                pdf.epw * 0.19,
                pdf.epw * 0.08,
            )
            aligns = ("R", "R", "C", "R", "L", "C")

        _ensure_space(pdf, 22)
        heading = FontFace(emphasis="BOLD", size_pt=8, color=WHITE, fill_color=ACCENT)
        with pdf.table(
            width=pdf.epw,
            col_widths=widths,
            text_align=aligns,
            line_height=5.2,
            borders_layout="HORIZONTAL_LINES",
            cell_fill_mode=TableCellFillMode.ROWS,
            cell_fill_color=SURFACE,
            first_row_as_headings=True,
            headings_style=heading,
        ) as table:
            head = table.row()
            for label in headers:
                head.cell(label)
            pdf.set_text_color(*INK)
            idx = start_index
            for item in rows:
                if item.get("item_type") == "note":
                    note = table.row()
                    body = _txt(item.get("description") or item.get("name")) or "—"
                    note.cell(f"הערה: {body}", colspan=len(headers))
                    continue
                idx += 1
                cell_desc = _line_description(item)
                sku_cell = _sku_ltr(item.get("sku")) if _txt(item.get("sku")) else "—"
                _font(pdf, size=8.5)
                row = table.row()
                if show_discount:
                    disc = item.get("discount")
                    disc_s = _qty(disc) if float(disc or 0) else "—"
                    row.cell(_money_cell(item.get("line_net"), currency))
                    row.cell(disc_s)
                    row.cell(_money_cell(item.get("unit_price"), currency))
                    row.cell(_qty(item.get("qty")))
                    row.cell(cell_desc)
                    row.cell(sku_cell)
                    row.cell(_ltr(idx))
                else:
                    row.cell(_money_cell(item.get("line_net"), currency))
                    row.cell(_money_cell(item.get("unit_price"), currency))
                    row.cell(_qty(item.get("qty")))
                    row.cell(cell_desc)
                    row.cell(sku_cell)
                    row.cell(_ltr(idx))
            return idx

    line_no = 0
    ordered_sections = sorted(
        sections.values(),
        key=lambda s: (s.get("sort_order") is None, s.get("sort_order") or 0),
    )
    for section in ordered_sections:
        items = by_section.get(section["id"]) or []
        if not items and not section.get("name"):
            continue
        _ensure_space(pdf, 14)
        pdf.set_text_color(*ACCENT)
        _right_text(pdf, _txt(section.get("name")) or "סעיף", size=9.5, bold=True, h=5)
        pdf.set_text_color(*INK)
        line_no = emit_table(items, start_index=line_no)
        pdf.ln(0.5)
    if loose:
        line_no = emit_table(loose, start_index=line_no)

    # ── Totals ──────────────────────────────────────────────────
    _ensure_space(pdf, 38)
    pdf.ln(2)
    box_w = min(86.0, pdf.epw * 0.52)
    box_x = pdf.l_margin + pdf.epw - box_w
    y = pdf.get_y()
    rows_data: list[tuple[str, str, bool]] = [
        ("לפני מע״מ", _money(document.get("subtotal_net"), currency), False),
    ]
    disc = document.get("discount_value")
    if disc:
        dtype = document.get("discount_type")
        dlabel = f"{_ltr(disc)}%" if dtype == "percent" else _money(disc, currency)
        rows_data.append(("הנחה", dlabel, False))
    vat_pct = document.get("vat_percent")
    vat_label = f"מע״מ {_ltr(vat_pct)}%" if vat_pct is not None else "מע״מ"
    rows_data.append((vat_label, _money(document.get("vat_amount"), currency), False))
    rows_data.append(("סה״כ לתשלום", _money(document.get("total_gross"), currency), True))

    box_h = 7 + len(rows_data) * 6.8 + 3
    pdf.set_fill_color(*SURFACE)
    pdf.set_draw_color(*ACCENT)
    pdf.set_line_width(0.45)
    pdf.rect(box_x, y, box_w, box_h, style="FD")

    cy = y + 3.5
    for label, value, emphasize in rows_data:
        if emphasize:
            pdf.set_fill_color(*TOTAL_BG)
            pdf.rect(box_x, cy - 1, box_w, 8.5, style="F")
            pdf.set_text_color(*WHITE)
            _font(pdf, size=11, bold=True)
        else:
            pdf.set_text_color(*INK)
            _font(pdf, size=9, bold=False)
        pdf.set_xy(box_x + 2, cy)
        pdf.cell(box_w * 0.48, 5.5, text=label, align="R")
        pdf.set_xy(box_x + box_w * 0.48, cy)
        pdf.cell(box_w * 0.48, 5.5, text=value, align="L")
        cy += 6.5 if not emphasize else 7.5
    pdf.set_y(y + box_h + 3)
    pdf.set_text_color(*INK)

    # ── Terms (cards) + smart page break ────────────────────────
    terms_blocks: list[tuple[str, object]] = [
        ("תנאי תשלום", document.get("payment_terms")),
        ("אחריות", document.get("warranty")),
        ("תנאים כלליים", document.get("general_terms")),
        ("הערות", document.get("customer_notes")),
    ]
    terms_blocks = [(t, b) for t, b in terms_blocks if _txt(b)]

    approved_at = document.get("approved_at")
    approved_name = _txt(document.get("approved_name"))
    is_approved = bool(approved_at and approved_name)

    # Rough remaining: prefer keeping terms+approval together on one page when possible.
    remaining = pdf.page_break_trigger - pdf.get_y()
    approx_terms = sum(12 + max(1, _txt(b).count("\n") + 1) * 5 for _, b in terms_blocks)
    approx_approval = 36 if is_approved else 28
    if terms_blocks and remaining < approx_terms + approx_approval - 8:
        # Intentional terms page rather than orphan strip
        pdf.add_page()
        pdf.set_text_color(*ACCENT)
        _font(pdf, size=14, bold=True)
        pdf.multi_cell(pdf.epw, 7, text="תנאים ואישור", align="R")
        pdf.set_text_color(*MUTED)
        _font(pdf, size=9)
        pdf.multi_cell(pdf.epw, 5, text=f"הצעת מחיר {_ltr(f'#{number}')}", align="R")
        pdf.ln(2)

    for title_t, body in terms_blocks:
        _card(pdf, title_t, _txt(body))

    # ── Approval ────────────────────────────────────────────────
    _ensure_space(pdf, 32)
    signature = document.get("signature") if isinstance(document.get("signature"), dict) else {}
    if is_approved:
        y0 = pdf.get_y()
        pdf.set_fill_color(*SUCCESS_SOFT)
        pdf.set_draw_color(*SUCCESS)
        pdf.set_line_width(0.45)
        pdf.rect(pdf.l_margin, y0, pdf.epw, 28, style="FD")
        pdf.set_xy(pdf.l_margin + 3, y0 + 3)
        pdf.set_text_color(*SUCCESS)
        _font(pdf, size=11, bold=True)
        pdf.cell(pdf.epw - 6, 6, text="הצעה מאושרת דיגיטלית ✓", align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_text_color(*INK)
        _font(pdf, size=9.5)
        pdf.set_x(pdf.l_margin + 3)
        pdf.cell(pdf.epw - 6, 5, text=f"אושרה על ידי: {approved_name}", align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_x(pdf.l_margin + 3)
        pdf.set_text_color(*MUTED)
        pdf.cell(
            pdf.epw - 6,
            5,
            text=f"תאריך אישור: {_date_he(approved_at)}  ·  חתימה דיגיטלית: ✓",
            align="R",
            new_x=XPos.LMARGIN,
            new_y=YPos.NEXT,
        )
        pdf.set_y(y0 + 30)
    else:
        _section_label(pdf, _txt(signature.get("title")) or "אישור ההצעה")
        pdf.set_text_color(*MUTED)
        _right_text(
            pdf,
            "האישור הרשמי מתבצע בקישור המאובטח ללקוח (חתימה דיגיטלית).",
            size=8.5,
            h=4.5,
        )
        consent = _txt(signature.get("consent_he") or signature.get("consent_text"))
        if consent:
            _right_text(pdf, consent, size=8, h=4.2)
        # Compact physical fallback only
        pdf.ln(3)
        pdf.set_text_color(*INK)
        _font(pdf, size=8.5)
        field_w = pdf.epw / 3
        y = pdf.get_y()
        for i, label in enumerate(
            ("תאריך: ______________", "חתימה: ______________", "שם מלא: ______________")
        ):
            pdf.set_xy(pdf.l_margin + i * field_w, y)
            pdf.cell(field_w - 2, 5, text=label, align="R")
        pdf.set_y(y + 8)

    buf = BytesIO()
    pdf.output(buf)
    return buf.getvalue(), _filename(number)
