"""R1 System Design persistence — unit tests (mocked PostgREST client)."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import httpx
import pytest

from app.errors import ApiError
from app.routers import system_designs as sd
from app.system_designs import (
    sanitize_candidates,
    soft_delete_designs_for_quote,
    strip_commercial_keys,
)


WS = uuid4()
QID = uuid4()
DID = uuid4()
CID = uuid4()


def _resp(status: int, data) -> httpx.Response:
    return httpx.Response(status, json=data)


def _quote(**over):
    base = {
        "id": str(QID),
        "workspace_id": str(WS),
        "site_id": None,
        "owner_user_id": "u1",
        "status": "draft",
        "deleted_at": None,
    }
    base.update(over)
    return base


def _design(**over):
    base = {
        "id": str(DID),
        "workspace_id": str(WS),
        "quote_id": str(QID),
        "site_id": None,
        "engine_type": "cctv",
        "engine_version": 1,
        "lifecycle_status": "draft",
        "requirements": {"camera_count": 4},
        "engineering_result": None,
        "recommendation_meta": None,
        "calculated_at": None,
        "last_applied_at": None,
        "current_apply_id": None,
        "apply_fingerprint": None,
        "revision": 1,
        "created_by": "u1",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
        "deleted_at": None,
    }
    base.update(over)
    return base


def _component(**over):
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
        "technical_requirements": {"resolutionMpMin": 4},
        "candidates": [
            {
                "product": {"id": "p1", "name": "Cam", "cost": 99, "list_price": 199},
                "confidence": "STRUCTURED",
            }
        ],
        "engine_preferred_product_id": "p1",
        "user_selected_product_id": "p2",
        "selection_origin": "USER_OVERRIDE",
        "reason_codes": [{"code": "X"}],
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


def _client_for(quote=None, design=None, components=None, patch_rows=None):
    quote = quote if quote is not None else _quote()
    design = design if design is not None else _design()
    components = components if components is not None else []
    patch_rows = patch_rows if patch_rows is not None else [ {**design, "revision": 2} ]

    client = MagicMock()

    def get(table, params=None):
        params = params or {}
        if table == "quotes":
            if quote.get("deleted_at") and params.get("deleted_at") == "is.null":
                return _resp(200, [])
            return _resp(200, [quote])
        if table == "system_designs":
            if params.get("deleted_at") == "is.null" and design.get("deleted_at"):
                return _resp(200, [])
            if "id" in (params or {}) and params["id"].startswith("eq."):
                return _resp(200, [design])
            return _resp(200, [design] if not design.get("deleted_at") else [])
        if table == "system_design_components":
            return _resp(200, components)
        return _resp(200, [])

    def post(table, payload):
        if table == "system_designs":
            return _resp(201, [{**design, **payload, "id": str(DID), "revision": 1}])
        if table == "system_design_components":
            return _resp(201, [{**_component(), **payload, "id": str(uuid4())}])
        return _resp(400, {})

    def patch(table, payload, params=None):
        params = params or {}
        if table == "system_designs":
            if params.get("revision") and params["revision"] != f"eq.{design.get('revision', 1)}":
                return _resp(200, [])
            return _resp(200, patch_rows)
        if table == "system_design_components":
            return _resp(200, [{**_component(), **payload}])
        return _resp(200, [])

    client.get.side_effect = get
    client.post.side_effect = post
    client.patch.side_effect = patch
    client.delete.return_value = _resp(204, None)
    return client


def _allow(action="quotes.edit"):
    return patch(
        "app.routers.system_designs.require",
        side_effect=lambda ctx, act, resource=None: None,
    )


def test_strip_commercial_keys_removes_cost_and_list_price():
    cleaned = strip_commercial_keys(
        {"product": {"id": "1", "cost": 10, "list_price": 20, "name": "A"}, "qty": 1}
    )
    assert "cost" not in cleaned["product"]
    assert "list_price" not in cleaned["product"]
    assert cleaned["product"]["name"] == "A"


def test_sanitize_candidates_strips_nested_commercial():
    out = sanitize_candidates([{"product": {"id": "p", "cost": 1, "list_price": 2}}])
    assert out[0]["product"] == {"id": "p"}


def test_create_design_under_quote():
    client = _client_for()
    user = {"id": "u1"}
    with _allow(), patch("app.routers.system_designs._ctx", return_value=SimpleNamespace()):
        out = sd.create_system_design(
            WS,
            QID,
            sd.SystemDesignCreate(engine_type="cctv", requirements={"camera_count": 4, "cost": 9}),
            client,
            user,
        )
    assert out["engine_type"] == "cctv"
    assert out["revision"] == 1
    assert "cost" not in out["requirements"]
    assert out["components"] == []


def test_create_rejects_unknown_engine():
    client = _client_for()
    with _allow(), patch("app.routers.system_designs._ctx", return_value=SimpleNamespace()):
        with pytest.raises(ApiError) as exc:
            sd.create_system_design(
                WS,
                QID,
                sd.SystemDesignCreate(engine_type="alarm"),
                client,
                {"id": "u1"},
            )
    assert exc.value.status_code == 400


def test_list_empty_when_quote_soft_deleted():
    client = _client_for(quote=_quote(deleted_at="2026-01-02T00:00:00Z"))
    with _allow("quotes.view"), patch("app.routers.system_designs._ctx", return_value=SimpleNamespace()):
        with pytest.raises(ApiError) as exc:
            sd.list_system_designs(WS, QID, client, {"id": "u1"})
    assert exc.value.status_code == 404
    assert exc.value.code == "NOT_FOUND"


def test_get_hidden_when_design_soft_deleted():
    client = _client_for(design=_design(deleted_at="2026-01-02T00:00:00Z"))
    with _allow("quotes.view"), patch("app.routers.system_designs._ctx", return_value=SimpleNamespace()):
        with pytest.raises(ApiError) as exc:
            sd.get_system_design(WS, DID, client, {"id": "u1"})
    assert exc.value.status_code == 404


def test_patch_revision_cas_success_and_components_round_trip():
    design = _design(revision=1)
    client = _client_for(
        design=design,
        components=[],
        patch_rows=[{**design, "revision": 2, "lifecycle_status": "calculated"}],
    )
    # after upsert, get components returns one
    calls = {"n": 0}

    def get(table, params=None):
        params = params or {}
        if table == "quotes":
            return _resp(200, [_quote()])
        if table == "system_designs":
            return _resp(200, [design])
        if table == "system_design_components":
            calls["n"] += 1
            if calls["n"] <= 1:
                return _resp(200, [])
            return _resp(200, [_component()])
        return _resp(200, [])

    client.get.side_effect = get

    body = sd.SystemDesignPatch(
        revision=1,
        lifecycle_status="calculated",
        engineering_result={"storage": {"requiredTb": 2}, "cost_total": 5},
        recommendation_meta={"status": "OK", "blocking": False},
        components=[
            sd.SystemDesignComponentIn(
                role_key="camera",
                quantity=4,
                selection_origin="USER_OVERRIDE",
                user_selected_product_id="p2",
                engine_preferred_product_id="p1",
                candidates=[{"product": {"id": "p1", "cost": 3, "list_price": 9}}],
                reason_codes=[{"code": "ROLE_CAMERA_FROM_COUNT"}],
                resolution_status="RESOLVED",
                blocking=True,
            )
        ],
    )
    with _allow(), patch("app.routers.system_designs._ctx", return_value=SimpleNamespace()):
        out = sd.patch_system_design(WS, DID, body, client, {"id": "u1"})
    assert out["revision"] == 2
    assert out["lifecycle_status"] == "calculated"
    assert "cost_total" not in (out.get("engineering_result") or {})
    assert len(out["components"]) == 1
    cand = out["components"][0]["candidates"][0]["product"]
    assert "cost" not in cand
    assert "list_price" not in cand
    assert out["components"][0]["selection_origin"] == "USER_OVERRIDE"


def test_patch_stale_revision_conflicts_without_write():
    design = _design(revision=3)
    client = _client_for(design=design)
    with _allow(), patch("app.routers.system_designs._ctx", return_value=SimpleNamespace()):
        with pytest.raises(ApiError) as exc:
            sd.patch_system_design(
                WS,
                DID,
                sd.SystemDesignPatch(revision=1, requirements={"a": 1}),
                client,
                {"id": "u1"},
            )
    assert exc.value.status_code == 409
    assert exc.value.code == "CONFLICT_REVISION"
    # conditional patch not attempted when client revision mismatches loaded revision
    assert not any(
        call.args and call.args[0] == "system_designs" for call in client.patch.call_args_list
    )


def test_patch_empty_cas_response_is_conflict():
    design = _design(revision=1)
    client = _client_for(design=design, patch_rows=[])
    with _allow(), patch("app.routers.system_designs._ctx", return_value=SimpleNamespace()):
        with pytest.raises(ApiError) as exc:
            sd.patch_system_design(
                WS,
                DID,
                sd.SystemDesignPatch(revision=1, requirements={"a": 1}),
                client,
                {"id": "u1"},
            )
    assert exc.value.status_code == 409
    assert exc.value.code == "CONFLICT_REVISION"


def test_delete_design_does_not_touch_quote_items():
    client = _client_for()
    with _allow(), patch("app.routers.system_designs._ctx", return_value=SimpleNamespace()):
        out = sd.delete_system_design(WS, DID, client, {"id": "u1"})
    assert out == {"ok": True}
    deleted_tables = [c.args[0] for c in client.delete.call_args_list]
    assert "system_designs" in deleted_tables
    assert "system_design_components" in deleted_tables
    assert "quote_items" not in deleted_tables


def test_mutate_requires_quotes_edit():
    client = _client_for()

    def deny(ctx, act, resource=None):
        raise ApiError(403, "PERMISSION_DENIED", "אין הרשאה")

    with patch("app.routers.system_designs.require", side_effect=deny), patch(
        "app.routers.system_designs._ctx", return_value=SimpleNamespace()
    ):
        with pytest.raises(ApiError) as exc:
            sd.create_system_design(WS, QID, sd.SystemDesignCreate(), client, {"id": "u1"})
    assert exc.value.status_code == 403


def test_soft_delete_designs_for_quote_stamps_deleted_at():
    svc = MagicMock()
    soft_delete_designs_for_quote(svc, WS, QID)
    assert svc.patch.called
    args, kwargs = svc.patch.call_args
    assert args[0] == "system_designs"
    assert "deleted_at" in args[1]
    assert kwargs["params"]["quote_id"] == f"eq.{QID}"


def test_migration_sql_defines_required_objects():
    from pathlib import Path

    sql = (Path(__file__).resolve().parents[3] / "supabase/migrations/0054_system_designs.sql").read_text()
    assert "CREATE TABLE public.system_designs" in sql
    assert "CREATE TABLE public.system_design_components" in sql
    assert "system_design_quote_visible" in sql
    assert "FORCE ROW LEVEL SECURITY" in sql
    assert "quote_item_id" in sql
    assert "applied_output_fingerprint" in sql
    assert "ON DELETE CASCADE" in sql
