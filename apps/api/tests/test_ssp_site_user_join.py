"""User-office join: SQL contract + in-process rate/authz (no live DB)."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

import pytest

from app.errors import ApiError
from app.ssp.activation_codes import hash_activation_code

ROOT = Path(__file__).resolve().parents[3]
JOIN_SQL = ROOT / "supabase" / "migrations" / "20261020160000_ssp_site_user_join.sql"
WS = UUID("11111111-1111-4111-8111-111111111111")
USER = UUID("33333333-3333-4333-8333-333333333333")


def test_join_migration_extends_activation_not_parallel_users():
    text = JOIN_SQL.read_text(encoding="utf-8")
    assert "ssp_sites" in text
    assert "kind" in text
    assert "audience" in text
    assert "requested_user_id" in text
    assert "invited_role" in text
    assert "ssp_request_site_user_join" in text
    assert "ssp_approve_site_user_join" in text
    assert "ssp_site_members" in text
    assert "ssp_memberships" in text
    assert "ON CONFLICT (company_pk, user_id) DO NOTHING" in text
    assert "org_admin" not in text.split("invited_role")[-1][:400] or "patrol_officer" in text
    assert "CREATE TABLE IF NOT EXISTS public.profiles" not in text
    assert "CREATE TABLE IF NOT EXISTS public.users" not in text
    assert "code_plaintext" not in text.lower()
    assert "SET search_path = public, pg_temp" in text
    assert "REVOKE ALL ON FUNCTION public.ssp_request_site_user_join" in text
    assert "GRANT EXECUTE ON FUNCTION public.ssp_request_site_user_join" in text
    assert "TO service_role" in text
    assert "COALESCE(c.audience, 'device') <> 'device'" in text
    assert "COALESCE(c.audience, 'device') <> 'user'" in text
    assert "role_key NOT IN ('patrol_officer', 'patrol_manager')" in text
    assert "CREATE TABLE IF NOT EXISTS public.sites" not in text
    assert "fleet" not in text.lower()
    assert "DROP TABLE" not in text


def test_join_sql_does_not_grant_secret_columns():
    text = JOIN_SQL.read_text(encoding="utf-8")
    assert "code_hash" not in text.split("GRANT SELECT")[1].split("TO authenticated")[0] if "GRANT SELECT" in text else True
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


def test_join_rate_limit(monkeypatch):
    from app.routers import ssp_site_activation as r

    r._join_fail_window.clear()
    uid = str(USER)
    for _ in range(8):
        r._record_join_failure(uid)
    with pytest.raises(ApiError) as exc:
        r._check_join_rate(uid)
    assert exc.value.status_code == 429
    r._join_fail_window.clear()
    r._check_join_rate(str(WS))


def test_join_invalid_code_is_uniform(monkeypatch):
    from app.routers import ssp_site_activation as r
    from app.ssp import product_authz

    r._join_fail_window.clear()
    ctx = SimpleNamespace(user_id=str(USER), workspace_id=str(WS), features=["ssp"])
    client = MagicMock()
    svc = MagicMock()
    monkeypatch.setattr(r, "_ctx", lambda *_a, **_k: ctx)
    monkeypatch.setattr(product_authz, "feature_gate", lambda *_a, **_k: None)

    with pytest.raises(ApiError) as exc:
        r.request_site_user_join(WS, r.UserJoinIn(code="AAAA"), {"id": str(USER)}, client, svc)
    assert exc.value.status_code == 400
    assert "שפלה" not in (exc.value.message or "")
    digest = hash_activation_code("ABCDEFGH")
    assert len(digest) == 64
    assert digest != "ABCDEFGH"
