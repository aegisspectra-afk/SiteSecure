"""B4: placements continue to checklist rows and installed equipment location_note."""

from app.cctv_camera_placements import (
    checklist_rows_for_placements,
    expand_location_notes,
    normalize_placements,
)
from app.routers.jobs import _checklist_rows


def test_normalize_and_expand_location_notes():
    placements = normalize_placements(
        [
            {"id": "a", "label": "כניסה", "count": 2, "environment": "outdoor"},
            {"id": "b", "label": "לובי", "count": 1, "environment": "indoor"},
        ]
    )
    assert len(placements) == 2
    notes = expand_location_notes(placements, 3)
    assert notes == ["כניסה", "כניסה", "לובי"]


def test_checklist_includes_one_row_per_placement():
    placements = normalize_placements(
        [
            {"id": "gate", "label": "שער", "count": 2},
            {"id": "yard", "label": "חצר", "count": 1},
        ]
    )
    rows = _checklist_rows(
        __import__("uuid").UUID("00000000-0000-0000-0000-000000000001"),
        "job-1",
        "installation",
        True,
        placements=placements,
    )
    keys = [r["item_key"] for r in rows]
    assert "placement:gate" in keys
    assert "placement:yard" in keys
    assert "cameras_mounted" not in keys  # replaced by per-location rows
    assert "site_walkthrough" in keys
    gate = next(r for r in rows if r["item_key"] == "placement:gate")
    assert "שער" in gate["label_he"]
    assert gate["photo_required"] is True


def test_checklist_rows_helper_sort_order():
    rows = checklist_rows_for_placements(
        workspace_id="ws",
        job_id="j1",
        placements=[{"id": "x", "label": "מחסן", "count": 1}],
        template_key="cctv_installation_v1",
        sort_start=1,
    )
    assert rows[0]["sort_order"] == 1
    assert rows[0]["item_key"] == "placement:x"
