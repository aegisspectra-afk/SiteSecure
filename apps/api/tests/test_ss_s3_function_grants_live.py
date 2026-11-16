"""S3-sec: function EXECUTE grants and membership role escalation, against LOCAL Supabase.

Runs (never skips) whenever the configured Supabase is loopback, which the dev/test guard
enforces. Catalog checks read pg_proc directly; behaviour checks go through PostgREST with
real anon / member JWTs and then verify the database state with the service role.
"""

from __future__ import annotations

import base64
import json
import os
import uuid
from urllib.parse import urlparse

import httpx
import psycopg
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app

pytestmark = pytest.mark.live

PASSWORD = "Test-Pass-2026!"
OWNER = "ss.s3sec.owner@sitesecure.test"
MEMBER = "ss.s3sec.member@sitesecure.test"
ADMIN = "ss.s3sec.admin@sitesecure.test"
OUTSIDER = "ss.s3sec.outsider@sitesecure.test"
LOCAL_DB_URL = os.environ.get("SS_LOCAL_DB_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")

# anon (no login) may execute no function in public. Add a name here only after review.
ANON_ALLOWED: frozenset[str] = frozenset()

# What a signed-in member legitimately needs: RLS policy helpers (policies run as the querying
# user) and RPCs the API calls with the member's JWT. Add a name here only after review.
AUTHENTICATED_ALLOWED = frozenset(
    {
        "accept_invitation",
        "auth_assigned",
        "auth_can_access_department",
        "auth_customer_visible",
        "auth_feature",
        "auth_has_workspace_grant",
        "auth_is_assigned_scope",
        "auth_is_managerial",
        "auth_is_member",
        "auth_is_platform_admin",
        "auth_is_privileged",
        "auth_job_visible",
        # DEMO-1 policy helpers (technician assigned-job scope).
        "auth_via_assigned_job",
        "auth_assigned_project_visible",
        "auth_assigned_service_call_visible",
        "auth_assigned_document_entity_visible",
        "auth_role",
        "auth_role_in",
        "auth_site_visible",
        "catalog_import_commit",
        "create_workspace",
        "invitation_preview",
        "my_workspace_entitlements",
        "seed_workspace_pdf_templates",
        "seed_workspace_roles",
        "ssp_auth_product_role",
        "system_design_quote_visible",
        "workforce_can_read_rule_catalog",
        "write_audit_log",
    }
)

NON_EXTENSION_PUBLIC_FUNCS = """
    select p.proname, p.oid::regprocedure::text, p.prosecdef, coalesce(array_to_string(p.proconfig, ';'), ''),
           has_function_privilege('anon', p.oid, 'EXECUTE'),
           has_function_privilege('authenticated', p.oid, 'EXECUTE')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind in ('f', 'p')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
"""


@pytest.fixture(scope="module")
def settings():
    get_settings.cache_clear()
    s = get_settings()
    assert urlparse(s.supabase_url).hostname in {"127.0.0.1", "localhost"}, "local Supabase only"
    assert s.supabase_service_role_key, "local service role key required"
    return s


@pytest.fixture(scope="module")
def functions(settings):
    with psycopg.connect(LOCAL_DB_URL) as conn:
        return conn.execute(NON_EXTENSION_PUBLIC_FUNCS).fetchall()


def _svc(s) -> dict[str, str]:
    key = s.supabase_service_role_key
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def _rest(s, token: str) -> dict[str, str]:
    return {"apikey": s.supabase_anon_key, "Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _ensure_user(s, email: str) -> None:
    res = httpx.post(
        f"{s.supabase_url}/auth/v1/admin/users",
        headers=_svc(s),
        json={"email": email, "password": PASSWORD, "email_confirm": True},
        timeout=30,
    )
    assert res.status_code in {200, 201, 422}, res.text


def _token(s, email: str) -> str:
    res = httpx.post(
        f"{s.supabase_url}/auth/v1/token?grant_type=password",
        headers={"apikey": s.supabase_anon_key},
        json={"email": email, "password": PASSWORD},
        timeout=30,
    )
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _uid(token: str) -> str:
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload))["sub"]


def _svc_post(s, table: str, row: dict) -> dict:
    res = httpx.post(
        f"{s.supabase_url}/rest/v1/{table}",
        headers={**_svc(s), "Prefer": "return=representation"},
        json=row,
        timeout=30,
    )
    assert res.status_code == 201, res.text
    return res.json()[0]


def _svc_get(s, table: str, query: str) -> list[dict]:
    res = httpx.get(f"{s.supabase_url}/rest/v1/{table}?{query}", headers=_svc(s), timeout=30)
    assert res.status_code == 200, res.text
    return res.json()


@pytest.fixture(scope="module")
def env(settings):
    s = settings
    for email in (OWNER, MEMBER, ADMIN, OUTSIDER):
        _ensure_user(s, email)
    tokens = {name: _token(s, email) for name, email in (("owner", OWNER), ("member", MEMBER), ("admin", ADMIN), ("outsider", OUTSIDER))}
    api = TestClient(app)
    ws = api.post(
        "/api/v1/workspaces",
        headers={"Authorization": f"Bearer {tokens['owner']}"},
        json={"name": f"S3sec {uuid.uuid4().hex[:6]}"},
    )
    assert ws.status_code == 200, ws.text
    ws_id = ws.json()["id"]
    other = api.post(
        "/api/v1/workspaces",
        headers={"Authorization": f"Bearer {tokens['outsider']}"},
        json={"name": f"S3sec other {uuid.uuid4().hex[:6]}"},
    )
    assert other.status_code == 200, other.text
    for name, role in (("member", "sales"), ("admin", "administrator")):
        _svc_post(s, "workspace_memberships", {"workspace_id": ws_id, "user_id": _uid(tokens[name]), "role_key": role, "status": "active"})
    company = _svc_post(
        s, "ssp_companies", {"workspace_id": ws_id, "company_id": f"cmp_{uuid.uuid4().hex}", "name": "S3sec SSP"}
    )
    memberships = {}
    for name, role in (("member", "patrol_officer"), ("admin", "patrol_manager")):
        memberships[name] = _svc_post(
            s,
            "ssp_memberships",
            {"workspace_id": ws_id, "company_pk": company["id"], "user_id": _uid(tokens[name]), "product_role": role},
        )
    return {"s": s, "api": api, "tokens": tokens, "ws": ws_id, "other_ws": other.json()["id"], "company": company, "ssp": memberships}


# --- catalog: who may execute what -----------------------------------------------------------


def test_anon_executes_no_function_outside_the_allowlist(functions):
    exposed = sorted(sig for name, sig, _d, _c, anon, _a in functions if anon and name not in ANON_ALLOWED)
    assert exposed == [], f"anon can execute: {exposed}"


def test_authenticated_executes_only_reviewed_functions(functions):
    exposed = sorted(sig for name, sig, _d, _c, _an, auth in functions if auth and name not in AUTHENTICATED_ALLOWED)
    assert exposed == [], f"authenticated can execute unreviewed functions: {exposed}"


def test_member_callable_functions_pin_an_empty_search_path(functions):
    loose = sorted(sig for _n, sig, _d, cfg, _an, auth in functions if auth and 'search_path=""' not in cfg)
    assert loose == [], f"authenticated-callable functions without search_path='': {loose}"


def test_new_functions_are_not_exposed_by_default(settings):
    with psycopg.connect(LOCAL_DB_URL) as conn:
        conn.execute("create function public.ss_s3sec_probe() returns int language sql as 'select 1'")
        try:
            anon, auth = conn.execute(
                "select has_function_privilege('anon', 'public.ss_s3sec_probe()', 'EXECUTE'),"
                " has_function_privilege('authenticated', 'public.ss_s3sec_probe()', 'EXECUTE')"
            ).fetchone()
        finally:
            conn.rollback()
    assert (anon, auth) == (False, False)


# --- behaviour through PostgREST -------------------------------------------------------------


def _rpc(s, headers: dict, name: str, body: dict) -> httpx.Response:
    return httpx.post(f"{s.supabase_url}/rest/v1/rpc/{name}", headers=headers, json=body, timeout=30)


def test_anon_cannot_run_admin_provision_workspace(env):
    s = env["s"]
    name = f"S3sec anon {uuid.uuid4().hex[:6]}"
    anon = {"apikey": s.supabase_anon_key, "Content-Type": "application/json"}
    res = _rpc(s, anon, "admin_provision_workspace", {"p_name": name, "p_plan_key": "business"})
    assert res.status_code in {401, 403, 404}, res.text
    member = _rpc(s, _rest(s, env["tokens"]["member"]), "admin_provision_workspace", {"p_name": name, "p_plan_key": "business"})
    assert member.status_code in {401, 403, 404}, member.text
    assert _svc_get(s, "workspaces", f"name=eq.{name}&select=id") == []


def test_member_cannot_self_serve_a_paid_plan(env):
    s = env["s"]
    name = f"S3sec paid {uuid.uuid4().hex[:6]}"
    res = _rpc(s, _rest(s, env["tokens"]["member"]), "create_workspace", {"p_name": name, "p_plan_key": "business"})
    assert res.status_code >= 400, res.text
    assert _svc_get(s, "workspaces", f"name=eq.{name}&select=id") == []


def test_seed_functions_refuse_a_workspace_the_caller_is_not_in(env):
    s = env["s"]
    for fn in ("seed_workspace_roles", "seed_workspace_pdf_templates"):
        res = _rpc(s, _rest(s, env["tokens"]["outsider"]), fn, {"p_workspace_id": env["ws"]})
        assert res.status_code >= 400, (fn, res.text)


def test_member_cannot_promote_self_to_org_admin(env):
    s = env["s"]
    mine = env["ssp"]["member"]
    httpx.patch(
        f"{s.supabase_url}/rest/v1/ssp_memberships?id=eq.{mine['id']}",
        headers={**_rest(s, env["tokens"]["member"]), "Prefer": "return=minimal"},
        json={"product_role": "org_admin"},
        timeout=30,
    )
    assert _svc_get(s, "ssp_memberships", f"id=eq.{mine['id']}&select=product_role")[0]["product_role"] == "patrol_officer"


def test_patrol_manager_cannot_change_roles_or_promote_self(env):
    s = env["s"]
    headers = {**_rest(s, env["tokens"]["admin"]), "Prefer": "return=minimal"}
    for target, role in ((env["ssp"]["member"], "patrol_manager"), (env["ssp"]["admin"], "org_admin")):
        httpx.patch(f"{s.supabase_url}/rest/v1/ssp_memberships?id=eq.{target['id']}", headers=headers, json={"product_role": role}, timeout=30)
    assert _svc_get(s, "ssp_memberships", f"id=eq.{env['ssp']['member']['id']}&select=product_role")[0]["product_role"] == "patrol_officer"
    assert _svc_get(s, "ssp_memberships", f"id=eq.{env['ssp']['admin']['id']}&select=product_role")[0]["product_role"] == "patrol_manager"


def test_member_cannot_insert_an_org_admin_membership(env):
    s = env["s"]
    stranger = _uid(env["tokens"]["outsider"])
    httpx.post(
        f"{s.supabase_url}/rest/v1/ssp_memberships",
        headers={**_rest(s, env["tokens"]["member"]), "Prefer": "return=minimal"},
        json={"workspace_id": env["ws"], "company_pk": env["company"]["id"], "user_id": stranger, "product_role": "org_admin"},
        timeout=30,
    )
    assert _svc_get(s, "ssp_memberships", f"user_id=eq.{stranger}&workspace_id=eq.{env['ws']}&select=id") == []


def test_owner_can_change_another_members_ssp_role(env):
    s = env["s"]
    mine = env["ssp"]["member"]
    res = httpx.patch(
        f"{s.supabase_url}/rest/v1/ssp_memberships?id=eq.{mine['id']}",
        headers={**_rest(s, env["tokens"]["owner"]), "Prefer": "return=minimal"},
        json={"product_role": "patrol_manager"},
        timeout=30,
    )
    assert res.status_code in {200, 204}, res.text
    assert _svc_get(s, "ssp_memberships", f"id=eq.{mine['id']}&select=product_role")[0]["product_role"] == "patrol_manager"
    httpx.patch(
        f"{s.supabase_url}/rest/v1/ssp_memberships?id=eq.{mine['id']}",
        headers={**_svc(s), "Prefer": "return=minimal"},
        json={"product_role": "patrol_officer"},
        timeout=30,
    )


def test_workspace_administrator_cannot_change_own_role(env):
    s = env["s"]
    admin_uid = _uid(env["tokens"]["admin"])
    httpx.patch(
        f"{s.supabase_url}/rest/v1/workspace_memberships?workspace_id=eq.{env['ws']}&user_id=eq.{admin_uid}",
        headers={**_rest(s, env["tokens"]["admin"]), "Prefer": "return=minimal"},
        json={"role_key": "owner"},
        timeout=30,
    )
    row = _svc_get(s, "workspace_memberships", f"workspace_id=eq.{env['ws']}&user_id=eq.{admin_uid}&select=role_key")[0]
    assert row["role_key"] == "administrator"


# --- S3b: who may write ssp_memberships at all --------------------------------------------------


@pytest.fixture(scope="module")
def department(env):
    s = env["s"]
    unit = _svc_post(s, "ssp_org_units", {"workspace_id": env["ws"], "company_pk": env["company"]["id"], "name": "S3b unit"})
    return _svc_post(
        s,
        "ssp_departments",
        {"workspace_id": env["ws"], "company_pk": env["company"]["id"], "org_unit_id": unit["id"], "key": f"s3b{uuid.uuid4().hex[:6]}", "name_he": "מחלקה"},
    )


def _membership(env, name: str) -> dict:
    return _svc_get(env["s"], "ssp_memberships", f"id=eq.{env['ssp'][name]['id']}&select=status,department_id,product_role")[0]


def test_member_cannot_change_another_members_status(env):
    s = env["s"]
    before = _membership(env, "admin")
    httpx.patch(
        f"{s.supabase_url}/rest/v1/ssp_memberships?id=eq.{env['ssp']['admin']['id']}",
        headers={**_rest(s, env["tokens"]["member"]), "Prefer": "return=minimal"},
        json={"status": "inactive"},
        timeout=30,
    )
    assert _membership(env, "admin") == before


def test_member_cannot_change_own_or_others_department(env, department):
    s = env["s"]
    headers = {**_rest(s, env["tokens"]["member"]), "Prefer": "return=minimal"}
    for name in ("member", "admin"):
        before = _membership(env, name)
        httpx.patch(
            f"{s.supabase_url}/rest/v1/ssp_memberships?id=eq.{env['ssp'][name]['id']}",
            headers=headers,
            json={"department_id": department["id"]},
            timeout=30,
        )
        assert _membership(env, name) == before, name


def test_member_cannot_delete_memberships(env):
    s = env["s"]
    headers = {**_rest(s, env["tokens"]["member"]), "Prefer": "return=minimal"}
    for name in ("admin", "member"):
        httpx.delete(f"{s.supabase_url}/rest/v1/ssp_memberships?id=eq.{env['ssp'][name]['id']}", headers=headers, timeout=30)
        assert _svc_get(s, "ssp_memberships", f"id=eq.{env['ssp'][name]['id']}&select=id"), name


def test_owner_can_change_a_members_status(env):
    s = env["s"]
    target = env["ssp"]["member"]["id"]
    res = httpx.patch(
        f"{s.supabase_url}/rest/v1/ssp_memberships?id=eq.{target}",
        headers={**_rest(s, env["tokens"]["owner"]), "Prefer": "return=minimal"},
        json={"status": "inactive"},
        timeout=30,
    )
    assert res.status_code in {200, 204}, res.text
    assert _membership(env, "member")["status"] == "inactive"
    httpx.patch(
        f"{s.supabase_url}/rest/v1/ssp_memberships?id=eq.{target}",
        headers={**_svc(s), "Prefer": "return=minimal"},
        json={"status": "active"},
        timeout=30,
    )


def test_owner_bootstraps_own_ssp_membership_only_once(env):
    s = env["s"]
    owner_uid = _uid(env["tokens"]["owner"])
    row = {"workspace_id": env["ws"], "company_pk": env["company"]["id"], "user_id": owner_uid, "product_role": "org_admin"}
    headers = {**_rest(s, env["tokens"]["owner"]), "Prefer": "return=minimal"}
    first = httpx.post(f"{s.supabase_url}/rest/v1/ssp_memberships", headers=headers, json=row, timeout=30)
    assert first.status_code == 201, first.text
    second = httpx.post(f"{s.supabase_url}/rest/v1/ssp_memberships", headers=headers, json=row, timeout=30)
    assert second.status_code >= 400
    # Refused by the explicit rule, not merely by the (company, user) unique constraint.
    assert "SSP_MEMBERSHIP_EXISTS" in second.text, second.text
    assert len(_svc_get(s, "ssp_memberships", f"workspace_id=eq.{env['ws']}&user_id=eq.{owner_uid}&select=id")) == 1
