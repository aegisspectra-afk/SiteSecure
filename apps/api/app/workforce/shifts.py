"""Manual weekly shifts. No publish, optimizer, or notifications."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from ..errors import ApiError, MESSAGES
from .store import (
    SHIFT_SELECT,
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
    validation,
)

MAX_SHIFT = timedelta(hours=36)


def _parse_dt(value: str | None, label: str) -> datetime:
    raw = (value or "").strip()
    if not raw:
        raise validation(f"{label} חובה")
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        raise validation(f"{label} אינו תקין") from None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _validate_range(starts: datetime, ends: datetime) -> None:
    if ends <= starts:
        raise validation("שעת הסיום חייבת להיות אחרי שעת ההתחלה")
    if ends - starts > MAX_SHIFT:
        raise validation("משך המשמרת אינו תקין")


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
    start = _parse_dt(starts_from, "תחילת טווח")
    end = _parse_dt(starts_to, "סוף טווח")
    if end <= start:
        raise validation("טווח התאריכים אינו תקין")
    found = rows(
        store.get(
            "workforce_shifts",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "and": f"(starts_at.gte.{_iso(start)},starts_at.lt.{_iso(end)})",
                "select": SHIFT_SELECT,
                "order": "starts_at.asc",
                "limit": "1000",
            },
        )
    )
    related = _related_for(store, workspace_id, found)
    return [shift_out(row, related) for row in found]


def get_shift(store: WorkforceTableStore, workspace_id: str, shift_id: str) -> dict[str, Any]:
    row = must_get(store, "workforce_shifts", workspace_id, shift_id, SHIFT_SELECT)
    return shift_out(row, _related_for(store, workspace_id, [row]))


def _assert_active_employee(store: WorkforceTableStore, workspace_id: str, employee_id: str) -> None:
    row = get_one(
        store,
        "workforce_employees",
        {
            "id": f"eq.{employee_id}",
            "workspace_id": f"eq.{workspace_id}",
            "select": "id,workspace_id,employment_status",
        },
    )
    if not row:
        raise validation("עובד אינו שייך לסביבה זו")
    if row.get("employment_status") == "terminated":
        raise validation("לא ניתן לשבץ עובד שהעסקתו הסתיימה")


def _assert_active_site(store: WorkforceTableStore, workspace_id: str, site_id: str) -> dict:
    row = get_one(
        store,
        "workforce_sites",
        {"id": f"eq.{site_id}", "workspace_id": f"eq.{workspace_id}", "select": "id,workspace_id,region_id,is_active"},
    )
    if not row:
        raise validation("אתר אינו שייך לסביבה זו")
    return row


def _reject_overlap(
    store: WorkforceTableStore,
    workspace_id: str,
    *,
    employee_id: str,
    starts: datetime,
    ends: datetime,
    exclude_id: str | None = None,
) -> None:
    found = rows(
        store.get(
            "workforce_shifts",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "employee_id": f"eq.{employee_id}",
                "and": f"(starts_at.lt.{_iso(ends)},ends_at.gt.{_iso(starts)})",
                "select": "id,starts_at,ends_at",
                "limit": "20",
            },
        )
    )
    for row in found:
        if exclude_id and str(row.get("id") or "") == exclude_id:
            continue
        raise validation("לעובד כבר יש משמרת חופפת בטווח הזה")


def create_shift(
    store: WorkforceTableStore,
    workspace_id: str,
    payload: dict[str, Any],
    *,
    actor_user_id: str | None = None,
) -> dict[str, Any]:
    employee_id = require_uuid(payload.get("employee_id"), "עובד")
    site_id = require_uuid(payload.get("site_id"), "אתר")
    if not employee_id or not site_id:
        raise validation("יש לבחור עובד ואתר")
    _assert_active_employee(store, workspace_id, employee_id)
    site = _assert_active_site(store, workspace_id, site_id)
    position_id = require_uuid(payload.get("position_id"), "משרה")
    assert_ref(store, "workforce_positions", workspace_id, position_id, "משרה")
    region_id = require_uuid(payload.get("region_id"), "אזור")
    if region_id:
        assert_ref(store, "workforce_regions", workspace_id, region_id, "אזור")
    elif site.get("region_id"):
        region_id = str(site["region_id"])
    starts = _parse_dt(payload.get("starts_at"), "שעת התחלה")
    ends = _parse_dt(payload.get("ends_at"), "שעת סיום")
    _validate_range(starts, ends)
    _reject_overlap(store, workspace_id, employee_id=employee_id, starts=starts, ends=ends)
    body = {
        "workspace_id": workspace_id,
        "employee_id": employee_id,
        "site_id": site_id,
        "region_id": region_id,
        "position_id": position_id,
        "starts_at": _iso(starts),
        "ends_at": _iso(ends),
        "notes": optional_code(payload.get("notes")),
        "created_by": actor_user_id,
    }
    row = created_row(
        store.post("workforce_shifts", json=body, params={"select": SHIFT_SELECT}),
        conflict_message="לא ניתן ליצור את המשמרת",
    )
    return shift_out(row, _related_for(store, workspace_id, [row]))


def update_shift(
    store: WorkforceTableStore,
    workspace_id: str,
    shift_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    current = must_get(store, "workforce_shifts", workspace_id, shift_id, SHIFT_SELECT)
    patch: dict[str, Any] = {}
    employee_id = require_uuid(payload.get("employee_id"), "עובד") if "employee_id" in payload else None
    site_id = require_uuid(payload.get("site_id"), "אתר") if "site_id" in payload else None
    if "employee_id" in payload:
        if not employee_id:
            raise validation("יש לבחור עובד")
        _assert_active_employee(store, workspace_id, employee_id)
        patch["employee_id"] = employee_id
    if "site_id" in payload:
        if not site_id:
            raise validation("יש לבחור אתר")
        site = _assert_active_site(store, workspace_id, site_id)
        patch["site_id"] = site_id
        if "region_id" not in payload and site.get("region_id") and not current.get("region_id"):
            patch["region_id"] = str(site["region_id"])
    if "region_id" in payload:
        region_id = require_uuid(payload.get("region_id"), "אזור")
        assert_ref(store, "workforce_regions", workspace_id, region_id, "אזור")
        patch["region_id"] = region_id
    if "position_id" in payload:
        position_id = require_uuid(payload.get("position_id"), "משרה")
        assert_ref(store, "workforce_positions", workspace_id, position_id, "משרה")
        patch["position_id"] = position_id
    starts = _parse_dt(payload.get("starts_at"), "שעת התחלה") if payload.get("starts_at") else None
    ends = _parse_dt(payload.get("ends_at"), "שעת סיום") if payload.get("ends_at") else None
    if starts is None and payload.get("starts_at") == "":
        raise validation("שעת התחלה חובה")
    if ends is None and payload.get("ends_at") == "":
        raise validation("שעת סיום חובה")
    next_starts = starts or _parse_dt(str(current.get("starts_at") or ""), "שעת התחלה")
    next_ends = ends or _parse_dt(str(current.get("ends_at") or ""), "שעת סיום")
    if starts or ends:
        _validate_range(next_starts, next_ends)
        patch["starts_at"] = _iso(next_starts)
        patch["ends_at"] = _iso(next_ends)
    if "notes" in payload:
        patch["notes"] = optional_code(payload.get("notes"))
    if not patch:
        raise validation("אין שדות לעדכון")
    next_employee = str(patch.get("employee_id") or current.get("employee_id") or "")
    if next_employee:
        _reject_overlap(
            store,
            workspace_id,
            employee_id=next_employee,
            starts=next_starts,
            ends=next_ends,
            exclude_id=shift_id,
        )
    row = patched_row(
        store.patch(
            "workforce_shifts",
            patch,
            params={"id": f"eq.{shift_id}", "workspace_id": f"eq.{workspace_id}", "select": SHIFT_SELECT},
        ),
        conflict_message="לא ניתן לעדכן את המשמרת",
    )
    if not row.get("id"):
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    return shift_out(row, _related_for(store, workspace_id, [row]))


def delete_shift(store: WorkforceTableStore, workspace_id: str, shift_id: str) -> None:
    must_get(store, "workforce_shifts", workspace_id, shift_id, "id,workspace_id")
    if exists(store, "workforce_shifts", {"id": f"eq.{shift_id}", "workspace_id": f"eq.{workspace_id}"}):
        res = store.delete(
            "workforce_shifts",
            params={"id": f"eq.{shift_id}", "workspace_id": f"eq.{workspace_id}"},
        )
        status = getattr(res, "status_code", None)
        if status not in {200, 204}:
            raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
