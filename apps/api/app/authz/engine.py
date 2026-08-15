from __future__ import annotations

from ..errors import MESSAGES
from .catalog import load_catalog
from .types import AuthzContext, Decision, ResourceRef

QUOTE_LOCKED = frozenset({"approved", "cancelled"})


def _deny(code: str, **details: object) -> Decision:
    return Decision(False, code, MESSAGES.get(code, code), details)


def _allow() -> Decision:
    return Decision(True)


def authorize(
    *,
    ctx: AuthzContext | None,
    action: str,
    resource: ResourceRef | None = None,
    invite_role: str | None = None,
) -> Decision:
    """Server authorization pipeline. UI hiding is not a substitute."""
    catalog = load_catalog()

    if ctx is None or not ctx.user_id:
        return _deny("UNAUTHENTICATED")

    if ctx.workspace_status != "active":
        return _deny("TENANT_INACTIVE")

    if ctx.subscription_status not in {"trialing", "active", "manual"}:
        return _deny("SUBSCRIPTION_INVALID")

    required_feature = catalog.get("permission_feature", {}).get(action)
    if required_feature and required_feature not in ctx.features:
        return _deny("FEATURE_NOT_INCLUDED", feature=required_feature)

    grants: frozenset[str] = catalog["_grants"].get(ctx.role_key, frozenset())
    if action not in grants:
        return _deny("PERMISSION_DENIED", action=action, role=ctx.role_key)

    scope = catalog["_role_scope"].get(ctx.role_key, "all")
    scoped = _scope_ok(scope, ctx, resource)
    if not scoped:
        return _deny("SCOPE_DENIED", scope=scope)

    state_deny = _resource_state(action, resource)
    if state_deny:
        return state_deny

    rule_deny = _business_rules(ctx, action, invite_role=invite_role)
    if rule_deny:
        return rule_deny

    return _allow()


def _scope_ok(scope: str, ctx: AuthzContext, resource: ResourceRef | None) -> bool:
    if resource is None or resource.id is None:
        return True
    if scope in {"all", "team"}:
        return True
    if scope == "owned":
        if ctx.role_key in {"owner", "administrator", "manager"}:
            return True
        return resource.owner_user_id == ctx.user_id
    if scope == "assigned":
        if resource.site_assigned:
            return True
        if ctx.user_id in resource.assignee_ids:
            return True
        if resource.id and resource.id in ctx.assigned_resource_ids:
            return True
        if resource.site_id and resource.site_id in ctx.assigned_resource_ids:
            return True
        return False
    return False


def _resource_state(action: str, resource: ResourceRef | None) -> Decision | None:
    if resource is None or resource.state is None:
        return None
    if action == "quotes.edit" and resource.state in QUOTE_LOCKED:
        return _deny("RESOURCE_STATE", state=resource.state)
    if action == "quotes.send" and resource.state not in {"draft", "sent"}:
        return _deny("RESOURCE_STATE", state=resource.state)
    if action == "jobs.start" and resource.state not in {"scheduled", None}:
        return _deny("RESOURCE_STATE", state=resource.state)
    if action == "jobs.complete" and resource.state not in {"in_progress", "en_route"}:
        return _deny("RESOURCE_STATE", state=resource.state)
    return None


def _business_rules(
    ctx: AuthzContext, action: str, *, invite_role: str | None
) -> Decision | None:
    if action == "users.invite" and invite_role:
        catalog = load_catalog()
        assignable = catalog.get("_plan_assignable", {}).get(ctx.plan_key, frozenset())
        if invite_role not in assignable:
            return _deny("BUSINESS_RULE", reason="role_not_assignable", invite_role=invite_role)
    return None
