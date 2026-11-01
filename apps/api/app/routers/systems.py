from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..audit import write_audit
from ..authz.guard import require
from ..authz.types import ResourceRef
from ..deps import UserClient, current_user, load_authz_context, service_client, user_client
from ..equipment_asset import validate_equipment_provenance
from ..errors import ApiError
from ..identity import actor_id
from ..rest import acked_or_403, as_list, created_or_403, one_or_404, patched_or_403
from ..supabase_service import ServiceClient

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["systems"])

SYSTEM_SELECT = (
    "id,workspace_id,site_id,type,name,status,manufacturer,model,panel_id,metadata,created_at,updated_at"
)
EQUIPMENT_SELECT = (
    "id,workspace_id,site_id,system_id,zone_id,category,status,name,manufacturer,model,"
    "serial,mac,ip,location_note,installed_at,product_id,project_id,project_planned_item_id,"
    "asset_code,created_at,updated_at"
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
    zone_id: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    serial: str | None = None
    mac: str | None = None
    ip: str | None = None
    location_note: str | None = None
    installed_at: str | None = None
    product_id: str | None = None
    project_id: str | None = None
    project_planned_item_id: str | None = None
    asset_code: str | None = None


class EquipmentPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=200)
    status: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    serial: str | None = None
    mac: str | None = None
    ip: str | None = None
    location_note: str | None = None
    system_id: str | None = None
    zone_id: str | None = None
    installed_at: str | None = None
    product_id: str | None = None
    project_id: str | None = None
    project_planned_item_id: str | None = None
    asset_code: str | None = None


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
    zone_id: str | None = None
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
    product_id: str | None = None
    project_id: str | None = None
    project_planned_item_id: str | None = None
    asset_code: str | None = None
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
        zone_id=row.get("zone_id"),
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
        product_id=row.get("product_id"),
        project_id=row.get("project_id"),
        project_planned_item_id=row.get("project_planned_item_id"),
        asset_code=row.get("asset_code"),
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
    proven = validate_equipment_provenance(
        client,
        workspace_id=workspace_id,
        site_id=body.site_id,
        product_id=body.product_id,
        project_id=body.project_id,
        project_planned_item_id=body.project_planned_item_id,
        system_id=body.system_id,
        zone_id=body.zone_id,
        asset_code=body.asset_code,
    )
    row = created_or_403(
        client.post(
            "equipment",
            {
                "workspace_id": str(workspace_id),
                **body.model_dump(exclude_none=True),
                **proven,
            },
        )
    )
    return _equipment_out(row)


@router.get("/equipment/{equipment_id}", response_model=EquipmentOut)
def get_equipment(
    workspace_id: UUID,
    equipment_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> EquipmentOut:
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.view")
    row = one_or_404(
        client.get(
            "equipment",
            params={
                "id": f"eq.{equipment_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": EQUIPMENT_SELECT,
            },
        )
    )
    return _equipment_out(row)


@router.get("/equipment/{equipment_id}/lifecycle-activity")
def list_equipment_lifecycle_activity(
    workspace_id: UUID,
    equipment_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    ctx = _ctx(client, user, workspace_id)
    require(ctx, "systems.view")
    row = one_or_404(
        client.get(
            "equipment",
            params={
                "id": f"eq.{equipment_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": EQUIPMENT_SELECT,
            },
        )
    )
    items: list[dict] = [
        {
            "id": f"created-{row['id']}",
            "kind": "asset_created",
            "at": row.get("created_at"),
            "title": row.get("name") or "ציוד",
            "detail": row.get("asset_code"),
            "metadata": {},
            "href": None,
        }
    ]
    if row.get("installed_at"):
        items.append(
            {
                "id": f"installed-{row['id']}",
                "kind": "installed",
                "at": row.get("installed_at"),
                "title": row.get("name") or "ציוד",
                "detail": None,
                "metadata": {},
                "href": None,
            }
        )
    for call in as_list(
        client.get(
            "service_calls",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "equipment_id": f"eq.{equipment_id}",
                "select": "id,title,number,status,created_at,updated_at",
                "order": "created_at.desc",
                "limit": "50",
            },
        )
    ):
        items.append(
            {
                "id": str(call.get("id") or ""),
                "kind": "service",
                "at": call.get("updated_at") or call.get("created_at"),
                "title": call.get("title") or call.get("number") or "קריאת שירות",
                "detail": call.get("status"),
                "metadata": {"status": call.get("status"), "number": call.get("number")},
                "href": {"type": "service_call", "id": str(call.get("id") or "")},
            }
        )
    items.sort(key=lambda item: str(item.get("at") or ""), reverse=True)
    return {"items": items, "source": "live"}


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
    if any(
        key in patch
        for key in (
            "product_id",
            "project_id",
            "project_planned_item_id",
            "system_id",
            "zone_id",
            "asset_code",
        )
    ):
        proven = validate_equipment_provenance(
            client,
            workspace_id=workspace_id,
            site_id=str(existing["site_id"]),
            product_id=patch.get("product_id"),
            project_id=patch.get("project_id"),
            project_planned_item_id=patch.get("project_planned_item_id"),
            system_id=patch.get("system_id"),
            zone_id=patch.get("zone_id"),
            asset_code=patch.get("asset_code"),
            exclude_equipment_id=str(equipment_id),
        )
        patch.update(proven)
    row = patched_or_403(
        client.patch(
            "equipment",
            patch,
            params={"id": f"eq.{equipment_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "equipment.updated",
        entity_type="equipment",
        entity_id=str(equipment_id),
        metadata=patch,
    )
    return _equipment_out(row)


@router.delete("/equipment/{equipment_id}")
def delete_equipment(
    workspace_id: UUID,
    equipment_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    svc: Annotated[ServiceClient, Depends(service_client)],
) -> dict:
    ctx = _ctx(client, user, workspace_id)
    existing = one_or_404(
        client.get(
            "equipment",
            params={
                "id": f"eq.{equipment_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": "id,site_id,name",
            },
        )
    )
    require(ctx, "systems.edit", resource=ResourceRef(type="site", site_id=existing.get("site_id")))
    linked_calls = as_list(
        client.get(
            "service_calls",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "equipment_id": f"eq.{equipment_id}",
                "select": "id",
                "limit": "1",
            },
        )
    )
    linked_warranties = as_list(
        client.get(
            "warranties",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "installed_equipment_id": f"eq.{equipment_id}",
                "select": "id",
                "limit": "1",
            },
        )
    )
    if linked_calls or linked_warranties:
        raise ApiError(
            409,
            "RESOURCE_IN_USE",
            "לא ניתן למחוק ציוד שמקושר לקריאת שירות או לאחריות",
        )
    acked_or_403(
        svc.delete(
            "equipment",
            params={"id": f"eq.{equipment_id}", "workspace_id": f"eq.{workspace_id}"},
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "equipment.deleted",
        entity_type="equipment",
        entity_id=str(equipment_id),
        metadata={"name": existing.get("name"), "site_id": existing.get("site_id")},
    )
    return {"ok": True}
