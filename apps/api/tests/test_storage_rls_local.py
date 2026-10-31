"""Local Storage RLS contract for SITE SECURE documents vs branding/exports."""

from __future__ import annotations

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
POLICY = ROOT / "supabase" / "migrations" / "20261031122000_storage_rls_documents_signed_only.sql"


def test_storage_policy_sql_is_signed_only_for_private_buckets():
    sql = POLICY.read_text(encoding="utf-8")
    assert "bucket_id IN ('branding', 'exports')" in sql
    assert sql.count("DROP POLICY") >= 4
    assert "documents" not in sql.split("CREATE POLICY", 1)[-1] or (
        "'documents'" not in sql.split("CREATE POLICY", 1)[-1]
    )
    created = sql.split("CREATE POLICY", 1)[-1]
    assert "'photos'" not in created
    assert "'signatures'" not in created
    assert "'documents'" not in created
    assert "'branding'" in created
    assert "'exports'" in created


def test_storage_live_authenticated_blocked_when_local_db_up():
    psycopg = pytest.importorskip("psycopg")
    try:
        conn = psycopg.connect(
            "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
            connect_timeout=5,
        )
    except Exception:
        pytest.skip("local Supabase Postgres is not reachable")
    with conn:
        rows = conn.execute(
            """
            select policyname, cmd, qual, with_check
            from pg_policies
            where schemaname = 'storage' and tablename = 'objects'
            """
        ).fetchall()
    text = " ".join(" ".join(str(col) for col in row) for row in rows)
    member_policies = [row for row in rows if row[0] and "member" in str(row[0])]
    if not member_policies:
        pytest.skip("storage member policies not applied on this database yet")
    joined = " ".join(str(row[2] or "") + " " + str(row[3] or "") for row in member_policies)
    assert "branding" in joined
    assert "exports" in joined
    assert "documents" not in joined
    assert "photos" not in joined
    assert "signatures" not in joined
    assert text  # policies exist
