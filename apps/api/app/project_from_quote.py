"""Pure rules for creating a project from an approved quote."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .errors import ApiError


@dataclass(frozen=True, slots=True)
class ProjectFromQuotePlan:
    name: str
    customer_id: str
    site_id: str | None
    source_quote_id: str
    status: str = "planned"


def project_name_from_quote(quote: dict[str, Any]) -> str:
    for key in ("title", "project_name"):
        value = quote.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()[:200]
    number = str(quote.get("number") or "").strip()
    if number:
        return f"פרויקט מהצעה #{number}"[:200]
    return "פרויקט חדש"


def plan_project_from_quote(
    *,
    quote: dict[str, Any] | None,
    workspace_id: str,
    existing_project: dict[str, Any] | None = None,
) -> ProjectFromQuotePlan:
    if not quote:
        raise ApiError(404, "NOT_FOUND", "הצעת המחיר לא נמצאה")

    quote_ws = str(quote.get("workspace_id") or "")
    if quote_ws != str(workspace_id):
        raise ApiError(404, "NOT_FOUND", "הצעת המחיר לא נמצאה")

    if existing_project:
        raise ApiError(
            409,
            "RESOURCE_STATE",
            "פרויקט כבר קיים עבור הצעת המחיר הזו.",
            details={"project_id": str(existing_project.get("id") or "")},
        )

    status = str(quote.get("status") or "")
    if status != "approved":
        if status in {"draft", "sent", "viewed"}:
            raise ApiError(
                409,
                "RESOURCE_STATE",
                "הצעת המחיר עדיין לא אושרה ולכן לא ניתן ליצור ממנה פרויקט.",
            )
        if status in {"rejected", "expired", "cancelled", "superseded"}:
            raise ApiError(
                409,
                "RESOURCE_STATE",
                "לא ניתן ליצור פרויקט מהצעת מחיר במצב הנוכחי.",
            )
        raise ApiError(
            409,
            "RESOURCE_STATE",
            "הצעת המחיר עדיין לא אושרה ולכן לא ניתן ליצור ממנה פרויקט.",
        )

    customer_id = quote.get("customer_id")
    if not customer_id:
        raise ApiError(
            409,
            "RESOURCE_STATE",
            "להצעת המחיר אין לקוח משויך, ולכן לא ניתן ליצור פרויקט.",
        )

    site_id = quote.get("site_id")
    return ProjectFromQuotePlan(
        name=project_name_from_quote(quote),
        customer_id=str(customer_id),
        site_id=str(site_id) if site_id else None,
        source_quote_id=str(quote["id"]),
        status="planned",
    )
