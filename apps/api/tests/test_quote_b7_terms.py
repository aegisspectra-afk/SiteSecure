"""B7 — workspace terms defaults and template term merge."""

from app.quote_terms_defaults import (
    BUILTIN_TERMS_TEMPLATES,
    MAINTENANCE_ANNUAL_TEMPLATE_KEY,
    apply_template_terms_to_quote,
    apply_workspace_terms_to_create,
    merge_workspace_quote_terms_defaults,
)
from app.quote_workspace_defaults import apply_quote_create_defaults


def test_workspace_terms_applied_on_create():
    payload = {"title": "חדש"}
    apply_quote_create_defaults(
        payload,
        quotes_cfg={
            "validity_days": 0,
            "payment_terms": "שוטף + 30",
            "warranty": "אחריות 12 חודשים",
            "general_terms": "תנאים כלליים",
            "customer_notes": "הערה ללקוח",
        },
        timezone_name="Asia/Jerusalem",
    )
    assert payload["payment_terms"] == "שוטף + 30"
    assert payload["warranty"] == "אחריות 12 חודשים"
    assert payload["general_terms"] == "תנאים כלליים"
    assert payload["customer_notes"] == "הערה ללקוח"


def test_explicit_quote_terms_not_overwritten():
    payload = {
        "payment_terms": "מזומן",
        "warranty": "מותאם",
    }
    apply_workspace_terms_to_create(
        payload,
        {"payment_terms": "שוטף", "warranty": "ברירה", "general_terms": "כללי"},
    )
    assert payload["payment_terms"] == "מזומן"
    assert payload["warranty"] == "מותאם"
    assert payload["general_terms"] == "כללי"


def test_builtin_library_when_workspace_missing_templates():
    merged = merge_workspace_quote_terms_defaults({})
    assert len(merged["terms_templates"]) == len(BUILTIN_TERMS_TEMPLATES)
    assert merged["warranty"]
    assert merged["general_terms"]


def test_apply_template_terms_only_fills_empty_quote_fields():
    quote = {"payment_terms": "קיים", "warranty": ""}
    template = {
        "default_payment_terms": "מתבנית",
        "default_warranty": "אחריות מתבנית",
        "default_general_terms": "כללי מתבנית",
    }
    patch = apply_template_terms_to_quote(quote, template)
    assert "payment_terms" not in patch
    assert patch["warranty"] == "אחריות מתבנית"
    assert patch["general_terms"] == "כללי מתבנית"


def test_maintenance_template_key_constant():
    assert MAINTENANCE_ANNUAL_TEMPLATE_KEY == "maintenance_annual"