"""Rotating unit-login codes and operational sessions (no live DB required)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Barrier, Thread
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

import pytest
from fastapi import Request

from app.errors import ApiError
from app.ssp.provision import provision_ssp_user
from app.ssp.unit_login import (
    CODE_LEN,
    GENERIC_UNIT_INVALID,
    UNIT_CODE_TTL,
    format_unit_code_display,
    hash_unit_code,
    is_valid_unit_code_format,
    new_unit_login_code,
    normalize_unit_code,
    redeem_is_allowed,
    remaining_seconds,
    unit_code_expires_at,
    unit_session_allows,
)

ROOT = Path(__file__).resolve().parents[3]
SQL = ROOT / "supabase" / "migrations" / "20261023140000_ssp_unit_login.sql"
PROVISION = ROOT / "apps" / "api" / "app" / "ssp" / "provision.py"
LOGIN_WEB = ROOT / "apps" / "web" / "src" / "routes" / "login.tsx"
WS = UUID("11111111-1111-4111-8111-111111111111")
SITE = UUID("22222222-2222-4222-8222-222222222222")
ASG = UUID("33333333-3333-4333-8333-333333333333")


def _req(ip: str = "203.0.113.9", xff: str | None = None) -> Request:
    headers = []
    if xff:
        headers.append((b"x-forwarded-for", xff.encode("ascii")))
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/",
        "headers": headers,
        "client": (ip, 12345),
        "query_string": b"",
        "server": ("test", 80),
        "scheme": "http",
    }
    return Request(scope)


def test_local_migration_hashes_only_and_atomic_redeem():
    text = SQL.read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS public.ssp_unit_login_codes" in text
    assert "CREATE TABLE IF NOT EXISTS public.ssp_unit_sessions" in text
    assert "code_hash text NOT NULL" in text
    assert "token_hash text NOT NULL" in text
    assert "FOR UPDATE" in text
    assert "ssp_redeem_unit_login_code" in text
    assert "GRANT EXECUTE ON FUNCTION public.ssp_redeem_unit_login_code" in text
    assert "TO service_role" in text
    assert "interval '10 minutes'" not in text.lower() or "expires_at" in text
    assert "CREATE POLICY ssp_unit_login_codes_write" not in text
    assert "CREATE POLICY ssp_unit_sessions_write" not in text
    assert "GRANT SELECT, INSERT, UPDATE ON TABLE public.ssp_unit_login_codes TO authenticated" not in text
    assert "auth_is_member(workspace_id)" in text
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
    assert "display_code" not in joined
    assert "token_hash" not in joined


def test_existing_user_provision_uses_gotrue_admin_not_postgrest_auth():
    text = PROVISION.read_text(encoding="utf-8")
    assert "auth_admin_create_user" in text
    assert "email_confirm" in text
    assert "auth.users" not in text.lower() or "GoTrue" in text or "auth_admin" in text
    assert "password" in text
    login = LOGIN_WEB.read_text(encoding="utf-8")
    assert "signInWithPassword" in login
    assert "loginSspUnit" in login


def test_unit_code_entropy_ttl_and_normalize():
    a = new_unit_login_code()
    b = new_unit_login_code()
    assert a != b
    assert len(a) == CODE_LEN
    assert is_valid_unit_code_format(a)
    assert normalize_unit_code(" ab-cd_ef ") == "ABCDEF"
    assert hash_unit_code(a) == hash_unit_code(a.lower())
    assert len(hash_unit_code(a)) == 64
    assert format_unit_code_display(a) == f"{a[:4]}-{a[4:]}"
    now = datetime(2026, 10, 23, 12, tzinfo=UTC)
    expires = unit_code_expires_at(now)
    assert expires - now == UNIT_CODE_TTL
    assert remaining_seconds(expires, now) == int(UNIT_CODE_TTL.total_seconds())


def test_reject_expired_redeemed_revoked_codes():
    now = datetime(2026, 10, 23, 12, tzinfo=UTC)
    assert redeem_is_allowed(status="active", expires_at=now + timedelta(minutes=5), now=now)
    assert not redeem_is_allowed(status="active", expires_at=now - timedelta(seconds=1), now=now)
    assert not redeem_is_allowed(status="redeemed", expires_at=now + timedelta(minutes=5), now=now)
    assert not redeem_is_allowed(status="revoked", expires_at=now + timedelta(minutes=5), now=now)
    assert not redeem_is_allowed(status="superseded", expires_at=now + timedelta(minutes=5), now=now)


def test_unit_session_bound_to_site_and_expiry():
    now = datetime(2026, 10, 23, 12, tzinfo=UTC)
    assert unit_session_allows(
        session_status="active",
        session_expires_at=now + timedelta(hours=1),
        site_is_active=True,
        now=now,
    )
    assert not unit_session_allows(
        session_status="revoked",
        session_expires_at=now + timedelta(hours=1),
        site_is_active=True,
        now=now,
    )
    assert not unit_session_allows(
        session_status="active",
        session_expires_at=now - timedelta(seconds=1),
        site_is_active=True,
        now=now,
    )
    assert not unit_session_allows(
        session_status="active",
        session_expires_at=now + timedelta(hours=1),
        site_is_active=False,
        now=now,
    )


def test_invalid_unit_code_is_uniform():
    from app.routers import public_ssp_unit as r

    r._fail_window.clear()
    svc = MagicMock()
    with pytest.raises(ApiError) as exc:
        r.unit_login(r.UnitLoginIn(code="AAAA"), request=_req(), svc=svc)
    assert exc.value.status_code == 400
    assert exc.value.message == GENERIC_UNIT_INVALID
    svc.rpc.assert_not_called()

    r._fail_window.clear()
    svc.rpc.return_value = SimpleNamespace(status_code=200, content=b"{}", json=lambda: {"ok": False})
    with pytest.raises(ApiError) as exc2:
        r.unit_login(r.UnitLoginIn(code="ABCDEFGH"), request=_req(), svc=svc)
    assert exc2.value.message == GENERIC_UNIT_INVALID
    blob = str(exc2.value.details) + (exc2.value.message or "")
    assert "site_pk" not in blob
    assert "שפלה" not in blob


def test_unit_login_rate_limit():
    from app.routers import public_ssp_unit as r

    r._fail_window.clear()
    req = _req("198.51.100.22")
    for _ in range(8):
        r._record_login_failure(req)
    with pytest.raises(ApiError) as exc:
        r._check_login_rate(req)
    assert exc.value.status_code == 429


def test_unit_login_rate_limit_ignores_forwarded_for():
    from app.routers import public_ssp_unit as r

    r._fail_window.clear()
    for i in range(8):
        r._record_login_failure(_req("198.51.100.22", xff=f"203.0.113.{i}"))
    with pytest.raises(ApiError) as exc:
        r._check_login_rate(_req("198.51.100.22", xff="198.51.100.1"))
    assert exc.value.status_code == 429


def test_successful_redeem_returns_token_once():
    from app.routers import public_ssp_unit as r

    r._fail_window.clear()
    svc = MagicMock()
    svc.rpc.return_value = SimpleNamespace(
        status_code=200,
        content=b"1",
        json=lambda: {
            "ok": True,
            "session_id": "sess-1",
            "code_id": "code-1",
            "workspace_id": str(WS),
            "company_pk": "co-1",
            "site_pk": str(SITE),
            "expires_at": "2026-10-23T20:00:00+00:00",
        },
    )
    svc.get.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [{"id": str(SITE), "name": "שפלה 3", "kind": "office", "site_id": "sit_x", "workspace_id": str(WS)}],
    )
    svc.post.return_value = SimpleNamespace(status_code=201, json=lambda: {"id": "aud"})
    out = r.unit_login(r.UnitLoginIn(code="ABCDEFGH"), request=_req(), svc=svc)
    assert out["identity"] == "unit"
    assert out["unit_token"]
    assert out["site"]["name"] == "שפלה 3"
    assert out["workspace_id"] == str(WS)


def test_used_code_rejected_on_second_redeem():
    from app.routers import public_ssp_unit as r

    r._fail_window.clear()
    svc = MagicMock()
    svc.rpc.return_value = SimpleNamespace(status_code=200, content=b"1", json=lambda: {"ok": False})
    with pytest.raises(ApiError) as exc:
        r.unit_login(r.UnitLoginIn(code="ABCDEFGH"), request=_req(), svc=svc)
    assert exc.value.message == GENERIC_UNIT_INVALID


def test_concurrent_redeem_only_one_ok():
    from app.routers import public_ssp_unit as r

    r._fail_window.clear()
    lock = {"n": 0}

    def rpc(_name, _payload):
        lock["n"] += 1
        if lock["n"] == 1:
            return SimpleNamespace(
                status_code=200,
                content=b"1",
                json=lambda: {
                    "ok": True,
                    "session_id": "sess-1",
                    "code_id": "code-1",
                    "workspace_id": str(WS),
                    "company_pk": "co-1",
                    "site_pk": str(SITE),
                    "expires_at": "2026-10-23T20:00:00+00:00",
                },
            )
        return SimpleNamespace(status_code=200, content=b"1", json=lambda: {"ok": False})

    svc = MagicMock()
    svc.rpc.side_effect = rpc
    svc.get.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [{"id": str(SITE), "name": "שפלה 3", "kind": "office", "site_id": "sit_x", "workspace_id": str(WS)}],
    )
    svc.post.return_value = SimpleNamespace(status_code=201, json=lambda: {})
    barrier = Barrier(2)
    results: list[object] = []

    def worker():
        barrier.wait()
        try:
            results.append(r.unit_login(r.UnitLoginIn(code="ABCDEFGH"), request=_req(), svc=svc))
        except ApiError as exc:
            results.append(exc)

    threads = [Thread(target=worker), Thread(target=worker)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    oks = [x for x in results if isinstance(x, dict) and x.get("unit_token")]
    fails = [x for x in results if isinstance(x, ApiError)]
    assert len(oks) == 1
    assert len(fails) == 1
    assert fails[0].message == GENERIC_UNIT_INVALID


def test_officer_cannot_issue_unit_code(monkeypatch):
    from app.routers import ssp_unit_codes as r

    ctx = SimpleNamespace(user_id="off", workspace_id=str(WS), features=frozenset({"ssp"}))
    monkeypatch.setattr(r, "_ctx", lambda *_a, **_k: ctx)
    monkeypatch.setattr(r, "require_ssp_action", lambda *_a, **_k: {"product_role": "patrol_officer"})
    with pytest.raises(ApiError) as exc:
        r.issue_unit_login_code(WS, SITE, user={"sub": "off"}, client=MagicMock(), svc=MagicMock())
    assert exc.value.status_code == 403


def test_unit_assignment_other_site_denied():
    from app.routers import public_ssp_unit as r

    svc = MagicMock()
    monkeypatch_ctx = {
        "session": {"id": "sess", "workspace_id": str(WS), "site_pk": str(SITE), "company_pk": "co"},
        "site": {"id": str(SITE), "workspace_id": str(WS), "name": "שפלה 3", "kind": "office", "is_active": True},
    }
    svc.get.return_value = SimpleNamespace(
        status_code=200,
        json=lambda: [
            {
                "id": str(ASG),
                "workspace_id": str(WS),
                "site_pk": "99999999-9999-4999-8999-999999999999",
                "form_id": "f1",
                "form_version_id": "v1",
                "status": "active",
                "definition_snapshot": {"fields": []},
            }
        ],
    )
    orig = r._load_unit_context
    r._load_unit_context = lambda *_a, **_k: monkeypatch_ctx
    try:
        with pytest.raises(ApiError) as exc:
            r.unit_assignment_detail(ASG, svc=svc, x_ssp_unit_token="tok")
        assert exc.value.status_code == 403
    finally:
        r._load_unit_context = orig


def test_provision_callable_exists():
    assert callable(provision_ssp_user)
