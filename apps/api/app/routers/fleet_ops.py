"""FleetMaster API — maintenance, equipment, assignments, schedules."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..audit import write_audit
from ..authz.guard import require
from ..deps import UserClient, current_user, user_client
from ..errors import ApiError, MESSAGES
from ..rest import as_list, created_or_403, one_or_404, patched_or_403
from .fleet_shared import (
    ASSIGN_SELECT,
    EQUIP_SELECT,
    MAINT_SELECT,
    ROUTER_PREFIX,
    ROUTER_TAGS,
    SCHED_SELECT,
    AssignmentCreate,
    EquipmentCreate,
    EquipmentPatch,
    MaintenanceCreate,
    MaintenancePatch,
    ScheduleCreate,
    SchedulePatch,
    assert_department_access,
    ctx,
    get_vehicle,
    managerial,
    now_iso,
)

router = APIRouter(prefix=ROUTER_PREFIX, tags=ROUTER_TAGS)


# ── Maintenance ───────────────────────────────────────────────────────────────


@router.get("/fleet/vehicles/{vehicle_id}/maintenance")
def list_maintenance(
    workspace_id: UUID,
    vehicle_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.maintenance")
    get_vehicle(client, workspace_id, vehicle_id)
    rows = as_list(
        client.get(
            "fleet_maintenance",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "vehicle_id": f"eq.{vehicle_id}",
                "select": MAINT_SELECT,
                "order": "performed_on.desc",
                "limit": "200",
            },
        )
    )
    return {"items": rows}


@router.post("/fleet/vehicles/{vehicle_id}/maintenance")
def create_maintenance(
    workspace_id: UUID,
    vehicle_id: UUID,
    body: MaintenanceCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.maintenance")
    vehicle = get_vehicle(client, workspace_id, vehicle_id)
    assert_department_access(client, workspace_id, str(vehicle["department_id"]), c.user_id, managerial(c))
    performed = body.performed_on or date.today()
    payload = {
        "workspace_id": str(workspace_id),
        "department_id": vehicle["department_id"],
        "vehicle_id": str(vehicle_id),
        "maintenance_type": body.maintenance_type,
        "mileage": body.mileage,
        "performed_on": performed.isoformat(),
        "next_mileage": body.next_mileage,
        "provider": body.provider,
        "cost_cents": body.cost_cents,
        "description": body.description,
        "notes": body.notes,
        "created_by": c.user_id,
    }
    row = created_or_403(client.post("fleet_maintenance", json=payload, params={"select": MAINT_SELECT}))
    if body.update_vehicle:
        vpatch: dict[str, Any] = {"updated_by": c.user_id, "updated_at": now_iso()}
        if body.mileage is not None:
            vpatch["last_service_mileage"] = body.mileage
        vpatch["last_service_at"] = performed.isoformat()
        if body.next_mileage is not None:
            vpatch["next_service_mileage"] = body.next_mileage
        if body.maintenance_type == "service":
            vpatch["status"] = "active"
        patched_or_403(
            client.patch(
                "fleet_vehicles",
                json=vpatch,
                params={"id": f"eq.{vehicle_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
            )
        )
    write_audit(
        client,
        str(workspace_id),
        "fleet.maintenance.create",
        entity_type="fleet_maintenance",
        entity_id=row.get("id"),
        metadata={"vehicle_id": str(vehicle_id)},
    )
    return row


@router.patch("/fleet/maintenance/{maintenance_id}")
def patch_maintenance(
    workspace_id: UUID,
    maintenance_id: UUID,
    body: MaintenancePatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.maintenance")
    patch = body.model_dump(exclude_unset=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין שדות לעדכון")
    if "performed_on" in patch and patch["performed_on"] is not None:
        patch["performed_on"] = patch["performed_on"].isoformat()
    patch["updated_at"] = now_iso()
    row = patched_or_403(
        client.patch(
            "fleet_maintenance",
            json=patch,
            params={
                "id": f"eq.{maintenance_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": MAINT_SELECT,
            },
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "fleet.maintenance.update",
        entity_type="fleet_maintenance",
        entity_id=str(maintenance_id),
    )
    return row


# ── Equipment ─────────────────────────────────────────────────────────────────


@router.get("/fleet/vehicles/{vehicle_id}/equipment")
def list_equipment(
    workspace_id: UUID,
    vehicle_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.equipment")
    get_vehicle(client, workspace_id, vehicle_id)
    rows = as_list(
        client.get(
            "fleet_vehicle_equipment",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "vehicle_id": f"eq.{vehicle_id}",
                "select": EQUIP_SELECT,
                "order": "created_at.desc",
            },
        )
    )
    return {"items": rows}


@router.post("/fleet/vehicles/{vehicle_id}/equipment")
def create_equipment(
    workspace_id: UUID,
    vehicle_id: UUID,
    body: EquipmentCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.equipment")
    vehicle = get_vehicle(client, workspace_id, vehicle_id)
    payload = {
        "workspace_id": str(workspace_id),
        "department_id": vehicle["department_id"],
        "vehicle_id": str(vehicle_id),
        "equipment_type": body.equipment_type.strip(),
        "name": body.name.strip(),
        "serial_number": body.serial_number,
        "status": body.status,
        "installation_date": body.installation_date.isoformat() if body.installation_date else None,
        "notes": body.notes,
        "created_by": c.user_id,
    }
    row = created_or_403(client.post("fleet_vehicle_equipment", json=payload, params={"select": EQUIP_SELECT}))
    write_audit(
        client,
        str(workspace_id),
        "fleet.equipment.create",
        entity_type="fleet_vehicle_equipment",
        entity_id=row.get("id"),
    )
    return row


@router.patch("/fleet/equipment/{equipment_id}")
def patch_equipment(
    workspace_id: UUID,
    equipment_id: UUID,
    body: EquipmentPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.equipment")
    patch = body.model_dump(exclude_unset=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין שדות לעדכון")
    if "installation_date" in patch and patch["installation_date"] is not None:
        patch["installation_date"] = patch["installation_date"].isoformat()
    if "name" in patch and patch["name"]:
        patch["name"] = patch["name"].strip()
    if "equipment_type" in patch and patch["equipment_type"]:
        patch["equipment_type"] = patch["equipment_type"].strip()
    patch["updated_at"] = now_iso()
    return patched_or_403(
        client.patch(
            "fleet_vehicle_equipment",
            json=patch,
            params={
                "id": f"eq.{equipment_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": EQUIP_SELECT,
            },
        )
    )


@router.delete("/fleet/equipment/{equipment_id}")
def delete_equipment(
    workspace_id: UUID,
    equipment_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.equipment")
    res = client.delete(
        "fleet_vehicle_equipment",
        params={"id": f"eq.{equipment_id}", "workspace_id": f"eq.{workspace_id}"},
        prefer="return=minimal",
    )
    if res.status_code not in {200, 204}:
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    write_audit(
        client,
        str(workspace_id),
        "fleet.equipment.delete",
        entity_type="fleet_vehicle_equipment",
        entity_id=str(equipment_id),
    )
    return {"ok": True}


# ── Assignments ───────────────────────────────────────────────────────────────


@router.get("/fleet/vehicles/{vehicle_id}/assignments")
def list_assignments(
    workspace_id: UUID,
    vehicle_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.assignments")
    get_vehicle(client, workspace_id, vehicle_id)
    rows = as_list(
        client.get(
            "fleet_assignments",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "vehicle_id": f"eq.{vehicle_id}",
                "select": ASSIGN_SELECT,
                "order": "starts_at.desc",
            },
        )
    )
    return {"items": rows}


@router.post("/fleet/vehicles/{vehicle_id}/assignments")
def create_assignment(
    workspace_id: UUID,
    vehicle_id: UUID,
    body: AssignmentCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.assignments")
    vehicle = get_vehicle(client, workspace_id, vehicle_id)
    starts = body.starts_at or datetime.now(timezone.utc)
    payload = {
        "workspace_id": str(workspace_id),
        "department_id": vehicle["department_id"],
        "vehicle_id": str(vehicle_id),
        "user_id": body.user_id,
        "starts_at": starts.isoformat(),
        "notes": body.notes,
        "created_by": c.user_id,
    }
    row = created_or_403(client.post("fleet_assignments", json=payload, params={"select": ASSIGN_SELECT}))
    if body.set_as_current:
        patched_or_403(
            client.patch(
                "fleet_vehicles",
                json={
                    "assigned_user_id": body.user_id,
                    "updated_by": c.user_id,
                    "updated_at": now_iso(),
                },
                params={"id": f"eq.{vehicle_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
            )
        )
    write_audit(
        client,
        str(workspace_id),
        "fleet.assignment.create",
        entity_type="fleet_assignment",
        entity_id=row.get("id"),
        metadata={"user_id": body.user_id, "vehicle_id": str(vehicle_id)},
    )
    return row


@router.post("/fleet/assignments/{assignment_id}/end")
def end_assignment(
    workspace_id: UUID,
    assignment_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.assignments")
    assignment = one_or_404(
        client.get(
            "fleet_assignments",
            params={
                "id": f"eq.{assignment_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": ASSIGN_SELECT,
                "limit": "1",
            },
        )
    )
    row = patched_or_403(
        client.patch(
            "fleet_assignments",
            json={"ends_at": now_iso()},
            params={
                "id": f"eq.{assignment_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": ASSIGN_SELECT,
            },
        )
    )
    vehicle = get_vehicle(client, workspace_id, assignment["vehicle_id"])
    if str(vehicle.get("assigned_user_id") or "") == str(assignment.get("user_id") or ""):
        patched_or_403(
            client.patch(
                "fleet_vehicles",
                json={
                    "assigned_user_id": None,
                    "updated_by": c.user_id,
                    "updated_at": now_iso(),
                },
                params={
                    "id": f"eq.{assignment['vehicle_id']}",
                    "workspace_id": f"eq.{workspace_id}",
                    "select": "id",
                },
            )
        )
    write_audit(
        client,
        str(workspace_id),
        "fleet.assignment.end",
        entity_type="fleet_assignment",
        entity_id=str(assignment_id),
    )
    return row


# ── Schedules ─────────────────────────────────────────────────────────────────


@router.get("/fleet/schedules")
def list_schedules(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    department_id: str | None = Query(default=None),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    user_id: str | None = Query(default=None),
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.schedules")
    if department_id:
        assert_department_access(client, workspace_id, department_id, c.user_id, managerial(c))
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": SCHED_SELECT,
        "order": "schedule_date.asc,start_time.asc",
        "limit": "500",
    }
    if department_id:
        params["department_id"] = f"eq.{department_id}"
    if user_id:
        params["user_id"] = f"eq.{user_id}"
    if from_date and to_date:
        params["and"] = f"(schedule_date.gte.{from_date.isoformat()},schedule_date.lte.{to_date.isoformat()})"
    elif from_date:
        params["schedule_date"] = f"gte.{from_date.isoformat()}"
    elif to_date:
        params["schedule_date"] = f"lte.{to_date.isoformat()}"
    return {"items": as_list(client.get("fleet_schedules", params=params))}


@router.post("/fleet/schedules")
def create_schedule(
    workspace_id: UUID,
    body: ScheduleCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.schedules")
    assert_department_access(client, workspace_id, body.department_id, c.user_id, managerial(c))
    if body.start_time == body.end_time:
        raise ApiError(400, "VALIDATION_ERROR", "שעת התחלה וסיום חייבות להיות שונות")
    payload = {
        "workspace_id": str(workspace_id),
        "department_id": body.department_id,
        "user_id": body.user_id,
        "vehicle_id": body.vehicle_id,
        "schedule_date": body.schedule_date.isoformat(),
        "start_time": body.start_time,
        "end_time": body.end_time,
        "shift_label": body.shift_label,
        "location": body.location,
        "notes": body.notes,
        "created_by": c.user_id,
    }
    row = created_or_403(client.post("fleet_schedules", json=payload, params={"select": SCHED_SELECT}))
    write_audit(
        client,
        str(workspace_id),
        "fleet.schedule.create",
        entity_type="fleet_schedule",
        entity_id=row.get("id"),
    )
    return row


@router.patch("/fleet/schedules/{schedule_id}")
def patch_schedule(
    workspace_id: UUID,
    schedule_id: UUID,
    body: SchedulePatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.schedules")
    patch = body.model_dump(exclude_unset=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין שדות לעדכון")
    if "schedule_date" in patch and patch["schedule_date"] is not None:
        patch["schedule_date"] = patch["schedule_date"].isoformat()
    if "department_id" in patch and patch["department_id"]:
        assert_department_access(client, workspace_id, patch["department_id"], c.user_id, managerial(c))
    start = patch.get("start_time")
    end = patch.get("end_time")
    if start is not None and end is not None and start == end:
        raise ApiError(400, "VALIDATION_ERROR", "שעת התחלה וסיום חייבות להיות שונות")
    patch["updated_at"] = now_iso()
    return patched_or_403(
        client.patch(
            "fleet_schedules",
            json=patch,
            params={
                "id": f"eq.{schedule_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": SCHED_SELECT,
            },
        )
    )


@router.delete("/fleet/schedules/{schedule_id}")
def delete_schedule(
    workspace_id: UUID,
    schedule_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.schedules")
    res = client.delete(
        "fleet_schedules",
        params={"id": f"eq.{schedule_id}", "workspace_id": f"eq.{workspace_id}"},
        prefer="return=minimal",
    )
    if res.status_code not in {200, 204}:
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    write_audit(
        client,
        str(workspace_id),
        "fleet.schedule.delete",
        entity_type="fleet_schedule",
        entity_id=str(schedule_id),
    )
    return {"ok": True}
