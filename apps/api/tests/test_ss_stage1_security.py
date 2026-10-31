"""SITE SECURE stage-1: warranty hash, quote link TTL, document path + signed URLs."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

import pytest

from app.errors import ApiError
from app.quote_tokens import hash_public_token
from app.routers import documents as documents_router
from app.routers import public_quotes as pq
from app.routers import quotes as quotes_router

WS = UUID("11111111-1111-1111-1111-111111111111")
OTHER = UUID("99999999-9999-9999-9999-999999999999")
DOC = UUID("22222222-2222-2222-2222-222222222222")
SITE = "33333333-3333-3333-3333-333333333333"


def test_warranty_hash_is_sha256_hex_and_not_plaintext():
    raw = "plain-warranty-token"
    digest = hash_public_token(raw)
    assert digest != raw
    assert len(digest) == 64
    assert digest == hash_public_token(raw)
    assert hash_public_token("a") != hash_public_token("b")


def test_access_expires_at_uses_valid_until_end_of_day():
    out = quotes_router._access_expires_at({"valid_until": "2026-11-15"})
    assert out.startswith("2026-11-15T23:59:59")


def test_access_expires_at_defaults_to_thirty_days_when_missing():
    now = datetime(2026, 10, 31, 12, 0, tzinfo=UTC)
    out = quotes_router._access_expires_at({"valid_until": None}, now=now)
    assert out == (now + timedelta(days=30)).isoformat()
    assert quotes_router._access_expires_at({"valid_until": ""}, now=now) == out
    assert quotes_router._access_expires_at({"valid_until": "not-a-date"}, now=now) == out


def test_load_access_requires_unexpired_ttl():
    svc = MagicMock()
    future = (datetime.now(UTC) + timedelta(days=10)).isoformat()
    svc.get.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [{"id": "a1", "revoked_at": None, "expires_at": future}],
    )
    assert pq._load_access(svc, "tok")["id"] == "a1"

    svc.get.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [{"id": "a1", "revoked_at": None, "expires_at": None}],
    )
    with pytest.raises(ApiError) as missing:
        pq._load_access(svc, "tok")
    assert missing.value.status_code == 404

    past = (datetime.now(UTC) - timedelta(minutes=1)).isoformat()
    svc.get.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [{"id": "a1", "revoked_at": None, "expires_at": past}],
    )
    with pytest.raises(ApiError) as expired:
        pq._load_access(svc, "tok")
    assert expired.value.status_code == 404


def test_storage_path_accepts_owned_prefix_only():
    owned = f"{WS}/site/{SITE}/{DOC}/file.txt"
    assert documents_router.assert_workspace_storage_path(WS, owned) == owned
    with pytest.raises(ApiError) as other:
        documents_router.assert_workspace_storage_path(WS, f"{OTHER}/site/{SITE}/{DOC}/file.txt")
    assert other.value.status_code == 403
    for bad in (
        f"{WS}/../{OTHER}/site/{SITE}/{DOC}/x",
        f"{WS}/site/../{OTHER}/{DOC}/x",
        "../documents/secret",
        f"/{WS}/site/{SITE}/{DOC}/x",
        f"{WS}\\..\\{OTHER}\\x",
        "",
    ):
        with pytest.raises(ApiError):
            documents_router.assert_workspace_storage_path(WS, bad)


def test_document_url_rejects_foreign_and_traversal_paths(monkeypatch):
    ctx = SimpleNamespace(
        user_id="u1",
        workspace_id=str(WS),
        role_key="owner",
        workspace_status="active",
        subscription_status="active",
        plan_key="solo",
        features=frozenset({"core"}),
        assigned_resource_ids=frozenset(),
    )
    monkeypatch.setattr(documents_router, "_ctx", lambda *a, **k: ctx)
    required: list[str] = []

    def require(authz, action, resource=None):
        required.append(action)

    monkeypatch.setattr(documents_router, "require", require)
    client = MagicMock()
    svc = MagicMock()
    monkeypatch.setattr(
        documents_router,
        "one_or_404",
        lambda *_: {
            "id": str(DOC),
            "storage_bucket": "documents",
            "storage_path": f"{OTHER}/site/{SITE}/{DOC}/../secret.pdf",
            "entity_type": "site",
            "entity_id": SITE,
            "byte_size": 10,
        },
    )
    with pytest.raises(ApiError) as exc:
        documents_router.document_url(WS, DOC, client, {"id": "u1"}, svc)
    assert exc.value.status_code == 403
    assert "documents.view" in required
    svc.storage_sign_download.assert_not_called()


def test_document_url_denied_without_view(monkeypatch):
    monkeypatch.setattr(documents_router, "_ctx", lambda *a, **k: SimpleNamespace(workspace_id=str(WS)))

    def deny(*_a, **_k):
        raise ApiError(403, "PERMISSION_DENIED", "אין הרשאה")

    monkeypatch.setattr(documents_router, "require", deny)
    with pytest.raises(ApiError) as exc:
        documents_router.document_url(WS, DOC, MagicMock(), {"id": "u1"}, MagicMock())
    assert exc.value.status_code == 403


def test_create_upload_signs_via_service_and_owned_path(monkeypatch):
    ctx = SimpleNamespace(
        user_id="u1",
        workspace_id=str(WS),
        role_key="owner",
        workspace_status="active",
        subscription_status="active",
        plan_key="solo",
        features=frozenset({"core"}),
        assigned_resource_ids=frozenset(),
    )
    actions: list[str] = []
    monkeypatch.setattr(documents_router, "_ctx", lambda *a, **k: ctx)
    monkeypatch.setattr(documents_router, "require", lambda *_a, **k: actions.append(k.get("resource") and "documents.upload") or actions.append("documents.upload"))
    monkeypatch.setattr(documents_router, "raise_plan_limit", lambda *_a, **_k: None)
    monkeypatch.setattr(documents_router, "evaluate_storage_limit", lambda **k: None)
    monkeypatch.setattr(documents_router, "fetch_storage_used_bytes", lambda *a, **k: 0)
    monkeypatch.setattr(documents_router, "created_or_403", lambda row: {"id": str(DOC)})
    client = MagicMock()
    client.post.return_value = SimpleNamespace(status_code=201, json=lambda: [{"id": str(DOC)}])
    svc = MagicMock()
    svc.storage_sign_upload.return_value = {"upload_url": "https://example.test/up"}
    body = documents_router.UploadIntent(
        entity_type="site",
        entity_id=SITE,
        kind="document",
        original_filename="plan.pdf",
        byte_size=12,
    )
    out = documents_router.create_upload(WS, body, client, {"id": "u1"}, svc)
    assert out["upload_url"] == "https://example.test/up"
    assert out["storage_path"].startswith(f"{WS}/")
    assert ".." not in out["storage_path"]
    svc.storage_sign_upload.assert_called_once()
    client.storage_sign_upload.assert_not_called()
    assert "documents.upload" in actions
