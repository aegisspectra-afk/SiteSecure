"""Shared FleetMaster router helpers, selects, and Pydantic models."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from ..authz.types import AuthzContext
from ..deps import UserClient, load_authz_context
from ..errors import ApiError
from ..fleet_logic import is_managerial_role, maintenance_status
from ..identity import actor_id
from ..rest import as_list, one_or_404

VEHICLE_SELECT = (
    "id,workspace_id,department_id,license_plate,vehicle_type,manufacturer,model,year,"
    "current_mileage,service_interval_km,next_service_mileage,last_service_mileage,"
    "last_service_at,status,assigned_user_id,notes,test_expiry_date,insurance_provider,"
    "insurance_policy_number,insurance_expiry_date,maintenance_soon_km,"
    "archived_at,archived_by,created_by,updated_by,created_at,updated_at"
)
DEPT_SELECT = "id,workspace_id,key,name_he,name_en,sort_order,is_active,modules,created_at,updated_at"
MILEAGE_SELECT = (
    "id,workspace_id,department_id,vehicle_id,previous_mileage,mileage,"
    "distance_since_previous,recorded_by,recorded_at,source,notes"
)
MAINT_SELECT = (
    "id,workspace_id,department_id,vehicle_id,maintenance_type,mileage,performed_on,"
    "next_mileage,provider,cost_cents,description,notes,created_by,created_at,updated_at"
)
EQUIP_SELECT = (
    "id,workspace_id,department_id,vehicle_id,equipment_type,name,serial_number,"
    "status,installation_date,notes,created_by,created_at,updated_at"
)
ASSIGN_SELECT = (
    "id,workspace_id,department_id,vehicle_id,user_id,starts_at,ends_at,notes,"
    "created_by,created_at"
)
SCHED_SELECT = (
    "id,workspace_id,department_id,user_id,vehicle_id,schedule_date,start_time,end_time,"
    "shift_label,location,notes,created_by,created_at,updated_at"
)

REPORT_KEYS = frozenset(
    {
        "vehicles",
        "by_department",
        "mileage",
        "maintenance",
        "expiring_tests",
        "expiring_insurance",
        "assignments",
        "overview",
    }
)

DEMO_DEPARTMENTS = (
    {"key": "patrol", "name_he": "סיור", "name_en": "Patrol", "sort_order": 10},
    {"key": "security", "name_he": "אבטחה", "name_en": "Security", "sort_order": 20},
    {"key": "technical", "name_he": "טכני", "name_en": "Technical", "sort_order": 30},
    {"key": "fleet", "name_he": "צי רכב", "name_en": "Fleet", "sort_order": 40},
)

ROUTER_PREFIX = "/api/v1/workspaces/{workspace_id}"
ROUTER_TAGS = ["fleet"]


def ctx(client: UserClient, user: dict, workspace_id: UUID) -> AuthzContext:
    return load_authz_context(client, actor_id(user), str(workspace_id))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def assert_department_access(
    client: UserClient,
    workspace_id: UUID,
    department_id: str,
    user_id: str,
    managerial: bool,
) -> dict:
    """Load department via user client (RLS). For non-managerial, also require membership row."""
    dept = one_or_404(
        client.get(
            "departments",
            params={
                "id": f"eq.{department_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": DEPT_SELECT,
                "limit": "1",
            },
        )
    )
    if managerial:
        return dept
    memberships = as_list(
        client.get(
            "department_memberships",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "department_id": f"eq.{department_id}",
                "user_id": f"eq.{user_id}",
                "select": "id",
                "limit": "1",
            },
        )
    )
    if not memberships:
        raise ApiError(403, "PERMISSION_DENIED", "אין גישה למחלקה זו")
    return dept


def accessible_departments(client: UserClient, workspace_id: UUID) -> list[dict]:
    return as_list(
        client.get(
            "departments",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "is_active": "eq.true",
                "select": DEPT_SELECT,
                "order": "sort_order.asc",
            },
        )
    )


def get_vehicle(client: UserClient, workspace_id: UUID, vehicle_id: UUID | str) -> dict:
    return one_or_404(
        client.get(
            "fleet_vehicles",
            params={
                "id": f"eq.{vehicle_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": VEHICLE_SELECT,
                "limit": "1",
            },
        )
    )


def enrich_vehicle(row: dict) -> dict:
    out = dict(row)
    out["maintenance_status"] = maintenance_status(
        row.get("current_mileage"),
        row.get("next_service_mileage"),
        row.get("maintenance_soon_km"),
    )
    return out


def managerial(ctx_obj: AuthzContext) -> bool:
    return is_managerial_role(ctx_obj.role_key)


# ── Pydantic models ──────────────────────────────────────────────────────────


class DepartmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: str = Field(min_length=1, max_length=64)
    name_he: str = Field(min_length=1, max_length=120)
    name_en: str | None = Field(default=None, max_length=120)
    sort_order: int = 0
    is_active: bool = True
    modules: dict | None = None


class DepartmentPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name_he: str | None = Field(default=None, min_length=1, max_length=120)
    name_en: str | None = Field(default=None, max_length=120)
    sort_order: int | None = None
    is_active: bool | None = None
    modules: dict | None = None


class DepartmentMemberIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: str = Field(min_length=1)


class VehicleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    department_id: str
    license_plate: str = Field(min_length=1, max_length=32)
    vehicle_type: str = "car"
    manufacturer: str | None = None
    model: str | None = None
    year: int | None = None
    current_mileage: int = Field(default=0, ge=0)
    service_interval_km: int | None = Field(default=None, gt=0)
    next_service_mileage: int | None = Field(default=None, ge=0)
    status: str = "active"
    assigned_user_id: str | None = None
    notes: str | None = None
    test_expiry_date: date | None = None
    insurance_provider: str | None = None
    insurance_policy_number: str | None = None
    insurance_expiry_date: date | None = None
    maintenance_soon_km: int = Field(default=1000, ge=0)


class VehiclePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    department_id: str | None = None
    license_plate: str | None = Field(default=None, min_length=1, max_length=32)
    vehicle_type: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    year: int | None = None
    current_mileage: int | None = Field(default=None, ge=0)
    service_interval_km: int | None = Field(default=None, gt=0)
    next_service_mileage: int | None = Field(default=None, ge=0)
    last_service_mileage: int | None = Field(default=None, ge=0)
    last_service_at: date | None = None
    status: str | None = None
    assigned_user_id: str | None = None
    notes: str | None = None
    test_expiry_date: date | None = None
    insurance_provider: str | None = None
    insurance_policy_number: str | None = None
    insurance_expiry_date: date | None = None
    maintenance_soon_km: int | None = Field(default=None, ge=0)


class MileageIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mileage: int = Field(ge=0)
    notes: str | None = None
    source: str = "manual"


class MaintenanceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    maintenance_type: str = "service"
    mileage: int | None = Field(default=None, ge=0)
    performed_on: date | None = None
    next_mileage: int | None = Field(default=None, ge=0)
    provider: str | None = None
    cost_cents: int | None = Field(default=None, ge=0)
    description: str | None = None
    notes: str | None = None
    update_vehicle: bool = True


class MaintenancePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    maintenance_type: str | None = None
    mileage: int | None = Field(default=None, ge=0)
    performed_on: date | None = None
    next_mileage: int | None = Field(default=None, ge=0)
    provider: str | None = None
    cost_cents: int | None = Field(default=None, ge=0)
    description: str | None = None
    notes: str | None = None


class EquipmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    equipment_type: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=200)
    serial_number: str | None = None
    status: str = "active"
    installation_date: date | None = None
    notes: str | None = None


class EquipmentPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    equipment_type: str | None = Field(default=None, min_length=1, max_length=80)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    serial_number: str | None = None
    status: str | None = None
    installation_date: date | None = None
    notes: str | None = None


class AssignmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: str = Field(min_length=1)
    starts_at: datetime | None = None
    notes: str | None = None
    set_as_current: bool = True


class ScheduleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    department_id: str
    user_id: str = Field(min_length=1)
    vehicle_id: str | None = None
    schedule_date: date
    start_time: str = Field(min_length=1, max_length=16)
    end_time: str = Field(min_length=1, max_length=16)
    shift_label: str | None = None
    location: str | None = None
    notes: str | None = None


class SchedulePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    department_id: str | None = None
    user_id: str | None = None
    vehicle_id: str | None = None
    schedule_date: date | None = None
    start_time: str | None = Field(default=None, min_length=1, max_length=16)
    end_time: str | None = Field(default=None, min_length=1, max_length=16)
    shift_label: str | None = None
    location: str | None = None
    notes: str | None = None


class ImportPreviewIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rows: list[dict[str, Any]] = Field(default_factory=list)
    column_map: dict[str, str] | None = None
    header_row: int | None = None
    raw_rows: list[list[Any]] | None = None
    department_id: str | None = None


class ImportCommitIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rows: list[dict[str, Any]] = Field(min_length=1)
    department_id: str
    confirmed: bool = False
