"""Site activation codes, enrollments, device sessions (no live DB)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

import pytest
from fastapi import Request

from app.errors import ApiError
from app.ssp.activation_codes import (
    CODE_LEN,
    GENERIC_INVALID,
    can_approve_enrollment,
    classify_site_activation,
    device_access_allowed,
    enrollment_public_status,
    hash_activation_code,
    is_valid_activation_code_format,
    new_activation_code,
    normalize_activation_code,
    redeem_is_allowed,
    session_allows_site,
)

ROOT = Path(__file__).resolve().parents[3]
ACT_SQL = ROOT / "supabase" / "migrations" / "20261020140000_ssp_site_activation.sql"
WS = UUID("11111111-1111-4111-8111-111111111111")
SITE = UUID("22222222-2222-4222-8222-222222222222")
ASG = UUID("33333333-3333-4333-8333-333333333333")


def _req(ip: str = "203.0.113.9") -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/",
        "headers": [],
        "client": (ip, 12345),
        "query_string": b"",
        "server": ("test", 80),
        "scheme": "http",
    }
    return Request(scope)


def test_local_migration_hashes_only_and_atomic_consume():
    text = ACT_SQL.read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS public.ssp_site_activation_codes" in text
    assert "code_hash text NOT NULL" in text
    assert "code_plaintext" not in text.lower()
    assert "plain_code" not in text.lower()
    assert "FOR UPDATE" in text
    assert "ssp_consume_activation_code" in text
    assert "GRANT EXECUTE ON FUNCTION public.ssp_consume_activation_code" in text
    assert "TO service_role" in text
    assert "ssp_site_enrollments" in text
    assert "ssp_site_devices" in text
    assert "ssp_site_device_sessions" in text
    assert "token_hash" in text
    assert "device_id" in text
    assert "auth_is_member(workspace_id)" in text
    assert "CREATE TABLE IF NOT EXISTS public.sites" not in text
    assert "ezguard" not in text.lower()
    assert "DROP TABLE" not in text


def test_activation_sql_forbids_authenticated_writes_and_secret_columns():
    """SQL contract only — not a live RLS/integration proof. Local Supabase required."""
    text = ACT_SQL.read_text(encoding="utf-8")
    assert "GRANT SELECT, INSERT, UPDATE ON TABLE public.ssp_site_activation_codes TO authenticated" not in text
    assert "GRANT SELECT, INSERT, UPDATE ON TABLE public.ssp_site_enrollments TO authenticated" not in text
    assert "GRANT SELECT, INSERT, UPDATE ON TABLE public.ssp_site_devices TO authenticated" not in text
    assert "GRANT SELECT, INSERT, UPDATE ON TABLE public.ssp_site_device_sessions TO authenticated" not in text
    assert "CREATE POLICY ssp_site_activation_codes_write" not in text
    assert "CREATE POLICY ssp_site_enrollments_write" not in text
    assert "CREATE POLICY ssp_site_devices_write" not in text
    assert "CREATE POLICY ssp_site_device_sessions_write" not in text
    assert "SET search_path = public, pg_temp" in text
    assert "REVOKE ALL ON FUNCTION public.ssp_consume_activation_code(text, text, text, text) FROM PUBLIC, anon, authenticated" in text
    assert "GRANT EXECUTE ON FUNCTION public.ssp_consume_activation_code(text, text, text, text) TO service_role" in text
    assert "ssp_approve_site_enrollment" in text
    assert "REVOKE ALL ON FUNCTION public.ssp_approve_site_enrollment(uuid, uuid) FROM PUBLIC, anon, authenticated" in text
    assert "GRANT EXECUTE ON FUNCTION public.ssp_approve_site_enrollment(uuid, uuid) TO service_role" in text
    assert "ssp_site_devices_enrollment_uid" in text
    assert "ssp_site_device_sessions_one_active_uid" in text
    assert "ssp_submissions_site_assign_anon_uid" in text
    grants = []
    needle = "GRANT SELECT ("
    start = 0
    while True:
        i = text.find(needle, start)
        if i < 0:
            break
        end = text.find("TO authenticated", i)
        grants.append(text[i:end])
        start = i + len(needle)
    joined = "\n".join(grants)
    assert "code_hash" not in joined
    assert "poll_token_hash" not in joined
    assert "token_hash" not in joined


def test_activation_code_entropy_and_normalize():
    a = new_activation_code()
    b = new_activation_code()
    assert a != b
    assert len(a) == CODE_LEN
    assert is_valid_activation_code_format(a)
    assert normalize_activation_code(" ab-cd_ef ") == "ABCDEF"
    assert not is_valid_activation_code_format("short")
    assert not is_valid_activation_code_format("00000000")
    digest = hash_activation_code(a)
    assert digest != a
    assert len(digest) == 64
    assert digest == hash_activation_code(a.lower())
    assert "X213DFPD" not in {a, b}


def test_redeem_rules_expired_revoked_used():
    now = datetime(2026, 10, 20, 12, tzinfo=UTC)
    assert redeem_is_allowed(status="active", expires_at=now + timedelta(hours=1), now=now)
    assert not redeem_is_allowed(status="active", expires_at=now - timedelta(minutes=1), now=now)
    assert not redeem_is_allowed(status="revoked", expires_at=now + timedelta(hours=1), now=now)
    assert not redeem_is_allowed(status="redeemed", expires_at=now + timedelta(hours=1), now=now)


def test_enrollment_public_status_and_approve_gate():
    now = datetime(2026, 10, 20, 12, tzinfo=UTC)
    assert enrollment_public_status("pending", now - timedelta(minutes=1), now) == "expired"
    assert enrollment_public_status("pending", now + timedelta(minutes=5), now) == "pending"
    assert can_approve_enrollment(enrollment_status="pending", site_is_active=True, code_status="redeemed")
    assert not can_approve_enrollment(enrollment_status="pending", site_is_active=False, code_status="redeemed")
    assert not can_approve_enrollment(enrollment_status="denied", site_is_active=True, code_status="redeemed")
    assert not can_approve_enrollment(enrollment_status="pending", site_is_active=True, code_status="revoked")


def test_device_session_and_site_bind():
    now = datetime(2026, 10, 20, 12, tzinfo=UTC)
    assert device_access_allowed(
        session_status="active",
        session_expires_at=now + timedelta(hours=1),
        device_status="active",
        site_is_active=True,
        now=now,
    )
    assert not device_access_allowed(
        session_status="revoked",
        session_expires_at=now + timedelta(hours=1),
        device_status="active",
        site_is_active=True,
        now=now,
    )
    assert not device_access_allowed(
        session_status="active",
        session_expires_at=now - timedelta(seconds=1),
        device_status="active",
        site_is_active=True,
        now=now,
    )
    assert not device_access_allowed(
        session_status="active",
        session_expires_at=now + timedelta(hours=1),
        device_status="revoked",
        site_is_active=True,
        now=now,
    )
    assert not device_access_allowed(
        session_status="active",
        session_expires_at=now + timedelta(hours=1),
        device_status="active",
        site_is_active=False,
        now=now,
    )
    assert session_allows_site("site-a", None)
    assert session_allows_site("site-a", "site-a")
    assert not session_allows_site("site-a", "site-b")


def test_classify_activation_status():
    assert classify_site_activation(has_active_device=True, has_pending_enrollment=True, has_live_code=True) == "device_active"
    assert (
        classify_site_activation(has_active_device=False, has_pending_enrollment=True, has_live_code=True)
        == "pending_approval"
    )
    assert (
        classify_site_activation(has_active_device=False, has_pending_enrollment=False, has_live_code=True) == "code_issued"
    )
    assert (
        classify_site_activation(has_active_device=False, has_pending_enrollment=False, has_live_code=False)
        == "awaiting_activation"
    )


def test_invalid_code_is_uniform_and_does_not_leak_site(monkeypatch):
    from app.routers import public_ssp_site as r

    r._fail_window.clear()
    svc = MagicMock()
    with pytest.raises(ApiError) as exc:
        r.site_activate(r.ActivateIn(code="AAAA"), request=_req(), svc=svc)
    assert exc.value.status_code == 400
    assert exc.value.message == GENERIC_INVALID
    assert "שפלה" not in (exc.value.message or "")
    svc.rpc.assert_not_called()

    r._fail_window.clear()
    svc.rpc.return_value = SimpleNamespace(status_code=200, content=b"{}", json=lambda: {"ok": False})
    with pytest.raises(ApiError) as exc2:
        r.site_activate(r.ActivateIn(code="ABCDEFGH"), request=_req(), svc=svc)
    assert exc2.value.message == GENERIC_INVALID
    blob = str(exc2.value.details) + (exc2.value.message or "")
    assert "workspace" not in blob.lower()
    assert "site_pk" not in blob


def test_activate_rate_limit():
    from app.routers import public_ssp_site as r

    r._fail_window.clear()
    req = _req("198.51.100.10")
    for _ in range(8):
        r._record_activate_failure(req)
    with pytest.raises(ApiError) as exc:
        r._check_activate_rate(req)
    assert exc.value.status_code == 429


def test_activate_rate_limit_ignores_forwarded_for():
    from app.routers import public_ssp_site as r

    r._fail_window.clear()
    req = _req("198.51.100.10")
    req.scope["headers"] = [(b"x-forwarded-for", b"203.0.113.9")]
    for _ in range(8):
        r._record_activate_failure(req)
    other = _req("198.51.100.10")
    other.scope["headers"] = [(b"x-forwarded-for", b"192.0.2.1")]
    with pytest.raises(ApiError) as exc:
        r._check_activate_rate(other)
    assert exc.value.status_code == 429


def test_officer_cannot_issue_code(monkeypatch):
    from app.routers import ssp_site_activation as r

    ctx = SimpleNamespace(user_id="off", workspace_id=str(WS), features=frozenset({"ssp"}))
    monkeypatch.setattr(r, "_ctx", lambda *_a, **_k: ctx)
    monkeypatch.setattr(r, "require_ssp_action", lambda *_a, **_k: {"product_role": "patrol_officer"})
    with pytest.raises(ApiError) as exc:
        r.issue_activation_code(WS, SITE, user={"sub": "off"}, client=MagicMock(), svc=MagicMock())
    assert exc.value.status_code == 403
    assert "code" not in (exc.value.message or "").lower() or GENERIC_INVALID not in (exc.value.message or "")


def test_issue_code_returns_plaintext_once_and_stores_hash(monkeypatch):
    from app.routers import ssp_site_activation as r

    ctx = SimpleNamespace(user_id="mgr", workspace_id=str(WS), features=frozenset({"ssp"}))
    monkeypatch.setattr(r, "_ctx", lambda *_a, **_k: ctx)
    monkeypatch.setattr(r, "_require_manager", lambda *_a, **_k: {"product_role": "patrol_manager"})
    monkeypatch.setattr(
        r,
        "_load_site",
        lambda *_a, **_k: {"id": str(SITE), "is_active": True, "company_pk": "co-1"},
    )
    monkeypatch.setattr(r, "_guard_site", lambda *_a, **_k: None)
    monkeypatch.setattr(r, "_require_company", lambda *_a, **_k: {"id": "co-1"})
    monkeypatch.setattr(r, "_try_list", lambda *_a, **_k: [])
    monkeypatch.setattr(r, "write_audit", lambda *_a, **_k: None)
    monkeypatch.setattr(r, "new_activation_code", lambda: "ABCD2345")
    stored: dict = {}

    def post(_table, json=None, params=None):
        stored["row"] = json
        return SimpleNamespace(
            status_code=201,
            json=lambda: [{**json, "id": "code-1", "created_at": "t", "redeemed_at": None, "revoked_at": None}],
        )

    svc = MagicMock()
    svc.post.side_effect = post
    client = MagicMock()
    monkeypatch.setattr(r, "created_or_403", lambda res: res.json()[0])
    out = r.issue_activation_code(WS, SITE, user={"sub": "mgr"}, client=client, svc=svc)
    assert out["code"] == "ABCD2345"
    assert stored["row"]["code_hash"] == hash_activation_code("ABCD2345")
    assert "code" not in stored["row"]
    assert stored["row"]["code_hash"] != "ABCD2345"
    client.post.assert_not_called()
    svc.post.assert_called_once()


def test_approve_rejected_when_already_decided(monkeypatch):
    from app.routers import ssp_site_activation as r

    ctx = SimpleNamespace(user_id="mgr", workspace_id=str(WS), features=frozenset({"ssp"}))
    monkeypatch.setattr(r, "_ctx", lambda *_a, **_k: ctx)
    monkeypatch.setattr(r, "_require_manager", lambda *_a, **_k: {"product_role": "org_admin"})
    monkeypatch.setattr(
        r,
        "_load_site",
        lambda *_a, **_k: {"id": str(SITE), "is_active": True, "company_pk": "co-1"},
    )
    monkeypatch.setattr(r, "_guard_site", lambda *_a, **_k: None)
    enrollment = {
        "id": "en-1",
        "site_pk": str(SITE),
        "code_id": "code-1",
        "status": "denied",
        "expires_at": (datetime.now(UTC) + timedelta(minutes=10)).isoformat(),
        "device_label": None,
    }
    client = MagicMock()
    client.get.side_effect = [
        SimpleNamespace(status_code=200, json=lambda: [enrollment]),
        SimpleNamespace(status_code=200, json=lambda: [{"id": "code-1", "status": "redeemed"}]),
    ]
    monkeypatch.setattr(r, "one_or_404", lambda res: res.json()[0])
    svc = MagicMock()
    with pytest.raises(ApiError) as exc:
        r.approve_enrollment(WS, SITE, user={"sub": "mgr"}, client=client, svc=svc)
    assert exc.value.status_code == 400
    svc.rpc.assert_not_called()
    svc.post.assert_not_called()


def test_device_submit_rejects_other_site(monkeypatch):
    from app.routers import public_ssp_site as r

    ctx = {
        "session": {"id": "sess-1"},
        "device": {"id": "dev-1"},
        "site": {"id": "site-a", "workspace_id": str(WS), "is_active": True},
    }
    monkeypatch.setattr(r, "_ctx_from_header", lambda *_a, **_k: ctx)
    assignment = {
        "id": str(ASG),
        "site_pk": "site-b",
        "status": "active",
        "filler_mode": "site",
        "starts_at": None,
        "form_id": "form-1",
        "form_version_id": "ver-1",
        "definition_snapshot": {"fields": []},
        "workspace_id": str(WS),
    }
    svc = MagicMock()
    svc.get.return_value = SimpleNamespace(status_code=200, json=lambda: [assignment])
    monkeypatch.setattr(r, "one_or_404", lambda res: res.json()[0])
    with pytest.raises(ApiError) as exc:
        r.device_submit(ASG, r.DeviceSubmitIn(answers={}), svc=svc, x_ssp_device_token="tok")
    assert exc.value.status_code == 403


def test_device_access_denied_before_approval_shape():
    from app.routers import public_ssp_site as r

    svc = MagicMock()
    svc.get.return_value = SimpleNamespace(status_code=200, json=lambda: [])
    with pytest.raises(ApiError) as exc:
        r._load_device_context(svc, "not-a-session")
    assert exc.value.status_code == 401
    assert "workspace" not in (exc.value.message or "").lower()


def test_approve_rejected_when_cancelled(monkeypatch):
    from app.routers import ssp_site_activation as r

    ctx = SimpleNamespace(user_id="mgr", workspace_id=str(WS), features=frozenset({"ssp"}))
    monkeypatch.setattr(r, "_ctx", lambda *_a, **_k: ctx)
    monkeypatch.setattr(r, "_require_manager", lambda *_a, **_k: {"product_role": "org_admin"})
    monkeypatch.setattr(
        r,
        "_load_site",
        lambda *_a, **_k: {"id": str(SITE), "is_active": True, "company_pk": "co-1"},
    )
    monkeypatch.setattr(r, "_guard_site", lambda *_a, **_k: None)
    enrollment = {
        "id": "en-1",
        "site_pk": str(SITE),
        "code_id": "code-1",
        "status": "cancelled",
        "expires_at": (datetime.now(UTC) + timedelta(minutes=10)).isoformat(),
        "device_label": None,
    }
    client = MagicMock()
    client.get.side_effect = [
        SimpleNamespace(status_code=200, json=lambda: [enrollment]),
        SimpleNamespace(status_code=200, json=lambda: [{"id": "code-1", "status": "redeemed"}]),
    ]
    monkeypatch.setattr(r, "one_or_404", lambda res: res.json()[0])
    svc = MagicMock()
    with pytest.raises(ApiError) as exc:
        r.approve_enrollment(WS, SITE, user={"sub": "mgr"}, client=client, svc=svc)
    assert exc.value.status_code == 400
    svc.rpc.assert_not_called()


def test_approve_uses_atomic_rpc_and_checks_workspace(monkeypatch):
    from app.routers import ssp_site_activation as r

    ctx = SimpleNamespace(user_id="mgr", workspace_id=str(WS), features=frozenset({"ssp"}))
    monkeypatch.setattr(r, "_ctx", lambda *_a, **_k: ctx)
    monkeypatch.setattr(r, "_require_manager", lambda *_a, **_k: {"product_role": "patrol_manager"})
    monkeypatch.setattr(
        r,
        "_load_site",
        lambda *_a, **_k: {"id": str(SITE), "is_active": True, "company_pk": "co-1"},
    )
    monkeypatch.setattr(r, "_guard_site", lambda *_a, **_k: None)
    monkeypatch.setattr(r, "write_audit", lambda *_a, **_k: None)
    enrollment = {
        "id": "en-1",
        "site_pk": str(SITE),
        "code_id": "code-1",
        "status": "pending",
        "expires_at": (datetime.now(UTC) + timedelta(minutes=10)).isoformat(),
        "device_label": "לובי",
    }
    client = MagicMock()
    client.get.side_effect = [
        SimpleNamespace(status_code=200, json=lambda: [enrollment]),
        SimpleNamespace(status_code=200, json=lambda: [{"id": "code-1", "status": "redeemed"}]),
    ]
    monkeypatch.setattr(r, "one_or_404", lambda res: res.json()[0] if res.json() else {"id": "en-1", "status": "approved"})
    svc = MagicMock()
    svc.rpc.return_value = SimpleNamespace(
        status_code=200,
        content=b"{}",
        json=lambda: {
            "ok": True,
            "device_id": "dev-1",
            "enrollment_id": "en-1",
            "workspace_id": str(WS),
            "site_pk": str(SITE),
        },
    )
    svc.get.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [{"id": "en-1", "status": "approved", "device_id": "dev-1", "site_pk": str(SITE)}],
    )
    out = r.approve_enrollment(WS, SITE, user={"sub": "mgr"}, client=client, svc=svc)
    assert out["device_id"] == "dev-1"
    svc.rpc.assert_called_once()
    assert svc.rpc.call_args[0][0] == "ssp_approve_site_enrollment"
    svc.post.assert_not_called()


def test_approve_rpc_workspace_mismatch_is_denied(monkeypatch):
    from app.routers import ssp_site_activation as r

    ctx = SimpleNamespace(user_id="mgr", workspace_id=str(WS), features=frozenset({"ssp"}))
    monkeypatch.setattr(r, "_ctx", lambda *_a, **_k: ctx)
    monkeypatch.setattr(r, "_require_manager", lambda *_a, **_k: {"product_role": "patrol_manager"})
    monkeypatch.setattr(
        r,
        "_load_site",
        lambda *_a, **_k: {"id": str(SITE), "is_active": True, "company_pk": "co-1"},
    )
    monkeypatch.setattr(r, "_guard_site", lambda *_a, **_k: None)
    enrollment = {
        "id": "en-1",
        "site_pk": str(SITE),
        "code_id": "code-1",
        "status": "pending",
        "expires_at": (datetime.now(UTC) + timedelta(minutes=10)).isoformat(),
        "device_label": None,
    }
    client = MagicMock()
    client.get.side_effect = [
        SimpleNamespace(status_code=200, json=lambda: [enrollment]),
        SimpleNamespace(status_code=200, json=lambda: [{"id": "code-1", "status": "redeemed"}]),
    ]
    monkeypatch.setattr(r, "one_or_404", lambda res: res.json()[0])
    svc = MagicMock()
    svc.rpc.return_value = SimpleNamespace(
        status_code=200,
        content=b"{}",
        json=lambda: {
            "ok": True,
            "device_id": "dev-1",
            "workspace_id": "99999999-9999-4999-8999-999999999999",
            "site_pk": str(SITE),
        },
    )
    with pytest.raises(ApiError) as exc:
        r.approve_enrollment(WS, SITE, user={"sub": "mgr"}, client=client, svc=svc)
    assert exc.value.status_code == 403


def test_device_assignment_detail_rejects_other_site(monkeypatch):
    from app.routers import public_ssp_site as r

    ctx = {
        "session": {"id": "sess-1"},
        "device": {"id": "dev-1"},
        "site": {"id": "site-a", "workspace_id": str(WS), "is_active": True, "name": "A"},
    }
    monkeypatch.setattr(r, "_ctx_from_header", lambda *_a, **_k: ctx)
    assignment = {
        "id": str(ASG),
        "site_pk": "site-b",
        "status": "active",
        "form_id": "form-1",
        "form_version_id": "ver-1",
        "definition_snapshot": {"fields": []},
        "workspace_id": str(WS),
    }
    svc = MagicMock()
    monkeypatch.setattr(r, "one_or_404", lambda res: assignment)
    with pytest.raises(ApiError) as exc:
        r.device_assignment_detail(ASG, svc=svc, x_ssp_device_token="tok")
    assert exc.value.status_code == 403


def test_device_submit_duplicate_conflict_maps_to_409(monkeypatch):
    from app.routers import public_ssp_site as r

    ctx = {
        "session": {"id": "sess-1"},
        "device": {"id": "dev-1"},
        "site": {"id": "site-a", "workspace_id": str(WS), "is_active": True},
    }
    monkeypatch.setattr(r, "_ctx_from_header", lambda *_a, **_k: ctx)
    assignment = {
        "id": str(ASG),
        "site_pk": "site-a",
        "status": "active",
        "filler_mode": "site",
        "starts_at": None,
        "form_id": "form-1",
        "form_version_id": "ver-1",
        "definition_snapshot": {"fields": []},
        "workspace_id": str(WS),
    }
    svc = MagicMock()
    svc.get.side_effect = [
        SimpleNamespace(status_code=200, json=lambda: [assignment]),
        SimpleNamespace(status_code=200, json=lambda: []),
    ]
    svc.post.return_value = SimpleNamespace(status_code=409, json=lambda: {"code": "23505"})
    monkeypatch.setattr(r, "one_or_404", lambda res: assignment)
    monkeypatch.setattr(r, "as_list", lambda res: res.json() if res.status_code == 200 else [])
    with pytest.raises(ApiError) as exc:
        r.device_submit(ASG, r.DeviceSubmitIn(answers={}), svc=svc, x_ssp_device_token="tok")
    assert exc.value.status_code == 409


def test_revoked_session_is_denied_on_each_request():
    now = datetime.now(UTC)
    assert not device_access_allowed(
        session_status="revoked",
        session_expires_at=now + timedelta(hours=11),
        device_status="active",
        site_is_active=True,
        now=now,
    )
    assert not device_access_allowed(
        session_status="active",
        session_expires_at=now + timedelta(hours=11),
        device_status="revoked",
        site_is_active=True,
        now=now,
    )


@pytest.mark.skip(reason="Requires local Supabase with 20261020120000 + 20261020140000 applied")
def test_live_authenticated_cannot_insert_device_session():
    raise AssertionError("unreachable: live RLS proof is blocked until Local Supabase")
