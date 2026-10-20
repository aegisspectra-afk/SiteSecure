"""FleetMaster API — reports, import, seed-demo."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile

from ..audit import write_audit
from ..authz.guard import require
from ..config import get_settings
from ..deps import UserClient, current_user, user_client
from ..errors import ApiError
from ..fleet_import import (
    MAX_FILE_BYTES,
    apply_column_map,
    parse_upload,
    preview_import,
)
from ..fleet_logic import maintenance_status, normalize_license_plate
from ..rest import as_list, created_or_403
from .fleet_shared import (
    ASSIGN_SELECT,
    DEMO_DEPARTMENTS,
    MAINT_SELECT,
    MILEAGE_SELECT,
    REPORT_KEYS,
    ROUTER_PREFIX,
    ROUTER_TAGS,
    VEHICLE_SELECT,
    ImportCommitIn,
    ImportPreviewIn,
    assert_department_access,
    ctx,
    managerial,
    now_iso,
)

router = APIRouter(prefix=ROUTER_PREFIX, tags=ROUTER_TAGS)


@router.get("/fleet/reports/{report_key}")
def fleet_report(
    workspace_id: UUID,
    report_key: str,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    department_id: str | None = Query(default=None),
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.reports")
    if report_key not in REPORT_KEYS:
        raise ApiError(400, "VALIDATION_ERROR", f"דוח לא נתמך: {report_key}")
    is_mgr = managerial(c)
    if department_id:
        assert_department_access(client, workspace_id, department_id, c.user_id, is_mgr)

    generated_at = now_iso()
    vparams: dict[str, str] = {
        "workspace_id": f"eq.{workspace_id}",
        "archived_at": "is.null",
        "select": VEHICLE_SELECT,
        "limit": "5000",
    }
    if department_id:
        vparams["department_id"] = f"eq.{department_id}"
    vehicles = as_list(client.get("fleet_vehicles", params=vparams))
    soon = date.today() + timedelta(days=30)
    rows: list[dict[str, Any]] = []

    if report_key == "vehicles":
        for v in vehicles:
            rows.append(
                {
                    "id": v.get("id"),
                    "license_plate": v.get("license_plate"),
                    "department_id": v.get("department_id"),
                    "status": v.get("status"),
                    "vehicle_type": v.get("vehicle_type"),
                    "manufacturer": v.get("manufacturer"),
                    "model": v.get("model"),
                    "current_mileage": v.get("current_mileage"),
                    "assigned_user_id": v.get("assigned_user_id"),
                    "maintenance_status": maintenance_status(
                        v.get("current_mileage"), v.get("next_service_mileage"), v.get("maintenance_soon_km")
                    ),
                }
            )
    elif report_key == "by_department":
        counts: dict[str, int] = {}
        for v in vehicles:
            did = str(v.get("department_id") or "")
            counts[did] = counts.get(did, 0) + 1
        rows = [{"department_id": k, "vehicle_count": n} for k, n in sorted(counts.items())]
    elif report_key == "mileage":
        mparams: dict[str, str] = {
            "workspace_id": f"eq.{workspace_id}",
            "select": MILEAGE_SELECT,
            "order": "recorded_at.desc",
            "limit": "2000",
        }
        if department_id:
            mparams["department_id"] = f"eq.{department_id}"
        for m in as_list(client.get("fleet_mileage_logs", params=mparams)):
            rows.append(
                {
                    "id": m.get("id"),
                    "vehicle_id": m.get("vehicle_id"),
                    "department_id": m.get("department_id"),
                    "mileage": m.get("mileage"),
                    "previous_mileage": m.get("previous_mileage"),
                    "distance_since_previous": m.get("distance_since_previous"),
                    "recorded_at": m.get("recorded_at"),
                    "recorded_by": m.get("recorded_by"),
                    "source": m.get("source"),
                }
            )
    elif report_key == "maintenance":
        mparams = {
            "workspace_id": f"eq.{workspace_id}",
            "select": MAINT_SELECT,
            "order": "performed_on.desc",
            "limit": "2000",
        }
        if department_id:
            mparams["department_id"] = f"eq.{department_id}"
        for m in as_list(client.get("fleet_maintenance", params=mparams)):
            rows.append(
                {
                    "id": m.get("id"),
                    "vehicle_id": m.get("vehicle_id"),
                    "department_id": m.get("department_id"),
                    "maintenance_type": m.get("maintenance_type"),
                    "mileage": m.get("mileage"),
                    "performed_on": m.get("performed_on"),
                    "next_mileage": m.get("next_mileage"),
                    "provider": m.get("provider"),
                    "cost_cents": m.get("cost_cents"),
                }
            )
    elif report_key == "expiring_tests":
        for v in vehicles:
            ted = v.get("test_expiry_date")
            if not ted:
                continue
            try:
                d = date.fromisoformat(str(ted)[:10])
            except ValueError:
                continue
            if d <= soon:
                rows.append(
                    {
                        "id": v.get("id"),
                        "license_plate": v.get("license_plate"),
                        "department_id": v.get("department_id"),
                        "test_expiry_date": ted,
                        "days_remaining": (d - date.today()).days,
                    }
                )
    elif report_key == "expiring_insurance":
        for v in vehicles:
            ied = v.get("insurance_expiry_date")
            if not ied:
                continue
            try:
                d = date.fromisoformat(str(ied)[:10])
            except ValueError:
                continue
            if d <= soon:
                rows.append(
                    {
                        "id": v.get("id"),
                        "license_plate": v.get("license_plate"),
                        "department_id": v.get("department_id"),
                        "insurance_expiry_date": ied,
                        "insurance_provider": v.get("insurance_provider"),
                        "days_remaining": (d - date.today()).days,
                    }
                )
    elif report_key == "assignments":
        aparams: dict[str, str] = {
            "workspace_id": f"eq.{workspace_id}",
            "select": ASSIGN_SELECT,
            "order": "starts_at.desc",
            "limit": "2000",
        }
        if department_id:
            aparams["department_id"] = f"eq.{department_id}"
        for a in as_list(client.get("fleet_assignments", params=aparams)):
            rows.append(
                {
                    "id": a.get("id"),
                    "vehicle_id": a.get("vehicle_id"),
                    "department_id": a.get("department_id"),
                    "user_id": a.get("user_id"),
                    "starts_at": a.get("starts_at"),
                    "ends_at": a.get("ends_at"),
                    "active": a.get("ends_at") is None,
                }
            )
    else:  # overview
        by_status: dict[str, int] = {}
        due = soon_n = 0
        for v in vehicles:
            st = str(v.get("status") or "unknown")
            by_status[st] = by_status.get(st, 0) + 1
            ms = maintenance_status(
                v.get("current_mileage"), v.get("next_service_mileage"), v.get("maintenance_soon_km")
            )
            if ms == "due":
                due += 1
            elif ms == "soon":
                soon_n += 1
        rows = [
            {"metric": "total_vehicles", "value": len(vehicles)},
            {"metric": "maintenance_due", "value": due},
            {"metric": "maintenance_soon", "value": soon_n},
            *[{"metric": f"status_{k}", "value": n} for k, n in sorted(by_status.items())],
        ]

    return {"report_key": report_key, "generated_at": generated_at, "rows": rows}


@router.post("/fleet/import/parse")
async def import_parse(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
    file: UploadFile = File(...),
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.import")
    raw = await file.read()
    if len(raw) > MAX_FILE_BYTES:
        raise ApiError(400, "VALIDATION_ERROR", "הקובץ גדול מדי (מקסימום 8MB)")
    try:
        parsed = parse_upload(raw, filename=file.filename or "upload.xlsx", content_type=file.content_type)
    except ValueError as exc:
        code = str(exc)
        messages = {
            "FILE_TOO_LARGE": "הקובץ גדול מדי (מקסימום 8MB)",
            "EMPTY_FILE": "הקובץ ריק",
            "UNSUPPORTED_TYPE": "נתמכים רק קבצי XLSX או CSV",
            "PARSE_FAILED": "לא ניתן לקרוא את הקובץ",
            "ENCODING": "קידוד הקובץ לא נתמך",
            "OPENPYXL_MISSING": "ייבוא Excel דורש את הספרייה openpyxl",
        }
        raise ApiError(400, "VALIDATION_ERROR", messages.get(code, "קובץ לא תקין"), details={"code": code}) from exc
    return {
        "filename": parsed["filename"],
        "format": parsed["format"],
        "header_row": parsed.get("header_row"),
        "header_confidence": parsed.get("header_confidence"),
        "headers": parsed.get("headers"),
        "suggested_map": parsed.get("suggested_map"),
        "preview_rows": parsed.get("preview_rows"),
        "row_count": parsed.get("row_count"),
        "rows": parsed.get("rows"),
    }


@router.post("/fleet/import/preview")
def import_preview(
    workspace_id: UUID,
    body: ImportPreviewIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.import")
    rows = list(body.rows)
    if body.raw_rows is not None and body.column_map:
        rows = apply_column_map(body.raw_rows, header_row=body.header_row, column_map=body.column_map)
    existing = as_list(
        client.get(
            "fleet_vehicles",
            params={"workspace_id": f"eq.{workspace_id}", "select": "license_plate", "limit": "10000"},
        )
    )
    plates = {normalize_license_plate(r.get("license_plate")) for r in existing}
    result = preview_import(rows, existing_plates=plates)
    return {
        "summary": result["summary"],
        "errors": result["errors"],
        "warnings": result["warnings"],
        "rows": result["rows"],
        "valid_rows": result["all_valid_rows"],
        "department_id": body.department_id,
    }


@router.post("/fleet/import/commit")
def import_commit(
    workspace_id: UUID,
    body: ImportCommitIn,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.import")
    if not body.confirmed:
        raise ApiError(400, "VALIDATION_ERROR", "יש לאשר את הייבוא (confirmed=true)")
    assert_department_access(client, workspace_id, body.department_id, c.user_id, managerial(c))
    existing = as_list(
        client.get(
            "fleet_vehicles",
            params={"workspace_id": f"eq.{workspace_id}", "select": "license_plate", "limit": "10000"},
        )
    )
    plates = {normalize_license_plate(r.get("license_plate")) for r in existing}
    summary = preview_import(body.rows, existing_plates=plates)
    if summary["summary"]["invalid"]:
        raise ApiError(
            400,
            "VALIDATION_ERROR",
            "יש שורות לא תקינות בייבוא — תקנו לפני אישור",
            details={"errors": summary["errors"][:20]},
        )
    created = 0
    failed: list[dict] = []
    for row in summary["all_valid_rows"]:
        payload = {
            "workspace_id": str(workspace_id),
            "department_id": body.department_id,
            "license_plate": row["license_plate"],
            "vehicle_type": row.get("vehicle_type") or "car",
            "manufacturer": row.get("manufacturer"),
            "model": row.get("model"),
            "year": row.get("year"),
            "current_mileage": row.get("current_mileage") or 0,
            "status": row.get("status") or "active",
            "notes": row.get("notes"),
            "test_expiry_date": row.get("test_expiry_date"),
            "insurance_provider": row.get("insurance_provider"),
            "insurance_policy_number": row.get("insurance_policy_number"),
            "insurance_expiry_date": row.get("insurance_expiry_date"),
            "created_by": c.user_id,
            "updated_by": c.user_id,
        }
        res = client.post("fleet_vehicles", json=payload, params={"select": "id,license_plate"})
        if res.status_code in {200, 201}:
            created += 1
        else:
            failed.append({"license_plate": row["license_plate"], "status": res.status_code})
    write_audit(
        client,
        str(workspace_id),
        "fleet.import.commit",
        entity_type="fleet_vehicle",
        metadata={"created": created, "failed": len(failed), "department_id": body.department_id},
    )
    return {"created": created, "failed": failed, "total": len(summary["all_valid_rows"])}


@router.post("/fleet/seed-demo")
def seed_demo(
    workspace_id: UUID,
    client: Annotated[UserClient, Depends(user_client)],
    user: Annotated[dict, Depends(current_user)],
):
    c = ctx(client, user, workspace_id)
    require(c, "fleet.departments")
    settings = get_settings()
    if (settings.app_env or "").strip().lower() == "production":
        raise ApiError(403, "PERMISSION_DENIED", "יצירת נתוני דמו אינה זמינה בסביבת ייצור")

    existing_depts = as_list(
        client.get(
            "departments",
            params={"workspace_id": f"eq.{workspace_id}", "select": "id,key", "limit": "50"},
        )
    )
    if existing_depts:
        return {"skipped": True, "reason": "departments_exist", "departments": len(existing_depts)}

    dept_by_key: dict[str, str] = {}
    for spec in DEMO_DEPARTMENTS:
        row = created_or_403(
            client.post(
                "departments",
                json={
                    "workspace_id": str(workspace_id),
                    "key": spec["key"],
                    "name_he": spec["name_he"],
                    "name_en": spec["name_en"],
                    "sort_order": spec["sort_order"],
                    "is_active": True,
                    "modules": {"fleet": True},
                },
                params={"select": "id,key"},
            )
        )
        dept_by_key[spec["key"]] = row["id"]

    samples = [
        {"key": "patrol", "plate": "12-345-67", "type": "car", "manufacturer": "Toyota", "model": "Corolla", "km": 42000},
        {"key": "security", "plate": "98-765-43", "type": "van", "manufacturer": "Ford", "model": "Transit", "km": 88000},
        {"key": "technical", "plate": "11-222-33", "type": "pickup", "manufacturer": "Isuzu", "model": "D-Max", "km": 61000},
        {"key": "fleet", "plate": "55-666-77", "type": "car", "manufacturer": "Hyundai", "model": "i30", "km": 15000},
    ]
    vehicles_created = 0
    for s in samples:
        did = dept_by_key.get(s["key"])
        if not did:
            continue
        res = client.post(
            "fleet_vehicles",
            json={
                "workspace_id": str(workspace_id),
                "department_id": did,
                "license_plate": s["plate"],
                "vehicle_type": s["type"],
                "manufacturer": s["manufacturer"],
                "model": s["model"],
                "current_mileage": s["km"],
                "next_service_mileage": s["km"] + 10000,
                "status": "active",
                "created_by": c.user_id,
                "updated_by": c.user_id,
            },
            params={"select": "id"},
        )
        if res.status_code in {200, 201}:
            vehicles_created += 1

    write_audit(
        client,
        str(workspace_id),
        "fleet.seed_demo",
        entity_type="department",
        metadata={"departments": len(dept_by_key), "vehicles": vehicles_created},
    )
    return {
        "skipped": False,
        "departments": len(dept_by_key),
        "vehicles": vehicles_created,
        "department_ids": dept_by_key,
    }
