from __future__ import annotations

from uuid import UUID

from .errors import ApiError


def actor_id(user: dict) -> str:
    """Identity comes from the verified JWT, never from the request body."""
    user_id = user.get("id")
    if not user_id:
        raise ApiError(401, "UNAUTHENTICATED", "נדרשת התחברות")
    return str(user_id)


def workspace_from_path(workspace_id: UUID) -> str:
    return str(workspace_id)


def reject_spoofed_workspace(path_workspace_id: str, body_workspace_id: str | None) -> None:
    if body_workspace_id and body_workspace_id != path_workspace_id:
        raise ApiError(400, "VALIDATION_ERROR", "סביבת העבודה בגוף הבקשה אינה תואמת לנתיב")


def is_workforce_only_principal(user: dict | None) -> bool:
    """True when Auth app_metadata marks a manager-provisioned workforce login."""
    if not isinstance(user, dict):
        return False
    meta = user.get("app_metadata") if isinstance(user.get("app_metadata"), dict) else {}
    flag = meta.get("workforce_only")
    if flag is True or str(flag or "").strip().lower() in {"true", "1", "t"}:
        return True
    return str(meta.get("provisioned_via") or "").strip().lower() == "workforce"
