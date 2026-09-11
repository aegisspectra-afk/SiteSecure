#!/usr/bin/env python3
"""Gate 10B end-to-end durability drill (disposable QA only).

1. Create Workspace A + B QA tenants with lifecycle objects + real Storage uploads
2. Backup (DB+Storage) to off-site vault
3. Destroy QA workspace rows + Storage objects on live (QA only)
4. Restore from vault
5. Verify relationships, files, tenant isolation, authz via API

Never destroys non-GATE10B workspaces.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from logical_backup import run_backup, vault_root  # noqa: E402
from logical_restore import restore  # noqa: E402

ROOT = Path(__file__).resolve().parents[4]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "apps" / "api" / ".env")

API = os.environ.get("API_URL") or os.environ.get("MAPS_API_URL") or "http://127.0.0.1:8010"
SUP = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
REPORT_DIR = HERE / "reports"
REPORT_DIR.mkdir(parents=True, exist_ok=True)

SH = {"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}", "Content-Type": "application/json"}


def ensure_user(client: httpx.Client, email: str, password: str) -> tuple[str, str]:
    client.post(
        f"{SUP}/auth/v1/signup",
        headers={"apikey": ANON, "Content-Type": "application/json"},
        json={"email": email, "password": password},
    )
    listed = client.get(f"{SUP}/auth/v1/admin/users", headers=SH, params={"page": 1, "per_page": 200}).json()
    uid = next(
        (u["id"] for u in (listed.get("users") or []) if (u.get("email") or "").lower() == email.lower()),
        None,
    )
    if uid:
        client.put(
            f"{SUP}/auth/v1/admin/users/{uid}",
            headers=SH,
            json={"email_confirm": True, "password": password},
        )
    else:
        created = client.post(
            f"{SUP}/auth/v1/admin/users",
            headers=SH,
            json={"email": email, "password": password, "email_confirm": True},
        )
        uid = created.json()["id"]
    tok = client.post(
        f"{SUP}/auth/v1/token?grant_type=password",
        headers={"apikey": ANON, "Content-Type": "application/json"},
        json={"email": email, "password": password},
    )
    if tok.status_code != 200:
        raise RuntimeError(f"login {email}: {tok.status_code} {tok.text}")
    return uid, tok.json()["access_token"]


def auth_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "apikey": ANON,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def create_workspace(client: httpx.Client, token: str, name: str) -> str:
    r = client.post(
        f"{SUP}/rest/v1/rpc/create_workspace",
        headers=auth_headers(token),
        json={"p_name": name, "p_plan_key": "solo"},
    )
    body = r.json()
    wid = body if isinstance(body, str) else (body.get("id") if isinstance(body, dict) else None)
    if not wid or r.status_code >= 400:
        raise RuntimeError(f"create_workspace: {r.status_code} {body}")
    return str(wid)


def rest_insert(client: httpx.Client, table: str, row: dict) -> dict:
    r = client.post(
        f"{SUP}/rest/v1/{table}",
        headers={**SH, "Prefer": "return=representation"},
        json=row,
    )
    if r.status_code not in {200, 201}:
        raise RuntimeError(f"insert {table}: {r.status_code} {r.text[:300]}")
    data = r.json()
    return data[0] if isinstance(data, list) else data


def upload_via_api(
    client: httpx.Client,
    *,
    api: str,
    token: str,
    workspace_id: str,
    entity_type: str,
    entity_id: str,
    kind: str,
    filename: str,
    content: bytes,
    mime: str,
) -> dict[str, Any]:
    intent = client.post(
        f"{api}/api/v1/workspaces/{workspace_id}/documents/uploads",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={
            "entity_type": entity_type,
            "entity_id": entity_id,
            "kind": kind,
            "mime_type": mime,
            "original_filename": filename,
            "byte_size": len(content),
        },
    )
    if intent.status_code not in {200, 201}:
        raise RuntimeError(f"upload intent: {intent.status_code} {intent.text[:300]}")
    body = intent.json()
    put = client.put(
        body["upload_url"],
        headers={"Content-Type": mime, "x-upsert": "true"},
        content=content,
    )
    if put.status_code not in {200, 201}:
        raise RuntimeError(f"storage put: {put.status_code} {put.text[:200]}")
    done = client.post(
        f"{api}/api/v1/workspaces/{workspace_id}/documents/{body['document_id']}/complete",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"byte_size": len(content), "mime_type": mime, "checksum": hashlib.sha256(content).hexdigest()},
    )
    if done.status_code not in {200, 201}:
        raise RuntimeError(f"complete: {done.status_code} {done.text[:300]}")
    return {"document_id": body["document_id"], "storage_path": body["storage_path"], "bucket": body["storage_bucket"]}


def add_membership(client: httpx.Client, workspace_id: str, user_id: str, role_key: str) -> None:
    existing = client.get(
        f"{SUP}/rest/v1/workspace_memberships",
        headers=SH,
        params={"workspace_id": f"eq.{workspace_id}", "user_id": f"eq.{user_id}", "select": "id"},
    ).json()
    if existing:
        return
    r = client.post(
        f"{SUP}/rest/v1/workspace_memberships",
        headers={**SH, "Prefer": "return=representation"},
        json={
            "workspace_id": workspace_id,
            "user_id": user_id,
            "role_key": role_key,
            "workspace_role_key": role_key,
            "status": "active",
        },
    )
    if r.status_code not in {200, 201}:
        raise RuntimeError(f"membership: {r.status_code} {r.text[:300]}")


def wipe_workspace(client: httpx.Client, workspace_id: str) -> None:
    """Delete QA workspace data + storage objects. Order: children first."""
    docs = client.get(
        f"{SUP}/rest/v1/documents",
        headers=SH,
        params={"workspace_id": f"eq.{workspace_id}", "select": "storage_bucket,storage_path"},
    ).json()
    for d in docs or []:
        bucket = d["storage_bucket"]
        path = d["storage_path"]
        client.request(
            "DELETE",
            f"{SUP}/storage/v1/object/{bucket}",
            headers=SH,
            json={"prefixes": [path]},
        )
        client.delete(
            f"{SUP}/storage/v1/object/{bucket}/{path.lstrip('/')}",
            headers=SH,
        )
    for bucket in ("documents", "photos", "signatures", "branding", "exports"):
        client.request(
            "DELETE",
            f"{SUP}/storage/v1/object/{bucket}",
            headers=SH,
            json={"prefixes": [f"{workspace_id}/"]},
        )

    tables = [
        "documents",
        "assignments",
        "jobs",
        "projects",
        "quote_events",
        "quote_public_access",
        "quote_package_items",
        "quote_packages",
        "quote_items",
        "quote_sections",
        "quote_versions",
        "quotes",
        "products",
        "product_categories",
        "sites",
        "customers",
        "beta_participants",
        "workspace_memberships",
        "workspace_settings",
        "workspace_feature_overrides",
        "workspace_roles",
        "subscriptions",
        "workspace_counters",
        "pdf_document_templates",
        "checklist_template_items",
        "checklist_templates",
    ]
    for t in tables:
        client.delete(
            f"{SUP}/rest/v1/{t}",
            headers=SH,
            params={"workspace_id": f"eq.{workspace_id}"},
        )
    client.delete(f"{SUP}/rest/v1/workspaces", headers=SH, params={"id": f"eq.{workspace_id}"})


def seed_workspace_a(client: httpx.Client, run: int, password: str) -> dict[str, Any]:
    from zoneinfo import ZoneInfo

    owner_email = f"gate10b.a.owner.{run}@sitesecure.test"
    tech_email = f"gate10b.a.tech.{run}@sitesecure.test"
    owner_id, owner_tok = ensure_user(client, owner_email, password)
    tech_id, tech_tok = ensure_user(client, tech_email, password)
    ws = create_workspace(client, owner_tok, f"GATE10B-QA-A-{run}")
    add_membership(client, ws, tech_id, "technician")

    client.patch(
        f"{SUP}/rest/v1/profiles",
        headers=SH,
        params={"id": f"eq.{tech_id}"},
        json={"recognition_badges": ["founding_technician"]},
    )

    h = {"Authorization": f"Bearer {owner_tok}", "Content-Type": "application/json"}
    cust = client.post(
        f"{API}/api/v1/workspaces/{ws}/customers",
        headers=h,
        json={"display_name": f"QA Customer A {run}"},
    )
    if cust.status_code >= 400:
        raise RuntimeError(f"customer: {cust.status_code} {cust.text[:300]}")
    customer = cust.json()
    site_r = client.post(
        f"{API}/api/v1/workspaces/{ws}/sites",
        headers=h,
        json={"customer_id": customer["id"], "name": f"QA Site A {run}", "address": {"line": "QA"}},
    )
    if site_r.status_code >= 400:
        raise RuntimeError(f"site: {site_r.status_code} {site_r.text[:300]}")
    site = site_r.json()

    product = rest_insert(
        client,
        "products",
        {
            "workspace_id": ws,
            "name": f"QA Cam A {run}",
            "sku": f"QA-CAM-A-{run}",
            "list_price": 100,
            "is_active": True,
        },
    )

    quote_r = client.post(
        f"{API}/api/v1/workspaces/{ws}/quotes",
        headers=h,
        json={"customer_id": customer["id"], "site_id": site["id"], "title": f"QA Quote A {run}"},
    )
    if quote_r.status_code >= 400:
        raise RuntimeError(f"quote: {quote_r.status_code} {quote_r.text[:300]}")
    quote = quote_r.json()
    line = {"id": None}
    try:
        line = rest_insert(
            client,
            "quote_items",
            {
                "workspace_id": ws,
                "quote_id": quote["id"],
                "product_id": product["id"],
                "item_type": "catalog",
                "description": product["name"],
                "name": product["name"],
                "sku": product["sku"],
                "qty": 2,
                "unit_price": 100,
            },
        )
    except Exception as exc:  # noqa: BLE001
        print("quote_items note", exc)

    project = None
    try:
        project = rest_insert(
            client,
            "projects",
            {
                "workspace_id": ws,
                "customer_id": customer["id"],
                "site_id": site["id"],
                "name": f"QA Project A {run}",
                "created_by": owner_id,
            },
        )
    except Exception as exc:  # noqa: BLE001
        print("project note", exc)
        project = {"id": None}

    local_now = datetime.now(ZoneInfo("Asia/Jerusalem"))
    scheduled = local_now.replace(hour=10, minute=0, second=0, microsecond=0).astimezone(timezone.utc).isoformat()
    job_r = client.post(
        f"{API}/api/v1/workspaces/{ws}/jobs",
        headers=h,
        json={
            "title": f"QA Job A {run}",
            "customer_id": customer["id"],
            "site_id": site["id"],
            "kind": "service",
            "scheduled_for": scheduled,
            **({"project_id": project["id"]} if project.get("id") else {}),
        },
    )
    if job_r.status_code >= 400:
        raise RuntimeError(f"job: {job_r.status_code} {job_r.text[:300]}")
    job = job_r.json()

    assign = client.post(
        f"{API}/api/v1/workspaces/{ws}/jobs/{job['id']}/assign",
        headers=h,
        json={"user_id": tech_id},
    )
    if assign.status_code >= 400:
        assignment = rest_insert(
            client,
            "assignments",
            {
                "workspace_id": ws,
                "user_id": tech_id,
                "resource_type": "job",
                "resource_id": job["id"],
            },
        )
    else:
        assignment = assign.json() if assign.content else {"id": None}
        if not assignment.get("id"):
            rows = client.get(
                f"{SUP}/rest/v1/assignments",
                headers=SH,
                params={
                    "workspace_id": f"eq.{ws}",
                    "resource_id": f"eq.{job['id']}",
                    "select": "id",
                },
            ).json()
            assignment = rows[0] if rows else {"id": None}

    try:
        rest_insert(
            client,
            "beta_participants",
            {
                "user_id": tech_id,
                "workspace_id": ws,
                "status": "active",
                "cohort": "gate10b",
            },
        )
    except Exception as exc:  # noqa: BLE001
        print("beta_participants skip", exc)

    doc_bytes = f"GATE10B doc {run}\n".encode()
    photo_bytes = (
        b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
        + f"QA{run}".encode()
        + b"\xff\xd9"
    )
    doc = upload_via_api(
        client,
        api=API,
        token=owner_tok,
        workspace_id=ws,
        entity_type="site",
        entity_id=site["id"],
        kind="document",
        filename=f"gate10b-a-{run}.txt",
        content=doc_bytes,
        mime="text/plain",
    )
    photo = upload_via_api(
        client,
        api=API,
        token=tech_tok,
        workspace_id=ws,
        entity_type="job",
        entity_id=job["id"],
        kind="photo",
        filename=f"gate10b-a-{run}.jpg",
        content=photo_bytes,
        mime="image/jpeg",
    )

    return {
        "workspace_id": ws,
        "owner_email": owner_email,
        "tech_email": tech_email,
        "owner_id": owner_id,
        "tech_id": tech_id,
        "password": password,
        "customer_id": customer["id"],
        "site_id": site["id"],
        "quote_id": quote["id"],
        "quote_line_id": line.get("id"),
        "product_id": product["id"],
        "project_id": project.get("id"),
        "job_id": job["id"],
        "assignment_id": assignment.get("id"),
        "document": doc,
        "photo": photo,
        "doc_sha256": hashlib.sha256(doc_bytes).hexdigest(),
        "photo_sha256": hashlib.sha256(photo_bytes).hexdigest(),
        "owner_token": owner_tok,
        "tech_token": tech_tok,
    }


def seed_workspace_b(client: httpx.Client, run: int, password: str) -> dict[str, Any]:
    owner_email = f"gate10b.b.owner.{run}@sitesecure.test"
    owner_id, owner_tok = ensure_user(client, owner_email, password)
    ws = create_workspace(client, owner_tok, f"GATE10B-QA-B-{run}")
    h = {"Authorization": f"Bearer {owner_tok}", "Content-Type": "application/json"}
    cust = client.post(
        f"{API}/api/v1/workspaces/{ws}/customers",
        headers=h,
        json={"display_name": f"QA Customer B SECRET {run}"},
    )
    if cust.status_code >= 400:
        raise RuntimeError(f"customer B: {cust.status_code} {cust.text[:300]}")
    customer = cust.json()
    site_r = client.post(
        f"{API}/api/v1/workspaces/{ws}/sites",
        headers=h,
        json={"customer_id": customer["id"], "name": f"QA Site B SECRET {run}", "address": {"line": "QA-B"}},
    )
    if site_r.status_code >= 400:
        raise RuntimeError(f"site B: {site_r.status_code} {site_r.text[:300]}")
    site = site_r.json()
    product = rest_insert(
        client,
        "products",
        {
            "workspace_id": ws,
            "name": f"QA Cam B {run}",
            "sku": f"QA-CAM-B-{run}",
            "list_price": 999,
            "is_active": True,
        },
    )
    return {
        "workspace_id": ws,
        "owner_email": owner_email,
        "owner_id": owner_id,
        "password": password,
        "customer_id": customer["id"],
        "site_id": site["id"],
        "product_id": product["id"],
        "owner_token": owner_tok,
    }


def verify_object(client: httpx.Client, bucket: str, path: str, expected_sha: str) -> bool:
    r = client.get(
        f"{SUP}/storage/v1/object/{bucket}/{path}",
        headers={**SH, "Cache-Control": "no-cache", "Pragma": "no-cache"},
        params={"t": str(time.time())},
    )
    if r.status_code != 200:
        return False
    return hashlib.sha256(r.content).hexdigest() == expected_sha


def object_sha(client: httpx.Client, bucket: str, path: str) -> str | None:
    r = client.get(
        f"{SUP}/storage/v1/object/{bucket}/{path}",
        headers={**SH, "Cache-Control": "no-cache"},
        params={"t": str(time.time())},
    )
    if r.status_code != 200:
        return None
    return hashlib.sha256(r.content).hexdigest()


def api_check(client: httpx.Client, method: str, path: str, token: str, expect: set[int]) -> int:
    r = client.request(
        method,
        f"{API}{path}",
        headers={"Authorization": f"Bearer {token}"},
    )
    if r.status_code not in expect:
        raise RuntimeError(f"{method} {path} -> {r.status_code} expected {expect} body={r.text[:200]}")
    return r.status_code


def main() -> int:
    run = int(time.time())
    password = f"Gate10b-{run}-Qa!"
    report: dict[str, Any] = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "run": run,
        "api": API,
        "checks": {},
    }
    timings: dict[str, float] = {}

    with httpx.Client(timeout=180) as client:
        t0 = time.time()
        print("Seeding Workspace A/B…", flush=True)
        a = seed_workspace_a(client, run, password)
        b = seed_workspace_b(client, run, password)
        timings["seed_seconds"] = round(time.time() - t0, 2)
        report["qa"] = {
            "a": {k: v for k, v in a.items() if k not in {"owner_token", "tech_token", "password"}},
            "b": {k: v for k, v in b.items() if k not in {"owner_token", "password"}},
        }
        ws_ids = [a["workspace_id"], b["workspace_id"]]

        # Pre-backup file proof
        assert verify_object(client, a["document"]["bucket"], a["document"]["storage_path"], a["doc_sha256"])
        assert verify_object(client, a["photo"]["bucket"], a["photo"]["storage_path"], a["photo_sha256"])

        t1 = time.time()
        print("Backing up…", flush=True)
        dest = run_backup(workspace_ids=ws_ids)
        backup_id = dest.name
        timings["backup_seconds"] = round(time.time() - t1, 2)
        report["backup_id"] = backup_id

        t2 = time.time()
        print("Destroying QA source (DB wipe + Storage overwrite)…", flush=True)
        # Prove independence: mutate Storage bytes so live objects no longer match manifest checksums.
        for item, sha in (
            (a["document"], a["doc_sha256"]),
            (a["photo"], a["photo_sha256"]),
        ):
            poison = b"POISONED-FOR-GATE10B-DRILL-" + os.urandom(16)
            up = client.post(
                f"{SUP}/storage/v1/object/{item['bucket']}/{item['storage_path'].lstrip('/')}",
                headers={
                    **SH,
                    "Content-Type": "application/octet-stream",
                    "x-upsert": "true",
                    "cache-control": "no-cache",
                },
                content=poison,
            )
            if up.status_code not in {200, 201}:
                raise RuntimeError(f"poison upload failed: {up.status_code} {up.text[:200]}")
            live = object_sha(client, item["bucket"], item["storage_path"])
            if live == sha:
                raise RuntimeError(f"poison did not change object bytes: {item['bucket']}/{item['storage_path']}")
        wipe_workspace(client, a["workspace_id"])
        wipe_workspace(client, b["workspace_id"])
        timings["destroy_seconds"] = round(time.time() - t2, 2)

        # Prove gone
        gone_doc = client.get(
            f"{SUP}/rest/v1/documents",
            headers=SH,
            params={"id": f"eq.{a['document']['document_id']}", "select": "id"},
        ).json()
        report["checks"]["destroyed_document_absent"] = gone_doc == []
        # After poison, original checksum must not match (object may still exist as poisoned bytes).
        report["checks"]["destroyed_storage_checksum_broken"] = not verify_object(
            client, a["document"]["bucket"], a["document"]["storage_path"], a["doc_sha256"]
        ) and not verify_object(
            client, a["photo"]["bucket"], a["photo"]["storage_path"], a["photo_sha256"]
        )

        t3 = time.time()
        print("Restoring…", flush=True)
        restore_result = restore(backup_id, workspace_ids=ws_ids, qa_password=password)
        timings["restore_seconds"] = round(time.time() - t3, 2)
        report["restore"] = restore_result

        # Re-login after restore (sessions not assumed)
        _, owner_tok = ensure_user(client, a["owner_email"], password)
        _, tech_tok = ensure_user(client, a["tech_email"], password)
        a["owner_token"], a["tech_token"] = owner_tok, tech_tok

        # Integrity
        cust = client.get(
            f"{SUP}/rest/v1/customers",
            headers=SH,
            params={"id": f"eq.{a['customer_id']}", "select": "id,workspace_id"},
        ).json()
        site = client.get(
            f"{SUP}/rest/v1/sites",
            headers=SH,
            params={"id": f"eq.{a['site_id']}", "select": "id,customer_id,workspace_id"},
        ).json()
        quote = client.get(
            f"{SUP}/rest/v1/quotes",
            headers=SH,
            params={"id": f"eq.{a['quote_id']}", "select": "id,customer_id,site_id,workspace_id"},
        ).json()
        job = client.get(
            f"{SUP}/rest/v1/jobs",
            headers=SH,
            params={"id": f"eq.{a['job_id']}", "select": "id,project_id,site_id,workspace_id"},
        ).json()
        asn = client.get(
            f"{SUP}/rest/v1/assignments",
            headers=SH,
            params={
                "workspace_id": f"eq.{a['workspace_id']}",
                "resource_type": "eq.job",
                "resource_id": f"eq.{a['job_id']}",
                "select": "id,resource_id,user_id,workspace_id",
            },
        ).json()
        report["checks"]["relationship_integrity"] = bool(
            cust
            and site
            and quote
            and job
            and asn
            and cust[0]["workspace_id"] == a["workspace_id"]
            and site[0]["customer_id"] == a["customer_id"]
            and quote[0]["site_id"] == a["site_id"]
            and asn[0]["user_id"] == a["tech_id"]
            and asn[0]["resource_id"] == a["job_id"]
        )

        report["checks"]["document_recovery"] = verify_object(
            client, a["document"]["bucket"], a["document"]["storage_path"], a["doc_sha256"]
        )
        report["checks"]["photo_recovery"] = verify_object(
            client, a["photo"]["bucket"], a["photo"]["storage_path"], a["photo_sha256"]
        )

        # Catalog isolation
        prods_a = client.get(
            f"{SUP}/rest/v1/products",
            headers=SH,
            params={"workspace_id": f"eq.{a['workspace_id']}", "select": "id,sku"},
        ).json()
        prods_b = client.get(
            f"{SUP}/rest/v1/products",
            headers=SH,
            params={"workspace_id": f"eq.{b['workspace_id']}", "select": "id,sku"},
        ).json()
        report["checks"]["catalog"] = (
            any(p["id"] == a["product_id"] for p in prods_a)
            and any(p["id"] == b["product_id"] for p in prods_b)
            and all(p["id"] != b["product_id"] for p in prods_a)
        )

        # Badges
        prof = client.get(
            f"{SUP}/rest/v1/profiles",
            headers=SH,
            params={"id": f"eq.{a['tech_id']}", "select": "recognition_badges,is_platform_admin"},
        ).json()
        badges = (prof[0].get("recognition_badges") or []) if prof else []
        report["checks"]["beta_badge"] = "founding_technician" in badges and not prof[0].get("is_platform_admin")

        # API smoke / authz (requires API up)
        try:
            api_check(client, "GET", f"/api/v1/workspaces/{a['workspace_id']}/customers", owner_tok, {200})
            api_check(client, "GET", f"/api/v1/workspaces/{a['workspace_id']}/sites", owner_tok, {200})
            # cross-tenant
            api_check(
                client,
                "GET",
                f"/api/v1/workspaces/{b['workspace_id']}/customers",
                owner_tok,
                {401, 403, 404},
            )
            # technician commercial deny
            api_check(
                client,
                "GET",
                f"/api/v1/workspaces/{a['workspace_id']}/quotes",
                tech_tok,
                {401, 403},
            )
            api_check(
                client,
                "GET",
                f"/api/v1/workspaces/{a['workspace_id']}/catalog/products",
                tech_tok,
                {401, 403, 404},
            )
            # technician assigned surface
            api_check(client, "GET", f"/api/v1/workspaces/{a['workspace_id']}/jobs", tech_tok, {200})
            # document url
            api_check(
                client,
                "GET",
                f"/api/v1/workspaces/{a['workspace_id']}/documents/{a['document']['document_id']}/url",
                owner_tok,
                {200},
            )
            report["checks"]["authorization"] = True
            report["checks"]["tenant_isolation"] = True
            report["checks"]["app_smoke"] = True
        except Exception as exc:  # noqa: BLE001
            report["checks"]["authorization"] = False
            report["checks"]["tenant_isolation"] = False
            report["checks"]["app_smoke"] = False
            report["api_error"] = str(exc)

        # PDF regen if endpoint available
        try:
            pdf = client.get(
                f"{API}/api/v1/workspaces/{a['workspace_id']}/quotes/{a['quote_id']}/pdf",
                headers={"Authorization": f"Bearer {owner_tok}"},
            )
            report["checks"]["pdf"] = pdf.status_code == 200 and pdf.headers.get("content-type", "").startswith(
                "application/pdf"
            )
        except Exception as exc:  # noqa: BLE001
            report["checks"]["pdf"] = False
            report["pdf_error"] = str(exc)

        # CCTV recommend smoke
        try:
            cctv = client.post(
                f"{API}/api/v1/workspaces/{a['workspace_id']}/cctv/recommend",
                headers={"Authorization": f"Bearer {owner_tok}", "Content-Type": "application/json"},
                json={"site_id": a["site_id"], "requirements": {"cameras": 1}},
            )
            report["checks"]["cctv"] = cctv.status_code in {200, 400, 422}  # executable; 400 ok if validation
            report["cctv_status"] = cctv.status_code
        except Exception as exc:  # noqa: BLE001
            report["checks"]["cctv"] = False
            report["cctv_error"] = str(exc)

    timings["total_seconds"] = round(sum(v for v in timings.values()), 2)
    report["timings"] = timings
    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    report["rpo_note"] = "Operator-run logical vault; cadence = whenever logical_backup.py runs (document schedule)."
    report["ok"] = all(
        [
            report["checks"].get("destroyed_document_absent"),
            report["checks"].get("destroyed_storage_checksum_broken"),
            report["checks"].get("relationship_integrity"),
            report["checks"].get("document_recovery"),
            report["checks"].get("photo_recovery"),
            report["checks"].get("catalog"),
            report["checks"].get("beta_badge"),
            report["checks"].get("authorization"),
            report["checks"].get("tenant_isolation"),
            report["checks"].get("app_smoke"),
            report["checks"].get("pdf"),
        ]
    )

    out = REPORT_DIR / f"gate10b_drill_{run}.json"
    out.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    print(json.dumps(report, indent=2, default=str))
    print("REPORT", out)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
