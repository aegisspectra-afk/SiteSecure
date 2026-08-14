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
