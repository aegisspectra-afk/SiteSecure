"""Labor-rule catalog. L2 assignment engine reads verified in-force rules only."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from ..errors import ApiError, MESSAGES
from .store import (
    WorkforceTableStore,
    created_row,
    get_one,
    patched_row,
    require_uuid,
    rows,
    validation,
)

ENFORCED_ON_ASSIGNMENT = True
TENANT_RULE_TYPES = frozenset(
    {"collective_agreement", "employment_contract", "employer_policy", "operational"}
)
RULE_TYPES = TENANT_RULE_TYPES | frozenset({"legal", "permit"})
STATUSES = frozenset({"draft", "verified", "expired", "superseded"})
SEVERITIES = frozenset({"blocking", "warning", "informational"})
CLOSE_STATUSES = frozenset({"expired", "superseded"})
INSTRUMENT_KINDS = frozenset(
    {"permit", "extension_order", "collective_agreement", "employment_contract"}
)
WEEKLY_PATTERNS = frozenset({"five_day", "six_day"})
REST_CODES = frozenset({"REST_BETWEEN_DAYS"})

PACK_SELECT = "pack_code,name_he,description_he,pack_kind,created_at"
RULE_SELECT = (
    "id,workspace_id,pack_code,rule_code,version,name_he,description_he,rule_type,"
    "verification_status,severity,source_kind,source_citation,source_section,source_url,"
    "reviewed_on,effective_from,effective_to,superseded_by,scope,parameters,"
    "cannot_be_relaxed,approved_by,approved_at,created_at,updated_at"
)
INSTRUMENT_SELECT = (
    "id,workspace_id,instrument_kind,code,title_he,citation,source_url,verification_status,"
    "effective_from,effective_to,scope,parameters,notes,created_by,created_at,updated_at"
)
PROFILE_SELECT = (
    "employee_id,workspace_id,rest_weekday,hours_law_covered,sector_pack_code,weekly_pattern,"
    "shortened_weekday,is_minor,night_work_restricted,notes,updated_by,created_at,updated_at"
)
WORKSPACE_PACK_SELECT = "workspace_id,pack_code,is_enabled,notes,updated_by,created_at,updated_at"


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def parse_at(value: str | datetime | None) -> datetime:
    if value is None:
        return now_utc()
    if isinstance(value, datetime):
        stamp = value
    else:
        text = str(value).strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        stamp = datetime.fromisoformat(text)
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=timezone.utc)
    return stamp


def is_active_legal_block(rule: dict[str, Any], *, at: datetime | None = None) -> bool:
    """Draft, expired, and superseded never become active legal blocks."""
    when = at or now_utc()
    status = str(rule.get("verification_status") or "")
    rule_type = str(rule.get("rule_type") or "")
    severity = str(rule.get("severity") or "")
    if status != "verified" or rule_type not in {"legal", "permit"} or severity != "blocking":
        return False
    starts = rule.get("effective_from")
    ends = rule.get("effective_to")
    start_at = parse_at(starts) if starts else when
    if start_at > when:
        return False
    if ends:
        if parse_at(ends) <= when:
            return False
    return True


def instrument_in_force(row: dict[str, Any], *, at: datetime | None = None) -> bool:
    """Verified alone is not enough — dates must still cover the assignment instant."""
    when = at or now_utc()
    if str(row.get("verification_status") or "") != "verified":
        return False
    starts = row.get("effective_from")
    if starts and parse_at(starts) > when:
        return False
    ends = row.get("effective_to")
    if ends and parse_at(ends) <= when:
        return False
    return True


def default_employment_profile(workspace_id: str, employee_id: str) -> dict[str, Any]:
    return {
        "employee_id": employee_id,
        "workspace_id": workspace_id,
        "rest_weekday": None,
        "hours_law_covered": True,
        "sector_pack_code": None,
        "weekly_pattern": None,
        "shortened_weekday": None,
        "is_minor": False,
        "night_work_restricted": False,
        "notes": None,
    }


def rule_workspace_matches(rule: dict[str, Any], workspace_id: str) -> bool:
    owner = rule.get("workspace_id")
    return owner in {None, "", workspace_id}


def rule_applies_to_employee(
    rule: dict[str, Any],
    *,
    profile: dict[str, Any],
    enabled_packs: set[str],
    at: datetime | None = None,
) -> bool:
    """Scope, pack, and dates. verified is necessary but not sufficient."""
    when = at or now_utc()
    status = str(rule.get("verification_status") or "")
    if status != "verified":
        return False
    starts = rule.get("effective_from")
    if starts and parse_at(starts) > when:
        return False
    ends = rule.get("effective_to")
    if ends and parse_at(ends) <= when:
        return False
    scope = rule.get("scope") if isinstance(rule.get("scope"), dict) else {}
    if scope.get("hours_law_covered") is True and not profile.get("hours_law_covered", True):
        return False
    pack = str(rule.get("pack_code") or "")
    if scope.get("requires_pack_enabled") and pack not in enabled_packs:
        return False
    sector = scope.get("sector")
    profile_sector = str(profile.get("sector_pack_code") or "")
    if sector and profile_sector and profile_sector != str(sector):
        return False
    return True


def can_legal_block(
    rule: dict[str, Any],
    *,
    profile: dict[str, Any],
    enabled_packs: set[str],
    at: datetime | None = None,
) -> bool:
    scope = rule.get("scope") if isinstance(rule.get("scope"), dict) else {}
    if scope.get("interpretation") is True:
        return False
    if not is_active_legal_block(rule, at=at):
        return False
    return rule_applies_to_employee(rule, profile=profile, enabled_packs=enabled_packs, at=at)


def legal_rest_floor_hours(rules: list[dict[str, Any]], *, at: datetime | None = None) -> float | None:
    floor: float | None = None
    when = at or now_utc()
    for rule in rules:
        if str(rule.get("rule_code") or "") not in REST_CODES:
            continue
        if not is_active_legal_block(rule, at=when):
            continue
        params = rule.get("parameters") if isinstance(rule.get("parameters"), dict) else {}
        raw = params.get("min_rest_hours")
        try:
            hours = float(raw)
        except (TypeError, ValueError):
            continue
        floor = hours if floor is None else max(floor, hours)
    return floor


def reject_policy_relaxing_legal(policy: dict[str, Any], rules: list[dict[str, Any]]) -> None:
    """Employer overlay may be stricter than verified law, never looser."""
    if not policy.get("rest_rule_enabled"):
        return
    raw = policy.get("min_rest_hours")
    if raw is None:
        return
    floor = legal_rest_floor_hours(rules)
    if floor is None:
        return
    try:
        hours = float(raw)
    except (TypeError, ValueError):
        raise validation("שעות מנוחה במדיניות אינן תקינות")
    if hours < floor:
        raise validation(
            "מדיניות ארגונית אינה יכולה לקצר מנוחה מתחת לכלל משפטי מאומת",
            legal_floor_hours=floor,
        )


def rule_out(row: dict[str, Any], *, at: datetime | None = None) -> dict[str, Any]:
    when = at or now_utc()
    workspace_id = row.get("workspace_id")
    return {
        "id": str(row.get("id") or ""),
        "workspace_id": str(workspace_id) if workspace_id else None,
        "pack_code": row.get("pack_code"),
        "rule_code": row.get("rule_code"),
        "version": int(row.get("version") or 1),
        "name_he": row.get("name_he"),
        "description_he": row.get("description_he"),
        "rule_type": row.get("rule_type"),
        "verification_status": row.get("verification_status"),
        "severity": row.get("severity"),
        "source_kind": row.get("source_kind"),
        "source_citation": row.get("source_citation"),
        "source_section": row.get("source_section"),
        "source_url": row.get("source_url"),
        "reviewed_on": str(row.get("reviewed_on") or "")[:10] or None,
        "effective_from": row.get("effective_from"),
        "effective_to": row.get("effective_to"),
        "superseded_by": str(row["superseded_by"]) if row.get("superseded_by") else None,
        "scope": row.get("scope") if isinstance(row.get("scope"), dict) else {},
        "parameters": row.get("parameters") if isinstance(row.get("parameters"), dict) else {},
        "cannot_be_relaxed": bool(row.get("cannot_be_relaxed")),
        "approved_by": str(row["approved_by"]) if row.get("approved_by") else None,
        "approved_at": row.get("approved_at"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
        "enforced_on_assignment": ENFORCED_ON_ASSIGNMENT,
        "would_block_if_engine_on": is_active_legal_block(row, at=when),
        "origin": "workspace" if workspace_id else "platform",
    }


def _optional_rows(store: WorkforceTableStore, table: str, params: dict[str, str]) -> list[dict]:
    try:
        return rows(store.get(table, params=params))
    except ApiError as exc:
        if exc.code == "WORKFORCE_SCHEMA_UNAVAILABLE":
            return []
        raise


def list_packs(store: WorkforceTableStore) -> list[dict[str, Any]]:
    found = _optional_rows(
        store,
        "workforce_rule_packs",
        {"select": PACK_SELECT, "order": "pack_code.asc", "limit": "100"},
    )
    return [
        {
            "pack_code": row.get("pack_code"),
            "name_he": row.get("name_he"),
            "description_he": row.get("description_he"),
            "pack_kind": row.get("pack_kind"),
        }
        for row in found
    ]


def list_rules(
    store: WorkforceTableStore,
    workspace_id: str,
    *,
    include_expired: bool = False,
    at: datetime | None = None,
) -> list[dict[str, Any]]:
    found = _optional_rows(
        store,
        "workforce_rules",
        {
            "or": f"(workspace_id.is.null,workspace_id.eq.{workspace_id})",
            "select": RULE_SELECT,
            "order": "rule_code.asc,version.asc",
            "limit": "500",
        },
    )
    when = at or now_utc()
    items = [rule_out(row, at=when) for row in found]
    if include_expired:
        return items
    return [
        item
        for item in items
        if item["verification_status"] not in {"expired", "superseded"}
        or item["would_block_if_engine_on"]
    ]


def list_open_rules(store: WorkforceTableStore, workspace_id: str) -> list[dict]:
    return _optional_rows(
        store,
        "workforce_rules",
        {
            "or": f"(workspace_id.is.null,workspace_id.eq.{workspace_id})",
            "select": RULE_SELECT,
            "limit": "500",
        },
    )


def _next_version(store: WorkforceTableStore, workspace_id: str, rule_code: str) -> int:
    found = _optional_rows(
        store,
        "workforce_rules",
        {
            "workspace_id": f"eq.{workspace_id}",
            "rule_code": f"eq.{rule_code}",
            "select": "version",
            "order": "version.desc",
            "limit": "1",
        },
    )
    if not found:
        return 1
    return int(found[0].get("version") or 0) + 1


def _close_open_versions(
    store: WorkforceTableStore,
    workspace_id: str,
    rule_code: str,
    *,
    successor_id: str,
    actor_user_id: str | None,
) -> None:
    open_rows = _optional_rows(
        store,
        "workforce_rules",
        {
            "workspace_id": f"eq.{workspace_id}",
            "rule_code": f"eq.{rule_code}",
            "effective_to": "is.null",
            "select": "id,version",
            "limit": "50",
        },
    )
    for row in open_rows:
        if str(row.get("id") or "") == successor_id:
            continue
        res = store.patch(
            "workforce_rules",
            {
                "effective_to": now_utc().isoformat().replace("+00:00", "Z"),
                "verification_status": "superseded",
                "superseded_by": successor_id,
                "approved_by": actor_user_id,
                "approved_at": now_utc().isoformat().replace("+00:00", "Z"),
            },
            params={"id": f"eq.{row['id']}", "workspace_id": f"eq.{workspace_id}"},
            prefer="return=representation",
        )
        patched_row(res, conflict_message="לא ניתן לסגור גרסה קודמת")


def create_workspace_rule(
    store: WorkforceTableStore,
    workspace_id: str,
    payload: dict[str, Any],
    *,
    actor_user_id: str | None,
) -> dict[str, Any]:
    rule_code = str(payload.get("rule_code") or "").strip().upper()
    if not rule_code or len(rule_code) < 3:
        raise validation("קוד כלל חובה")
    rule_type = str(payload.get("rule_type") or "").strip()
    if rule_type not in TENANT_RULE_TYPES:
        raise validation("ארגון יכול להוסיף מדיניות, חוזה, הסכם או כלל תפעולי בלבד — לא חוק או היתר מאומת")
    status = str(payload.get("verification_status") or "draft").strip()
    if status not in STATUSES or status == "verified" and rule_type in {"legal", "permit"}:
        raise validation("סטטוס האימות אינו תקין לכלל ארגוני")
    if status not in {"draft", "verified"}:
        raise validation("גרסה חדשה חייבת להיות טיוטה או מאומתת כמדיניות ארגונית")
    severity = str(payload.get("severity") or "warning").strip()
    if severity not in SEVERITIES:
        raise validation("חומרת כלל אינה תקינה")
    pack_code = str(payload.get("pack_code") or "unverified_research").strip()
    name_he = str(payload.get("name_he") or "").strip()
    if len(name_he) < 2:
        raise validation("שם הכלל חובה")
    citation = str(payload.get("source_citation") or "").strip()
    if len(citation) < 3:
        raise validation("מקור הכלל חובה")
    parameters = payload.get("parameters") if isinstance(payload.get("parameters"), dict) else {}
    if rule_code in REST_CODES:
        catalog = list_open_rules(store, workspace_id)
        floor = legal_rest_floor_hours(catalog)
        raw = parameters.get("min_rest_hours")
        if floor is not None and raw is not None:
            try:
                if float(raw) < floor:
                    raise validation("מדיניות ארגונית אינה יכולה לקצר מנוחה מתחת לכלל משפטי מאומת")
            except (TypeError, ValueError):
                raise validation("שעות מנוחה בכלל אינן תקינות")
    version = _next_version(store, workspace_id, rule_code)
    body = {
        "workspace_id": workspace_id,
        "pack_code": pack_code,
        "rule_code": rule_code,
        "version": version,
        "name_he": name_he,
        "description_he": (payload.get("description_he") or "").strip() or None,
        "rule_type": rule_type,
        "verification_status": status,
        "severity": severity,
        "source_kind": str(payload.get("source_kind") or "policy").strip(),
        "source_citation": citation,
        "source_section": (payload.get("source_section") or "").strip() or None,
        "source_url": (payload.get("source_url") or "").strip() or None,
        "reviewed_on": str(payload.get("reviewed_on") or now_utc().date().isoformat())[:10],
        "effective_from": payload.get("effective_from") or now_utc().isoformat().replace("+00:00", "Z"),
        "scope": payload.get("scope") if isinstance(payload.get("scope"), dict) else {},
        "parameters": parameters,
        "cannot_be_relaxed": False,
        "approved_by": actor_user_id,
        "approved_at": now_utc().isoformat().replace("+00:00", "Z") if status == "verified" else None,
    }
    created = created_row(
        store.post("workforce_rules", json=body, params={"select": RULE_SELECT}),
        conflict_message="גרסת כלל כבר קיימת",
    )
    if version > 1:
        _close_open_versions(
            store,
            workspace_id,
            rule_code,
            successor_id=str(created.get("id") or ""),
            actor_user_id=actor_user_id,
        )
    return rule_out(created)


def close_rule(
    store: WorkforceTableStore,
    workspace_id: str,
    rule_id: str,
    *,
    status: str,
    actor_user_id: str | None,
) -> dict[str, Any]:
    if status not in CLOSE_STATUSES:
        raise validation("סגירת כלל רק כפג תוקף או כהוחלף")
    require_uuid(rule_id, "כלל")
    existing = get_one(
        store,
        "workforce_rules",
        {"id": f"eq.{rule_id}", "workspace_id": f"eq.{workspace_id}", "select": RULE_SELECT},
    )
    if not existing:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    res = store.patch(
        "workforce_rules",
        {
            "effective_to": now_utc().isoformat().replace("+00:00", "Z"),
            "verification_status": status,
            "approved_by": actor_user_id,
            "approved_at": now_utc().isoformat().replace("+00:00", "Z"),
        },
        params={"id": f"eq.{rule_id}", "workspace_id": f"eq.{workspace_id}"},
        prefer="return=representation",
    )
    return rule_out(patched_row(res, conflict_message="לא ניתן לעדכן כלל"))


def list_instruments(store: WorkforceTableStore, workspace_id: str) -> list[dict[str, Any]]:
    found = _optional_rows(
        store,
        "workforce_legal_instruments",
        {
            "workspace_id": f"eq.{workspace_id}",
            "select": INSTRUMENT_SELECT,
            "order": "effective_from.desc",
            "limit": "200",
        },
    )
    return [instrument_out(row) for row in found]


def instrument_out(row: dict[str, Any], *, at: datetime | None = None) -> dict[str, Any]:
    status = str(row.get("verification_status") or "")
    in_force = instrument_in_force(row, at=at)
    return {
        "id": str(row.get("id") or ""),
        "workspace_id": str(row.get("workspace_id") or ""),
        "instrument_kind": row.get("instrument_kind"),
        "code": row.get("code"),
        "title_he": row.get("title_he"),
        "citation": row.get("citation"),
        "source_url": row.get("source_url"),
        "verification_status": status,
        "effective_from": row.get("effective_from"),
        "effective_to": row.get("effective_to"),
        "scope": row.get("scope") if isinstance(row.get("scope"), dict) else {},
        "parameters": row.get("parameters") if isinstance(row.get("parameters"), dict) else {},
        "notes": row.get("notes"),
        "in_force": in_force,
        "enforced_on_assignment": ENFORCED_ON_ASSIGNMENT,
    }


def create_instrument(
    store: WorkforceTableStore,
    workspace_id: str,
    payload: dict[str, Any],
    *,
    actor_user_id: str | None,
) -> dict[str, Any]:
    kind = str(payload.get("instrument_kind") or "").strip()
    if kind not in INSTRUMENT_KINDS:
        raise validation("סוג המסמך אינו תקין")
    code = str(payload.get("code") or "").strip()
    title = str(payload.get("title_he") or "").strip()
    citation = str(payload.get("citation") or "").strip()
    if len(code) < 2 or len(title) < 2 or len(citation) < 3:
        raise validation("קוד, כותרת ומקור חובה")
    status = str(payload.get("verification_status") or "draft").strip()
    if status not in {"draft", "verified"}:
        raise validation("סטטוס מסמך אינו תקין")
    body = {
        "workspace_id": workspace_id,
        "instrument_kind": kind,
        "code": code,
        "title_he": title,
        "citation": citation,
        "source_url": (payload.get("source_url") or "").strip() or None,
        "verification_status": status,
        "effective_from": payload.get("effective_from") or now_utc().isoformat().replace("+00:00", "Z"),
        "effective_to": payload.get("effective_to"),
        "scope": payload.get("scope") if isinstance(payload.get("scope"), dict) else {},
        "parameters": payload.get("parameters") if isinstance(payload.get("parameters"), dict) else {},
        "notes": (payload.get("notes") or "").strip() or None,
        "created_by": actor_user_id,
    }
    return instrument_out(
        created_row(
            store.post("workforce_legal_instruments", json=body, params={"select": INSTRUMENT_SELECT}),
            conflict_message="מסמך עם אותו קוד ותחילה כבר קיים",
        )
    )


def expire_instrument(
    store: WorkforceTableStore,
    workspace_id: str,
    instrument_id: str,
    *,
    actor_user_id: str | None,
) -> dict[str, Any]:
    require_uuid(instrument_id, "מסמך")
    existing = get_one(
        store,
        "workforce_legal_instruments",
        {"id": f"eq.{instrument_id}", "workspace_id": f"eq.{workspace_id}", "select": INSTRUMENT_SELECT},
    )
    if not existing:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    res = store.patch(
        "workforce_legal_instruments",
        {"effective_to": now_utc().isoformat().replace("+00:00", "Z"), "verification_status": "expired"},
        params={"id": f"eq.{instrument_id}", "workspace_id": f"eq.{workspace_id}"},
        prefer="return=representation",
    )
    _ = actor_user_id
    return instrument_out(patched_row(res, conflict_message="לא ניתן לסיים מסמך"))


def upsert_workspace_pack(
    store: WorkforceTableStore,
    workspace_id: str,
    pack_code: str,
    payload: dict[str, Any],
    *,
    actor_user_id: str | None,
) -> dict[str, Any]:
    code = pack_code.strip()
    pack = get_one(store, "workforce_rule_packs", {"pack_code": f"eq.{code}", "select": "pack_code"})
    if not pack:
        raise validation("חבילת כללים אינה מוכרת")
    body = {
        "workspace_id": workspace_id,
        "pack_code": code,
        "is_enabled": bool(payload.get("is_enabled")),
        "notes": (payload.get("notes") or "").strip() or None,
        "updated_by": actor_user_id,
    }
    existing = get_one(
        store,
        "workforce_workspace_packs",
        {
            "workspace_id": f"eq.{workspace_id}",
            "pack_code": f"eq.{code}",
            "select": WORKSPACE_PACK_SELECT,
        },
    )
    if existing:
        res = store.patch(
            "workforce_workspace_packs",
            {key: body[key] for key in ("is_enabled", "notes", "updated_by")},
            params={"workspace_id": f"eq.{workspace_id}", "pack_code": f"eq.{code}"},
            prefer="return=representation",
        )
        row = patched_row(res, conflict_message="לא ניתן לעדכן חבילה")
    else:
        row = created_row(
            store.post("workforce_workspace_packs", json=body, params={"select": WORKSPACE_PACK_SELECT}),
            conflict_message="חבילה כבר משויכת",
        )
    return {
        "workspace_id": str(row.get("workspace_id") or workspace_id),
        "pack_code": row.get("pack_code"),
        "is_enabled": bool(row.get("is_enabled")),
        "notes": row.get("notes"),
        "enforced_on_assignment": ENFORCED_ON_ASSIGNMENT,
    }


def list_workspace_packs(store: WorkforceTableStore, workspace_id: str) -> list[dict[str, Any]]:
    found = _optional_rows(
        store,
        "workforce_workspace_packs",
        {
            "workspace_id": f"eq.{workspace_id}",
            "select": WORKSPACE_PACK_SELECT,
            "limit": "100",
        },
    )
    return [
        {
            "workspace_id": str(row.get("workspace_id") or workspace_id),
            "pack_code": row.get("pack_code"),
            "is_enabled": bool(row.get("is_enabled")),
            "notes": row.get("notes"),
            "enforced_on_assignment": ENFORCED_ON_ASSIGNMENT,
        }
        for row in found
    ]


def profile_out(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "employee_id": str(row.get("employee_id") or ""),
        "workspace_id": str(row.get("workspace_id") or ""),
        "rest_weekday": row.get("rest_weekday"),
        "hours_law_covered": bool(row.get("hours_law_covered", True)),
        "sector_pack_code": row.get("sector_pack_code"),
        "weekly_pattern": row.get("weekly_pattern"),
        "shortened_weekday": row.get("shortened_weekday"),
        "is_minor": bool(row.get("is_minor")),
        "night_work_restricted": bool(row.get("night_work_restricted")),
        "notes": row.get("notes"),
    }


def get_profile(store: WorkforceTableStore, workspace_id: str, employee_id: str) -> dict[str, Any] | None:
    require_uuid(employee_id, "עובד")
    row = get_one(
        store,
        "workforce_employment_profiles",
        {
            "employee_id": f"eq.{employee_id}",
            "workspace_id": f"eq.{workspace_id}",
            "select": PROFILE_SELECT,
        },
    )
    return profile_out(row) if row else None


def upsert_profile(
    store: WorkforceTableStore,
    workspace_id: str,
    employee_id: str,
    payload: dict[str, Any],
    *,
    actor_user_id: str | None,
) -> dict[str, Any]:
    require_uuid(employee_id, "עובד")
    employee = get_one(
        store,
        "workforce_employees",
        {"id": f"eq.{employee_id}", "workspace_id": f"eq.{workspace_id}", "select": "id,workspace_id"},
    )
    if not employee:
        raise validation("עובד אינו שייך לסביבה זו")
    rest_weekday = payload.get("rest_weekday")
    if rest_weekday is not None:
        try:
            rest_weekday = int(rest_weekday)
        except (TypeError, ValueError):
            raise validation("יום מנוחה אינו תקין")
        if rest_weekday < 0 or rest_weekday > 6:
            raise validation("יום מנוחה חייב להיות 0–6 (ראשון–שבת)")
    shortened = payload.get("shortened_weekday")
    if shortened is not None:
        shortened = int(shortened)
        if shortened < 0 or shortened > 6:
            raise validation("יום מקוצר חייב להיות 0–6")
    pattern = payload.get("weekly_pattern")
    if pattern is not None and str(pattern) not in WEEKLY_PATTERNS:
        raise validation("מתכונת שבוע אינה תקינה")
    sector = (payload.get("sector_pack_code") or "").strip() or None
    body = {
        "employee_id": employee_id,
        "workspace_id": workspace_id,
        "rest_weekday": rest_weekday,
        "hours_law_covered": bool(payload.get("hours_law_covered", True)),
        "sector_pack_code": sector,
        "weekly_pattern": pattern,
        "shortened_weekday": shortened,
        "is_minor": bool(payload.get("is_minor", False)),
        "night_work_restricted": bool(payload.get("night_work_restricted", False)),
        "notes": (payload.get("notes") or "").strip() or None,
        "updated_by": actor_user_id,
    }
    existing = get_one(
        store,
        "workforce_employment_profiles",
        {"employee_id": f"eq.{employee_id}", "workspace_id": f"eq.{workspace_id}", "select": "employee_id"},
    )
    if existing:
        res = store.patch(
            "workforce_employment_profiles",
            {key: value for key, value in body.items() if key not in {"employee_id", "workspace_id"}},
            params={"employee_id": f"eq.{employee_id}", "workspace_id": f"eq.{workspace_id}"},
            prefer="return=representation",
        )
        return profile_out(patched_row(res, conflict_message="לא ניתן לעדכן פרופיל העסקה"))
    return profile_out(
        created_row(
            store.post("workforce_employment_profiles", json=body, params={"select": PROFILE_SELECT}),
            conflict_message="פרופיל העסקה כבר קיים",
        )
    )
