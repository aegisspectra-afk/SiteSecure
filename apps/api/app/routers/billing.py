from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from ..authz.engine import authorize
from ..deps import UserClient, current_user, load_authz_context, user_client
from ..errors import MESSAGES, ApiError
from ..rest import created_or_403

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["billing"])

PUBLIC_PLAN_KEYS = frozenset({"free", "solo", "pro", "business", "enterprise"})


class BillingUpgradeRequestIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target_plan_key: str | None = Field(default=None, max_length=40)
    message: str | None = Field(default=None, max_length=2000)


def _normalize_plan_key(plan_key: str | None) -> str:
    key = (plan_key or "free").strip()
    if key == "solo":
        return "free"
    return key


@router.post("/billing/upgrade-requests")
def create_billing_upgrade_request(
    workspace_id: UUID,
    body: BillingUpgradeRequestIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    """Beta intake — honest upgrade form; no checkout."""
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    decision = authorize(ctx=ctx, action="workspace.billing")
    if not decision.allowed:
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])

    target = _normalize_plan_key(body.target_plan_key) if body.target_plan_key else None
    if target and target not in PUBLIC_PLAN_KEYS:
        raise ApiError(400, "VALIDATION_ERROR", MESSAGES["VALIDATION_ERROR"])

    current = _normalize_plan_key(ctx.plan_key)
    payload = {
        "workspace_id": str(workspace_id),
        "user_id": user["id"],
        "current_plan_key": current,
        "target_plan_key": target,
        "message": (body.message or "").strip() or None,
        "status": "pending",
    }
    row = created_or_403(client.post("billing_upgrade_requests", payload))
    return {
        "id": row["id"],
        "workspace_id": row["workspace_id"],
        "current_plan_key": row.get("current_plan_key"),
        "target_plan_key": row.get("target_plan_key"),
        "message": row.get("message"),
        "status": row.get("status"),
        "created_at": row.get("created_at"),
    }