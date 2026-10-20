"""Aegis Platform Home — server-filtered products for the active workspace."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..authz.catalog import default_plan_key, load_catalog
from ..deps import UserClient, current_user, user_client
from ..errors import ApiError, MESSAGES
from ..platform_products import resolve_available_products

router = APIRouter(prefix="/api/v1/platform", tags=["platform"])


class PlatformHomeUser(BaseModel):
    id: str
    email: str | None = None
    full_name: str = ""
    locale: str = "he"
    is_platform_admin: bool = False


class PlatformHomeWorkspace(BaseModel):
    id: str
    name: str
    role_key: str
    plan_key: str
    can_manage_workspace: bool = False


class PlatformHomeProduct(BaseModel):
    id: str
    title: str
    description: str
    status: str
    entry_path: str


class PlatformHomeLinks(BaseModel):
    account_settings: str | None = None
    workspace_settings: str | None = None
    platform_admin: str | None = None


class PlatformHomeOut(BaseModel):
    user: PlatformHomeUser
    active_workspace_id: str | None = None
    workspaces: list[PlatformHomeWorkspace] = Field(default_factory=list)
    products: list[PlatformHomeProduct] = Field(default_factory=list)
    links: PlatformHomeLinks = Field(default_factory=PlatformHomeLinks)


def _nested_workspace(row: dict[str, Any]) -> dict[str, Any] | None:
    nested = row.get("workspaces")
    if isinstance(nested, list):
        nested = nested[0] if nested else None
    return nested if isinstance(nested, dict) else None


def _load_membership_rows(client: UserClient, user_id: str) -> list[dict[str, Any]]:
    """Active memberships in active workspaces only — same gates as GET /auth/session."""
    members_res = client.get(
        "workspace_memberships",
        params={
            "user_id": f"eq.{user_id}",
            "status": "eq.active",
            "select": "workspace_id,role_key,workspace_role_key,workspaces(id,name,status,is_beta)",
            "order": "created_at.desc",
        },
    )
    if members_res.status_code != 200:
        raise ApiError(503, "API_UNAVAILABLE", MESSAGES["API_UNAVAILABLE"])
    out: list[dict[str, Any]] = []
    for row in members_res.json() or []:
        ws = _nested_workspace(row)
        if not ws or str(ws.get("status") or "") != "active":
            continue
        out.append(row)
    return out


def _entitlements_and_grants(
    client: UserClient,
    workspace_id: str,
    role_key: str,
    workspace_role_key: str,
) -> tuple[str, frozenset[str], frozenset[str]]:
    plan_key = default_plan_key()
    features: frozenset[str] = frozenset()
    ent_res = client.rpc("my_workspace_entitlements", {"p_workspace_id": workspace_id})
    if ent_res.status_code == 200:
        payload = ent_res.json()
        if isinstance(payload, dict) and "features" in payload:
            plan_key = str(payload.get("plan_key") or default_plan_key())
            features = frozenset(str(f) for f in (payload.get("features") or []) if f)
    permissions: list[str] = []
    try:
        from ..workspace_rbac import resolve_role_grants

        permissions = list(resolve_role_grants(client, workspace_id, workspace_role_key, role_key))
    except Exception:
        catalog = load_catalog()
        permissions = list(catalog.get("_grants", {}).get(role_key) or [])
    return plan_key, features, frozenset(permissions)


@router.get("/home", response_model=PlatformHomeOut)
def platform_home(
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> PlatformHomeOut:
    """Launch pad for entitled products in the caller's active workspace.

    Active workspace is derived server-side from memberships + profiles.last_workspace_id.
    Clients must not pass an arbitrary workspace id — switch via PUT /me/active-workspace first.
    """
    user_id = user["id"]
    profile_res = client.get(
        "profiles",
        params={"id": f"eq.{user_id}", "select": "id,full_name,locale,last_workspace_id,is_platform_admin"},
    )
    profile_row = (profile_res.json() or [None])[0] if profile_res.status_code == 200 else None
    if not profile_row:
        raise ApiError(401, "UNAUTHENTICATED", "נדרשת התחברות")

    rows = _load_membership_rows(client, user_id)
    # Prefer last_workspace_id when it is still an active membership (same as session).
    last_ws = profile_row.get("last_workspace_id")
    member_ids = {str(r["workspace_id"]) for r in rows}
    if last_ws and str(last_ws) in member_ids:
        preferred = str(last_ws)
        rows.sort(key=lambda r: 0 if str(r["workspace_id"]) == preferred else 1)

    workspaces_out: list[PlatformHomeWorkspace] = []
    active_id: str | None = None
    products: list[PlatformHomeProduct] = []
    can_manage = False
    can_settings = False

    enriched: list[tuple[dict[str, Any], str, frozenset[str], frozenset[str]]] = []
    for row in rows:
        ws = _nested_workspace(row)
        assert ws is not None
        ws_id = str(row["workspace_id"])
        role_key = str(row["role_key"])
        if role_key == "founding_technician":
            role_key = "technician"
        workspace_role_key = str(row.get("workspace_role_key") or role_key)
        if workspace_role_key == "founding_technician":
            workspace_role_key = "technician"
        plan_key, features, permissions = _entitlements_and_grants(
            client, ws_id, role_key, workspace_role_key
        )
        manage = "*" in permissions or "workspace.edit" in permissions
        workspaces_out.append(
            PlatformHomeWorkspace(
                id=ws_id,
                name=str(ws.get("name") or ""),
                role_key=role_key,
                plan_key=plan_key,
                can_manage_workspace=manage,
            )
        )
        enriched.append((row, role_key, features, permissions))

    if enriched:
        active_row, active_role, active_features, active_perms = enriched[0]
        active_id = str(active_row["workspace_id"])
        can_manage = "*" in active_perms or "workspace.edit" in active_perms
        can_settings = can_manage or "settings.view" in active_perms or "*" in active_perms
        for item in resolve_available_products(
            features=active_features,
            permissions=active_perms,
            role_key=active_role,
        ):
            products.append(PlatformHomeProduct(**item))

    is_admin = bool(profile_row.get("is_platform_admin"))
    links = PlatformHomeLinks(
        account_settings="/app/settings/profile" if active_id else None,
        workspace_settings="/app/settings" if active_id and can_settings else None,
        platform_admin="/admin" if is_admin else None,
    )

    return PlatformHomeOut(
        user=PlatformHomeUser(
            id=user_id,
            email=user.get("email"),
            full_name=str(profile_row.get("full_name") or ""),
            locale=str(profile_row.get("locale") or "he"),
            is_platform_admin=is_admin,
        ),
        active_workspace_id=active_id,
        workspaces=workspaces_out,
        products=products,
        links=links,
    )
