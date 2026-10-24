"""Coverage demand, weekly slots, policy, time-off, and qualifications."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from ..errors import ApiError, MESSAGES
from .clock import local_window_to_utc, parse_dt, parse_local_time, sunday_index, to_iso
from .store import (
    COVERAGE_SELECT,
    POLICY_SELECT,
    POS_REQ_SELECT,
    QUAL_SELECT,
    SLOT_SELECT,
    TIME_OFF_SELECT,
    WorkforceTableStore,
    assert_ref,
    created_row,
    get_one,
    must_get,
    optional_code,
    patched_row,
    require_uuid,
    rows,
    validation,
)
from .validation import load_policy, overlapping_rows, week_coverage_issues

TIME_OFF_KINDS = frozenset({"vacation", "sick", "unpaid", "other"})
TIME_OFF_STATUSES = frozenset({"pending", "approved", "rejected"})
ENFORCEMENTS = frozenset({"required", "preferred"})


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


def _site_timezone(store: WorkforceTableStore, workspace_id: str, site_id: str) -> tuple[dict, str]:
    site = get_one(
        store,
        "workforce_sites",
        {
            "id": f"eq.{site_id}",
            "workspace_id": f"eq.{workspace_id}",
            "select": "id,workspace_id,region_id,is_active,timezone,name",
        },
    )
    if not site:
        raise validation("אתר אינו שייך לסביבה זו")
    return site, str(site.get("timezone") or "Asia/Jerusalem")


def coverage_out(row: dict, related: dict[str, dict[str, dict]] | None = None) -> dict[str, Any]:
    site_id = str(row["site_id"]) if row.get("site_id") else None
    position_id = str(row["position_id"]) if row.get("position_id") else None
    sites = (related or {}).get("sites") or {}
    positions = (related or {}).get("positions") or {}
    return {
        "id": str(row.get("id") or ""),
        "workspace_id": str(row.get("workspace_id") or ""),
        "site_id": site_id,
        "position_id": position_id,
        "weekday": int(row.get("weekday") or 0),
        "start_local": str(row.get("start_local") or "")[:8],
        "end_local": str(row.get("end_local") or "")[:8],
        "crosses_midnight": bool(row.get("crosses_midnight")),
        "required_count": int(row.get("required_count") or 1),
        "is_active": bool(row.get("is_active", True)),
        "notes": row.get("notes"),
        "site_name": (sites.get(site_id or "") or {}).get("name"),
        "position_name": (positions.get(position_id or "") or {}).get("name"),
        "timezone": (sites.get(site_id or "") or {}).get("timezone"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def slot_out(row: dict, related: dict[str, dict[str, dict]] | None = None, *, assigned_count: int = 0) -> dict[str, Any]:
    site_id = str(row["site_id"]) if row.get("site_id") else None
    position_id = str(row["position_id"]) if row.get("position_id") else None
    sites = (related or {}).get("sites") or {}
    positions = (related or {}).get("positions") or {}
    required = int(row.get("required_count") or 1)
    return {
        "id": str(row.get("id") or ""),
        "workspace_id": str(row.get("workspace_id") or ""),
        "site_id": site_id,
        "region_id": str(row["region_id"]) if row.get("region_id") else None,
        "position_id": position_id,
        "coverage_requirement_id": str(row["coverage_requirement_id"]) if row.get("coverage_requirement_id") else None,
        "starts_at": row.get("starts_at"),
        "ends_at": row.get("ends_at"),
        "required_count": required,
        "assigned_count": assigned_count,
        "unfilled_count": max(required - assigned_count, 0),
        "notes": row.get("notes"),
        "site_name": (sites.get(site_id or "") or {}).get("name"),
        "position_name": (positions.get(position_id or "") or {}).get("name"),
        "timezone": (sites.get(site_id or "") or {}).get("timezone"),
        "created_by": str(row["created_by"]) if row.get("created_by") else None,
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def _related_sites_positions(store: WorkforceTableStore, workspace_id: str, found: list[dict]) -> dict[str, dict[str, dict]]:
    return {
        "sites": _map_by_id(
            store,
            "workforce_sites",
            workspace_id,
            {str(row.get("site_id") or "") for row in found},
            "id,name,timezone",
        ),
        "positions": _map_by_id(
            store,
            "workforce_positions",
            workspace_id,
            {str(row.get("position_id") or "") for row in found},
            "id,name",
        ),
    }


def list_coverage(store: WorkforceTableStore, workspace_id: str) -> list[dict[str, Any]]:
    found = rows(
        store.get(
            "workforce_coverage_requirements",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "select": COVERAGE_SELECT,
                "order": "weekday.asc,start_local.asc",
                "limit": "500",
            },
        )
    )
    related = _related_sites_positions(store, workspace_id, found)
    return [coverage_out(row, related) for row in found]


def create_coverage(
    store: WorkforceTableStore,
    workspace_id: str,
    payload: dict[str, Any],
    *,
    actor_user_id: str | None = None,
) -> dict[str, Any]:
    site_id = require_uuid(payload.get("site_id"), "אתר")
    position_id = require_uuid(payload.get("position_id"), "משרה")
    if not site_id or not position_id:
        raise validation("יש לבחור אתר ומשרה")
    site, _tz = _site_timezone(store, workspace_id, site_id)
    assert_ref(store, "workforce_positions", workspace_id, position_id, "משרה")
    weekday = payload.get("weekday")
    try:
        weekday_i = int(weekday)
    except (TypeError, ValueError):
        raise validation("יום בשבוע אינו תקין") from None
    if weekday_i < 0 or weekday_i > 6:
        raise validation("יום בשבוע אינו תקין")
    start_local = parse_local_time(str(payload.get("start_local") or ""), "שעת התחלה מקומית")
    end_local = parse_local_time(str(payload.get("end_local") or ""), "שעת סיום מקומית")
    crosses = bool(payload.get("crosses_midnight") or end_local <= start_local)
    required = int(payload.get("required_count") or 1)
    if required < 1:
        raise validation("מספר העמדות הנדרש אינו תקין")
    body = {
        "workspace_id": workspace_id,
        "site_id": site_id,
        "position_id": position_id,
        "weekday": weekday_i,
        "start_local": start_local.isoformat(timespec="minutes"),
        "end_local": end_local.isoformat(timespec="minutes"),
        "crosses_midnight": crosses,
        "required_count": required,
        "is_active": bool(payload.get("is_active", True)),
        "notes": optional_code(payload.get("notes")),
        "created_by": actor_user_id,
    }
    row = created_row(
        store.post("workforce_coverage_requirements", json=body, params={"select": COVERAGE_SELECT}),
        conflict_message="דרישת כיסוי כבר קיימת לחלון הזה",
    )
    return coverage_out(row, _related_sites_positions(store, workspace_id, [row]))


def delete_coverage(store: WorkforceTableStore, workspace_id: str, coverage_id: str) -> None:
    must_get(store, "workforce_coverage_requirements", workspace_id, coverage_id, "id,workspace_id")
    res = store.delete(
        "workforce_coverage_requirements",
        params={"id": f"eq.{coverage_id}", "workspace_id": f"eq.{workspace_id}"},
    )
    status = getattr(res, "status_code", None)
    if status not in {200, 204}:
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])


def list_slots(
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
        "workforce_shift_slots",
        workspace_id,
        start,
        end,
        select=SLOT_SELECT,
        limit=1000,
    )
    related = _related_sites_positions(store, workspace_id, found)
    assignments = overlapping_rows(
        store,
        "workforce_shifts",
        workspace_id,
        start,
        end,
        select="id,slot_id",
        limit=1000,
    )
    counts: dict[str, int] = {}
    for row in assignments:
        slot_id = str(row.get("slot_id") or "")
        if slot_id:
            counts[slot_id] = counts.get(slot_id, 0) + 1
    return [slot_out(row, related, assigned_count=counts.get(str(row.get("id") or ""), 0)) for row in found]


def create_slot(
    store: WorkforceTableStore,
    workspace_id: str,
    payload: dict[str, Any],
    *,
    actor_user_id: str | None = None,
) -> dict[str, Any]:
    site_id = require_uuid(payload.get("site_id"), "אתר")
    position_id = require_uuid(payload.get("position_id"), "משרה")
    if not site_id or not position_id:
        raise validation("יש לבחור אתר ומשרה")
    site, _tz = _site_timezone(store, workspace_id, site_id)
    if site.get("is_active") is False:
        raise validation("לא ניתן לפתוח עמדה באתר שאינו פעיל")
    assert_ref(store, "workforce_positions", workspace_id, position_id, "משרה")
    coverage_id = require_uuid(payload.get("coverage_requirement_id"), "דרישת כיסוי") if payload.get("coverage_requirement_id") else None
    if coverage_id:
        assert_ref(store, "workforce_coverage_requirements", workspace_id, coverage_id, "דרישת כיסוי")
    starts = parse_dt(payload.get("starts_at"), "שעת התחלה")
    ends = parse_dt(payload.get("ends_at"), "שעת סיום")
    if ends <= starts:
        raise validation("שעת הסיום חייבת להיות אחרי שעת ההתחלה")
    required = _required_count(payload, default=1)
    region_id = require_uuid(payload.get("region_id"), "אזור") if payload.get("region_id") else None
    if region_id:
        assert_ref(store, "workforce_regions", workspace_id, region_id, "אזור")
    elif site.get("region_id"):
        region_id = str(site["region_id"])
    body = {
        "workspace_id": workspace_id,
        "site_id": site_id,
        "region_id": region_id,
        "position_id": position_id,
        "coverage_requirement_id": coverage_id,
        "starts_at": to_iso(starts),
        "ends_at": to_iso(ends),
        "required_count": required,
        "notes": optional_code(payload.get("notes")),
        "created_by": actor_user_id,
    }
    row = created_row(
        store.post("workforce_shift_slots", json=body, params={"select": SLOT_SELECT}),
        conflict_message="לא ניתן ליצור את העמדה",
    )
    return slot_out(row, _related_sites_positions(store, workspace_id, [row]))


def _required_count(payload: dict[str, Any], *, default: int) -> int:
    if "required_count" not in payload or payload.get("required_count") is None:
        return default
    try:
        required = int(payload.get("required_count"))
    except (TypeError, ValueError):
        raise validation("מספר העמדות הנדרש אינו תקין") from None
    if required < 1:
        raise validation("מספר העמדות הנדרש אינו תקין")
    return required


def slot_assignments(store: WorkforceTableStore, workspace_id: str, slot_id: str) -> list[dict]:
    return rows(
        store.get(
            "workforce_shifts",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "slot_id": f"eq.{slot_id}",
                "select": "id,employee_id,starts_at,ends_at,site_id,position_id",
                "limit": "200",
            },
        )
    )


def update_slot(
    store: WorkforceTableStore,
    workspace_id: str,
    slot_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    current = must_get(store, "workforce_shift_slots", workspace_id, slot_id, SLOT_SELECT)
    assigned = slot_assignments(store, workspace_id, slot_id)
    site_id = require_uuid(payload.get("site_id", current.get("site_id")), "אתר")
    position_id = require_uuid(payload.get("position_id", current.get("position_id")), "משרה")
    if not site_id or not position_id:
        raise validation("יש לבחור אתר ומשרה")
    site, _tz = _site_timezone(store, workspace_id, site_id)
    if site.get("is_active") is False:
        raise validation("לא ניתן לפתוח עמדה באתר שאינו פעיל")
    assert_ref(store, "workforce_positions", workspace_id, position_id, "משרה")
    starts = parse_dt(payload.get("starts_at", current.get("starts_at")), "שעת התחלה")
    ends = parse_dt(payload.get("ends_at", current.get("ends_at")), "שעת סיום")
    if ends <= starts:
        raise validation("שעת הסיום חייבת להיות אחרי שעת ההתחלה")
    required = _required_count(payload, default=int(current.get("required_count") or 1))
    if required < len(assigned):
        raise validation("לא ניתן להקטין את התקן מתחת למספר העובדים שכבר משובצים")
    current_site = str(current.get("site_id") or "")
    current_position = str(current.get("position_id") or "")
    if assigned and (site_id != current_site or position_id != current_position):
        raise validation("לא ניתן לשנות אתר או משרה למשמרת שיש בה שיבוצים")
    for row in assigned:
        asg_start = parse_dt(str(row.get("starts_at") or ""), "תחילת שיבוץ")
        asg_end = parse_dt(str(row.get("ends_at") or ""), "סיום שיבוץ")
        if asg_start < starts or asg_end > ends:
            raise validation("קיימים שיבוצים מחוץ לחלון השעות החדש")
    coverage_id = current.get("coverage_requirement_id")
    if "coverage_requirement_id" in payload:
        coverage_id = require_uuid(payload.get("coverage_requirement_id"), "דרישת כיסוי") if payload.get("coverage_requirement_id") else None
        if coverage_id:
            assert_ref(store, "workforce_coverage_requirements", workspace_id, coverage_id, "דרישת כיסוי")
    region_id = require_uuid(payload.get("region_id"), "אזור") if payload.get("region_id") else None
    if "region_id" in payload:
        if region_id:
            assert_ref(store, "workforce_regions", workspace_id, region_id, "אזור")
    elif site.get("region_id"):
        region_id = str(site["region_id"])
    else:
        region_id = str(current.get("region_id") or "") or None
    patch: dict[str, Any] = {
        "site_id": site_id,
        "region_id": region_id,
        "position_id": position_id,
        "coverage_requirement_id": coverage_id,
        "starts_at": to_iso(starts),
        "ends_at": to_iso(ends),
        "required_count": required,
    }
    if "notes" in payload:
        patch["notes"] = optional_code(payload.get("notes"))
    row = patched_row(
        store.patch(
            "workforce_shift_slots",
            patch,
            params={"id": f"eq.{slot_id}", "workspace_id": f"eq.{workspace_id}", "select": SLOT_SELECT},
        ),
        conflict_message="לא ניתן לעדכן את העמדה",
    )
    if not row.get("id"):
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    return slot_out(
        row,
        _related_sites_positions(store, workspace_id, [row]),
        assigned_count=len(assigned),
    )


def delete_slot(store: WorkforceTableStore, workspace_id: str, slot_id: str) -> None:
    must_get(store, "workforce_shift_slots", workspace_id, slot_id, "id,workspace_id")
    if slot_assignments(store, workspace_id, slot_id):
        raise ApiError(409, "WORKFORCE_SLOT_HAS_ASSIGNMENTS", MESSAGES["WORKFORCE_SLOT_HAS_ASSIGNMENTS"])
    res = store.delete(
        "workforce_shift_slots",
        params={"id": f"eq.{slot_id}", "workspace_id": f"eq.{workspace_id}"},
    )
    status = getattr(res, "status_code", None)
    if status not in {200, 204}:
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])


def materialize_slots(
    store: WorkforceTableStore,
    workspace_id: str,
    *,
    starts_from: str,
    starts_to: str,
    actor_user_id: str | None = None,
) -> list[dict[str, Any]]:
    start = parse_dt(starts_from, "תחילת טווח")
    end = parse_dt(starts_to, "סוף טווח")
    if end <= start:
        raise validation("טווח התאריכים אינו תקין")
    coverage = [
        row
        for row in rows(
            store.get(
                "workforce_coverage_requirements",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "select": COVERAGE_SELECT,
                    "limit": "500",
                },
            )
        )
        if row.get("is_active") is not False
    ]
    existing = overlapping_rows(
        store,
        "workforce_shift_slots",
        workspace_id,
        start,
        end,
        select=SLOT_SELECT,
        limit=1000,
    )
    existing_keys = {
        (
            str(row.get("site_id") or ""),
            str(row.get("position_id") or ""),
            str(row.get("starts_at") or ""),
        )
        for row in existing
    }
    created: list[dict[str, Any]] = []
    cursor = start.date()
    last = (end - timedelta(seconds=1)).date()
    while cursor <= last:
        for req in coverage:
            if int(req.get("weekday") or -1) != sunday_index(cursor):
                continue
            site, tz_name = _site_timezone(store, workspace_id, str(req.get("site_id") or ""))
            if site.get("is_active") is False:
                continue
            start_local = parse_local_time(str(req.get("start_local") or ""), "שעת התחלה מקומית")
            end_local = parse_local_time(str(req.get("end_local") or ""), "שעת סיום מקומית")
            utc_start, utc_end = local_window_to_utc(
                timezone_name=tz_name,
                on_date=cursor,
                start_local=start_local,
                end_local=end_local,
                crosses_midnight=bool(req.get("crosses_midnight")),
            )
            if utc_end <= start or utc_start >= end:
                continue
            key = (str(req.get("site_id") or ""), str(req.get("position_id") or ""), to_iso(utc_start))
            if key in existing_keys:
                continue
            created.append(
                create_slot(
                    store,
                    workspace_id,
                    {
                        "site_id": str(req.get("site_id") or ""),
                        "position_id": str(req.get("position_id") or ""),
                        "coverage_requirement_id": str(req.get("id") or ""),
                        "starts_at": to_iso(utc_start),
                        "ends_at": to_iso(utc_end),
                        "required_count": int(req.get("required_count") or 1),
                    },
                    actor_user_id=actor_user_id,
                )
            )
            existing_keys.add(key)
        cursor += timedelta(days=1)
    return created


def week_board(
    store: WorkforceTableStore,
    workspace_id: str,
    *,
    starts_from: str,
    starts_to: str,
) -> dict[str, Any]:
    from .shifts import list_shifts

    start = parse_dt(starts_from, "תחילת טווח")
    end = parse_dt(starts_to, "סוף טווח")

    def _optional(fn, default):
        try:
            return fn()
        except ApiError as exc:
            if exc.code == "WORKFORCE_SCHEMA_UNAVAILABLE":
                return default
            raise

    slots = _optional(lambda: list_slots(store, workspace_id, starts_from=starts_from, starts_to=starts_to), [])
    assignments = list_shifts(store, workspace_id, starts_from=starts_from, starts_to=starts_to)
    coverage = _optional(lambda: list_coverage(store, workspace_id), [])
    issues = _optional(
        lambda: week_coverage_issues(
            store,
            workspace_id,
            starts=start,
            ends=end,
            slots=slots,
            assignments=assignments,
        ),
        [],
    )
    return {
        "starts_from": to_iso(start),
        "starts_to": to_iso(end),
        "slots": slots,
        "assignments": assignments,
        "coverage": coverage,
        "issues": issues,
        "policy": load_policy(store, workspace_id),
        "legal_status": "not_certified",
        "certified_legal": False,
    }


def get_or_default_policy(store: WorkforceTableStore, workspace_id: str) -> dict[str, Any]:
    return load_policy(store, workspace_id)


def upsert_policy(store: WorkforceTableStore, workspace_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    current = get_one(
        store,
        "workforce_schedule_policies",
        {"workspace_id": f"eq.{workspace_id}", "select": POLICY_SELECT, "limit": "1"},
    )
    body: dict[str, Any] = {}
    if "max_shift_hours" in payload and payload.get("max_shift_hours") is not None:
        hours = float(payload["max_shift_hours"])
        if hours < 1 or hours > 48:
            raise validation("מגבלת משך משמרת אינה תקינה")
        body["max_shift_hours"] = hours
    if "min_rest_hours" in payload:
        rest = payload.get("min_rest_hours")
        body["min_rest_hours"] = None if rest is None or rest == "" else float(rest)
        if body["min_rest_hours"] is not None and body["min_rest_hours"] < 0:
            raise validation("מגבלת מנוחה אינה תקינה")
    if "rest_rule_enabled" in payload:
        body["rest_rule_enabled"] = bool(payload.get("rest_rule_enabled"))
    if "weekly_hour_cap" in payload:
        cap = payload.get("weekly_hour_cap")
        body["weekly_hour_cap"] = None if cap is None or cap == "" else float(cap)
    enabled = body.get("rest_rule_enabled", (current or {}).get("rest_rule_enabled"))
    rest_hours = body["min_rest_hours"] if "min_rest_hours" in body else (current or {}).get("min_rest_hours")
    if enabled and rest_hours is None:
        raise validation("לא ניתן להפעיל כלל מנוחה בלי מספר שעות מנוחה")
    if not current:
        body.setdefault("max_shift_hours", 36)
        body.setdefault("rest_rule_enabled", False)
        body["workspace_id"] = workspace_id
        row = created_row(
            store.post("workforce_schedule_policies", json=body, params={"select": POLICY_SELECT}),
            conflict_message="לא ניתן לשמור מדיניות",
        )
        return load_policy(store, workspace_id) if not row.get("workspace_id") else {
            "workspace_id": str(row.get("workspace_id") or workspace_id),
            "max_shift_hours": float(row.get("max_shift_hours") or 36),
            "min_rest_hours": float(row["min_rest_hours"]) if row.get("min_rest_hours") is not None else None,
            "rest_rule_enabled": bool(row.get("rest_rule_enabled")),
            "weekly_hour_cap": float(row["weekly_hour_cap"]) if row.get("weekly_hour_cap") is not None else None,
        }
    if not body:
        raise validation("אין שדות לעדכון")
    patched_row(
        store.patch(
            "workforce_schedule_policies",
            body,
            params={"workspace_id": f"eq.{workspace_id}", "select": POLICY_SELECT},
        ),
        conflict_message="לא ניתן לשמור מדיניות",
    )
    return load_policy(store, workspace_id)


def time_off_out(row: dict, related: dict[str, dict] | None = None) -> dict[str, Any]:
    employee_id = str(row["employee_id"]) if row.get("employee_id") else None
    employee = (related or {}).get(employee_id or "")
    return {
        "id": str(row.get("id") or ""),
        "workspace_id": str(row.get("workspace_id") or ""),
        "employee_id": employee_id,
        "starts_at": row.get("starts_at"),
        "ends_at": row.get("ends_at"),
        "kind": row.get("kind") or "vacation",
        "status": row.get("status") or "pending",
        "notes": row.get("notes"),
        "employee_name": (
            f"{employee.get('first_name') or ''} {employee.get('last_name') or ''}".strip() if employee else None
        ),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def list_time_off(
    store: WorkforceTableStore,
    workspace_id: str,
    *,
    starts_from: str,
    starts_to: str,
) -> list[dict[str, Any]]:
    start = parse_dt(starts_from, "תחילת טווח")
    end = parse_dt(starts_to, "סוף טווח")
    found = overlapping_rows(store, "workforce_time_off", workspace_id, start, end, select=TIME_OFF_SELECT, limit=500)
    employees = _map_by_id(
        store,
        "workforce_employees",
        workspace_id,
        {str(row.get("employee_id") or "") for row in found},
        "id,first_name,last_name",
    )
    return [time_off_out(row, employees) for row in found]


def create_time_off(
    store: WorkforceTableStore,
    workspace_id: str,
    payload: dict[str, Any],
    *,
    actor_user_id: str | None = None,
) -> dict[str, Any]:
    employee_id = require_uuid(payload.get("employee_id"), "עובד")
    if not employee_id:
        raise validation("יש לבחור עובד")
    assert_ref(store, "workforce_employees", workspace_id, employee_id, "עובד")
    starts = parse_dt(payload.get("starts_at"), "שעת התחלה")
    ends = parse_dt(payload.get("ends_at"), "שעת סיום")
    if ends <= starts:
        raise validation("שעת הסיום חייבת להיות אחרי שעת ההתחלה")
    kind = (payload.get("kind") or "vacation").strip()
    if kind not in TIME_OFF_KINDS:
        raise validation("סוג ההיעדרות אינו תקין")
    status = (payload.get("status") or "pending").strip()
    if status not in TIME_OFF_STATUSES:
        raise validation("סטטוס ההיעדרות אינו תקין")
    body = {
        "workspace_id": workspace_id,
        "employee_id": employee_id,
        "starts_at": to_iso(starts),
        "ends_at": to_iso(ends),
        "kind": kind,
        "status": status,
        "notes": optional_code(payload.get("notes")),
        "created_by": actor_user_id,
    }
    row = created_row(
        store.post("workforce_time_off", json=body, params={"select": TIME_OFF_SELECT}),
        conflict_message="לא ניתן לשמור היעדרות",
    )
    employees = _map_by_id(store, "workforce_employees", workspace_id, {employee_id}, "id,first_name,last_name")
    return time_off_out(row, employees)


def create_qualification(store: WorkforceTableStore, workspace_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    employee_id = require_uuid(payload.get("employee_id"), "עובד")
    key = optional_code(payload.get("qualification_key"))
    if not employee_id or not key:
        raise validation("יש לבחור עובד ומפתח הסמכה")
    assert_ref(store, "workforce_employees", workspace_id, employee_id, "עובד")
    expires = optional_code(payload.get("expires_on"))
    body = {
        "workspace_id": workspace_id,
        "employee_id": employee_id,
        "qualification_key": key,
        "expires_on": expires,
        "is_active": bool(payload.get("is_active", True)),
    }
    row = created_row(
        store.post("workforce_qualifications", json=body, params={"select": QUAL_SELECT}),
        conflict_message="ההסמכה כבר קיימת לעובד",
    )
    return {
        "id": str(row.get("id") or ""),
        "workspace_id": str(row.get("workspace_id") or workspace_id),
        "employee_id": employee_id,
        "qualification_key": row.get("qualification_key") or key,
        "expires_on": row.get("expires_on"),
        "is_active": bool(row.get("is_active", True)),
    }


def create_position_requirement(store: WorkforceTableStore, workspace_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    position_id = require_uuid(payload.get("position_id"), "משרה")
    key = optional_code(payload.get("qualification_key"))
    if not position_id or not key:
        raise validation("יש לבחור משרה ומפתח הסמכה")
    assert_ref(store, "workforce_positions", workspace_id, position_id, "משרה")
    enforcement = (payload.get("enforcement") or "required").strip()
    if enforcement not in ENFORCEMENTS:
        raise validation("סוג האכיפה אינו תקין")
    body = {
        "workspace_id": workspace_id,
        "position_id": position_id,
        "qualification_key": key,
        "enforcement": enforcement,
    }
    row = created_row(
        store.post("workforce_position_requirements", json=body, params={"select": POS_REQ_SELECT}),
        conflict_message="דרישת ההסמכה כבר קיימת למשרה",
    )
    return {
        "id": str(row.get("id") or ""),
        "workspace_id": str(row.get("workspace_id") or workspace_id),
        "position_id": position_id,
        "qualification_key": row.get("qualification_key") or key,
        "enforcement": row.get("enforcement") or enforcement,
    }
