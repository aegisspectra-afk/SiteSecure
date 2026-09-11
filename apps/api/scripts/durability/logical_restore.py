#!/usr/bin/env python3
"""Restore a logical vault backup (workspace-scoped or full) into the configured Supabase project.

WARNING: Destructive for overlapping primary keys. Intended for:
  - disposable QA workspaces after intentional wipe
  - isolated recovery projects with matching schema

Never point this at production for a full wipe. Prefer --workspace-id filters.

Auth: recreates users with temporary passwords from --qa-password (required for auth restore).
Password hashes are not in the vault — operators must distribute resets for real users.

Usage:
  python apps/api/scripts/durability/logical_restore.py --backup-id <id> --workspace-id <uuid> --qa-password '...'
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from logical_backup import RESTORE_ORDER, vault_root  # noqa: E402

ROOT = Path(__file__).resolve().parents[4]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "apps" / "api" / ".env")


def svc() -> tuple[str, dict[str, str]]:
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return url, {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def upsert(client: httpx.Client, url: str, headers: dict, table: str, rows: list[dict]) -> None:
    if not rows:
        return
    rows = [dict(r) for r in rows]
    if table == "product_categories":
        ids = {str(r["id"]) for r in rows if r.get("id")}
        for r in rows:
            pid = r.get("parent_id")
            if pid and str(pid) not in ids:
                r["parent_id"] = None
        remaining = list(rows)
        inserted: set[str] = set()
        for _ in range(len(rows) + 3):
            if not remaining:
                break
            wave = [r for r in remaining if not r.get("parent_id") or str(r.get("parent_id")) in inserted]
            if not wave:
                wave = remaining[:1]
                wave[0]["parent_id"] = None
            _upsert_chunk(client, url, headers, table, wave)
            for r in wave:
                inserted.add(str(r["id"]))
            remaining = [r for r in remaining if str(r.get("id")) not in inserted]
        return
    _upsert_chunk(client, url, headers, table, rows)


def _upsert_chunk(client: httpx.Client, url: str, headers: dict, table: str, rows: list[dict]) -> None:
    sample = rows[0]
    conflict = "id" if "id" in sample else ("workspace_id" if table == "workspace_settings" else None)
    for i in range(0, len(rows), 200):
        chunk = rows[i : i + 200]
        params = {"on_conflict": conflict} if conflict else None
        r = client.post(
            f"{url}/rest/v1/{table}",
            headers=headers,
            params=params,
            json=chunk,
        )
        if r.status_code not in {200, 201, 204}:
            r2 = client.post(
                f"{url}/rest/v1/{table}",
                headers={
                    "apikey": headers["apikey"],
                    "Authorization": headers["Authorization"],
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                },
                json=chunk,
            )
            if r2.status_code not in {200, 201, 204}:
                raise RuntimeError(f"upsert {table}: {r.status_code}/{r2.status_code} {r2.text[:400]}")


def ensure_auth_users(
    client: httpx.Client,
    url: str,
    headers: dict,
    users: list[dict],
    password: str,
) -> dict[str, str]:
    """Create/update users; return email->id map."""
    mapping: dict[str, str] = {}
    for u in users:
        email = (u.get("email") or "").lower()
        uid = u.get("id")
        if not email or not uid:
            continue
        created = client.post(
            f"{url}/auth/v1/admin/users",
            headers=headers,
            json={
                "id": uid,
                "email": email,
                "password": password,
                "email_confirm": True,
                "app_metadata": u.get("app_metadata") or {},
                "user_metadata": u.get("user_metadata") or {},
            },
        )
        if created.status_code not in {200, 201}:
            listed = client.get(
                f"{url}/auth/v1/admin/users",
                headers=headers,
                params={"page": 1, "per_page": 200},
            )
            found = None
            for cand in (listed.json() or {}).get("users") or []:
                if (cand.get("email") or "").lower() == email or cand.get("id") == uid:
                    found = cand
                    break
            if found:
                client.put(
                    f"{url}/auth/v1/admin/users/{found['id']}",
                    headers=headers,
                    json={"password": password, "email_confirm": True},
                )
                mapping[email] = found["id"]
            else:
                raise RuntimeError(f"auth create failed {email}: {created.status_code} {created.text[:200]}")
        else:
            mapping[email] = created.json().get("id") or uid
    return mapping


def upload_object(
    client: httpx.Client, url: str, headers: dict, bucket: str, path: str, data: bytes
) -> None:
    ctype = "application/octet-stream"
    lower = path.lower()
    if lower.endswith(".png"):
        ctype = "image/png"
    elif lower.endswith(".jpg") or lower.endswith(".jpeg"):
        ctype = "image/jpeg"
    elif lower.endswith(".pdf"):
        ctype = "application/pdf"
    elif lower.endswith(".txt"):
        ctype = "text/plain"
    h = {
        "apikey": headers["apikey"],
        "Authorization": headers["Authorization"],
        "Content-Type": ctype,
        "x-upsert": "true",
    }
    r = client.post(f"{url}/storage/v1/object/{bucket}/{path.lstrip('/')}", headers=h, content=data)
    if r.status_code not in {200, 201}:
        raise RuntimeError(f"upload {bucket}/{path}: {r.status_code} {r.text[:200]}")


def restore(
    backup_id: str,
    *,
    workspace_ids: list[str] | None,
    qa_password: str,
) -> dict[str, Any]:
    dest = vault_root() / backup_id
    if not dest.exists():
        raise SystemExit(f"backup not found: {dest}")
    manifest = json.loads((dest / "MANIFEST.json").read_text(encoding="utf-8"))
    url, headers = svc()
    started = time.time()
    db_dir = dest / "db"
    storage_dir = dest / "storage"
    restored_tables: dict[str, int] = {}
    storage_ok = 0
    storage_fail = 0

    tables = RESTORE_ORDER if workspace_ids else RESTORE_ORDER

    with httpx.Client(timeout=180) as client:
        users = load_jsonl(db_dir / "auth_users.jsonl")
        ensure_auth_users(client, url, headers, users, qa_password)

        for table in tables:
            rows = load_jsonl(db_dir / f"{table}.jsonl")
            if workspace_ids:
                if table == "workspaces":
                    rows = [r for r in rows if r.get("id") in workspace_ids]
                elif rows and "workspace_id" in (rows[0] or {}):
                    rows = [r for r in rows if r.get("workspace_id") in workspace_ids]
            try:
                upsert(client, url, headers, table, rows)
                restored_tables[table] = len(rows)
            except Exception as exc:  # noqa: BLE001
                restored_tables[table] = -1
                raise RuntimeError(f"{table}: {exc}") from exc

        storage_manifest = manifest.get("storage_objects") or []
        for obj in storage_manifest:
            bucket = obj["bucket"]
            path = obj["path"]
            if workspace_ids and not any(path.startswith(f"{wid}/") for wid in workspace_ids):
                continue
            file_path = storage_dir / bucket / path
            if not file_path.exists():
                storage_fail += 1
                continue
            data = file_path.read_bytes()
            expected = obj.get("sha256")
            if expected and hashlib.sha256(data).hexdigest() != expected:
                storage_fail += 1
                continue
            try:
                upload_object(client, url, headers, bucket, path, data)
                storage_ok += 1
            except Exception:
                storage_fail += 1

    result = {
        "backup_id": backup_id,
        "duration_seconds": round(time.time() - started, 2),
        "restored_tables": restored_tables,
        "storage_restored": storage_ok,
        "storage_failed": storage_fail,
        "ok": storage_fail == 0 and all(v >= 0 for v in restored_tables.values()),
    }
    print(json.dumps(result, indent=2))
    if not result["ok"]:
        raise SystemExit("RESTORE_FAILED")
    return result


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--backup-id", required=True)
    ap.add_argument("--workspace-id", action="append", default=[])
    ap.add_argument("--qa-password", required=True)
    args = ap.parse_args()
    restore(args.backup_id, workspace_ids=args.workspace_id or None, qa_password=args.qa_password)
    return 0


if __name__ == "__main__":
    sys.exit(main())