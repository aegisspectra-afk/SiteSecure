from __future__ import annotations

from .deps import ServiceClient
from .errors import ApiError, MESSAGES
from .rest import as_list


def require_platform_admin(service: ServiceClient, user_id: str) -> None:
    rows = as_list(
        service.get(
            "profiles",
            params={"id": f"eq.{user_id}", "select": "id,is_platform_admin"},
        )
    )
    if not rows or not rows[0].get("is_platform_admin"):
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
