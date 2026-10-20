"""Shared PostgREST helpers for Workforce directory and shifts."""

from __future__ import annotations

from typing import Any, Protocol
from uuid import UUID

from ..errors import ApiError, MESSAGES
from ..rest import schema_missing

SITE_KINDS = frozenset({"physical_site", "office", "ops_center", "other"})
REGION_SELECT = "id,workspace_id,name,code,is_active,created_at,updated_at"
SITE_SELECT = (
    "id,workspace_id,region_id,name,code,kind,address,is_active,notes,created_by,created_at,updated_at"
)
POSITION_SELECT = "id,workspace_id,name,code,is_active,created_at,updated_at"
SHIFT_SELECT = (
    "id,workspace_id,employee_id,site_id,region_id,position_id,starts_at,ends_at,notes,"
    "created_by,created_at,updated_at"
)


class WorkforceTableStore(Protocol):
    def get(self, path: str, params: dict | None = None) -> Any: ...
    def post(self, path: str, json: dict | list | None = None, params: dict | None = None) -> Any: ...
    def patch(self, path: str, json: dict, params: dict | None = None, *, prefer: str | None = None) -> Any: ...
    def delete(self, path: str, params: dict | None = None, *, prefer: str | None = None) -> Any: ...


def validation(message: str, **details: object) -> ApiError:
    return ApiError(400, "VALIDATION_ERROR", message, details or None)


def require_uuid(value: str | None, label: str) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return str(UUID(text))
    except ValueError:
        raise validation(f"{label} אינו תקין") from None


def require_name(value: str | None, label: str = "שם") -> str:
    name = (value or "").strip()
    if len(name) < 1:
        raise validation(f"{label} חובה")
    if len(name) > 120:
        raise validation(f"{label} ארוך מדי")
    return name


def optional_code(value: str | None) -> str | None:
    if value is None:
        return None
    code = value.strip()
    return code or None


def rows(res: Any) -> list[dict]:
    status = getattr(res, "status_code", None)
    if status == 200:
        data = res.json() if callable(getattr(res, "json", None)) else None
        return data if isinstance(data, list) else []
    if schema_missing(res):
        raise ApiError(503, "WORKFORCE_SCHEMA_UNAVAILABLE", MESSAGES["WORKFORCE_SCHEMA_UNAVAILABLE"])
    if status in {401, 403}:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    raise ApiError(400, "BUSINESS_RULE", MESSAGES["BUSINESS_RULE"])


def get_one(store: WorkforceTableStore, table: str, params: dict[str, str]) -> dict | None:
    query = dict(params)
    query.setdefault("select", "id,workspace_id")
    query.setdefault("limit", "1")
    found = rows(store.get(table, params=query))
    return found[0] if found else None


def must_get(store: WorkforceTableStore, table: str, workspace_id: str, row_id: str, select: str) -> dict:
    row = get_one(
        store,
        table,
        {"id": f"eq.{row_id}", "workspace_id": f"eq.{workspace_id}", "select": select, "limit": "1"},
    )
    if not row:
        raise ApiError(404, "NOT_FOUND", MESSAGES["NOT_FOUND"])
    return row


def assert_ref(
    store: WorkforceTableStore,
    table: str,
    workspace_id: str,
    ref_id: str | None,
    label: str,
) -> None:
    if not ref_id:
        return
    row = get_one(
        store,
        table,
        {"id": f"eq.{ref_id}", "workspace_id": f"eq.{workspace_id}", "select": "id,workspace_id"},
    )
    if not row:
        raise validation(f"{label} אינו שייך לסביבה זו")


def unique_violation(res: Any) -> bool:
    text = (getattr(res, "text", None) or "").lower()
    code = ""
    try:
        body = res.json() if callable(getattr(res, "json", None)) else None
        if isinstance(body, dict):
            code = str(body.get("code") or "")
            text = f"{text} {body.get('message') or ''}".lower()
    except Exception:
        pass
    return code == "23505" or "duplicate" in text or "unique" in text


def created_row(res: Any, *, conflict_message: str) -> dict:
    status = getattr(res, "status_code", None)
    if status in {200, 201}:
        data = res.json() if callable(getattr(res, "json", None)) else None
        if isinstance(data, list) and data and isinstance(data[0], dict):
            return data[0]
        if isinstance(data, dict) and data:
            return data
    if unique_violation(res):
        raise ApiError(409, "CONFLICT", conflict_message)
    if schema_missing(res):
        raise ApiError(503, "WORKFORCE_SCHEMA_UNAVAILABLE", MESSAGES["WORKFORCE_SCHEMA_UNAVAILABLE"])
    if status in {401, 403}:
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])
    raise ApiError(400, "BUSINESS_RULE", MESSAGES["BUSINESS_RULE"])


def patched_row(res: Any, *, conflict_message: str) -> dict:
    return created_row(res, conflict_message=conflict_message)


def exists(store: WorkforceTableStore, table: str, params: dict[str, str]) -> bool:
    query = dict(params)
    query["select"] = "id"
    query["limit"] = "1"
    return bool(rows(store.get(table, params=query)))


def in_use(resource: str, **counts: int) -> ApiError:
    details = {key: value for key, value in counts.items() if value}
    return ApiError(409, "WORKFORCE_IN_USE", MESSAGES["WORKFORCE_IN_USE"], details={"resource": resource, **details})


def directory_out(row: dict) -> dict[str, Any]:
    return {
        "id": str(row.get("id") or ""),
        "workspace_id": str(row.get("workspace_id") or ""),
        "name": row.get("name") or "",
        "code": row.get("code"),
        "is_active": bool(row.get("is_active", True)),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def site_out(row: dict) -> dict[str, Any]:
    address = row.get("address")
    return {
        **directory_out(row),
        "region_id": str(row["region_id"]) if row.get("region_id") else None,
        "kind": row.get("kind") or "physical_site",
        "address": address if isinstance(address, dict) else {},
        "notes": row.get("notes"),
        "created_by": str(row["created_by"]) if row.get("created_by") else None,
    }
