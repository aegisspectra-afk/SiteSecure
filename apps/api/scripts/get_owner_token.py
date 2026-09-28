from __future__ import annotations

import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "apps" / "api" / ".env")

url = os.environ["SUPABASE_URL"].rstrip("/")
anon = os.environ["SUPABASE_ANON_KEY"]
service = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
email = "aegisspectra@gmail.com"

admin_headers = {
    "apikey": service,
    "Authorization": f"Bearer {service}",
    "Content-Type": "application/json",
}

with httpx.Client(timeout=45) as client:
    link = client.post(
        f"{url}/auth/v1/admin/generate_link",
        headers=admin_headers,
        json={"type": "magiclink", "email": email},
    )
    print("generate_link", link.status_code)
    data = link.json()
    props = data.get("properties") or data
    token_hash = props.get("hashed_token")
    email_otp = props.get("email_otp")
    print("has_hashed", bool(token_hash), "has_otp", bool(email_otp))
    if token_hash:
        verify_payload = {"type": "magiclink", "token_hash": token_hash}
    else:
        verify_payload = {"type": "email", "email": email, "token": email_otp}
    verify = client.post(
        f"{url}/auth/v1/verify",
        headers={
            "apikey": anon,
            "Authorization": f"Bearer {anon}",
            "Content-Type": "application/json",
        },
        json=verify_payload,
    )
    print("verify", verify.status_code)
    if verify.status_code != 200:
        print(verify.text[:800])
        sys.exit(1)
    access = verify.json()["access_token"]
    out = Path(__file__).resolve().parent / ".tmp_import_token"
    out.write_text(access, encoding="utf-8")
    print("TOKEN_OK", out)
