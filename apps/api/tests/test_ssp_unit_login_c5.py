"""Live unit-code login against Local Supabase only (loopback:54321 / db:54322)."""

from __future__ import annotations

import hashlib
import socket
import threading
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.ssp_c5_local import assert_local_supabase_url, require_c5_local_process_env
from tests.test_ssp_c5_e2e_connection import (
    _auth,
    _classify,
    _create_local_user,
    _enable_ssp,
    _password_grant,
    _snippet,
)

pytestmark = [pytest.mark.c5_local, pytest.mark.c5_write]

LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
GENERIC = "קוד היחידה אינו תקף"


def _sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _require_local_db() -> None:
    socket.create_connection(("127.0.0.1", 54322), timeout=3).close()


def _pg():
    import psycopg

    return psycopg.connect(LOCAL_DB, autocommit=True)


def test_ssp_unit_login_live_local():
    host = require_c5_local_process_env()
    from app.config import get_settings
    from app.main import create_app
    from app.routers import public_ssp_unit as unit_router

    get_settings.cache_clear()
    settings = get_settings()
    classified = _classify(settings.supabase_url)
    assert classified["host_class"] == "local", classified
    assert classified["port"] == 54321, classified
    assert host == classified["host"]
    assert_local_supabase_url(settings.supabase_url)
    _require_local_db()

    api = TestClient(create_app())
    marker = uuid.uuid4().hex[:10]
    password = f"SspUnit-{marker}-9x"
    owner_email = f"ssp-unit-owner-{marker}@sitesecure.test"
    provision_email = f"ssp-unit-prov-{marker}@sitesecure.test"

    _create_local_user(settings, owner_email, password)
    owner_tok = _password_grant(settings, owner_email, password)

    ws = api.post("/api/v1/workspaces", headers=_auth(owner_tok), json={"name": f"SSP UNIT {marker}"})
    assert ws.status_code in {200, 201}, _snippet(ws)
    ws_id = str(ws.json()["id"])
    _enable_ssp(settings, ws_id)

    boot = api.post(
        f"/api/v1/workspaces/{ws_id}/ssp/org/bootstrap",
        headers=_auth(owner_tok),
        json={"name": f"חברת יחידה {marker}"},
    )
    assert boot.status_code in {200, 201, 409}, _snippet(boot)

    office_a = api.post(
        f"/api/v1/workspaces/{ws_id}/ssp/sites",
        headers=_auth(owner_tok),
        json={"name": f"שפלה {marker}", "kind": "office"},
    )
    assert office_a.status_code in {200, 201}, _snippet(office_a)
    site_a = str(office_a.json()["id"])

    office_b = api.post(
        f"/api/v1/workspaces/{ws_id}/ssp/sites",
        headers=_auth(owner_tok),
        json={"name": f"משרד {marker}", "kind": "office"},
    )
    assert office_b.status_code in {200, 201}, _snippet(office_b)
    site_b = str(office_b.json()["id"])

    # G1 email+password already proved by owner_tok grant + session.
    session = api.get("/api/v1/auth/session", headers=_auth(owner_tok))
    assert session.status_code == 200, _snippet(session)

    # G2 manager-provisioned user can password-login.
    created = api.post(
        f"/api/v1/workspaces/{ws_id}/ssp/users",
        headers=_auth(owner_tok),
        json={
            "full_name": f"קצין {marker}",
            "email": provision_email,
            "password": password,
            "product_role": "patrol_officer",
            "site_id": site_a,
        },
    )
    assert created.status_code == 201, _snippet(created)
    assert created.json().get("created_auth") is True or created.json().get("user_id")
    prov_tok = _password_grant(settings, provision_email, password)
    assert prov_tok

    # G3 issue code for authorized office.
    issued = api.post(
        f"/api/v1/workspaces/{ws_id}/ssp/sites/{site_a}/unit-login-codes",
        headers=_auth(owner_tok),
        json={},
    )
    assert issued.status_code == 201, _snippet(issued)
    code = (issued.json().get("code") or "").replace("-", "")
    assert len(code) == 8
    shown = api.get(
        f"/api/v1/workspaces/{ws_id}/ssp/sites/{site_a}/unit-login-code",
        headers=_auth(owner_tok),
    )
    assert shown.status_code == 200, _snippet(shown)
    assert (shown.json().get("code") or "").replace("-", "") == code

    officer_issue = api.post(
        f"/api/v1/workspaces/{ws_id}/ssp/sites/{site_a}/unit-login-codes",
        headers=_auth(prov_tok),
        json={},
    )
    assert officer_issue.status_code == 403, _snippet(officer_issue)

    # G4 redeem once.
    unit_router._fail_window.clear()
    login = api.post("/api/v1/public/ssp/unit-login", json={"code": code})
    assert login.status_code == 200, _snippet(login)
    body = login.json()
    token = body["unit_token"]
    assert body["identity"] == "unit"
    assert body["site"]["id"] == site_a
    me = api.get("/api/v1/public/ssp/unit/me", headers={"X-SSP-Unit-Token": token})
    assert me.status_code == 200, _snippet(me)
    assert me.json()["site"]["id"] == site_a

    # G6 used code rejected; no second session.
    again = api.post("/api/v1/public/ssp/unit-login", json={"code": code})
    assert again.status_code == 400
    assert again.json()["error"]["message"] == GENERIC

    admin = api.get("/api/v1/auth/session", headers={"Authorization": f"Bearer {token}"})
    assert admin.status_code in {401, 403}
    other_forms = api.get("/api/v1/public/ssp/unit/forms", headers={"X-SSP-Unit-Token": token})
    assert other_forms.status_code == 200
    users = api.get(
        f"/api/v1/workspaces/{ws_id}/ssp/users",
        headers={"X-SSP-Unit-Token": token, "Authorization": f"Bearer {token}"},
    )
    assert users.status_code in {401, 403}

    # G7 revoke.
    issued2 = api.post(
        f"/api/v1/workspaces/{ws_id}/ssp/sites/{site_a}/unit-login-codes",
        headers=_auth(owner_tok),
        json={},
    )
    assert issued2.status_code == 201, _snippet(issued2)
    code2 = (issued2.json().get("code") or "").replace("-", "")
    code_id = issued2.json().get("id")
    revoked = api.post(
        f"/api/v1/workspaces/{ws_id}/ssp/unit-login-codes/{code_id}/revoke",
        headers=_auth(owner_tok),
    )
    assert revoked.status_code == 200, _snippet(revoked)
    bad_revoked = api.post("/api/v1/public/ssp/unit-login", json={"code": code2})
    assert bad_revoked.status_code == 400
    assert bad_revoked.json()["error"]["message"] == GENERIC

    # G5 expired.
    issued3 = api.post(
        f"/api/v1/workspaces/{ws_id}/ssp/sites/{site_a}/unit-login-codes",
        headers=_auth(owner_tok),
        json={},
    )
    assert issued3.status_code == 201, _snippet(issued3)
    code3 = (issued3.json().get("code") or "").replace("-", "")
    with _pg() as conn:
        conn.execute(
            "update public.ssp_unit_login_codes set expires_at = %s where id = %s",
            (datetime.now(UTC) - timedelta(seconds=5), issued3.json()["id"]),
        )
    expired = api.post("/api/v1/public/ssp/unit-login", json={"code": code3})
    assert expired.status_code == 400
    assert expired.json()["error"]["message"] == GENERIC

    # G8 other-office assignment is denied for this session.
    form_res = api.post(
        f"/api/v1/workspaces/{ws_id}/ssp/forms",
        headers=_auth(owner_tok),
        json={"title": f"שאלון {marker}", "description": "", "category": "personal_questionnaire"},
    )
    assert form_res.status_code in {200, 201}, _snippet(form_res)
    form_id = form_res.json()["id"]
    field_id = str(uuid.uuid4())
    put_def = api.put(
        f"/api/v1/workspaces/{ws_id}/ssp/forms/{form_id}/definition",
        headers=_auth(owner_tok),
        json={"definition": {"fields": [{"id": field_id, "type": "short_text", "label": "שם", "required": True}]}},
    )
    assert put_def.status_code == 200, _snippet(put_def)
    published = api.post(
        f"/api/v1/workspaces/{ws_id}/ssp/forms/{form_id}/publish",
        headers=_auth(owner_tok),
    )
    assert published.status_code == 200, _snippet(published)
    assigned_b = api.post(
        f"/api/v1/workspaces/{ws_id}/ssp/site-assignments",
        headers=_auth(owner_tok),
        json={"form_id": form_id, "site_ids": [site_b], "filler_mode": "site"},
    )
    assert assigned_b.status_code in {200, 201}, _snippet(assigned_b)
    items_b = (assigned_b.json() or {}).get("items") or []
    assert items_b, assigned_b.json()
    asg_b = str(items_b[0]["id"])
    scoped = api.get(
        f"/api/v1/public/ssp/unit/assignments/{asg_b}",
        headers={"X-SSP-Unit-Token": token},
    )
    assert scoped.status_code == 403, _snippet(scoped)

    # G9 concurrent redeem: only one ok.
    issued4 = api.post(
        f"/api/v1/workspaces/{ws_id}/ssp/sites/{site_b}/unit-login-codes",
        headers=_auth(owner_tok),
        json={},
    )
    assert issued4.status_code == 201, _snippet(issued4)
    code4 = (issued4.json().get("code") or "").replace("-", "")
    token_hash_a = _sha("tok-a-" + marker)
    token_hash_b = _sha("tok-b-" + marker)
    code_hash = _sha(code4)
    expires = datetime.now(UTC) + timedelta(hours=8)
    results: list[Any] = [None, None]

    def _redeem(idx: int, token_hash: str) -> None:
        with _pg() as conn:
            row = conn.execute(
                "select public.ssp_redeem_unit_login_code(%s, %s, %s)",
                (code_hash, token_hash, expires),
            ).fetchone()
            payload = row[0] if row else None
            if isinstance(payload, str):
                import json

                payload = json.loads(payload)
            results[idx] = payload

    threads = [
        threading.Thread(target=_redeem, args=(0, token_hash_a)),
        threading.Thread(target=_redeem, args=(1, token_hash_b)),
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    oks = [r for r in results if isinstance(r, dict) and r.get("ok")]
    fails = [r for r in results if not (isinstance(r, dict) and r.get("ok"))]
    assert len(oks) == 1, results
    assert len(fails) == 1, results

    # G12 revoke session then 401.
    stop = api.post(
        f"/api/v1/workspaces/{ws_id}/ssp/sites/{site_a}/unit-sessions/revoke",
        headers=_auth(owner_tok),
        json={},
    )
    assert stop.status_code == 200, _snippet(stop)
    dead = api.get("/api/v1/public/ssp/unit/me", headers={"X-SSP-Unit-Token": token})
    assert dead.status_code == 401

    # G10 / G13 rate limit after uniform failures.
    unit_router._fail_window.clear()
    limited_status = 0
    for i in range(12):
        res = api.post("/api/v1/public/ssp/unit-login", json={"code": "AAAAAAAA"})
        limited_status = res.status_code
        if res.status_code == 429:
            break
    assert limited_status == 429
    unit_router._fail_window.clear()
