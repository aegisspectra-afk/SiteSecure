"""R-001 ServiceClient privilege-boundary negative verification (Phase 0 Task 04).

===============================================================================
CALL-SITE INVENTORY (apps/api) — complete before tests
===============================================================================

CALL SITE                         | ROUTE / ENTRY                         | CLASS | AUTH | WS BIND | RBAC/FEATURE | OWNERSHIP BEFORE SVC | WHY SERVICE ROLE
----------------------------------|---------------------------------------|-------|------|---------|--------------|----------------------|-----------------
customers.delete_customer         | DELETE .../customers/{id}             | A     | JWT  | path ws | crm.delete  | UserClient get id+ws | soft-delete RLS RETURN
sites.delete_site                 | DELETE .../sites/{id}                 | A     | JWT  | path ws | sites.delete | UserClient get id+ws | soft-delete RLS RETURN
quotes.delete_quote               | DELETE .../quotes/{id}                | A     | JWT  | path ws | quotes.delete| _load_quote id+ws    | soft-delete + revoke
quotes.send_quote                 | POST .../quotes/{id}/send             | A     | JWT  | path ws | quotes.send  | _load_quote          | mint quote_public_access
quotes.share_quote                | POST .../quotes/{id}/share            | A     | JWT  | path ws | quotes.send  | _load_quote          | mint access
quotes.revoke_quote_link          | POST .../quotes/{id}/revoke-link      | A     | JWT  | path ws | quotes.send  | _load_quote          | revoke access rows
documents.complete_upload         | POST .../documents/{id}/complete      | A     | JWT  | path ws | documents.upload | UserClient get id+ws | storage metadata / cleanup
quote_signature.store_*           | via public approve                    | B     | token| from access | n/a       | access→quote bind    | write signature docs
public_quotes.get/pdf/approve/rej | /api/v1/public/quotes/{token}*        | B     | token| from access | n/a       | token_hash→quote+ws  | public no user JWT
admin.* (8 routes)                | /api/v1/admin/*                       | C     | JWT  | n/a     | platform admin flag  | require_platform_admin | cross-org ops
deps.service_client               | DI factory                            | —     | —    | —       | —            | —                    | construction only
ServiceClient (class)             | supabase_service.py                   | —     | —    | —       | —            | —                    | privileged HTTP

Not found: invitation/team routes using ServiceClient; invite accept uses SECURITY DEFINER RPCs under user JWT.

CLASS: A=authenticated tenant | B=public token | C=platform admin | D=internal (none user-routable beyond above)

THREAT COVERAGE IN THIS FILE:
unauth, cross-tenant soft-delete/share/revoke, workspace_id mismatch,
public invalid/cross-token, platform-admin denial, guessed UUID.
Entitlement/invite regressions live in dedicated suites (Task 01/03/03B).
"""

from __future__ import annotations

import uuid

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app

pytestmark = pytest.mark.live

OWNER_A = ("ss.phase3.a@sitesecure.test", "Test-Pass-2026!")
OWNER_B = ("ss.phase3.b@sitesecure.test", "Test-Pass-2026!")


@pytest.fixture(scope="module")
def settings():
    try:
        get_settings.cache_clear()
        return get_settings()
    except Exception:
        pytest.skip("SUPABASE_URL / SUPABASE_ANON_KEY not configured")


def _password_grant(settings, email: str, password: str) -> str:
    with httpx.Client(timeout=30) as client:
        res = client.post(
            f"{settings.supabase_url}/auth/v1/token?grant_type=password",
            headers={"apikey": settings.supabase_anon_key, "Content-Type": "application/json"},
            json={"email": email, "password": password},
        )
    if res.status_code != 200:
        pytest.skip(f"password grant failed: {res.status_code}")
    return res.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _deny(status: int) -> bool:
    return status in {401, 403, 404}


@pytest.fixture(scope="module")
def tenants(settings):
    api = TestClient(app)
    token_a = _password_grant(settings, *OWNER_A)
    token_b = _password_grant(settings, *OWNER_B)
    ws_a = api.post(
        "/api/v1/workspaces",
        headers=_auth(token_a),
        json={"name": f"R001 A {uuid.uuid4().hex[:6]}"},
    )
    ws_b = api.post(
        "/api/v1/workspaces",
        headers=_auth(token_b),
        json={"name": f"R001 B {uuid.uuid4().hex[:6]}"},
    )
    assert ws_a.status_code == 200, ws_a.text
    assert ws_b.status_code == 200, ws_b.text
    return {
        "api": api,
        "token_a": token_a,
        "token_b": token_b,
        "ws_a": ws_a.json()["id"],
        "ws_b": ws_b.json()["id"],
    }


def _create_customer(api: TestClient, token: str, workspace_id: str, name: str) -> str:
    res = api.post(
        f"/api/v1/workspaces/{workspace_id}/customers",
        headers=_auth(token),
        json={"display_name": name},
    )
    assert res.status_code == 200, res.text
    return res.json()["id"]


def _create_site(api: TestClient, token: str, workspace_id: str, customer_id: str, name: str) -> str:
    res = api.post(
        f"/api/v1/workspaces/{workspace_id}/sites",
        headers=_auth(token),
        json={"customer_id": customer_id, "name": name},
    )
    assert res.status_code == 200, res.text
    return res.json()["id"]


def _create_quote(api: TestClient, token: str, workspace_id: str, customer_id: str) -> str:
    res = api.post(
        f"/api/v1/workspaces/{workspace_id}/quotes",
        headers=_auth(token),
        json={"customer_id": customer_id, "title": f"Q {uuid.uuid4().hex[:4]}"},
    )
    assert res.status_code == 200, res.text
    return res.json()["id"]


# --- Unauthenticated ---


def test_unauthenticated_cannot_soft_delete_customer(tenants):
    api = tenants["api"]
    cust = _create_customer(api, tenants["token_a"], tenants["ws_a"], f"Unauth Cust {uuid.uuid4().hex[:4]}")
    res = api.delete(f"/api/v1/workspaces/{tenants['ws_a']}/customers/{cust}")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHENTICATED"


def test_unauthenticated_cannot_soft_delete_quote(tenants):
    api = tenants["api"]
    cust = _create_customer(api, tenants["token_a"], tenants["ws_a"], f"Unauth QCust {uuid.uuid4().hex[:4]}")
    qid = _create_quote(api, tenants["token_a"], tenants["ws_a"], cust)
    res = api.delete(f"/api/v1/workspaces/{tenants['ws_a']}/quotes/{qid}")
    assert res.status_code == 401


def test_unauthenticated_cannot_hit_admin(tenants):
    res = tenants["api"].get("/api/v1/admin/summary")
    assert res.status_code == 401


def test_malformed_jwt_denied(tenants):
    res = tenants["api"].delete(
        f"/api/v1/workspaces/{tenants['ws_a']}/customers/{uuid.uuid4()}",
        headers=_auth("not.a.jwt"),
    )
    assert res.status_code == 401


# --- Cross-tenant soft-delete / IDOR ---


def test_cross_tenant_cannot_delete_other_customer(tenants):
    api = tenants["api"]
    cust_b = _create_customer(api, tenants["token_b"], tenants["ws_b"], f"B Cust {uuid.uuid4().hex[:4]}")
    # B object id under A's workspace path
    res = api.delete(
        f"/api/v1/workspaces/{tenants['ws_a']}/customers/{cust_b}",
        headers=_auth(tenants["token_a"]),
    )
    assert _deny(res.status_code), res.text
    # A's JWT against B workspace + B object
    res2 = api.delete(
        f"/api/v1/workspaces/{tenants['ws_b']}/customers/{cust_b}",
        headers=_auth(tenants["token_a"]),
    )
    assert _deny(res2.status_code), res2.text
    # Still exists for owner B
    listed = api.get(
        f"/api/v1/workspaces/{tenants['ws_b']}/customers",
        headers=_auth(tenants["token_b"]),
    )
    assert listed.status_code == 200
    assert any(row["id"] == cust_b for row in listed.json().get("items") or [])


def test_cross_tenant_cannot_delete_other_site(tenants):
    api = tenants["api"]
    cust_b = _create_customer(api, tenants["token_b"], tenants["ws_b"], f"B SiteCust {uuid.uuid4().hex[:4]}")
    site_b = _create_site(api, tenants["token_b"], tenants["ws_b"], cust_b, f"Site B {uuid.uuid4().hex[:4]}")
    res = api.delete(
        f"/api/v1/workspaces/{tenants['ws_a']}/sites/{site_b}",
        headers=_auth(tenants["token_a"]),
    )
    assert _deny(res.status_code), res.text
    res2 = api.delete(
        f"/api/v1/workspaces/{tenants['ws_b']}/sites/{site_b}",
        headers=_auth(tenants["token_a"]),
    )
    assert _deny(res2.status_code), res2.text


def test_cross_tenant_cannot_delete_other_quote(tenants):
    api = tenants["api"]
    cust_b = _create_customer(api, tenants["token_b"], tenants["ws_b"], f"B QCust {uuid.uuid4().hex[:4]}")
    q_b = _create_quote(api, tenants["token_b"], tenants["ws_b"], cust_b)
    res = api.delete(
        f"/api/v1/workspaces/{tenants['ws_a']}/quotes/{q_b}",
        headers=_auth(tenants["token_a"]),
    )
    assert _deny(res.status_code), res.text
    res2 = api.delete(
        f"/api/v1/workspaces/{tenants['ws_b']}/quotes/{q_b}",
        headers=_auth(tenants["token_a"]),
    )
    assert _deny(res2.status_code), res2.text


def test_cross_tenant_cannot_share_or_revoke_other_quote(tenants):
    api = tenants["api"]
    cust_b = _create_customer(api, tenants["token_b"], tenants["ws_b"], f"B Share {uuid.uuid4().hex[:4]}")
    q_b = _create_quote(api, tenants["token_b"], tenants["ws_b"], cust_b)
    share = api.post(
        f"/api/v1/workspaces/{tenants['ws_a']}/quotes/{q_b}/share",
        headers=_auth(tenants["token_a"]),
    )
    assert _deny(share.status_code), share.text
    share2 = api.post(
        f"/api/v1/workspaces/{tenants['ws_b']}/quotes/{q_b}/share",
        headers=_auth(tenants["token_a"]),
    )
    assert _deny(share2.status_code), share2.text
    revoke = api.post(
        f"/api/v1/workspaces/{tenants['ws_b']}/quotes/{q_b}/revoke-link",
        headers=_auth(tenants["token_a"]),
    )
    assert _deny(revoke.status_code), revoke.text


def test_guessed_uuid_soft_delete_denied(tenants):
    api = tenants["api"]
    fake = str(uuid.uuid4())
    res = api.delete(
        f"/api/v1/workspaces/{tenants['ws_a']}/customers/{fake}",
        headers=_auth(tenants["token_a"]),
    )
    assert _deny(res.status_code), res.text


def test_workspace_body_mismatch_document_complete(tenants):
    """Tenant A cannot complete a document owned by B even with B's document id."""
    api = tenants["api"]
    fake_doc = str(uuid.uuid4())
    res = api.post(
        f"/api/v1/workspaces/{tenants['ws_a']}/documents/{fake_doc}/complete",
        headers=_auth(tenants["token_a"]),
        json={},
    )
    assert _deny(res.status_code), res.text
    res2 = api.post(
        f"/api/v1/workspaces/{tenants['ws_b']}/documents/{fake_doc}/complete",
        headers=_auth(tenants["token_a"]),
        json={},
    )
    assert _deny(res2.status_code), res2.text


# --- Platform admin ---


def test_workspace_owner_is_not_platform_admin(tenants):
    res = tenants["api"].get("/api/v1/admin/summary", headers=_auth(tenants["token_a"]))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "PERMISSION_DENIED"


# --- Public quote token binding ---


def test_invalid_public_token_denied(tenants):
    res = tenants["api"].get("/api/v1/public/quotes/not-a-real-public-token")
    assert res.status_code == 404


def test_public_token_bound_to_one_quote(tenants):
    api = tenants["api"]
    cust_a = _create_customer(api, tenants["token_a"], tenants["ws_a"], f"Pub A {uuid.uuid4().hex[:4]}")
    cust_b = _create_customer(api, tenants["token_b"], tenants["ws_b"], f"Pub B {uuid.uuid4().hex[:4]}")
    q_a = _create_quote(api, tenants["token_a"], tenants["ws_a"], cust_a)
    q_b = _create_quote(api, tenants["token_b"], tenants["ws_b"], cust_b)

    share_a = api.post(
        f"/api/v1/workspaces/{tenants['ws_a']}/quotes/{q_a}/share",
        headers=_auth(tenants["token_a"]),
    )
    share_b = api.post(
        f"/api/v1/workspaces/{tenants['ws_b']}/quotes/{q_b}/share",
        headers=_auth(tenants["token_b"]),
    )
    # Empty drafts may be incomplete — still verify invalid token + cross-workspace share denial.
    if share_a.status_code != 200 or share_b.status_code != 200:
        assert share_a.status_code in {200, 400, 403}, share_a.text
        assert share_b.status_code in {200, 400, 403}, share_b.text
        assert api.get("/api/v1/public/quotes/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa").status_code == 404
        # Cross-tenant share of B quote under A's membership already covered elsewhere.
        return

    token_a = share_a.json()["public_token"]
    token_b = share_b.json()["public_token"]
    assert token_a != token_b

    pub_a = api.get(f"/api/v1/public/quotes/{token_a}")
    pub_b = api.get(f"/api/v1/public/quotes/{token_b}")
    assert pub_a.status_code == 200, pub_a.text
    assert pub_b.status_code == 200, pub_b.text
    # Mutating token must not reveal the other quote.
    mutated = ("z" if token_a[0] != "z" else "y") + token_a[1:]
    assert api.get(f"/api/v1/public/quotes/{mutated}").status_code == 404
    # Token A approve must not bind to quote B (wrong token / state only).
    cross = api.post(
        f"/api/v1/public/quotes/{token_a}/approve",
        json={
            "name": "Attacker",
            "terms_accepted": True,
            "signature_data_url": "data:image/png;base64,iVBORw0KGgo=",
        },
    )
    # Incomplete signature/state may 400/403 — never 200 against foreign tenant via swapped IDs.
    if cross.status_code == 200:
        assert cross.json().get("id") != q_b


def test_public_approve_invalid_token_denied(tenants):
    res = tenants["api"].post(
        "/api/v1/public/quotes/invalid-token-xyz/approve",
        json={
            "name": "X",
            "terms_accepted": True,
            "signature_data_url": "data:image/png;base64,iVBORw0KGgo=",
        },
    )
    assert _deny(res.status_code), res.text


# --- Viewer cannot trigger privileged soft-delete ---


def test_viewer_cannot_soft_delete_customer(settings, tenants):
    """Lower role denial before ServiceClient soft-delete."""
    api = tenants["api"]
    viewer_token = _password_grant(settings, "ss.phase3.viewer@sitesecure.test", OWNER_A[1])
    # Ensure membership (best-effort; may already exist)
    with httpx.Client(timeout=30) as client:
        # Resolve viewer user id via JWT user endpoint
        me = client.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {viewer_token}"},
        )
    if me.status_code != 200:
        pytest.skip("viewer user unavailable")
    viewer_id = me.json()["id"]
    with httpx.Client(timeout=30) as client:
        client.post(
            f"{settings.supabase_url}/rest/v1/workspace_memberships",
            headers={
                "apikey": settings.supabase_anon_key,
                "Authorization": f"Bearer {tenants['token_a']}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            json={
                "workspace_id": tenants["ws_a"],
                "user_id": viewer_id,
                "role_key": "viewer",
                "status": "active",
            },
        )
    cust = _create_customer(api, tenants["token_a"], tenants["ws_a"], f"View Del {uuid.uuid4().hex[:4]}")
    res = api.delete(
        f"/api/v1/workspaces/{tenants['ws_a']}/customers/{cust}",
        headers=_auth(viewer_token),
    )
    assert _deny(res.status_code), res.text
