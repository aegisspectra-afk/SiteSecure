"""SSP organization core API — company, org units, departments, product memberships."""

from __future__ import annotations

from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from ..authz.engine import authorize
from ..deps import UserClient, current_user, load_authz_context, user_client
from ..errors import ApiError, MESSAGES
from ..identity import actor_id
from ..rest import as_list, created_or_403, one_or_404
from ..ssp.company_ids import new_company_id
from ..ssp.product_authz import (
    PRODUCT_ROLES,
    feature_gate,
    load_company,
    load_ssp_membership,
    require_ssp_action,
)

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}/ssp/org", tags=["ssp-org"])


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


class BootstrapCompanyIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)
    root_unit_name: str = Field(default="מטה", min_length=1, max_length=200)
    patrol_department_name: str = Field(default="סיור", min_length=1, max_length=200)


class OrgUnitCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)
    parent_id: str | None = None
    unit_type: Literal["region", "branch", "unit"] = "unit"
    sort_order: int = 0


class DepartmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    org_unit_id: str
    key: str = Field(min_length=1, max_length=64, pattern=r"^[a-z][a-z0-9_]*$")
    name_he: str = Field(min_length=1, max_length=200)
    name_en: str | None = Field(default=None, max_length=200)


class MembershipAssignIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: str = Field(min_length=1)
    product_role: Literal["org_admin", "patrol_manager", "patrol_officer"]
    org_unit_id: str | None = None
    department_id: str | None = None
    manager_user_id: str | None = None


def _require_workspace_managerial(ctx) -> None:
    """Bootstrap company: workspace owner/administrator only (not every manager)."""
    if ctx.role_key not in {"owner", "administrator"} and "*" not in (ctx.grants or frozenset()):
        # Also allow explicit catalog workspace.edit owners via grants
        if not authorize(ctx=ctx, action="workspace.edit").allowed:
            raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])


@router.get("/me")
def org_me(
    workspace_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    feature_gate(ctx)
    company = load_company(client, workspace_id=str(workspace_id))
    membership = load_ssp_membership(client, workspace_id=str(workspace_id), user_id=ctx.user_id)
    return {
        "company": company,
        "membership": membership,
        "workspace_role_key": ctx.role_key,
        "has_ssp_entitlement": "ssp" in ctx.features,
    }


@router.post("/bootstrap", status_code=201)
def bootstrap_company(
    workspace_id: UUID,
    body: BootstrapCompanyIn,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    """Create company + root org unit + Patrol department. Idempotent if company exists."""
    ctx = _ctx(client, user, workspace_id)
    feature_gate(ctx)
    _require_workspace_managerial(ctx)

    existing = load_company(client, workspace_id=str(workspace_id))
    if existing:
        raise ApiError(409, "BUSINESS_RULE", "כבר קיימת חברת SSP לסביבה זו", {"company_id": existing.get("company_id")})

    company_id = new_company_id()
    company = created_or_403(
        client.post(
            "ssp_companies",
            json={
                "workspace_id": str(workspace_id),
                "company_id": company_id,
                "name": body.name.strip(),
                "created_by": ctx.user_id,
            },
        )
    )
    root = created_or_403(
        client.post(
            "ssp_org_units",
            json={
                "workspace_id": str(workspace_id),
                "company_pk": company["id"],
                "parent_id": None,
                "name": body.root_unit_name.strip(),
                "unit_type": "root",
                "sort_order": 0,
            },
        )
    )
    patrol = created_or_403(
        client.post(
            "ssp_departments",
            json={
                "workspace_id": str(workspace_id),
                "company_pk": company["id"],
                "org_unit_id": root["id"],
                "key": "patrol",
                "name_he": body.patrol_department_name.strip(),
                "name_en": "Patrol",
            },
        )
    )
    # Bootstrapper becomes org_admin (distinct from patrol_manager).
    membership = created_or_403(
        client.post(
            "ssp_memberships",
            json={
                "workspace_id": str(workspace_id),
                "company_pk": company["id"],
                "user_id": ctx.user_id,
                "org_unit_id": root["id"],
                "department_id": None,
                "product_role": "org_admin",
                "created_by": ctx.user_id,
                "status": "active",
            },
        )
    )
    return {"company": company, "root_unit": root, "patrol_department": patrol, "membership": membership}


@router.get("/units")
def list_units(
    workspace_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.org.view")
    company = load_company(client, workspace_id=str(workspace_id))
    if not company:
        return {"items": []}
    items = as_list(
        client.get(
            "ssp_org_units",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "company_pk": f"eq.{company['id']}",
                "select": "id,workspace_id,company_pk,parent_id,name,unit_type,sort_order,is_active",
                "order": "sort_order.asc,name.asc",
            },
        )
    )
    return {"items": items}


@router.post("/units", status_code=201)
def create_unit(
    workspace_id: UUID,
    body: OrgUnitCreate,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.org.manage")
    company = load_company(client, workspace_id=str(workspace_id))
    if not company:
        raise ApiError(400, "BUSINESS_RULE", "יש ליצור חברה לפני יחידות ארגוניות")
    parent_id = body.parent_id
    if parent_id:
        one_or_404(
            client.get(
                "ssp_org_units",
                params={
                    "id": f"eq.{parent_id}",
                    "workspace_id": f"eq.{workspace_id}",
                    "company_pk": f"eq.{company['id']}",
                    "select": "id",
                },
            )
        )
    row = created_or_403(
        client.post(
            "ssp_org_units",
            json={
                "workspace_id": str(workspace_id),
                "company_pk": company["id"],
                "parent_id": parent_id,
                "name": body.name.strip(),
                "unit_type": body.unit_type,
                "sort_order": body.sort_order,
            },
        )
    )
    return row


@router.get("/departments")
def list_departments(
    workspace_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.org.view")
    company = load_company(client, workspace_id=str(workspace_id))
    if not company:
        return {"items": []}
    items = as_list(
        client.get(
            "ssp_departments",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "company_pk": f"eq.{company['id']}",
                "select": "id,workspace_id,company_pk,org_unit_id,key,name_he,name_en,is_active",
                "order": "key.asc",
            },
        )
    )
    return {"items": items}


@router.post("/departments", status_code=201)
def create_department(
    workspace_id: UUID,
    body: DepartmentCreate,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    require_ssp_action(ctx, client, catalog_action=None, product_action="ssp.org.manage")
    company = load_company(client, workspace_id=str(workspace_id))
    if not company:
        raise ApiError(400, "BUSINESS_RULE", "יש ליצור חברה לפני מחלקות")
    one_or_404(
        client.get(
            "ssp_org_units",
            params={
                "id": f"eq.{body.org_unit_id}",
                "workspace_id": f"eq.{workspace_id}",
                "company_pk": f"eq.{company['id']}",
                "select": "id",
            },
        )
    )
    return created_or_403(
        client.post(
            "ssp_departments",
            json={
                "workspace_id": str(workspace_id),
                "company_pk": company["id"],
                "org_unit_id": body.org_unit_id,
                "key": body.key.strip().lower(),
                "name_he": body.name_he.strip(),
                "name_en": (body.name_en or "").strip() or None,
            },
        )
    )


@router.get("/members")
def list_members(
    workspace_id: UUID,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    ctx = _ctx(client, user, workspace_id)
    feature_gate(ctx)
    membership = load_ssp_membership(client, workspace_id=str(workspace_id), user_id=ctx.user_id)
    from ..ssp.product_authz import product_grants

    grants = product_grants(membership.get("product_role") if membership else None)
    if "ssp.members.view" not in grants and "ssp.members.manage" not in grants:
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "status": "eq.active",
        "select": (
            "id,workspace_id,company_pk,user_id,org_unit_id,department_id,"
            "product_role,manager_user_id,status,created_at"
        ),
        "order": "created_at.desc",
    }
    if membership and membership.get("product_role") == "patrol_manager":
        dept = membership.get("department_id")
        if not dept:
            return {"items": []}
        params["department_id"] = f"eq.{dept}"
    return {"items": as_list(client.get("ssp_memberships", params=params))}


@router.put("/members")
def assign_member(
    workspace_id: UUID,
    body: MembershipAssignIn,
    user: Annotated[dict, Depends(current_user)],
    client: Annotated[UserClient, Depends(user_client)],
):
    """Assign / update SSP product role for an existing workspace member (no Auth user create)."""
    ctx = _ctx(client, user, workspace_id)
    feature_gate(ctx)
    actor_membership = load_ssp_membership(client, workspace_id=str(workspace_id), user_id=ctx.user_id)
    from ..ssp.product_authz import product_grants

    role = actor_membership.get("product_role") if actor_membership else None
    grants = product_grants(role)
    body_dept = body.department_id

    if "ssp.members.manage" in grants:
        pass  # org_admin
    elif "ssp.members.manage_department" in grants:
        if body.product_role == "org_admin":
            raise ApiError(403, "PERMISSION_DENIED", "מנהל סיור אינו יכול למנות מנהל ארגון")
        actor_dept = actor_membership.get("department_id") if actor_membership else None
        if not actor_dept:
            raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
        if body.department_id and str(body.department_id) != str(actor_dept):
            raise ApiError(403, "SCOPE_DENIED", MESSAGES["SCOPE_DENIED"])
        body_dept = body.department_id or actor_dept
    else:
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])

    if body.product_role not in PRODUCT_ROLES:
        raise ApiError(400, "VALIDATION_ERROR", "תפקיד מוצר לא תקין")

    # Target must already be an active workspace member — never create Auth users here.
    wm = client.get(
        "workspace_memberships",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "user_id": f"eq.{body.user_id}",
            "status": "eq.active",
            "select": "user_id,role_key",
            "limit": "1",
        },
    )
    if wm.status_code != 200 or not (wm.json() or []):
        raise ApiError(404, "NOT_FOUND", "המשתמש אינו חבר פעיל בסביבה")

    company = load_company(client, workspace_id=str(workspace_id))
    if not company:
        raise ApiError(400, "BUSINESS_RULE", "יש לבצע bootstrap לחברת SSP תחילה")

    if body_dept:
        one_or_404(
            client.get(
                "ssp_departments",
                params={
                    "id": f"eq.{body_dept}",
                    "workspace_id": f"eq.{workspace_id}",
                    "company_pk": f"eq.{company['id']}",
                    "select": "id",
                },
            )
        )

    existing = client.get(
        "ssp_memberships",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "company_pk": f"eq.{company['id']}",
            "user_id": f"eq.{body.user_id}",
            "select": "id",
            "limit": "1",
        },
    )
    payload: dict[str, Any] = {
        "workspace_id": str(workspace_id),
        "company_pk": company["id"],
        "user_id": body.user_id,
        "org_unit_id": body.org_unit_id,
        "department_id": body_dept,
        "product_role": body.product_role,
        "manager_user_id": body.manager_user_id,
        "status": "active",
        "created_by": ctx.user_id,
    }
    rows = existing.json() if existing.status_code == 200 else []
    if rows:
        mid = rows[0]["id"]
        res = client.patch(
            "ssp_memberships",
            params={"id": f"eq.{mid}", "workspace_id": f"eq.{workspace_id}"},
            json={
                "org_unit_id": body.org_unit_id,
                "department_id": body_dept,
                "product_role": body.product_role,
                "manager_user_id": body.manager_user_id,
                "status": "active",
            },
        )
        if res.status_code not in {200, 204}:
            raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
        data = res.json() if res.content else None
        if isinstance(data, list) and data:
            return data[0]
        return {**payload, "id": mid}

    return created_or_403(client.post("ssp_memberships", json=payload))
