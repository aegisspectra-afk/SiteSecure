"""Best-effort site timeline inserts for operational dispatch events."""

from __future__ import annotations

from typing import Any

from .supabase_user import UserClient


def write_site_timeline(
    client: UserClient,
    *,
    workspace_id: str,
    site_id: str | None,
    event_type: str,
    title: str,
    body: str | None = None,
    actor_id: str | None = None,
    source_type: str | None = None,
    source_id: str | None = None,
) -> None:
    if not site_id:
        return
    payload: dict[str, Any] = {
        "workspace_id": workspace_id,
        "site_id": site_id,
        "event_type": event_type,
        "title": title,
        "body": body,
        "actor_id": actor_id,
        "source_type": source_type,
        "source_id": source_id,
    }
    try:
        client.post("site_timeline_events", {k: v for k, v in payload.items() if v is not None})
    except Exception:
        return
