"""Capture real staging/local error bodies for quote items + share."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "apps" / "api" / ".env")

WS = "f1f76d59-fd2e-4b27-9586-06f7c89abc9c"
Q = "fb2fb092-33e0-439f-88bd-6f306aafcd4f"
EMAIL = "aegisspectra@gmail.com"

APIS = [
    ("staging", "https://site-secure-api-staging.onrender.com"),
    ("local", "http://127.0.0.1:8000"),
]


def get_token(client: httpx.Client) -> str:
    url = os.environ["SUPABASE_URL"].rstrip("/")
    anon = os.environ["SUPABASE_ANON_KEY"]
    service = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    admin = {
        "apikey": service,
        "Authorization": f"Bearer {service}",
        "Content-Type": "application/json",
    }
    link = client.post(
        f"{url}/auth/v1/admin/generate_link",
        headers=admin,
        json={"type": "magiclink", "email": EMAIL},
    )
    link.raise_for_status()
    data = link.json()
    props = data.get("properties") or data
    token_hash = props.get("hashed_token")
    email_otp = props.get("email_otp")
    if token_hash:
        verify_payload = {"type": "magiclink", "token_hash": token_hash}
    else:
        verify_payload = {"type": "email", "email": EMAIL, "token": email_otp}
    verify = client.post(
        f"{url}/auth/v1/verify",
        headers={
            "apikey": anon,
            "Authorization": f"Bearer {anon}",
            "Content-Type": "application/json",
        },
        json=verify_payload,
    )
    verify.raise_for_status()
    return verify.json()["access_token"]


PAYLOADS = {
    "free_minimal": {"item_type": "free", "description": "", "qty": 1, "unit_price": 0},
    "free_with_sku": {
        "item_type": "free",
        "description": "",
        "sku": "",
        "qty": 1,
        "unit_price": 0,
    },
    "catalog_like": {
        "item_type": "catalog",
        "description": "probe",
        "sku": "PROBE-SKU",
        "qty": 1,
        "unit_price": 10,
    },
}


def dump(label: str, r: httpx.Response) -> None:
    print(f"\n=== {label} ===")
    print("status:", r.status_code)
    print("body:", r.text[:2000])


def main() -> int:
    with httpx.Client(timeout=60) as client:
        token = get_token(client)
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        print("TOKEN_OK")

        for name, base in APIS:
            print(f"\n########## {name} {base} ##########")
            try:
                health = client.get(f"{base}/health")
                print("health", health.status_code, health.text[:120])
            except Exception as exc:
                print("health FAIL", exc)
                continue

            q = client.get(f"{base}/api/v1/workspaces/{WS}/quotes/{Q}", headers=headers)
            dump(f"{name} GET quote", q)
            if q.status_code == 200:
                row = q.json()
                print(
                    "quote fields:",
                    {
                        k: row.get(k)
                        for k in (
                            "id",
                            "number",
                            "status",
                            "version",
                            "customer_id",
                            "payment_terms",
                            "title",
                        )
                    },
                )
                items = row.get("items") or []
                print("items_count", len(items))

            for pname, payload in PAYLOADS.items():
                r = client.post(
                    f"{base}/api/v1/workspaces/{WS}/quotes/{Q}/items",
                    headers=headers,
                    json=payload,
                )
                dump(f"{name} POST items {pname} payload={json.dumps(payload, ensure_ascii=False)}", r)

            r = client.post(f"{base}/api/v1/workspaces/{WS}/quotes/{Q}/share", headers=headers)
            dump(f"{name} POST share", r)

    return 0


if __name__ == "__main__":
    sys.exit(main())
