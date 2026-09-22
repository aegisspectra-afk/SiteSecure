"""R3 System Design atomic Apply — unit tests (fingerprints, confirmation, endpoint)."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import httpx
import pytest

from app.errors import ApiError
from app.routers import system_designs as sd
from app.system_designs.apply import (
    detect_divergence,
    divergence_hash,
    engineering_fingerprint,
    format_qty,
    issue_confirmation_token,
    map_rpc_error,
    prepare_commercial_lines,
    proposed_engineering_lines,
    proposed_hash,
    verify_confirmation_token,
)

WS = uuid4()
QID = uuid4()
DID = uuid4()
CID = uuid4()
PID = uuid4()
IID = uuid4()


def _resp(status: int, data) -> httpx.Response:
    return httpx.Response(status, json=data)


def _settings():
    return SimpleNamespace(
        supabase_service_role_key="test-service-role-key-for-hmac",
        supabase_anon_key="test-anon",
    )


def test_format_qty_strips_trailing_zeros():
    assert format_qty(4) == "4"
    assert format_qty(4.0) == "4"
    assert format_qty(4.5) == "4.5"
    assert format_qty("4.500000") == "4.5"


def test_engineering_fingerprint_ignores_price_fields():
    assert engineering_fingerprint(str(PID), 2) == f"{PID}|2"


def test_proposed_lines_skip_removed_and_unselected():
    comps = [
        {
            "id": str(CID),
            "role_key": "camera",
            "quantity": 4,
            "removed": False,
            "selection_origin": "ENGINE_PREFERRED",
            "engine_preferred_product_id": str(PID),
            "user_selected_product_id": str(PID),
        },
        {
            "id": str(uuid4()),
            "role_key": "ups",
            "quantity": 1,
            "removed": True,
            "selection_origin": "UNSELECTED",
            "engine_preferred_product_id": str(PID),
        },
        {
            "id": str(uuid4()),
            "role_key": "cable",
            "quantity": 1,
            "removed": False,
            "selection_origin": "UNSELECTED",
            "engine_preferred_product_id": str(PID),
        },
    ]
    lines = proposed_engineering_lines(comps)
    assert len(lines) == 1
    assert lines[0]["product_id"] == str(PID)
    assert lines[0]["qty"] == 4


def test_qty_change_is_engineering_divergence():
    comps = [
        {
            "id": str(CID),
            "role_key": "camera",
            "quote_item_id": str(IID),
            "applied_product_id": str(PID),
            "applied_qty": 4,
            "applied_output_fingerprint": engineering_fingerprint(str(PID), 4),
        }
    ]
    items = {
        str(IID): {
            "id": str(IID),
            "product_id": str(PID),
            "qty": 6,
            "item_type": "catalog",
            "unit_price": 100,
        }
    }
    div = detect_divergence(comps, items)
    assert len(div) == 1
    assert div[0]["kind"] == "CHANGED"


def test_product_change_is_engineering_divergence():
    other = str(uuid4())
    comps = [
        {
            "id": str(CID),
            "role_key": "camera",
            "quote_item_id": str(IID),
            "applied_product_id": str(PID),
            "applied_qty": 4,
            "applied_output_fingerprint": engineering_fingerprint(str(PID), 4),
        }
    ]
    items = {
        str(IID): {
            "id": str(IID),
            "product_id": other,
            "qty": 4,
            "item_type": "catalog",
        }
    }
    assert detect_divergence(comps, items)[0]["kind"] == "CHANGED"


def test_missing_owned_item_is_divergence():
    comps = [
        {
            "id": str(CID),
            "role_key": "camera",
            "quote_item_id": str(IID),
            "applied_product_id": str(PID),
            "applied_qty": 4,
            "applied_output_fingerprint": engineering_fingerprint(str(PID), 4),
        }
    ]
    assert detect_divergence(comps, {})[0]["kind"] == "MISSING"


def test_price_only_change_is_not_engineering_divergence():
    comps = [
        {
            "id": str(CID),
            "role_key": "camera",
            "quote_item_id": str(IID),
            "applied_product_id": str(PID),
            "applied_qty": 4,
            "applied_output_fingerprint": engineering_fingerprint(str(PID), 4),
        }
    ]
    items = {
        str(IID): {
            "id": str(IID),
            "product_id": str(PID),
            "qty": 4,
            "item_type": "catalog",
            "unit_price": 999,
            "discount": 50,
            "description": "user edited",
        }
    }
    assert detect_divergence(comps, items) == []


def test_discount_only_change_is_not_engineering_divergence():
    comps = [
        {
            "id": str(CID),
            "role_key": "camera",
            "quote_item_id": str(IID),
            "applied_product_id": str(PID),
            "applied_qty": 4,
            "applied_output_fingerprint": engineering_fingerprint(str(PID), 4),
        }
    ]
    items = {
        str(IID): {
            "id": str(IID),
            "product_id": str(PID),
            "qty": 4,
            "item_type": "catalog",
            "discount": 12,
            "discount_type": "percent",
        }
    }
    assert detect_divergence(comps, items) == []


def test_prepare_preserves_commercial_when_same_engineering():
    product = {
        "id": str(PID),
        "sku": "CAM",
        "name": "Camera",
        "description": "Catalog desc",
        "unit": "ea",
        "list_price": 200,
        "cost": 80,
        "is_active": True,
        "attributes": {},
    }
    proposed = [
        {
            "component_id": str(CID),
            "product_id": str(PID),
            "qty": 4,
            "fingerprint": engineering_fingerprint(str(PID), 4),
        }
    ]
    comps = {str(CID): {"id": str(CID), "quote_item_id": str(IID)}}
    items = {
        str(IID): {
            "id": str(IID),
            "product_id": str(PID),
            "qty": 4,
            "unit_price": 175,
            "discount": 10,
            "discount_type": "amount",
            "description": "Customer special",
            "section_id": "sec-keep",
        }
    }
    rows = prepare_commercial_lines(
        products_by_id={str(PID): product},
        proposed=proposed,
        components_by_id=comps,
        quote_items_by_id=items,
        default_section_id="sec-default",
    )
    assert rows[0]["unit_price"] == 175
    assert rows[0]["discount"] == 10
    assert rows[0]["description"] == "Customer special"
    assert rows[0]["section_id"] == "sec-keep"
    assert rows[0]["cost"] == 80


def test_prepare_uses_catalog_price_when_engineering_changes():
    product = {
        "id": str(PID),
        "sku": "CAM",
        "name": "Camera",
        "description": "Catalog desc",
        "unit": "ea",
        "list_price": 200,
        "cost": 80,
        "is_active": True,
        "attributes": {},
    }
    other = str(uuid4())
    proposed = [
        {
            "component_id": str(CID),
            "product_id": str(PID),
            "qty": 4,
            "fingerprint": engineering_fingerprint(str(PID), 4),
        }
    ]
    comps = {str(CID): {"id": str(CID), "quote_item_id": str(IID)}}
    items = {
        str(IID): {
            "id": str(IID),
            "product_id": other,
            "qty": 4,
            "unit_price": 175,
            "discount": 10,
            "discount_type": "amount",
            "description": "Customer special",
            "section_id": "sec-keep",
        }
    }
    rows = prepare_commercial_lines(
        products_by_id={str(PID): product},
        proposed=proposed,
        components_by_id=comps,
        quote_items_by_id=items,
        default_section_id="sec-default",
    )
    assert rows[0]["unit_price"] == 200
    assert rows[0]["discount"] == 0
    assert rows[0]["section_id"] == "sec-default"


def test_apply_in_forbids_client_money_fields():
    with pytest.raises(Exception):
        sd.SystemDesignApplyIn(revision=1, unit_price=1)  # type: ignore[call-arg]


def test_confirmation_token_round_trip():
    settings = _settings()
    token, _exp = issue_confirmation_token(
        workspace_id=str(WS),
        quote_id=str(QID),
        design_id=str(DID),
        revision=3,
        divergence_hash_value="a:MISSING:x",
        proposed_hash_value="c:p|1",
        settings=settings,
    )
    verify_confirmation_token(
        token,
        workspace_id=str(WS),
        quote_id=str(QID),
        design_id=str(DID),
        revision=3,
        divergence_hash_value="a:MISSING:x",
        proposed_hash_value="c:p|1",
        settings=settings,
    )


def test_confirmation_rejects_wrong_quote():
    settings = _settings()
    token, _ = issue_confirmation_token(
        workspace_id=str(WS),
        quote_id=str(QID),
        design_id=str(DID),
        revision=1,
        divergence_hash_value="d",
        proposed_hash_value="p",
        settings=settings,
    )
    with pytest.raises(ApiError) as ei:
        verify_confirmation_token(
            token,
            workspace_id=str(WS),
            quote_id=str(uuid4()),
            design_id=str(DID),
            revision=1,
            divergence_hash_value="d",
            proposed_hash_value="p",
            settings=settings,
        )
    assert ei.value.code == "CONFIRMATION_STALE"


def test_confirmation_rejects_changed_proposed_hash():
    settings = _settings()
    token, _ = issue_confirmation_token(
        workspace_id=str(WS),
        quote_id=str(QID),
        design_id=str(DID),
        revision=1,
        divergence_hash_value="d",
        proposed_hash_value="p1",
        settings=settings,
    )
    with pytest.raises(ApiError) as ei:
        verify_confirmation_token(
            token,
            workspace_id=str(WS),
            quote_id=str(QID),
            design_id=str(DID),
            revision=1,
            divergence_hash_value="d",
            proposed_hash_value="p2",
            settings=settings,
        )
    assert ei.value.code == "CONFIRMATION_STALE"


def test_confirmation_rejects_tampered_token():
    settings = _settings()
    token, _ = issue_confirmation_token(
        workspace_id=str(WS),
        quote_id=str(QID),
        design_id=str(DID),
        revision=1,
        divergence_hash_value="d",
        proposed_hash_value="p",
        settings=settings,
    )
    tampered = token[:-4] + "AAAA"
    with pytest.raises(ApiError) as ei:
        verify_confirmation_token(
            tampered,
            workspace_id=str(WS),
            quote_id=str(QID),
            design_id=str(DID),
            revision=1,
            divergence_hash_value="d",
            proposed_hash_value="p",
            settings=settings,
        )
    assert ei.value.code == "CONFIRMATION_STALE"


def test_confirmation_rejects_stale_revision():
    settings = _settings()
    token, _ = issue_confirmation_token(
        workspace_id=str(WS),
        quote_id=str(QID),
        design_id=str(DID),
        revision=1,
        divergence_hash_value="d",
        proposed_hash_value="p",
        settings=settings,
    )
    with pytest.raises(ApiError) as ei:
        verify_confirmation_token(
            token,
            workspace_id=str(WS),
            quote_id=str(QID),
            design_id=str(DID),
            revision=2,
            divergence_hash_value="d",
            proposed_hash_value="p",
            settings=settings,
        )
    assert ei.value.code == "CONFIRMATION_STALE"


def test_map_rpc_errors():
    assert map_rpc_error("REVISION_CONFLICT").code == "CONFLICT_REVISION"
    assert map_rpc_error("DIVERGED").code == "DESIGN_APPLY_DIVERGED"
    assert map_rpc_error("QUOTE_NOT_DRAFT").code == "RESOURCE_STATE"
    assert map_rpc_error("PERMISSION_DENIED").status_code == 403


def test_rpc_sql_rejects_arbitrary_delete_targets():
    from pathlib import Path

    sql = Path(__file__).resolve().parents[3] / "supabase/migrations/0055_system_design_apply_owned.sql"
    text = sql.read_text(encoding="utf-8")
    assert "system_design_apply_owned" in text
    assert "SECURITY DEFINER" in text
    assert "SET search_path = public" in text
    assert "delete_item_id" in text
    assert "RAISE EXCEPTION \'INVALID_LINES\'" in text
    assert "qi.id = ANY (v_owned_ids)" in text
    assert "status IS DISTINCT FROM \'draft\'" in text
    assert "auth_is_member" in text
    assert "p_actor_id IS DISTINCT FROM auth.uid()" in text


def _design_row(**over):
    base = {
        "id": str(DID),
        "workspace_id": str(WS),
        "quote_id": str(QID),
        "site_id": None,
        "engine_type": "cctv",
        "engine_version": 1,
        "lifecycle_status": "calculated",
        "requirements": {},
        "engineering_result": {},
        "recommendation_meta": {},
        "calculated_at": "2026-01-01T00:00:00Z",
        "last_applied_at": None,
        "current_apply_id": None,
        "apply_fingerprint": None,
        "revision": 2,
        "created_by": "u1",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
        "deleted_at": None,
    }
    base.update(over)
    return base


def _comp(**over):
    base = {
        "id": str(CID),
        "workspace_id": str(WS),
        "design_id": str(DID),
        "role_key": "camera",
        "label": "camera",
        "quantity": 4,
        "optional": False,
        "blocking": True,
        "removed": False,
        "resolution_status": "RESOLVED",
        "technical_requirements": {},
        "candidates": [],
        "engine_preferred_product_id": str(PID),
        "user_selected_product_id": str(PID),
        "selection_origin": "ENGINE_PREFERRED",
        "reason_codes": [],
        "needs_review": False,
        "quote_item_id": None,
        "applied_product_id": None,
        "applied_qty": None,
        "applied_output_fingerprint": None,
        "last_apply_id": None,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }
    base.update(over)
    return base


def _quote(**over):
    base = {
        "id": str(QID),
        "workspace_id": str(WS),
        "site_id": None,
        "owner_user_id": "u1",
        "status": "draft",
        "vat_percent": 17,
        "discount_type": "amount",
        "discount_value": 0,
        "subtotal_net": 0,
        "vat_amount": 0,
        "total_gross": 0,
        "deleted_at": None,
    }
    base.update(over)
    return base


@patch("app.routers.system_designs.require")
@patch("app.routers.system_designs.load_authz_context")
def test_initial_apply_calls_rpc_and_persist(mock_ctx, mock_require):
    mock_ctx.return_value = MagicMock()
    mock_require.return_value = MagicMock(allowed=True)
    client = MagicMock()
    user = {"id": "u1", "sub": "u1"}
    design = _design_row()
    comp = _comp()
    quote = _quote()
    product = {
        "id": str(PID),
        "sku": "CAM",
        "name": "Cam",
        "description": "d",
        "unit": "ea",
        "list_price": 100,
        "cost": 40,
        "is_active": True,
        "kind": "product",
        "vat_eligible": True,
        "is_labor": False,
        "manufacturer": None,
        "model": None,
        "attributes": {},
    }

    with (
        patch.object(sd, "_load_design_row", return_value=design),
        patch.object(sd, "_load_components", return_value=[comp]),
        patch("app.routers.quotes._load_quote", return_value=quote),
        patch("app.routers.quotes._load_items", return_value=[]),
        patch("app.routers.quotes._load_sections", return_value=[]),
        patch("app.routers.quotes._persist_totals", return_value=(quote, [])),
        patch("app.routers.quotes._with_validation", return_value={**quote, "items": []}),
        patch("app.routers.quotes._can_view_cost", return_value=False),
        patch(
            "app.routers.system_designs.created_or_403",
            return_value={"id": "sec1", "name": "מערכת CCTV", "sort_order": 10},
        ),
        patch("app.identity.actor_id", return_value="u1"),
    ):
        client.get.side_effect = [_resp(200, [product])]
        client.rpc.return_value = _resp(
            200,
            {"ok": True, "apply_id": "a1", "revision": 3, "inserted": 1, "deleted": 0},
        )
        result = sd.apply_system_design(
            WS,
            DID,
            sd.SystemDesignApplyIn(revision=2),
            client,
            user,
        )

    assert result["ok"] is True
    assert "quote" in result
    assert "design" in result
    client.rpc.assert_called_once()
    rpc_name, payload = client.rpc.call_args[0][0], client.rpc.call_args[0][1]
    assert rpc_name == "system_design_apply_owned"
    assert payload["p_confirmed"] is False
    assert payload["p_expected_revision"] == 2
    line = payload["p_lines"][0]
    assert line["unit_price"] == 100
    assert line["cost"] == 40
    assert "delete_item_id" not in line


@patch("app.routers.system_designs.require")
@patch("app.routers.system_designs.load_authz_context")
def test_diverged_apply_returns_confirmation_without_rpc(mock_ctx, mock_require):
    mock_ctx.return_value = MagicMock()
    mock_require.return_value = MagicMock(allowed=True)
    client = MagicMock()
    user = {"id": "u1", "sub": "u1"}
    design = _design_row(revision=5)
    fp = engineering_fingerprint(str(PID), 4)
    comp = _comp(
        quote_item_id=str(IID),
        applied_product_id=str(PID),
        applied_qty=4,
        applied_output_fingerprint=fp,
    )
    quote = _quote()
    items = [
        {
            "id": str(IID),
            "product_id": str(PID),
            "qty": 9,
            "item_type": "catalog",
            "unit_price": 100,
        }
    ]

    with (
        patch.object(sd, "_load_design_row", return_value=design),
        patch.object(sd, "_load_components", return_value=[comp]),
        patch("app.routers.quotes._load_quote", return_value=quote),
        patch("app.routers.quotes._load_items", return_value=items),
        patch("app.system_designs.apply.get_settings", return_value=_settings()),
    ):
        with pytest.raises(ApiError) as ei:
            sd.apply_system_design(
                WS,
                DID,
                sd.SystemDesignApplyIn(revision=5),
                client,
                user,
            )
    assert ei.value.code == "DESIGN_APPLY_DIVERGED"
    assert ei.value.details["confirmation_required"] is True
    assert ei.value.details["confirmation_token"]
    client.rpc.assert_not_called()


@patch("app.routers.system_designs.require")
@patch("app.routers.system_designs.load_authz_context")
def test_sent_quote_cannot_apply(mock_ctx, mock_require):
    mock_ctx.return_value = MagicMock()
    mock_require.return_value = MagicMock(allowed=True)
    client = MagicMock()
    with (
        patch.object(sd, "_load_design_row", return_value=_design_row()),
        patch("app.routers.quotes._load_quote", return_value=_quote(status="sent")),
    ):
        with pytest.raises(ApiError) as ei:
            sd.apply_system_design(
                WS,
                DID,
                sd.SystemDesignApplyIn(revision=2),
                client,
                {"id": "u1"},
            )
    assert ei.value.code == "RESOURCE_STATE"
    client.rpc.assert_not_called()


@patch("app.routers.system_designs.require")
@patch("app.routers.system_designs.load_authz_context")
def test_stale_design_revision_rejected(mock_ctx, mock_require):
    mock_ctx.return_value = MagicMock()
    mock_require.return_value = MagicMock(allowed=True)
    client = MagicMock()
    with (
        patch.object(sd, "_load_design_row", return_value=_design_row(revision=4)),
        patch("app.routers.quotes._load_quote", return_value=_quote()),
    ):
        with pytest.raises(ApiError) as ei:
            sd.apply_system_design(
                WS,
                DID,
                sd.SystemDesignApplyIn(revision=2),
                client,
                {"id": "u1"},
            )
    assert ei.value.code == "CONFLICT_REVISION"
    client.rpc.assert_not_called()


@patch("app.routers.system_designs.require")
@patch("app.routers.system_designs.load_authz_context")
def test_pricing_failure_after_rpc_surfaces_recoverable_error(mock_ctx, mock_require):
    mock_ctx.return_value = MagicMock()
    mock_require.return_value = MagicMock(allowed=True)
    client = MagicMock()
    design = _design_row()
    comp = _comp()
    quote = _quote()
    product = {
        "id": str(PID),
        "sku": "CAM",
        "name": "Cam",
        "description": "d",
        "unit": "ea",
        "list_price": 100,
        "cost": 40,
        "is_active": True,
        "kind": "product",
        "vat_eligible": True,
        "is_labor": False,
        "manufacturer": None,
        "model": None,
        "attributes": {},
    }

    with (
        patch.object(sd, "_load_design_row", return_value=design),
        patch.object(sd, "_load_components", return_value=[comp]),
        patch("app.routers.quotes._load_quote", return_value=quote),
        patch("app.routers.quotes._load_items", return_value=[]),
        patch(
            "app.routers.quotes._load_sections",
            return_value=[{"id": "sec1", "name": "מערכת CCTV", "sort_order": 10}],
        ),
        patch("app.routers.quotes._persist_totals", side_effect=RuntimeError("db down")),
        patch("app.routers.quotes._with_validation", return_value={**quote, "items": []}),
        patch("app.routers.quotes._can_view_cost", return_value=False),
        patch("app.identity.actor_id", return_value="u1"),
    ):
        client.get.return_value = _resp(200, [product])
        client.rpc.return_value = _resp(200, {"ok": True, "apply_id": "a1", "revision": 3})
        with pytest.raises(ApiError) as ei:
            sd.apply_system_design(
                WS,
                DID,
                sd.SystemDesignApplyIn(revision=2),
                client,
                {"id": "u1"},
            )
    assert ei.value.status_code == 503
    assert ei.value.details["apply_committed"] is True
    assert "recalculate_path" in ei.value.details
    client.rpc.assert_called_once()


def test_divergence_hash_stable_ordering():
    d = [
        {
            "component_id": "b",
            "kind": "MISSING",
            "applied": {"fingerprint": "p|1"},
            "current": None,
        },
        {
            "component_id": "a",
            "kind": "CHANGED",
            "applied": {"fingerprint": "p|1"},
            "current": {"fingerprint": "p|2"},
        },
    ]
    h1 = divergence_hash(d)
    h2 = divergence_hash(list(reversed(d)))
    assert h1 == h2


def test_proposed_hash_matches_component_product_qty():
    lines = [
        {"component_id": "c2", "product_id": "p2", "qty": 1},
        {"component_id": "c1", "product_id": "p1", "qty": 4.0},
    ]
    assert proposed_hash(lines) == "c1:p1|4|c2:p2|1"
