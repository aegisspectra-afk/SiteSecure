"""Isolated DB integration proofs for atomic Solo create_workspace.

Requires a disposable LOCAL Postgres/Supabase only.
Never point SITESECURE_ISOLATED_DB_URL at Staging or production.

Environment:
  SITESECURE_ISOLATED_DB_URL=postgresql://...@127.0.0.1:54322/postgres
  (host must be localhost or 127.0.0.1)

Setup (local only):
  1. Install Docker Desktop + Supabase CLI (see module docstring footer).
  2. `supabase start` then apply migrations including
     20261019180000_atomic_solo_workspace_product_defaults.sql.
  3. Export SITESECURE_ISOLATED_DB_URL to the local DB URL from `supabase status`.
  4. pytest apps/api/tests/test_create_workspace_atomic_rollback.py -q

These tests call public.create_workspace inside Postgres (not the API layer).
Failure injection patches the SQL function body so the second override INSERT
raises inside the same RPC transaction.
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
_MIGRATION_PATH = (
    _REPO_ROOT
    / "supabase"
    / "migrations"
    / "20261019180000_atomic_solo_workspace_product_defaults.sql"
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
        pytest.fail(
            f"DB host must be localhost/127.0.0.1 for isolated tests; got {host!r}"
        )


def _load_atomic_migration_sql() -> str:
    text = _MIGRATION_PATH.read_text(encoding="utf-8")
    if "PRODUCT_DEFAULTS_UNAVAILABLE" not in text or "create_workspace" not in text:
        pytest.fail(f"Unexpected migration contents at {_MIGRATION_PATH}")
    return text


def _set_auth_uid(cur, user_id: uuid.UUID) -> None:
    """Best-effort auth.uid() GUC setup for local Supabase/Postgres."""
    cur.execute("SELECT set_config('request.jwt.claim.sub', %s, true)", (str(user_id),))
    claims = f'{{"sub":"{user_id}","role":"authenticated"}}'
    cur.execute("SELECT set_config('request.jwt.claims', %s, true)", (claims,))
    try:
        cur.execute("SET LOCAL ROLE authenticated")
    except Exception:
        # Local plain Postgres may lack the role; auth.uid() GUC is enough when defined that way.
        pass


def _install_fail_on_second_override(cur) -> None:
    """Replace create_workspace so the 2nd required Solo override raises inside the RPC."""
    cur.execute(
        r"""
CREATE OR REPLACE FUNCTION public.create_workspace(p_name text, p_plan_key text DEFAULT 'solo')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_id uuid;
  v_uid uuid := auth.uid();
  v_plan text;
  v_feature text;
  v_idx integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;

  v_plan := COALESCE(NULLIF(p_plan_key, ''), 'solo');
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE key = v_plan) THEN
    RAISE EXCEPTION 'INVALID_PLAN';
  END IF;

  INSERT INTO public.workspaces (name)
  VALUES (trim(p_name))
  RETURNING id INTO v_id;

  INSERT INTO public.workspace_settings (workspace_id) VALUES (v_id);
  INSERT INTO public.workspace_counters (workspace_id, kind, last_value)
  VALUES
    (v_id, 'site', 0),
    (v_id, 'quote', 0),
    (v_id, 'job', 0),
    (v_id, 'warranty', 0),
    (v_id, 'ft', 0);

  INSERT INTO public.workspace_memberships (workspace_id, user_id, role_key)
  VALUES (v_id, v_uid, 'owner');

  INSERT INTO public.subscriptions (workspace_id, plan_key, status)
  VALUES (v_id, v_plan, 'active');

  IF v_plan = 'solo' THEN
    FOREACH v_feature IN ARRAY ARRAY['fleet', 'ssp']::text[]
    LOOP
      IF EXISTS (
        SELECT 1
        FROM public.plan_features pf
        WHERE pf.plan_key = v_plan
          AND pf.feature_key = v_feature
      ) THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.features f WHERE f.key = v_feature
        ) THEN
          RAISE EXCEPTION 'PRODUCT_DEFAULTS_UNAVAILABLE';
        END IF;

        v_idx := v_idx + 1;
        IF v_idx = 2 THEN
          RAISE EXCEPTION 'TEST_FORCE_FAIL_SECOND_OVERRIDE';
        END IF;

        INSERT INTO public.workspace_feature_overrides (workspace_id, feature_key, enabled)
        VALUES (v_id, v_feature, false);
      END IF;
    END LOOP;
  END IF;

  PERFORM public.seed_workspace_defaults(v_id);

  UPDATE public.profiles
  SET last_workspace_id = v_id
  WHERE id = v_uid;

  RETURN v_id;
END;
$body$;
"""
    )


def _restore_atomic_function(cur) -> None:
    cur.execute(_load_atomic_migration_sql())


def _count_named(cur, table: str, workspace_id: uuid.UUID | None = None, name: str | None = None) -> int:
    if workspace_id is not None:
        cur.execute(f"SELECT count(*) FROM public.{table} WHERE workspace_id = %s", (str(workspace_id),))
    elif name is not None:
        cur.execute("SELECT count(*) FROM public.workspaces WHERE name = %s", (name,))
    else:
        raise ValueError("workspace_id or name required")
    return int(cur.fetchone()[0])


def _assert_no_residue_for_name(cur, ws_name: str) -> None:
    """Assert the failed create left no workspace row and no children keyed by that name."""
    cur.execute("SELECT id FROM public.workspaces WHERE name = %s", (ws_name,))
    rows = cur.fetchall()
    assert rows == [], f"workspace leak for name={ws_name!r}: {rows}"

    # Child-table joins by name must also be empty (covers partial commits if FKs were ever deferred).
    for table in (
        "workspace_memberships",
        "subscriptions",
        "workspace_settings",
        "workspace_counters",
        "workspace_feature_overrides",
        "product_categories",
        "quote_templates",
        "checklist_templates",
        "checklist_template_items",
    ):
        cur.execute(
            f"""
            SELECT count(*) FROM public.{table} t
            JOIN public.workspaces w ON w.id = t.workspace_id
            WHERE w.name = %s
            """,
            (ws_name,),
        )
        assert int(cur.fetchone()[0]) == 0, f"residue in {table} for name={ws_name!r}"


def _ensure_feature(cur, key: str) -> None:
    cur.execute("INSERT INTO public.features (key) VALUES (%s) ON CONFLICT (key) DO NOTHING", (key,))


def _ensure_plan_feature(cur, plan_key: str, feature_key: str) -> None:
    _ensure_feature(cur, feature_key)
    cur.execute(
        """
        INSERT INTO public.plan_features (plan_key, feature_key)
        VALUES (%s, %s)
        ON CONFLICT DO NOTHING
        """,
        (plan_key, feature_key),
    )


def _delete_plan_feature(cur, plan_key: str, feature_key: str) -> None:
    cur.execute(
        "DELETE FROM public.plan_features WHERE plan_key = %s AND feature_key = %s",
        (plan_key, feature_key),
    )


def _create_test_actor(cur, marker: str) -> uuid.UUID:
    """Insert auth.users + profiles row dedicated to this test run."""
    user_id = uuid.uuid4()
    email = f"atomic-{marker}@example.invalid"
    # Supabase auth.users shape varies; try minimal insert then profile.
    try:
        cur.execute(
            """
            INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role)
            VALUES (
              %s, %s, crypt('test-only', gen_salt('bf')), now(), now(), now(),
              '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
            )
            ON CONFLICT (id) DO NOTHING
            """,
            (str(user_id), email),
        )
    except Exception:
        # Fallback: profiles-only if auth insert unsupported — requires FK relaxation (isolated only).
        cur.execute(
            """
            INSERT INTO public.profiles (id, full_name, last_workspace_id)
            VALUES (%s, %s, NULL)
            ON CONFLICT (id) DO NOTHING
            """,
            (str(user_id), f"Atomic Test {marker}"),
        )
        cur.execute("SELECT 1 FROM public.profiles WHERE id = %s", (str(user_id),))
        if cur.fetchone() is None:
            pytest.fail(
                "Could not create test actor (auth.users insert failed and profiles FK blocked). "
                "Use a local Supabase DB with auth schema."
            )
        return user_id

    cur.execute(
        """
        INSERT INTO public.profiles (id, full_name, last_workspace_id)
        VALUES (%s, %s, NULL)
        ON CONFLICT (id) DO UPDATE SET last_workspace_id = NULL, full_name = EXCLUDED.full_name
        """,
        (str(user_id), f"Atomic Test {marker}"),
    )
    return user_id


def _cleanup_actor(cur, user_id: uuid.UUID, names: list[str]) -> None:
    for name in names:
        cur.execute("SELECT id FROM public.workspaces WHERE name = %s", (name,))
        for (wid,) in cur.fetchall():
            cur.execute("DELETE FROM public.workspaces WHERE id = %s", (str(wid),))
    cur.execute("DELETE FROM public.profiles WHERE id = %s", (str(user_id),))
    try:
        cur.execute("DELETE FROM auth.users WHERE id = %s", (str(user_id),))
    except Exception:
        pass


def _call_create_workspace(cur, user_id: uuid.UUID, name: str, plan_key: str) -> uuid.UUID:
    _set_auth_uid(cur, user_id)
    cur.execute("SELECT public.create_workspace(%s, %s)", (name, plan_key))
    row = cur.fetchone()
    assert row and row[0], "create_workspace returned empty"
    return uuid.UUID(str(row[0]))


def _get_last_workspace_id(cur, user_id: uuid.UUID) -> uuid.UUID | None:
    cur.execute("SELECT last_workspace_id FROM public.profiles WHERE id = %s", (str(user_id),))
    row = cur.fetchone()
    assert row is not None
    return uuid.UUID(str(row[0])) if row[0] else None


@pytest.fixture
def isolated_conn() -> Iterator:
    psycopg = _require_psycopg()
    url = os.environ["SITESECURE_ISOLATED_DB_URL"]
    _assert_isolated_local_url(url)
    conn = psycopg.connect(url)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT current_database(), inet_server_addr(), inet_server_port()")
            db, addr, port = cur.fetchone()
            # Extra belt: server address should be local when reported
            if addr is not None and str(addr) not in {"127.0.0.1", "::1"} and not str(addr).startswith("127."):
                pytest.fail(f"Server address not local: {addr!r} db={db} port={port}")
            cur.execute(
                """
                SELECT 1 FROM pg_proc p
                JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'create_workspace'
                """
            )
            if cur.fetchone() is None:
                pytest.fail("public.create_workspace missing — apply local migrations first")
        yield conn
    finally:
        conn.close()


@pytest.fixture
def harness(isolated_conn) -> Iterator[dict]:
    marker = uuid.uuid4().hex[:10]
    names: list[str] = []
    with isolated_conn.cursor() as cur:
        # Snapshot production function body for restore.
        cur.execute(
            "SELECT pg_get_functiondef('public.create_workspace(text,text)'::regprocedure)"
        )
        original_def = cur.fetchone()[0]
        actor = _create_test_actor(cur, marker)
        # Baseline plan rows used by tests (do not assume SSP exists).
        _ensure_feature(cur, "fleet")
        _ensure_plan_feature(cur, "solo", "fleet")
        _delete_plan_feature(cur, "solo", "ssp")  # default: SSP absent from Solo eligibility
        # Ensure business plan exists for non-solo coverage.
        cur.execute("SELECT 1 FROM public.plans WHERE key = 'business'")
        if cur.fetchone() is None:
            pytest.fail("plans.business missing on isolated DB")

    state = {
        "conn": isolated_conn,
        "marker": marker,
        "actor": actor,
        "names": names,
        "original_def": original_def,
        "fk_dropped": False,
    }
    try:
        yield state
    finally:
        with isolated_conn.cursor() as cur:
            if state.get("fk_dropped"):
                try:
                    cur.execute(
                        """
                        ALTER TABLE public.plan_features
                          ADD CONSTRAINT plan_features_feature_key_fkey
                          FOREIGN KEY (feature_key) REFERENCES public.features(key) ON DELETE CASCADE
                        """
                    )
                except Exception:
                    pass
            try:
                cur.execute(state["original_def"])
            except Exception:
                try:
                    _restore_atomic_function(cur)
                except Exception:
                    pass
            _cleanup_actor(cur, state["actor"], state["names"])
            # Restore solo ssp absence preference is fine; re-ensure fleet for other local work.
            _ensure_plan_feature(cur, "solo", "fleet")


def test_second_override_failure_rolls_back_fully(harness):
    """Atomic failure on 2nd override: no workspace-side residue; last_workspace_id unchanged."""
    conn = harness["conn"]
    actor = harness["actor"]
    ws_name = f"atomic-fail2-{harness['marker']}"
    harness["names"].append(ws_name)

    with conn.cursor() as cur:
        # Need TWO eligible registered keys so the 2nd insert is reached.
        _ensure_feature(cur, "fleet")
        _ensure_feature(cur, "ssp")
        _ensure_plan_feature(cur, "solo", "fleet")
        _ensure_plan_feature(cur, "solo", "ssp")

        cur.execute(
            "UPDATE public.profiles SET last_workspace_id = NULL WHERE id = %s",
            (str(actor),),
        )
        before = _get_last_workspace_id(cur, actor)
        assert before is None

        _install_fail_on_second_override(cur)

        with pytest.raises(Exception) as exc:
            _call_create_workspace(cur, actor, ws_name, "solo")
        assert "TEST_FORCE_FAIL_SECOND_OVERRIDE" in str(exc.value)

        _assert_no_residue_for_name(cur, ws_name)
        after = _get_last_workspace_id(cur, actor)
        assert after == before

        # Restore canonical migration function for subsequent tests / cleanup.
        cur.execute(harness["original_def"])


def test_success_solo_seeds_eligible_overrides_enabled_false(harness):
    """Happy path: Solo workspace + enabled=false for each eligible of {fleet,ssp}."""
    conn = harness["conn"]
    actor = harness["actor"]
    ws_name = f"atomic-ok-{harness['marker']}"
    harness["names"].append(ws_name)

    with conn.cursor() as cur:
        cur.execute(harness["original_def"])
        _ensure_feature(cur, "fleet")
        _ensure_feature(cur, "ssp")
        _ensure_plan_feature(cur, "solo", "fleet")
        _ensure_plan_feature(cur, "solo", "ssp")

        ws_id = _call_create_workspace(cur, actor, ws_name, "solo")

        cur.execute(
            """
            SELECT feature_key, enabled
            FROM public.workspace_feature_overrides
            WHERE workspace_id = %s
            ORDER BY feature_key
            """,
            (str(ws_id),),
        )
        rows = cur.fetchall()
        assert rows == [("fleet", False), ("ssp", False)]

        assert _get_last_workspace_id(cur, actor) == ws_id
        assert _count_named(cur, "workspace_settings", workspace_id=ws_id) == 1
        assert _count_named(cur, "workspace_counters", workspace_id=ws_id) >= 1
        assert _count_named(cur, "product_categories", workspace_id=ws_id) >= 1


def test_success_without_ssp_in_plan_features(harness):
    """SSP absent from Solo plan_features: create succeeds; only fleet override seeded."""
    conn = harness["conn"]
    actor = harness["actor"]
    ws_name = f"atomic-nossp-{harness['marker']}"
    harness["names"].append(ws_name)

    with conn.cursor() as cur:
        cur.execute(harness["original_def"])
        _ensure_feature(cur, "fleet")
        _ensure_plan_feature(cur, "solo", "fleet")
        _delete_plan_feature(cur, "solo", "ssp")
        # ssp may or may not exist in features registry — must not matter when not plan-eligible.
        cur.execute("SELECT 1 FROM public.plan_features WHERE plan_key='solo' AND feature_key='ssp'")
        assert cur.fetchone() is None

        ws_id = _call_create_workspace(cur, actor, ws_name, "solo")

        cur.execute(
            """
            SELECT feature_key, enabled
            FROM public.workspace_feature_overrides
            WHERE workspace_id = %s
            ORDER BY feature_key
            """,
            (str(ws_id),),
        )
        rows = cur.fetchall()
        assert rows == [("fleet", False)]
        assert "ssp" not in {r[0] for r in rows}


def test_plan_eligible_missing_registry_rolls_back(harness):
    """plan_features row without features registry → PRODUCT_DEFAULTS_UNAVAILABLE + full rollback.

    Requires temporarily dropping the plan_features→features FK (isolated DB only).
    """
    conn = harness["conn"]
    actor = harness["actor"]
    ws_name = f"atomic-noreg-{harness['marker']}"
    harness["names"].append(ws_name)

    with conn.cursor() as cur:
        cur.execute(harness["original_def"])
        _ensure_feature(cur, "fleet")
        _ensure_plan_feature(cur, "solo", "fleet")
        _delete_plan_feature(cur, "solo", "ssp")

        cur.execute(
            """
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'public.plan_features'::regclass
              AND contype = 'f'
              AND pg_get_constraintdef(oid) ILIKE '%feature_key%features%'
            """
        )
        fk = cur.fetchone()
        assert fk, "expected plan_features.feature_key FK"
        fk_name = fk[0]
        cur.execute(f"ALTER TABLE public.plan_features DROP CONSTRAINT {fk_name}")
        harness["fk_dropped"] = True

        # Keep plan_features.fleet, remove features.fleet
        cur.execute("DELETE FROM public.features WHERE key = 'fleet'")
        cur.execute(
            "SELECT 1 FROM public.plan_features WHERE plan_key='solo' AND feature_key='fleet'"
        )
        assert cur.fetchone() is not None
        cur.execute("SELECT 1 FROM public.features WHERE key='fleet'")
        assert cur.fetchone() is None

        cur.execute(
            "UPDATE public.profiles SET last_workspace_id = NULL WHERE id = %s",
            (str(actor),),
        )
        before = _get_last_workspace_id(cur, actor)

        with pytest.raises(Exception) as exc:
            _call_create_workspace(cur, actor, ws_name, "solo")
        assert "PRODUCT_DEFAULTS_UNAVAILABLE" in str(exc.value)

        _assert_no_residue_for_name(cur, ws_name)
        assert _get_last_workspace_id(cur, actor) == before

        # Repair registry + FK for cleanup / other tests
        _ensure_feature(cur, "fleet")
        _ensure_plan_feature(cur, "solo", "fleet")
        cur.execute(
            f"""
            ALTER TABLE public.plan_features
              ADD CONSTRAINT {fk_name}
              FOREIGN KEY (feature_key) REFERENCES public.features(key) ON DELETE CASCADE
            """
        )
        harness["fk_dropped"] = False


def test_non_solo_does_not_seed_solo_default_overrides(harness):
    """Non-Solo plan keeps original behavior: no fleet/ssp default-off overrides from this logic."""
    conn = harness["conn"]
    actor = harness["actor"]
    ws_name = f"atomic-biz-{harness['marker']}"
    harness["names"].append(ws_name)

    with conn.cursor() as cur:
        cur.execute(harness["original_def"])
        # Even if business includes fleet, Solo default-off block must not run.
        _ensure_feature(cur, "fleet")
        _ensure_plan_feature(cur, "business", "fleet")

        ws_id = _call_create_workspace(cur, actor, ws_name, "business")

        cur.execute(
            """
            SELECT feature_key, enabled
            FROM public.workspace_feature_overrides
            WHERE workspace_id = %s AND feature_key IN ('fleet', 'ssp')
            """,
            (str(ws_id),),
        )
        assert cur.fetchall() == []

        cur.execute(
            "SELECT plan_key FROM public.subscriptions WHERE workspace_id = %s",
            (str(ws_id),),
        )
        assert cur.fetchone()[0] == "business"


# ---------------------------------------------------------------------------
# Install notes (do not auto-install)
# ---------------------------------------------------------------------------
# Windows prerequisites to obtain a safe local DB:
#   1. Install Docker Desktop and ensure it is running.
#   2. Install Supabase CLI, e.g.:
#        scoop install supabase
#        # or: npm install -g supabase
#   3. From repo root:
#        supabase start
#        supabase db reset   # applies migrations to local DB only
#   4. Copy DB URL from `supabase status` (must be 127.0.0.1 / localhost).
#   5. pip install psycopg
#   6. set SITESECURE_ISOLATED_DB_URL=...
#   7. pytest apps/api/tests/test_create_workspace_atomic_rollback.py -q
#
# Do NOT use Staging/Production project URLs.
