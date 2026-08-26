"""End-to-end quote flow against a live API (default: local :8000).

Creates a fresh draft quote so prior public-open promotions do not block edits.
"""
from __future__ import annotations

import os
import sys
from datetime import date, timedelta
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "apps" / "api" / ".env")

API = os.environ.get("E2E_API_URL", "http://127.0.0.1:8000").rstrip("/")
WS = "f1f76d59-fd2e-4b27-9586-06f7c89abc9c"
CUSTOMER_ID = "1e8b86cf-d7d1-4283-a2b4-f861e9b2ae88"
EMAIL = "aegisspectra@gmail.com"


def token(client: httpx.Client) -> str:
    url = os.environ["SUPABASE_URL"].rstrip("/")
    anon = os.environ["SUPABASE_ANON_KEY"]
    service = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    link = client.post(
        f"{url}/auth/v1/admin/generate_link",
        headers={
            "apikey": service,
            "Authorization": f"Bearer {service}",
            "Content-Type": "application/json",
        },
        json={"type": "magiclink", "email": EMAIL},
    )
    link.raise_for_status()
    props = link.json().get("properties") or link.json()
    payload = (
        {"type": "magiclink", "token_hash": props["hashed_token"]}
        if props.get("hashed_token")
        else {"type": "email", "email": EMAIL, "token": props["email_otp"]}
    )
    verify = client.post(
        f"{url}/auth/v1/verify",
        headers={"apikey": anon, "Authorization": f"Bearer {anon}", "Content-Type": "application/json"},
        json=payload,
    )
    verify.raise_for_status()
    return verify.json()["access_token"]


def main() -> int:
    checks: list[tuple[str, bool, str]] = []

    def ck(name: str, ok: bool, detail: str = "") -> None:
        checks.append((name, ok, detail))
        print(("PASS" if ok else "FAIL"), name, detail)

    with httpx.Client(timeout=90) as c:
        h = {"Authorization": f"Bearer {token(c)}", "Content-Type": "application/json"}

        created = c.post(
            f"{API}/api/v1/workspaces/{WS}/quotes",
            headers=h,
            json={
                "customer_id": CUSTOMER_ID,
                "title": "E2E Quote Flow",
                "valid_until": (date.today() + timedelta(days=14)).isoformat(),
                "payment_terms": "40% מקדמה · 60% בגמר",
            },
        )
        ck("create_quote", created.status_code in {200, 201}, f"{created.status_code} {created.text[:200]}")
        quote = created.json() if created.status_code in {200, 201} else {}
        qid = quote.get("id")
        ck("quote_id", bool(qid), str(qid))
        if not qid:
            return 1
        ck("starts_draft", quote.get("status") == "draft", str(quote.get("status")))

        # Customer phone must exist for WhatsApp recipient resolution.
        cust = c.get(f"{API}/api/v1/workspaces/{WS}/customers/{CUSTOMER_ID}", headers=h)
        ck("customer_get", cust.status_code == 200, str(cust.status_code))
        phone = (cust.json() or {}).get("phone") if cust.status_code == 200 else None
        ck("customer_phone", bool(phone and str(phone).strip()), str(phone))

        products = c.get(
            f"{API}/api/v1/workspaces/{WS}/catalog/products",
            headers=h,
            params={"limit": 5, "q": "CAM"},
        )
        ck("catalog_search", products.status_code == 200, str(products.status_code))
        prod_items = (products.json() or {}).get("items") or []
        product = prod_items[0] if prod_items else None
        ck("catalog_hit", product is not None, str((product or {}).get("sku")))

        if product:
            add_cat = c.post(
                f"{API}/api/v1/workspaces/{WS}/quotes/{qid}/items",
                headers=h,
                json={
                    "product_id": product["id"],
                    "item_type": "catalog",
                    "qty": 2,
                    "sku": product.get("sku"),
                },
            )
            ck("add_catalog_item", add_cat.status_code == 200, f"{add_cat.status_code} {add_cat.text[:160]}")
            cat_line = next(
                (i for i in ((add_cat.json() or {}).get("items") or []) if i.get("product_id") == product["id"]),
                None,
            )
            ck("catalog_sku_copied", bool(cat_line and cat_line.get("sku")), str((cat_line or {}).get("sku")))
            if cat_line:
                patch = c.patch(
                    f"{API}/api/v1/workspaces/{WS}/quotes/{qid}/items/{cat_line['id']}",
                    headers=h,
                    json={"qty": 3, "unit_price": float(cat_line.get("unit_price") or 0)},
                )
                ck("patch_qty_price", patch.status_code == 200, f"{patch.status_code} {patch.text[:120]}")

        add_free = c.post(
            f"{API}/api/v1/workspaces/{WS}/quotes/{qid}/items",
            headers=h,
            json={
                "item_type": "free",
                "description": "התקנה",
                "sku": "LABOR-E2E",
                "qty": 1,
                "unit_price": 500,
            },
        )
        ck("add_free_with_sku", add_free.status_code == 200, f"{add_free.status_code} {add_free.text[:160]}")

        # Persist header fields that readiness may require.
        patch_q = c.patch(
            f"{API}/api/v1/workspaces/{WS}/quotes/{qid}",
            headers=h,
            json={"title": "E2E Quote Flow", "payment_terms": "40% מקדמה · 60% בגמר"},
        )
        ck("patch_quote_header", patch_q.status_code == 200, str(patch_q.status_code))

        share = c.post(f"{API}/api/v1/workspaces/{WS}/quotes/{qid}/share", headers=h)
        ck("share_draft", share.status_code == 200, f"{share.status_code} {share.text[:220]}")
        share_body = share.json() if share.status_code == 200 else {}
        ck("share_not_auto_sent", share_body.get("auto_sent") is False, str(share_body.get("auto_sent")))
        ck("share_keeps_draft", share_body.get("status") == "draft", str(share_body.get("status")))
        tok = share_body.get("public_token") or ""
        public_url = share_body.get("public_url") or ""
        ck("share_url", bool(tok and public_url), public_url[:80])

        # Auth PDF (builder download) before customer open — must not lock the quote.
        auth_pdf = c.get(f"{API}/api/v1/workspaces/{WS}/quotes/{qid}/pdf", headers=h)
        ck("auth_pdf", auth_pdf.status_code == 200 and auth_pdf.content[:4] == b"%PDF", str(auth_pdf.status_code))
        mid = c.get(f"{API}/api/v1/workspaces/{WS}/quotes/{qid}", headers=h)
        ck("still_draft_after_auth_pdf", (mid.json() or {}).get("status") == "draft", str((mid.json() or {}).get("status")))

        if tok:
            pub = c.get(f"{API}/api/v1/public/quotes/{tok}")
            ck("public_get", pub.status_code == 200, str(pub.status_code))
            pub_body = pub.json() if pub.status_code == 200 else {}
            ck("public_no_cost", "cost_total" not in pub_body and "margin_amount" not in pub_body)
            pub_pdf = c.get(f"{API}/api/v1/public/quotes/{tok}/pdf")
            ck("public_pdf", pub_pdf.status_code == 200 and pub_pdf.content[:4] == b"%PDF", str(pub_pdf.status_code))

            after = c.get(f"{API}/api/v1/workspaces/{WS}/quotes/{qid}", headers=h)
            status_after = (after.json() or {}).get("status")
            # First public open may promote draft → sent/viewed (delivery proof).
            ck("status_after_customer_open", status_after in {"sent", "viewed", "draft"}, str(status_after))

            # Remint share must work after sent/viewed (WhatsApp again / copy link).
            remint = c.post(f"{API}/api/v1/workspaces/{WS}/quotes/{qid}/share", headers=h)
            ck("share_remint", remint.status_code == 200, f"{remint.status_code} {remint.text[:160]}")

            # Edits while locked must fail honestly (not silently succeed).
            if status_after in {"sent", "viewed", "approved"}:
                locked_add = c.post(
                    f"{API}/api/v1/workspaces/{WS}/quotes/{qid}/items",
                    headers=h,
                    json={"item_type": "free", "description": "should fail", "qty": 1, "unit_price": 1},
                )
                ck(
                    "edit_locked_denied",
                    locked_add.status_code == 403,
                    f"{locked_add.status_code} {locked_add.text[:120]}",
                )
                revise = c.post(f"{API}/api/v1/workspaces/{WS}/quotes/{qid}/revise", headers=h)
                ck("revise", revise.status_code == 200, f"{revise.status_code} {revise.text[:120]}")
                ck("revise_draft", (revise.json() or {}).get("status") == "draft", str((revise.json() or {}).get("status")))

    failed = [x for x in checks if not x[1]]
    print("---")
    print(f"api={API} passed={len(checks) - len(failed)} failed={len(failed)} total={len(checks)}")
    for name, _ok, detail in failed:
        print("BLOCKED", name, detail)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
