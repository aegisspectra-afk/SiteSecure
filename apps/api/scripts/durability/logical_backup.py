#!/usr/bin/env python3
"""SITE SECURE logical durability backup (DB + Auth metadata + Storage binaries).

Creates a timestamped vault under SS_BACKUP_DIR (default: <repo>/_backup_vault).
Never commits vault contents. Credentials from env only.

What IS included:
  - public application tables (JSONL)
  - auth users metadata via Admin API (id/email/app_metadata/user_metadata; NOT password hashes)
  - Storage binaries for configured buckets + per-object checksums
  - manifests linking DB + Storage backup IDs

What is NOT a full Supabase physical clone:
  - password hashes (Auth recovery = recreate users / send password reset)
  - Dashboard Auth provider settings / API keys
  - Edge Functions, Realtime config
  - Managed internal schemas beyond what we export

Usage:
  python apps/api/scripts/durability/logical_backup.py
  python apps/api/scripts/durability/logical_backup.py --workspace-id <uuid>
  python apps/api/scripts/durability/logical_backup.py --status

Exit nonzero on failure.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[4]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "apps" / "api" / ".env")

BUCKETS = ("documents", "photos", "signatures", "branding", "exports")

# Order matters for restore FK friendliness (parents first).
TABLES: list[str] = [
    "plans",
    "features",
    "plan_features",
    "plan_limits",
    "permissions",
    "roles",
    "role_permissions",
    "profiles",
    "workspaces",
    "workspace_roles",
    "workspace_memberships",
    "workspace_settings",
    "workspace_feature_overrides",
    "workspace_counters",
    "subscriptions",
    "customers",
    "customer_contacts",
    "customer_notes",
    "customer_activities",
    "sites",
    "site_zones",
    "site_readiness",
    "site_timeline_events",
    "systems",
    "product_categories",
    "products",
    "quotes",
    "quote_versions",
    "quote_sections",
    "quote_items",
    "quote_packages",
    "quote_package_items",
    "quote_templates",
    "quote_template_items",
    "quote_public_access",
    "quote_events",
    "projects",
    "jobs",
    "assignments",
    "documents",
    "equipment",
    "leads",
    "tasks",
    "notifications",
    "notification_preferences",
    "invitations",
    "beta_participants",
    "feedback_reports",
    "pdf_document_templates",
    "generated_documents",
    "accounting_documents",
    "service_calls",
    "service_contracts",
    "warranties",
    "checklist_templates",
    "checklist_template_items",
    "job_checklist_items",
    "knowledge_articles",
    "after_action_reports",
    "feature_flags",
    "platform_admin_events",
    "audit_logs",
    "idempotency_keys",
]

WORKSPACE_SCOPED = {
    "workspace_roles",
    "workspace_memberships",
    "workspace_settings",
    "workspace_feature_overrides",
    "workspace_counters",
    "subscriptions",
    "customers",
    "customer_contacts",
    "customer_notes",
    "customer_activities",
    "sites",
    "site_zones",
    "site_readiness",
    "site_timeline_events",
    "systems",
    "product_categories",
    "products",
    "quotes",
    "quote_versions",
    "quote_sections",
    "quote_items",
    "quote_packages",
    "quote_package_items",
    "quote_templates",
    "quote_template_items",
    "quote_public_access",
    "quote_events",
    "projects",
    "jobs",
    "assignments",
    "documents",
    "equipment",
    "leads",
    "tasks",
    "notifications",
    "notification_preferences",
    "invitations",
    "beta_participants",
    "feedback_reports",
    "pdf_document_templates",
    "generated_documents",
    "accounting_documents",
    "service_calls",
    "service_contracts",
    "warranties",
    "checklist_templates",
    "checklist_template_items",
    "job_checklist_items",
    "knowledge_articles",
    "after_action_reports",
    "audit_logs",
}

# Restored when doing workspace-scoped recovery (plus auth_users separately).
RESTORE_TABLES_SCOPED = [
    "profiles",
    "workspaces",
    *sorted(WORKSPACE_SCOPED),
]

# Preferred order for FK-safe restore of scoped data.
RESTORE_ORDER = [
    "profiles",
    "workspaces",
    "workspace_roles",
    "workspace_memberships",
    "workspace_settings",
    "workspace_feature_overrides",
    "workspace_counters",
    "subscriptions",
    "customers",
    "customer_contacts",
    "customer_notes",
    "customer_activities",
    "sites",
    "site_zones",
    "site_readiness",
    "site_timeline_events",
    "systems",
    "product_categories",
    "products",
    "quotes",
    "quote_versions",
    "quote_sections",
    "quote_items",
    "quote_packages",
    "quote_package_items",
    "quote_templates",
    "quote_template_items",
    "quote_public_access",
    "quote_events",
    "projects",
    "jobs",
    "assignments",
    "documents",
    "equipment",
    "leads",
    "tasks",
    "notifications",
    "notification_preferences",
    "invitations",
    "beta_participants",
    "feedback_reports",
    "pdf_document_templates",
    "generated_documents",
    "accounting_documents",
    "service_calls",
    "service_contracts",
    "warranties",
    "checklist_templates",
    "checklist_template_items",
    "job_checklist_items",
    "knowledge_articles",
    "after_action_reports",
    "audit_logs",
]


def vault_root() -> Path:
    raw = os.environ.get("SS_BACKUP_DIR") or str(ROOT / "_backup_vault")
    p = Path(raw)
    p.mkdir(parents=True, exist_ok=True)
    return p


def status_path() -> Path:
    return vault_root() / "LAST_STATUS.json"


def svc() -> tuple[str, str, dict[str, str]]:
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    return url, key, headers


def fetch_table(
    client: httpx.Client,
    url: str,
    headers: dict,
    table: str,
    *,
    workspace_ids: list[str] | None,
) -> list[dict]:
    rows: list[dict] = []
    start = 0
    page = 1000
    while True:
        params: dict[str, str] = {"select": "*", "order": "id"}
        if workspace_ids and table in WORKSPACE_SCOPED:
            params["workspace_id"] = f"in.({','.join(workspace_ids)})"
        elif workspace_ids and table == "workspaces":
            params["id"] = f"in.({','.join(workspace_ids)})"
        r = client.get(
            f"{url}/rest/v1/{table}",
            headers={**headers, "Range": f"{start}-{start + page - 1}"},
            params=params,
        )
        if r.status_code == 404:
            return []
        if r.status_code not in {200, 206}:
            # Some tables may not exist or lack id column — try without order.
            r2 = client.get(
                f"{url}/rest/v1/{table}",
                headers={**headers, "Range": f"{start}-{start + page - 1}"},
                params={k: v for k, v in params.items() if k != "order"},
            )
            if r2.status_code not in {200, 206}:
                raise RuntimeError(f"table {table}: {r.status_code} {r.text[:200]}")
            batch = r2.json()
        else:
            batch = r.json()
        if not isinstance(batch, list):
            raise RuntimeError(f"table {table}: bad payload")
        rows.extend(batch)
        if len(batch) < page:
            break
        start += page
    return rows


def fetch_auth_users(client: httpx.Client, url: str, headers: dict) -> list[dict]:
    users: list[dict] = []
    page = 1
    while True:
        r = client.get(
            f"{url}/auth/v1/admin/users",
            headers=headers,
            params={"page": page, "per_page": 200},
        )
        if r.status_code != 200:
            raise RuntimeError(f"auth users: {r.status_code} {r.text[:200]}")
        batch = (r.json() or {}).get("users") or []
        for u in batch:
            users.append(
                {
                    "id": u.get("id"),
                    "email": u.get("email"),
                    "phone": u.get("phone"),
                    "email_confirmed_at": u.get("email_confirmed_at"),
                    "app_metadata": u.get("app_metadata"),
                    "user_metadata": u.get("user_metadata"),
                    "created_at": u.get("created_at"),
                    "banned_until": u.get("banned_until"),
                    "role": u.get("role"),
                }
            )
        if len(batch) < 200:
            break
        page += 1
    return users


def list_storage_objects(client: httpx.Client, url: str, headers: dict, bucket: str) -> list[str]:
    paths: list[str] = []
    queue = [""]
    seen: set[str] = set()
    while queue:
        prefix = queue.pop(0)
        if prefix in seen:
            continue
        seen.add(prefix)
        r = client.post(
            f"{url}/storage/v1/object/list/{bucket}",
            headers=headers,
            json={"prefix": prefix, "limit": 1000, "offset": 0},
        )
        if r.status_code != 200:
            continue
        for item in r.json() or []:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "")
            if prefix:
                full = f"{prefix}{name}" if prefix.endswith("/") else f"{prefix}/{name}"
            else:
                full = name
            meta = item.get("metadata")
            if isinstance(meta, dict) or item.get("id"):
                paths.append(full)
            else:
                nxt = full if full.endswith("/") else f"{full}/"
                queue.append(nxt)
    return paths


def download_object(client: httpx.Client, url: str, headers: dict, bucket: str, path: str) -> bytes | None:
    r = client.get(f"{url}/storage/v1/object/{bucket}/{path.lstrip('/')}", headers=headers)
    if r.status_code != 200:
        return None
    return r.content


def write_status(payload: dict[str, Any]) -> None:
    status_path().write_text(json.dumps(payload, indent=2), encoding="utf-8")


def run_backup(*, workspace_ids: list[str] | None) -> Path:
    url, _key, headers = svc()
    backup_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    if workspace_ids:
        backup_id = f"{backup_id}_ws{len(workspace_ids)}"
    dest = vault_root() / backup_id
    db_dir = dest / "db"
    storage_dir = dest / "storage"
    db_dir.mkdir(parents=True, exist_ok=True)
    storage_dir.mkdir(parents=True, exist_ok=True)

    started = time.time()
    table_counts: dict[str, int] = {}
    errors: list[str] = []

    with httpx.Client(timeout=180) as client:
        # DB
        for table in TABLES:
            try:
                rows = fetch_table(client, url, headers, table, workspace_ids=workspace_ids)
                # Filter profiles to those referenced when workspace-scoped
                if workspace_ids and table == "profiles":
                    member_rows = fetch_table(
                        client, url, headers, "workspace_memberships", workspace_ids=workspace_ids
                    )
                    uids = {m.get("user_id") for m in member_rows}
                    rows = [r for r in rows if r.get("id") in uids]
                out = db_dir / f"{table}.jsonl"
                with out.open("w", encoding="utf-8") as fh:
                    for row in rows:
                        fh.write(json.dumps(row, default=str) + "\n")
                table_counts[table] = len(rows)
            except Exception as exc:  # noqa: BLE001
                errors.append(f"db:{table}:{exc}")
                table_counts[table] = -1

        # Auth
        try:
            users = fetch_auth_users(client, url, headers)
            if workspace_ids:
                member_rows = fetch_table(
                    client, url, headers, "workspace_memberships", workspace_ids=workspace_ids
                )
                uids = {m.get("user_id") for m in member_rows}
                users = [u for u in users if u.get("id") in uids]
            (db_dir / "auth_users.jsonl").write_text(
                "\n".join(json.dumps(u, default=str) for u in users) + ("\n" if users else ""),
                encoding="utf-8",
            )
            table_counts["auth_users"] = len(users)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"auth:{exc}")

        # Storage
        storage_manifest: list[dict[str, Any]] = []
        total_bytes = 0
        for bucket in BUCKETS:
            paths = list_storage_objects(client, url, headers, bucket)
            if workspace_ids:
                prefixes = tuple(f"{wid}/" for wid in workspace_ids)
                paths = [p for p in paths if p.startswith(prefixes)]
            bucket_dir = storage_dir / bucket
            for path in paths:
                data = download_object(client, url, headers, bucket, path)
                if data is None:
                    errors.append(f"storage_missing:{bucket}/{path}")
                    continue
                target = bucket_dir / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
                digest = hashlib.sha256(data).hexdigest()
                total_bytes += len(data)
                storage_manifest.append(
                    {
                        "bucket": bucket,
                        "path": path,
                        "bytes": len(data),
                        "sha256": digest,
                    }
                )

    duration = round(time.time() - started, 2)
    ok = not errors
    manifest = {
        "backup_id": backup_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "supabase_url_host": httpx.URL(url).host,
        "scope": {"workspace_ids": workspace_ids or "ALL"},
        "duration_seconds": duration,
        "table_counts": table_counts,
        "storage": {
            "object_count": len(storage_manifest),
            "total_bytes": total_bytes,
            "buckets": list(BUCKETS),
        },
        "storage_objects": storage_manifest,
        "errors": errors,
        "ok": ok,
        "auth_recovery_note": (
            "Password hashes are NOT included. Disaster recovery recreates users via Admin API "
            "with new passwords or password-reset emails; memberships/profiles restore from JSONL."
        ),
    }
    (dest / "MANIFEST.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (storage_dir / "MANIFEST.json").write_text(
        json.dumps(
            {
                "backup_id": backup_id,
                "created_at": manifest["created_at"],
                "object_count": len(storage_manifest),
                "total_bytes": total_bytes,
                "objects": storage_manifest,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    status = {
        "last_backup_id": backup_id,
        "last_backup_at": manifest["created_at"],
        "last_backup_ok": ok,
        "last_backup_age_hint": "compare last_backup_at to now",
        "path": str(dest),
        "db_ok": all(v >= 0 for v in table_counts.values()),
        "storage_object_count": len(storage_manifest),
        "storage_total_bytes": total_bytes,
        "error_count": len(errors),
        "errors_sample": errors[:20],
    }
    write_status(status)
    if not ok:
        raise SystemExit(f"BACKUP_FAILED {backup_id} errors={len(errors)}")
    print(json.dumps({"ok": True, "backup_id": backup_id, "path": str(dest), "status": status}, indent=2))
    return dest


def show_status() -> int:
    p = status_path()
    if not p.exists():
        print(json.dumps({"ok": False, "error": "no_status", "path": str(p)}, indent=2))
        return 1
    data = json.loads(p.read_text(encoding="utf-8"))
    print(json.dumps(data, indent=2))
    return 0 if data.get("last_backup_ok") else 2


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workspace-id", action="append", default=[])
    ap.add_argument("--status", action="store_true")
    args = ap.parse_args()
    if args.status:
        return show_status()
    run_backup(workspace_ids=args.workspace_id or None)
    return 0


if __name__ == "__main__":
    sys.exit(main())
