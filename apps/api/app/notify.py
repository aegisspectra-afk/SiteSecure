"""In-app notifications. Inserts use the service role (no authenticated INSERT policy)."""

from __future__ import annotations

from typing import Any

from .rest import as_list
from .supabase_service import ServiceClient

QUOTE_EVENT_TYPES = (
    "quote.sent",
    "quote.viewed",
    "quote.approved",
    "quote.rejected",
    "quote.expired",
)
TASK_EVENT_TYPES = ("task.assigned",)
WARRANTY_EVENT_TYPES = ("warranty.expiring",)
EVENT_TYPES = QUOTE_EVENT_TYPES + TASK_EVENT_TYPES + WARRANTY_EVENT_TYPES

EVENT_COPY: dict[str, tuple[str, str]] = {
    "quote.sent": ("הצעת מחיר נשלחה", "הצעה {number} נשלחה ללקוח"),
    "quote.viewed": ("הצעת מחיר נצפתה", "הלקוח פתח את הצעה {number}"),
    "quote.approved": ("הצעת מחיר אושרה", "הצעה {number} אושרה על ידי הלקוח"),
    "quote.rejected": ("הצעת מחיר נדחתה", "הצעה {number} נדחתה"),
    "quote.expired": ("הצעת מחיר פגה", "פג תוקף של הצעה {number}"),
    "task.assigned": ("משימה הוקצתה", "הוקצתה לך משימה: {title}"),
    "warranty.expiring": ("אחריות מסתיימת", "אחריות {number} מתקרבת לסיום"),
}


def in_app_allowed(svc: ServiceClient, workspace_id: str, user_id: str, event_type: str) -> bool:
    try:
        rows = as_list(
            svc.get(
                "notification_preferences",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "user_id": f"eq.{user_id}",
                    "event_type": f"eq.{event_type}",
                    "select": "in_app",
                    "limit": "1",
                },
            )
        )
    except Exception:
        return True
    if not rows:
        return True
    return rows[0].get("in_app") is not False


def emit_notification(
    svc: ServiceClient,
    *,
    workspace_id: str,
    recipient_user_id: str | None,
    event_type: str,
    title: str,
    body: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    payload: dict[str, Any] | None = None,
    actor_user_id: str | None = None,
) -> None:
    recipient = str(recipient_user_id or "").strip()
    if not recipient or recipient == str(actor_user_id or ""):
        return
    if not in_app_allowed(svc, str(workspace_id), recipient, event_type):
        return
    try:
        svc.post(
            "notifications",
            {
                "workspace_id": str(workspace_id),
                "recipient_user_id": recipient,
                "type": event_type,
                "title": title,
                "body": body,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "payload": payload or {},
            },
        )
    except Exception:
        return


_MONEY_KEYS = (
    "cost",
    "margin",
    "list_price",
    "unit_price",
    "total_gross",
    "subtotal_net",
    "vat_amount",
    "price",
)


def _safe_text(value: str) -> str:
    lowered = value.casefold()
    for key in _MONEY_KEYS:
        if key in lowered:
            return ""
    return value


def try_notify(fn, *args, **kwargs) -> None:
    """Best-effort: notification failure must not break the primary write."""
    try:
        fn(*args, **kwargs)
    except Exception:
        return


def notify_quote_event(
    svc: ServiceClient,
    quote: dict[str, Any],
    event_type: str,
    *,
    actor_user_id: str | None = None,
) -> None:
    title, body_tpl = EVENT_COPY.get(event_type, (event_type, "{number}"))
    number = str(quote.get("number") or quote.get("id") or "")
    emit_notification(
        svc,
        workspace_id=str(quote.get("workspace_id") or ""),
        recipient_user_id=str(quote.get("owner_user_id") or "") or None,
        event_type=event_type,
        title=_safe_text(title),
        body=_safe_text(body_tpl.format(number=number)),
        entity_type="quote",
        entity_id=str(quote.get("id") or "") or None,
        payload={"number": number, "status": quote.get("status")},
        actor_user_id=actor_user_id,
    )


def notify_task_assigned(
    svc: ServiceClient,
    task: dict[str, Any],
    *,
    workspace_id: str,
    actor_user_id: str | None = None,
) -> None:
    title, body_tpl = EVENT_COPY["task.assigned"]
    task_title = str(task.get("title") or "")
    emit_notification(
        svc,
        workspace_id=workspace_id,
        recipient_user_id=str(task.get("assignee_id") or "") or None,
        event_type="task.assigned",
        title=_safe_text(title),
        body=_safe_text(body_tpl.format(title=task_title)),
        entity_type="task",
        entity_id=str(task.get("id") or "") or None,
        payload={"title": task_title},
        actor_user_id=actor_user_id,
    )
