from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from ..authz.engine import authorize
from ..authz.pricing import monthly_total_ils, plan_allows_extra_seats
from ..deps import UserClient, current_user, load_authz_context, user_client
from ..errors import MESSAGES, ApiError
from ..rest import created_or_403

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["billing"])

PUBLIC_PLAN_KEYS = frozenset({"free", "solo", "pro", "business", "enterprise"})


class BillingUpgradeRequestIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target_plan_key: str | None = Field(default=None, max_length=40)
    message: str | None = Field(default=None, max_length=2000)
    requested_extra_seats: int | None = Field(default=None, ge=0, le=500)
    estimated_monthly_ils_before_vat: float | None = Field(default=None, ge=0)
    contact_name: str | None = Field(default=None, max_length=200)
    contact_phone: str | None = Field(default=None, max_length=40)
    contact_email: str | None = Field(default=None, max_length=320)


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
    """Upgrade intake — honest form; no checkout."""
    ctx = load_authz_context(client, user["id"], str(workspace_id))
    decision = authorize(ctx=ctx, action="workspace.billing")
    if not decision.allowed:
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])

    target = _normalize_plan_key(body.target_plan_key) if body.target_plan_key else None
    if target and target not in PUBLIC_PLAN_KEYS:
        raise ApiError(400, "VALIDATION_ERROR", MESSAGES["VALIDATION_ERROR"])

    extras = max(0, int(body.requested_extra_seats or 0))
    if extras and target and not plan_allows_extra_seats(target):
        raise ApiError(400, "VALIDATION_ERROR", "מסלול זה אינו מאפשר משתמשים נוספים")

    estimated = body.estimated_monthly_ils_before_vat
    if estimated is None and target:
        estimated = monthly_total_ils(
            plan_key=target,
            extra_seats=extras,
            locked_price_ils_before_vat=getattr(ctx, "locked_price_ils_before_vat", None),
        )

    current = _normalize_plan_key(ctx.plan_key)
    payload = {
        "workspace_id": str(workspace_id),
        "user_id": user["id"],
        "current_plan_key": current,
        "target_plan_key": target,
        "message": (body.message or "").strip() or None,
        "requested_extra_seats": extras,
        "estimated_monthly_ils_before_vat": estimated,
        "contact_name": (body.contact_name or "").strip() or None,
        "contact_phone": (body.contact_phone or "").strip() or None,
        "contact_email": (body.contact_email or "").strip() or None,
        "status": "pending",
    }
    row = created_or_403(client.post("billing_upgrade_requests", payload))
    return {
        "id": row["id"],
        "workspace_id": row["workspace_id"],
        "current_plan_key": row.get("current_plan_key"),
        "target_plan_key": row.get("target_plan_key"),
        "message": row.get("message"),
        "requested_extra_seats": row.get("requested_extra_seats", extras),
        "estimated_monthly_ils_before_vat": row.get("estimated_monthly_ils_before_vat", estimated),
        "contact_name": row.get("contact_name"),
        "contact_phone": row.get("contact_phone"),
        "contact_email": row.get("contact_email"),
        "status": row.get("status"),
        "created_at": row.get("created_at"),
    }
