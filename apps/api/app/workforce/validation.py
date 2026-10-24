"""Central staffing validation for shift save and week checks.

Hard issues block assignment writes. Soft issues are warnings only.
Employer rest between shifts applies only when the workspace policy enables it.
Legal rest applies only when a verified in-force catalog rule covers the employee.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Literal

from .clock import overlaps, parse_dt, site_zone, to_iso
from .engine import apply_catalog_checks, pack_validation
from ..errors import ApiError
from .store import (
    POLICY_SELECT,
    POS_REQ_SELECT,
    QUAL_SELECT,
    SLOT_SELECT,
    TIME_OFF_SELECT,
    WorkforceTableStore,
    get_one,
    require_uuid,
    rows,
    rows_with_fallback,
    validation,
)

Severity = Literal["hard", "soft"]
Category = Literal["legal", "policy", "operational", "advisory"]
ABSOLUTE_MAX_SHIFT = timedelta(hours=48)
DEFAULT_MAX_SHIFT = timedelta(hours=36)


def issue(code: str, severity: Severity, message: str, **fields: object) -> dict[str, Any]:
    category = fields.pop("category", "operational")
    payload = {
        "code": code,
        "severity": severity,
        "message": message,
        "category": category,
        "finding_severity": "blocking" if severity == "hard" else ("informational" if category == "advisory" else "warning"),
    }
    payload.update({key: value for key, value in fields.items() if value is not None})
    return payload


def load_policy(store: WorkforceTableStore, workspace_id: str) -> dict[str, Any]:
    try:
        row = get_one(
            store,
            "workforce_schedule_policies",
            {"workspace_id": f"eq.{workspace_id}", "select": POLICY_SELECT, "limit": "1"},
        )
    except ApiError as exc:
        if exc.code == "WORKFORCE_SCHEMA_UNAVAILABLE":
            row = None
        else:
            raise
    if not row:
        return {
            "workspace_id": workspace_id,
            "max_shift_hours": 36,
            "min_rest_hours": None,
            "rest_rule_enabled": False,
            "weekly_hour_cap": None,
        }
    return {
        "workspace_id": str(row.get("workspace_id") or workspace_id),
        "max_shift_hours": float(row.get("max_shift_hours") or 36),
        "min_rest_hours": float(row["min_rest_hours"]) if row.get("min_rest_hours") is not None else None,
        "rest_rule_enabled": bool(row.get("rest_rule_enabled")),
        "weekly_hour_cap": float(row["weekly_hour_cap"]) if row.get("weekly_hour_cap") is not None else None,
    }


def overlapping_rows(
    store: WorkforceTableStore,
    table: str,
    workspace_id: str,
    starts: datetime,
    ends: datetime,
    *,
    extra: dict[str, str] | None = None,
    select: str,
    limit: int = 200,
    fallback_select: str | None = None,
) -> list[dict]:
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "and": f"(starts_at.lt.{to_iso(ends)},ends_at.gt.{to_iso(starts)})",
        "select": select,
        "order": "starts_at.asc",
        "limit": str(limit),
    }
    if extra:
        params.update(extra)
    return rows_with_fallback(store, table, params, fallback_select=fallback_select)


def _employee_row(store: WorkforceTableStore, workspace_id: str, employee_id: str) -> dict | None:
    return get_one(
        store,
        "workforce_employees",
        {
            "id": f"eq.{employee_id}",
            "workspace_id": f"eq.{workspace_id}",
            "select": "id,workspace_id,employment_status,site_id,first_name,last_name",
        },
    )


def _optional_rows(fn):
    try:
        return fn()
    except ApiError as exc:
        if exc.code == "WORKFORCE_SCHEMA_UNAVAILABLE":
            return []
        raise


def _site_row(store: WorkforceTableStore, workspace_id: str, site_id: str) -> dict | None:
    found = rows_with_fallback(
        store,
        "workforce_sites",
        {
            "id": f"eq.{site_id}",
            "workspace_id": f"eq.{workspace_id}",
            "select": "id,workspace_id,region_id,is_active,timezone,name",
            "limit": "1",
        },
        fallback_select="id,workspace_id,region_id,is_active,name",
    )
    return found[0] if found else None


def _slot_row(store: WorkforceTableStore, workspace_id: str, slot_id: str) -> dict | None:
    return get_one(
        store,
        "workforce_shift_slots",
        {"id": f"eq.{slot_id}", "workspace_id": f"eq.{workspace_id}", "select": SLOT_SELECT},
    )


def validate_assignment(
    store: WorkforceTableStore,
    workspace_id: str,
    payload: dict[str, Any],
    *,
    exclude_shift_id: str | None = None,
) -> dict[str, Any]:
    issues: list[dict[str, Any]] = []
    employee_id = require_uuid(payload.get("employee_id"), "עובד")
    site_id = require_uuid(payload.get("site_id"), "אתר")
    slot_id = require_uuid(payload.get("slot_id"), "עמדה") if payload.get("slot_id") else None
    position_id = require_uuid(payload.get("position_id"), "משרה") if payload.get("position_id") else None
    if not employee_id or not site_id:
        raise validation("יש לבחור עובד ואתר")
    starts = parse_dt(payload.get("starts_at"), "שעת התחלה")
    ends = parse_dt(payload.get("ends_at"), "שעת סיום")
    if ends <= starts:
        raise validation("שעת הסיום חייבת להיות אחרי שעת ההתחלה")

    employee = _employee_row(store, workspace_id, employee_id)
    if not employee:
        raise validation("עובד אינו שייך לסביבה זו")
    status = employee.get("employment_status")
    if status == "terminated":
        issues.append(issue("employee_terminated", "hard", "לא ניתן לשבץ עובד שהעסקתו הסתיימה"))
    elif status != "active":
        issues.append(issue("employee_inactive", "hard", "לא ניתן לשבץ עובד שאינו פעיל"))

    site = _site_row(store, workspace_id, site_id)
    if not site:
        raise validation("אתר אינו שייך לסביבה זו")
    if site.get("is_active") is False:
        issues.append(issue("site_inactive", "hard", "לא ניתן לשבץ לאתר שאינו פעיל"))

    slot = None
    if slot_id:
        slot = _slot_row(store, workspace_id, slot_id)
        if not slot:
            raise validation("עמדת השיבוץ אינה שייכת לסביבה זו")
        if str(slot.get("site_id") or "") != site_id:
            issues.append(issue("slot_site_mismatch", "hard", "העמדה שייכת לאתר אחר"))
        slot_position = str(slot.get("position_id") or "")
        if slot_position and position_id and slot_position != position_id:
            issues.append(issue("slot_position_mismatch", "hard", "המשרה אינה תואמת את העמדה"))
        if not position_id and slot_position:
            position_id = slot_position
        slot_starts = parse_dt(str(slot.get("starts_at") or ""), "תחילת עמדה")
        slot_ends = parse_dt(str(slot.get("ends_at") or ""), "סיום עמדה")
        if not overlaps(starts, ends, slot_starts, slot_ends):
            issues.append(issue("slot_time_mismatch", "hard", "המשמרת אינה חופפת את חלון העמדה"))
        filled = overlapping_rows(
            store,
            "workforce_shifts",
            workspace_id,
            slot_starts,
            slot_ends,
            extra={"slot_id": f"eq.{slot_id}"},
            select="id,employee_id",
            limit=100,
        )
        assigned = [row for row in filled if not exclude_shift_id or str(row.get("id") or "") != exclude_shift_id]
        required = int(slot.get("required_count") or 1)
        if any(str(row.get("employee_id") or "") == employee_id for row in assigned):
            issues.append(issue("duplicate_slot_assignment", "hard", "העובד כבר משובץ לעמדה זו"))
        elif len(assigned) >= required:
            issues.append(issue("slot_full", "hard", "העמדה כבר מאוישת במלואה"))

    if position_id:
        pos = get_one(
            store,
            "workforce_positions",
            {"id": f"eq.{position_id}", "workspace_id": f"eq.{workspace_id}", "select": "id,workspace_id"},
        )
        if not pos:
            raise validation("משרה אינה שייכת לסביבה זו")
    else:
        issues.append(issue("assignment_without_position", "soft", "המשמרת נשמרת בלי משרה נדרשת"))

    policy = load_policy(store, workspace_id)
    duration = ends - starts
    max_hours = float(policy.get("max_shift_hours") or 36)
    max_delta = min(timedelta(hours=max_hours), ABSOLUTE_MAX_SHIFT)
    if duration > max_delta:
        issues.append(
            issue(
                "duration_exceeds_policy",
                "hard",
                "משך המשמרת חורג ממדיניות הסביבה",
                category="policy",
                max_shift_hours=max_hours,
            )
        )
    elif duration > DEFAULT_MAX_SHIFT and duration <= ABSOLUTE_MAX_SHIFT and not policy.get("max_shift_hours"):
        issues.append(
            issue("duration_exceeds_policy", "hard", "משך המשמרת אינו תקין", category="policy")
        )

    others = overlapping_rows(
        store,
        "workforce_shifts",
        workspace_id,
        starts,
        ends,
        extra={"employee_id": f"eq.{employee_id}"},
        select="id,starts_at,ends_at",
        limit=50,
    )
    for row in others:
        if exclude_shift_id and str(row.get("id") or "") == exclude_shift_id:
            continue
        issues.append(issue("overlap", "hard", "לעובד כבר יש משמרת חופפת בטווח הזה", shift_id=str(row.get("id") or "")))
        break

    absences = _optional_rows(
        lambda: overlapping_rows(
            store,
            "workforce_time_off",
            workspace_id,
            starts,
            ends,
            extra={"employee_id": f"eq.{employee_id}"},
            select=TIME_OFF_SELECT,
            limit=50,
        )
    )
    for row in absences:
        status_off = row.get("status")
        if status_off == "approved":
            issues.append(issue("approved_absence", "hard", "העובד בחופשה מאושרת בטווח הזה", time_off_id=str(row.get("id") or "")))
            break
        if status_off == "pending":
            issues.append(
                issue(
                    "pending_absence",
                    "soft",
                    "לעובד בקשת היעדרות ממתינה בטווח הזה",
                    category="operational",
                    time_off_id=str(row.get("id") or ""),
                )
            )

    if position_id:
        requirements = _optional_rows(
            lambda: rows(
                store.get(
                    "workforce_position_requirements",
                    params={
                        "workspace_id": f"eq.{workspace_id}",
                        "position_id": f"eq.{position_id}",
                        "select": POS_REQ_SELECT,
                        "limit": "50",
                    },
                )
            )
        )
        quals = _optional_rows(
            lambda: rows(
                store.get(
                    "workforce_qualifications",
                    params={
                        "workspace_id": f"eq.{workspace_id}",
                        "employee_id": f"eq.{employee_id}",
                        "select": QUAL_SELECT,
                        "limit": "100",
                    },
                )
            )
        )
        tz = site_zone(site.get("timezone"))
        local_day = starts.astimezone(tz).date()
        held = {
            str(row.get("qualification_key") or "").strip(): row
            for row in quals
            if row.get("is_active") is not False
        }
        for req in requirements:
            key = str(req.get("qualification_key") or "").strip()
            if not key:
                continue
            held_row = held.get(key)
            enforcement = req.get("enforcement") or "required"
            if not held_row:
                code = "missing_qualification" if enforcement == "required" else "preferred_qualification_missing"
                severity: Severity = "hard" if enforcement == "required" else "soft"
                issues.append(issue(code, severity, f"חסרה הסמכה נדרשת: {key}", qualification_key=key))
                continue
            expires = held_row.get("expires_on")
            if expires:
                expires_text = str(expires)[:10]
                if expires_text < local_day.isoformat():
                    code = "expired_qualification" if enforcement == "required" else "preferred_qualification_missing"
                    severity = "hard" if enforcement == "required" else "soft"
                    issues.append(issue(code, severity, f"ההסמכה פגה: {key}", qualification_key=key))

    window_start = starts - timedelta(days=8)
    window_end = ends + timedelta(days=8)
    nearby = overlapping_rows(
        store,
        "workforce_shifts",
        workspace_id,
        window_start,
        window_end,
        extra={"employee_id": f"eq.{employee_id}"},
        select="id,starts_at,ends_at",
        limit=200,
    )
    rest_enabled = bool(policy.get("rest_rule_enabled")) and policy.get("min_rest_hours") is not None
    if rest_enabled:
        min_rest = timedelta(hours=float(policy["min_rest_hours"]))
        for row in nearby:
            if exclude_shift_id and str(row.get("id") or "") == exclude_shift_id:
                continue
            other_start = parse_dt(str(row.get("starts_at") or ""), "משמרת")
            other_end = parse_dt(str(row.get("ends_at") or ""), "משמרת")
            if overlaps(starts, ends, other_start, other_end):
                continue
            gap = starts - other_end if starts >= other_end else other_start - ends
            if gap < min_rest:
                issues.append(
                    issue(
                        "rest_insufficient",
                        "hard",
                        "המנוחה בין משמרות קצרה ממדיניות הסביבה",
                        category="policy",
                        min_rest_hours=policy.get("min_rest_hours"),
                    )
                )
                break

    home_site = str(employee.get("site_id") or "")
    if home_site and home_site != site_id:
        issues.append(
            issue("home_site_mismatch", "soft", "העובד משובץ לאתר שונה מאתר הבית", category="advisory")
        )

    issues.extend(
        apply_catalog_checks(
            store,
            workspace_id,
            employee_id=employee_id,
            starts=starts,
            ends=ends,
            site=site,
            policy=policy,
            nearby=nearby,
            exclude_shift_id=exclude_shift_id,
        )
    )
    return pack_validation(
        issues,
        policy=policy,
        extra={
            "employee_id": employee_id,
            "site_id": site_id,
            "position_id": position_id,
            "slot_id": slot_id,
            "starts_at": to_iso(starts),
            "ends_at": to_iso(ends),
            "region_id": str(site.get("region_id") or "") or None,
            "timezone": site.get("timezone"),
        },
    )


def raise_if_hard(result: dict[str, Any]) -> None:
    hard = result.get("hard") or []
    if not hard:
        return
    first = hard[0]
    raise validation(str(first.get("message") or "השיבוץ אינו תקין"), issues=hard)


def week_coverage_issues(
    store: WorkforceTableStore,
    workspace_id: str,
    *,
    starts: datetime,
    ends: datetime,
    slots: list[dict],
    assignments: list[dict],
) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    by_slot: dict[str, int] = {}
    for row in assignments:
        slot_id = str(row.get("slot_id") or "")
        if slot_id:
            by_slot[slot_id] = by_slot.get(slot_id, 0) + 1
    for slot in slots:
        slot_id = str(slot.get("id") or "")
        required = int(slot.get("required_count") or 1)
        assigned = by_slot.get(slot_id, 0)
        if assigned < required:
            issues.append(
                issue(
                    "unfilled_slot",
                    "soft",
                    "עמדה לא מאוישת",
                    slot_id=slot_id,
                    required_count=required,
                    assigned_count=assigned,
                    site_id=str(slot.get("site_id") or ""),
                    starts_at=slot.get("starts_at"),
                    ends_at=slot.get("ends_at"),
                )
            )
    coverage = [
        row
        for row in rows(
            store.get(
                "workforce_coverage_requirements",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "select": "id,site_id,position_id,weekday,required_count,start_local,end_local,is_active",
                    "limit": "500",
                },
            )
        )
        if row.get("is_active") is not False
    ]
    if coverage:
        filled_keys = {
            (str(row.get("site_id") or ""), str(row.get("position_id") or ""), str(row.get("starts_at") or ""))
            for row in assignments
        }
        slot_keys = {
            (str(row.get("site_id") or ""), str(row.get("position_id") or ""), str(row.get("starts_at") or ""))
            for row in slots
        }
        if coverage and not slot_keys and not filled_keys:
            issues.append(issue("coverage_shortfall", "soft", "קיימות דרישות כיסוי בלי עמדות לשבוע זה"))
    return issues
