"""INF-1: validate equipment Asset provenance within workspace/site."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from .errors import ApiError
from .rest import as_list


def _text(value: object) -> str:
    return str(value or "").strip()


def normalize_asset_code(value: object | None) -> str | None:
    raw = _text(value)
    return raw or None


def validate_equipment_provenance(
    client: Any,
    *,
    workspace_id: UUID,
    site_id: str,
    product_id: str | None = None,
    project_id: str | None = None,
    project_planned_item_id: str | None = None,
    system_id: str | None = None,
    zone_id: str | None = None,
    asset_code: str | None = None,
    exclude_equipment_id: str | None = None,
) -> dict[str, Any]:
    """Return normalized provenance fields ready for insert/patch.

    Raises ApiError on cross-workspace / site mismatches or asset_code collision.
    """
    out: dict[str, Any] = {}
    resolved_project_id = project_id

    if project_planned_item_id:
        rows = as_list(
            client.get(
                "project_planned_items",
                params={
                    "id": f"eq.{project_planned_item_id}",
                    "workspace_id": f"eq.{workspace_id}",
                    "select": "id,workspace_id,project_id",
                    "limit": "1",
                },
            )
        )
        if not rows:
            raise ApiError(400, "VALIDATION_ERROR", "פריט ההיקף המתוכנן לא נמצא בסביבת העבודה")
        planned_project = str(rows[0].get("project_id") or "")
        if resolved_project_id and planned_project and resolved_project_id != planned_project:
            raise ApiError(
                400,
                "VALIDATION_ERROR",
                "פריט ההיקף המתוכנן אינו שייך לפרויקט שנבחר",
            )
        if not resolved_project_id and planned_project:
            resolved_project_id = planned_project
        out["project_planned_item_id"] = project_planned_item_id

    if resolved_project_id:
        rows = as_list(
            client.get(
                "projects",
                params={
                    "id": f"eq.{resolved_project_id}",
                    "workspace_id": f"eq.{workspace_id}",
                    "select": "id,workspace_id,site_id",
                    "limit": "1",
                },
            )
        )
        if not rows:
            raise ApiError(400, "VALIDATION_ERROR", "הפרויקט לא נמצא בסביבת העבודה")
        project_site = str(rows[0].get("site_id") or "")
        if project_site and project_site != str(site_id):
            raise ApiError(400, "VALIDATION_ERROR", "הפרויקט אינו משויך לאתר של הציוד")
        out["project_id"] = resolved_project_id

    if product_id:
        rows = as_list(
            client.get(
                "products",
                params={
                    "id": f"eq.{product_id}",
                    "workspace_id": f"eq.{workspace_id}",
                    "select": "id,workspace_id",
                    "limit": "1",
                },
            )
        )
        if not rows:
            raise ApiError(400, "VALIDATION_ERROR", "המוצר לא נמצא בקטלוג של סביבת העבודה")
        out["product_id"] = product_id

    if system_id:
        rows = as_list(
            client.get(
                "systems",
                params={
                    "id": f"eq.{system_id}",
                    "workspace_id": f"eq.{workspace_id}",
                    "select": "id,site_id",
                    "limit": "1",
                },
            )
        )
        if not rows:
            raise ApiError(400, "VALIDATION_ERROR", "המערכת לא נמצאה בסביבת העבודה")
        if str(rows[0].get("site_id") or "") != str(site_id):
            raise ApiError(400, "VALIDATION_ERROR", "המערכת אינה שייכת לאתר של הציוד")
        out["system_id"] = system_id

    if zone_id:
        rows = as_list(
            client.get(
                "site_zones",
                params={
                    "id": f"eq.{zone_id}",
                    "workspace_id": f"eq.{workspace_id}",
                    "select": "id,site_id",
                    "limit": "1",
                },
            )
        )
        if not rows:
            raise ApiError(400, "VALIDATION_ERROR", "האזור לא נמצא באתר")
        if str(rows[0].get("site_id") or "") != str(site_id):
            raise ApiError(400, "VALIDATION_ERROR", "האזור אינו שייך לאתר של הציוד")
        out["zone_id"] = zone_id

    code = normalize_asset_code(asset_code)
    if code is not None:
        params: dict[str, str] = {
            "workspace_id": f"eq.{workspace_id}",
            "site_id": f"eq.{site_id}",
            "asset_code": f"eq.{code}",
            "select": "id",
            "limit": "1",
        }
        if exclude_equipment_id:
            params["id"] = f"neq.{exclude_equipment_id}"
        clash = as_list(client.get("equipment", params=params))
        if clash:
            raise ApiError(409, "RESOURCE_STATE", "קוד נכס זה כבר קיים באתר")
        out["asset_code"] = code

    return out
