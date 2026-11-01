from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..deps import UserClient, current_user, load_authz_context, user_client
from ..errors import ApiError
from ..identity import actor_id
from ..notify import EVENT_TYPES
from ..pagination import decode_cursor, page_from_rows, parse_limit
from ..rest import as_list, one_or_404, patched_or_403

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["notifications"])

NOTIF_SELECT = (
    "id,workspace_id,recipient_user_id,type,title,body,entity_type,entity_id,"
    "payload,read_at,created_at"
)
PREF_SELECT = "workspace_id,user_id,event_type,in_app,email,push"


def _ctx(client: UserClient, user: dict, workspace_id: UUID):
    return load_authz_context(client, actor_id(user), str(workspace_id))


class NotificationOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    workspace_id: str
    type: str
    title: str
    body: str | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    payload: dict = Field(default_factory=dict)
    read_at: str | None = None
    created_at: str | None = None


class NotificationPageOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[NotificationOut]
    next_cursor: str | None = None
    unread_count: int


class UnreadCountOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    unread_count: int


class PreferenceOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event_type: str
    in_app: bool
    email: bool = False
    push: bool = False


class PreferencesOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[PreferenceOut]


class PreferencesPut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[PreferenceOut] = Field(max_length=20)


def _notif_out(row: dict) -> NotificationOut:
    return NotificationOut(
        id=str(row["id"]),
        workspace_id=str(row["workspace_id"]),
        type=str(row.get("type") or ""),
        title=str(row.get("title") or ""),
        body=row.get("body"),
        entity_type=row.get("entity_type"),
        entity_id=str(row["entity_id"]) if row.get("entity_id") else None,
        payload=row.get("payload") if isinstance(row.get("payload"), dict) else {},
        read_at=row.get("read_at"),
        created_at=row.get("created_at"),
    )


def _unread_count(client: UserClient, workspace_id: UUID, recipient: str) -> int:
    rows = as_list(
        client.get(
            "notifications",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "recipient_user_id": f"eq.{recipient}",
                "read_at": "is.null",
                "select": "id",
                "limit": "1000",
            },
        )
    )
    return len(rows)


@router.get("/notifications", response_model=NotificationPageOut)
def list_notifications(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    unread_only: bool = False,
    limit: int | None = Query(default=30),
    cursor: str | None = Query(default=None),
) -> NotificationPageOut:
    _ctx(client, user, workspace_id)
    recipient = actor_id(user)
    page_size = parse_limit(limit)
    params: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "recipient_user_id": f"eq.{recipient}",
        "select": NOTIF_SELECT,
        "order": "created_at.desc",
        "limit": str(page_size + 1),
    }
    if unread_only:
        params["read_at"] = "is.null"
    before = decode_cursor(cursor)
    if before:
        params["created_at"] = f"lt.{before}"
    rows = as_list(client.get("notifications", params=params))
    page = page_from_rows(rows, page_size)
    return NotificationPageOut(
        items=[_notif_out(row) for row in page.items],
        next_cursor=page.next_cursor,
        unread_count=_unread_count(client, workspace_id, recipient),
    )


@router.get("/notifications/unread-count", response_model=UnreadCountOut)
def unread_count(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> UnreadCountOut:
    _ctx(client, user, workspace_id)
    return UnreadCountOut(unread_count=_unread_count(client, workspace_id, actor_id(user)))


@router.post("/notifications/read-all")
def mark_all_read(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> UnreadCountOut:
    _ctx(client, user, workspace_id)
    recipient = actor_id(user)
    now = datetime.now(UTC).isoformat()
    client.patch(
        "notifications",
        {"read_at": now},
        params={
            "workspace_id": f"eq.{workspace_id}",
            "recipient_user_id": f"eq.{recipient}",
            "read_at": "is.null",
        },
    )
    return UnreadCountOut(unread_count=0)


@router.post("/notifications/{notification_id}/read")
def mark_read(
    workspace_id: UUID,
    notification_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> NotificationOut:
    _ctx(client, user, workspace_id)
    recipient = actor_id(user)
    one_or_404(
        client.get(
            "notifications",
            params={
                "id": f"eq.{notification_id}",
                "workspace_id": f"eq.{workspace_id}",
                "recipient_user_id": f"eq.{recipient}",
                "select": "id",
            },
        )
    )
    now = datetime.now(UTC).isoformat()
    row = patched_or_403(
        client.patch(
            "notifications",
            {"read_at": now},
            params={
                "id": f"eq.{notification_id}",
                "workspace_id": f"eq.{workspace_id}",
                "recipient_user_id": f"eq.{recipient}",
                "select": NOTIF_SELECT,
            },
        )
    )
    return _notif_out(row if isinstance(row, dict) else {})


@router.get("/notification-preferences", response_model=PreferencesOut)
def get_preferences(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> PreferencesOut:
    _ctx(client, user, workspace_id)
    rows = as_list(
        client.get(
            "notification_preferences",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "user_id": f"eq.{actor_id(user)}",
                "select": PREF_SELECT,
            },
        )
    )
    by_type = {str(row.get("event_type")): row for row in rows}
    items = []
    for event_type in EVENT_TYPES:
        row = by_type.get(event_type) or {}
        items.append(
            PreferenceOut(
                event_type=event_type,
                in_app=row.get("in_app") is not False,
                email=False,
                push=False,
            )
        )
    return PreferencesOut(items=items)


@router.put("/notification-preferences", response_model=PreferencesOut)
def put_preferences(
    workspace_id: UUID,
    body: PreferencesPut,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
) -> PreferencesOut:
    _ctx(client, user, workspace_id)
    recipient = actor_id(user)
    allowed = set(EVENT_TYPES)
    seen: set[str] = set()
    for item in body.items:
        if item.event_type not in allowed:
            raise ApiError(400, "VALIDATION_ERROR", "סוג התראה לא נתמך")
        if item.event_type in seen:
            continue
        seen.add(item.event_type)
        payload = {
            "workspace_id": str(workspace_id),
            "user_id": recipient,
            "event_type": item.event_type,
            "in_app": item.in_app,
            "email": False,
            "push": False,
        }
        existing = as_list(
            client.get(
                "notification_preferences",
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "user_id": f"eq.{recipient}",
                    "event_type": f"eq.{item.event_type}",
                    "select": "event_type",
                    "limit": "1",
                },
            )
        )
        if existing:
            client.patch(
                "notification_preferences",
                {"in_app": item.in_app, "email": False, "push": False},
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "user_id": f"eq.{recipient}",
                    "event_type": f"eq.{item.event_type}",
                },
            )
        else:
            client.post("notification_preferences", payload)
    return get_preferences(workspace_id, client, user)
