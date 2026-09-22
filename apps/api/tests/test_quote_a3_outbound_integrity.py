"""A3 outbound integrity: Share=VIEW, Send=DECIDE, staff PDF=snapshot, Send concurrency."""

from __future__ import annotations

import inspect
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.errors import ApiError
from app.routers import public_quotes as pq
from app.routers import quotes as quotes_router


def _access(*, version: int = 1) -> dict:
    return {
        "id": "a1",
        "workspace_id": "ws1",
        "quote_id": "q1",
        "version": version,
        "expires_at": None,
        "revoked_at": None,
    }


def _quote(*, status: str = "draft", version: int = 1) -> dict:
    return {
        "id": "q1",
        "workspace_id": "ws1",
        "number": "Q-1",
        "status": status,
        "version": version,
        "deleted_at": None,
        "valid_until": None,
        "sent_at": None,
        "viewed_at": None,
        "approved_at": None,
        "rejected_at": None,
        "approved_name": None,
    }


def _version_row(*, description: str = "מצלמה", total: float = 1000.0) -> dict:
    return {
        "id": "v1",
        "version": 1,
        "snapshot": {
            "status": "draft",
            "public": {
                "id": "q1",
                "number": "Q-1",
                "version": 1,
                "status": "draft",
                "title": "הצעה",
                "currency": "ILS",
                "subtotal_net": total,
                "vat_amount": 0,
                "total_gross": total,
                "items": [
                    {
                        "id": "i1",
                        "description": description,
                        "qty": 1,
                        "unit_price": total,
                        "line_net": total,
                        "item_type": "catalog",
                    }
                ],
                "sections": [],
                "company": {"name": "אגיס"},
                "customer": {"display_name": "לקוח"},
            },
        },
        "created_at": "2026-01-01T00:00:00+00:00",
    }


def test_assemble_draft_share_open_does_not_promote_or_allow_decide():
    svc = MagicMock()
    access = _access()
    quote = _quote(status="draft")
    with (
        patch.object(pq, "_load_access", return_value=access),
        patch.object(pq, "_load_quote", return_value=quote),
        patch.object(pq, "_maybe_expire", side_effect=lambda _s, q: q),
        patch.object(pq, "_load_version", return_value=_version_row()),
        patch.object(pq, "_event") as event,
        patch.object(pq, "_audit") as audit,
    ):
        public = pq._assemble(svc, "tok", mark_viewed=True)

    assert public["status"] == "draft"
    assert public["can_approve"] is False
    assert public["can_reject"] is False
    svc.patch.assert_not_called()
    event.assert_not_called()
    audit.assert_not_called()


def test_assemble_repeated_draft_views_stay_draft():
    svc = MagicMock()
    access = _access()
    quote = _quote(status="draft")
    with (
        patch.object(pq, "_load_access", return_value=access),
        patch.object(pq, "_load_quote", return_value=quote),
        patch.object(pq, "_maybe_expire", side_effect=lambda _s, q: q),
        patch.object(pq, "_load_version", return_value=_version_row()),
    ):
        first = pq._assemble(svc, "tok", mark_viewed=True)
        second = pq._assemble(svc, "tok", mark_viewed=True)
    assert first["status"] == "draft"
    assert second["status"] == "draft"
    assert svc.patch.call_count == 0


def test_assemble_sent_open_still_marks_viewed():
    svc = MagicMock()
    access = _access()
    quote = _quote(status="sent")
    viewed = {**quote, "status": "viewed", "viewed_at": "2026-09-22T12:00:00+00:00"}
    svc.patch.return_value = SimpleNamespace(status_code=200, json=lambda: [viewed])
    with (
        patch.object(pq, "_load_access", return_value=access),
        patch.object(pq, "_load_quote", return_value=quote),
        patch.object(pq, "_maybe_expire", side_effect=lambda _s, q: q),
        patch.object(pq, "_load_version", return_value=_version_row()),
        patch.object(pq, "_event"),
        patch.object(pq, "_audit"),
    ):
        public = pq._assemble(svc, "tok", mark_viewed=True)
    assert public["status"] == "viewed"
    assert public["can_approve"] is True
    assert public["can_reject"] is True
    params = svc.patch.call_args.kwargs.get("params") or svc.patch.call_args[1].get("params")
    assert params["status"] == "eq.sent"


def test_approve_draft_share_token_fails_server_side():
    svc = MagicMock()
    access = _access()
    quote = _quote(status="draft")
    with (
        patch.object(pq, "_load_access", return_value=access),
        patch.object(pq, "_load_quote", return_value=quote),
        patch.object(pq, "_maybe_expire", side_effect=lambda _s, q: q),
    ):
        body = pq.PublicDecisionIn(
            name="ישראל ישראלי",
            terms_accepted=True,
            signature_data_url="data:image/png;base64,aaa",
        )
        with pytest.raises(ApiError) as exc:
            pq.approve_public_quote("tok", body, MagicMock(), svc)
    assert exc.value.status_code == 403
    assert exc.value.code == "RESOURCE_STATE"
    assert exc.value.details.get("state") == "draft"


def test_reject_draft_share_token_fails_server_side():
    svc = MagicMock()
    access = _access()
    quote = _quote(status="draft")
    with (
        patch.object(pq, "_load_access", return_value=access),
        patch.object(pq, "_load_quote", return_value=quote),
        patch.object(pq, "_maybe_expire", side_effect=lambda _s, q: q),
    ):
        body = pq.PublicDecisionIn(reason="יקר")
        with pytest.raises(ApiError) as exc:
            pq.reject_public_quote("tok", body, MagicMock(), svc)
    assert exc.value.status_code == 403
    assert exc.value.code == "RESOURCE_STATE"


def test_public_first_open_promotion_removed_from_source():
    src = inspect.getsource(pq._assemble)
    assert "public_first_open" not in src
    assert 'status == "draft"' not in src
    assert 'status == "sent"' in src
    assert "Draft Share is VIEW" in src


def test_send_losing_concurrent_request_does_not_mint_or_snapshot():
    client = MagicMock()
    svc = MagicMock()
    user = {"id": "u1"}
    workspace_id = uuid4()
    existing = {
        "id": str(uuid4()),
        "workspace_id": str(workspace_id),
        "status": "draft",
        "version": 1,
        "vat_percent": 18,
        "customer_id": "c1",
        "title": "T",
        "payment_terms": "x",
    }
    items = [{"id": "i1", "item_type": "catalog", "qty": 1, "unit_price": 10, "discount": 0, "cost": 0}]

    # Conditional patch returns empty → another Send already won.
    client.patch.return_value = SimpleNamespace(status_code=200, json=lambda: [])

    with (
        patch.object(quotes_router, "_load_items", return_value=items),
        patch.object(quotes_router, "_persist_totals", return_value=(existing, items)),
        patch.object(quotes_router, "_related", return_value=({"name": "W"}, {"display_name": "C"}, None)),
        patch.object(quotes_router, "_load_quote_settings", return_value={}),
        patch.object(quotes_router, "validate_for_send", return_value=[]),
        patch.object(quotes_router, "advisory_checks", return_value=[]),
        patch.object(quotes_router, "_upsert_version_snapshot") as snap,
        patch.object(quotes_router, "_mint_access") as mint,
        patch.object(quotes_router, "new_public_token") as token_fn,
        patch.object(quotes_router, "_record_event") as event,
        patch.object(quotes_router, "write_audit") as audit,
    ):
        with pytest.raises(ApiError) as exc:
            quotes_router._transition_to_sent(client, svc, user, workspace_id, existing)

    assert exc.value.code == "RESOURCE_STATE"
    assert exc.value.details.get("reason") == "send_already_published"
    snap.assert_not_called()
    mint.assert_not_called()
    token_fn.assert_not_called()
    event.assert_not_called()
    audit.assert_not_called()
    params = client.patch.call_args.kwargs.get("params") or client.patch.call_args[1]["params"]
    assert params["status"] == "eq.draft"
    assert params["version"] == "eq.1"


def test_send_winner_patches_then_snapshots_and_mints():
    client = MagicMock()
    svc = MagicMock()
    user = {"id": "u1"}
    workspace_id = uuid4()
    qid = str(uuid4())
    existing = {
        "id": qid,
        "workspace_id": str(workspace_id),
        "status": "draft",
        "version": 2,
        "vat_percent": 18,
        "customer_id": "c1",
        "title": "T",
        "payment_terms": "x",
    }
    items = [{"id": "i1", "item_type": "catalog", "qty": 1, "unit_price": 10, "discount": 0, "cost": 0}]
    sent_row = {**existing, "status": "sent", "sent_at": "2026-09-22T12:00:00+00:00"}
    client.patch.return_value = SimpleNamespace(status_code=200, json=lambda: [sent_row])

    with (
        patch.object(quotes_router, "_load_items", return_value=items),
        patch.object(quotes_router, "_persist_totals", return_value=(existing, items)),
        patch.object(quotes_router, "_related", return_value=({"name": "W"}, {"display_name": "C"}, None)),
        patch.object(quotes_router, "_load_quote_settings", return_value={}),
        patch.object(quotes_router, "validate_for_send", return_value=[]),
        patch.object(quotes_router, "advisory_checks", return_value=[]),
        patch.object(quotes_router, "_upsert_version_snapshot") as snap,
        patch.object(quotes_router, "_mint_access") as mint,
        patch.object(quotes_router, "new_public_token", return_value="token-win"),
        patch.object(quotes_router, "_record_event"),
        patch.object(quotes_router, "write_audit"),
    ):
        row, out_items, token = quotes_router._transition_to_sent(client, svc, user, workspace_id, existing)

    assert row["status"] == "sent"
    assert token == "token-win"
    assert out_items is items
    snap.assert_called_once()
    mint.assert_called_once()
    params = client.patch.call_args.kwargs.get("params") or client.patch.call_args[1]["params"]
    assert params["version"] == "eq.2"


def test_document_payload_non_draft_uses_snapshot_public_not_live_items():
    client = MagicMock()
    workspace_id = uuid4()
    quote = {
        "id": "q1",
        "workspace_id": str(workspace_id),
        "status": "sent",
        "version": 1,
        "sent_at": "2026-09-22T10:00:00+00:00",
        "viewed_at": None,
        "approved_at": None,
        "approved_name": None,
        "rejected_at": None,
    }
    live_items = [
        {
            "id": "i-live",
            "description": "LIVE CHANGED",
            "qty": 99,
            "unit_price": 1,
            "line_net": 99,
            "item_type": "catalog",
        }
    ]
    frozen = {
        "id": "q1",
        "number": "Q-1",
        "version": 1,
        "status": "sent",
        "title": "Frozen",
        "currency": "ILS",
        "subtotal_net": 500,
        "vat_amount": 90,
        "total_gross": 590,
        "items": [
            {
                "id": "i-frozen",
                "description": "SNAPSHOT LINE",
                "qty": 1,
                "unit_price": 500,
                "line_net": 500,
                "item_type": "catalog",
            }
        ],
        "company": {"name": "אגיס"},
        "customer": {"display_name": "לקוח"},
        "sections": [],
    }
    client.get.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [{"snapshot": {"public": frozen}}],
    )

    doc = quotes_router._document_payload(client, workspace_id, quote, live_items)
    assert doc["items"][0]["description"] == "SNAPSHOT LINE"
    assert doc["total_gross"] == 590
    assert all(item["description"] != "LIVE CHANGED" for item in doc["items"])


def test_document_payload_draft_stays_live():
    client = MagicMock()
    workspace_id = uuid4()
    quote_id = str(uuid4())
    quote = {
        "id": quote_id,
        "workspace_id": str(workspace_id),
        "status": "draft",
        "version": 1,
        "title": "Draft",
        "currency": "ILS",
        "vat_percent": 18,
        "subtotal_net": 100,
        "vat_amount": 18,
        "total_gross": 118,
        "discount_type": None,
        "discount_value": 0,
    }
    items = [
        {
            "id": "i1",
            "description": "Live draft line",
            "qty": 1,
            "unit_price": 100,
            "discount": 0,
            "discount_type": "amount",
            "line_net": 100,
            "item_type": "catalog",
        }
    ]
    with (
        patch.object(
            quotes_router,
            "_related",
            return_value=({"name": "W", "id": str(workspace_id)}, {"display_name": "C"}, None),
        ),
        patch.object(quotes_router, "_load_sections", return_value=[]),
        patch.object(quotes_router, "_load_quote_settings", return_value={}),
        patch.object(quotes_router, "_load_default_pdf_template", return_value=None),
        patch(
            "app.documents.company_profile.missing_quote_company_fields",
            return_value=[],
        ),
        patch(
            "app.documents.company_profile.normalize_company_profile",
            return_value={"legal_name": "W", "brand_name": "W"},
        ),
    ):
        doc = quotes_router._document_payload(client, workspace_id, quote, items)
    assert doc["items"][0]["description"] == "Live draft line"


def test_share_copy_view_only_hebrew():
    from pathlib import Path

    he = Path(__file__).resolve().parents[2] / "web" / "src" / "i18n" / "he.ts"
    # apps/api/tests -> repo root may differ; prefer apps/web path relative to monorepo
    candidates = [
        Path(__file__).resolve().parents[3] / "apps" / "web" / "src" / "i18n" / "he.ts",
        Path(__file__).resolve().parents[2] / "apps" / "web" / "src" / "i18n" / "he.ts",
    ]
    text = None
    for path in candidates:
        if path.exists():
            text = path.read_text(encoding="utf-8")
            break
    assert text is not None
    assert "צפייה ואישור הלקוח" not in text
    assert "ללא אישור או דחייה" in text
    assert "שליחה לאישור הלקוח" in text


def test_snapshot_public_has_no_cost_margin_keys():
    from app.quote_snapshot import public_payload

    payload = public_payload(
        {
            "id": "q1",
            "number": "Q-1",
            "version": 1,
            "status": "sent",
            "subtotal_net": 100,
            "vat_amount": 18,
            "total_gross": 118,
            "vat_percent": 18,
            "currency": "ILS",
            "cost_total": 40,
            "margin_percent": 60,
            "internal_notes": "secret",
        },
        [
            {
                "id": "i1",
                "description": "x",
                "qty": 1,
                "unit_price": 100,
                "discount": 0,
                "line_net": 100,
                "item_type": "catalog",
                "cost": 40,
            }
        ],
        workspace={"name": "W"},
        customer={"display_name": "C"},
        site=None,
        status="sent",
        freeze_company=True,
    )
    assert "cost_total" not in payload
    assert "margin_percent" not in payload
    assert "internal_notes" not in payload
    assert "cost" not in payload["items"][0]
