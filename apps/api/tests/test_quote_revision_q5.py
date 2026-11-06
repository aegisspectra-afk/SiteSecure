"""Q5 revision integrity: prior snapshot unchanged after revise + live edits; historical document; compare fields."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.errors import ApiError
from app.routers import quote_cpq as cpq
from app.routers import quotes as quotes_router


def _quote(*, status: str = "sent", version: int = 1, **extra) -> dict:
    row = {
        "id": str(uuid4()),
        "workspace_id": str(uuid4()),
        "number": "Q-00020",
        "status": status,
        "version": version,
        "owner_user_id": str(uuid4()),
        "site_id": None,
        "sent_at": "2026-09-01T10:00:00+00:00",
        "viewed_at": "2026-09-01T11:00:00+00:00",
        "approved_at": None,
        "rejected_at": None,
        "approved_name": None,
        "rejection_reason": None,
        "margin_override_reason": None,
        "margin_override_by": None,
        "margin_override_at": None,
        "valid_until": "2026-12-31",
        "revise_reason": None,
    }
    row.update(extra)
    return row


def _snap_public(*, version: int, qty: float, price: float, discount: float = 0, optional: bool = False, section_name: str = "מצלמות") -> dict:
    sid = "sec-1"
    return {
        "version": version,
        "status": "sent",
        "total_gross": qty * price,
        "sections": [{"id": sid, "name": section_name, "sort_order": 10}],
        "items": [
            {
                "id": "i1",
                "sku": "CAM-1",
                "description": "מצלמה",
                "qty": qty,
                "unit_price": price,
                "discount": discount,
                "discount_type": "amount",
                "is_optional": optional,
                "section_id": sid,
                "line_net": qty * price - discount,
            }
        ],
    }


def _revise_patches(existing: dict, writer: MagicMock, items: list[dict]):
    return (
        patch.object(quotes_router, "_ctx", return_value=SimpleNamespace(role="owner")),
        patch.object(quotes_router, "_load_quote", return_value=existing),
        patch.object(quotes_router, "require", return_value=None),
        patch.object(quotes_router, "_quote_writer", return_value=writer),
        patch.object(quotes_router, "_load_items", return_value=items),
        patch.object(quotes_router, "write_audit"),
        patch.object(
            quotes_router,
            "_with_validation",
            side_effect=lambda _c, _w, row, its, **k: {**row, "items": its},
        ),
        patch.object(quotes_router, "_can_view_cost", return_value=False),
    )


def test_revise_clears_decision_state_bumps_version_retains_valid_until_and_items():
    # Rejected (not approved): approved quotes are final since S2 — see the 409 test below.
    ws = uuid4()
    qid = uuid4()
    existing = _quote(
        status="rejected",
        version=2,
        id=str(qid),
        workspace_id=str(ws),
        rejected_at="2026-09-02T00:00:00+00:00",
        rejection_reason="יקר מדי",
    )
    patched = {
        **existing,
        "status": "draft",
        "version": 3,
        "rejected_at": None,
        "rejection_reason": None,
        "sent_at": None,
        "viewed_at": None,
    }
    client = MagicMock()
    writer = MagicMock()
    writer.patch.return_value = MagicMock(status_code=200, json=MagicMock(return_value=[patched]))
    items = [{"id": "i1", "qty": 2, "unit_price": 100}]

    p1, p2, p3, p4, p5, p6, p7, p8 = _revise_patches(existing, writer, items)
    with p1, p2, p3, p4, p5, p6, p7, p8, patch.object(quotes_router, "_record_event") as event_fn:
        out = quotes_router.revise_quote(ws, qid, client, {"id": "u1"}, reason="תיקון מחיר")

    assert writer.patch.call_count == 1
    table, body = writer.patch.call_args.args[:2]
    assert table == "quotes"
    assert body["status"] == "draft"
    assert body["version"] == 3
    assert body["sent_at"] is None
    assert body["viewed_at"] is None
    assert body["approved_at"] is None
    assert body["approved_name"] is None
    assert body["rejected_at"] is None
    assert body["rejection_reason"] is None
    assert body["revise_reason"] == "תיקון מחיר"
    assert "valid_until" not in body  # retained on live row
    params = writer.patch.call_args.kwargs["params"]
    assert params["workspace_id"] == f"eq.{ws}"
    assert params["status"] == "eq.rejected"
    assert params["version"] == "eq.2"
    # Revise must not write quote_versions (no snapshot fork on revise)
    assert writer.post.call_count == 0
    assert client.post.call_count == 0
    assert client.patch.call_count == 0
    event_fn.assert_called_once()
    assert event_fn.call_args.args[3] == "revised"
    assert out["version"] == 3


def test_revise_approved_quote_is_locked_without_writes():
    ws = uuid4()
    qid = uuid4()
    existing = _quote(status="approved", version=2, id=str(qid), workspace_id=str(ws))
    client = MagicMock()
    writer = MagicMock()
    p1, p2, p3, p4, p5, p6, p7, p8 = _revise_patches(existing, writer, [])
    with p1, p2, p3, p4, p5, p6, p7, p8, patch.object(quotes_router, "_record_event") as event_fn:
        with pytest.raises(ApiError) as exc:
            quotes_router.revise_quote(ws, qid, client, {"id": "u1"})
    assert exc.value.status_code == 409
    assert exc.value.code == "QUOTE_APPROVED_LOCKED"
    assert writer.patch.call_count == 0
    event_fn.assert_not_called()


def test_revise_lost_race_returns_409_conflict_without_side_effects():
    ws = uuid4()
    qid = uuid4()
    existing = _quote(status="sent", version=4, id=str(qid), workspace_id=str(ws))
    client = MagicMock()
    writer = MagicMock()
    # Another request already reopened it: the conditional PATCH matches no row.
    writer.patch.return_value = MagicMock(status_code=200, json=MagicMock(return_value=[]))
    p1, p2, p3, p4, p5, p6, p7, p8 = _revise_patches(existing, writer, [])
    with p1, p2, p3, p4, p5, p6, p7, p8, patch.object(quotes_router, "_record_event") as event_fn:
        with pytest.raises(ApiError) as exc:
            quotes_router.revise_quote(ws, qid, client, {"id": "u1"})
    assert exc.value.status_code == 409
    assert exc.value.code == "QUOTE_VERSION_CONFLICT"
    params = writer.patch.call_args.kwargs["params"]
    assert params["status"] == "eq.sent"
    assert params["version"] == "eq.4"
    event_fn.assert_not_called()


def test_prior_snapshot_public_unchanged_when_loading_historical_after_live_edits():
    """Rev 1 customer document remains the frozen snapshot even if live items changed."""
    ws = uuid4()
    qid = uuid4()
    existing = _quote(status="draft", version=2, id=str(qid), workspace_id=str(ws))
    frozen = _snap_public(version=1, qty=1, price=500)
    version_row = {"id": "v1", "version": 1, "snapshot": {"status": "sent", "public": frozen}}
    client = MagicMock()

    with (
        patch.object(cpq, "_ctx", return_value=SimpleNamespace(role="owner")),
        patch.object(cpq, "_load_quote", return_value=existing),
        patch.object(cpq, "require", return_value=None),
        patch.object(cpq, "_load_version_row", return_value=version_row),
        patch.object(cpq, "_load_items") as live_items,
    ):
        doc = cpq.quote_version_document(ws, qid, 1, client, {"id": "u1"})

    live_items.assert_not_called()  # historical path must not read live rows
    assert doc["version"] == 1
    assert doc["historical"] is True
    assert doc["items"][0]["qty"] == 1
    assert doc["items"][0]["unit_price"] == 500
    assert doc["total_gross"] == 500


def test_compare_detects_qty_price_discount_optional_and_section_rename():
    ws = uuid4()
    qid = uuid4()
    existing = _quote(status="draft", version=2, id=str(qid), workspace_id=str(ws))
    left = {
        "version": 1,
        "snapshot": {"public": _snap_public(version=1, qty=1, price=100, discount=0, optional=False, section_name="מצלמות")},
    }
    right = {
        "version": 2,
        "snapshot": {"public": _snap_public(version=2, qty=3, price=120, discount=10, optional=True, section_name="CCTV")},
    }
    client = MagicMock()

    with (
        patch.object(cpq, "_ctx", return_value=SimpleNamespace(role="owner")),
        patch.object(cpq, "_load_quote", return_value=existing),
        patch.object(cpq, "require", return_value=None),
        patch.object(cpq, "_load_version_row", side_effect=[left, right]),
    ):
        result = cpq.compare_versions(ws, qid, client, {"id": "u1"}, from_version=1, to_version=2)

    kinds = {c["change"] for c in result["changes"]}
    assert "modified" in kinds
    line = next(c for c in result["changes"] if c["key"] == "CAM-1")
    assert line["from"]["qty"] == 1
    assert line["to"]["qty"] == 3
    assert line["from"]["unit_price"] == 100
    assert line["to"]["unit_price"] == 120
    assert line["from"]["discount"] == 0
    assert line["to"]["discount"] == 10
    assert line["from"]["is_optional"] is False
    assert line["to"]["is_optional"] is True
    section = next(c for c in result["changes"] if str(c["key"]).startswith("section:"))
    assert section["from"]["name"] == "מצלמות"
    assert section["to"]["name"] == "CCTV"


def test_version_document_404_when_snapshot_missing():
    ws = uuid4()
    qid = uuid4()
    existing = _quote(status="draft", version=2, id=str(qid), workspace_id=str(ws))
    client = MagicMock()
    with (
        patch.object(cpq, "_ctx", return_value=SimpleNamespace(role="owner")),
        patch.object(cpq, "_load_quote", return_value=existing),
        patch.object(cpq, "require", return_value=None),
        patch.object(cpq, "_load_version_row", return_value=None),
        pytest.raises(ApiError) as err,
    ):
        cpq.quote_version_document(ws, qid, 1, client, {"id": "u1"})
    assert err.value.status_code == 404


def test_project_from_quote_pins_approved_version():
    from app.project_from_quote import plan_project_from_quote

    quote = {
        "id": "q1",
        "workspace_id": "w1",
        "status": "approved",
        "customer_id": "c1",
        "site_id": "s1",
        "number": "Q-1",
        "version": 3,
        "title": "פרויקט בדיקה",
    }
    plan = plan_project_from_quote(quote=quote, workspace_id="w1")
    assert plan.source_quote_id == "q1"
    assert plan.source_quote_version == 3


def test_project_from_quote_pin_does_not_follow_live_version_field_absent():
    """Missing version defaults to 1 — still a frozen pin, not live lookup."""
    from app.project_from_quote import plan_project_from_quote

    plan = plan_project_from_quote(
        quote={
            "id": "q1",
            "workspace_id": "w1",
            "status": "approved",
            "customer_id": "c1",
            "site_id": "s1",
            "number": "Q-1",
        },
        workspace_id="w1",
    )
    assert plan.source_quote_version == 1
