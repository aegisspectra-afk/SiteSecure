"""Static Aegis product registry — product id ≠ entitlement feature key.

Phase A2: code-only registry (no DB table). Availability is computed server-side
from existing my_workspace_entitlements features + role grants.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

# Site Secure domain features (locked / non-toggleable in product_entitlements).
# Verified in supabase/migrations/0008_features_plans.sql and LOCKED_FEATURES.
SITE_SECURE_FEATURES: frozenset[str] = frozenset(
    {
        "core",
        "crm",
        "sales",
        "catalog",
        "quotes",
        "projects",
        "service",
        "settings",
    }
)

# Entry permissions used by SS surfaces (dashboard/today + module homes).
# Catalog grants (read-only): owner=*; administrator/manager/sales/technician/viewer
# all include dashboard.view; technician also has crm.view, projects.view, service.view, jobs.view.
# Require any of these so we do not rely on a single permission in isolation.
SITE_SECURE_ENTRY_PERMISSIONS: frozenset[str] = frozenset(
    {
        "dashboard.view",
        "crm.view",
        "projects.view",
        "jobs.view",
        "service.view",
        "quotes.view",
        "catalog.view",
        "sites.view",
    }
)

ProductStatus = Literal["active", "preview", "disabled"]


@dataclass(frozen=True)
class ProductDef:
    id: str
    title_he: str
    description_he: str
    status: ProductStatus
    # None = Site Secure composite rule; otherwise single feature key.
    entitlement_feature: str | None
    required_permissions: frozenset[str]


PRODUCT_REGISTRY: tuple[ProductDef, ...] = (
    ProductDef(
        id="site_secure",
        title_he="Site Secure",
        description_he="CRM, לקוחות, הצעות מחיר, פרויקטים, התקנות ושירות",
        status="active",
        entitlement_feature=None,
        required_permissions=SITE_SECURE_ENTRY_PERMISSIONS,
    ),
    ProductDef(
        id="ssp",
        title_he="Aegis SSP",
        description_he="סיורים, נקודות ביקורת, דיווחי אירועים ובקרה",
        status="active",
        entitlement_feature="ssp",
        required_permissions=frozenset({"ssp.forms.view"}),
    ),
    ProductDef(
        id="fleet",
        title_he="Aegis FLEET",
        description_he="כלי רכב, תחזוקה, תקלות, שימוש וניהול צי",
        status="active",
        entitlement_feature="fleet",
        required_permissions=frozenset({"fleet.view"}),
    ),
    ProductDef(
        id="workforce",
        title_he="Workforce Intelligence",
        description_he="כוח אדם, סידורי עבודה ושיבוץ",
        status="active",
        entitlement_feature="workforce",
        required_permissions=frozenset({"workforce.view", "workforce.portal.view"}),
    ),
)


def _perm_ok(permissions: frozenset[str], required: frozenset[str]) -> bool:
    if "*" in permissions:
        return True
    return bool(permissions & required)


def _feature_ok(features: frozenset[str], product: ProductDef) -> bool:
    if product.entitlement_feature is None:
        return bool(features & SITE_SECURE_FEATURES)
    return product.entitlement_feature in features


def site_secure_entry_path(role_key: str) -> str:
    """Mirror apps/web homeVariant: technician → /app/today; others → /app/dashboard."""
    if role_key == "technician":
        return "/app/today"
    return "/app/dashboard"


def workforce_entry_path(role_key: str) -> str:
    return "/app/workforce"


def product_entry_path(product_id: str, role_key: str) -> str | None:
    if product_id == "site_secure":
        return site_secure_entry_path(role_key)
    if product_id == "ssp":
        return "/app/ssp"
    if product_id == "fleet":
        return "/app/fleet"
    if product_id == "workforce":
        return workforce_entry_path(role_key)
    return None


def resolve_available_products(
    *,
    features: frozenset[str] | set[str],
    permissions: frozenset[str] | set[str],
    role_key: str,
) -> list[dict[str, Any]]:
    """Return only products the user may open — never list unauthorized products."""
    feat = frozenset(features)
    perms = frozenset(permissions)
    out: list[dict[str, Any]] = []
    for product in PRODUCT_REGISTRY:
        if product.status == "disabled":
            continue
        if not _feature_ok(feat, product):
            continue
        if not _perm_ok(perms, product.required_permissions):
            continue
        entry = product_entry_path(product.id, role_key)
        if not entry:
            continue
        out.append(
            {
                "id": product.id,
                "title": product.title_he,
                "description": product.description_he,
                "status": product.status,
                "entry_path": entry,
            }
        )
    return out
