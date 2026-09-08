"""Client/server error visibility for Private Beta."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..deps import UserClient, current_user, load_authz_context, user_client
from ..rest import created_or_403

router = APIRouter(prefix="/api/v1/telemetry", tags=["telemetry"])


class ClientErrorIn(BaseModel):
    workspace_id: UUID | None = None
    message: str = Field(min_length=1, max_length=2000)
    stack: str | None = Field(default=None, max_length=12000)
    page_url: str | None = Field(default=None, max_length=2000)
    user_agent: str | None = Field(default=None, max_length=500)
    app_version: str | None = Field(default=None, max_length=80)
    kind: str = Field(default="frontend_crash", max_length=80)


@router.post("/client-error")
def report_client_error(
    body: ClientErrorIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    role_key = None
    plan_key = None
    workspace_id = str(body.workspace_id) if body.workspace_id else None
    is_beta = False
    if body.workspace_id:
        ctx = load_authz_context(client, user["id"], str(body.workspace_id))
        role_key = ctx.role_key
        plan_key = ctx.plan_key
        ws = client.get("workspaces", params={"id": f"eq.{body.workspace_id}", "select": "is_beta"})
        if ws.status_code == 200 and ws.json():
            is_beta = bool(ws.json()[0].get("is_beta"))
    if not workspace_id:
        # Prefer first membership so platform admin crashes still land somewhere readable.
        mem = client.get(
            "workspace_memberships",
            params={"user_id": f"eq.{user['id']}", "status": "eq.active", "select": "workspace_id", "limit": "1"},
        )
        if mem.status_code == 200 and mem.json():
            workspace_id = str(mem.json()[0]["workspace_id"])
    if not workspace_id:
        return {"ok": True, "stored": False}
    ticket_id = f"TE-{uuid4().hex[:8].upper()}"
    details = [
        f"kind={body.kind}",
        f"version={body.app_version or 'unknown'}",
        f"message={body.message}",
    ]
    if body.stack:
        details.append(body.stack[:4000])
    created_or_403(
        client.post(
            "feedback_reports",
            {
                "ticket_id": ticket_id,
                "workspace_id": workspace_id,
                "user_id": user["id"],
                "report_type": "bug",
                "severity": "high",
                "title": f"[telemetry] {body.kind}: {body.message[:80]}",
                "body": "\n".join(details),
                "page_url": body.page_url,
                "user_agent": body.user_agent,
                "viewport": None,
                "role_key": role_key,
                "plan_key": plan_key,
                "is_beta": is_beta,
            },
        )
    )
    return {"ok": True, "stored": True, "ticket_id": ticket_id}
