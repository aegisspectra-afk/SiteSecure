"""B3: customer approves the frozen sent alternatives — not later office edits."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.errors import ApiError
from app.quote_snapshot import public_alternatives, public_payload, version_snapshot
from app.routers import public_quotes as pq


def _frozen_public(*, alt_a_total: float = 1170.0, alt_b_total: float = 2340.0) -> dict:
    quote = {
        "id": "q1",
        "number": "Q-1",
        "version": 1,
        "status": "sent",
        "presentation_mode": "alternatives",
        "subtotal_net": 1000,
        "vat_amount": 170,
        "total_gross": 1170,
        "vat_percent": 17,
        "currency": "ILS",
        "cost_total": 999,  # must never appear in public
        "margin_percent": 50,
    }
    items = [
        {
            "id": "i1",
            "description": "מצלמה בסיסית",
            "qty": 1,
            "unit_price": 1000,
            "discount": 0,
            "line_net": 1000,
            "item_type": "catalog",
            "alternative_id": "a1",
            "cost": 600,
        },
        {
            "id": "i2",
            "description": "מצלמה מומלצת",
            "qty": 1,
            "unit_price": 2000,
            "discount": 0,
            "line_net": 2000,
            "item_type": "catalog",
            "alternative_id": "a2",
            "cost": 1000,
        },
    ]
    alts = [
        {
            "id": "a1",
            "label": "בסיסי",
            "sort_order": 1,
            "is_recommended": False,
            "subtotal_net": 1000,
            "vat_amount": 170,
            "total_gross": alt_a_total,
            "cost_total": 600,
            "margin_percent": 40,
        },
        {
            "id": "a2",
            "label": "מומלץ",
            "sort_order": 2,
            "is_recommended": True,
            "subtotal_net": 2000,
            "vat_amount": 340,
            "total_gross": alt_b_total,
            "cost_total": 1000,
            "margin_percent": 50,
        },
    ]
    return public_payload(
        quote,
        items,
        workspace={"name": "W"},
        customer={"display_name": "C"},
        site=None,
        status="sent",
        alternatives=alts,
        freeze_company=True,
    )


def test_public_alternatives_strip_cost_and_margin():
    rows = public_alternatives(
        [
            {
                "id": "a1",
                "label": "בסיסי",
                "sort_order": 1,
                "is_recommended": False,
                "subtotal_net": 1000,
                "vat_amount": 170,
                "total_gross": 1170,
                "cost_total": 600,
                "margin_amount": 400,
                "margin_percent": 40,
            }
        ]
    )
    assert len(rows) == 1
    assert rows[0]["total_gross"] == 1170.0
    assert "cost_total" not in rows[0]
    assert "margin_percent" not in rows[0]
    assert "margin_amount" not in rows[0]


def test_version_snapshot_public_has_alternatives_without_cost():
    snap = version_snapshot(
        {
            "id": "q1",
            "number": "Q-1",
            "version": 1,
            "presentation_mode": "alternatives",
            "subtotal_net": 1000,
            "vat_amount": 170,
            "total_gross": 1170,
            "vat_percent": 17,
            "currency": "ILS",
            "cost_total": 600,
            "margin_percent": 40,
        },
        [
            {
                "id": "i1",
                "description": "x",
                "qty": 1,
                "unit_price": 1000,
                "discount": 0,
                "line_net": 1000,
                "item_type": "catalog",
                "alternative_id": "a1",
                "cost": 600,
            }
        ],
        workspace={"name": "W"},
        customer={"display_name": "C"},
        site=None,
        status="sent",
        alternatives=[
            {
                "id": "a1",
                "label": "בסיסי",
                "sort_order": 1,
                "is_recommended": True,
                "subtotal_net": 1000,
                "vat_amount": 170,
                "total_gross": 1170,
                "cost_total": 600,
            }
        ],
    )
    public = snap["public"]
    assert public["presentation_mode"] == "alternatives"
    assert len(public["alternatives"]) == 1
    assert public["alternatives"][0]["total_gross"] == 1170.0
    assert "cost_total" not in public
    assert "cost_total" not in public["alternatives"][0]
    assert "cost" not in public["items"][0]
    assert public["items"][0]["alternative_id"] == "a1"


def test_approve_uses_frozen_snapshot_totals_not_later_office_edits():
    """Office edits after send must not change the frozen totals the customer approved."""
    frozen = _frozen_public(alt_a_total=1170.0, alt_b_total=2340.0)
    assert frozen["alternatives"][1]["total_gross"] == 2340.0

    access = {"quote_id": "q1", "workspace_id": "ws", "version": 1}
    quote = {
        "id": "q1",
        "workspace_id": "ws",
        "owner_user_id": "u1",
        "number": "Q-1",
        "status": "viewed",
        "version": 1,
        "presentation_mode": "alternatives",
        "deleted_at": None,
    }
    version_row = {"id": "v1", "version": 1, "snapshot": {"public": frozen}}
    approved_row = {
        "id": "q1",
        "workspace_id": "ws",
        "status": "approved",
        "approved_at": "t",
        "approved_name": "לקוח",
        "version": 1,
        "approved_alternative_id": "a2",
    }

    svc = MagicMock()
    svc.patch.return_value = SimpleNamespace(status_code=200)
    body = pq.PublicDecisionIn(
        name="לקוח",
        terms_accepted=True,
        signature_data_url="data:image/png;base64,aaa",
        chosen_alternative_id="a2",
    )

    with (
        patch.object(pq, "_load_access", return_value=access),
        patch.object(pq, "_load_quote", return_value=quote),
        patch.object(pq, "_maybe_expire", side_effect=lambda _s, q: q),
        patch.object(pq, "_load_version", return_value=version_row),
        patch.object(
            pq,
            "store_quote_signature_document",
            return_value={
                "document_id": "d1",
                "storage_path": "p",
                "checksum": "c",
                "byte_size": 10,
            },
        ),
        patch.object(pq, "freeze_approval_on_version"),
        patch.object(pq, "_event"),
        patch.object(pq, "_audit"),
        patch.object(pq, "try_notify"),
        patch.object(pq, "as_list", return_value=[approved_row]),
        patch("app.quote_value_guard.assert_quote_has_billable_value"),
    ):
        public = pq.approve_public_quote("tok", body, MagicMock(), svc)

    patch_body = svc.patch.call_args.args[1]
    assert patch_body["approved_alternative_id"] == "a2"
    assert public["status"] == "approved"
    # Customer still binds to the sent total for מומלץ — not a post-send office change.
    assert frozen["alternatives"][1]["total_gross"] == 2340.0
    assert public.get("alternatives") is None or public["alternatives"][1]["total_gross"] == 2340.0


def test_approve_rejects_missing_choice_when_alternatives_frozen():
    frozen = _frozen_public()
    access = {"quote_id": "q1", "workspace_id": "ws", "version": 1}
    quote = {
        "id": "q1",
        "workspace_id": "ws",
        "status": "viewed",
        "version": 1,
        "presentation_mode": "alternatives",
        "deleted_at": None,
    }
    svc = MagicMock()
    body = pq.PublicDecisionIn(
        name="לקוח",
        terms_accepted=True,
        signature_data_url="data:image/png;base64,aaa",
    )
    with (
        patch.object(pq, "_load_access", return_value=access),
        patch.object(pq, "_load_quote", return_value=quote),
        patch.object(pq, "_maybe_expire", side_effect=lambda _s, q: q),
        patch.object(pq, "_load_version", return_value={"snapshot": {"public": frozen}}),
        patch("app.quote_value_guard.assert_quote_has_billable_value"),
        pytest.raises(ApiError) as err,
    ):
        pq.approve_public_quote("tok", body, MagicMock(), svc)
    assert err.value.status_code == 400
    assert "חלופה" in err.value.message
