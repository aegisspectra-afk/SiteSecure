#!/usr/bin/env python3
"""Read-only Storage ↔ documents reconciliation (Gate 10B).

Default: report only. Never deletes objects or rows.

Usage:
  python apps/api/scripts/durability/storage_reconcile.py
  python apps/api/scripts/durability/storage_reconcile.py --json-out apps/api/scripts/durability/reports/reconcile.json

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env; never commit).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[4]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "apps" / "api" / ".env")

BUCKETS = ("documents", "photos", "signatures", "branding", "exports")
PAGE = 1000


def _svc() -> tuple[str, dict[str, str]]:
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "count=exact",
    }
    return url, headers


def _paginate_rest(client: httpx.Client, url: str, headers: dict, table: str, select: str) -> list[dict]:
    rows: list[dict] = []
    start = 0
    while True:
        end = start + PAGE - 1
        params: dict[str, str] = {"select": select}
        # Prefer stable order when possible
        if table != "workspace_settings":
            params["order"] = "id"
        else:
            params["order"] = "workspace_id"
        r = client.get(
            f"{url}/rest/v1/{table}",
            headers={**headers, "Range": f"{start}-{end}"},
            params=params,
        )
        if r.status_code not in {200, 206}:
            raise SystemExit(f"REST {table} failed {r.status_code}: {r.text[:300]}")
        batch = r.json()
        if not isinstance(batch, list):
            raise SystemExit(f"unexpected {table} payload")
        rows.extend(batch)
        if len(batch) < PAGE:
            break
        start += PAGE
    return rows


def _list_storage(client: httpx.Client, url: str, headers: dict, bucket: str) -> list[dict]:
    """List all objects under bucket via Storage API (recursive BFS on prefixes)."""
    found: list[dict] = []
    queue = [""]
    seen_prefixes: set[str] = set()
    while queue:
        prefix = queue.pop(0)
        if prefix in seen_prefixes:
            continue
        seen_prefixes.add(prefix)
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
            # Folders often have id null and no metadata size.
            meta = item.get("metadata")
            is_file = isinstance(meta, dict) or item.get("id")
            full = f"{prefix}{name}" if not prefix else (f"{prefix}{name}" if prefix.endswith("/") else f"{prefix}/{name}")
            if prefix == "":
                full = name
            elif not prefix.endswith("/"):
                full = f"{prefix}/{name}"
            else:
                full = f"{prefix}{name}"
            if is_file and meta is not None:
                found.append({"bucket": bucket, "name": full, "metadata": meta})
            else:
                # Treat as folder prefix
                nxt = full if full.endswith("/") else f"{full}/"
                if nxt not in seen_prefixes:
                    queue.append(nxt)
    return found


def classify(doc: dict, obj_ok: bool) -> str:
    if obj_ok:
        return "HEALTHY"
    fname = (doc.get("original_filename") or "") or ""
    path = doc.get("storage_path") or ""
    kind = doc.get("kind") or ""
    byte_size = doc.get("byte_size")
    if byte_size is not None:
        return "OBJECT_MISSING"
    if fname in {"spec.pdf", "small.txt"} or path.endswith("/pad.bin"):
        return "QA_FIXTURE"
    if fname in {"secret.pdf", "field.pdf"}:
        return "QA_FIXTURE"
    if fname.startswith("qa_"):
        return "QA_FIXTURE"
    if byte_size is None and doc.get("reserved_bytes"):
        return "METADATA_ONLY_BY_DESIGN"
    if byte_size is None:
        return "METADATA_ONLY_BY_DESIGN"
    if kind:
        return "UNKNOWN"
    return "UNKNOWN"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json-out", type=Path, default=None)
    args = ap.parse_args()

    url, headers = _svc()
    report: dict = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "READ_ONLY",
        "buckets": {},
        "documents_classification": {},
        "samples": {"object_missing": [], "incomplete": []},
    }

    with httpx.Client(timeout=120) as client:
        docs = _paginate_rest(
            client,
            url,
            headers,
            "documents",
            "id,workspace_id,kind,storage_bucket,storage_path,byte_size,reserved_bytes,original_filename,created_at",
        )
        objects: list[dict] = []
        # storage.objects via PostgREST schema header
        start = 0
        while True:
            end = start + PAGE - 1
            r = client.get(
                f"{url}/rest/v1/objects",
                headers={
                    **headers,
                    "Accept-Profile": "storage",
                    "Content-Profile": "storage",
                    "Range": f"{start}-{end}",
                },
                params={"select": "id,bucket_id,name,created_at", "order": "name"},
            )
            if r.status_code not in {200, 206}:
                objects = []
                break
            batch = r.json()
            if not isinstance(batch, list):
                break
            objects.extend(batch)
            if len(batch) < PAGE:
                break
            start += PAGE
        if not objects:
            for b in BUCKETS:
                objects.extend(
                    [
                        {"bucket_id": b, "name": o["name"], "id": None, "created_at": None}
                        for o in _list_storage(client, url, headers, b)
                    ]
                )

        obj_keys = {(o.get("bucket_id") or o.get("bucket"), o.get("name")) for o in objects}
        class_counts: Counter[str] = Counter()
        by_bucket_docs: dict[str, dict[str, int]] = {b: {"db_refs": 0, "healthy": 0, "missing": 0} for b in BUCKETS}

        for d in docs:
            bucket = d.get("storage_bucket") or ""
            path = d.get("storage_path") or ""
            ok = (bucket, path) in obj_keys
            label = classify(d, ok)
            class_counts[label] += 1
            if bucket in by_bucket_docs:
                by_bucket_docs[bucket]["db_refs"] += 1
                by_bucket_docs[bucket]["healthy" if ok else "missing"] += 1
            sample = {
                "id": d.get("id"),
                "workspace_id": d.get("workspace_id"),
                "kind": d.get("kind"),
                "bucket": bucket,
                "class": label,
                "byte_size": d.get("byte_size"),
                "reserved_bytes": d.get("reserved_bytes"),
                "filename_sanitized": (d.get("original_filename") or "")[:40],
            }
            if label == "OBJECT_MISSING" and len(report["samples"]["object_missing"]) < 20:
                report["samples"]["object_missing"].append(sample)
            if label in {"METADATA_ONLY_BY_DESIGN", "QA_FIXTURE"} and len(report["samples"]["incomplete"]) < 20:
                report["samples"]["incomplete"].append(sample)

        # branding orphans vs documents: expected when logo lives in workspace_settings
        settings = _paginate_rest(
            client,
            url,
            headers,
            "workspace_settings",
            "workspace_id,branding",
        )
        logo_paths: set[tuple[str, str]] = set()
        for s in settings:
            cp = s.get("branding") or {}
            if not isinstance(cp, dict):
                continue
            path = cp.get("logoStoragePath") or cp.get("logo_storage_path")
            bucket = cp.get("logoBucket") or "branding"
            if path:
                logo_paths.add((bucket, str(path)))

        orphans = []
        for o in objects:
            b = o.get("bucket_id") or o.get("bucket")
            name = o.get("name")
            linked_doc = any(
                d.get("storage_bucket") == b and d.get("storage_path") == name for d in docs
            )
            linked_logo = (b, name) in logo_paths
            if not linked_doc and not linked_logo:
                orphans.append({"bucket": b, "name_suffix": str(name)[-48:] if name else ""})

        for b in BUCKETS:
            objs = [o for o in objects if (o.get("bucket_id") or o.get("bucket")) == b]
            linked = sum(
                1
                for o in objs
                if any(d.get("storage_bucket") == b and d.get("storage_path") == o.get("name") for d in docs)
                or (b, o.get("name")) in logo_paths
            )
            report["buckets"][b] = {
                **by_bucket_docs.get(b, {"db_refs": 0, "healthy": 0, "missing": 0}),
                "storage_objects": len(objs),
                "objects_with_db_or_logo_ref": linked,
                "objects_orphan": len(objs) - linked,
            }

    report["documents_classification"] = dict(class_counts)
    report["documents_total"] = sum(class_counts.values())
    report["storage_orphans_sample"] = orphans[:30]
    report["notes"] = [
        "METADATA_ONLY_BY_DESIGN = upload reservation (documents row before Storage PUT; byte_size null).",
        "QA_FIXTURE = known automated test filenames (spec.pdf/small.txt/pad.bin/secret.pdf/field.pdf).",
        "OBJECT_MISSING = completed metadata (byte_size set) without Storage object.",
        "branding objects may reference workspace_settings.branding.logoStoragePath, not documents.",
        "Destructive repair requires explicit operator action — not performed by this tool.",
    ]

    text = json.dumps(report, indent=2, ensure_ascii=False)
    print(text)
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(text, encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
