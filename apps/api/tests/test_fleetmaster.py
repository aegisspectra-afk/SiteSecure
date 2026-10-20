"""FleetMaster unit tests (no live DB)."""

from __future__ import annotations

import pytest

from app.errors import ApiError
from app.fleet_import import apply_column_map, parse_csv_bytes, preview_import, suggest_column_map
from app.fleet_logic import (
    MILEAGE_DECREASE_HE,
    can_access_department,
    is_managerial_role,
    maintenance_status,
    validate_import_rows,
    validate_mileage_update,
)


def test_mileage_cannot_decrease():
    assert validate_mileage_update(10000, 10500) == 500
    assert validate_mileage_update(10000, 10000) == 0
    with pytest.raises(ApiError) as exc:
        validate_mileage_update(10000, 9999)
    assert exc.value.status_code == 400
    assert exc.value.message == MILEAGE_DECREASE_HE


def test_mileage_rejects_negative():
    with pytest.raises(ApiError) as exc:
        validate_mileage_update(0, -1)
    assert "שלילי" in exc.value.message


def test_maintenance_status_remaining():
    assert maintenance_status(9000, 10000, 1000) == "soon"
    assert maintenance_status(10000, 10000, 1000) == "due"
    assert maintenance_status(11000, 10000, 1000) == "due"
    assert maintenance_status(5000, 10000, 1000) == "normal"
    assert maintenance_status(5000, None, 1000) == "normal"
    # remaining = 500, soon_km = 400 → still normal
    assert maintenance_status(9500, 10000, 400) == "normal"
    assert maintenance_status(9700, 10000, 400) == "soon"


def test_import_missing_and_duplicate_plate():
    rows = [
        {"license_plate": "", "mileage": 100},
        {"license_plate": "12-345-67", "mileage": 1000},
        {"license_plate": "12-345-67", "mileage": 2000},
        {"license_plate": "98-765-43", "mileage": 500},
    ]
    summary = validate_import_rows(rows, existing_plates={"98-765-43"})
    assert summary["missing_plates"] == 1
    assert summary["duplicate_plates"] >= 2  # file dup + existing
    assert summary["valid"] == 1
    assert summary["rows"][0]["license_plate"] == "12-345-67"


def test_import_preview_summary():
    result = preview_import(
        [
            {"license_plate": "AA-111-11", "current_mileage": 10, "יצרן": "Toyota"},
            {"plate": "AA-111-11", "mileage": 20},
        ]
    )
    assert result["summary"]["total"] == 2
    assert result["summary"]["valid"] == 1
    assert result["summary"]["invalid"] == 1


def test_department_isolation_helper():
    assert can_access_department(
        managerial=True, membership_department_ids=set(), department_id="d1"
    )
    assert can_access_department(
        managerial=False, membership_department_ids={"d1", "d2"}, department_id="d1"
    )
    assert not can_access_department(
        managerial=False, membership_department_ids={"d2"}, department_id="d1"
    )
    assert is_managerial_role("owner")
    assert is_managerial_role("manager")
    assert not is_managerial_role("technician")
    assert not is_managerial_role("viewer")


def test_hebrew_column_aliases():
    headers = ["מספר רישוי", "קילומטראז'", "יצרן", "דגם", "סטטוס"]
    mapping = suggest_column_map(headers)
    assert "license_plate" in mapping.values()
    assert "current_mileage" in mapping.values()
    assert "manufacturer" in mapping.values()


def test_parse_csv_and_apply_map():
    csv_data = "מספר רישוי,קילומטראז',יצרן\n11-222-33,15000,Hyundai\n".encode("utf-8")
    parsed = parse_csv_bytes(csv_data, filename="fleet.csv")
    assert parsed["format"] == "csv"
    assert parsed["header_row"] == 1
    mapped = apply_column_map(
        parsed["rows"],
        header_row=parsed["header_row"],
        column_map=parsed["suggested_map"],
    )
    assert len(mapped) == 1
    assert mapped[0]["license_plate"] == "11-222-33"
    assert int(mapped[0]["current_mileage"]) == 15000
