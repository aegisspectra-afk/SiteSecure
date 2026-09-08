from __future__ import annotations

from typing import Any

from .deps import ServiceClient
from .errors import ApiError, MESSAGES
from .rest import as_list

# V1: profiles.is_platform_admin=true ≡ platform_super_admin.
# Independent of workspace RBAC and recognition badges.
PLATFORM_SUPER_ADMIN = "platform_super_admin"


def require_platform_admin(service: ServiceClient, user_id: str) -> None:
    rows = as_list(
        service.get(
            "profiles",
            params={"id": f"eq.{user_id}", "select": "id,is_platform_admin"},
        )
    )
    if not rows or not rows[0].get("is_platform_admin"):
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])


def platform_role_for(is_admin: bool) -> str | None:
    return PLATFORM_SUPER_ADMIN if is_admin else None


def write_platform_admin_event(
    service: ServiceClient,
    *,
    actor_user_id: str,
    action: str,
    target_user_id: str | None = None,
    target_workspace_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Best-effort Platform Admin audit insert. Never fails the caller action."""
    payload: dict[str, Any] = {
        "actor_user_id": actor_user_id,
        "action": action,
        "metadata": metadata or {},
    }
    if target_user_id:
        payload["target_user_id"] = target_user_id
    if target_workspace_id:
        payload["target_workspace_id"] = target_workspace_id
    try:
        service.post("platform_admin_events", payload)
    except Exception:
        return
