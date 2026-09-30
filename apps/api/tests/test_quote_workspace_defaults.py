"""SETTINGS-3B — workspace quote defaults (validity, payment terms, show VAT)."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.quote_workspace_defaults import (
    apply_quote_create_defaults,
    merge_quote_pdf_template_defaults,
    workspace_local_today,
)


def test_validity_default_applied_when_unset():
    today = workspace_local_today("Asia/Jerusalem")
    payload = {"title": "x"}
    apply_quote_create_defaults(
        payload,
        quotes_cfg={"validity_days": 14},
        timezone_name="Asia/Jerusalem",
    )
    assert payload["valid_until"] == (today + timedelta(days=14)).isoformat()


def test_validity_not_applied_when_zero_or_missing():
    payload = {"title": "x"}
    apply_quote_create_defaults(payload, quotes_cfg={}, timezone_name="Asia/Jerusalem")
    assert "valid_until" not in payload

    payload2 = {"title": "x"}
    apply_quote_create_defaults(payload2, quotes_cfg={"validity_days": 0}, timezone_name="Asia/Jerusalem")
    assert "valid_until" not in payload2


def test_validity_preserves_explicit_value():
    payload = {"valid_until": "2030-01-15"}
    apply_quote_create_defaults(
        payload,
        quotes_cfg={"validity_days": 30},
        timezone_name="Asia/Jerusalem",
    )
    assert payload["valid_until"] == "2030-01-15"


def test_payment_terms_default_when_empty():
    payload = {"payment_terms": ""}
    apply_quote_create_defaults(
        payload,
        quotes_cfg={"payment_terms": "שוטף + 30"},
        timezone_name="Asia/Jerusalem",
    )
    assert payload["payment_terms"] == "שוטף + 30"

    payload2 = {"payment_terms": "מקדמה 50%"}
    apply_quote_create_defaults(
        payload2,
        quotes_cfg={"payment_terms": "שוטף + 30"},
        timezone_name="Asia/Jerusalem",
    )
    assert payload2["payment_terms"] == "מקדמה 50%"


def test_payment_terms_precedence_quote_over_workspace_over_template():
    """PDF merge: template paymentTerms filled from workspace only when template lacks it."""
    tpl = {"id": "t1"}
    merge_quote_pdf_template_defaults(
        tpl,
        quotes_cfg={"payment_terms": "workspace terms"},
        config={},
    )
    assert tpl["paymentTerms"] == "workspace terms"

    tpl2 = {"id": "t2", "paymentTerms": "template terms"}
    merge_quote_pdf_template_defaults(
        tpl2,
        quotes_cfg={"payment_terms": "workspace terms"},
        config={"paymentTerms": "template terms"},
    )
    assert tpl2["paymentTerms"] == "template terms"


def test_show_vat_merged_when_template_unset():
    tpl = {"id": "t1"}
    merge_quote_pdf_template_defaults(
        tpl,
        quotes_cfg={"show_vat": False},
        config={},
    )
    assert tpl["showVat"] is False

    tpl2 = {"id": "t2", "showVat": True}
    merge_quote_pdf_template_defaults(
        tpl2,
        quotes_cfg={"show_vat": False},
        config={"showVat": True},
    )
    assert tpl2["showVat"] is True


def test_show_vat_not_invented_when_key_absent_from_workspace():
    tpl = {"id": "t1"}
    merge_quote_pdf_template_defaults(tpl, quotes_cfg={}, config={})
    assert "showVat" not in tpl


def test_timezone_jerusalem_date_boundary():
    today = workspace_local_today("Asia/Jerusalem")
    expected = datetime.now(ZoneInfo("Asia/Jerusalem")).date()
    assert today == expected
