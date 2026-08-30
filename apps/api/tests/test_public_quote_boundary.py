"""Unit: public quote access is resource-bound (token hash → quote+workspace)."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.errors import ApiError
from app.quote_tokens import hash_public_token
from app.routers import public_quotes as pq


def test_load_access_unknown_token_is_404():
    svc = MagicMock()
    svc.get.return_value = SimpleNamespace(status_code=200, json=lambda: [])
    with pytest.raises(ApiError) as exc:
        pq._load_access(svc, "unknown-token")
    assert exc.value.status_code == 404


def test_load_quote_uses_access_workspace_and_quote_ids():
    svc = MagicMock()
    access = {"quote_id": "q-b", "workspace_id": "ws-b", "version": 1}
    svc.get.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [
            {
                "id": "q-b",
                "workspace_id": "ws-b",
                "status": "sent",
                "version": 1,
                "deleted_at": None,
            }
        ],
    )
    quote = pq._load_quote(svc, access)
    assert quote["id"] == "q-b"
    params = svc.get.call_args.kwargs.get("params") or svc.get.call_args[1].get("params")
    # Positional form: svc.get("quotes", params=...)
    if params is None:
        params = svc.get.call_args.kwargs["params"]
    assert params["id"] == "eq.q-b"
    assert params["workspace_id"] == "eq.ws-b"


def test_load_quote_rejects_deleted():
    svc = MagicMock()
    svc.get.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [{"id": "q1", "workspace_id": "w1", "deleted_at": "2026-01-01", "status": "sent"}],
    )
    with pytest.raises(ApiError) as exc:
        pq._load_quote(svc, {"quote_id": "q1", "workspace_id": "w1"})
    assert exc.value.status_code == 404


def test_token_hash_differs_per_token():
    assert hash_public_token("token-a") != hash_public_token("token-b")
