"""Unit tests for Documents upload durability invariant (Gate 10B → 0.1.5)."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

import pytest

from app.errors import ApiError
from app.routers import documents as documents_router

WS = UUID("11111111-1111-1111-1111-111111111111")
DOC = UUID("22222222-2222-2222-2222-222222222222")


def _ctx() -> SimpleNamespace:
    return SimpleNamespace(
        user_id="u1",
        workspace_id=str(WS),
        role_key="owner",
        workspace_status="active",
        subscription_status="active",
        plan_key="solo",
        features=frozenset({"core"}),
        assigned_resource_ids=frozenset(),
    )


def _existing(**overrides):
    base = {
        "id": str(DOC),
        "entity_type": "site",
        "entity_id": "33333333-3333-3333-3333-333333333333",
        "created_by": "u1",
        "reserved_bytes": 100,
        "storage_bucket": "documents",
        "storage_path": f"{WS}/site/33333333-3333-3333-3333-333333333333/{DOC}/file.txt",
        "byte_size": None,
    }
    base.update(overrides)
    return base


@pytest.fixture(autouse=True)
def _patch_authz(monkeypatch):
    monkeypatch.setattr(documents_router, "_ctx", lambda *a, **k: _ctx())
    monkeypatch.setattr(documents_router, "require", lambda *a, **k: None)
    monkeypatch.setattr(documents_router, "raise_plan_limit", lambda *a, **k: None)
    monkeypatch.setattr(documents_router, "evaluate_storage_limit", lambda **k: None)
    monkeypatch.setattr(documents_router, "fetch_storage_used_bytes", lambda *a, **k: 0)


def test_complete_succeeds_when_storage_object_exists(monkeypatch):
    client = MagicMock()
    svc = MagicMock()
    monkeypatch.setattr(documents_router, "one_or_404", lambda *_: _existing())
    svc.storage_object_size.return_value = 42
    patched = {"id": str(DOC), "byte_size": 42, "checksum": None, "mime_type": "text/plain"}
    monkeypatch.setattr(documents_router, "patched_or_403", lambda *_a, **_k: patched)

    body = documents_router.CompleteUpload(byte_size=42, mime_type="text/plain")
    out = documents_router.complete_upload(WS, DOC, body, client, {"id": "u1"}, svc)
    assert out["byte_size"] == 42
    svc.storage_object_size.assert_called_once()


def test_complete_fails_when_storage_object_missing(monkeypatch):
    client = MagicMock()
    svc = MagicMock()
    monkeypatch.setattr(documents_router, "one_or_404", lambda *_: _existing())
    svc.storage_object_size.return_value = None
    cleanup = MagicMock()
    monkeypatch.setattr(documents_router, "_cleanup_failed_upload", cleanup)

    body = documents_router.CompleteUpload(byte_size=99)
    with pytest.raises(ApiError) as exc:
        documents_router.complete_upload(WS, DOC, body, client, {"id": "u1"}, svc)
    assert exc.value.status_code == 409
    assert exc.value.code == "STORAGE_OBJECT_MISSING"
    cleanup.assert_called_once()


def test_complete_does_not_trust_client_size_without_object(monkeypatch):
    """Regression: previously reserved/reported size could fake completion."""
    client = MagicMock()
    svc = MagicMock()
    monkeypatch.setattr(documents_router, "one_or_404", lambda *_: _existing(reserved_bytes=5000))
    svc.storage_object_size.return_value = None
    monkeypatch.setattr(documents_router, "_cleanup_failed_upload", MagicMock())

    body = documents_router.CompleteUpload(byte_size=5000)
    with pytest.raises(ApiError) as exc:
        documents_router.complete_upload(WS, DOC, body, client, {"id": "u1"}, svc)
    assert exc.value.code == "STORAGE_OBJECT_MISSING"


def test_document_url_denies_incomplete_reservation(monkeypatch):
    client = MagicMock()
    svc = MagicMock()
    monkeypatch.setattr(
        documents_router,
        "one_or_404",
        lambda *_: {
            "id": str(DOC),
            "storage_bucket": "documents",
            "storage_path": "ws/path",
            "entity_type": "site",
            "entity_id": "s1",
            "byte_size": None,
        },
    )
    with pytest.raises(ApiError) as exc:
        documents_router.document_url(WS, DOC, client, {"id": "u1"}, svc)
    assert exc.value.status_code == 409
    assert exc.value.code == "STORAGE_OBJECT_MISSING"


def test_document_url_denies_completed_but_missing_object(monkeypatch):
    client = MagicMock()
    svc = MagicMock()
    svc.storage_object_size.return_value = None
    monkeypatch.setattr(
        documents_router,
        "one_or_404",
        lambda *_: {
            "id": str(DOC),
            "storage_bucket": "documents",
            "storage_path": "ws/path",
            "entity_type": "site",
            "entity_id": "s1",
            "byte_size": 68,
        },
    )
    with pytest.raises(ApiError) as exc:
        documents_router.document_url(WS, DOC, client, {"id": "u1"}, svc)
    assert exc.value.code == "STORAGE_OBJECT_MISSING"


def test_document_url_signs_when_completed(monkeypatch):
    client = MagicMock()
    svc = MagicMock()
    svc.storage_object_size.return_value = 12
    client.storage_sign_download.return_value = "https://example.test/signed"
    monkeypatch.setattr(
        documents_router,
        "one_or_404",
        lambda *_: {
            "id": str(DOC),
            "storage_bucket": "documents",
            "storage_path": "ws/path",
            "entity_type": "site",
            "entity_id": "s1",
            "byte_size": 12,
        },
    )
    out = documents_router.document_url(WS, DOC, client, {"id": "u1"}, svc)
    assert out["url"] == "https://example.test/signed"
    client.storage_sign_download.assert_called_once_with("documents", "ws/path", expires_in=60)
