from __future__ import annotations

from ..errors import ApiError
from .engine import authorize
from .types import AuthzContext, ResourceRef


def require(
    ctx: AuthzContext,
    action: str,
    *,
    resource: ResourceRef | None = None,
    invite_role: str | None = None,
) -> None:
    decision = authorize(ctx=ctx, action=action, resource=resource, invite_role=invite_role)
    if decision.allowed:
        return
    status = 401 if decision.code == "UNAUTHENTICATED" else 403
    raise ApiError(
        status,
        decision.code or "PERMISSION_DENIED",
        decision.message_he,
        decision.details,
    )
