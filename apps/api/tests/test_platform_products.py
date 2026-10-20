"""Unit: Aegis product registry resolution (no DB)."""

from __future__ import annotations

from app.platform_products import (
    resolve_available_products,
    site_secure_entry_path,
)


def test_site_secure_entry_respects_home_variant():
    assert site_secure_entry_path("technician") == "/app/today"
    assert site_secure_entry_path("owner") == "/app/dashboard"
    assert site_secure_entry_path("administrator") == "/app/dashboard"
    assert site_secure_entry_path("viewer") == "/app/dashboard"


def test_owner_with_ss_features_gets_site_secure_only():
    products = resolve_available_products(
        features={"core", "crm", "quotes", "settings"},
        permissions={"*"},
        role_key="owner",
    )
    ids = {p["id"] for p in products}
    assert ids == {"site_secure"}
    assert products[0]["entry_path"] == "/app/dashboard"


def test_technician_entry_is_today():
    products = resolve_available_products(
        features={"core", "crm", "projects", "service"},
        permissions={"dashboard.view", "crm.view", "projects.view", "service.view", "jobs.view"},
        role_key="technician",
    )
    assert len(products) == 1
    assert products[0]["id"] == "site_secure"
    assert products[0]["entry_path"] == "/app/today"


def test_technician_without_ss_features_omits_site_secure():
    products = resolve_available_products(
        features={"fleet"},
        permissions={"dashboard.view", "fleet.view"},
        role_key="technician",
    )
    ids = {p["id"] for p in products}
    assert "site_secure" not in ids
    assert ids == {"fleet"}


def test_ssp_requires_feature_and_permission():
    with_feature_only = resolve_available_products(
        features={"core", "crm", "ssp"},
        permissions={"dashboard.view", "crm.view"},
        role_key="technician",
    )
    assert "ssp" not in {p["id"] for p in with_feature_only}

    with_both = resolve_available_products(
        features={"core", "crm", "ssp"},
        permissions={"dashboard.view", "crm.view", "ssp.forms.view"},
        role_key="viewer",
    )
    ids = {p["id"] for p in with_both}
    assert "ssp" in ids
    assert "site_secure" in ids


def test_fleet_requires_feature_and_permission():
    products = resolve_available_products(
        features={"core", "crm", "fleet"},
        permissions={"dashboard.view", "crm.view", "fleet.view"},
        role_key="technician",
    )
    ids = {p["id"] for p in products}
    assert ids == {"site_secure", "fleet"}


def test_workforce_requires_feature_and_permission():
    missing_perm = resolve_available_products(
        features={"core", "crm", "workforce"},
        permissions={"dashboard.view", "crm.view"},
        role_key="viewer",
    )
    assert "workforce" not in {p["id"] for p in missing_perm}

    with_both = resolve_available_products(
        features={"core", "crm", "workforce"},
        permissions={"dashboard.view", "crm.view", "workforce.view"},
        role_key="administrator",
    )
    ids = {p["id"] for p in with_both}
    assert "workforce" in ids
    assert any(p["id"] == "workforce" and p["entry_path"] == "/app/workforce" for p in with_both)


def test_unauthorized_products_omitted_not_flagged():
    products = resolve_available_products(
        features={"core"},
        permissions={"dashboard.view"},
        role_key="viewer",
    )
    blob = str(products)
    assert "ssp" not in blob
    assert "fleet" not in blob
    assert "workforce" not in blob
