"""Isolated local Postgres proofs for Workforce RLS.

Requires SITESECURE_ISOLATED_DB_URL pointing at disposable Local Supabase
(127.0.0.1:54322). Never Staging or production (rhxqqudlngimhplvndmz).
"""

from __future__ import annotations

import os
import uuid
from collections.abc import Iterator
from pathlib import Path
from urllib.parse import urlparse

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("SITESECURE_ISOLATED_DB_URL"),
    reason="Isolated DB tests require SITESECURE_ISOLATED_DB_URL (local disposable only)",
)

_REPO_ROOT = Path(__file__).resolve().parents[3]
_RLS_MIGRATION = (
    _REPO_ROOT / "supabase" / "migrations" / "20261020200000_workforce_rls_least_privilege.sql"
)
_BLOCKED_HOST_FRAGMENTS = (
    "supabase.co",
    "rhxqqudlngimhplvndmz",
    "amazonaws.com",
    "neon.tech",
    "pooler.supabase",
)
_ALLOWED_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})


def _require_psycopg():
    try:
        import psycopg
    except ImportError as exc:  # pragma: no cover
        pytest.skip(f"psycopg not installed: {exc}")
    return psycopg


def _assert_isolated_local_url(url: str) -> None:
    raw = (url or "").strip()
    if not raw:
        pytest.fail("SITESECURE_ISOLATED_DB_URL is empty")
    lowered = raw.lower()
    for frag in _BLOCKED_HOST_FRAGMENTS:
        if frag in lowered:
            pytest.fail(f"Refusing shared/remote DB URL (matched {frag!r})")
    parsed = urlparse(raw)
    host = (parsed.hostname or "").lower()
    if host not in _ALLOWED_HOSTS:
        pytest.fail(f"DB host must be localhost/127.0.0.1; got {host!r}")


def _set_auth_uid(cur, user_id: uuid.UUID) -> None:
    # Session-level GUCs: autocommit makes SET LOCAL a no-op.
    cur.execute("SELECT set_config('request.jwt.claim.sub', %s, false)", (str(user_id),))
    claims = f'{{"sub":"{user_id}","role":"authenticated"}}'
    cur.execute("SELECT set_config('request.jwt.claims', %s, false)", (claims,))
    cur.execute("SET ROLE authenticated")


def _reset_role(cur) -> None:
    try:
        cur.execute("RESET ROLE")
    except Exception:
        pass
    try:
        cur.execute("SELECT set_config('request.jwt.claim.sub', '', false)")
        cur.execute("SELECT set_config('request.jwt.claims', '{}', false)")
    except Exception:
        pass


def _create_actor(cur, marker: str, label: str) -> uuid.UUID:
    user_id = uuid.uuid4()
    email = f"wi-rls-{label}-{marker}@example.invalid"
    cur.execute(
        """
        INSERT INTO auth.users (
          id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
          instance_id, aud, role
        )
        VALUES (
          %s, %s, crypt('test-only', gen_salt('bf')), now(), now(), now(),
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
        )
        ON CONFLICT (id) DO NOTHING
        """,
        (str(user_id), email),
    )
    cur.execute(
        """
        INSERT INTO public.profiles (id, full_name)
        VALUES (%s, %s)
        ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name
        """,
        (str(user_id), f"WI RLS {label} {marker}"),
    )
    return user_id


def _insert_membership(cur, workspace_id: uuid.UUID, user_id: uuid.UUID, role: str) -> None:
    cur.execute(
        """
        INSERT INTO public.workspace_memberships (workspace_id, user_id, role_key, workspace_role_key, status)
        VALUES (%s, %s, %s, %s, 'active')
        """,
        (str(workspace_id), str(user_id), role, role),
    )


def _count_as(cur, user_id: uuid.UUID, sql: str, params: tuple) -> int:
    _set_auth_uid(cur, user_id)
    try:
        cur.execute(sql, params)
        row = cur.fetchone()
        return int(row[0]) if row else 0
    finally:
        _reset_role(cur)


def _write_as(cur, user_id: uuid.UUID, sql: str, params: tuple) -> str:
    _set_auth_uid(cur, user_id)
    try:
        cur.execute(sql, params)
        return "ok"
    except Exception as exc:
        return type(exc).__name__ + ":" + str(exc)
    finally:
        _reset_role(cur)


@pytest.fixture(scope="module")
def isolated_conn():
    url = os.environ["SITESECURE_ISOLATED_DB_URL"]
    _assert_isolated_local_url(url)
    psycopg = _require_psycopg()
    conn = psycopg.connect(url)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT 1 FROM pg_proc p
                JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'auth_has_workspace_grant'
                """
            )
            if cur.fetchone() is None:
                cur.execute(_RLS_MIGRATION.read_text(encoding="utf-8"))
            cur.execute("SELECT to_regclass('public.workforce_employees')")
            if cur.fetchone()[0] is None:
                pytest.skip("workforce_employees missing — apply local WI migrations first")
        yield conn
    finally:
        conn.close()


@pytest.fixture
def world(isolated_conn) -> Iterator[dict]:
    marker = uuid.uuid4().hex[:8]
    names = [f"wi-rls-a-{marker}", f"wi-rls-b-{marker}"]
    with isolated_conn.cursor() as cur:
        owner_a = _create_actor(cur, marker, "owner-a")
        manager_a = _create_actor(cur, marker, "manager-a")
        tech_a = _create_actor(cur, marker, "tech-a")
        viewer_a = _create_actor(cur, marker, "viewer-a")
        member_a = _create_actor(cur, marker, "member-a")
        owner_b = _create_actor(cur, marker, "owner-b")

        cur.execute(
            "INSERT INTO public.workspaces (name, status) VALUES (%s, 'active') RETURNING id",
            (names[0],),
        )
        ws_a = cur.fetchone()[0]
        cur.execute(
            "INSERT INTO public.workspaces (name, status) VALUES (%s, 'active') RETURNING id",
            (names[1],),
        )
        ws_b = cur.fetchone()[0]

        for ws in (ws_a, ws_b):
            cur.execute(
                """
                INSERT INTO public.subscriptions (workspace_id, plan_key, status)
                VALUES (%s, 'business', 'active')
                ON CONFLICT (workspace_id) DO UPDATE SET plan_key = 'business', status = 'active'
                """,
                (str(ws),),
            )
            cur.execute("SELECT public.seed_workspace_roles(%s)", (str(ws),))

        cur.execute(
            """
            INSERT INTO public.workspace_feature_overrides (workspace_id, feature_key, enabled)
            VALUES (%s, 'workforce', true)
            ON CONFLICT (workspace_id, feature_key) DO UPDATE SET enabled = true
            """,
            (str(ws_a),),
        )
        cur.execute(
            """
            INSERT INTO public.workspace_feature_overrides (workspace_id, feature_key, enabled)
            VALUES (%s, 'workforce', true)
            ON CONFLICT (workspace_id, feature_key) DO UPDATE SET enabled = true
            """,
            (str(ws_b),),
        )

        _insert_membership(cur, ws_a, owner_a, "owner")
        _insert_membership(cur, ws_a, manager_a, "manager")
        _insert_membership(cur, ws_a, tech_a, "technician")
        _insert_membership(cur, ws_a, viewer_a, "viewer")
        _insert_membership(cur, ws_a, member_a, "workforce_member")
        _insert_membership(cur, ws_b, owner_b, "owner")

        cur.execute(
            """
            INSERT INTO public.workforce_employees (
              workspace_id, user_id, first_name, last_name, email, username, employment_status
            )
            VALUES
              (%s, %s, 'Dana', 'A', 'dana-a@example.invalid', 'dana.a', 'active'),
              (%s, %s, 'Other', 'A', 'other-a@example.invalid', 'other.a', 'active')
            RETURNING id, user_id
            """,
            (str(ws_a), str(member_a), str(ws_a), str(tech_a)),
        )
        rows = cur.fetchall()
        emp_self = next(row[0] for row in rows if str(row[1]) == str(member_a))
        emp_other = next(row[0] for row in rows if str(row[1]) == str(tech_a))
        cur.execute(
            """
            INSERT INTO public.workforce_employees (
              workspace_id, first_name, last_name, email, username, employment_status
            )
            VALUES (%s, 'Bob', 'B', 'bob-b@example.invalid', 'bob.b', 'active')
            RETURNING id
            """,
            (str(ws_b),),
        )
        emp_b = cur.fetchone()[0]
        cur.execute(
            """
            INSERT INTO public.workforce_sites (workspace_id, name)
            VALUES (%s, 'Site A')
            RETURNING id
            """,
            (str(ws_a),),
        )
        site_a = cur.fetchone()[0]
        cur.execute(
            """
            INSERT INTO public.workforce_sites (workspace_id, name)
            VALUES (%s, 'Site B')
            RETURNING id
            """,
            (str(ws_b),),
        )
        site_b = cur.fetchone()[0]

    state = {
        "conn": isolated_conn,
        "names": names,
        "ws_a": ws_a,
        "ws_b": ws_b,
        "owner_a": owner_a,
        "manager_a": manager_a,
        "tech_a": tech_a,
        "viewer_a": viewer_a,
        "member_a": member_a,
        "owner_b": owner_b,
        "emp_self": emp_self,
        "emp_other": emp_other,
        "emp_b": emp_b,
        "site_a": site_a,
        "site_b": site_b,
        "actors": [owner_a, manager_a, tech_a, viewer_a, member_a, owner_b],
    }
    try:
        yield state
    finally:
        with isolated_conn.cursor() as cur:
            _reset_role(cur)
            cur.execute("ALTER TABLE public.workspace_memberships DISABLE TRIGGER memberships_protect_last_owner")
            try:
                cur.execute("SELECT to_regclass('public.workforce_shifts')")
                if cur.fetchone()[0] is not None:
                    cur.execute(
                        "DELETE FROM public.workforce_shifts WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE name = ANY(%s))",
                        (list(names),),
                    )
                for name in names:
                    cur.execute("DELETE FROM public.workspaces WHERE name = %s", (name,))
                for uid in state["actors"]:
                    cur.execute("DELETE FROM auth.users WHERE id = %s", (str(uid),))
            finally:
                cur.execute("ALTER TABLE public.workspace_memberships ENABLE TRIGGER memberships_protect_last_owner")


def test_no_authenticated_write_privilege_on_employees(world):
    with world["conn"].cursor() as cur:
        cur.execute(
            """
            SELECT has_table_privilege('authenticated', 'public.workforce_employees', 'INSERT'),
                   has_table_privilege('authenticated', 'public.workforce_employees', 'UPDATE'),
                   has_table_privilege('authenticated', 'public.workforce_employees', 'DELETE'),
                   has_table_privilege('authenticated', 'public.workforce_employees', 'SELECT')
            """
        )
        insert, update, delete, select = cur.fetchone()
        assert insert is False
        assert update is False
        assert delete is False
        assert select is True
        cur.execute(
            """
            SELECT count(*) FROM pg_policy pol
            JOIN pg_class rel ON rel.oid = pol.polrelid
            WHERE rel.relname = 'workforce_employees' AND pol.polcmd <> 'r'
            """
        )
        assert int(cur.fetchone()[0]) == 0


def test_manager_cannot_insert_employee_via_sql(world):
    with world["conn"].cursor() as cur:
        result = _write_as(
            cur,
            world["manager_a"],
            """
            INSERT INTO public.workforce_employees (workspace_id, first_name, last_name, username)
            VALUES (%s, 'Eve', 'Manager', 'eve.m')
            """,
            (str(world["ws_a"]),),
        )
        assert result != "ok"


def test_technician_cannot_read_employee_directory(world):
    with world["conn"].cursor() as cur:
        n = _count_as(
            cur,
            world["tech_a"],
            "SELECT count(*) FROM public.workforce_employees WHERE workspace_id = %s",
            (str(world["ws_a"]),),
        )
        assert n == 0


def test_viewer_with_employees_view_can_read_own_workspace_only(world):
    with world["conn"].cursor() as cur:
        n_a = _count_as(
            cur,
            world["viewer_a"],
            "SELECT count(*) FROM public.workforce_employees WHERE workspace_id = %s",
            (str(world["ws_a"]),),
        )
        n_b = _count_as(
            cur,
            world["viewer_a"],
            "SELECT count(*) FROM public.workforce_employees WHERE workspace_id = %s",
            (str(world["ws_b"]),),
        )
        assert n_a == 2
        assert n_b == 0


def test_workforce_member_sees_only_self(world):
    with world["conn"].cursor() as cur:
        n = _count_as(
            cur,
            world["member_a"],
            "SELECT count(*) FROM public.workforce_employees WHERE workspace_id = %s",
            (str(world["ws_a"]),),
        )
        assert n == 1
        n_other = _count_as(
            cur,
            world["member_a"],
            "SELECT count(*) FROM public.workforce_employees WHERE id = %s",
            (str(world["emp_other"]),),
        )
        assert n_other == 0


def test_cross_tenant_owner_cannot_read_or_write(world):
    with world["conn"].cursor() as cur:
        n = _count_as(
            cur,
            world["owner_b"],
            "SELECT count(*) FROM public.workforce_employees WHERE workspace_id = %s",
            (str(world["ws_a"]),),
        )
        assert n == 0
        n_sites = _count_as(
            cur,
            world["owner_b"],
            "SELECT count(*) FROM public.workforce_sites WHERE workspace_id = %s",
            (str(world["ws_a"]),),
        )
        assert n_sites == 0
        _write_as(
            cur,
            world["owner_b"],
            "UPDATE public.workforce_sites SET name = 'hijack' WHERE workspace_id = %s",
            (str(world["ws_a"]),),
        )
        n_after = _count_as(
            cur,
            world["owner_a"],
            "SELECT count(*) FROM public.workforce_sites WHERE workspace_id = %s AND name = 'hijack'",
            (str(world["ws_a"]),),
        )
        assert n_after == 0


def test_technician_cannot_write_sites(world):
    with world["conn"].cursor() as cur:
        result = _write_as(
            cur,
            world["tech_a"],
            "INSERT INTO public.workforce_sites (workspace_id, name) VALUES (%s, 'Tech Site')",
            (str(world["ws_a"]),),
        )
        assert result != "ok"


def test_manager_can_write_sites_in_own_workspace(world):
    with world["conn"].cursor() as cur:
        result = _write_as(
            cur,
            world["manager_a"],
            "INSERT INTO public.workforce_sites (workspace_id, name) VALUES (%s, 'Mgr Site')",
            (str(world["ws_a"]),),
        )
        assert result == "ok"
        n = _count_as(
            cur,
            world["manager_a"],
            "SELECT count(*) FROM public.workforce_sites WHERE workspace_id = %s AND name = 'Mgr Site'",
            (str(world["ws_a"]),),
        )
        assert n == 1


def test_feature_override_hides_rows(world):
    with world["conn"].cursor() as cur:
        cur.execute(
            """
            UPDATE public.workspace_feature_overrides
            SET enabled = false
            WHERE workspace_id = %s AND feature_key = 'workforce'
            """,
            (str(world["ws_a"]),),
        )
        try:
            n = _count_as(
                cur,
                world["owner_a"],
                "SELECT count(*) FROM public.workforce_employees WHERE workspace_id = %s",
                (str(world["ws_a"]),),
            )
            assert n == 0
        finally:
            cur.execute(
                """
                UPDATE public.workspace_feature_overrides
                SET enabled = true
                WHERE workspace_id = %s AND feature_key = 'workforce'
                """,
                (str(world["ws_a"]),),
            )


def test_workspace_id_immutable(world):
    with world["conn"].cursor() as cur:
        with pytest.raises(Exception):
            cur.execute(
                "UPDATE public.workforce_employees SET workspace_id = %s WHERE id = %s",
                (str(world["ws_b"]), str(world["emp_self"])),
            )


def _require_shifts(cur) -> None:
    cur.execute("SELECT to_regclass('public.workforce_shifts')")
    if cur.fetchone()[0] is None:
        pytest.skip("workforce_shifts missing — apply local Stage 3 migration first")


def test_authenticated_still_cannot_write_employees_after_stage3(world):
    with world["conn"].cursor() as cur:
        cur.execute(
            """
            SELECT has_table_privilege('authenticated', 'public.workforce_employees', 'INSERT'),
                   has_table_privilege('authenticated', 'public.workforce_memberships', 'INSERT')
            """
        )
        insert_emp, insert_mem = cur.fetchone()
        assert insert_emp is False
        assert insert_mem is False


def test_manager_can_write_shift_in_own_workspace_only(world):
    with world["conn"].cursor() as cur:
        _require_shifts(cur)
        result = _write_as(
            cur,
            world["manager_a"],
            """
            INSERT INTO public.workforce_shifts (workspace_id, employee_id, site_id, starts_at, ends_at)
            VALUES (%s, %s, %s, now(), now() + interval '8 hours')
            """,
            (str(world["ws_a"]), str(world["emp_other"]), str(world["site_a"])),
        )
        assert result == "ok"
        foreign = _write_as(
            cur,
            world["manager_a"],
            """
            INSERT INTO public.workforce_shifts (workspace_id, employee_id, site_id, starts_at, ends_at)
            VALUES (%s, %s, %s, now(), now() + interval '8 hours')
            """,
            (str(world["ws_b"]), str(world["emp_b"]), str(world["site_b"])),
        )
        assert foreign != "ok"
        n_b = _count_as(
            cur,
            world["manager_a"],
            "SELECT count(*) FROM public.workforce_shifts WHERE workspace_id = %s",
            (str(world["ws_b"]),),
        )
        assert n_b == 0


def test_viewer_can_read_shifts_but_not_write(world):
    with world["conn"].cursor() as cur:
        _require_shifts(cur)
        cur.execute(
            """
            INSERT INTO public.workforce_shifts (workspace_id, employee_id, site_id, starts_at, ends_at)
            VALUES (%s, %s, %s, now(), now() + interval '8 hours')
            """,
            (str(world["ws_a"]), str(world["emp_other"]), str(world["site_a"])),
        )
        n = _count_as(
            cur,
            world["viewer_a"],
            "SELECT count(*) FROM public.workforce_shifts WHERE workspace_id = %s",
            (str(world["ws_a"]),),
        )
        assert n >= 1
        n_b = _count_as(
            cur,
            world["viewer_a"],
            "SELECT count(*) FROM public.workforce_shifts WHERE workspace_id = %s",
            (str(world["ws_b"]),),
        )
        assert n_b == 0
        denied = _write_as(
            cur,
            world["viewer_a"],
            """
            INSERT INTO public.workforce_shifts (workspace_id, employee_id, site_id, starts_at, ends_at)
            VALUES (%s, %s, %s, now(), now() + interval '8 hours')
            """,
            (str(world["ws_a"]), str(world["emp_other"]), str(world["site_a"])),
        )
        assert denied != "ok"


def test_shift_workspace_id_immutable(world):
    with world["conn"].cursor() as cur:
        _require_shifts(cur)
        cur.execute(
            """
            INSERT INTO public.workforce_shifts (workspace_id, employee_id, site_id, starts_at, ends_at)
            VALUES (%s, %s, %s, now(), now() + interval '8 hours')
            RETURNING id
            """,
            (str(world["ws_a"]), str(world["emp_other"]), str(world["site_a"])),
        )
        shift_id = cur.fetchone()[0]
        with pytest.raises(Exception):
            cur.execute(
                "UPDATE public.workforce_shifts SET workspace_id = %s WHERE id = %s",
                (str(world["ws_b"]), str(shift_id)),
            )
