"""Unit contracts for SSP hardening (no live DB / migrations not applied here)."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.errors import ApiError
from app.routers import public_ssp as pub


ROOT = Path(__file__).resolve().parents[3]
HARDENING_SQL = ROOT / "supabase" / "migrations" / "20261019160000_ssp_forms_hardening.sql"


def test_hardening_migration_file_exists_and_covers_controls():
    text = HARDENING_SQL.read_text(encoding="utf-8")
    assert "ssp_form_versions_immutability" in text
    assert "WITH CHECK" in text and "status = 'draft'" in text
    assert "ssp_public_submit" in text
    assert "FOR UPDATE" in text
    assert "GRANT EXECUTE" in text and "service_role" in text
    assert "replayed" in text


def test_public_payload_has_no_assignment_or_workspace_id():
    svc = MagicMock()

    def _get(table, params=None):
        if table == "ssp_forms":
            return SimpleNamespace(
                status_code=200,
                json=lambda: [
                    {
                        "id": "f1",
                        "workspace_id": "ws-secret",
                        "title": "T",
                        "description": "",
                        "status": "published",
                    }
                ],
            )
        return SimpleNamespace(
            status_code=200,
            json=lambda: [
                {
                    "id": "v1",
                    "workspace_id": "ws-secret",
                    "version": 1,
                    "status": "published",
                    "definition": {"fields": []},
                }
            ],
        )

    svc.get.side_effect = _get
    payload = pub._public_form_payload(
        svc,
        {
            "id": "assign-should-not-leak",
            "workspace_id": "ws-secret",
            "form_id": "f1",
            "form_version_id": "v1",
            "require_account": False,
        },
    )
    assert "assignment_id" not in payload
    assert "workspace_id" not in payload
    assert "ws-secret" not in str(payload)
    assert "assign-should-not-leak" not in str(payload)
    assert set(payload.keys()) == {
        "form_title",
        "form_description",
        "version",
        "definition",
        "require_account",
    }


def test_submit_uses_atomic_rpc_not_rmw_counter():
    svc = MagicMock()
    assignment = {
        "id": "a1",
        "workspace_id": "ws1",
        "form_id": "f1",
        "form_version_id": "v1",
        "status": "active",
        "revoked_at": None,
        "expires_at": None,
        "max_submissions": 1,
        "submission_count": 0,
        "access_code_hash": None,
        "require_account": False,
    }
    svc.get.side_effect = [
        # _load_assignment
        SimpleNamespace(status_code=200, json=lambda: [assignment]),
        # version
        SimpleNamespace(
            status_code=200,
            json=lambda: [
                {
                    "id": "v1",
                    "workspace_id": "ws1",
                    "status": "published",
                    "definition": {
                        "fields": [
                            {
                                "id": "11111111-1111-4111-8111-111111111111",
                                "type": "short_text",
                                "label": "שם",
                                "help_text": "",
                                "required": True,
                            }
                        ]
                    },
                }
            ],
        ),
    ]
    svc.rpc.return_value = SimpleNamespace(
        status_code=200,
        content=b"{}",
        json=lambda: {
            "id": "sub-1",
            "status": "submitted",
            "submitted_at": "2026-10-19T12:00:00+00:00",
            "replayed": False,
        },
        text="",
    )

    from fastapi import Request

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/",
        "headers": [],
        "client": ("127.0.0.1", 1),
        "query_string": b"",
        "server": ("t", 80),
        "scheme": "http",
    }
    req = Request(scope)
    body = pub.SubmitIn(answers={"11111111-1111-4111-8111-111111111111": "דנה"}, idempotency_key="k1")
    out = pub.submit_assignment("public-token", body, req, svc)
    assert out["id"] == "sub-1"
    assert out["replayed"] is False
    assert svc.rpc.call_args_list[0].args[0] == "ssp_public_submit"
    payload = svc.rpc.call_args_list[0].args[1]
    assert payload["p_assignment_id"] == "a1"
    assert payload["p_idempotency_key"] == "k1"
    assert "workspace_id" not in payload
    assert "submission_count" not in payload
    # No RMW patch on assignments
    assert svc.patch.call_count == 0
    assert svc.post.call_count == 0


def test_submit_rpc_limit_maps_to_business_rule():
    res = SimpleNamespace(status_code=400, text="SSP_ASSIGNMENT_LIMIT", content=b"")
    err = pub._map_submit_rpc_error(res)
    assert isinstance(err, ApiError)
    assert err.status_code == 400


def test_submit_rpc_revoked_maps_to_404():
    res = SimpleNamespace(status_code=400, text="SSP_ASSIGNMENT_REVOKED", content=b"")
    err = pub._map_submit_rpc_error(res)
    assert err.status_code == 404
