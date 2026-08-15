from __future__ import annotations

from typing import Any

from .supabase_user import UserClient


def write_audit(
    client: UserClient,
    workspace_id: str,
    action: str,
    *,
    entity_type: str | None = None,
    entity_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Best-effort audit insert. Never fails the caller action."""
    payload: dict[str, Any] = {
        "p_workspace_id": workspace_id,
        "p_action": action,
        "p_entity_type": entity_type,
        "p_entity_id": entity_id,
        "p_metadata": metadata or {},
    }
    try:
        client.rpc("write_audit_log", payload)
    except Exception:
        return
