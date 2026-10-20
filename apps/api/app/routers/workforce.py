"""Workforce Intelligence API — directory, positions, and manual shifts.

Passwords are accepted on create only, forwarded to Auth Admin, and never returned.
Public /register is unchanged and is not used for workforce employees.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, ConfigDict, Field, SecretStr

from ..audit import write_audit
from ..authz.engine import authorize
from ..authz.guard import require
from ..authz.types import AuthzContext
from ..authz.usage import fetch_occupancy
from ..deps import ServiceClient, UserClient, current_user, load_authz_context, service_client, user_client
from ..errors import ApiError, MESSAGES
from ..identity import actor_id, reject_spoofed_workspace
from ..rest import schema_missing
from ..workforce.directory import (
    create_region,
    create_site,
    delete_region,
    delete_site,
    list_positions,
    list_regions,
    list_sites,
    update_region,
    update_site,
)
from ..workforce.provision import (
    EMPLOYEE_SELECT,
    PRODUCT_ROLES,
    CreateEmployeeInput,
    disable_employee_user,
    employee_out,
    provision_employee_user,
)
from ..workforce.shifts import create_shift, delete_shift, list_shifts, update_shift

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["workforce"])

EMPLOYEE_SELECT_LEGACY = (
    "id,workspace_id,user_id,membership_id,employee_number,first_name,last_name,"
    "phone,email,username,employment_status,position_id,region_id,site_id,"
    "hire_date,created_at,updated_at"
)

ProductRole = Literal[
    "org_admin",
    "national_manager",
    "regional_manager",
    "site_manager",
    "scheduler",
    "employee",
    "payroll",
    "auditor",
]


class WorkforceEmployeeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: str
    last_name: str
    email: str
    username: str
    password: SecretStr = Field(min_length=8, max_length=128)
    phone: str | None = None
    employee_number: str | None = None
    product_role: ProductRole = "employee"
    position_id: str | None = None
    region_id: str | None = None
    site_id: str | None = None
    hire_date: str | None = None

    def __repr__(self) -> str:
        return (
            f"WorkforceEmployeeCreate(first_name={self.first_name!r}, last_name={self.last_name!r}, "
            f"email={self.email!r}, username={self.username!r}, password='***')"
        )


class RegionWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    code: str | None = None
    is_active: bool | None = None
    workspace_id: str | None = None


class SiteWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    code: str | None = None
    kind: str | None = None
    region_id: str | None = None
    address: dict[str, Any] | None = None
    is_active: bool | None = None
    notes: str | None = None
    workspace_id: str | None = None


class ShiftWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    employee_id: str | None = None
    site_id: str | None = None
    region_id: str | None = None
    position_id: str | None = None
    starts_at: str | None = None
    ends_at: str | None = None
    notes: str | None = None
    workspace_id: str | None = None


_AUDIT_SECRET_KEYS = frozenset({"password", "secret", "token", "access_token", "refresh_token"})


def _safe_audit_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in metadata.items() if str(key).lower() not in _AUDIT_SECRET_KEYS}


def _ctx(client: UserClient, user: dict, workspace_id: UUID) -> AuthzContext:
    return load_authz_context(client, actor_id(user), str(workspace_id))


def _require_any(ctx: AuthzContext, actions: list[str]) -> None:
    last: ApiError | None = None
    for action in actions:
        decision = authorize(ctx=ctx, action=action)
        if decision.allowed:
            return
        status = 401 if decision.code == "UNAUTHENTICATED" else 403
        last = ApiError(
            status,
            decision.code or "PERMISSION_DENIED",
            decision.message_he,
            decision.details,
        )
    if last:
        raise last
    raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])


def _guard_workspace(path_id: UUID, body_workspace_id: str | None) -> str:
    workspace_id = str(path_id)
    reject_spoofed_workspace(workspace_id, body_workspace_id)
    return workspace_id


def _rows(res: Any) -> list[dict]:
    if getattr(res, "status_code", None) == 200:
        data = res.json()
        return data if isinstance(data, list) else []
    if schema_missing(res):
        raise ApiError(503, "WORKFORCE_SCHEMA_UNAVAILABLE", MESSAGES["WORKFORCE_SCHEMA_UNAVAILABLE"])
    if getattr(res, "status_code", None) in {401, 403}:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    raise ApiError(400, "BUSINESS_RULE", MESSAGES["BUSINESS_RULE"])


def _lookup_items(client: UserClient, table: str, workspace_id: str) -> list[dict[str, Any]]:
    rows = _rows(
        client.get(
            table,
            params={
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,name,code,is_active",
                "order": "name.asc",
                "limit": "500",
            },
        )
    )
    return [
        {
            "id": str(row.get("id") or ""),
            "name": row.get("name") or "",
            "code": row.get("code"),
            "is_active": bool(row.get("is_active", True)),
        }
        for row in rows
    ]


def _list_employee_rows(client: UserClient, params: dict[str, str]) -> list[dict]:
    query = dict(params)
    query["select"] = EMPLOYEE_SELECT
    res = client.get("workforce_employees", params=query)
    if schema_missing(res):
        query["select"] = EMPLOYEE_SELECT_LEGACY
        res = client.get("workforce_employees", params=query)
    return _rows(res)


@router.get("/workforce/summary")
def workforce_summary(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "workforce.view")
    ws = str(workspace_id)
    employees = _rows(
        client.get(
            "workforce_employees",
            params={
                "workspace_id": f"eq.{ws}",
                "select": "id,employment_status,user_id",
                "limit": "1000",
            },
        )
    )
    sites = _rows(
        client.get(
            "workforce_sites",
            params={"workspace_id": f"eq.{ws}", "select": "id,is_active", "limit": "1000"},
        )
    )
    active = [row for row in employees if row.get("employment_status") == "active"]
    linked = [row for row in active if row.get("user_id")]
    return {
        "employees_total": len(employees),
        "employees_active": len(active),
        "employees_with_account": len(linked),
        "sites_total": len(sites),
        "sites_active": len([row for row in sites if row.get("is_active") is True]),
        "data_mode": "empty" if not employees and not sites else "live",
    }


@router.get("/workforce/lookups")
def workforce_lookups(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "workforce.employees.view")
    ws = str(workspace_id)
    return {
        "regions": _lookup_items(client, "workforce_regions", ws),
        "sites": _lookup_items(client, "workforce_sites", ws),
        "positions": _lookup_items(client, "workforce_positions", ws),
        "product_roles": sorted(PRODUCT_ROLES),
    }


@router.get("/workforce/employees")
def list_workforce_employees(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    status: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query()] = None,
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "workforce.employees.view")
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "order": "last_name.asc,first_name.asc",
        "limit": "200",
    }
    if status in {"active", "inactive", "terminated"}:
        params["employment_status"] = f"eq.{status}"
    needle = (q or "").strip()
    if needle:
        escaped = needle.replace(",", " ").replace(".", " ")
        params["or"] = (
            f"(last_name.ilike.*{escaped}*,first_name.ilike.*{escaped}*,"
            f"employee_number.ilike.*{escaped}*,username.ilike.*{escaped}*,email.ilike.*{escaped}*)"
        )
    rows = _list_employee_rows(client, params)
    return {"items": [employee_out(row) for row in rows]}


@router.post("/workforce/employees", status_code=201)
def create_workforce_employee(
    workspace_id: UUID,
    body: WorkforceEmployeeCreate,
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "workforce.employees.create_user")
    occupancy = fetch_occupancy(client, str(workspace_id))
    created = provision_employee_user(
        svc,
        workspace_id=str(workspace_id),
        actor_user_id=actor_id(user),
        payload=CreateEmployeeInput(
            first_name=body.first_name,
            last_name=body.last_name,
            email=body.email,
            username=body.username,
            password=body.password.get_secret_value(),
            phone=body.phone,
            employee_number=body.employee_number,
            product_role=body.product_role,
            position_id=body.position_id,
            region_id=body.region_id,
            site_id=body.site_id,
            hire_date=body.hire_date,
        ),
        occupied_roles=occupancy.roles,
        plan_key=ctx.plan_key,
    )
    write_audit(
        client,
        str(workspace_id),
        "workforce.employees.create_user",
        entity_type="workforce_employee",
        entity_id=created.get("id"),
        metadata=_safe_audit_metadata(
            {
                "result": "success",
                "employee_id": created.get("id"),
                "username": created.get("username"),
                "product_role": body.product_role,
                "resumed": created.get("account_status") == "linked",
            }
        ),
    )
    return created


@router.post("/workforce/employees/{employee_id}/disable")
def disable_workforce_employee(
    workspace_id: UUID,
    employee_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    svc: Annotated[ServiceClient, Depends(service_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "workforce.employees.disable")
    updated = disable_employee_user(
        svc,
        workspace_id=str(workspace_id),
        employee_id=str(employee_id),
        actor_user_id=actor_id(user),
    )
    write_audit(
        client,
        str(workspace_id),
        "workforce.employees.disable",
        entity_type="workforce_employee",
        entity_id=str(employee_id),
        metadata=_safe_audit_metadata({"result": "success", "employee_id": str(employee_id)}),
    )
    return updated


@router.get("/workforce/regions")
def list_workforce_regions(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "workforce.sites.view")
    return {"items": list_regions(client, str(workspace_id))}


@router.post("/workforce/regions", status_code=201)
def create_workforce_region(
    workspace_id: UUID,
    body: RegionWrite,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "workforce.sites.manage")
    ws = _guard_workspace(workspace_id, body.workspace_id)
    created = create_region(client, ws, body.model_dump(exclude_none=True, exclude={"workspace_id"}))
    write_audit(
        client,
        ws,
        "workforce.sites.manage",
        entity_type="workforce_region",
        entity_id=created.get("id"),
        metadata=_safe_audit_metadata({"result": "success", "region_id": created.get("id")}),
    )
    return created


@router.patch("/workforce/regions/{region_id}")
def patch_workforce_region(
    workspace_id: UUID,
    region_id: UUID,
    body: RegionWrite,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "workforce.sites.manage")
    ws = _guard_workspace(workspace_id, body.workspace_id)
    updated = update_region(client, ws, str(region_id), body.model_dump(exclude_unset=True, exclude={"workspace_id"}))
    write_audit(
        client,
        ws,
        "workforce.sites.manage",
        entity_type="workforce_region",
        entity_id=str(region_id),
        metadata=_safe_audit_metadata({"result": "success", "region_id": str(region_id)}),
    )
    return updated


@router.delete("/workforce/regions/{region_id}", status_code=204)
def delete_workforce_region(
    workspace_id: UUID,
    region_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "workforce.sites.manage")
    delete_region(client, str(workspace_id), str(region_id))
    write_audit(
        client,
        str(workspace_id),
        "workforce.sites.manage",
        entity_type="workforce_region",
        entity_id=str(region_id),
        metadata=_safe_audit_metadata({"result": "deleted", "region_id": str(region_id)}),
    )
    return Response(status_code=204)


@router.get("/workforce/sites")
def list_workforce_sites(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "workforce.sites.view")
    return {"items": list_sites(client, str(workspace_id))}


@router.post("/workforce/sites", status_code=201)
def create_workforce_site(
    workspace_id: UUID,
    body: SiteWrite,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "workforce.sites.manage")
    ws = _guard_workspace(workspace_id, body.workspace_id)
    created = create_site(
        client,
        ws,
        body.model_dump(exclude_none=True, exclude={"workspace_id"}),
        actor_user_id=actor_id(user),
    )
    write_audit(
        client,
        ws,
        "workforce.sites.manage",
        entity_type="workforce_site",
        entity_id=created.get("id"),
        metadata=_safe_audit_metadata({"result": "success", "site_id": created.get("id")}),
    )
    return created


@router.patch("/workforce/sites/{site_id}")
def patch_workforce_site(
    workspace_id: UUID,
    site_id: UUID,
    body: SiteWrite,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "workforce.sites.manage")
    ws = _guard_workspace(workspace_id, body.workspace_id)
    updated = update_site(client, ws, str(site_id), body.model_dump(exclude_unset=True, exclude={"workspace_id"}))
    write_audit(
        client,
        ws,
        "workforce.sites.manage",
        entity_type="workforce_site",
        entity_id=str(site_id),
        metadata=_safe_audit_metadata({"result": "success", "site_id": str(site_id)}),
    )
    return updated


@router.delete("/workforce/sites/{site_id}", status_code=204)
def delete_workforce_site(
    workspace_id: UUID,
    site_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "workforce.sites.manage")
    delete_site(client, str(workspace_id), str(site_id))
    write_audit(
        client,
        str(workspace_id),
        "workforce.sites.manage",
        entity_type="workforce_site",
        entity_id=str(site_id),
        metadata=_safe_audit_metadata({"result": "deleted", "site_id": str(site_id)}),
    )
    return Response(status_code=204)


@router.get("/workforce/positions")
def list_workforce_positions(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    _require_any(ctx, ["workforce.employees.view", "workforce.sites.view", "workforce.schedules.view"])
    return {"items": list_positions(client, str(workspace_id))}


@router.get("/workforce/shifts")
def list_workforce_shifts(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    starts_from: Annotated[str, Query()],
    starts_to: Annotated[str, Query()],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "workforce.schedules.view")
    return {"items": list_shifts(client, str(workspace_id), starts_from=starts_from, starts_to=starts_to)}


@router.post("/workforce/shifts", status_code=201)
def create_workforce_shift(
    workspace_id: UUID,
    body: ShiftWrite,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "workforce.schedules.edit")
    ws = _guard_workspace(workspace_id, body.workspace_id)
    created = create_shift(
        client,
        ws,
        body.model_dump(exclude_none=True, exclude={"workspace_id"}),
        actor_user_id=actor_id(user),
    )
    write_audit(
        client,
        ws,
        "workforce.schedules.edit",
        entity_type="workforce_shift",
        entity_id=created.get("id"),
        metadata=_safe_audit_metadata({"result": "success", "shift_id": created.get("id")}),
    )
    return created


@router.patch("/workforce/shifts/{shift_id}")
def patch_workforce_shift(
    workspace_id: UUID,
    shift_id: UUID,
    body: ShiftWrite,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "workforce.schedules.edit")
    ws = _guard_workspace(workspace_id, body.workspace_id)
    updated = update_shift(client, ws, str(shift_id), body.model_dump(exclude_unset=True, exclude={"workspace_id"}))
    write_audit(
        client,
        ws,
        "workforce.schedules.edit",
        entity_type="workforce_shift",
        entity_id=str(shift_id),
        metadata=_safe_audit_metadata({"result": "success", "shift_id": str(shift_id)}),
    )
    return updated


@router.delete("/workforce/shifts/{shift_id}", status_code=204)
def delete_workforce_shift(
    workspace_id: UUID,
    shift_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "workforce.schedules.edit")
    delete_shift(client, str(workspace_id), str(shift_id))
    write_audit(
        client,
        str(workspace_id),
        "workforce.schedules.edit",
        entity_type="workforce_shift",
        entity_id=str(shift_id),
        metadata=_safe_audit_metadata({"result": "deleted", "shift_id": str(shift_id)}),
    )
    return Response(status_code=204)
