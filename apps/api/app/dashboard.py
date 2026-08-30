from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, Literal

HomeVariant = Literal["ops", "sales", "today", "observe"]

HOME_VARIANT: dict[str, HomeVariant] = {
    "owner": "ops",
    "administrator": "ops",
    "manager": "ops",
    "sales": "sales",
    "technician": "today",
    "founding_technician": "today",
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
    "in_progress": "בביצוע",
    "completed": "נסגרה",
    "cancelled": "בוטלה",
}

EVENT_LABEL_HE = {
    "sent": "הצעה נשלחה",
    "viewed": "הלקוח צפה בהצעה",
    "approved": "הלקוח אישר הצעה",
    "rejected": "הצעה נדחתה",
    "expired": "הצעה פגה",
}

OPEN_JOB = frozenset({"scheduled", "en_route", "in_progress"})
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
TODAY_CAP = 12
ACTIVITY_CAP = 8


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
) -> dict[str, Any]:
    return {
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


def _group(kind: str, label_he: str, items: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not items:
        return None
    capped = items[:ATTENTION_CAP]
    return {"kind": kind, "label_he": label_he, "count": len(capped), "items": capped}


def build_dashboard(
    *,
    role_key: str,
    user_id: str,
    now: datetime,
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
) -> dict[str, Any]:
    variant = home_variant(role_key)
    if now.tzinfo is None:
        now = now.replace(tzinfo=UTC)

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
        overdue = _overdue_jobs(visible_jobs, names, now)
        if variant == "today":
            overdue = [row for row in overdue if row["entity_id"] in {j["id"] for j in visible_jobs}]
        group = _group("job_overdue", "עבודות באיחור", overdue)
        if group:
            attention.append(group)

    today_items = _today_jobs(
        visible_jobs,
        names,
        now,
        can_jobs_start=can_jobs_start and variant == "today",
        can_jobs_complete=can_jobs_complete and variant == "today",
    )

    summary, recent_quotes = _ops_summary(
        visible_quotes,
        visible_jobs,
        job_assignees,
        names,
        now,
        variant=variant,
        assignments_reliable=assignments_reliable,
    )
    business_chart = None
    if variant in {"ops", "sales", "observe"} and visible_quotes:
        business_chart = _business_chart(visible_quotes, now)
    payload = {
        "home_variant": variant,
        "generated_at": now.isoformat(),
        "attention": attention,
        "today": {"label_he": "היום", "items": today_items[:TODAY_CAP]},
        "activity": _activity(events, visible_jobs, names, variant)[:ACTIVITY_CAP],
        "summary": summary,
        "recent_quotes": recent_quotes,
        "business_chart": business_chart,
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
        if status in {"sent", "viewed"} and until and now <= until <= horizon:
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
    now: datetime,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for job in jobs:
        if job.get("status") not in OPEN_JOB:
            continue
        when = _parse_dt(job.get("scheduled_for") if isinstance(job.get("scheduled_for"), str) else None)
        if not when or when >= now:
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
    now: datetime,
    *,
    can_jobs_start: bool,
    can_jobs_complete: bool,
) -> list[dict[str, Any]]:
    today = now.date()
    rows: list[dict[str, Any]] = []
    for job in jobs:
        if job.get("status") in {"completed", "cancelled"}:
            continue
        when = _parse_dt(job.get("scheduled_for") if isinstance(job.get("scheduled_for"), str) else None)
        if when and when.date() != today and job.get("status") == "scheduled":
            continue
        if not when and job.get("status") == "scheduled":
            continue
        actions: list[str] = []
        status = job.get("status")
        if can_jobs_start and status == "scheduled":
            actions.append("start")
        if can_jobs_complete and status in {"en_route", "in_progress"}:
            actions.append("complete")
        rows.append(
            _item(
                entity_type="job",
                entity_id=str(job["id"]),
                number=str(job.get("number") or ""),
                title_he=JOB_LABEL_HE.get(str(status), "עבודה"),
                customer_name=names.get(str(job["customer_id"])) if job.get("customer_id") else None,
                site_name=names.get(str(job["site_id"])) if job.get("site_id") else None,
                scheduled_for=job.get("scheduled_for"),
                severity="next" if status == "scheduled" else "now",
                actions=actions,
            )
        )
    rows.sort(key=lambda row: row.get("scheduled_for") or "")
    return rows


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
    now: datetime,
    *,
    variant: HomeVariant,
    assignments_reliable: bool,
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
            if when and when < now:
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
        for quote in quotes[:5]:
            recent.append(
                {
                    "id": str(quote["id"]),
                    "number": str(quote.get("number") or ""),
                    "status": str(quote.get("status") or ""),
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


def _month_start(year: int, month: int) -> datetime:
    return datetime(year, month, 1, tzinfo=UTC)


def _add_months(year: int, month: int, delta: int) -> tuple[int, int]:
    index = (year * 12 + (month - 1)) + delta
    return index // 12, (index % 12) + 1


def _month_buckets(now: datetime, months: int = 6) -> list[tuple[datetime, datetime, str]]:
    end_year, end_month = now.year, now.month
    start_year, start_month = _add_months(end_year, end_month, -(months - 1))
    buckets: list[tuple[datetime, datetime, str]] = []
    year, month = start_year, start_month
    for _ in range(months):
        start = _month_start(year, month)
        next_year, next_month = _add_months(year, month, 1)
        end = _month_start(next_year, next_month)
        buckets.append((start, end, HEBREW_MONTH_SHORT[month - 1]))
        year, month = next_year, next_month
    return buckets


def _business_chart(quotes: list[dict[str, Any]], now: datetime) -> dict[str, Any] | None:
    buckets = _month_buckets(now, 6)
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
            if start <= updated < end:
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
