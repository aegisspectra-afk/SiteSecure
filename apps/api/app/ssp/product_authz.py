"""SSP product-role authorization (parallel to workspace catalog grants).

Does not modify packages/authz/catalog.json. Workspace role grants for SSP
actions remain valid (legacy Site Secure behavior). Product roles add a second
path for Patrol Manager / Officer without changing platform role_key.
"""

from __future__ import annotations

from typing import Any

from ..authz.engine import authorize
from ..authz.types import AuthzContext
from ..errors import ApiError, MESSAGES
from ..supabase_user import UserClient

PRODUCT_ROLES = frozenset({"org_admin", "patrol_manager", "patrol_officer"})

# Product-specific actions (not necessarily in catalog.json).
# Operational + forms grants for the unified SSP product (not catalog.json).
_OPS_MANAGER = frozenset(
    {
        "ssp.dashboard.view",
        "ssp.officers.view",
        "ssp.patrols.view",
        "ssp.patrols.edit",
        "ssp.checkpoints.view",
        "ssp.checkpoints.edit",
        "ssp.scans.view",
        "ssp.events.view",
        "ssp.events.edit",
        "ssp.distributions.view",
        "ssp.distributions.manage",
    }
)
_OPS_OFFICER = frozenset(
    {
        "ssp.dashboard.view",
        "ssp.patrols.view",
        "ssp.checkpoints.view",
        "ssp.scans.create",
        "ssp.events.view",
        "ssp.events.create",
        "ssp.distributions.view",
    }
)

PRODUCT_ROLE_GRANTS: dict[str, frozenset[str]] = {
    "org_admin": frozenset(
        {
            "ssp.org.view",
            "ssp.org.manage",
            "ssp.members.view",
            "ssp.members.manage",
            "ssp.forms.view",
            "ssp.forms.edit",
            "ssp.forms.publish",
            "ssp.assignments.manage",
            "ssp.submissions.view",
            "ssp.forms.submit",
            "ssp.settings.view",
            "ssp.sites.view",
            "ssp.sites.edit",
            *_OPS_MANAGER,
            "ssp.scans.create",
            "ssp.events.create",
        }
    ),
    "patrol_manager": frozenset(
        {
            "ssp.org.view",
            "ssp.members.view",
            "ssp.members.manage_department",
            "ssp.forms.view",
            "ssp.forms.edit",
            "ssp.forms.publish",
            "ssp.assignments.manage",
            "ssp.submissions.view",
            "ssp.sites.view",
            "ssp.sites.edit",
            *_OPS_MANAGER,
            "ssp.scans.create",
            "ssp.events.create",
        }
    ),
    "patrol_officer": frozenset(
        {
            "ssp.org.view",
            "ssp.forms.view",
            "ssp.forms.submit",
            "ssp.submissions.view_own",
            "ssp.sites.view",
            *_OPS_OFFICER,
        }
    ),
}

# Map catalog SSP actions → product grant keys used above.
CATALOG_TO_PRODUCT = {
    "ssp.forms.view": "ssp.forms.view",
    "ssp.forms.edit": "ssp.forms.edit",
    "ssp.forms.publish": "ssp.forms.publish",
    "ssp.assignments.manage": "ssp.assignments.manage",
    "ssp.submissions.view": "ssp.submissions.view",
}


def feature_gate(ctx: AuthzContext) -> None:
    if "ssp" not in ctx.features:
        raise ApiError(403, "FEATURE_NOT_INCLUDED", MESSAGES["FEATURE_NOT_INCLUDED"], {"feature": "ssp"})


def load_ssp_membership(client: UserClient, *, workspace_id: str, user_id: str) -> dict[str, Any] | None:
    res = client.get(
        "ssp_memberships",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "user_id": f"eq.{user_id}",
            "status": "eq.active",
            "select": (
                "id,workspace_id,company_pk,user_id,org_unit_id,department_id,"
                "product_role,manager_user_id,status"
            ),
            "limit": "1",
        },
    )
    if res.status_code != 200:
        return None
    rows = res.json() or []
    return rows[0] if rows else None


def product_grants(role: str | None) -> frozenset[str]:
    if not role:
        return frozenset()
    return PRODUCT_ROLE_GRANTS.get(role, frozenset())


def catalog_allows(ctx: AuthzContext, catalog_action: str) -> bool:
    """Preserve existing workspace-role SSP access (owner/admin/manager/viewer…)."""
    return authorize(ctx=ctx, action=catalog_action).allowed


def require_ssp_action(
    ctx: AuthzContext,
    client: UserClient,
    *,
    catalog_action: str | None = None,
    product_action: str,
) -> dict[str, Any] | None:
    """Allow if workspace catalog grants catalog_action OR product role grants product_action.

    Returns ssp_membership row when product path is used (may be None if catalog path).
    """
    feature_gate(ctx)
    membership = load_ssp_membership(client, workspace_id=ctx.workspace_id, user_id=ctx.user_id)

    if catalog_action and catalog_allows(ctx, catalog_action):
        return membership

    grants = product_grants(membership.get("product_role") if membership else None)
    if product_action in grants:
        return membership

    raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"], {"action": product_action})


def assert_form_in_scope(
    membership: dict[str, Any] | None,
    form: dict[str, Any],
    *,
    catalog_unscoped: bool,
) -> None:
    """Deny cross-department access for product-role scoped users."""
    if catalog_unscoped and not membership:
        return
    if catalog_unscoped and membership and membership.get("product_role") == "org_admin":
        return
    if not membership:
        # Catalog-only user: workspace-wide (legacy).
        return
    role = membership.get("product_role")
    if role == "org_admin":
        return
    dept = membership.get("department_id")
    form_dept = form.get("department_id")
    if role == "patrol_manager":
        if form_dept and dept and str(form_dept) != str(dept):
            raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
        return
    if role == "patrol_officer":
        if form_dept and dept and str(form_dept) != str(dept):
            raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
        return


def filter_forms_for_membership(
    items: list[dict[str, Any]],
    membership: dict[str, Any] | None,
    *,
    catalog_unscoped: bool,
) -> list[dict[str, Any]]:
    if catalog_unscoped and (not membership or membership.get("product_role") == "org_admin"):
        return items
    if not membership:
        return items
    role = membership.get("product_role")
    if role == "org_admin":
        return items
    dept = membership.get("department_id")
    if not dept:
        return [f for f in items if not f.get("department_id")]
    return [f for f in items if not f.get("department_id") or str(f.get("department_id")) == str(dept)]


def _optional_rows(res) -> list[dict[str, Any]]:
    """Missing local tables must not become a 400 on read-only SSP screens."""
    if res.status_code != 200:
        return []
    data = res.json()
    return data if isinstance(data, list) else []


def load_company(client: UserClient, *, workspace_id: str) -> dict[str, Any] | None:
    rows = _optional_rows(
        client.get(
            "ssp_companies",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,workspace_id,company_id,name,created_at",
                "limit": "1",
            },
        )
    )
    return rows[0] if rows else None


def load_member_site_ids(client: UserClient, *, workspace_id: str, user_id: str) -> set[str]:
    rows = _optional_rows(
        client.get(
            "ssp_site_members",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "user_id": f"eq.{user_id}",
                "select": "site_pk",
            },
        )
    )
    return {str(r["site_pk"]) for r in rows if r.get("site_pk")}


def assert_site_in_scope(
    membership: dict[str, Any] | None,
    site: dict[str, Any],
    *,
    catalog_unscoped: bool,
    member_site_ids: set[str] | None = None,
    actor_user_id: str | None = None,
) -> None:
    """Deny cross-site / cross-department access. Never trust client-supplied company_id/site_id."""
    if catalog_unscoped and (not membership or membership.get("product_role") == "org_admin"):
        return
    if not membership:
        return
    role = membership.get("product_role")
    if role == "org_admin":
        return
    site_id = str(site.get("id") or "")
    member_ids = member_site_ids or set()
    if site_id in member_ids:
        return
    actor = actor_user_id or membership.get("user_id")
    if site.get("manager_user_id") and actor and str(site["manager_user_id"]) == str(actor):
        return
    if role == "patrol_manager":
        dept = membership.get("department_id")
        site_dept = site.get("department_id")
        if site_dept and dept and str(site_dept) != str(dept):
            raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
        return
    raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])


def filter_sites_for_membership(
    items: list[dict[str, Any]],
    membership: dict[str, Any] | None,
    *,
    catalog_unscoped: bool,
    member_site_ids: set[str] | None = None,
    actor_user_id: str | None = None,
) -> list[dict[str, Any]]:
    if catalog_unscoped and (not membership or membership.get("product_role") == "org_admin"):
        return items
    if not membership:
        return items
    role = membership.get("product_role")
    if role == "org_admin":
        return items
    member_ids = member_site_ids or set()
    actor = actor_user_id or membership.get("user_id")
    dept = membership.get("department_id")
    out: list[dict[str, Any]] = []
    for site in items:
        sid = str(site.get("id") or "")
        if sid in member_ids:
            out.append(site)
            continue
        if site.get("manager_user_id") and actor and str(site["manager_user_id"]) == str(actor):
            out.append(site)
            continue
        if role == "patrol_manager":
            site_dept = site.get("department_id")
            if site_dept and dept and str(site_dept) != str(dept):
                continue
            out.append(site)
    return out
