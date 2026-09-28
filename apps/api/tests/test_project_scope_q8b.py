"""Q8-B: project planned scope from pinned quote snapshot."""

from app.project_scope_from_quote import (
    classify_scope_kind,
    plan_project_scope_from_snapshot,
    should_include_quote_item,
)


def _snap(*, version: int = 1, items=None, sections=None):
    return {
        "status": "approved",
        "quote": {"id": "q1", "version": version, "number": "Q-1"},
        "sections": sections
        or [
            {"id": "s-cctv", "name": "ציוד CCTV", "sort_order": 10},
            {"id": "s-labor", "name": "התקנה", "sort_order": 20},
        ],
        "items": items
        or [
            {
                "id": "i-cam",
                "item_type": "catalog",
                "description": "מצלמה",
                "name": "מצלמה 4MP",
                "sku": "CAM-4",
                "qty": 8,
                "unit": "יח׳",
                "section_id": "s-cctv",
                "sort_order": 10,
                "product_id": "p-cam",
                "is_optional": False,
                "catalog_snapshot": {
                    "kind": "product",
                    "manufacturer": "QA Vision",
                    "model": "QV-T4",
                },
            },
            {
                "id": "i-opt",
                "item_type": "catalog",
                "description": "מצלמה אופציונלית",
                "qty": 1,
                "section_id": "s-cctv",
                "sort_order": 15,
                "is_optional": True,
            },
            {
                "id": "i-note",
                "item_type": "note",
                "description": "הערה פנימית",
                "qty": 1,
                "sort_order": 16,
            },
            {
                "id": "i-labor",
                "item_type": "service",
                "description": "התקנת מצלמה",
                "name": "התקנה",
                "qty": 8,
                "section_id": "s-labor",
                "sort_order": 20,
                "is_optional": False,
            },
        ],
        "public": {},
    }


def test_required_equipment_and_labor_from_rev1_snapshot():
    rows = plan_project_scope_from_snapshot(
        snapshot=_snap(version=1),
        workspace_id="w1",
        project_id="p1",
        source_quote_id="q1",
        source_quote_version=1,
    )
    assert len(rows) == 2
    cam = next(r for r in rows if r["source_quote_item_id"] == "i-cam")
    labor = next(r for r in rows if r["source_quote_item_id"] == "i-labor")
    assert cam["qty"] == 8
    assert cam["scope_kind"] == "equipment"
    assert cam["section_name"] == "ציוד CCTV"
    assert cam["manufacturer"] == "QA Vision"
    assert cam["source_quote_version"] == 1
    assert labor["scope_kind"] == "labor"
    assert labor["section_name"] == "התקנה"


def test_optional_and_notes_excluded():
    assert should_include_quote_item({"item_type": "note", "qty": 1}) is False
    assert should_include_quote_item({"item_type": "catalog", "qty": 1, "is_optional": True}) is False
    assert should_include_quote_item({"item_type": "catalog", "qty": 1, "is_optional": False}) is True
    rows = plan_project_scope_from_snapshot(
        snapshot=_snap(),
        workspace_id="w1",
        project_id="p1",
        source_quote_id="q1",
        source_quote_version=1,
    )
    ids = {r["source_quote_item_id"] for r in rows}
    assert "i-opt" not in ids
    assert "i-note" not in ids


def test_scope_pin_uses_passed_version_not_live_items():
    """Rev2 live items must not appear — only the provided snapshot is mapped."""
    rev1 = _snap(version=1)
    rev2_items = [
        {
            "id": "i-cam-v2",
            "item_type": "catalog",
            "description": "מצלמה חדשה Rev2",
            "qty": 12,
            "is_optional": False,
            "sort_order": 10,
        }
    ]
    rows = plan_project_scope_from_snapshot(
        snapshot=rev1,
        workspace_id="w1",
        project_id="p1",
        source_quote_id="q1",
        source_quote_version=1,
    )
    assert all(r["source_quote_version"] == 1 for r in rows)
    assert {r["source_quote_item_id"] for r in rows} == {"i-cam", "i-labor"}
    # Mapping a Rev2 snapshot is a separate explicit call — not automatic.
    rev2_rows = plan_project_scope_from_snapshot(
        snapshot=_snap(version=2, items=rev2_items, sections=[]),
        workspace_id="w1",
        project_id="p1",
        source_quote_id="q1",
        source_quote_version=2,
    )
    assert len(rev2_rows) == 1
    assert rev2_rows[0]["source_quote_item_id"] == "i-cam-v2"
    assert rev2_rows[0]["qty"] == 12


def test_free_item_type_classified_as_equipment():
    assert classify_scope_kind({"item_type": "free"}) == "equipment"
    assert classify_scope_kind({"item_type": "labor"}) == "labor"
    assert classify_scope_kind({"item_type": "service"}) == "labor"


def test_empty_or_missing_snapshot_yields_no_rows():
    assert plan_project_scope_from_snapshot(
        snapshot=None,
        workspace_id="w1",
        project_id="p1",
        source_quote_id="q1",
        source_quote_version=1,
    ) == []
    assert (
        plan_project_scope_from_snapshot(
            snapshot={"items": []},
            workspace_id="w1",
            project_id="p1",
            source_quote_id="q1",
            source_quote_version=1,
        )
        == []
    )


def test_approved_rev1_project_pin_regression():
    from app.project_from_quote import plan_project_from_quote

    plan = plan_project_from_quote(
        quote={
            "id": "q1",
            "workspace_id": "w1",
            "status": "approved",
            "customer_id": "c1",
            "site_id": "s1",
            "version": 1,
            "title": "פרויקט",
        },
        workspace_id="w1",
    )
    assert plan.source_quote_version == 1
    rows = plan_project_scope_from_snapshot(
        snapshot=_snap(version=plan.source_quote_version),
        workspace_id="w1",
        project_id="p1",
        source_quote_id=plan.source_quote_id,
        source_quote_version=plan.source_quote_version,
    )
    assert rows and all(r["source_quote_version"] == 1 for r in rows)
