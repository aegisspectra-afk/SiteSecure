"""Pure FleetMaster helpers (unit-testable, no DB)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from .errors import ApiError

MILEAGE_DECREASE_HE = "קילומטראז' חדש לא יכול להיות נמוך מהקילומטראז' הנוכחי."

MaintenanceStatus = Literal["normal", "soon", "due"]

MANAGERIAL_ROLES = frozenset({"owner", "administrator", "manager"})

FLEET_PERMISSION_PREFIX = "fleet."


def is_managerial_role(role_key: str | None) -> bool:
    return (role_key or "").strip() in MANAGERIAL_ROLES


def can_access_department(
    *,
    managerial: bool,
    membership_department_ids: set[str] | frozenset[str],
    department_id: str,
) -> bool:
    """Explicit department isolation check (mirrors RLS intent for clear 403s)."""
    if managerial:
        return True
    return str(department_id) in membership_department_ids


def validate_mileage_update(current: int | None, new: int) -> int:
    """Return distance driven. Raises ApiError if new mileage is below current."""
    cur = int(current or 0)
    if new < 0:
        raise ApiError(400, "VALIDATION_ERROR", "קילומטראז' לא יכול להיות שלילי")
    if new < cur:
        raise ApiError(400, "VALIDATION_ERROR", MILEAGE_DECREASE_HE)
    return new - cur


def maintenance_status(
    current_mileage: int | None,
    next_service_mileage: int | None,
    soon_km: int | None = 1000,
) -> MaintenanceStatus:
    if next_service_mileage is None:
        return "normal"
    remaining = int(next_service_mileage) - int(current_mileage or 0)
    if remaining <= 0:
        return "due"
    threshold = 1000 if soon_km is None else max(0, int(soon_km))
    if remaining <= threshold:
        return "soon"
    return "normal"


def _parse_optional_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    s = str(value).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d.%m.%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    raise ValueError("INVALID_DATE")


def _parse_optional_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        raise ValueError("INVALID_INT")
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if value != int(value):
            raise ValueError("INVALID_INT")
        return int(value)
    s = str(value).strip().replace(",", "")
    if not s:
        return None
    try:
        return int(float(s))
    except ValueError as exc:
        raise ValueError("INVALID_INT") from exc


def normalize_license_plate(value: Any) -> str:
    raw = str(value or "").strip().upper()
    return "".join(ch for ch in raw if ch.isalnum() or ch in "- ")


def validate_import_rows(
    rows: list[dict[str, Any]],
    *,
    existing_plates: set[str] | frozenset[str] | None = None,
) -> dict[str, Any]:
    """Validate mapped vehicle import rows. Returns a CSV-friendly preview summary."""
    existing = {normalize_license_plate(p) for p in (existing_plates or set()) if normalize_license_plate(p)}
    seen_in_file: set[str] = set()
    valid_rows: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    for idx, row in enumerate(rows):
        row_num = idx + 1
        plate = normalize_license_plate(row.get("license_plate") or row.get("plate"))
        if not plate:
            errors.append({"row": row_num, "field": "license_plate", "message": "חסר מספר רישוי"})
            continue
        if plate in seen_in_file:
            errors.append({"row": row_num, "field": "license_plate", "message": f"מספר רישוי כפול בקובץ: {plate}"})
            continue
        if plate in existing:
            errors.append(
                {
                    "row": row_num,
                    "field": "license_plate",
                    "message": f"מספר רישוי כבר קיים בסביבה: {plate}",
                }
            )
            continue

        try:
            mileage = _parse_optional_int(row.get("current_mileage") if "current_mileage" in row else row.get("mileage"))
        except ValueError:
            errors.append({"row": row_num, "field": "mileage", "message": "קילומטראז' לא תקין"})
            continue
        if mileage is not None and mileage < 0:
            errors.append({"row": row_num, "field": "mileage", "message": "קילומטראז' לא יכול להיות שלילי"})
            continue

        try:
            test_expiry = _parse_optional_date(row.get("test_expiry_date"))
            insurance_expiry = _parse_optional_date(row.get("insurance_expiry_date"))
        except ValueError:
            errors.append({"row": row_num, "field": "date", "message": "תאריך לא תקין"})
            continue

        year = None
        if row.get("year") not in (None, ""):
            try:
                year = _parse_optional_int(row.get("year"))
            except ValueError:
                errors.append({"row": row_num, "field": "year", "message": "שנה לא תקינה"})
                continue

        status = str(row.get("status") or "active").strip().lower() or "active"
        allowed_status = {"active", "maintenance", "temporarily_inactive", "inactive", "sold"}
        if status not in allowed_status:
            warnings.append({"row": row_num, "field": "status", "message": f"סטטוס לא מוכר, יוחלף ל-active: {status}"})
            status = "active"

        seen_in_file.add(plate)
        valid_rows.append(
            {
                "license_plate": plate,
                "vehicle_type": str(row.get("vehicle_type") or "car").strip() or "car",
                "manufacturer": (str(row["manufacturer"]).strip() if row.get("manufacturer") else None),
                "model": (str(row["model"]).strip() if row.get("model") else None),
                "year": year,
                "current_mileage": mileage if mileage is not None else 0,
                "status": status,
                "department_key": (str(row["department_key"]).strip() if row.get("department_key") else None),
                "department_id": (str(row["department_id"]).strip() if row.get("department_id") else None),
                "notes": (str(row["notes"]).strip() if row.get("notes") else None),
                "test_expiry_date": test_expiry.isoformat() if test_expiry else None,
                "insurance_provider": (
                    str(row["insurance_provider"]).strip() if row.get("insurance_provider") else None
                ),
                "insurance_policy_number": (
                    str(row["insurance_policy_number"]).strip() if row.get("insurance_policy_number") else None
                ),
                "insurance_expiry_date": insurance_expiry.isoformat() if insurance_expiry else None,
            }
        )

    return {
        "total": len(rows),
        "valid": len(valid_rows),
        "invalid": len(errors),
        "duplicate_plates": len([e for e in errors if "כפול" in e.get("message", "") or "כבר קיים" in e.get("message", "")]),
        "missing_plates": len([e for e in errors if e.get("field") == "license_plate" and "חסר" in e.get("message", "")]),
        "errors": errors,
        "warnings": warnings,
        "rows": valid_rows,
    }


def fleet_permissions_subset(grants: frozenset[str] | set[str]) -> list[str]:
    if "*" in grants:
        return sorted(
            [
                "fleet.view",
                "fleet.create",
                "fleet.edit",
                "fleet.delete",
                "fleet.mileage",
                "fleet.mileage_history",
                "fleet.maintenance",
                "fleet.documents",
                "fleet.equipment",
                "fleet.assignments",
                "fleet.schedules",
                "fleet.reports",
                "fleet.import",
                "fleet.departments",
            ]
        )
    return sorted(p for p in grants if str(p).startswith(FLEET_PERMISSION_PREFIX))
