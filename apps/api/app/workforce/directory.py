"""Regions, posting sites, and positions for the active workspace only."""

from __future__ import annotations

from typing import Any

from ..errors import ApiError, MESSAGES
from ..rest import schema_missing
from .store import (
    DEFAULT_SITE_TIMEZONE,
    POSITION_SELECT,
    REGION_SELECT,
    SITE_KINDS,
    SITE_SELECT,
    SITE_SELECT_LEGACY,
    WorkforceTableStore,
    assert_ref,
    created_row,
    directory_out,
    exists,
    in_use,
    must_get,
    optional_code,
    patched_row,
    require_name,
    require_timezone,
    require_uuid,
    rows,
    rows_with_fallback,
    site_out,
    validation,
)


def list_regions(store: WorkforceTableStore, workspace_id: str) -> list[dict[str, Any]]:
    found = rows(
        store.get(
            "workforce_regions",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "select": REGION_SELECT,
                "order": "name.asc",
                "limit": "500",
            },
        )
    )
    return [directory_out(row) for row in found]


def create_region(store: WorkforceTableStore, workspace_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    body = {
        "workspace_id": workspace_id,
        "name": require_name(payload.get("name")),
        "code": optional_code(payload.get("code")),
        "is_active": bool(payload.get("is_active", True)),
    }
    return directory_out(
        created_row(
            store.post("workforce_regions", json=body, params={"select": REGION_SELECT}),
            conflict_message="שם האזור כבר קיים בסביבה זו",
        )
    )


def update_region(
    store: WorkforceTableStore,
    workspace_id: str,
    region_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    must_get(store, "workforce_regions", workspace_id, region_id, REGION_SELECT)
    patch: dict[str, Any] = {}
    if "name" in payload and payload.get("name") is not None:
        patch["name"] = require_name(payload.get("name"))
    if "code" in payload:
        patch["code"] = optional_code(payload.get("code"))
    if "is_active" in payload and payload.get("is_active") is not None:
        patch["is_active"] = bool(payload.get("is_active"))
    if not patch:
        raise validation("אין שדות לעדכון")
    return directory_out(
        patched_row(
            store.patch(
                "workforce_regions",
                patch,
                params={
                    "id": f"eq.{region_id}",
                    "workspace_id": f"eq.{workspace_id}",
                    "select": REGION_SELECT,
                },
            ),
            conflict_message="שם האזור כבר קיים בסביבה זו",
        )
    )


def delete_region(store: WorkforceTableStore, workspace_id: str, region_id: str) -> None:
    must_get(store, "workforce_regions", workspace_id, region_id, "id,workspace_id")
    sites = exists(store, "workforce_sites", {"workspace_id": f"eq.{workspace_id}", "region_id": f"eq.{region_id}"})
    employees = exists(
        store, "workforce_employees", {"workspace_id": f"eq.{workspace_id}", "region_id": f"eq.{region_id}"}
    )
    memberships = exists(
        store, "workforce_memberships", {"workspace_id": f"eq.{workspace_id}", "region_id": f"eq.{region_id}"}
    )
    shifts = exists(store, "workforce_shifts", {"workspace_id": f"eq.{workspace_id}", "region_id": f"eq.{region_id}"})
    slots = exists(store, "workforce_shift_slots", {"workspace_id": f"eq.{workspace_id}", "region_id": f"eq.{region_id}"})
    if sites or employees or memberships or shifts or slots:
        raise in_use(
            "region",
            sites=int(sites),
            employees=int(employees),
            memberships=int(memberships),
            shifts=int(shifts),
            slots=int(slots),
        )
    res = store.delete(
        "workforce_regions",
        params={"id": f"eq.{region_id}", "workspace_id": f"eq.{workspace_id}"},
    )
    status = getattr(res, "status_code", None)
    if status not in {200, 204}:
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])


def list_sites(store: WorkforceTableStore, workspace_id: str) -> list[dict[str, Any]]:
    found = rows_with_fallback(
        store,
        "workforce_sites",
        {
            "workspace_id": f"eq.{workspace_id}",
            "select": SITE_SELECT,
            "order": "name.asc",
            "limit": "500",
        },
        fallback_select=SITE_SELECT_LEGACY,
    )
    return [site_out(row) for row in found]


def create_site(
    store: WorkforceTableStore,
    workspace_id: str,
    payload: dict[str, Any],
    *,
    actor_user_id: str | None = None,
) -> dict[str, Any]:
    region_id = require_uuid(payload.get("region_id"), "אזור")
    assert_ref(store, "workforce_regions", workspace_id, region_id, "אזור")
    kind = (payload.get("kind") or "physical_site").strip() or "physical_site"
    if kind not in SITE_KINDS:
        raise validation("סוג האתר אינו תקין")
    address = payload.get("address") if isinstance(payload.get("address"), dict) else {}
    body = {
        "workspace_id": workspace_id,
        "name": require_name(payload.get("name")),
        "code": optional_code(payload.get("code")),
        "kind": kind,
        "region_id": region_id,
        "address": address,
        "is_active": bool(payload.get("is_active", True)),
        "timezone": require_timezone(payload.get("timezone") or DEFAULT_SITE_TIMEZONE),
        "notes": optional_code(payload.get("notes")),
        "created_by": actor_user_id,
    }
    res = store.post("workforce_sites", json=body, params={"select": SITE_SELECT})
    if schema_missing(res) and "timezone" in body:
        slim = {key: value for key, value in body.items() if key != "timezone"}
        res = store.post("workforce_sites", json=slim, params={"select": SITE_SELECT_LEGACY})
    return site_out(created_row(res, conflict_message="שם האתר כבר קיים בסביבה זו"))


def update_site(
    store: WorkforceTableStore,
    workspace_id: str,
    site_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    must_get(store, "workforce_sites", workspace_id, site_id, SITE_SELECT, fallback_select=SITE_SELECT_LEGACY)
    patch: dict[str, Any] = {}
    if "name" in payload and payload.get("name") is not None:
        patch["name"] = require_name(payload.get("name"))
    if "code" in payload:
        patch["code"] = optional_code(payload.get("code"))
    if "kind" in payload and payload.get("kind") is not None:
        kind = str(payload.get("kind") or "").strip()
        if kind not in SITE_KINDS:
            raise validation("סוג האתר אינו תקין")
        patch["kind"] = kind
    if "region_id" in payload:
        region_id = require_uuid(payload.get("region_id"), "אזור")
        assert_ref(store, "workforce_regions", workspace_id, region_id, "אזור")
        patch["region_id"] = region_id
    if "address" in payload:
        patch["address"] = payload.get("address") if isinstance(payload.get("address"), dict) else {}
    if "is_active" in payload and payload.get("is_active") is not None:
        patch["is_active"] = bool(payload.get("is_active"))
    if "timezone" in payload and payload.get("timezone") is not None:
        patch["timezone"] = require_timezone(payload.get("timezone"))
    if "notes" in payload:
        patch["notes"] = optional_code(payload.get("notes"))
    if not patch:
        raise validation("אין שדות לעדכון")
    return site_out(
        patched_row(
            store.patch(
                "workforce_sites",
                patch,
                params={"id": f"eq.{site_id}", "workspace_id": f"eq.{workspace_id}", "select": SITE_SELECT},
            ),
            conflict_message="שם האתר כבר קיים בסביבה זו",
        )
    )


def delete_site(store: WorkforceTableStore, workspace_id: str, site_id: str) -> None:
    must_get(store, "workforce_sites", workspace_id, site_id, "id,workspace_id")
    employees = exists(
        store, "workforce_employees", {"workspace_id": f"eq.{workspace_id}", "site_id": f"eq.{site_id}"}
    )
    memberships = exists(
        store, "workforce_memberships", {"workspace_id": f"eq.{workspace_id}", "site_id": f"eq.{site_id}"}
    )
    shifts = exists(store, "workforce_shifts", {"workspace_id": f"eq.{workspace_id}", "site_id": f"eq.{site_id}"})
    slots = exists(store, "workforce_shift_slots", {"workspace_id": f"eq.{workspace_id}", "site_id": f"eq.{site_id}"})
    coverage = exists(
        store, "workforce_coverage_requirements", {"workspace_id": f"eq.{workspace_id}", "site_id": f"eq.{site_id}"}
    )
    if employees or memberships or shifts or slots or coverage:
        raise in_use(
            "site",
            employees=int(employees),
            memberships=int(memberships),
            shifts=int(shifts),
            slots=int(slots),
            coverage=int(coverage),
        )
    res = store.delete(
        "workforce_sites",
        params={"id": f"eq.{site_id}", "workspace_id": f"eq.{workspace_id}"},
    )
    status = getattr(res, "status_code", None)
    if status not in {200, 204}:
        raise ApiError(403, "PERMISSION_DENIED", MESSAGES["PERMISSION_DENIED"])


def list_positions(store: WorkforceTableStore, workspace_id: str) -> list[dict[str, Any]]:
    found = rows(
        store.get(
            "workforce_positions",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "select": POSITION_SELECT,
                "order": "name.asc",
                "limit": "500",
            },
        )
    )
    return [directory_out(row) for row in found]
