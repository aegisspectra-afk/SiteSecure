"""Apply workspace quote defaults when creating quotes / merging PDF template config."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo


def workspace_local_today(timezone_name: str | None) -> date:
    name = (timezone_name or "Asia/Jerusalem").strip() or "Asia/Jerusalem"
    try:
        tz = ZoneInfo(name)
    except Exception:
        tz = ZoneInfo("Asia/Jerusalem")
    return datetime.now(tz).date()


def apply_quote_create_defaults(
    payload: dict,
    *,
    quotes_cfg: dict | None,
    timezone_name: str | None,
) -> dict:
    """
    Mutate a create-quote payload with workspace defaults when fields are unset.

    Precedence for payment_terms later in PDF:
      quote.payment_terms > workspace quotes.payment_terms > template paymentTerms
    """
    cfg = quotes_cfg if isinstance(quotes_cfg, dict) else {}

    if payload.get("valid_until") in (None, ""):
        raw_days = cfg.get("validity_days")
        try:
            days = int(raw_days) if raw_days is not None else 0
        except (TypeError, ValueError):
            days = 0
        if days > 0:
            payload["valid_until"] = (workspace_local_today(timezone_name) + timedelta(days=days)).isoformat()

    if not str(payload.get("payment_terms") or "").strip():
        terms = cfg.get("payment_terms")
        if isinstance(terms, str) and terms.strip():
            payload["payment_terms"] = terms.strip()

    return payload


def merge_quote_pdf_template_defaults(
    pdf_template: dict,
    *,
    quotes_cfg: dict | None,
    config: dict | None,
) -> dict:
    """Fill missing PDF template presentation keys from workspace quote settings."""
    cfg = quotes_cfg if isinstance(quotes_cfg, dict) else {}
    conf = config if isinstance(config, dict) else {}

    if cfg.get("pdf_notes") and not conf.get("notes"):
        pdf_template["notes"] = cfg.get("pdf_notes")
    if cfg.get("payment_terms") and not conf.get("paymentTerms"):
        pdf_template["paymentTerms"] = cfg.get("payment_terms")
    # Presentation only — do not invent showVat when template already sets it.
    if "showVat" not in conf and "show_vat" in cfg:
        pdf_template["showVat"] = bool(cfg.get("show_vat"))

    return pdf_template
