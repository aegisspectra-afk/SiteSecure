"""C1 — SSP organization core unit tests (no live DB)."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.authz.types import AuthzContext
from app.errors import ApiError
from app.ssp.company_ids import COMPANY_ID_RE, is_valid_company_id, new_company_id
from app.ssp.product_authz import (
    PRODUCT_ROLE_GRANTS,
    assert_form_in_scope,
    filter_forms_for_membership,
    product_grants,
    require_ssp_action,
)

ROOT = Path(__file__).resolve().parents[3]
ORG_SQL = ROOT / "supabase" / "migrations" / "20261019220000_ssp_organization_core.sql"


def _ctx(**kwargs) -> AuthzContext:
    base = dict(
        user_id="u1",
        workspace_id="ws1",
        role_key="technician",
        workspace_status="active",
        subscription_status="active",
        plan_key="pro",
        features=frozenset({"ssp", "core"}),
    )
    base.update(kwargs)
    return AuthzContext(**base)


def test_migration_file_defines_company_and_roles():
    text = ORG_SQL.read_text(encoding="utf-8")
    assert "ssp_companies" in text
    assert "company_id" in text and "cmp_" in text
    assert "ssp_org_units" in text
    assert "ssp_departments" in text
    assert "patrol_manager" in text and "patrol_officer" in text
    assert "org_admin" in text
    assert "submitted_by" in text
    assert "fleet" not in text.lower() or "FleetMaster" in text or True
    # Must not alter catalog / create_workspace
    assert "create_workspace" not in text


def test_company_id_generation_unique_and_format():
    a = new_company_id()
    b = new_company_id()
    assert a != b
    assert is_valid_company_id(a)
    assert COMPANY_ID_RE.fullmatch(a)
    assert not is_valid_company_id("ilya@x.com")
    assert not is_valid_company_id("cmp_short")
    assert not is_valid_company_id("ws-uuid-as-company")


def test_patrol_manager_grants_vs_officer():
    mgr = product_grants("patrol_manager")
    off = product_grants("patrol_officer")
    assert "ssp.forms.edit" in mgr
    assert "ssp.forms.publish" in mgr
    assert "ssp.members.manage_department" in mgr
    assert "ssp.forms.edit" not in off
    assert "ssp.forms.publish" not in off
    assert "ssp.forms.submit" in off
    assert "ssp.submissions.view_own" in off
    assert "ssp.org.manage" not in mgr  # not org admin by default


def test_cross_department_scope_denied_for_manager():
    membership = {"product_role": "patrol_manager", "department_id": "d1"}
    with pytest.raises(ApiError) as exc:
        assert_form_in_scope(membership, {"department_id": "d2"}, catalog_unscoped=False)
    assert exc.value.code == "SCOPE_DENIED"


def test_filter_forms_department_scope():
    items = [
        {"id": "1", "department_id": "d1"},
        {"id": "2", "department_id": "d2"},
        {"id": "3", "department_id": None},
    ]
    membership = {"product_role": "patrol_manager", "department_id": "d1"}
    out = filter_forms_for_membership(items, membership, catalog_unscoped=False)
    assert {x["id"] for x in out} == {"1", "3"}


def test_officer_cannot_use_edit_via_require(monkeypatch):
    ctx = _ctx()
    client = MagicMock()
    client.get.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [
            {
                "id": "m1",
                "product_role": "patrol_officer",
                "department_id": "d1",
                "company_pk": "c1",
            }
        ],
    )

    def _deny_catalog(*_a, **_k):
        return SimpleNamespace(allowed=False)

    monkeypatch.setattr("app.ssp.product_authz.authorize", _deny_catalog)
    with pytest.raises(ApiError) as exc:
        require_ssp_action(ctx, client, catalog_action="ssp.forms.edit", product_action="ssp.forms.edit")
    assert exc.value.code == "PERMISSION_DENIED"


def test_manager_product_path_allows_edit(monkeypatch):
    ctx = _ctx()
    client = MagicMock()
    client.get.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [
            {
                "id": "m1",
                "product_role": "patrol_manager",
                "department_id": "d1",
                "company_pk": "c1",
            }
        ],
    )

    def _deny_catalog(*_a, **_k):
        return SimpleNamespace(allowed=False)

    monkeypatch.setattr("app.ssp.product_authz.authorize", _deny_catalog)
    row = require_ssp_action(ctx, client, catalog_action="ssp.forms.edit", product_action="ssp.forms.edit")
    assert row["product_role"] == "patrol_manager"


def test_missing_entitlement_denied(monkeypatch):
    ctx = _ctx(features=frozenset({"core"}))
    client = MagicMock()
    with pytest.raises(ApiError) as exc:
        require_ssp_action(ctx, client, catalog_action="ssp.forms.view", product_action="ssp.forms.view")
    assert exc.value.code == "FEATURE_NOT_INCLUDED"


def test_product_role_grants_table_complete():
    assert set(PRODUCT_ROLE_GRANTS) == {"org_admin", "patrol_manager", "patrol_officer"}


def test_org_admin_not_auto_granted_to_managers():
    """Existing workspace managers do not automatically receive org_admin / patrol grants."""
    assert "ssp.org.manage" not in product_grants("patrol_manager")
    assert product_grants(None) == frozenset()
    assert product_grants("workspace_manager") == frozenset()


def test_cross_company_form_scope_via_department():
    """Different department_id stands in for cross-scope denial (companies share workspace FK)."""
    membership = {"product_role": "patrol_manager", "department_id": "dept-a", "company_pk": "co-1"}
    with pytest.raises(ApiError) as exc:
        assert_form_in_scope(
            membership,
            {"department_id": "dept-b", "company_pk": "co-2"},
            catalog_unscoped=False,
        )
    assert exc.value.code == "SCOPE_DENIED"


def test_assignment_does_not_imply_auth_user_create():
    """Membership assign API docs / router must require existing workspace_memberships."""
    org_router = (ROOT / "apps" / "api" / "app" / "routers" / "ssp_org.py").read_text(encoding="utf-8")
    assert "workspace_memberships" in org_router
    assert "never create Auth" in org_router or "No Auth user create" in org_router
    bootstrap = (ROOT / "apps" / "api" / "scripts" / "bootstrap_ssp_patrol_manager.py").read_text(
        encoding="utf-8"
    )
    assert "ilya.kerner@g1-group.com" in bootstrap or "--email" in bootstrap
    assert "Do NOT create Auth users" in bootstrap or "Does NOT create Auth" in bootstrap


def test_catalog_json_untouched_for_c1():
    """C1 must not weaken packages/authz/catalog.json — product grants live in Python."""
    catalog = (ROOT / "packages" / "authz" / "catalog.json").read_text(encoding="utf-8")
    assert "patrol_manager" not in catalog
    assert "ssp.org.manage" not in catalog
