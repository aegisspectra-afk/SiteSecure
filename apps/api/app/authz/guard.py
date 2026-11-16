from __future__ import annotations

from ..errors import MESSAGES, ApiError
from .catalog import load_catalog
from .engine import ITEM_SCOPED_TYPES, _scope_ok, authorize
from .types import AuthzContext, ResourceRef


def require(
    ctx: AuthzContext,
    action: str,
    *,
    resource: ResourceRef | None = None,
    invite_role: str | None = None,
) -> None:
    if ctx is not None and ctx.user_id and resource is not None and resource.id and resource.type in ITEM_SCOPED_TYPES:
        # Existence first: someone else's job / project / service call is 404 whatever the
        # action, so a permission error never confirms that the id exists.
        scope = load_catalog()["_role_scope"].get(ctx.role_key, "all")
        if not _scope_ok(scope, ctx, resource):
            raise ApiError(404, "NOT_FOUND", MESSAGES.get("NOT_FOUND", "לא נמצא"))
    decision = authorize(ctx=ctx, action=action, resource=resource, invite_role=invite_role)
    if decision.allowed:
        return
    if (
        decision.code == "SCOPE_DENIED"
        and resource is not None
        and resource.id
        and resource.type in ITEM_SCOPED_TYPES
    ):
        # Someone else's job / project / service call does not exist for this user.
        raise ApiError(404, "NOT_FOUND", MESSAGES.get("NOT_FOUND", "לא נמצא"))
    status = 401 if decision.code == "UNAUTHENTICATED" else 403
    raise ApiError(
        status,
        decision.code or "PERMISSION_DENIED",
        decision.message_he,
        decision.details,
    )
