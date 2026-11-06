"""S2/S1: quote money, lifecycle and version integrity against LOCAL Supabase.

Direct PostgREST calls with a member JWT must not bypass the API (pricing.recalculate,
override/cost permissions, draft-only editing, send/revise rules). HTTP paths must keep
the customer-facing snapshot in sync and refuse revising an approved quote.

Creates its own confirmed users/workspaces on the loopback project; never runs against
a hosted project (skips unless SUPABASE_URL is loopback).
"""

from __future__ import annotations

import base64
import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app

pytestmark = pytest.mark.live

PASSWORD = "Test-Pass-2026!"
OWNER_A = "ss.s2.owner.a@sitesecure.test"
SALES_A = "ss.s2.sales.a@sitesecure.test"
OWNER_B = "ss.s2.owner.b@sitesecure.test"
# 1x1 transparent PNG
SIGNATURE = "data:image/png;base64," + base64.b64encode(
    bytes.fromhex(
        "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
        "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082"
    )
).decode()


@pytest.fixture(scope="module")
def settings():
    get_settings.cache_clear()
    try:
        s = get_settings()
    except Exception:
        pytest.skip("Supabase not configured")
    if urlparse(s.supabase_url).hostname not in {"127.0.0.1", "localhost"}:
        pytest.skip("S2 lockdown suite runs against local Supabase only")
    if not s.supabase_service_role_key:
        pytest.skip("local service role key required to provision test users")
    return s


def _svc_headers(s) -> dict[str, str]:
    key = s.supabase_service_role_key
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def _ensure_user(s, email: str) -> None:
    res = httpx.post(
        f"{s.supabase_url}/auth/v1/admin/users",
        headers=_svc_headers(s),
        json={"email": email, "password": PASSWORD, "email_confirm": True},
        timeout=30,
    )
    assert res.status_code in {200, 201, 422}, res.text


def _token(s, email: str) -> str:
    res = httpx.post(
        f"{s.supabase_url}/auth/v1/token?grant_type=password",
        headers={"apikey": s.supabase_anon_key, "Content-Type": "application/json"},
        json={"email": email, "password": PASSWORD},
        timeout=30,
    )
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _uid(token: str) -> str:
    import json

    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload))["sub"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _rest(s, token: str) -> dict[str, str]:
    return {
        "apikey": s.supabase_anon_key,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


@pytest.fixture(scope="module")
def env(settings):
    s = settings
    for email in (OWNER_A, SALES_A, OWNER_B):
        _ensure_user(s, email)
    owner_a, sales_a, owner_b = (_token(s, e) for e in (OWNER_A, SALES_A, OWNER_B))
    api = TestClient(app)
    ws_a = api.post("/api/v1/workspaces", headers=_auth(owner_a), json={"name": f"S2 A {uuid.uuid4().hex[:6]}"})
    ws_b = api.post("/api/v1/workspaces", headers=_auth(owner_b), json={"name": f"S2 B {uuid.uuid4().hex[:6]}"})
    assert ws_a.status_code == 200, ws_a.text
    assert ws_b.status_code == 200, ws_b.text
    ws_a_id, ws_b_id = ws_a.json()["id"], ws_b.json()["id"]
    member = httpx.post(
        f"{s.supabase_url}/rest/v1/workspace_memberships",
        headers={**_svc_headers(s), "Prefer": "return=minimal"},
        json={"workspace_id": ws_a_id, "user_id": _uid(sales_a), "role_key": "sales", "status": "active"},
        timeout=30,
    )
    assert member.status_code in {201, 204}, member.text
    cust = api.post(
        f"/api/v1/workspaces/{ws_a_id}/customers",
        headers=_auth(owner_a),
        json={"display_name": "לקוח S2"},
    )
    assert cust.status_code == 200, cust.text
    return {
        "s": s,
        "api": api,
        "owner_a": owner_a,
        "sales_a": sales_a,
        "owner_b": owner_b,
        "ws_a": ws_a_id,
        "ws_b": ws_b_id,
        "customer_a": cust.json()["id"],
    }


def _draft(env, token: str, *, price: float = 1000, cost: float | None = None) -> dict:
    api, ws = env["api"], env["ws_a"]
    created = api.post(
        f"/api/v1/workspaces/{ws}/quotes",
        headers=_auth(token),
        json={"customer_id": env["customer_a"], "title": "הצעת S2"},
    )
    assert created.status_code == 200, created.text
    qid = created.json()["id"]
    valid = (datetime.now(UTC) + timedelta(days=30)).date().isoformat()
    patched = api.patch(
        f"/api/v1/workspaces/{ws}/quotes/{qid}",
        headers=_auth(token),
        json={"valid_until": valid, "payment_terms": "שוטף + 30"},
    )
    assert patched.status_code == 200, patched.text
    item = {"description": "מצלמה", "name": "מצלמה", "qty": 1, "unit_price": price}
    if cost is not None:
        item["cost"] = cost
    added = api.post(f"/api/v1/workspaces/{ws}/quotes/{qid}/items", headers=_auth(token), json=item)
    assert added.status_code == 200, added.text
    return added.json()


def _item_id(quote: dict) -> str:
    return quote["items"][0]["id"]


def _send(env, token: str, qid: str) -> dict:
    res = env["api"].post(f"/api/v1/workspaces/{env['ws_a']}/quotes/{qid}/send", headers=_auth(token))
    assert res.status_code == 200, res.text
    return res.json()


def _minimal(s, token: str) -> dict[str, str]:
    return {**_rest(s, token), "Prefer": "return=minimal"}


def _db_row(s, table: str, row_id: str, cols: str) -> dict:
    res = httpx.get(
        f"{s.supabase_url}/rest/v1/{table}?id=eq.{row_id}&select={cols}",
        headers=_svc_headers(s),
        timeout=30,
    )
    assert res.status_code == 200, res.text
    rows = res.json()
    assert rows, f"{table} {row_id} missing"
    return rows[0]


def _db_count(s, table: str, query: str) -> int:
    res = httpx.get(f"{s.supabase_url}/rest/v1/{table}?{query}&select=id", headers=_svc_headers(s), timeout=30)
    assert res.status_code == 200, res.text
    return len(res.json())


def _denied(res: httpx.Response) -> bool:
    """PostgREST refusal: privilege error, RLS check failure, or zero rows affected."""
    if res.status_code in {401, 403}:
        return True
    if res.status_code == 400 and res.json().get("code") in {"42501", "P0001"}:
        return True
    if res.status_code == 200:
        return res.json() == []
    return False


# --- DB: direct PostgREST bypass -------------------------------------------------


def test_member_cannot_execute_apply_rpc_directly(env):
    s = env["s"]
    for token in (env["sales_a"], env["owner_a"]):
        res = httpx.post(
            f"{s.supabase_url}/rest/v1/rpc/system_design_apply_owned",
            headers=_rest(s, token),
            json={
                "p_workspace_id": env["ws_a"],
                "p_quote_id": str(uuid.uuid4()),
                "p_design_id": str(uuid.uuid4()),
                "p_expected_revision": 1,
                "p_actor_id": _uid(token),
                "p_apply_id": str(uuid.uuid4()),
                "p_section_id": None,
                "p_lines": [],
            },
            timeout=30,
        )
        assert res.status_code in {401, 403, 404}, res.text
        assert res.json().get("code") in {"42501", "PGRST202"}, res.text


def test_anon_cannot_execute_apply_rpc(env):
    s = env["s"]
    res = httpx.post(
        f"{s.supabase_url}/rest/v1/rpc/system_design_apply_owned",
        headers={"apikey": s.supabase_anon_key, "Content-Type": "application/json"},
        json={"p_workspace_id": env["ws_a"], "p_quote_id": str(uuid.uuid4())},
        timeout=30,
    )
    assert res.status_code in {401, 403, 404}, res.text


def test_sales_cannot_write_item_cost_or_price_directly(env):
    s = env["s"]
    quote = _draft(env, env["sales_a"])
    item_id = _item_id(quote)
    before = _db_row(s, "quote_items", item_id, "cost,unit_price,line_net")
    for body in ({"cost": 0}, {"unit_price": 1}, {"line_net": 1}):
        httpx.patch(
            f"{s.supabase_url}/rest/v1/quote_items?id=eq.{item_id}",
            headers=_minimal(s, env["sales_a"]),
            json=body,
            timeout=30,
        )
    assert _db_row(s, "quote_items", item_id, "cost,unit_price,line_net") == before


def test_member_cannot_write_quote_totals_or_lifecycle_directly(env):
    s = env["s"]
    quote = _draft(env, env["owner_a"])
    cols = "total_gross,subtotal_net,cost_total,margin_percent,status,version,approved_name,sent_at"
    before = _db_row(s, "quotes", quote["id"], cols)
    for body in (
        {"total_gross": 1},
        {"subtotal_net": 1},
        {"cost_total": 0},
        {"margin_percent": 99},
        {"status": "approved"},
        {"version": 99},
        {"approved_name": "x"},
        {"sent_at": "2026-01-01T00:00:00Z"},
    ):
        httpx.patch(
            f"{s.supabase_url}/rest/v1/quotes?id=eq.{quote['id']}",
            headers=_minimal(s, env["owner_a"]),
            json=body,
            timeout=30,
        )
    assert _db_row(s, "quotes", quote["id"], cols) == before


def test_member_cannot_edit_items_of_sent_quote_directly(env):
    s = env["s"]
    quote = _draft(env, env["owner_a"])
    _send(env, env["owner_a"], quote["id"])
    item_id = _item_id(quote)
    before = _db_row(s, "quote_items", item_id, "qty,description")
    httpx.patch(
        f"{s.supabase_url}/rest/v1/quote_items?id=eq.{item_id}",
        headers=_minimal(s, env["owner_a"]),
        json={"qty": 99, "description": "שונה"},
        timeout=30,
    )
    assert _db_row(s, "quote_items", item_id, "qty,description") == before
    httpx.post(
        f"{s.supabase_url}/rest/v1/quote_items",
        headers=_minimal(s, env["owner_a"]),
        json={"workspace_id": env["ws_a"], "quote_id": quote["id"], "description": "נוסף", "qty": 1},
        timeout=30,
    )
    httpx.delete(
        f"{s.supabase_url}/rest/v1/quote_items?id=eq.{item_id}",
        headers=_minimal(s, env["owner_a"]),
        timeout=30,
    )
    assert _db_count(s, "quote_items", f"quote_id=eq.{quote['id']}") == 1


def test_member_cannot_forge_version_snapshot(env):
    s = env["s"]
    quote = _draft(env, env["owner_a"])
    _send(env, env["owner_a"], quote["id"])
    httpx.patch(
        f"{s.supabase_url}/rest/v1/quote_versions?quote_id=eq.{quote['id']}",
        headers=_minimal(s, env["owner_a"]),
        json={"snapshot": {"forged": True}},
        timeout=30,
    )
    httpx.post(
        f"{s.supabase_url}/rest/v1/quote_versions",
        headers=_minimal(s, env["owner_a"]),
        json={"workspace_id": env["ws_a"], "quote_id": quote["id"], "version": 7, "snapshot": {"forged": True}},
        timeout=30,
    )
    assert _db_count(s, "quote_versions", f"quote_id=eq.{quote['id']}&snapshot->>forged=eq.true") == 0
    assert _db_count(s, "quote_versions", f"quote_id=eq.{quote['id']}") == 1


def test_cross_workspace_member_cannot_touch_other_workspace_items(env):
    s = env["s"]
    quote = _draft(env, env["owner_a"])
    item_id = _item_id(quote)
    before = _db_row(s, "quote_items", item_id, "description,qty")
    httpx.patch(
        f"{s.supabase_url}/rest/v1/quote_items?id=eq.{item_id}",
        headers=_minimal(s, env["owner_b"]),
        json={"description": "x"},
        timeout=30,
    )
    assert _db_row(s, "quote_items", item_id, "description,qty") == before
    httpx.post(
        f"{s.supabase_url}/rest/v1/quote_items",
        headers=_minimal(s, env["owner_b"]),
        json={"workspace_id": env["ws_b"], "quote_id": quote["id"], "description": "x", "qty": 1},
        timeout=30,
    )
    assert _db_count(s, "quote_items", f"quote_id=eq.{quote['id']}") == 1


# --- HTTP: lifecycle integrity ----------------------------------------------------


def test_send_after_share_publishes_current_lines(env):
    api, ws, tok = env["api"], env["ws_a"], env["owner_a"]
    quote = _draft(env, tok)
    qid = quote["id"]
    shared = api.post(f"/api/v1/workspaces/{ws}/quotes/{qid}/share", headers=_auth(tok))
    assert shared.status_code == 200, shared.text
    added = api.post(
        f"/api/v1/workspaces/{ws}/quotes/{qid}/items",
        headers=_auth(tok),
        json={"description": "שורה שנוספה אחרי שיתוף", "name": "שורה שנוספה אחרי שיתוף", "qty": 1, "unit_price": 500},
    )
    assert added.status_code == 200, added.text
    sent = _send(env, tok, qid)
    public = api.get(f"/api/v1/public/quotes/{sent['public_token']}")
    assert public.status_code == 200, public.text
    body = public.json()
    names = [i.get("name") or i.get("description") for i in body.get("items", [])]
    assert "שורה שנוספה אחרי שיתוף" in names, names
    assert float(body["total_gross"]) == float(sent["total_gross"])


def test_owner_margin_override_succeeds(env):
    api, ws, tok = env["api"], env["ws_a"], env["owner_a"]
    quote = _draft(env, tok, price=100, cost=99)
    res = api.post(
        f"/api/v1/workspaces/{ws}/quotes/{quote['id']}/margin-override",
        headers=_auth(tok),
        json={"reason": "לקוח אסטרטגי"},
    )
    assert res.status_code == 200, res.text


def test_cannot_revise_approved_quote(env):
    api, ws, tok = env["api"], env["ws_a"], env["owner_a"]
    quote = _draft(env, tok)
    sent = _send(env, tok, quote["id"])
    approved = api.post(
        f"/api/v1/public/quotes/{sent['public_token']}/approve",
        json={"name": "לקוח", "terms_accepted": True, "signature_data_url": SIGNATURE},
    )
    assert approved.status_code == 200, approved.text
    res = api.post(f"/api/v1/workspaces/{ws}/quotes/{quote['id']}/revise", headers=_auth(tok))
    assert res.status_code == 409, res.text
    assert res.json()["error"]["code"] == "QUOTE_APPROVED_LOCKED", res.text


def test_revise_sent_quote_bumps_version(env):
    api, ws, tok = env["api"], env["ws_a"], env["owner_a"]
    quote = _draft(env, tok)
    _send(env, tok, quote["id"])
    res = api.post(f"/api/v1/workspaces/{ws}/quotes/{quote['id']}/revise", headers=_auth(tok))
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "draft"
    assert int(res.json()["version"]) == int(quote["version"]) + 1


def test_cross_workspace_http_cannot_reach_service_written_paths(env):
    """Writer paths bypass RLS, so the RLS load (id + path workspace) must stop B first."""
    api, ws_a, ws_b = env["api"], env["ws_a"], env["ws_b"]
    quote = _draft(env, env["owner_a"])
    qid, item_id = quote["id"], _item_id(quote)
    before = _db_row(env["s"], "quote_items", item_id, "qty,unit_price,description")
    tok_b = _auth(env["owner_b"])
    for ws in (ws_a, ws_b):  # A's path with B's JWT, and B's own path with A's quote id
        base = f"/api/v1/workspaces/{ws}/quotes/{qid}"
        calls = [
            api.post(f"{base}/items", headers=tok_b, json={"description": "x", "qty": 1, "unit_price": 1}),
            api.patch(f"{base}/items/{item_id}", headers=tok_b, json={"qty": 50}),
            api.post(f"{base}/send", headers=tok_b),
            api.post(f"{base}/share", headers=tok_b),
            api.post(f"{base}/revise", headers=tok_b),
            api.post(f"{base}/duplicate", headers=tok_b),
            api.post(f"{base}/margin-override", headers=tok_b, json={"reason": "ניסיון"}),
            api.post(f"{base}/sections", headers=tok_b, json={"name": "x"}),
        ]
        for res in calls:
            assert res.status_code in {403, 404}, (ws == ws_a, res.request.url, res.status_code, res.text)
    assert _db_row(env["s"], "quote_items", item_id, "qty,unit_price,description") == before
    assert _db_row(env["s"], "quotes", qid, "status")["status"] == "draft"


def test_apply_rpc_as_service_checks_actor_membership(env):
    s = env["s"]

    def call(actor_token: str) -> httpx.Response:
        return httpx.post(
            f"{s.supabase_url}/rest/v1/rpc/system_design_apply_owned",
            headers=_svc_headers(s),
            json={
                "p_workspace_id": env["ws_a"],
                "p_quote_id": str(uuid.uuid4()),
                "p_design_id": str(uuid.uuid4()),
                "p_expected_revision": 1,
                "p_actor_id": _uid(actor_token),
                "p_apply_id": str(uuid.uuid4()),
                "p_section_id": None,
                "p_lines": [],
            },
            timeout=30,
        )

    member = call(env["sales_a"])
    assert member.json().get("message") == "DESIGN_NOT_FOUND", member.text  # passed auth
    outsider = call(env["owner_b"])
    assert outsider.json().get("message") == "PERMISSION_DENIED", outsider.text
