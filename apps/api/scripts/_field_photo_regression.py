#!/usr/bin/env python3
import hashlib
import os

import httpx
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv("apps/api/.env")
API = "https://site-secure-api-staging.onrender.com"
SUP = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
email = "extbeta.tech.6f789dd7@sitesecure.test"
pw = "ExtBeta-6f789dd7-Qa2026!"
tok = httpx.post(
    f"{SUP}/auth/v1/token?grant_type=password",
    headers={"apikey": ANON, "Content-Type": "application/json"},
    json={"email": email, "password": pw},
    timeout=45,
).json()["access_token"]
h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
ws = "637dac16-d083-4b6d-9faa-37b470c0a3ed"
sites = httpx.get(f"{API}/api/v1/workspaces/{ws}/sites", headers=h, params={"limit": 5}, timeout=60).json()
site_id = (sites.get("items") or [{}])[0].get("id")
print("site", site_id)
png = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
)
intent = httpx.post(
    f"{API}/api/v1/workspaces/{ws}/documents/uploads",
    headers=h,
    json={
        "entity_type": "site",
        "entity_id": site_id,
        "kind": "photo",
        "mime_type": "image/png",
        "original_filename": "field.png",
        "byte_size": len(png),
    },
    timeout=60,
)
print("intent", intent.status_code)
body = intent.json()
httpx.put(body["upload_url"], headers={"Content-Type": "image/png", "x-upsert": "true"}, content=png, timeout=60)
done = httpx.post(
    f"{API}/api/v1/workspaces/{ws}/documents/{body['document_id']}/complete",
    headers=h,
    json={"byte_size": len(png), "mime_type": "image/png", "checksum": hashlib.sha256(png).hexdigest()},
    timeout=60,
)
print("complete", done.status_code)
url = httpx.get(f"{API}/api/v1/workspaces/{ws}/documents/{body['document_id']}/url", headers=h, timeout=60)
print("url", url.status_code)
print("PASS" if intent.status_code in {200, 201} and done.status_code == 200 and url.status_code == 200 else "FAIL")
