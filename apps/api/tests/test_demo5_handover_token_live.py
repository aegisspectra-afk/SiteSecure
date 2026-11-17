"""DEMO-5 §4.18–20: public handover token security (LOCAL).

Wrong / expired / revoked tokens all return the same 404 NOT_FOUND (no existence leak).
Public handover endpoints are rate-limited (covers /h/{token} → API).
Without _load_access uniformity or rate limiting these tests fail.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.quote_tokens import hash_public_token, new_public_token
from app.routers import public_handover as pub
from tests.test_d1_dashboard_live import _owner_workspace, _svc, _svc_insert
from tests.test_ssp_c5_e2e_connection import _snippet

pytestmark = pytest.mark.live


@pytest.fixture(scope="module")
def env():
    get_settings.cache_clear()
    s = get_settings()
    assert urlparse(s.supabase_url).hostname in {"127.0.0.1", "localhost"}
    api = TestClient(app)
    _, ws = _owner_workspace(s, api, "d5-tok")
    cust = _svc_insert(s, "customers", {"workspace_id": ws, "display_name": "לקוח מסירה"})["id"]
    site = _svc_insert(s, "sites", {"workspace_id": ws, "customer_id": cust, "code": "HT1", "name": "אתר"})["id"]
    job = _svc_insert(
        s,
        "jobs",
        {
            "workspace_id": ws,
            "number": f"J-{uuid.uuid4().hex[:6]}",
            "title": "התקנה",
            "customer_id": cust,
            "site_id": site,
            "status": "completed",
            "completed_at": datetime.now(UTC).isoformat(),
        },
    )["id"]
    return dict(s=s, api=api, ws=ws, job=job)


def _mint_access(env, *, expires_at: datetime, revoked_at: str | None = None) -> str:
    token = new_public_token()
    row = {
        "workspace_id": env["ws"],
        "job_id": env["job"],
        "token_hash": hash_public_token(token),
        "expires_at": expires_at.isoformat(),
    }
    if revoked_at is not None:
        row["revoked_at"] = revoked_at
    _svc_insert(env["s"], "handover_public_access", row)
    return token


def _get(env, token: str):
    return env["api"].get(f"/api/v1/public/handover/{token}")


def _error_shape(res):
    body = res.json()
    err = body.get("error") or {}
    return res.status_code, err.get("code"), err.get("message"), sorted((err.get("details") or {}).keys())


def test_wrong_token_returns_uniform_404(env):
    res = _get(env, new_public_token())
    assert res.status_code == 404, _snippet(res)
    assert _error_shape(res) == (404, "NOT_FOUND", "לא נמצא", [])


def test_expired_token_returns_404_same_as_missing(env):
    past = datetime.now(UTC) - timedelta(days=1)
    token = _mint_access(env, expires_at=past)
    missing = _get(env, new_public_token())
    expired = _get(env, token)
    assert expired.status_code in {404, 410}, _snippet(expired)
    # No leak: same public error shape as a token that never existed.
    assert _error_shape(expired) == _error_shape(missing)


def test_revoked_token_returns_404_same_as_missing(env):
    future = datetime.now(UTC) + timedelta(days=30)
    token = _mint_access(env, expires_at=future, revoked_at=datetime.now(UTC).isoformat())
    missing = _get(env, new_public_token())
    revoked = _get(env, token)
    assert revoked.status_code == 404, _snippet(revoked)
    assert _error_shape(revoked) == _error_shape(missing)


def test_public_handover_rate_limited(env, monkeypatch):
    pub.clear_rate_limit_buckets()
    monkeypatch.setattr(pub, "RATE_LIMIT", 3)
    monkeypatch.setattr(pub, "RATE_WINDOW_SECONDS", 60.0)
    token = new_public_token()
    codes = [_get(env, token).status_code for _ in range(5)]
    assert codes[:3] == [404, 404, 404], codes
    assert codes[3] == 429, codes
    assert codes[4] == 429, codes
    body = env["api"].get(f"/api/v1/public/handover/{token}").json()
    assert body["error"]["code"] == "RATE_LIMITED"
    pub.clear_rate_limit_buckets()
