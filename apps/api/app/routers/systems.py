from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..authz.guard import require
from ..authz.types import ResourceRef
from ..deps import UserClient, current_user, load_authz_context, user_client
from ..errors import ApiError
from ..identity import actor_id
from ..rest import as_list, created_or_403, one_or_404, patched_or_403

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["systems"])

SYSTEM_SELECT = (
    "id,workspace_id,site_id,type,name,status,manufacturer,model,panel_id,metadata,created_at,updated_at"
)
EQUIPMENT_SELECT = (
    "id,workspace_id,site_id,system_id,category,status,name,manufacturer,model,"
    "serial,mac,ip,location_note,installed_at,created_at,updated_at"
)


class SystemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    site_id: str
    type: str = "cctv"
    name: str = Field(min_length=1, max_length=200)
    status: str = "planned"
    manufacturer: str | None = None
    model: str | None = None


class SystemPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=200)
    status: str | None = None
    manufacturer: str | None = None
    model: str | None = None


class EquipmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    site_id: str
    name: str = Field(min_length=1, max_length=200)
    category: str = "other"
    status: str = "planned"
    system_id: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    serial: str | None = None
    ip: str | None = None
    location_note: str | None = None


class EquipmentPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=200)
    status: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    serial: str | None = None
    ip: str | None = None
    location_note: str | None = None
    system_id: str | None = None


class SystemOut(BaseModel):
    id: str
    workspace_id: str
    site_id: str
    type: str
    name: str
    status: str
    manufacturer: str | None = None
    model: str | None = None
    panel_id: str | None = None
    created_at: str
    updated_at: str


class EquipmentOut(BaseModel):
    id: str
    workspace_id: str
    site_id: str
    system_id: str | None = None
    category: str
    status: str
    name: str
    manufacturer: str | None = None
    model: str | None = None
    serial: str | None = None
    mac: str | None = None
    ip: str | None = None
    location_note: str | None = None
    installed_at: str | None = None
    created_at: str
    updated_at: str


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


def _system_out(row: dict) -> SystemOut:
    return SystemOut(
        id=row["id"],
        workspace_id=row["workspace_id"],
        site_id=row["site_id"],
        type=row["type"],
        name=row["name"],
        status=row["status"],
        manufacturer=row.get("manufacturer"),
        model=row.get("model"),
        panel_id=row.get("panel_id"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _equipment_out(row: dict) -> EquipmentOut:
    return EquipmentOut(
        id=row["id"],
        workspace_id=row["workspace_id"],
        site_id=row["site_id"],
        system_id=row.get("system_id"),
        category=row["category"],
        status=row["status"],
        name=row["name"],
        manufacturer=row.get("manufacturer"),
        model=row.get("model"),
        serial=row.get("serial"),
        mac=row.get("mac"),
        ip=row.get("ip"),
        location_note=row.get("location_note"),
        installed_at=row.get("installed_at"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.get("/systems")
def list_systems(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    site_id: str = Query(...),
    limit: int = Query(default=100, ge=1, le=200),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.view")
    rows = as_list(
        client.get(
            "systems",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "site_id": f"eq.{site_id}",
                "select": SYSTEM_SELECT,
                "order": "created_at.desc",
                "limit": str(limit),
            },
        )
    )
    return {"items": [_system_out(row).model_dump() for row in rows]}


@router.post("/systems", response_model=SystemOut)
def create_system(
    workspace_id: UUID,
    body: SystemCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> SystemOut:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.edit", resource=ResourceRef(type="site", site_id=body.site_id))
    one_or_404(
        client.get(
            "sites",
            params={"id": f"eq.{body.site_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )
    row = created_or_403(
        client.post(
            "systems",
            {
                "workspace_id": str(workspace_id),
                **body.model_dump(exclude_none=True),
            },
        )
    )
    return _system_out(row)


@router.patch("/systems/{system_id}", response_model=SystemOut)
def patch_system(
    workspace_id: UUID,
    system_id: UUID,
    body: SystemPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> SystemOut:
    ctx = _ctx(client, user, workspace_id)
    existing = one_or_404(
        client.get(
            "systems",
            params={
                "id": f"eq.{system_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": SYSTEM_SELECT,
            },
        )
    )
    require(ctx, "systems.edit", resource=ResourceRef(type="site", site_id=existing["site_id"]))
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    row = patched_or_403(
        client.patch(
            "systems",
            patch,
            params={"id": f"eq.{system_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )
    return _system_out(row)


@router.get("/equipment")
def list_equipment(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    site_id: str = Query(...),
    limit: int = Query(default=100, ge=1, le=200),
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.view")
    rows = as_list(
        client.get(
            "equipment",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "site_id": f"eq.{site_id}",
                "select": EQUIPMENT_SELECT,
                "order": "created_at.desc",
                "limit": str(limit),
            },
        )
    )
    return {"items": [_equipment_out(row).model_dump() for row in rows]}


@router.post("/equipment", response_model=EquipmentOut)
def create_equipment(
    workspace_id: UUID,
    body: EquipmentCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> EquipmentOut:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.edit", resource=ResourceRef(type="site", site_id=body.site_id))
    one_or_404(
        client.get(
            "sites",
            params={"id": f"eq.{body.site_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )
    row = created_or_403(
        client.post(
            "equipment",
            {
                "workspace_id": str(workspace_id),
                **body.model_dump(exclude_none=True),
            },
        )
    )
    return _equipment_out(row)


@router.patch("/equipment/{equipment_id}", response_model=EquipmentOut)
def patch_equipment(
    workspace_id: UUID,
    equipment_id: UUID,
    body: EquipmentPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> EquipmentOut:
    ctx = _ctx(client, user, workspace_id)
    existing = one_or_404(
        client.get(
            "equipment",
            params={
                "id": f"eq.{equipment_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": EQUIPMENT_SELECT,
            },
        )
    )
    require(ctx, "systems.edit", resource=ResourceRef(type="site", site_id=existing["site_id"]))
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין מה לעדכן")
    row = patched_or_403(
        client.patch(
            "equipment",
            patch,
            params={"id": f"eq.{equipment_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )
    return _equipment_out(row)
