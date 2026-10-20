"""FleetMaster API — departments, dashboard, vehicles, mileage."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..audit import write_audit
from ..authz.guard import require
from ..deps import UserClient, current_user, user_client
from ..errors import ApiError, MESSAGES
from ..fleet_logic import fleet_permissions_subset, maintenance_status, normalize_license_plate, validate_mileage_update
from ..pagination import decode_cursor, page_from_rows, parse_limit
from ..rest import as_list, created_or_403, patched_or_403
from .fleet_shared import (
    DEPT_SELECT,
    MILEAGE_SELECT,
    ROUTER_PREFIX,
    ROUTER_TAGS,
    VEHICLE_SELECT,
    DepartmentCreate,
    DepartmentMemberIn,
    DepartmentPatch,
    MileageIn,
    VehicleCreate,
    VehiclePatch,
    accessible_departments,
    assert_department_access,
    ctx,
    enrich_vehicle,
    get_vehicle,
    managerial,
    now_iso,
)

router = APIRouter(prefix=ROUTER_PREFIX, tags=ROUTER_TAGS)


# ── Departments ───────────────────────────────────────────────────────────────


@router.get("/fleet/departments")
def list_departments(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.view")
    return {"items": accessible_departments(client, workspace_id)}


@router.post("/fleet/departments")
def create_department(
    workspace_id: UUID,
    body: DepartmentCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.departments")
    payload = {
        "workspace_id": str(workspace_id),
        "key": body.key.strip().lower(),
        "name_he": body.name_he.strip(),
        "name_en": (body.name_en.strip() if body.name_en else None),
        "sort_order": body.sort_order,
        "is_active": body.is_active,
        "modules": body.modules or {},
    }
    row = created_or_403(client.post("departments", json=payload))
    write_audit(
        client,
        str(workspace_id),
        "fleet.department.create",
        entity_type="department",
        entity_id=row.get("id"),
        metadata={"key": payload["key"]},
    )
    return row


@router.patch("/fleet/departments/{department_id}")
def patch_department(
    workspace_id: UUID,
    department_id: UUID,
    body: DepartmentPatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.departments")
    patch = body.model_dump(exclude_unset=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין שדות לעדכון")
    if "name_he" in patch and patch["name_he"]:
        patch["name_he"] = patch["name_he"].strip()
    if "name_en" in patch and patch["name_en"]:
        patch["name_en"] = patch["name_en"].strip()
    patch["updated_at"] = now_iso()
    row = patched_or_403(
        client.patch(
            "departments",
            json=patch,
            params={
                "id": f"eq.{department_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": DEPT_SELECT,
            },
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "fleet.department.update",
        entity_type="department",
        entity_id=str(department_id),
        metadata={"fields": list(patch.keys())},
    )
    return row


@router.post("/fleet/departments/{department_id}/members")
def add_department_member(
    workspace_id: UUID,
    department_id: UUID,
    body: DepartmentMemberIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.departments")
    assert_department_access(client, workspace_id, str(department_id), c.user_id, managerial(c))
    payload = {
        "workspace_id": str(workspace_id),
        "department_id": str(department_id),
        "user_id": body.user_id,
        "created_by": c.user_id,
    }
    row = created_or_403(client.post("department_memberships", json=payload))
    write_audit(
        client,
        str(workspace_id),
        "fleet.department.member_add",
        entity_type="department",
        entity_id=str(department_id),
        metadata={"user_id": body.user_id},
    )
    return row


@router.delete("/fleet/departments/{department_id}/members/{member_user_id}")
def remove_department_member(
    workspace_id: UUID,
    department_id: UUID,
    member_user_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.departments")
    res = client.delete(
        "department_memberships",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "department_id": f"eq.{department_id}",
            "user_id": f"eq.{member_user_id}",
        },
        prefer="return=minimal",
    )
    if res.status_code not in {200, 204}:
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    write_audit(
        client,
        str(workspace_id),
        "fleet.department.member_remove",
        entity_type="department",
        entity_id=str(department_id),
        metadata={"user_id": str(member_user_id)},
    )
    return {"ok": True}


@router.get("/fleet/my-access")
def my_access(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.view")
    depts = accessible_departments(client, workspace_id)
    return {
        "workspace_id": str(workspace_id),
        "role_key": c.role_key,
        "workspace_role_key": c.workspace_role_key,
        "managerial": managerial(c),
        "departments": depts,
        "permissions": fleet_permissions_subset(c.grants),
        "features": sorted(f for f in c.features if f == "fleet" or f.startswith("fleet")),
    }


# ── Dashboard ─────────────────────────────────────────────────────────────────


@router.get("/fleet/dashboard")
def fleet_dashboard(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    department_id: str | None = Query(default=None),
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.view")
    is_mgr = managerial(c)
    if department_id:
        assert_department_access(client, workspace_id, department_id, c.user_id, is_mgr)

    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "archived_at": "is.null",
        "select": VEHICLE_SELECT,
        "limit": "2000",
    }
    if department_id:
        params["department_id"] = f"eq.{department_id}"
    vehicles = as_list(client.get("fleet_vehicles", params=params))

    by_status: dict[str, int] = {}
    by_department: dict[str, int] = {}
    maintenance_due = 0
    maintenance_soon = 0
    total_mileage = 0
    soon = date.today() + timedelta(days=30)
    expiring_tests: list[dict] = []
    expiring_insurance: list[dict] = []

    for v in vehicles:
        st = str(v.get("status") or "unknown")
        by_status[st] = by_status.get(st, 0) + 1
        did = str(v.get("department_id") or "")
        by_department[did] = by_department.get(did, 0) + 1
        total_mileage += int(v.get("current_mileage") or 0)
        ms = maintenance_status(v.get("current_mileage"), v.get("next_service_mileage"), v.get("maintenance_soon_km"))
        if ms == "due":
            maintenance_due += 1
        elif ms == "soon":
            maintenance_soon += 1
        ted = v.get("test_expiry_date")
        if ted:
            try:
                d = date.fromisoformat(str(ted)[:10])
                if d <= soon:
                    expiring_tests.append(
                        {"id": v["id"], "license_plate": v.get("license_plate"), "test_expiry_date": ted}
                    )
            except ValueError:
                pass
        ied = v.get("insurance_expiry_date")
        if ied:
            try:
                d = date.fromisoformat(str(ied)[:10])
                if d <= soon:
                    expiring_insurance.append(
                        {
                            "id": v["id"],
                            "license_plate": v.get("license_plate"),
                            "insurance_expiry_date": ied,
                        }
                    )
            except ValueError:
                pass

    mileage_params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": MILEAGE_SELECT,
        "order": "recorded_at.desc",
        "limit": "10",
    }
    if department_id:
        mileage_params["department_id"] = f"eq.{department_id}"
    recent_mileage = as_list(client.get("fleet_mileage_logs", params=mileage_params))

    result: dict[str, Any] = {
        "total": len(vehicles),
        "by_status": by_status,
        "maintenance_due": maintenance_due,
        "maintenance_soon": maintenance_soon,
        "expiring_tests": expiring_tests,
        "expiring_insurance": expiring_insurance,
        "total_mileage": total_mileage,
        "recent_mileage_logs": recent_mileage,
    }
    if is_mgr:
        result["by_department"] = by_department
    return result


# ── Vehicles ──────────────────────────────────────────────────────────────────


@router.get("/fleet/vehicles")
def list_vehicles(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    q: str | None = Query(default=None),
    department_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    vehicle_type: str | None = Query(default=None),
    manufacturer: str | None = Query(default=None),
    assigned_user_id: str | None = Query(default=None),
    include_archived: bool = Query(default=False),
    limit: int | None = Query(default=50),
    cursor: str | None = Query(default=None),
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.view")
    if department_id:
        assert_department_access(client, workspace_id, department_id, c.user_id, managerial(c))

    page_size = parse_limit(limit)
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": VEHICLE_SELECT,
        "order": "created_at.desc",
        "limit": str(page_size + 1),
    }
    if not include_archived:
        params["archived_at"] = "is.null"
    if department_id:
        params["department_id"] = f"eq.{department_id}"
    if status:
        params["status"] = f"eq.{status}"
    if vehicle_type:
        params["vehicle_type"] = f"eq.{vehicle_type}"
    if manufacturer:
        params["manufacturer"] = f"ilike.*{manufacturer.strip()}*"
    if assigned_user_id:
        params["assigned_user_id"] = f"eq.{assigned_user_id}"
    if q:
        needle = q.strip()
        params["or"] = (
            f"(license_plate.ilike.*{needle}*,manufacturer.ilike.*{needle}*,"
            f"model.ilike.*{needle}*,notes.ilike.*{needle}*)"
        )
    before = decode_cursor(cursor)
    if before:
        params["created_at"] = f"lt.{before}"
    rows = [enrich_vehicle(r) for r in as_list(client.get("fleet_vehicles", params=params))]
    page = page_from_rows(rows, page_size)
    return {"items": page.items, "next_cursor": page.next_cursor}


@router.post("/fleet/vehicles")
def create_vehicle(
    workspace_id: UUID,
    body: VehicleCreate,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.create")
    assert_department_access(client, workspace_id, body.department_id, c.user_id, managerial(c))

    plate = normalize_license_plate(body.license_plate)
    if not plate:
        raise ApiError(400, "VALIDATION_ERROR", "מספר רישוי חסר")
    existing = as_list(
        client.get(
            "fleet_vehicles",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "license_plate": f"eq.{plate}",
                "select": "id",
                "limit": "1",
            },
        )
    )
    if existing:
        raise ApiError(409, "CONFLICT", f"מספר רישוי כבר קיים בסביבה: {plate}")

    payload = {
        "workspace_id": str(workspace_id),
        "department_id": body.department_id,
        "license_plate": plate,
        "vehicle_type": body.vehicle_type,
        "manufacturer": body.manufacturer,
        "model": body.model,
        "year": body.year,
        "current_mileage": body.current_mileage,
        "service_interval_km": body.service_interval_km,
        "next_service_mileage": body.next_service_mileage,
        "status": body.status,
        "assigned_user_id": body.assigned_user_id,
        "notes": body.notes,
        "test_expiry_date": body.test_expiry_date.isoformat() if body.test_expiry_date else None,
        "insurance_provider": body.insurance_provider,
        "insurance_policy_number": body.insurance_policy_number,
        "insurance_expiry_date": body.insurance_expiry_date.isoformat() if body.insurance_expiry_date else None,
        "maintenance_soon_km": body.maintenance_soon_km,
        "created_by": c.user_id,
        "updated_by": c.user_id,
    }
    row = created_or_403(client.post("fleet_vehicles", json=payload, params={"select": VEHICLE_SELECT}))
    write_audit(
        client,
        str(workspace_id),
        "fleet.vehicle.create",
        entity_type="fleet_vehicle",
        entity_id=row.get("id"),
        metadata={"license_plate": plate},
    )
    return enrich_vehicle(row)


@router.get("/fleet/vehicles/{vehicle_id}")
def get_vehicle_endpoint(
    workspace_id: UUID,
    vehicle_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.view")
    return enrich_vehicle(get_vehicle(client, workspace_id, vehicle_id))


@router.patch("/fleet/vehicles/{vehicle_id}")
def patch_vehicle(
    workspace_id: UUID,
    vehicle_id: UUID,
    body: VehiclePatch,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.edit")
    existing = get_vehicle(client, workspace_id, vehicle_id)
    is_mgr = managerial(c)
    assert_department_access(client, workspace_id, str(existing["department_id"]), c.user_id, is_mgr)
    patch = body.model_dump(exclude_unset=True)
    if not patch:
        raise ApiError(400, "VALIDATION_ERROR", "אין שדות לעדכון")
    if "department_id" in patch and patch["department_id"]:
        assert_department_access(client, workspace_id, patch["department_id"], c.user_id, is_mgr)
    if "license_plate" in patch:
        plate = normalize_license_plate(patch["license_plate"])
        if not plate:
            raise ApiError(400, "VALIDATION_ERROR", "מספר רישוי חסר")
        dup = as_list(
            client.get(
                "fleet_vehicles",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "license_plate": f"eq.{plate}",
                    "id": f"neq.{vehicle_id}",
                    "select": "id",
                    "limit": "1",
                },
            )
        )
        if dup:
            raise ApiError(409, "CONFLICT", f"מספר רישוי כבר קיים בסביבה: {plate}")
        patch["license_plate"] = plate
    for key in ("test_expiry_date", "insurance_expiry_date", "last_service_at"):
        if key in patch and patch[key] is not None and hasattr(patch[key], "isoformat"):
            patch[key] = patch[key].isoformat()
    patch["updated_by"] = c.user_id
    patch["updated_at"] = now_iso()
    row = patched_or_403(
        client.patch(
            "fleet_vehicles",
            json=patch,
            params={
                "id": f"eq.{vehicle_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": VEHICLE_SELECT,
            },
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "fleet.vehicle.update",
        entity_type="fleet_vehicle",
        entity_id=str(vehicle_id),
        metadata={"fields": list(patch.keys())},
    )
    return enrich_vehicle(row)


@router.post("/fleet/vehicles/{vehicle_id}/archive")
def archive_vehicle(
    workspace_id: UUID,
    vehicle_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.delete")
    existing = get_vehicle(client, workspace_id, vehicle_id)
    assert_department_access(client, workspace_id, str(existing["department_id"]), c.user_id, managerial(c))
    row = patched_or_403(
        client.patch(
            "fleet_vehicles",
            json={
                "archived_at": now_iso(),
                "archived_by": c.user_id,
                "updated_by": c.user_id,
                "updated_at": now_iso(),
            },
            params={
                "id": f"eq.{vehicle_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": VEHICLE_SELECT,
            },
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "fleet.vehicle.archive",
        entity_type="fleet_vehicle",
        entity_id=str(vehicle_id),
    )
    return enrich_vehicle(row)


@router.get("/fleet/my-vehicle")
def my_vehicle(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.view")
    rows = as_list(
        client.get(
            "fleet_vehicles",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "assigned_user_id": f"eq.{c.user_id}",
                "archived_at": "is.null",
                "select": VEHICLE_SELECT,
                "order": "updated_at.desc",
                "limit": "1",
            },
        )
    )
    if not rows:
        return {"vehicle": None}
    return {"vehicle": enrich_vehicle(rows[0])}


# ── Mileage ───────────────────────────────────────────────────────────────────


@router.post("/fleet/vehicles/{vehicle_id}/mileage")
def add_mileage(
    workspace_id: UUID,
    vehicle_id: UUID,
    body: MileageIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.mileage")
    vehicle = get_vehicle(client, workspace_id, vehicle_id)
    if vehicle.get("archived_at"):
        raise ApiError(400, "RESOURCE_STATE", "לא ניתן לעדכן קילומטראז' לרכב בארכיון")
    previous = int(vehicle.get("current_mileage") or 0)
    distance = validate_mileage_update(previous, body.mileage)
    log_payload = {
        "workspace_id": str(workspace_id),
        "department_id": vehicle["department_id"],
        "vehicle_id": str(vehicle_id),
        "previous_mileage": previous,
        "mileage": body.mileage,
        "distance_since_previous": distance,
        "recorded_by": c.user_id,
        "source": body.source or "manual",
        "notes": body.notes,
    }
    log_row = created_or_403(client.post("fleet_mileage_logs", json=log_payload, params={"select": MILEAGE_SELECT}))
    patched_or_403(
        client.patch(
            "fleet_vehicles",
            json={
                "current_mileage": body.mileage,
                "updated_by": c.user_id,
                "updated_at": now_iso(),
            },
            params={"id": f"eq.{vehicle_id}", "workspace_id": f"eq.{workspace_id}", "select": "id"},
        )
    )
    write_audit(
        client,
        str(workspace_id),
        "fleet.mileage.create",
        entity_type="fleet_vehicle",
        entity_id=str(vehicle_id),
        metadata={"mileage": body.mileage, "previous": previous, "distance": distance},
    )
    return log_row


@router.get("/fleet/vehicles/{vehicle_id}/mileage")
def list_vehicle_mileage(
    workspace_id: UUID,
    vehicle_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    limit: int | None = Query(default=50),
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.mileage_history")
    get_vehicle(client, workspace_id, vehicle_id)
    page_size = parse_limit(limit)
    rows = as_list(
        client.get(
            "fleet_mileage_logs",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "vehicle_id": f"eq.{vehicle_id}",
                "select": MILEAGE_SELECT,
                "order": "recorded_at.desc",
                "limit": str(page_size),
            },
        )
    )
    return {"items": rows}


@router.get("/fleet/mileage")
def list_workspace_mileage(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    department_id: str | None = Query(default=None),
    vehicle_id: str | None = Query(default=None),
    limit: int | None = Query(default=50),
    cursor: str | None = Query(default=None),
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.mileage_history")
    if department_id:
        assert_department_access(client, workspace_id, department_id, c.user_id, managerial(c))
    page_size = parse_limit(limit)
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "select": MILEAGE_SELECT,
        "order": "recorded_at.desc",
        "limit": str(page_size + 1),
    }
    if department_id:
        params["department_id"] = f"eq.{department_id}"
    if vehicle_id:
        params["vehicle_id"] = f"eq.{vehicle_id}"
    before = decode_cursor(cursor)
    if before:
        params["recorded_at"] = f"lt.{before}"
    rows = as_list(client.get("fleet_mileage_logs", params=params))
    page = page_from_rows(rows, page_size, cursor_field="recorded_at")
    return {"items": page.items, "next_cursor": page.next_cursor}
