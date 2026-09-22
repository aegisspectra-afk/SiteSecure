#!/usr/bin/env python3
"""Debug production document upload."""
from __future__ import annotations

import hashlib
import os
import uuid

import httpx
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv("apps/api/.env")

API = "https://site-secure-api-staging.onrender.com"
SUP = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
RUN = uuid.uuid4().hex[:6]
EMAIL = f"extfix.doc.{RUN}@sitesecure.test"
PW = f"Test-{RUN}-Qa!"
svc = {"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}", "Content-Type": "application/json"}


def main() -> None:
    c = httpx.Client(timeout=120)
    c.post(f"{SUP}/auth/v1/admin/users", headers=svc, json={"email": EMAIL, "password": PW, "email_confirm": True})
    tok = c.post(
        f"{SUP}/auth/v1/token?grant_type=password",
        headers={"apikey": ANON, "Content-Type": "application/json"},
        json={"email": EMAIL, "password": PW},
    ).json()["access_token"]
    h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    ws = c.post(f"{API}/api/v1/workspaces", headers=h, json={"name": f"DocTest {RUN}"}).json()["id"]
    cust = c.post(f"{API}/api/v1/workspaces/{ws}/customers", headers=h, json={"display_name": "D"}).json()["id"]
    site = c.post(
        f"{API}/api/v1/workspaces/{ws}/sites",
        headers=h,
        json={"customer_id": cust, "name": "S", "address": {"line": "1"}},
    ).json()["id"]
    content = b"hello-doc"
    intent = c.post(
        f"{API}/api/v1/workspaces/{ws}/documents/uploads",
        headers=h,
        json={
            "entity_type": "site",
            "entity_id": site,
            "kind": "document",
            "mime_type": "text/plain",
            "original_filename": "t.txt",
            "byte_size": len(content),
        },
    )
    print("intent", intent.status_code, intent.text[:800])
    body = intent.json()
    print("keys", list(body.keys()) if isinstance(body, dict) else type(body))
    try:
        put = c.put(body["upload_url"], headers={"Content-Type": "text/plain", "x-upsert": "true"}, content=content)
        print("put", put.status_code, put.text[:300])
    except Exception as e:
        print("put_exc", type(e), e)
        return
    done = c.post(
        f"{API}/api/v1/workspaces/{ws}/documents/{body['document_id']}/complete",
        headers=h,
        json={"byte_size": len(content), "mime_type": "text/plain", "checksum": hashlib.sha256(content).hexdigest()},
    )
    print("complete", done.status_code, done.text[:500])
    url = c.get(f"{API}/api/v1/workspaces/{ws}/documents/{body['document_id']}/url", headers=h)
    print("url", url.status_code, url.text[:300])


if __name__ == "__main__":
    main()
