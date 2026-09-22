#!/usr/bin/env python3
"""Complete remaining external probes after primary smoke."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv("apps/api/.env")

API = "https://site-secure-api-staging.onrender.com"
SUP = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
REP = json.loads(Path("apps/api/scripts/_final_external_beta_smoke/report.json").read_text(encoding="utf-8"))
RUN = REP["run"]
WS = REP["workspace_a"]
PASSWORD = f"ExtBeta-{RUN}-Qa2026!"
OWNER = f"extbeta.owner.{RUN}@sitesecure.test"
TECH = f"extbeta.tech.{RUN}@sitesecure.test"
OUT = Path("apps/api/scripts/_final_external_beta_smoke/reprobe2.json")


def login(email: str) -> str:
    r = httpx.post(
        f"{SUP}/auth/v1/token?grant_type=password",
        headers={"apikey": ANON, "Content-Type": "application/json"},
        json={"email": email, "password": PASSWORD},
        timeout=45,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def main() -> None:
    out: dict = {"checks": []}
    c = httpx.Client(timeout=120)
    ot, tt = login(OWNER), login(TECH)
    oh = {"Authorization": f"Bearer {ot}", "Content-Type": "application/json"}
    th = {"Authorization": f"Bearer {tt}", "Content-Type": "application/json"}
    svc = {"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}", "Content-Type": "application/json"}

    sess = c.get(f"{API}/api/v1/auth/session", headers=th).json()
    tech_id = (sess.get("user") or {}).get("id") or sess.get("user_id") or sess.get("id")
    # decode from profiles via email
    if not tech_id:
        users = c.get(f"{SUP}/auth/v1/admin/users", headers=svc, params={"page": 1, "per_page": 200}).json()
        for u in users.get("users") or []:
            if (u.get("email") or "").lower() == TECH.lower():
                tech_id = u["id"]
                break
    out["tech_id"] = tech_id

    quotes = c.get(f"{API}/api/v1/workspaces/{WS}/quotes", headers=th, params={"limit": 20}).json()
    qitems = quotes.get("items") or []
    qid = qitems[0]["id"] if qitems else None
    out["tech_quotes_count"] = len(qitems)
    if qid:
        detail = c.get(f"{API}/api/v1/workspaces/{WS}/quotes/{qid}", headers=th)
        d = detail.json() if detail.status_code == 200 else {}
        out["tech_quote_detail_status"] = detail.status_code
        out["tech_quote_has_items"] = len(d.get("items") or []) > 0
        out["tech_quote_unit_prices"] = [i.get("unit_price") for i in (d.get("items") or [])][:5]
        out["checks"].append(
            {
                "name": "tech_commercial_quote_data_visible",
                "ok": False,
                "detail": "technician can read quote list/detail with pricing",
            }
        )

    cat = c.get(f"{API}/api/v1/workspaces/{WS}/catalog/products", headers=th, params={"limit": 20}).json()
    out["tech_catalog_count"] = len(cat.get("items") or [])
    out["tech_catalog_prices"] = [p.get("list_price") for p in (cat.get("items") or [])][:5]

    # document durability reconfirm + classify HEALTHY
    sites = c.get(f"{API}/api/v1/workspaces/{WS}/sites", headers=oh, params={"limit": 5}).json()["items"]
    site_id = sites[0]["id"]
    content = b"durability-final-check"
    intent = c.post(
        f"{API}/api/v1/workspaces/{WS}/documents/uploads",
        headers=oh,
        json={
            "entity_type": "site",
            "entity_id": site_id,
            "kind": "document",
            "mime_type": "text/plain",
            "original_filename": "final.txt",
            "byte_size": len(content),
        },
    ).json()
    c.put(intent["upload_url"], headers={"Content-Type": "text/plain", "x-upsert": "true"}, content=content)
    done = c.post(
        f"{API}/api/v1/workspaces/{WS}/documents/{intent['document_id']}/complete",
        headers=oh,
        json={"byte_size": len(content), "mime_type": "text/plain", "checksum": hashlib.sha256(content).hexdigest()},
    )
    url = c.get(f"{API}/api/v1/workspaces/{WS}/documents/{intent['document_id']}/url", headers=oh)
    row = c.get(
        f"{SUP}/rest/v1/documents",
        headers=svc,
        params={"id": f"eq.{intent['document_id']}", "select": "byte_size,storage_bucket,storage_path"},
    ).json()[0]
    info = c.get(
        f"{SUP}/storage/v1/object/info/{row['storage_bucket']}/{row['storage_path']}",
        headers=svc,
    )
    healthy = done.status_code == 200 and url.status_code == 200 and row.get("byte_size") and info.status_code == 200
    out["document_durability"] = {
        "ok": healthy,
        "document_id": intent["document_id"],
        "classification": "HEALTHY" if healthy else "FAIL",
        "complete": done.status_code,
        "url": url.status_code,
        "info": info.status_code,
    }

    # photo owner
    png = bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
    )
    p_intent = c.post(
        f"{API}/api/v1/workspaces/{WS}/documents/uploads",
        headers=oh,
        json={
            "entity_type": "site",
            "entity_id": site_id,
            "kind": "photo",
            "mime_type": "image/png",
            "original_filename": "final.png",
            "byte_size": len(png),
        },
    ).json()
    c.put(p_intent["upload_url"], headers={"Content-Type": "image/png", "x-upsert": "true"}, content=png)
    p_done = c.post(
        f"{API}/api/v1/workspaces/{WS}/documents/{p_intent['document_id']}/complete",
        headers=oh,
        json={"byte_size": len(png), "mime_type": "image/png", "checksum": hashlib.sha256(png).hexdigest()},
    )
    p_url = c.get(f"{API}/api/v1/workspaces/{WS}/documents/{p_intent['document_id']}/url", headers=oh)
    out["photo"] = {"ok": p_done.status_code == 200 and p_url.status_code == 200, "document_id": p_intent["document_id"]}

    # assign site to tech then field photo
    owner_sess = c.get(f"{API}/api/v1/auth/session", headers=oh).json()
    owner_id = (owner_sess.get("user") or {}).get("id") or owner_sess.get("user_id")
    if not owner_id:
        users = c.get(f"{SUP}/auth/v1/admin/users", headers=svc, params={"page": 1, "per_page": 200}).json()
        for u in users.get("users") or []:
            if (u.get("email") or "").lower() == OWNER.lower():
                owner_id = u["id"]
                break
    asg = c.post(
        f"{SUP}/rest/v1/assignments",
        headers={**svc, "Prefer": "return=representation"},
        json={
            "workspace_id": WS,
            "user_id": tech_id,
            "resource_type": "site",
            "resource_id": site_id,
            "assigned_by": owner_id,
        },
    )
    out["site_assign"] = {"status": asg.status_code, "body": (asg.text or "")[:160]}
    t_intent = c.post(
        f"{API}/api/v1/workspaces/{WS}/documents/uploads",
        headers=th,
        json={
            "entity_type": "site",
            "entity_id": site_id,
            "kind": "photo",
            "mime_type": "image/png",
            "original_filename": "tech.png",
            "byte_size": len(png),
        },
    )
    if t_intent.status_code in {200, 201}:
        body = t_intent.json()
        c.put(body["upload_url"], headers={"Content-Type": "image/png", "x-upsert": "true"}, content=png)
        t_done = c.post(
            f"{API}/api/v1/workspaces/{WS}/documents/{body['document_id']}/complete",
            headers=th,
            json={"byte_size": len(png), "mime_type": "image/png", "checksum": hashlib.sha256(png).hexdigest()},
        )
        t_url = c.get(f"{API}/api/v1/workspaces/{WS}/documents/{body['document_id']}/url", headers=th)
        out["tech_field_photo_after_site_assign"] = {
            "ok": t_done.status_code == 200 and t_url.status_code == 200,
            "complete": t_done.status_code,
            "url": t_url.status_code,
        }
    else:
        out["tech_field_photo_after_site_assign"] = {"ok": False, "status": t_intent.status_code, "body": t_intent.text[:200]}

    # tech create catalog denied
    cat_post = c.post(
        f"{API}/api/v1/workspaces/{WS}/catalog/products",
        headers=th,
        json={"sku": "HACK", "name": "hack", "list_price": 1, "kind": "product"},
    )
    out["tech_catalog_create"] = {"status": cat_post.status_code}

    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(out, indent=2, ensure_ascii=False)[:2500])


if __name__ == "__main__":
    main()
