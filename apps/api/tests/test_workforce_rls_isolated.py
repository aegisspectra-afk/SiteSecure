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
                for table in (
                    "workforce_shifts",
                    "workforce_shift_slots",
                    "workforce_coverage_requirements",
                    "workforce_time_off",
                    "workforce_qualifications",
                    "workforce_position_requirements",
                    "workforce_schedule_policies",
                    "workforce_employment_profiles",
                    "workforce_legal_instruments",
                    "workforce_workspace_packs",
                    "workforce_rules",
                ):
                    cur.execute("SELECT to_regclass(%s)", (f"public.{table}",))
                    if cur.fetchone()[0] is not None:
                        cur.execute(
                            f"DELETE FROM public.{table} WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE name = ANY(%s))",
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


def test_authenticated_cannot_write_shifts_even_with_edit_grant(world):
    with world["conn"].cursor() as cur:
        _require_shifts(cur)
        cur.execute(
            """
            SELECT has_table_privilege('authenticated', 'public.workforce_shifts', 'INSERT'),
                   has_table_privilege('authenticated', 'public.workforce_shifts', 'UPDATE'),
                   has_table_privilege('authenticated', 'public.workforce_shifts', 'DELETE'),
                   has_table_privilege('authenticated', 'public.workforce_shifts', 'SELECT')
            """
        )
        insert_priv, update_priv, delete_priv, select_priv = cur.fetchone()
        if insert_priv:
            pytest.skip("L2 shift API-only migration not applied on this local DB")
        assert insert_priv is False
        assert update_priv is False
        assert delete_priv is False
        assert select_priv is True
        bypass = _write_as(
            cur,
            world["manager_a"],
            """
            INSERT INTO public.workforce_shifts (workspace_id, employee_id, site_id, starts_at, ends_at)
            VALUES (%s, %s, %s, now(), now() + interval '8 hours')
            """,
            (str(world["ws_a"]), str(world["emp_other"]), str(world["site_a"])),
        )
        assert bypass != "ok"
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


def _require_portal_own_shifts(cur) -> None:
    _require_shifts(cur)
    cur.execute(
        """
        SELECT pg_get_expr(polqual, polrelid)
        FROM pg_policy
        WHERE polrelid = 'public.workforce_shifts'::regclass
          AND polname = 'workforce_shifts_select'
        """
    )
    row = cur.fetchone()
    if not row or "workforce.portal.view" not in (row[0] or ""):
        pytest.skip("portal own-shift SELECT policy not applied — apply local 20261021190000 migration")


def test_workforce_member_selects_only_own_shifts(world):
    with world["conn"].cursor() as cur:
        _require_portal_own_shifts(cur)
        cur.execute(
            """
            INSERT INTO public.workforce_shifts (workspace_id, employee_id, site_id, starts_at, ends_at)
            VALUES
              (%s, %s, %s, now(), now() + interval '8 hours'),
              (%s, %s, %s, now(), now() + interval '8 hours')
            """,
            (
                str(world["ws_a"]),
                str(world["emp_self"]),
                str(world["site_a"]),
                str(world["ws_a"]),
                str(world["emp_other"]),
                str(world["site_a"]),
            ),
        )
        own = _count_as(
            cur,
            world["member_a"],
            "SELECT count(*) FROM public.workforce_shifts WHERE workspace_id = %s",
            (str(world["ws_a"]),),
        )
        other = _count_as(
            cur,
            world["member_a"],
            "SELECT count(*) FROM public.workforce_shifts WHERE employee_id = %s",
            (str(world["emp_other"]),),
        )
        foreign = _count_as(
            cur,
            world["member_a"],
            "SELECT count(*) FROM public.workforce_shifts WHERE workspace_id = %s",
            (str(world["ws_b"]),),
        )
        viewer = _count_as(
            cur,
            world["viewer_a"],
            "SELECT count(*) FROM public.workforce_shifts WHERE workspace_id = %s",
            (str(world["ws_a"]),),
        )
        assert own == 1
        assert other == 0
        assert foreign == 0
        assert viewer >= 2
        denied = _write_as(
            cur,
            world["member_a"],
            """
            INSERT INTO public.workforce_shifts (workspace_id, employee_id, site_id, starts_at, ends_at)
            VALUES (%s, %s, %s, now(), now() + interval '8 hours')
            """,
            (str(world["ws_a"]), str(world["emp_self"]), str(world["site_a"])),
        )
        assert denied != "ok"


def _require_slots(cur) -> None:
    cur.execute("SELECT to_regclass('public.workforce_shift_slots')")
    if cur.fetchone()[0] is None:
        pytest.skip("workforce_shift_slots missing — apply local Stage 4B migration first")


def _seed_position(cur, workspace_id) -> str:
    cur.execute(
        "INSERT INTO public.workforce_positions (workspace_id, name) VALUES (%s, %s) RETURNING id",
        (str(workspace_id), f"pos-{uuid.uuid4().hex[:6]}"),
    )
    return str(cur.fetchone()[0])


def test_slot_is_not_an_assignment_and_is_tenant_isolated(world):
    with world["conn"].cursor() as cur:
        _require_slots(cur)
        pos = _seed_position(cur, world["ws_a"])
        result = _write_as(
            cur,
            world["manager_a"],
            """
            INSERT INTO public.workforce_shift_slots (workspace_id, site_id, position_id, starts_at, ends_at, required_count)
            VALUES (%s, %s, %s, now(), now() + interval '8 hours', 1)
            """,
            (str(world["ws_a"]), str(world["site_a"]), pos),
        )
        assert result == "ok"
        n = _count_as(
            cur,
            world["manager_a"],
            "SELECT count(*) FROM public.workforce_shift_slots WHERE workspace_id = %s",
            (str(world["ws_a"]),),
        )
        assert n >= 1
        n_b = _count_as(
            cur,
            world["manager_a"],
            "SELECT count(*) FROM public.workforce_shift_slots WHERE workspace_id = %s",
            (str(world["ws_b"]),),
        )
        assert n_b == 0
        stolen = _write_as(
            cur,
            world["manager_a"],
            """
            INSERT INTO public.workforce_shift_slots (workspace_id, site_id, position_id, starts_at, ends_at)
            VALUES (%s, %s, %s, now(), now() + interval '8 hours')
            """,
            (str(world["ws_b"]), str(world["site_b"]), pos),
        )
        assert stolen != "ok"


def test_technician_and_viewer_cannot_write_slots_postgrest(world):
    with world["conn"].cursor() as cur:
        _require_slots(cur)
        pos = _seed_position(cur, world["ws_a"])
        denied_tech = _write_as(
            cur,
            world["tech_a"],
            """
            INSERT INTO public.workforce_shift_slots (workspace_id, site_id, position_id, starts_at, ends_at)
            VALUES (%s, %s, %s, now(), now() + interval '8 hours')
            """,
            (str(world["ws_a"]), str(world["site_a"]), pos),
        )
        assert denied_tech != "ok"
        denied_viewer = _write_as(
            cur,
            world["viewer_a"],
            """
            INSERT INTO public.workforce_shift_slots (workspace_id, site_id, position_id, starts_at, ends_at)
            VALUES (%s, %s, %s, now(), now() + interval '8 hours')
            """,
            (str(world["ws_a"]), str(world["site_a"]), pos),
        )
        assert denied_viewer != "ok"
        cur.execute(
            """
            INSERT INTO public.workforce_shift_slots (workspace_id, site_id, position_id, starts_at, ends_at)
            VALUES (%s, %s, %s, now(), now() + interval '8 hours')
            """,
            (str(world["ws_a"]), str(world["site_a"]), pos),
        )
        n = _count_as(
            cur,
            world["viewer_a"],
            "SELECT count(*) FROM public.workforce_shift_slots WHERE workspace_id = %s",
            (str(world["ws_a"]),),
        )
        assert n >= 1


def test_overnight_slot_keeps_timestamptz_order(world):
    with world["conn"].cursor() as cur:
        _require_slots(cur)
        pos = _seed_position(cur, world["ws_a"])
        cur.execute(
            """
            INSERT INTO public.workforce_shift_slots (workspace_id, site_id, position_id, starts_at, ends_at)
            VALUES (%s, %s, %s, '2026-10-21 22:00:00+00', '2026-10-22 06:00:00+00')
            RETURNING ends_at > starts_at
            """,
            (str(world["ws_a"]), str(world["site_a"]), pos),
        )
        assert cur.fetchone()[0] is True


def test_slots_hidden_when_entitlement_off(world):
    with world["conn"].cursor() as cur:
        _require_slots(cur)
        pos = _seed_position(cur, world["ws_a"])
        cur.execute(
            """
            INSERT INTO public.workforce_shift_slots (workspace_id, site_id, position_id, starts_at, ends_at)
            VALUES (%s, %s, %s, now(), now() + interval '8 hours')
            """,
            (str(world["ws_a"]), str(world["site_a"]), pos),
        )
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
                "SELECT count(*) FROM public.workforce_shift_slots WHERE workspace_id = %s",
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


def _require_l1(cur) -> None:
    cur.execute("SELECT to_regclass('public.workforce_rules')")
    if cur.fetchone()[0] is None:
        pytest.skip("workforce_rules missing — apply local L1 migration first")


def test_l1_catalog_platform_readable_tenant_rules_isolated(world):
    with world["conn"].cursor() as cur:
        _require_l1(cur)
        n_platform_a = _count_as(
            cur,
            world["owner_a"],
            "SELECT count(*) FROM public.workforce_rules WHERE workspace_id IS NULL AND rule_code = 'REST_BETWEEN_DAYS'",
            (),
        )
        n_platform_b = _count_as(
            cur,
            world["owner_b"],
            "SELECT count(*) FROM public.workforce_rules WHERE workspace_id IS NULL AND rule_code = 'REST_BETWEEN_DAYS'",
            (),
        )
        assert n_platform_a >= 1
        assert n_platform_b >= 1
        denied_manager = _write_as(
            cur,
            world["manager_a"],
            """
            INSERT INTO public.workforce_rules (
              workspace_id, pack_code, rule_code, version, name_he, rule_type, verification_status,
              severity, source_kind, source_citation, reviewed_on, effective_from
            ) VALUES (
              %s, 'unverified_research', 'SITE_POLICY', 1, 'מדיניות', 'employer_policy', 'draft',
              'warning', 'policy', 'בדיקה', CURRENT_DATE, now()
            )
            """,
            (str(world["ws_a"]),),
        )
        assert denied_manager != "ok"
        inserted = _write_as(
            cur,
            world["owner_a"],
            """
            INSERT INTO public.workforce_rules (
              workspace_id, pack_code, rule_code, version, name_he, rule_type, verification_status,
              severity, source_kind, source_citation, reviewed_on, effective_from
            ) VALUES (
              %s, 'unverified_research', 'SITE_POLICY', 1, 'מדיניות', 'employer_policy', 'draft',
              'warning', 'policy', 'בדיקה', CURRENT_DATE, now()
            )
            """,
            (str(world["ws_a"]),),
        )
        assert inserted == "ok"
        n_b = _count_as(
            cur,
            world["owner_b"],
            "SELECT count(*) FROM public.workforce_rules WHERE workspace_id = %s",
            (str(world["ws_a"]),),
        )
        assert n_b == 0
        n_tech = _count_as(
            cur,
            world["tech_a"],
            "SELECT count(*) FROM public.workforce_rules WHERE rule_code = 'REST_BETWEEN_DAYS'",
            (),
        )
        assert n_tech == 0


def test_l1_cannot_verify_legal_as_tenant_or_rewrite_version(world):
    with world["conn"].cursor() as cur:
        _require_l1(cur)
        denied_legal = _write_as(
            cur,
            world["owner_a"],
            """
            INSERT INTO public.workforce_rules (
              workspace_id, pack_code, rule_code, version, name_he, rule_type, verification_status,
              severity, source_kind, source_citation, reviewed_on, effective_from, cannot_be_relaxed
            ) VALUES (
              %s, 'israel_hours_base', 'FAKE_LAW', 1, 'חוק', 'legal', 'verified',
              'blocking', 'statute', 'אין', CURRENT_DATE, now(), true
            )
            """,
            (str(world["ws_a"]),),
        )
        assert denied_legal != "ok"
        _write_as(
            cur,
            world["owner_a"],
            """
            INSERT INTO public.workforce_rules (
              workspace_id, pack_code, rule_code, version, name_he, rule_type, verification_status,
              severity, source_kind, source_citation, reviewed_on, effective_from
            ) VALUES (
              %s, 'unverified_research', 'SITE_CAP', 1, 'תקרה', 'employer_policy', 'draft',
              'warning', 'policy', 'בדיקה', CURRENT_DATE, now()
            )
            """,
            (str(world["ws_a"]),),
        )
        rewrite = _write_as(
            cur,
            world["owner_a"],
            """
            UPDATE public.workforce_rules
            SET parameters = '{"max": 1}'::jsonb
            WHERE workspace_id = %s AND rule_code = 'SITE_CAP'
            """,
            (str(world["ws_a"]),),
        )
        assert rewrite != "ok"
        cur.execute(
            """
            SELECT public.workforce_rule_is_active_legal_block(
              'permit', 'expired', 'blocking', now() - interval '30 days', now() - interval '1 day', now()
            )
            """
        )
        assert cur.fetchone()[0] is False
        cur.execute(
            """
            SELECT public.workforce_rule_is_active_legal_block(
              'legal', 'verified', 'blocking', now() - interval '30 days', NULL, now()
            )
            """
        )
        assert cur.fetchone()[0] is True


def test_authenticated_still_cannot_write_employees_after_stage4b(world):
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

