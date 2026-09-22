#!/usr/bin/env python3
"""Reprobe failed external smoke items using last report workspace if possible."""
from __future__ import annotations

import hashlib
import json
import os
import uuid
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv("apps/api/.env")

API = "https://site-secure-api-staging.onrender.com"
SUP = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
REP = Path("apps/api/scripts/_final_external_beta_smoke/report.json")
report = json.loads(REP.read_text(encoding="utf-8"))
RUN = report["run"]
WS = report["workspace_a"]
PASSWORD = f"ExtBeta-{RUN}-Qa2026!"
OWNER = f"extbeta.owner.{RUN}@sitesecure.test"
TECH = f"extbeta.tech.{RUN}@sitesecure.test"


def tok(email: str) -> str:
    r = httpx.post(
        f"{SUP}/auth/v1/token?grant_type=password",
        headers={"apikey": ANON, "Content-Type": "application/json"},
        json={"email": email, "password": PASSWORD},
        timeout=45,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def main() -> None:
    c = httpx.Client(timeout=120)
    ot = tok(OWNER)
    tt = tok(TECH)
    oh = {"Authorization": f"Bearer {ot}", "Content-Type": "application/json"}
    th = {"Authorization": f"Bearer {tt}", "Content-Type": "application/json"}

    # quotes/catalog for tech
    for path in [f"/api/v1/workspaces/{WS}/quotes", f"/api/v1/workspaces/{WS}/catalog/products"]:
        r = c.get(API + path, headers=th, params={"limit": 20})
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        items = (body or {}).get("items") if isinstance(body, dict) else body
        print("TECH GET", path, r.status_code, "items", len(items or []) if isinstance(items, list) else items, str(body)[:180])

    # tech create quote should deny
    r = c.post(
        API + f"/api/v1/workspaces/{WS}/quotes",
        headers=th,
        json={"title": "hack", "vat_percent": 18},
    )
    print("TECH POST quote", r.status_code, r.text[:200])

    # owner upload again
    sites = c.get(f"{API}/api/v1/workspaces/{WS}/sites", headers=oh, params={"limit": 5}).json()
    site_id = (sites.get("items") or [])[0]["id"]
    content = f"reprobe-{uuid.uuid4().hex[:8]}".encode()
    intent = c.post(
        f"{API}/api/v1/workspaces/{WS}/documents/uploads",
        headers=oh,
        json={
            "entity_type": "site",
            "entity_id": site_id,
            "kind": "document",
            "mime_type": "text/plain",
            "original_filename": "reprobe.txt",
            "byte_size": len(content),
        },
    )
    print("intent", intent.status_code)
    body = intent.json()
    put = c.put(body["upload_url"], headers={"Content-Type": "text/plain", "x-upsert": "true"}, content=content)
    print("put", put.status_code)
    done = c.post(
        f"{API}/api/v1/workspaces/{WS}/documents/{body['document_id']}/complete",
        headers=oh,
        json={"byte_size": len(content), "mime_type": "text/plain", "checksum": hashlib.sha256(content).hexdigest()},
    )
    print("complete", done.status_code, done.text[:200])
    url = c.get(f"{API}/api/v1/workspaces/{WS}/documents/{body['document_id']}/url", headers=oh)
    print("url", url.status_code)

    # classify via service
    svc = {"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}"}
    row = c.get(
        f"{SUP}/rest/v1/documents",
        headers=svc,
        params={"id": f"eq.{body['document_id']}", "select": "id,byte_size,storage_bucket,storage_path"},
    ).json()[0]
    head = c.get(
        f"{SUP}/storage/v1/object/info/{row['storage_bucket']}/{row['storage_path']}",
        headers=svc,
    )
    print("classify_info", head.status_code, head.text[:120])

    # site assignment for tech field photo
    # find tech user id
    sess = c.get(f"{API}/api/v1/auth/session", headers=th).json()
    tech_id = sess.get("user", {}).get("id") or sess.get("id")
    print("tech_id", tech_id)
    # assign site resource
    asg = c.post(
        f"{SUP}/rest/v1/assignments",
        headers={**svc, "Content-Type": "application/json", "Prefer": "return=representation"},
        json={
            "workspace_id": WS,
            "user_id": tech_id,
            "resource_type": "site",
            "resource_id": site_id,
            "assigned_by": tech_id,
        },
    )
    print("site_assign", asg.status_code, asg.text[:160])
    photo = bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
    )
    intent2 = c.post(
        f"{API}/api/v1/workspaces/{WS}/documents/uploads",
        headers=th,
        json={
            "entity_type": "site",
            "entity_id": site_id,
            "kind": "photo",
            "mime_type": "image/png",
            "original_filename": "t.png",
            "byte_size": len(photo),
        },
    )
    print("tech_photo_intent", intent2.status_code, intent2.text[:200])


if __name__ == "__main__":
    main()
