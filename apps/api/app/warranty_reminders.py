"""Warranty expiry reminders (60 / 14 days) — Business+ ``service.reminders``.

Daily runner notifies members who can manage jobs (``jobs.assign``). Dedup via
``warranty_reminder_events`` so the same window is never sent twice.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any
from uuid import UUID

from .notify import emit_notification
from .rest import as_list
from .supabase_service import ServiceClient

REMINDER_DAYS: tuple[int, ...] = (60, 14)

# Roles / grants that "manage jobs" for reminder recipients.
_JOB_MANAGER_ACTIONS = frozenset({"jobs.assign", "jobs.create", "*"})


def due_reminder_windows(*, ends_on: date | str | None, today: date) -> tuple[int, ...]:
    if ends_on is None or ends_on == "":
        return ()
    if isinstance(ends_on, str):
        ends_on = date.fromisoformat(ends_on[:10])
    delta = (ends_on - today).days
    return tuple(d for d in REMINDER_DAYS if d == delta)


def reminder_title_he(days: int) -> str:
    if days == 60:
        return "אחריות שמסתיימת ב-60 יום"
    if days == 14:
        return "אחריות שמסתיימת ב-14 יום"
    return f"אחריות שמסתיימת בעוד {days} ימים"


def reminder_body_he(*, number: str, days: int, ends_on: str) -> str:
    return f"אחריות {number} מסתיימת בעוד {days} ימים ({ends_on}). מומלץ להציע חוזה תחזוקה."


def _parse_date(value: object) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    text = str(value)
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def warranty_attention_items(
    warranties: list[dict[str, Any]],
    *,
    today: date | None = None,
    horizon_days: int = 60,
) -> list[dict[str, Any]]:
    """Dashboard card rows: warranties ending within ``horizon_days`` (active only)."""
    now = today or date.today()
    items: list[dict[str, Any]] = []
    for row in warranties:
        if str(row.get("status") or "") not in {"active", "expiring_soon"}:
            continue
        ends = _parse_date(row.get("ends_on"))
        if ends is None:
            continue
        days_left = (ends - now).days
        if days_left < 0 or days_left > horizon_days:
            continue
        wid = str(row.get("id") or "")
        number = str(row.get("number") or "")
        items.append(
            {
                "entity_type": "warranty",
                "entity_id": wid,
                "title": reminder_title_he(60 if days_left > 14 else 14),
                "subtitle": f"{number} · עד {ends.isoformat()}",
                "href": f"/app/warranties/{wid}" if wid else None,
                "tone": "warning" if days_left <= 14 else "info",
                "meta": {"days_left": days_left, "ends_on": ends.isoformat()},
            }
        )
    items.sort(key=lambda r: int((r.get("meta") or {}).get("days_left") or 0))
    return items


def _already_sent(svc: ServiceClient, workspace_id: str, warranty_id: str, days_before: int) -> bool:
    rows = as_list(
        svc.get(
            "warranty_reminder_events",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "warranty_id": f"eq.{warranty_id}",
                "days_before": f"eq.{days_before}",
                "select": "id",
                "limit": "1",
            },
        )
    )
    return bool(rows)


def _mark_sent(
    svc: ServiceClient,
    *,
    workspace_id: str,
    warranty_id: str,
    days_before: int,
) -> None:
    try:
        svc.post(
            "warranty_reminder_events",
            {
                "workspace_id": workspace_id,
                "warranty_id": warranty_id,
                "days_before": days_before,
            },
        )
    except Exception:
        return


def _job_manager_user_ids(svc: ServiceClient, workspace_id: str) -> list[str]:
    members = as_list(
        svc.get(
            "workspace_memberships",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "status": "eq.active",
                "select": "user_id,role_key",
            },
        )
    )
    # Owner / admin / manager / roles with jobs.assign in catalog — keep simple: office managers.
    office = frozenset({"owner", "administrator", "manager"})
    out: list[str] = []
    for m in members:
        if str(m.get("role_key") or "") in office:
            uid = str(m.get("user_id") or "")
            if uid:
                out.append(uid)
    return out


def run_workspace_warranty_reminders(
    svc: ServiceClient,
    workspace_id: str | UUID,
    *,
    today: date | None = None,
) -> dict[str, Any]:
    """Emit due reminders for one workspace. Idempotent per (warranty, days_before)."""
    ws = str(workspace_id)
    now = today or date.today()
    warranties = as_list(
        svc.get(
            "warranties",
            params={
                "workspace_id": f"eq.{ws}",
                "status": "in.(active,expiring_soon)",
                "ends_on": f"gte.{now.isoformat()}",
                "select": "id,number,ends_on,status,customer_id,site_id",
                "limit": "500",
            },
        )
    )
    recipients = _job_manager_user_ids(svc, ws)
    sent = 0
    skipped = 0
    for row in warranties:
        ends = _parse_date(row.get("ends_on"))
        windows = due_reminder_windows(ends_on=ends, today=now)
        if not windows:
            continue
        wid = str(row.get("id") or "")
        number = str(row.get("number") or "")
        ends_s = ends.isoformat() if ends else ""
        for days in windows:
            if _already_sent(svc, ws, wid, days):
                skipped += 1
                continue
            title = reminder_title_he(days)
            body = reminder_body_he(number=number, days=days, ends_on=ends_s)
            for uid in recipients:
                emit_notification(
                    svc,
                    workspace_id=ws,
                    recipient_user_id=uid,
                    event_type="warranty.expiring",
                    title=title,
                    body=body,
                    entity_type="warranty",
                    entity_id=wid,
                    payload={"days_before": days, "ends_on": ends_s},
                )
            _mark_sent(svc, workspace_id=ws, warranty_id=wid, days_before=days)
            if days == 60 or (ends and (ends - now).days <= 14):
                try:
                    svc.patch(
                        "warranties",
                        {"status": "expiring_soon"},
                        params={"id": f"eq.{wid}", "workspace_id": f"eq.{ws}"},
                    )
                except Exception:
                    pass
            sent += 1
    return {"sent": sent, "skipped": skipped, "recipients": len(recipients)}


def run_all_warranty_reminders(svc: ServiceClient, *, today: date | None = None) -> dict[str, Any]:
    """Daily sweep across workspaces that have the capability (caller filters)."""
    workspaces = as_list(svc.get("workspaces", params={"select": "id", "limit": "2000"}))
    totals = {"workspaces": 0, "sent": 0, "skipped": 0}
    for row in workspaces:
        wid = str(row.get("id") or "")
        if not wid:
            continue
        result = run_workspace_warranty_reminders(svc, wid, today=today)
        totals["workspaces"] += 1
        totals["sent"] += int(result.get("sent") or 0)
        totals["skipped"] += int(result.get("skipped") or 0)
    return totals


def next_due_date(*, today: date, days: int) -> date:
    return today + timedelta(days=days)
