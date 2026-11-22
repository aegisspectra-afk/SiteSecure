"""Stage 3 quote-core contracts: scope, search, contact, margin, staff approve."""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.errors import MESSAGES, ApiError
from app.pricing import recalculate
from app.quote_snapshot import public_payload
from app.routers import public_quotes
from app.routers import quote_cpq as cpq
from app.routers import quotes as quotes_router
from app.search_query import sanitize_search_q


def test_public_totals_match_server_recalculate():
    items = [
        {
            "id": "req",
            "item_type": "catalog",
            "description": "מצלמה",
            "qty": 1,
            "unit_price": 1000,
            "discount": 0,
            "cost": 400,
            "is_optional": False,
        },
        {
            "id": "opt",
            "item_type": "catalog",
            "description": "אופציה",
            "qty": 1,
            "unit_price": 250,
            "discount": 0,
            "cost": 80,
            "is_optional": True,
        },
    ]
    computed = recalculate(items, vat_percent=18, discount_type=None, discount_value=0)
    payload = public_payload(
        {
            "id": "q1",
            "number": "Q-1",
            "version": 1,
            "status": "sent",
            "currency": "ILS",
            "vat_percent": 18,
            "subtotal_net": computed["subtotal_net"],
            "vat_amount": computed["vat_amount"],
            "total_gross": computed["total_gross"],
            "optional_subtotal": computed["optional_subtotal"],
            "optional_vat_amount": computed["optional_vat_amount"],
            "optional_total_gross": computed["optional_total_gross"],
            "total_with_options_gross": computed["total_with_options_gross"],
        },
        [{**item, "line_net": 1000 if item["id"] == "req" else 250} for item in items],
        workspace={"name": "Acme"},
        customer=None,
        site=None,
    )
    assert payload["total_gross"] == computed["total_gross"]
    assert payload["optional_subtotal"] == computed["optional_subtotal"]
    assert payload["optional_total_gross"] == computed["optional_total_gross"]
    assert payload["total_with_options_gross"] == computed["total_with_options_gross"]
    assert payload["items"][1]["is_optional"] is True
    assert "cost_total" not in payload
    assert "optional_cost_total" not in payload


def test_load_version_row_scoped_to_quote_and_workspace():
    client = MagicMock()
    client.get.return_value = MagicMock(status_code=200)
    ws, qid = uuid4(), uuid4()
    with patch.object(cpq, "as_list", return_value=[]):
        row = cpq._load_version_row(client, ws, qid, 2)
    assert row is None
    params = client.get.call_args.kwargs["params"]
    assert params["quote_id"] == f"eq.{qid}"
    assert params["workspace_id"] == f"eq.{ws}"
    assert params["version"] == "eq.2"


def test_public_version_load_uses_access_token_scope():
    access = {
        "quote_id": str(uuid4()),
        "workspace_id": str(uuid4()),
        "version": 3,
    }
    svc = MagicMock()
    with patch.object(public_quotes, "as_list", return_value=[{"version": 3, "snapshot": {"public": {}}}]):
        public_quotes._load_version(svc, access)
    params = svc.get.call_args.kwargs["params"]
    assert params["quote_id"] == f"eq.{access['quote_id']}"
    assert params["workspace_id"] == f"eq.{access['workspace_id']}"
    assert params["version"] == "eq.3"


def test_contact_must_belong_to_quote_customer():
    client = MagicMock()
    ws = uuid4()
    with (
        patch.object(quotes_router, "as_list", return_value=[]),
        pytest.raises(ApiError) as err,
    ):
        quotes_router._assert_contact_belongs_to_customer(
            client,
            ws,
            customer_id=str(uuid4()),
            contact_id=str(uuid4()),
        )
    assert err.value.status_code == 400
    assert "איש הקשר" in err.value.message


def test_contact_from_other_workspace_rejected():
    """A contact that exists only in another workspace must not attach to this quote."""
    client = MagicMock()
    quote_ws = uuid4()
    other_ws = uuid4()
    customer_id = str(uuid4())
    contact_id = str(uuid4())
    leaked = {
        "id": contact_id,
        "workspace_id": str(other_ws),
        "customer_id": customer_id,
    }
    with (
        patch.object(quotes_router, "as_list", return_value=[leaked]),
        pytest.raises(ApiError) as err,
    ):
        quotes_router._assert_contact_belongs_to_customer(
            client,
            quote_ws,
            customer_id=customer_id,
            contact_id=contact_id,
        )
    assert err.value.status_code == 400
    assert "איש הקשר" in err.value.message
    params = client.get.call_args.kwargs["params"]
    assert params["workspace_id"] == f"eq.{quote_ws}"
    assert params["id"] == f"eq.{contact_id}"
    assert params["workspace_id"] != f"eq.{other_ws}"


def test_contact_without_customer_rejected():
    with pytest.raises(ApiError) as err:
        quotes_router._assert_contact_belongs_to_customer(
            MagicMock(),
            uuid4(),
            customer_id=None,
            contact_id=str(uuid4()),
        )
    assert err.value.status_code == 400


def test_search_strips_wildcard_injection():
    assert sanitize_search_q("*(foo%),bar_") == "foo bar"
    assert sanitize_search_q("   ") == ""


def test_quote_search_uses_one_customer_query_not_n_plus_one():
    client = MagicMock()
    ws = uuid4()
    cid = str(uuid4())
    with patch.object(quotes_router, "as_list", return_value=[{"id": cid}]) as listed:
        ids = quotes_router._customer_ids_matching_name(client, ws, "אלפא")
    assert ids == [cid]
    assert listed.call_count == 1
    params = client.get.call_args.kwargs["params"]
    assert params["workspace_id"] == f"eq.{ws}"
    assert params["display_name"] == "ilike.*אלפא*"


def test_margin_below_minimum_does_not_block_send_b2():
    """B2: below-minimum margin is yellow advisory only — send is never blocked here."""
    ctx = SimpleNamespace()
    quote = {"margin_percent": 5, "margin_override_reason": None, "margin_override_at": None}
    settings = {"quotes": {"margin_minimum": 15, "margin_target": 30}}
    denied = SimpleNamespace(allowed=False)
    with patch.object(quotes_router, "authorize", return_value=denied):
        quotes_router._assert_margin_allows_send(ctx, quote, settings)


def test_margin_below_minimum_allows_override_price_or_recorded_reason():
    ctx = SimpleNamespace()
    settings = {"quotes": {"margin_minimum": 15, "margin_target": 30}}
    allowed = SimpleNamespace(allowed=True)
    with patch.object(quotes_router, "authorize", return_value=allowed):
        quotes_router._assert_margin_allows_send(
            ctx,
            {"margin_percent": 5, "margin_override_reason": None, "margin_override_at": None},
            settings,
        )
    quotes_router._assert_margin_allows_send(
        ctx,
        {
            "margin_percent": 5,
            "margin_override_reason": "מכרז",
            "margin_override_at": "2026-10-31T00:00:00+00:00",
        },
        settings,
    )


def test_quotes_approve_removed_from_staff_catalog():
    catalog = json.loads(
        (Path(__file__).resolve().parents[3] / "packages/authz/catalog.json").read_text(encoding="utf-8")
    )
    keys = {row["key"] for row in catalog["permissions"]}
    assert "quotes.approve" not in keys
    assert "quotes.approve" not in catalog.get("permission_feature", {})
    for grants in catalog["grants"].values():
        assert "quotes.approve" not in grants
