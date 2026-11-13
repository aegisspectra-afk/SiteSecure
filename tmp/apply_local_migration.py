"""Apply one migration file to LOCAL Supabase only (127.0.0.1:54322) and register its version.

Usage: python tmp/apply_local_migration.py supabase/migrations/<file>.sql
       python tmp/apply_local_migration.py --rollback supabase/rollbacks/rollback_<file>.sql
"""
from __future__ import annotations

import socket
import sys
from pathlib import Path

import psycopg

URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"


def main() -> None:
    args = sys.argv[1:]
    rollback = args and args[0] == "--rollback"
    path = Path(args[-1]).resolve()
    socket.create_connection(("127.0.0.1", 54322), timeout=5).close()
    sql = path.read_text(encoding="utf-8")
    with psycopg.connect(URL, autocommit=False) as conn, conn.cursor() as cur:
        if rollback:
            cur.execute(sql)
            conn.commit()
            print("rolled back via", path.name)
            return
        version, _, name = path.stem.partition("_")
        cur.execute("select 1 from supabase_migrations.schema_migrations where version = %s", (version,))
        if cur.fetchone():
            print("skip already applied", path.name)
            return
        cur.execute(sql)
        cur.execute(
            "insert into supabase_migrations.schema_migrations (version, name) values (%s, %s)",
            (version, name),
        )
        conn.commit()
        print("applied", path.name)


if __name__ == "__main__":
    main()
