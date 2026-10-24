"""L2 scheduling engine: catalog-backed findings for one assignment or a week.

Never reports a roster as legally compliant. verified is not enough — source,
scope, dates, and required permits are checked. Expired/draft/superseded rules
never become active legal blocks.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from ..errors import ApiError
from .catalog import (
    INSTRUMENT_SELECT,
    RULE_SELECT,
    can_legal_block,
    default_employment_profile,
    get_profile,
    instrument_in_force,
    list_workspace_packs,
    parse_at,
    rule_applies_to_employee,
    rule_workspace_matches,
)
from .clock import (
    hours_between,
    is_night_work,
    local_week_bounds,
    longest_free_gap,
    overlaps,
    parse_dt,
    site_zone,
    split_local_day_hours,
    split_week_hours,
    to_iso,
    weekday_window,
)
from .store import WorkforceTableStore, rows

COMPLIANCE_DISCLAIMER = (
    "המנוע אינו מאשר עמידה בדין. הוא מדווח ממצאים לפי כללים שחלו על העובד "
    "לפי מקור, תחולה ותוקף. כלל לא מאומת או שפג תוקפו אינו חסימה משפטית."
)
LEGAL_STATUS = "not_certified"


def _optional(fn, default):
    try:
        return fn()
    except ApiError as exc:
        if exc.code == "WORKFORCE_SCHEMA_UNAVAILABLE":
            return default
        raise


def _params(rule: dict[str, Any]) -> dict[str, Any]:
    raw = rule.get("parameters")
    return raw if isinstance(raw, dict) else {}


def _scope(rule: dict[str, Any]) -> dict[str, Any]:
    raw = rule.get("scope")
    return raw if isinstance(raw, dict) else {}


def load_engine_context(store: WorkforceTableStore, workspace_id: str) -> dict[str, Any]:
    rules = _optional(
        lambda: rows(
            store.get(
                "workforce_rules",
                params={
                    "or": f"(workspace_id.is.null,workspace_id.eq.{workspace_id})",
                    "select": RULE_SELECT,
                    "limit": "500",
                },
            )
        ),
        [],
    )
    rules = [row for row in rules if rule_workspace_matches(row, workspace_id)]
    instruments = _optional(
        lambda: rows(
            store.get(
                "workforce_legal_instruments",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "select": INSTRUMENT_SELECT,
                    "limit": "200",
                },
            )
        ),
        [],
    )
    packs = _optional(lambda: list_workspace_packs(store, workspace_id), [])
    enabled = {str(row.get("pack_code") or "") for row in packs if row.get("is_enabled")}
    return {"rules": rules, "instruments": instruments, "enabled_packs": enabled}


def load_profile(store: WorkforceTableStore, workspace_id: str, employee_id: str) -> dict[str, Any]:
    found = _optional(lambda: get_profile(store, workspace_id, employee_id), None)
    return found or default_employment_profile(workspace_id, employee_id)


def _finding(
    code: str,
    *,
    category: str,
    severity: str,
    message: str,
    **fields: object,
) -> dict[str, Any]:
    hard = category == "legal" and severity == "blocking" or (
        category == "policy" and severity == "blocking"
    )
    payload = {
        "code": code,
        "category": category,
        "severity": "hard" if hard or (category == "operational" and severity == "blocking") else "soft",
        "finding_severity": severity,
        "message": message,
    }
    payload.update({key: value for key, value in fields.items() if value is not None})
    return payload


def _rule_fields(rule: dict[str, Any]) -> dict[str, Any]:
    return {
        "rule_code": rule.get("rule_code"),
        "rule_type": rule.get("rule_type"),
        "source_citation": rule.get("source_citation"),
        "source_section": rule.get("source_section"),
        "verification_status": rule.get("verification_status"),
    }


def _rule_by_code(rules: list[dict], code: str) -> dict | None:
    matches = [row for row in rules if str(row.get("rule_code") or "") == code]
    if not matches:
        return None
    return max(matches, key=lambda row: int(row.get("version") or 1))


def _has_section_12(instruments: list[dict], *, at: datetime, employee_id: str) -> bool:
    for row in instruments:
        if not instrument_in_force(row, at=at):
            continue
        if str(row.get("instrument_kind") or "") != "permit":
            continue
        params = row.get("parameters") if isinstance(row.get("parameters"), dict) else {}
        scope = row.get("scope") if isinstance(row.get("scope"), dict) else {}
        code = str(row.get("code") or "").upper()
        allowed = bool(
            params.get("section_12")
            or params.get("allows_weekly_rest_work")
            or scope.get("weekly_rest")
            or code.startswith("S12")
        )
        if not allowed:
            continue
        emp_ids = scope.get("employee_ids")
        if isinstance(emp_ids, list) and emp_ids and employee_id not in {str(item) for item in emp_ids}:
            continue
        return True
    return False


def _busy_intervals(shifts: list[dict], *, extra: tuple[datetime, datetime] | None = None) -> list[tuple[datetime, datetime]]:
    busy: list[tuple[datetime, datetime]] = []
    for row in shifts:
        busy.append(
            (
                parse_dt(str(row.get("starts_at") or ""), "משמרת"),
                parse_dt(str(row.get("ends_at") or ""), "משמרת"),
            )
        )
    if extra:
        busy.append(extra)
    return busy


def _hours_by_local_day(
    shifts: list[dict],
    *,
    extra: tuple[datetime, datetime] | None,
    tz: ZoneInfo,
) -> dict:
    totals: dict = {}
    intervals = _busy_intervals(shifts, extra=extra)
    for start, end in intervals:
        for day, hours in split_local_day_hours(start, end, tz):
            totals[day] = totals.get(day, 0.0) + hours
    return totals


def _hours_by_week(
    shifts: list[dict],
    *,
    extra: tuple[datetime, datetime] | None,
    tz: ZoneInfo,
) -> dict[datetime, float]:
    totals: dict[datetime, float] = {}
    for start, end in _busy_intervals(shifts, extra=extra):
        for week_start, hours in split_week_hours(start, end, tz):
            totals[week_start] = totals.get(week_start, 0.0) + hours
    return totals


def _night_week(shifts: list[dict], *, extra: tuple[datetime, datetime] | None, week_start: datetime, week_end: datetime, tz: ZoneInfo) -> bool:
    for start, end in _busy_intervals(shifts, extra=extra):
        if not overlaps(start, end, week_start, week_end):
            continue
        clipped_s = max(start, week_start)
        clipped_e = min(end, week_end)
        if is_night_work(clipped_s, clipped_e, tz):
            return True
    return False


def apply_catalog_checks(
    store: WorkforceTableStore,
    workspace_id: str,
    *,
    employee_id: str,
    starts: datetime,
    ends: datetime,
    site: dict[str, Any],
    policy: dict[str, Any],
    nearby: list[dict],
    exclude_shift_id: str | None = None,
) -> list[dict[str, Any]]:
    ctx = load_engine_context(store, workspace_id)
    rules: list[dict] = ctx["rules"]
    if not rules and not ctx["instruments"]:
        return []
    profile = load_profile(store, workspace_id, employee_id)
    tz = site_zone(site.get("timezone"))
    at = starts
    enabled = ctx["enabled_packs"]
    instruments = ctx["instruments"]
    others = [
        row
        for row in nearby
        if not exclude_shift_id or str(row.get("id") or "") != exclude_shift_id
    ]
    issues: list[dict[str, Any]] = []

    if profile.get("is_minor"):
        issues.append(
            _finding(
                "minor_uncatalogued",
                category="advisory",
                severity="informational",
                message="פרופיל קטין — אין כללי נוער בקטלוג; הסידור אינו מאושר כעומד בדין",
                employee_id=employee_id,
            )
        )
    if not profile.get("hours_law_covered", True):
        issues.append(
            _finding(
                "hours_law_excluded",
                category="advisory",
                severity="informational",
                message="העובד מסומן כחריג מתחולת חוק השעות — כללי החוק לא הופעלו עליו",
                employee_id=employee_id,
            )
        )

    for row in rules:
        status = str(row.get("verification_status") or "")
        if status in {"expired", "draft", "superseded"} and str(row.get("rule_type") or "") in {"legal", "permit"}:
            if parse_at(row.get("effective_to") or at) <= at or status != "verified":
                if str(row.get("rule_code") or "") in {"EMERGENCY_OT_2026", "GUARDING_HOURS_1951"} or status == "expired":
                    if hours_between(starts, ends) > 12:
                        issues.append(
                            _finding(
                                "expired_rule_ignored",
                                category="advisory",
                                severity="informational",
                                message="כלל או היתר שפג/לא מאומת אינו מתיר חריגה ואינו יוצר חסימה משפטית פעילה",
                                employee_id=employee_id,
                                **_rule_fields(row),
                            )
                        )
                        break

    rest_rule = _rule_by_code(rules, "REST_BETWEEN_DAYS")
    if rest_rule and can_legal_block(rest_rule, profile=profile, enabled_packs=enabled, at=at):
        min_rest = float(_params(rest_rule).get("min_rest_hours") or 8)
        for row in others:
            other_start = parse_dt(str(row.get("starts_at") or ""), "משמרת")
            other_end = parse_dt(str(row.get("ends_at") or ""), "משמרת")
            if overlaps(starts, ends, other_start, other_end):
                continue
            gap = starts - other_end if starts >= other_end else other_start - ends
            if gap.total_seconds() / 3600.0 + 1e-9 < min_rest:
                issues.append(
                    _finding(
                        "rest_legal_insufficient",
                        category="legal",
                        severity="blocking",
                        message="המנוחה בין משמרות קצרה מכלל חוק מאומת שחל על העובד",
                        employee_id=employee_id,
                        min_rest_hours=min_rest,
                        **_rule_fields(rest_rule),
                    )
                )
                break
    elif rest_rule and str(rest_rule.get("verification_status") or "") in {"expired", "draft", "superseded"}:
        issues.append(
            _finding(
                "expired_rule_ignored",
                category="advisory",
                severity="informational",
                message="כלל מנוחה אינו בתוקף מאומת — לא נוצרה חסימה משפטית",
                employee_id=employee_id,
                **_rule_fields(rest_rule),
            )
        )

    extra = (starts, ends)
    day_hours = _hours_by_local_day(others, extra=extra, tz=tz)
    week_hours = _hours_by_week(others, extra=extra, tz=tz)
    ot_permit = _rule_by_code(rules, "OT_PERMIT_2018")
    ot_forbidden = _rule_by_code(rules, "OT_FORBIDDEN")
    day_base = _rule_by_code(rules, "DAY_HOURS_BASE")
    week_42 = _rule_by_code(rules, "WEEK_HOURS_42")
    week_statute = _rule_by_code(rules, "WEEK_HOURS_STATUTE")
    permit_applies = bool(
        ot_permit and can_legal_block(ot_permit, profile=profile, enabled_packs=enabled, at=at)
    )
    forbidden_applies = bool(
        ot_forbidden and can_legal_block(ot_forbidden, profile=profile, enabled_packs=enabled, at=at)
    )
    regular_day = float(_params(day_base or {}).get("regular_day_hours") or 8)
    night_day = float(_params(day_base or {}).get("night_or_pre_rest_day_hours") or 7)
    if permit_applies:
        legal_day_cap = float(_params(ot_permit).get("max_day_hours_including_ot") or 12)
        weekly_ot_cap = float(_params(ot_permit).get("max_weekly_ot_hours") or 16)
        night_week_cap = float(_params(ot_permit).get("max_night_week_hours_including_ot") or 58)
        for day, total in day_hours.items():
            if total > legal_day_cap + 1e-9:
                issues.append(
                    _finding(
                        "daily_hours_exceed_permit",
                        category="legal",
                        severity="blocking",
                        message="שעות מצטברות ביום חורגות מההיתר המאומת שחל על העובד",
                        employee_id=employee_id,
                        local_date=day.isoformat(),
                        hours=round(total, 2),
                        cap_hours=legal_day_cap,
                        **_rule_fields(ot_permit),
                    )
                )
                break
    elif forbidden_applies:
        night_shift = is_night_work(starts, ends, tz)
        cap = night_day if night_shift else regular_day
        for day, total in day_hours.items():
            if total > cap + 1e-9:
                issues.append(
                    _finding(
                        "overtime_without_permit",
                        category="legal",
                        severity="blocking",
                        message="שעות נוספות בלי היתר מאומת בתוקף",
                        employee_id=employee_id,
                        local_date=day.isoformat(),
                        hours=round(total, 2),
                        cap_hours=cap,
                        **_rule_fields(ot_forbidden),
                    )
                )
                break

    regular_week = 45.0
    if week_statute and rule_applies_to_employee(week_statute, profile=profile, enabled_packs=enabled, at=at):
        regular_week = float(_params(week_statute).get("weekly_hours") or 45)
    if week_42 and rule_applies_to_employee(week_42, profile=profile, enabled_packs=enabled, at=at):
        regular_week = float(_params(week_42).get("weekly_hours") or 42)
        for week_start, total in week_hours.items():
            if total > regular_week + 1e-9:
                issues.append(
                    _finding(
                        "week_hours_42_exceeded",
                        category="advisory",
                        severity="informational",
                        message="שעות השבוע מעל 42 — צו ההרחבה; שעות נוספות נמדדות לפי היתר נפרד",
                        employee_id=employee_id,
                        week_start=to_iso(week_start),
                        hours=round(total, 2),
                        **_rule_fields(week_42),
                    )
                )
                break

    if permit_applies:
        for week_start, total in week_hours.items():
            ot_hours = max(0.0, total - regular_week)
            week_end = week_start + timedelta(days=7)
            if ot_hours > weekly_ot_cap + 1e-9:
                issues.append(
                    _finding(
                        "weekly_ot_exceed_permit",
                        category="legal",
                        severity="blocking",
                        message="שעות נוספות שבועיות חורגות מההיתר המאומת",
                        employee_id=employee_id,
                        week_start=to_iso(week_start),
                        hours=round(total, 2),
                        ot_hours=round(ot_hours, 2),
                        cap_hours=weekly_ot_cap,
                        **_rule_fields(ot_permit),
                    )
                )
            if _night_week(others, extra=extra, week_start=week_start, week_end=week_end, tz=tz) and total > night_week_cap + 1e-9:
                issues.append(
                    _finding(
                        "night_week_hours_exceed",
                        category="legal",
                        severity="blocking",
                        message="שבוע לילה חורג מתקרת ההיתר המאומת",
                        employee_id=employee_id,
                        week_start=to_iso(week_start),
                        hours=round(total, 2),
                        cap_hours=night_week_cap,
                        **_rule_fields(ot_permit),
                    )
                )
    elif forbidden_applies:
        for week_start, total in week_hours.items():
            if total > regular_week + 1e-9:
                issues.append(
                    _finding(
                        "overtime_without_permit",
                        category="legal",
                        severity="blocking",
                        message="שעות נוספות שבועיות בלי היתר מאומת בתוקף",
                        employee_id=employee_id,
                        week_start=to_iso(week_start),
                        hours=round(total, 2),
                        cap_hours=regular_week,
                        **_rule_fields(ot_forbidden),
                    )
                )
                break

    policy_cap = policy.get("weekly_hour_cap")
    if policy_cap is not None:
        cap = float(policy_cap)
        for week_start, total in week_hours.items():
            if total > cap + 1e-9:
                issues.append(
                    _finding(
                        "weekly_hours_exceed_policy",
                        category="policy",
                        severity="blocking",
                        message="שעות השבוע חורגות ממדיניות המעסיק",
                        employee_id=employee_id,
                        week_start=to_iso(week_start),
                        hours=round(total, 2),
                        cap_hours=cap,
                    )
                )
                break

    weekly_rest = _rule_by_code(rules, "WEEKLY_REST_36")
    weekly_ban = _rule_by_code(rules, "WEEKLY_REST_BAN")
    rest_weekday = profile.get("rest_weekday")
    weekly_needed = (weekly_rest and can_legal_block(weekly_rest, profile=profile, enabled_packs=enabled, at=at)) or (
        weekly_ban and can_legal_block(weekly_ban, profile=profile, enabled_packs=enabled, at=at)
    )
    if weekly_needed and rest_weekday is None:
        issues.append(
            _finding(
                "rest_weekday_unspecified",
                category="advisory",
                severity="informational",
                message="לא הוגדר יום מנוחה לעובד — מנוחה שבועית לא נאכפה כחוק ולא הונח יום ברירת מחדל",
                employee_id=employee_id,
            )
        )
    elif rest_weekday is not None:
        min_weekly = float(_params(weekly_rest or {}).get("min_weekly_rest_hours") or 36)
        has_s12 = _has_section_12(instruments, at=at, employee_id=employee_id)
        weeks = set(week_hours) or {local_week_bounds(starts, tz)[0]}
        busy = _busy_intervals(others, extra=extra)
        for week_start in weeks:
            week_end = week_start + timedelta(days=7)
            if weekly_ban and can_legal_block(weekly_ban, profile=profile, enabled_packs=enabled, at=at) and not has_s12:
                rest_s, rest_e = weekday_window(week_start, int(rest_weekday), tz)
                if overlaps(starts, ends, rest_s, rest_e):
                    issues.append(
                        _finding(
                            "weekly_rest_work",
                            category="legal",
                            severity="blocking",
                            message="העסקה ביום המנוחה השבועית בלי היתר סעיף 12 מאומת בתוקף",
                            employee_id=employee_id,
                            week_start=to_iso(week_start),
                            **_rule_fields(weekly_ban),
                        )
                    )
            if weekly_rest and can_legal_block(weekly_rest, profile=profile, enabled_packs=enabled, at=at) and not has_s12:
                gap = longest_free_gap(busy, week_start, week_end)
                if gap.total_seconds() / 3600.0 + 1e-9 < min_weekly:
                    issues.append(
                        _finding(
                            "weekly_rest_insufficient",
                            category="legal",
                            severity="blocking",
                            message="אין 36 שעות מנוחה רצופות בשבוע לפי כלל מאומת שחל על העובד",
                            employee_id=employee_id,
                            week_start=to_iso(week_start),
                            gap_hours=round(gap.total_seconds() / 3600.0, 2),
                            **_rule_fields(weekly_rest),
                        )
                    )

    security = _rule_by_code(rules, "SECURITY_REST_WINDOW")
    if security and rule_applies_to_employee(security, profile=profile, enabled_packs=enabled, at=at):
        params = _params(security)
        week_start, _week_end = local_week_bounds(starts, tz)
        win_s, _ = weekday_window(week_start, int(params.get("window_start_weekday") or 5), tz)
        start_local = str(params.get("window_start_local") or "16:00")
        hh, mm = [int(part) for part in start_local.split(":")[:2]]
        win_s = win_s.replace(hour=hh, minute=mm)
        win_e_base, _ = weekday_window(week_start, int(params.get("window_end_weekday") or 0), tz)
        if int(params.get("window_end_weekday") or 0) <= int(params.get("window_start_weekday") or 5):
            win_e_base = win_e_base + timedelta(days=7)
        end_local = str(params.get("window_end_local") or "04:00")
        eh, em = [int(part) for part in end_local.split(":")[:2]]
        win_e = win_e_base.replace(hour=eh, minute=em)
        if overlaps(starts, ends, win_s, win_e):
            issues.append(
                _finding(
                    "security_rest_window",
                    category="operational",
                    severity="warning",
                    message="עבודה בחלון מנוחה ענפי — הצו אינו היתר לפי סעיף 12",
                    employee_id=employee_id,
                    **_rule_fields(security),
                )
            )

    rotation = _rule_by_code(rules, "NIGHT_WEEK_ROTATION")
    if rotation and rule_applies_to_employee(rotation, profile=profile, enabled_packs=enabled, at=at):
        issues.append(
            _finding(
                "night_rotation_unresolved",
                category="advisory",
                severity="warning",
                message="סעיף 22 דורש פרשנות 'מפעל משמרות' — אזהרה בלבד, לא חסימה משפטית",
                employee_id=employee_id,
                **_rule_fields(rotation),
            )
        )

    if profile.get("night_work_restricted") and is_night_work(starts, ends, tz):
        issues.append(
            _finding(
                "night_work_restricted",
                category="operational",
                severity="warning",
                message="העובד מסומן כמוגבל בעבודת לילה",
                employee_id=employee_id,
            )
        )

    for row in instruments:
        if str(row.get("verification_status") or "") == "expired" or (
            row.get("effective_to") and parse_at(row["effective_to"]) <= at
        ):
            issues.append(
                _finding(
                    "expired_permit_ignored",
                    category="advisory",
                    severity="informational",
                    message="היתר שפג אינו מתיר חריגה ואינו חסימה משפטית פעילה",
                    employee_id=employee_id,
                    instrument_code=row.get("code"),
                    verification_status=row.get("verification_status"),
                )
            )
            break

    return issues


def pack_validation(
    issues: list[dict[str, Any]],
    *,
    policy: dict[str, Any],
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    hard = [item for item in issues if item.get("severity") == "hard"]
    soft = [item for item in issues if item.get("severity") == "soft"]
    payload = {
        "ok": not hard,
        "issues": issues,
        "hard": hard,
        "soft": soft,
        "findings": issues,
        "legal": [item for item in issues if item.get("category") == "legal"],
        "policy_findings": [item for item in issues if item.get("category") == "policy"],
        "operational": [item for item in issues if item.get("category") == "operational"],
        "advisory": [item for item in issues if item.get("category") == "advisory"],
        "legal_status": LEGAL_STATUS,
        "certified_legal": False,
        "has_blocking_legal_findings": any(
            item.get("category") == "legal" and item.get("severity") == "hard" for item in issues
        ),
        "compliance_disclaimer": COMPLIANCE_DISCLAIMER,
        "policy": policy,
    }
    if extra:
        payload.update(extra)
    return payload


def validate_week(
    store: WorkforceTableStore,
    workspace_id: str,
    *,
    starts_from: str,
    starts_to: str,
) -> dict[str, Any]:
    from .demand import list_coverage, list_slots
    from .shifts import list_shifts
    from .validation import load_policy, validate_assignment, week_coverage_issues

    start = parse_dt(starts_from, "תחילת טווח")
    end = parse_dt(starts_to, "סוף טווח")
    if end <= start:
        from .store import validation

        raise validation("טווח התאריכים אינו תקין")
    slots = _optional(lambda: list_slots(store, workspace_id, starts_from=starts_from, starts_to=starts_to), [])
    assignments = list_shifts(store, workspace_id, starts_from=starts_from, starts_to=starts_to)
    coverage = _optional(lambda: list_coverage(store, workspace_id), [])
    policy = load_policy(store, workspace_id)
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
    for row in assignments:
        payload = {
            "employee_id": row.get("employee_id"),
            "site_id": row.get("site_id"),
            "position_id": row.get("position_id"),
            "slot_id": row.get("slot_id"),
            "starts_at": row.get("starts_at"),
            "ends_at": row.get("ends_at"),
        }
        if not payload["employee_id"] or not payload["site_id"]:
            continue
        result = validate_assignment(store, workspace_id, payload, exclude_shift_id=str(row.get("id") or ""))
        for item in result.get("issues") or []:
            item.setdefault("shift_id", str(row.get("id") or ""))
            item.setdefault("employee_id", payload["employee_id"])
            issues.append(item)
    issues = _dedupe_findings(issues)
    packed = pack_validation(
        issues,
        policy=policy,
        extra={
            "starts_from": to_iso(start),
            "starts_to": to_iso(end),
            "slots": slots,
            "assignments": assignments,
            "coverage": coverage,
        },
    )
    return packed


def _dedupe_findings(issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple] = set()
    out: list[dict[str, Any]] = []
    for item in issues:
        key = (
            item.get("code"),
            item.get("employee_id"),
            item.get("rule_code"),
            item.get("shift_id"),
            item.get("week_start"),
            item.get("local_date"),
            item.get("slot_id"),
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out
