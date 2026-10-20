"""Workspace product enablement — plan eligibility + workspace_feature_overrides."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..authz.engine import authorize
from ..deps import UserClient, current_user, load_authz_context, service_client, user_client
from ..errors import MESSAGES, ApiError
from ..http_supabase import supabase_request
from ..product_entitlements import (
    product_rows,
    required_solo_disable_keys,
)
from ..supabase_service import ServiceClient

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["products"])


def _raise(decision) -> None:
    if decision.allowed:
        return
    status = 401 if decision.code == "UNAUTHENTICATED" else 403
    raise ApiError(status, decision.code or "PERMISSION_DENIED", decision.message_he, decision.details)


class ProductEntitlementOut(BaseModel):
    feature_key: str
    eligible: bool
    enabled: bool
    override_enabled: bool | None = None
    toggleable: bool


class WorkspaceProductsOut(BaseModel):
    workspace_id: str
    plan_key: str
    products: list[ProductEntitlementOut] = Field(default_factory=list)


class ProductOverrideIn(BaseModel):
    feature_key: str = Field(min_length=1, max_length=80)
    enabled: bool


def fetch_plan_feature_keys(svc: ServiceClient, plan_key: str) -> frozenset[str]:
    """Authoritative plan eligibility — same table joined by my_workspace_entitlements."""
    res = svc.get(
        "plan_features",
        params={"plan_key": f"eq.{plan_key}", "select": "feature_key"},
    )
    if res.status_code != 200:
        raise ApiError(
            503,
            "PRODUCT_DEFAULTS_UNAVAILABLE",
            MESSAGES["PRODUCT_DEFAULTS_UNAVAILABLE"],
            details={"reason": "plan_features_lookup_failed", "plan_key": plan_key},
        )
    return frozenset(str(r.get("feature_key") or "") for r in (res.json() or []) if r.get("feature_key"))


def fetch_feature_registry_keys(svc: ServiceClient, keys: frozenset[str]) -> frozenset[str]:
    """Return which of `keys` exist in public.features. Lookup failure is hard-fail."""
    if not keys:
        return frozenset()
    ordered = ",".join(sorted(keys))
    res = svc.get(
        "features",
        params={"key": f"in.({ordered})", "select": "key"},
    )
    if res.status_code != 200:
        raise ApiError(
            503,
            "PRODUCT_DEFAULTS_UNAVAILABLE",
            MESSAGES["PRODUCT_DEFAULTS_UNAVAILABLE"],
            details={"reason": "features_lookup_failed", "keys": sorted(keys)},
        )
    return frozenset(str(r.get("key") or "") for r in (res.json() or []) if r.get("key"))


def _load_overrides(svc: ServiceClient, workspace_id: str) -> dict[str, bool]:
    res = svc.get(
        "workspace_feature_overrides",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "select": "feature_key,enabled",
        },
    )
    if res.status_code != 200:
        raise ApiError(503, "API_UNAVAILABLE", MESSAGES["API_UNAVAILABLE"])
    out: dict[str, bool] = {}
    for row in res.json() or []:
        key = str(row.get("feature_key") or "")
        if key:
            out[key] = bool(row.get("enabled"))
    return out


def _upsert_override_merge(svc: ServiceClient, workspace_id: str, feature_key: str, enabled: bool) -> None:
    """Upsert override using Prefer resolution=merge-duplicates (service role after authorize)."""
    headers = {
        "apikey": svc._key,
        "Authorization": f"Bearer {svc._key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    res = supabase_request(
        "POST",
        f"{svc.rest}/workspace_feature_overrides?on_conflict=workspace_id,feature_key",
        headers=headers,
        json={
            "workspace_id": workspace_id,
            "feature_key": feature_key,
            "enabled": enabled,
        },
    )
    if res.status_code not in {200, 201, 204}:
        raise ApiError(
            400,
            "PRODUCT_DEFAULTS_UNAVAILABLE",
            MESSAGES["PRODUCT_DEFAULTS_UNAVAILABLE"],
            details={"reason": "override_upsert_failed", "feature_key": feature_key},
        )


def assert_solo_default_off_ready(svc: ServiceClient, plan_key: str) -> frozenset[str]:
    """Preflight: resolve which Solo products must be disabled, or fail before workspace create.

    - Not plan-eligible → no disable required (not a failure).
    - Plan-eligible but missing from features registry → configuration error (fail).
    - Plan/features lookup HTTP failure → fail (do not treat as empty).
    """
    if plan_key != "solo":
        return frozenset()
    plan_eligible = fetch_plan_feature_keys(svc, plan_key)
    required = required_solo_disable_keys(plan_eligible)
    if not required:
        return frozenset()
    present = fetch_feature_registry_keys(svc, required)
    missing = sorted(required - present)
    if missing:
        raise ApiError(
            503,
            "PRODUCT_DEFAULTS_UNAVAILABLE",
            MESSAGES["PRODUCT_DEFAULTS_UNAVAILABLE"],
            details={
                "reason": "required_features_missing_from_registry",
                "missing": missing,
                "plan_key": plan_key,
            },
        )
    return required


def seed_solo_default_product_overrides(svc: ServiceClient, workspace_id: str, plan_key: str) -> None:
    """Disable plan-eligible Solo optional products. Fail closed — never silent-skip."""
    required = assert_solo_default_off_ready(svc, plan_key)
    for key in sorted(required):
        _upsert_override_merge(svc, workspace_id, key, False)


@router.get("/products", response_model=WorkspaceProductsOut)
def list_workspace_products(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
) -> WorkspaceProductsOut:
    ws = str(workspace_id)
    ctx = load_authz_context(client, user["id"], ws)
    _raise(authorize(ctx=ctx, action="workspace.edit"))
    plan_eligible = fetch_plan_feature_keys(svc, ctx.plan_key)
    overrides = _load_overrides(svc, ws)
    rows = product_rows(
        plan_key=ctx.plan_key,
        plan_eligible=plan_eligible,
        effective_features=ctx.features,
        overrides=overrides,
    )
    return WorkspaceProductsOut(
        workspace_id=ws,
        plan_key=ctx.plan_key,
        products=[ProductEntitlementOut(**row) for row in rows],
    )


@router.put("/products/overrides", response_model=WorkspaceProductsOut)
def put_product_override(
    workspace_id: UUID,
    body: ProductOverrideIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> WorkspaceProductsOut:
    """Workspace members cannot self-grant modules — Platform Admin only (see /api/v1/admin/...)."""
    # Authz membership check so cross-tenant probing still requires membership,
    # then deny write regardless of role (owner/administrator included).
    ws = str(workspace_id)
    load_authz_context(client, user["id"], ws)
    raise ApiError(
        403,
        "PERMISSION_DENIED",
        MESSAGES["PERMISSION_DENIED"],
        details={
            "reason": "product_overrides_platform_admin_only",
            "feature_key": body.feature_key.strip(),
        },
    )
