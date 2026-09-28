from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from app.authz.engine import authorize
from app.authz.types import AuthzContext
from app.portal_access import (
    FORBIDDEN_PORTAL_KEYS,
    document_visible,
    portal_ui_status,
    project_equipment,
    project_profile,
    project_quote,
    project_site,
    project_warranty,
)


def _ctx(role: str) -> AuthzContext:
    from app.authz.catalog import load_catalog

    catalog = load_catalog()
    return AuthzContext(
        user_id="user-1",
        workspace_id="ws-1",
        role_key=role,
        workspace_status="active",
        subscription_status="active",
        plan_key="business",
        features=catalog["_plan_features"]["business"],
        grants=catalog["_grants"][role],
    )


def test_portal_permissions_follow_role_matrix():
    owner = authorize(ctx=_ctx("owner"), action="customer_portal.revoke")
    manager = authorize(ctx=_ctx("manager"), action="customer_portal.create")
    sales_view = authorize(ctx=_ctx("sales"), action="customer_portal.view")
    sales_create = authorize(ctx=_ctx("sales"), action="customer_portal.create")
    tech_view = authorize(ctx=_ctx("technician"), action="customer_portal.view")
    tech_create = authorize(ctx=_ctx("technician"), action="customer_portal.create")
    tech_revoke = authorize(ctx=_ctx("technician"), action="customer_portal.revoke")
    viewer = authorize(ctx=_ctx("viewer"), action="customer_portal.view")
    assert owner.allowed and manager.allowed and sales_view.allowed and tech_view.allowed
    assert sales_create.allowed is False
    assert tech_create.allowed is False
    assert tech_revoke.allowed is False
    assert viewer.allowed is False


def test_portal_status_lifecycle():
    now = datetime(2026, 9, 26, tzinfo=UTC)
    assert portal_ui_status(None, None, now=now) == "not_enabled"
    invited = {"status": "invited"}
    fresh = {"expires_at": (now + timedelta(days=1)).isoformat(), "consumed_at": None, "revoked_at": None}
    stale = {"expires_at": (now - timedelta(minutes=1)).isoformat(), "consumed_at": None, "revoked_at": None}
    assert portal_ui_status(invited, fresh, now=now) == "invited"
    assert portal_ui_status(invited, stale, now=now) == "expired"
    assert portal_ui_status({"status": "active"}, None, now=now) == "active"
    assert portal_ui_status({"status": "revoked"}, fresh, now=now) == "revoked"


def test_projections_drop_internal_fields():
    site = project_site(
        {
            "id": "s1",
            "name": "בית",
            "code": "AS-S-00001",
            "installation_status": "completed",
            "address": {"city": "תל אביב", "notes": "קוד שער 1234"},
            "access_notes": "secret",
            "public_token": "tok",
        }
    )
    equipment = project_equipment(
        {
            "id": "e1",
            "site_id": "s1",
            "name": "מצלמה",
            "category": "camera",
            "serial": "SN1",
            "status": "installed",
            "ip": "10.0.0.8",
            "mac": "aa:bb",
            "location_note": "ארון תקשורת",
        }
    )
    quote = project_quote(
        {
            "id": "q1",
            "number": "Q-1",
            "status": "sent",
            "total_gross": 100,
            "cost_total": 40,
            "margin_amount": 60,
            "internal_notes": "ספק",
        }
    )
    draft = project_quote({"id": "q2", "number": "Q-2", "status": "draft", "total_gross": 10, "cost_total": 1})
    profile = project_profile(
        {"display_name": "כהן", "type": "private", "phone": "050", "notes": "פנימי", "tax_id": "123"},
        "a@example.com",
    )
    warranty = project_warranty(
        {"id": "w1", "number": "W-1", "type": "installation", "status": "active", "public_token": "sek"}
    )
    blob = {"site": site, "equipment": equipment, "quote": quote, "profile": profile, "warranty": warranty}
    assert draft == {}
    assert site["address"] == {"city": "תל אביב"}
    assert "ip" not in equipment
    assert quote["total_gross"] == 100
    assert "cost_total" not in quote
    assert profile["email"] == "a@example.com"
    assert "tax_id" not in profile
    assert "public_token" not in warranty

    def walk(value):
        if isinstance(value, dict):
            assert FORBIDDEN_PORTAL_KEYS.isdisjoint(value)
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)

    walk(blob)


def test_document_visibility_is_explicit():
    customer = "c1"
    ids = {
        "customer_id": customer,
        "site_ids": {"s1"},
        "job_ids": {"j1"},
        "quote_ids": {"q1"},
        "warranty_ids": set(),
        "project_ids": set(),
        "system_ids": set(),
    }
    visible = {
        "visibility": "customer",
        "kind": "document",
        "storage_bucket": "documents",
        "entity_type": "site",
        "entity_id": "s1",
    }
    internal = {**visible, "visibility": "internal"}
    other_site = {**visible, "entity_id": "s2"}
    signature = {**visible, "kind": "signature", "storage_bucket": "signatures"}
    assert document_visible(visible, **ids) is True
    assert document_visible(internal, **ids) is False
    assert document_visible(other_site, **ids) is False
    assert document_visible(signature, **ids) is False


def test_accept_sql_does_not_create_membership():
    migration = Path(__file__).resolve().parents[3] / "supabase/migrations/20260926213103_customer_portal_foundation.sql"
    text = migration.read_text(encoding="utf-8")
    start = text.index("FUNCTION public.accept_customer_portal_invite")
    end = text.index("REVOKE ALL ON FUNCTION public.peek_customer_portal_invite")
    body = text[start:end]
    assert "INSERT INTO public.workspace_memberships" not in body
    assert "last_workspace_id" not in body
    assert "REVOKE ALL ON TABLE public.customer_portal_access FROM PUBLIC, anon, authenticated" in text
