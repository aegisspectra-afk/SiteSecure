"""Unit: SSP public assignment boundaries (no live DB)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import Request

from app.errors import ApiError
from app.routers import public_ssp as pub
from app.ssp.tokens import hash_access_code, hash_public_token, verify_access_code


def _req(ip: str = "203.0.113.9") -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [],
        "client": (ip, 12345),
        "query_string": b"",
        "server": ("test", 80),
        "scheme": "http",
    }
    return Request(scope)


def test_unknown_token_404():
    svc = MagicMock()
    svc.get.return_value = SimpleNamespace(status_code=200, json=lambda: [])
    with pytest.raises(ApiError) as exc:
        pub._load_assignment(svc, "no-such-token")
    assert exc.value.status_code == 404
    assert "workspace" not in (exc.value.message or "").lower()


def test_revoked_and_expired_are_404_not_leak():
    base = {
        "id": "a1",
        "workspace_id": "ws-secret",
        "status": "active",
        "revoked_at": None,
        "expires_at": None,
        "max_submissions": None,
        "submission_count": 0,
        "access_code_hash": None,
    }
    with pytest.raises(ApiError) as exc:
        pub._assignment_usable({**base, "status": "revoked", "revoked_at": "2026-01-01T00:00:00Z"})
    assert exc.value.status_code == 404
    assert "ws-secret" not in str(exc.value.details)

    past = (datetime.now(UTC) - timedelta(hours=1)).isoformat()
    with pytest.raises(ApiError) as exc2:
        pub._assignment_usable({**base, "expires_at": past})
    assert exc2.value.status_code == 404


def test_max_submissions_blocks():
    with pytest.raises(ApiError) as exc:
        pub._assignment_usable(
            {
                "id": "a1",
                "status": "active",
                "revoked_at": None,
                "expires_at": None,
                "max_submissions": 1,
                "submission_count": 1,
            }
        )
    assert exc.value.status_code == 400


def test_completed_assignment_blocks():
    with pytest.raises(ApiError) as exc:
        pub._assignment_usable(
            {
                "id": "a1",
                "status": "completed",
                "revoked_at": None,
                "expires_at": None,
                "max_submissions": 5,
                "submission_count": 5,
            }
        )
    assert exc.value.status_code == 400


def test_access_code_required_and_wrong_is_403_without_hash_leak():
    stored = hash_access_code("correct-code")
    assignment = {"access_code_hash": stored}
    req = _req()
    with pytest.raises(ApiError) as exc:
        pub._require_code_if_needed(req, "tok", assignment, "wrong-code")
    assert exc.value.status_code == 403
    assert stored not in (exc.value.message or "")
    assert stored not in str(exc.value.details)
    assert verify_access_code("correct-code", stored) is True


def test_public_form_payload_omits_workspace_id():
    svc = MagicMock()

    def _get(table, params=None):
        if table == "ssp_forms":
            return SimpleNamespace(
                status_code=200,
                json=lambda: [
                    {
                        "id": "f1",
                        "workspace_id": "ws-should-not-leak",
                        "title": "שאלון",
                        "description": "דסק",
                        "status": "published",
                    }
                ],
            )
        return SimpleNamespace(
            status_code=200,
            json=lambda: [
                {
                    "id": "v1",
                    "workspace_id": "ws-should-not-leak",
                    "form_id": "f1",
                    "version": 2,
                    "status": "published",
                    "definition": {"fields": []},
                    "published_at": "2026-01-01T00:00:00Z",
                }
            ],
        )

    svc.get.side_effect = _get
    assignment = {
        "id": "assign-1",
        "workspace_id": "ws-should-not-leak",
        "form_id": "f1",
        "form_version_id": "v1",
        "require_account": False,
    }
    payload = pub._public_form_payload(svc, assignment)
    blob = str(payload)
    assert "workspace_id" not in payload
    assert "assignment_id" not in payload
    assert "ws-should-not-leak" not in blob
    assert "assign-1" not in blob
    assert payload["form_title"] == "שאלון"
    assert payload["version"] == 2
    # Queries must bind workspace from assignment (tenant scoping)
    calls = [c.kwargs.get("params") or {} for c in svc.get.call_args_list]
    assert any(p.get("workspace_id") == "eq.ws-should-not-leak" for p in calls)


def test_token_hash_unguesable_length():
    from app.ssp.tokens import new_public_token

    token = new_public_token()
    assert len(token) >= 32
    assert hash_public_token(token) != token
    assert len(hash_public_token(token)) == 64


def test_rate_limit_after_repeated_code_failures():
    pub._code_failures.clear()
    stored = hash_access_code("x")
    assignment = {"access_code_hash": stored}
    req = _req("198.51.100.7")
    token = "rate-limit-token"
    for _ in range(pub._CODE_MAX_FAILS):
        with pytest.raises(ApiError) as exc:
            pub._require_code_if_needed(req, token, assignment, "bad")
        assert exc.value.status_code == 403
    with pytest.raises(ApiError) as exc2:
        pub._require_code_if_needed(req, token, assignment, "bad")
    assert exc2.value.status_code == 429
    pub._code_failures.clear()


def test_submit_idempotency_replay_shape():
    """Existing submission by idempotency key returns id/status/submitted_at only."""
    # Document expected public response keys (no answers/workspace).
    expected_keys = {"id", "status", "submitted_at", "replayed"}
    sample = {
        "id": "sub-1",
        "status": "submitted",
        "submitted_at": "2026-10-19T12:00:00+00:00",
        "replayed": True,
    }
    assert set(sample.keys()) == expected_keys
    assert "answers" not in sample
    assert "workspace_id" not in sample
