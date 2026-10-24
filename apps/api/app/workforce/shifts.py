"""Manual weekly assignments. Demand lives on slots, not nullable employee_id."""

from __future__ import annotations

from typing import Any

from ..errors import ApiError, MESSAGES
from .clock import overlaps, parse_dt, site_zone, to_iso
from .store import (
    DEFAULT_SITE_TIMEZONE,
    SHIFT_SELECT,
    SHIFT_SELECT_LEGACY,
    WorkforceTableStore,
    assert_ref,
    created_row,
    exists,
    get_one,
    must_get,
    optional_code,
    patched_row,
    require_uuid,
    rows,
    rows_with_fallback,
    validation,
)
from .validation import overlapping_rows, raise_if_hard, validate_assignment


def _map_by_id(store: WorkforceTableStore, table: str, workspace_id: str, ids: set[str], select: str) -> dict[str, dict]:
    wanted = {item for item in ids if item}
    if not wanted:
        return {}
    found = rows(
        store.get(
            table,
            params={
                "workspace_id": f"eq.{workspace_id}",
                "id": f"in.({','.join(sorted(wanted))})",
                "select": select,
                "limit": str(max(len(wanted), 1)),
            },
        )
    )
    return {str(row.get("id") or ""): row for row in found}


def shift_out(row: dict, related: dict[str, dict[str, dict]] | None = None) -> dict[str, Any]:
    employee_id = str(row["employee_id"]) if row.get("employee_id") else None
    site_id = str(row["site_id"]) if row.get("site_id") else None
    region_id = str(row["region_id"]) if row.get("region_id") else None
    position_id = str(row["position_id"]) if row.get("position_id") else None
    slot_id = str(row["slot_id"]) if row.get("slot_id") else None
    employees = (related or {}).get("employees") or {}
    sites = (related or {}).get("sites") or {}
    regions = (related or {}).get("regions") or {}
    positions = (related or {}).get("positions") or {}
    employee = employees.get(employee_id or "")
    site = sites.get(site_id or "")
    region = regions.get(region_id or "")
    position = positions.get(position_id or "")
    return {
        "id": str(row.get("id") or ""),
        "workspace_id": str(row.get("workspace_id") or ""),
        "employee_id": employee_id,
        "site_id": site_id,
        "region_id": region_id,
        "position_id": position_id,
        "slot_id": slot_id,
        "starts_at": row.get("starts_at"),
        "ends_at": row.get("ends_at"),
        "notes": row.get("notes"),
        "created_by": str(row["created_by"]) if row.get("created_by") else None,
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
        "employee_name": (
            f"{employee.get('first_name') or ''} {employee.get('last_name') or ''}".strip() if employee else None
        ),
        "site_name": (site or {}).get("name"),
        "region_name": (region or {}).get("name"),
        "position_name": (position or {}).get("name"),
    }


def _related_for(store: WorkforceTableStore, workspace_id: str, found: list[dict]) -> dict[str, dict[str, dict]]:
    return {
        "employees": _map_by_id(
            store,
            "workforce_employees",
            workspace_id,
            {str(row.get("employee_id") or "") for row in found},
            "id,first_name,last_name",
        ),
        "sites": _map_by_id(
            store,
            "workforce_sites",
            workspace_id,
            {str(row.get("site_id") or "") for row in found},
            "id,name,region_id",
        ),
        "regions": _map_by_id(
            store,
            "workforce_regions",
            workspace_id,
            {str(row.get("region_id") or "") for row in found},
            "id,name",
        ),
        "positions": _map_by_id(
            store,
            "workforce_positions",
            workspace_id,
            {str(row.get("position_id") or "") for row in found},
            "id,name",
        ),
    }


def list_shifts(
    store: WorkforceTableStore,
    workspace_id: str,
    *,
    starts_from: str,
    starts_to: str,
) -> list[dict[str, Any]]:
    start = parse_dt(starts_from, "תחילת טווח")
    end = parse_dt(starts_to, "סוף טווח")
    if end <= start:
        raise validation("טווח התאריכים אינו תקין")
    found = overlapping_rows(
        store,
        "workforce_shifts",
        workspace_id,
        start,
        end,
        select=SHIFT_SELECT,
        fallback_select=SHIFT_SELECT_LEGACY,
        limit=1000,
    )
    related = _related_for(store, workspace_id, found)
    return [shift_out(row, related) for row in found]


def _linked_employee(store: WorkforceTableStore, workspace_id: str, actor_user_id: str) -> dict:
    found = get_one(
        store,
        "workforce_employees",
        {
            "workspace_id": f"eq.{workspace_id}",
            "user_id": f"eq.{actor_user_id}",
            "select": "id,workspace_id,user_id,first_name,last_name,employment_status",
        },
    )
    if not found:
        raise ApiError(404, "WORKFORCE_EMPLOYEE_NOT_LINKED", MESSAGES["WORKFORCE_EMPLOYEE_NOT_LINKED"])
    return found


def my_shift_out(row: dict, related: dict[str, dict[str, dict]] | None = None) -> dict[str, Any]:
    mapped = shift_out(row, related)
    site = ((related or {}).get("sites") or {}).get(mapped.get("site_id") or "") or {}
    timezone_name = (site.get("timezone") or DEFAULT_SITE_TIMEZONE).strip() or DEFAULT_SITE_TIMEZONE
    zone = site_zone(timezone_name)
    start = parse_dt(str(mapped.get("starts_at") or ""), "התחלה").astimezone(zone)
    end = parse_dt(str(mapped.get("ends_at") or ""), "סיום").astimezone(zone)
    return {
        "id": mapped["id"],
        "starts_at": mapped["starts_at"],
        "ends_at": mapped["ends_at"],
        "local_date": start.date().isoformat(),
        "starts_local": start.strftime("%H:%M"),
        "ends_local": end.strftime("%H:%M"),
        "timezone": zone.key,
        "site_id": mapped["site_id"],
        "site_name": mapped["site_name"],
        "region_id": mapped["region_id"],
        "region_name": mapped["region_name"],
        "position_id": mapped["position_id"],
        "position_name": mapped["position_name"],
        "notes": mapped["notes"],
        "status": "assigned",
        "overnight": start.date() != end.date(),
    }


def list_my_shifts(
    store: WorkforceTableStore,
    workspace_id: str,
    actor_user_id: str,
    *,
    starts_from: str,
    starts_to: str,
    directory: WorkforceTableStore | None = None,
) -> dict[str, Any]:
    employee = _linked_employee(store, workspace_id, actor_user_id)
    start = parse_dt(starts_from, "תחילת טווח")
    end = parse_dt(starts_to, "סוף טווח")
    if end <= start:
        raise validation("טווח התאריכים אינו תקין")
    found = overlapping_rows(
        store,
        "workforce_shifts",
        workspace_id,
        start,
        end,
        extra={"employee_id": f"eq.{employee['id']}"},
        select=SHIFT_SELECT,
        fallback_select=SHIFT_SELECT_LEGACY,
        limit=500,
    )
    mine: list[dict] = []
    employee_id = str(employee["id"])
    for row in found:
        if str(row.get("employee_id") or "") != employee_id:
            continue
        try:
            row_start = parse_dt(str(row.get("starts_at") or ""), "התחלה")
            row_end = parse_dt(str(row.get("ends_at") or ""), "סיום")
        except ApiError:
            continue
        if overlaps(row_start, row_end, start, end):
            mine.append(row)
    related = _related_for(directory or store, workspace_id, mine)
    return {
        "employee": {
            "id": employee_id,
            "first_name": employee.get("first_name") or "",
            "last_name": employee.get("last_name") or "",
        },
        "starts_from": to_iso(start),
        "starts_to": to_iso(end),
        "items": [my_shift_out(row, related) for row in mine],
    }


def get_shift(store: WorkforceTableStore, workspace_id: str, shift_id: str) -> dict[str, Any]:
    row = must_get(
        store,
        "workforce_shifts",
        workspace_id,
        shift_id,
        SHIFT_SELECT,
        fallback_select=SHIFT_SELECT_LEGACY,
    )
    return shift_out(row, _related_for(store, workspace_id, [row]))


def create_shift(
    store: WorkforceTableStore,
    workspace_id: str,
    payload: dict[str, Any],
    *,
    actor_user_id: str | None = None,
    writer: WorkforceTableStore | None = None,
) -> dict[str, Any]:
    result = validate_assignment(store, workspace_id, payload)
    raise_if_hard(result)
    employee_id = result["employee_id"]
    site_id = result["site_id"]
    position_id = result["position_id"]
    slot_id = result["slot_id"]
    region_id = require_uuid(payload.get("region_id"), "אזור") if payload.get("region_id") else result.get("region_id")
    if region_id:
        assert_ref(store, "workforce_regions", workspace_id, region_id, "אזור")
    body = {
        "workspace_id": workspace_id,
        "employee_id": employee_id,
        "site_id": site_id,
        "region_id": region_id,
        "position_id": position_id,
        "starts_at": result["starts_at"],
        "ends_at": result["ends_at"],
        "notes": optional_code(payload.get("notes")),
        "created_by": actor_user_id,
    }
    if slot_id:
        body["slot_id"] = slot_id
    write = writer or store
    row = created_row(
        write.post("workforce_shifts", json=body, params={"select": SHIFT_SELECT if slot_id else SHIFT_SELECT_LEGACY}),
        conflict_message="לא ניתן ליצור את המשמרת",
    )
    return shift_out(row, _related_for(store, workspace_id, [row]))


def update_shift(
    store: WorkforceTableStore,
    workspace_id: str,
    shift_id: str,
    payload: dict[str, Any],
    *,
    writer: WorkforceTableStore | None = None,
) -> dict[str, Any]:
    current = must_get(
        store,
        "workforce_shifts",
        workspace_id,
        shift_id,
        SHIFT_SELECT,
        fallback_select=SHIFT_SELECT_LEGACY,
    )
    merged = {
        "employee_id": payload.get("employee_id", current.get("employee_id")),
        "site_id": payload.get("site_id", current.get("site_id")),
        "region_id": payload.get("region_id", current.get("region_id")),
        "position_id": payload.get("position_id", current.get("position_id")),
        "slot_id": payload.get("slot_id", current.get("slot_id")),
        "starts_at": payload.get("starts_at", current.get("starts_at")),
        "ends_at": payload.get("ends_at", current.get("ends_at")),
    }
    if payload.get("starts_at") == "":
        raise validation("שעת התחלה חובה")
    if payload.get("ends_at") == "":
        raise validation("שעת סיום חובה")
    result = validate_assignment(store, workspace_id, merged, exclude_shift_id=shift_id)
    raise_if_hard(result)
    patch: dict[str, Any] = {}
    if "employee_id" in payload:
        patch["employee_id"] = result["employee_id"]
    if "site_id" in payload:
        patch["site_id"] = result["site_id"]
        if "region_id" not in payload and result.get("region_id") and not current.get("region_id"):
            patch["region_id"] = result["region_id"]
    if "region_id" in payload:
        region_id = require_uuid(payload.get("region_id"), "אזור")
        assert_ref(store, "workforce_regions", workspace_id, region_id, "אזור")
        patch["region_id"] = region_id
    if "position_id" in payload:
        patch["position_id"] = result["position_id"]
    if "slot_id" in payload:
        patch["slot_id"] = result["slot_id"]
    if "starts_at" in payload or "ends_at" in payload:
        patch["starts_at"] = result["starts_at"]
        patch["ends_at"] = result["ends_at"]
    if "notes" in payload:
        patch["notes"] = optional_code(payload.get("notes"))
    if not patch:
        raise validation("אין שדות לעדכון")
    write = writer or store
    row = patched_row(
        write.patch(
            "workforce_shifts",
            patch,
            params={
                "id": f"eq.{shift_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": SHIFT_SELECT if "slot_id" in patch else SHIFT_SELECT_LEGACY,
            },
        ),
        conflict_message="לא ניתן לעדכן את המשמרת",
    )
    if not row.get("id"):
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    return shift_out(row, _related_for(store, workspace_id, [row]))


def delete_shift(
    store: WorkforceTableStore,
    workspace_id: str,
    shift_id: str,
    *,
    writer: WorkforceTableStore | None = None,
) -> None:
    must_get(store, "workforce_shifts", workspace_id, shift_id, "id,workspace_id")
    if exists(store, "workforce_shifts", {"id": f"eq.{shift_id}", "workspace_id": f"eq.{workspace_id}"}):
        write = writer or store
        res = write.delete(
            "workforce_shifts",
            params={"id": f"eq.{shift_id}", "workspace_id": f"eq.{workspace_id}"},
        )
        status = getattr(res, "status_code", None)
        if status not in {200, 204}:
            raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
