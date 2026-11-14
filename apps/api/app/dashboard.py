from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from zoneinfo import ZoneInfo

HomeVariant = Literal["ops", "sales", "today", "observe"]

DEFAULT_WORKSPACE_TZ = "Asia/Jerusalem"

HOME_VARIANT: dict[str, HomeVariant] = {
    "owner": "ops",
    "administrator": "ops",
    "manager": "ops",
    "sales": "sales",
    "technician": "today",
    "viewer": "observe",
}

QUOTE_LABEL_HE = {
    "draft": "טיוטה",
    "sent": "ממתין לאישור הלקוח",
    "viewed": "לאישור אצלנו",
    "approved": "אושרה",
    "rejected": "נדחתה",
    "expired": "פג תוקף",
    "cancelled": "בוטלה",
}

JOB_LABEL_HE = {
    "scheduled": "מתוכננת",
    "en_route": "בדרך",
    "arrived": "באתר",
    "in_progress": "בביצוע",
    "completed": "נסגרה",
    "cancelled": "בוטלה",
    "blocked": "חסומה",
}

EVENT_LABEL_HE = {
    "sent": "הצעה נשלחה",
    "viewed": "הלקוח צפה בהצעה",
    "approved": "הלקוח אישר הצעה",
    "rejected": "הצעה נדחתה",
    "expired": "הצעה פגה",
}

OPEN_JOB = frozenset({"scheduled", "en_route", "arrived", "in_progress", "blocked"})
VANITY_KEYS = frozenset(
    {
        "kpis",
        "revenue",
        "cost_total",
        "margin_amount",
        "margin_percent",
        "customers_count",
        "health",
        "conversion",
    }
)

ATTENTION_CAP = 5
ATTENTION_FULL_CAP = 200
TODAY_CAP = 24
ACTIVITY_CAP = 8
RECENT_QUOTES_CAP = 5


def _resolve_tz(tz_name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(tz_name or DEFAULT_WORKSPACE_TZ)
    except Exception:
        return ZoneInfo(DEFAULT_WORKSPACE_TZ)


def _local_now(now: datetime, tz_name: str | None) -> datetime:
    tz = _resolve_tz(tz_name)
    if now.tzinfo is None:
        now = now.replace(tzinfo=UTC)
    return now.astimezone(tz)


def home_variant(role_key: str) -> HomeVariant:
    return HOME_VARIANT.get(role_key, "observe")


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        try:
            parsed = datetime.fromisoformat(f"{value[:10]}T00:00:00+00:00")
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed


def _item(
    *,
    entity_type: str,
    entity_id: str,
    number: str,
    title_he: str,
    customer_name: str | None,
    site_name: str | None,
    scheduled_for: str | None,
    severity: str,
    actions: list[str] | None = None,
    updated_at: str | None = None,
    site_id: str | None = None,
    scheduled_end: str | None = None,
    status: str | None = None,
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "number": number,
        "title_he": title_he,
        "customer_name": customer_name,
        "site_name": site_name,
        "scheduled_for": scheduled_for,
        "severity": severity,
        "actions": actions or [],
        "updated_at": updated_at,
    }
    if site_id:
        row["site_id"] = site_id
    if scheduled_end:
        row["scheduled_end"] = scheduled_end
    if status:
        row["status"] = status
    return row


def _group(kind: str, label_he: str, items: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not items:
        return None
    return {"kind": kind, "label_he": label_he, "count": len(items), "items": list(items)}


def _cap_group(group: dict[str, Any], cap: int) -> dict[str, Any]:
    capped = group["items"][:cap]
    return {**group, "count": len(capped), "items": capped}


def build_dashboard(
    *,
    role_key: str,
    user_id: str,
    now: datetime,
    tz_name: str | None = None,
    quotes: list[dict[str, Any]],
    jobs: list[dict[str, Any]],
    job_assignees: dict[str, set[str]],
    assigned_resource_ids: frozenset[str],
    names: dict[str, str],
    events: list[dict[str, Any]],
    can_quotes_view: bool,
    can_jobs_view: bool,
    can_jobs_start: bool,
    can_jobs_complete: bool,
    assignments_reliable: bool,
    project_source_quote_ids: frozenset[str] | None = None,
    attention_cap: int = ATTENTION_CAP,
    member_names: dict[str, str] | None = None,
) -> dict[str, Any]:
    """attention_cap limits items per attention group: ATTENTION_CAP for the dashboard,
    ATTENTION_FULL_CAP for the unified "show all" list."""
    variant = home_variant(role_key)
    if now.tzinfo is None:
        now = now.replace(tzinfo=UTC)
    local_now = _local_now(now, tz_name)
    tz = _resolve_tz(tz_name)

    visible_quotes = quotes if can_quotes_view else []
    if variant == "sales":
        visible_quotes = [q for q in visible_quotes if q.get("owner_user_id") == user_id]

    visible_jobs = jobs if can_jobs_view else []
    if variant == "today":
        visible_jobs = [
            j
            for j in visible_jobs
            if j.get("id") in assigned_resource_ids or j.get("site_id") in assigned_resource_ids
        ]
    if variant == "sales":
        visible_jobs = []

    linked = project_source_quote_ids or frozenset()
    attention: list[dict[str, Any]] = []
    if variant in {"ops", "sales", "observe"}:
        attention.extend(_quote_attention(visible_quotes, names, now, variant, linked))
    if variant == "ops" and assignments_reliable:
        unassigned = _unassigned_jobs(visible_jobs, job_assignees, names)
        group = _group("job_unassigned", "עבודות ללא טכנאי", unassigned)
        if group:
            attention.append(group)
    if variant in {"ops", "observe", "today"}:
        overdue = _overdue_jobs(visible_jobs, names, local_now, tz)
        if variant == "today":
            overdue = [row for row in overdue if row["entity_id"] in {j["id"] for j in visible_jobs}]
        group = _group("job_overdue", "עבודות באיחור", overdue)
        if group:
            attention.append(group)

    attention = [_cap_group(group, attention_cap) for group in attention]

    today_items = _today_jobs(
        visible_jobs,
        names,
        local_now,
        tz,
        can_jobs_start=can_jobs_start and variant == "today",
        can_jobs_complete=can_jobs_complete and variant == "today",
    )

    ops_board = None
    if variant == "ops" and assignments_reliable and can_jobs_view:
        ops_board = _ops_board(today_items, visible_jobs, job_assignees, member_names or {})

    summary, recent_quotes = _ops_summary(
        visible_quotes,
        visible_jobs,
        job_assignees,
        names,
        local_now,
        tz,
        variant=variant,
        assignments_reliable=assignments_reliable,
        exclude_quote_ids=frozenset(
            item["entity_id"]
            for group in attention
            for item in group["items"]
            if item.get("entity_type") == "quote"
        ),
    )
    business_chart = None
    if variant in {"ops", "sales", "observe"} and visible_quotes:
        business_chart = _business_chart(visible_quotes, local_now, tz)
    payload = {
        "home_variant": variant,
        "generated_at": now.isoformat(),
        "attention": attention,
        "today": {"label_he": "היום", "items": today_items[:TODAY_CAP]},
        "activity": _activity(events, visible_jobs, names, variant)[:ACTIVITY_CAP],
        "summary": summary,
        "recent_quotes": recent_quotes,
        "business_chart": business_chart,
        "ops_board": ops_board,
    }
    _assert_no_vanity(payload)
    return payload


def _quote_attention(
    quotes: list[dict[str, Any]],
    names: dict[str, str],
    now: datetime,
    variant: HomeVariant,
    project_source_quote_ids: frozenset[str],
) -> list[dict[str, Any]]:
    awaiting_customer: list[dict[str, Any]] = []
    awaiting_us: list[dict[str, Any]] = []
    expiring: list[dict[str, Any]] = []
    stale: list[dict[str, Any]] = []
    pending_project: list[dict[str, Any]] = []
    horizon = now + timedelta(days=7)
    stale_before = now - timedelta(days=3)

    for quote in quotes:
        status = quote.get("status")
        quote_id = str(quote["id"])
        row = _item(
            entity_type="quote",
            entity_id=quote_id,
            number=str(quote.get("number") or ""),
            title_he=QUOTE_LABEL_HE.get(str(status), "הצעת מחיר"),
            customer_name=names.get(str(quote["customer_id"])) if quote.get("customer_id") else None,
            site_name=names.get(str(quote["site_id"])) if quote.get("site_id") else None,
            scheduled_for=None,
            severity="next",
            updated_at=str(quote["updated_at"]) if quote.get("updated_at") else None,
            site_id=str(quote["site_id"]) if quote.get("site_id") else None,
        )
        if status == "sent":
            awaiting_customer.append(row)
        elif status == "viewed":
            awaiting_us.append({**row, "severity": "now"})
        elif status == "approved" and quote_id not in project_source_quote_ids:
            pending_project.append(
                {
                    **row,
                    "title_he": "אושרה · ממתינה לפרויקט",
                    "severity": "now",
                    "actions": ["create_project"],
                }
            )
        until = _parse_dt(quote.get("valid_until") if isinstance(quote.get("valid_until"), str) else None)
        is_expiring = bool(
            status in {"sent", "viewed"} and until and now <= until <= horizon
        )
        if is_expiring:
            # Prefer a single entity in status buckets; tag expiring as secondary signal.
            target = awaiting_us if status == "viewed" else awaiting_customer if status == "sent" else None
            if target is not None and target:
                tagged = dict(target[-1])
                actions = list(tagged.get("actions") or [])
                if "expiring_soon" not in actions:
                    actions.append("expiring_soon")
                tagged["actions"] = actions
                if status == "viewed":
                    tagged["severity"] = "now"
                target[-1] = tagged
            else:
                expiring.append({**row, "title_he": "פג תוקף בקרוב", "severity": "now"})
        updated = _parse_dt(quote.get("updated_at") if isinstance(quote.get("updated_at"), str) else None)
        if variant == "sales" and status == "draft" and updated and updated < stale_before:
            stale.append({**row, "title_he": "טיוטה ממתינה", "severity": "info"})

    groups: list[dict[str, Any]] = []
    for kind, label, items in (
        ("quote_approved_pending_project", "הצעות שאושרו וממתינות לפרויקט", pending_project),
        ("quote_awaiting_customer", "ממתינות לאישור הלקוח", awaiting_customer),
        ("quote_awaiting_us", "הצעות לאישור אצלנו", awaiting_us),
        ("quote_expiring", "הצעות שפג תוקפן בקרוב", expiring),
        ("quote_stale_draft", "טיוטות להשלמה", stale),
    ):
        group = _group(kind, label, items)
        if group:
            groups.append(group)
    return groups


def _unassigned_jobs(
    jobs: list[dict[str, Any]],
    job_assignees: dict[str, set[str]],
    names: dict[str, str],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for job in jobs:
        if job.get("status") not in OPEN_JOB:
            continue
        assignees = job_assignees.get(str(job["id"]), set())
        if assignees:
            continue
        rows.append(
            _item(
                entity_type="job",
                entity_id=str(job["id"]),
                number=str(job.get("number") or ""),
                title_he="מתוכננת · אין טכנאי",
                customer_name=names.get(str(job["customer_id"])) if job.get("customer_id") else None,
                site_name=names.get(str(job["site_id"])) if job.get("site_id") else None,
                scheduled_for=job.get("scheduled_for"),
                severity="now",
            )
        )
    return rows


def _overdue_jobs(
    jobs: list[dict[str, Any]],
    names: dict[str, str],
    local_now: datetime,
    tz: ZoneInfo,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for job in jobs:
        if job.get("status") not in OPEN_JOB:
            continue
        when = _parse_dt(job.get("scheduled_for") if isinstance(job.get("scheduled_for"), str) else None)
        if not when:
            continue
        when_local = when.astimezone(tz)
        if when_local >= local_now:
            continue
        rows.append(
            _item(
                entity_type="job",
                entity_id=str(job["id"]),
                number=str(job.get("number") or ""),
                title_he="באיחור",
                customer_name=names.get(str(job["customer_id"])) if job.get("customer_id") else None,
                site_name=names.get(str(job["site_id"])) if job.get("site_id") else None,
                scheduled_for=job.get("scheduled_for"),
                severity="now",
            )
        )
    return rows


def _today_jobs(
    jobs: list[dict[str, Any]],
    names: dict[str, str],
    local_now: datetime,
    tz: ZoneInfo,
    *,
    can_jobs_start: bool,
    can_jobs_complete: bool,
) -> list[dict[str, Any]]:
    today = local_now.date()
    rows: list[dict[str, Any]] = []
    for job in jobs:
        status = str(job.get("status") or "")
        if status in {"cancelled"}:
            continue
        when = _parse_dt(job.get("scheduled_for") if isinstance(job.get("scheduled_for"), str) else None)
        if status == "completed":
            completed = _parse_dt(job.get("completed_at") if isinstance(job.get("completed_at"), str) else None)
            if completed and completed.astimezone(tz).date() != today:
                continue
        elif when:
            when_local = when.astimezone(tz)
            if when_local.date() != today and status == "scheduled":
                continue
        elif status == "scheduled":
            continue
        actions: list[str] = []
        if can_jobs_start and status == "scheduled":
            actions.append("en_route")
        if can_jobs_start and status == "en_route":
            actions.append("arrived")
        if can_jobs_start and status == "arrived":
            actions.append("start")
        if can_jobs_complete and status == "in_progress":
            actions.append("complete")
        if status in {"en_route", "arrived", "in_progress", "blocked"}:
            severity = "now"
        elif status == "completed":
            severity = "info"
        else:
            severity = "next"
        rows.append(
            _item(
                entity_type="job",
                entity_id=str(job["id"]),
                number=str(job.get("number") or ""),
                title_he=str(job.get("title") or JOB_LABEL_HE.get(status, "עבודה")),
                customer_name=names.get(str(job["customer_id"])) if job.get("customer_id") else None,
                site_name=names.get(str(job["site_id"])) if job.get("site_id") else None,
                scheduled_for=job.get("scheduled_for"),
                scheduled_end=job.get("scheduled_end"),
                status=status,
                severity=severity,
                actions=actions,
            )
        )
    upcoming = [row for row in rows if row.get("severity") == "next"]
    upcoming.sort(key=lambda row: row.get("scheduled_for") or "")
    for extra in upcoming[1:]:
        extra["severity"] = "later"
    rows.sort(
        key=lambda row: (
            0
            if row.get("severity") == "now"
            else 1
            if row.get("severity") == "next"
            else 2
            if row.get("severity") == "later"
            else 3,
            row.get("scheduled_for") or "",
        )
    )
    return rows


ACTIVE_JOB = frozenset({"en_route", "arrived", "in_progress", "blocked"})
UNKNOWN_MEMBER_HE = "לא ידוע"


def _ops_board(
    today_items: list[dict[str, Any]],
    jobs: list[dict[str, Any]],
    job_assignees: dict[str, set[str]],
    member_names: dict[str, str],
) -> dict[str, Any]:
    """Ops card: today's jobs per technician and jobs nobody is assigned to.

    "Today" is the same set as the Today list (_today_jobs). A job with two assignees
    counts for both. Names come from workspace memberships; a missing one is "לא ידוע".
    """
    today_ids = {str(row["entity_id"]) for row in today_items if row.get("entity_type") == "job"}
    per_user: dict[str, dict[str, Any]] = {}
    unassigned_today = 0
    for row in today_items:
        if row.get("entity_type") != "job":
            continue
        job_id = str(row["entity_id"])
        status = str(row.get("status") or "")
        assignees = job_assignees.get(job_id, set())
        if not assignees:
            if status != "completed":
                unassigned_today += 1
            continue
        for user_id in assignees:
            entry = per_user.setdefault(
                user_id,
                {
                    "user_id": user_id,
                    "name": member_names.get(user_id) or UNKNOWN_MEMBER_HE,
                    "jobs_today": 0,
                    "in_progress": 0,
                    "completed": 0,
                },
            )
            entry["jobs_today"] += 1
            if status in ACTIVE_JOB:
                entry["in_progress"] += 1
            elif status == "completed":
                entry["completed"] += 1
    unassigned_open = sum(
        1 for job in jobs if job.get("status") in OPEN_JOB and not job_assignees.get(str(job["id"]))
    )
    technicians = sorted(per_user.values(), key=lambda e: (-e["jobs_today"], e["name"]))
    return {
        "technicians": technicians,
        "jobs_today": len(today_ids),
        "unassigned_today": unassigned_today,
        "unassigned_open": unassigned_open,
    }


def _activity(
    events: list[dict[str, Any]],
    jobs: list[dict[str, Any]],
    _names: dict[str, str],
    variant: HomeVariant,
) -> list[dict[str, Any]]:
    if variant == "today":
        events = []
    rows: list[dict[str, Any]] = []
    for event in events:
        etype = str(event.get("event_type") or "")
        label = EVENT_LABEL_HE.get(etype)
        if not label:
            continue
        number = event.get("quote_number") or ""
        title = f"{label} {number}".strip()
        rows.append(
            {
                "entity_type": "quote",
                "entity_id": str(event.get("quote_id") or ""),
                "title_he": title,
                "occurred_at": str(event.get("created_at") or ""),
            }
        )
    if variant in {"ops", "observe", "today"}:
        for job in jobs:
            completed = job.get("completed_at")
            if not completed:
                continue
            number = job.get("number") or ""
            rows.append(
                {
                    "entity_type": "job",
                    "entity_id": str(job["id"]),
                    "title_he": f"עבודה {number} נסגרה".strip(),
                    "occurred_at": str(completed),
                }
            )
    rows.sort(key=lambda row: row.get("occurred_at") or "", reverse=True)
    return rows


def _ops_summary(
    quotes: list[dict[str, Any]],
    jobs: list[dict[str, Any]],
    job_assignees: dict[str, set[str]],
    names: dict[str, str],
    local_now: datetime,
    tz: ZoneInfo,
    *,
    variant: HomeVariant,
    assignments_reliable: bool,
    exclude_quote_ids: frozenset[str] = frozenset(),
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    statuses = ("draft", "sent", "viewed", "approved", "rejected", "expired", "cancelled")
    counts = {key: 0 for key in statuses}
    approved_value = 0.0
    open_value = 0.0
    for quote in quotes:
        status = str(quote.get("status") or "")
        if status in counts:
            counts[status] += 1
        amount = float(quote.get("total_gross") or 0)
        if status == "approved":
            approved_value += amount
        if status in {"draft", "sent", "viewed"}:
            open_value += amount

    open_jobs = [job for job in jobs if job.get("status") in OPEN_JOB]
    overdue = 0
    unassigned = 0
    if variant != "sales":
        for job in open_jobs:
            when = _parse_dt(job.get("scheduled_for") if isinstance(job.get("scheduled_for"), str) else None)
            if when and when.astimezone(tz) < local_now:
                overdue += 1
            if assignments_reliable and not job_assignees.get(str(job["id"])):
                unassigned += 1

    summary = {
        "quotes_draft": counts["draft"],
        "quotes_sent": counts["sent"],
        "quotes_viewed": counts["viewed"],
        "quotes_approved": counts["approved"],
        "quotes_rejected": counts["rejected"],
        "quotes_open": counts["sent"] + counts["viewed"],
        "quotes_approved_value": round(approved_value, 2),
        "quotes_open_value": round(open_value, 2),
        "jobs_open": 0 if variant == "sales" else len(open_jobs),
        "jobs_overdue": 0 if variant == "sales" else overdue,
        "jobs_unassigned": 0 if variant in {"sales", "today"} or not assignments_reliable else unassigned,
    }

    recent: list[dict[str, Any]] = []
    if variant != "today":
        # Quotes already listed under "needs attention" are not repeated here. When every
        # quote is in that list, fall back to the newest ones: an empty card would claim
        # there are no quotes at all.
        fresh = [q for q in quotes if str(q["id"]) not in exclude_quote_ids]
        for quote in (fresh or quotes)[:RECENT_QUOTES_CAP]:
            recent.append(
                {
                    "id": str(quote["id"]),
                    "number": str(quote.get("number") or ""),
                    "status": str(quote.get("status") or ""),
                    "title": str(quote.get("title") or "").strip() or None,
                    "customer_name": names.get(str(quote["customer_id"])) if quote.get("customer_id") else None,
                    "total_gross": float(quote["total_gross"]) if quote.get("total_gross") is not None else None,
                    "updated_at": str(quote.get("updated_at") or ""),
                }
            )
    return summary, recent


HEBREW_MONTH_SHORT = (
    "ינו",
    "פבר",
    "מרץ",
    "אפר",
    "מאי",
    "יוני",
    "יולי",
    "אוג",
    "ספט",
    "אוק",
    "נוב",
    "דצמ",
)
_SKIP_CHART_STATUS = frozenset({"cancelled", "expired"})


def _month_start(year: int, month: int, tz: ZoneInfo) -> datetime:
    return datetime(year, month, 1, tzinfo=tz)


def _add_months(year: int, month: int, delta: int) -> tuple[int, int]:
    index = (year * 12 + (month - 1)) + delta
    return index // 12, (index % 12) + 1


def _month_buckets(local_now: datetime, tz: ZoneInfo, months: int = 6) -> list[tuple[datetime, datetime, str]]:
    end_year, end_month = local_now.year, local_now.month
    start_year, start_month = _add_months(end_year, end_month, -(months - 1))
    buckets: list[tuple[datetime, datetime, str]] = []
    year, month = start_year, start_month
    for _ in range(months):
        start = _month_start(year, month, tz)
        next_year, next_month = _add_months(year, month, 1)
        end = _month_start(next_year, next_month, tz)
        buckets.append((start, end, HEBREW_MONTH_SHORT[month - 1]))
        year, month = next_year, next_month
    return buckets


def _business_chart(
    quotes: list[dict[str, Any]], local_now: datetime, tz: ZoneInfo
) -> dict[str, Any] | None:
    buckets = _month_buckets(local_now, tz, 6)
    revenue = [0.0] * len(buckets)
    quote_counts = [0] * len(buckets)
    approved = [0] * len(buckets)
    totals = [0] * len(buckets)

    for quote in quotes:
        status = str(quote.get("status") or "")
        if status in _SKIP_CHART_STATUS:
            continue
        updated = _parse_dt(str(quote.get("updated_at") or ""))
        if not updated:
            continue
        amount = float(quote.get("total_gross") or 0)
        for i, (start, end, _) in enumerate(buckets):
            updated_local = updated.astimezone(tz)
            if start <= updated_local < end:
                quote_counts[i] += 1
                revenue[i] += amount
                totals[i] += 1
                if status == "approved":
                    approved[i] += 1
                break

    if sum(quote_counts) == 0:
        return None

    revenue_change_percent = None
    if len(revenue) >= 2:
        prev, curr = revenue[-2], revenue[-1]
        if prev > 0:
            revenue_change_percent = round((curr - prev) / prev * 100)
        elif curr > 0:
            revenue_change_percent = 100

    quote_change = quote_counts[-1] - quote_counts[-2] if len(quote_counts) >= 2 else None

    conversion_change_percent = None
    if len(totals) >= 2 and totals[-2] > 0 and totals[-1] > 0:
        prev_rate = round(approved[-2] / totals[-2] * 100)
        curr_rate = round(approved[-1] / totals[-1] * 100)
        conversion_change_percent = curr_rate - prev_rate

    return {
        "labels_he": [label for _, _, label in buckets],
        "revenue": [round(value, 2) for value in revenue],
        "quotes": quote_counts,
        "revenue_change_percent": revenue_change_percent,
        "quote_change": quote_change,
        "conversion_change_percent": conversion_change_percent,
    }


def _assert_no_vanity(payload: dict[str, Any]) -> None:
    blob = str(payload.keys())
    for key in VANITY_KEYS:
        if key in payload:
            raise ValueError(f"vanity field {key} is not allowed on dashboard")
        if key in blob and key in payload:
            raise ValueError(f"vanity field {key} is not allowed on dashboard")
