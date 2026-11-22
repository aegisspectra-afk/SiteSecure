"""D2: public quote approve auto-provisions project + installation job (awaiting dispatch)."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.errors import ApiError
from app.quote_approve_provision import (
    AWAITING_DISPATCH_STATUS,
    provision_project_and_job_after_quote_approve,
)
from app.routers import public_quotes as pq


def _approved_quote(*, site_id: str | None = "site-1") -> dict:
    return {
        "id": "q1",
        "workspace_id": "ws1",
        "number": "Q-100",
        "status": "approved",
        "version": 2,
        "customer_id": "cust-1",
        "site_id": site_id,
        "title": "התקנת מצלמות",
        "lead_id": None,
    }


def test_provision_skips_when_quote_has_no_site():
    svc = MagicMock()
    out = provision_project_and_job_after_quote_approve(svc, _approved_quote(site_id=None))
    assert out is None
    svc.post.assert_not_called()


def test_provision_skips_when_customer_missing():
    svc = MagicMock()
    quote = _approved_quote()
    quote["customer_id"] = None
    out = provision_project_and_job_after_quote_approve(svc, quote)
    assert out is None
    svc.post.assert_not_called()


def test_provision_creates_project_and_awaiting_dispatch_job():
    svc = MagicMock()
    quote = _approved_quote()

    def _get(table, **kwargs):
        if table == "projects":
            return SimpleNamespace(status_code=200, json=lambda: [])
        if table == "jobs":
            return SimpleNamespace(status_code=200, json=lambda: [])
        raise AssertionError(table)

    svc.get.side_effect = _get
    svc.post.side_effect = [
        SimpleNamespace(status_code=201, json=lambda: {"id": "proj-1"}),
        SimpleNamespace(status_code=201, json=lambda: {"id": "job-1", "status": AWAITING_DISPATCH_STATUS}),
    ]

    out = provision_project_and_job_after_quote_approve(svc, quote)
    assert out == {"project_id": "proj-1", "job_id": "job-1", "created_project": True, "created_job": True}

    project_call = svc.post.call_args_list[0]
    project_payload = project_call.kwargs.get("json") or project_call.args[1]
    assert project_payload["source_quote_id"] == "q1"
    assert project_payload["source_quote_version"] == 2
    assert project_payload["status"] == "planned"

    job_call = svc.post.call_args_list[1]
    job_payload = job_call.kwargs.get("json") or job_call.args[1]
    assert job_payload["project_id"] == "proj-1"
    assert job_payload["kind"] == "installation"
    assert job_payload["status"] == AWAITING_DISPATCH_STATUS
    assert job_payload["customer_id"] == "cust-1"
    assert job_payload["site_id"] == "site-1"


def test_provision_idempotent_reuses_existing_project_and_skips_duplicate_job():
    svc = MagicMock()
    quote = _approved_quote()
    existing_project = {"id": "proj-existing", "workspace_id": "ws1", "source_quote_id": "q1"}
    existing_job = {"id": "job-existing", "status": AWAITING_DISPATCH_STATUS, "kind": "installation"}

    def _get(table, **kwargs):
        params = kwargs.get("params") or {}
        if table == "projects":
            return SimpleNamespace(status_code=200, json=lambda: [existing_project])
        if table == "jobs":
            return SimpleNamespace(status_code=200, json=lambda: [existing_job])
        raise AssertionError(table)

    svc.get.side_effect = _get
    out = provision_project_and_job_after_quote_approve(svc, quote)
    assert out == {
        "project_id": "proj-existing",
        "job_id": "job-existing",
        "created_project": False,
        "created_job": False,
    }
    svc.post.assert_not_called()


def test_approve_public_quote_provisions_project_and_job():
    frozen = {
        "id": "q1",
        "number": "Q-1",
        "version": 1,
        "status": "viewed",
        "title": "הצעה",
        "currency": "ILS",
        "subtotal_net": 1000,
        "vat_amount": 0,
        "total_gross": 1000,
        "items": [{"id": "i1", "description": "מצלמה", "qty": 1, "unit_price": 1000, "line_net": 1000, "item_type": "catalog"}],
        "sections": [],
        "company": {"name": "אגיס"},
        "customer": {"display_name": "לקוח"},
    }
    access = {"quote_id": "q1", "workspace_id": "ws", "version": 1}
    quote = {
        "id": "q1",
        "workspace_id": "ws",
        "status": "viewed",
        "version": 1,
        "deleted_at": None,
    }
    approved_row = {
        "id": "q1",
        "workspace_id": "ws",
        "status": "approved",
        "approved_at": "t",
        "approved_name": "לקוח",
        "version": 1,
    }
    version_row = {"id": "v1", "version": 1, "snapshot": {"public": frozen}}

    svc = MagicMock()
    svc.patch.return_value = SimpleNamespace(status_code=200)
    body = pq.PublicDecisionIn(
        name="לקוח",
        terms_accepted=True,
        signature_data_url="data:image/png;base64,aaa",
    )

    provision_mock = MagicMock(return_value={"project_id": "p1", "job_id": "j1"})

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
        patch.object(pq, "provision_project_and_job_after_quote_approve", provision_mock),
        patch("app.quote_value_guard.assert_quote_has_billable_value"),
    ):
        public = pq.approve_public_quote("tok", body, MagicMock(), svc)

    assert public["status"] == "approved"
    provision_mock.assert_called_once()
    assert provision_mock.call_args.args[0] is svc
    assert provision_mock.call_args.args[1]["id"] == "q1"


def test_en_route_allowed_from_awaiting_dispatch():
    from app.job_lifecycle import assert_transition

    assert assert_transition("en_route", AWAITING_DISPATCH_STATUS) == "en_route"


def test_awaiting_dispatch_in_open_job_statuses():
    from app.job_lifecycle import OPEN_JOB_STATUSES

    assert AWAITING_DISPATCH_STATUS in OPEN_JOB_STATUSES