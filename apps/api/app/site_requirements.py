"""Site create/edit requirements from workspace_settings.scheduling.sites."""

from __future__ import annotations

from uuid import UUID

from .deps import UserClient
from .errors import ApiError
from .rest import as_list


def load_site_requirement_flags(client: UserClient, workspace_id: UUID) -> dict[str, bool]:
    """Explicit True only — missing keys mean not enforced (avoid breaking soft creates)."""
    try:
        rows = as_list(
            client.get(
                "workspace_settings",
                params={"workspace_id": f"eq.{workspace_id}", "select": "scheduling"},
            )
        )
    except Exception:
        return {"require_address": False, "require_access_notes": False}
    if not rows:
        return {"require_address": False, "require_access_notes": False}
    scheduling = rows[0].get("scheduling") if isinstance(rows[0], dict) else {}
    sites = scheduling.get("sites") if isinstance(scheduling, dict) else {}
    if not isinstance(sites, dict):
        return {"require_address": False, "require_access_notes": False}
    return {
        "require_address": sites.get("require_address") is True,
        "require_access_notes": sites.get("require_access_notes") is True,
    }


def address_has_content(address: dict | None) -> bool:
    if not isinstance(address, dict) or not address:
        return False
    for key in ("line", "street", "city", "formatted", "address_line1", "addressLine1"):
        if str(address.get(key) or "").strip():
            return True
    return any(isinstance(v, str) and v.strip() for v in address.values())


def enforce_site_requirements(
    *,
    flags: dict[str, bool],
    address: dict | None,
    access_notes: str | None,
) -> None:
    if flags.get("require_address") and not address_has_content(address):
        raise ApiError(400, "VALIDATION_ERROR", "נדרשת כתובת לאתר לפי הגדרות הסביבה")
    if flags.get("require_access_notes") and not str(access_notes or "").strip():
        raise ApiError(400, "VALIDATION_ERROR", "נדרשות הערות גישה לאתר לפי הגדרות הסביבה")
