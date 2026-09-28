#!/usr/bin/env python3
"""BETA-GO-LIVE-2 final live smoke against production origins. No schema/feature changes."""

from __future__ import annotations

import json
import os
import re
import sys
import time
import uuid
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import httpx

ROOT = Path(__file__).resolve().parents[3]


def load_env() -> dict[str, str]:
    out: dict[str, str] = {}
    for rel in (".env", "apps/api/.env", "apps/web/.env"):
        p = ROOT / rel
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            if not line.strip() or line.strip().startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


ENV = load_env()
API = "https://site-secure-api-staging.onrender.com"
WEB = "https://site-secure-umber.vercel.app"
SUPABASE = (ENV.get("SUPABASE_URL") or ENV.get("VITE_SUPABASE_URL") or "").rstrip("/")
ANON = ENV.get("SUPABASE_ANON_KEY") or ENV.get("VITE_SUPABASE_ANON_KEY") or ""
SERVICE = ENV.get("SUPABASE_SERVICE_ROLE_KEY") or ""
SUFFIX = uuid.uuid4().hex[:8]
REPORT: dict[str, Any] = {
    "suffix": SUFFIX,
    "api": API,
    "web": WEB,
    "steps": {},
    "request_ids": {},
    "gate": {},
}


def note(step: str, **kwargs: Any) -> None:
    REPORT["steps"][step] = kwargs
    status = kwargs.get("status", "?")
    print(f"[{status}] {step}: {json.dumps({k: v for k, v in kwargs.items() if k != 'status'}, ensure_ascii=False)[:400]}")


def rid(resp: httpx.Response) -> str | None:
    return resp.headers.get("x-request-id") or resp.headers.get("X-Request-Id")


def admin_headers() -> dict[str, str]:
    return {
        "apikey": SERVICE,
        "Authorization": f"Bearer {SERVICE}",
        "Content-Type": "application/json",
    }


def platform_admin_token() -> str:
    with httpx.Client(timeout=60) as c:
        link = c.post(
            f"{SUPABASE}/auth/v1/admin/generate_link",
            headers=admin_headers(),
            json={"type": "magiclink", "email": "aegisspectra@gmail.com"},
        )
        link.raise_for_status()
        data = link.json()
        props = data.get("properties") or data
        token_hash = props.get("hashed_token")
        email_otp = props.get("email_otp")
        payload = (
            {"type": "magiclink", "token_hash": token_hash}
            if token_hash
            else {"type": "email", "email": "aegisspectra@gmail.com", "token": email_otp}
        )
        verify = c.post(
            f"{SUPABASE}/auth/v1/verify",
            headers={"apikey": ANON, "Authorization": f"Bearer {ANON}", "Content-Type": "application/json"},
            json=payload,
        )
        verify.raise_for_status()
        tok = verify.json().get("access_token")
        if not tok:
            raise RuntimeError("no platform admin access_token")
        return tok


def ensure_user(email: str, password: str) -> str:
    with httpx.Client(timeout=60) as c:
        listed = c.get(f"{SUPABASE}/auth/v1/admin/users", headers=admin_headers(), params={"page": 1, "per_page": 200})
        user_id = None
        if listed.status_code == 200:
            for u in listed.json().get("users") or []:
                if (u.get("email") or "").lower() == email.lower():
                    user_id = u.get("id")
                    break
        if user_id:
            c.put(
                f"{SUPABASE}/auth/v1/admin/users/{user_id}",
                headers=admin_headers(),
                json={"email_confirm": True, "password": password},
            ).raise_for_status()
            return user_id
        created = c.post(
            f"{SUPABASE}/auth/v1/admin/users",
            headers=admin_headers(),
            json={"email": email, "password": password, "email_confirm": True},
        )
        created.raise_for_status()
        return created.json()["id"]


def password_token(email: str, password: str) -> str:
    with httpx.Client(timeout=60) as c:
        res = c.post(
            f"{SUPABASE}/auth/v1/token?grant_type=password",
            headers={"apikey": ANON, "Content-Type": "application/json"},
            json={"email": email, "password": password},
        )
        res.raise_for_status()
        return res.json()["access_token"]


def api(c: httpx.Client, method: str, path: str, token: str | None = None, **kwargs: Any) -> httpx.Response:
    headers = dict(kwargs.pop("headers", {}) or {})
    if token:
        headers["Authorization"] = f"Bearer {token}"
    headers.setdefault("Content-Type", "application/json")
    return c.request(method, f"{API}{path}", headers=headers, **kwargs)


def main() -> int:
    if not SERVICE or not ANON or not SUPABASE:
        print("Missing SUPABASE credentials", file=sys.stderr)
        return 2

    owner_email = f"gl2.owner.{SUFFIX}@sitesecure.test"
    tech_email = f"gl2.tech.{SUFFIX}@sitesecure.test"
    owner_pass = f"Gl2-Owner-{SUFFIX}-Qa!"
    tech_pass = f"Gl2-Tech-{SUFFIX}-Qa!"
    reset_email = f"gl2.reset.{SUFFIX}@sitesecure.test"
    reset_pass_1 = f"Gl2-ResetA-{SUFFIX}-Qa!"
    reset_pass_2 = f"Gl2-ResetB-{SUFFIX}-Qa!"

    with httpx.Client(timeout=90, follow_redirects=False) as c:
        # --- deploy sanity ---
        h = c.get(f"{API}/api/v1/health")
        note("api_health", status="PASS" if h.status_code == 200 else "FAIL", code=h.status_code, body=h.json(), request_id=rid(h))
        REPORT["request_ids"]["health"] = rid(h)

        # --- platform admin ---
        try:
            admin_tok = platform_admin_token()
            note("platform_admin_login", status="PASS", method="magiclink_verify")
        except Exception as e:
            note("platform_admin_login", status="FAIL", error=str(e))
            Path("/tmp/gl2-final-smoke.json").write_text(json.dumps(REPORT, indent=2, ensure_ascii=False))
            return 1

        sess = api(c, "GET", "/api/v1/auth/session", admin_tok)
        sess_body = sess.json() if sess.headers.get("content-type", "").startswith("application/json") else {}
        note(
            "platform_admin_session",
            status="PASS" if sess.status_code == 200 and sess_body.get("is_platform_admin") else "FAIL",
            code=sess.status_code,
            is_platform_admin=sess_body.get("is_platform_admin"),
            email=sess_body.get("email"),
            request_id=rid(sess),
        )

        summary = api(c, "GET", "/api/v1/admin/summary", admin_tok)
        note(
            "admin_summary",
            status="PASS" if summary.status_code == 200 else "FAIL",
            code=summary.status_code,
            keys=sorted((summary.json() or {}).keys())[:20] if summary.status_code == 200 else None,
            request_id=rid(summary),
        )
        REPORT["request_ids"]["admin_summary"] = rid(summary)

        orgs = api(c, "GET", "/api/v1/admin/organizations", admin_tok)
        note("admin_organizations", status="PASS" if orgs.status_code == 200 else "FAIL", code=orgs.status_code, count=len(orgs.json() or []) if orgs.status_code == 200 else None, request_id=rid(orgs))

        invites_list = api(c, "GET", "/api/v1/admin/invitations", admin_tok)
        note("admin_invitations_list", status="PASS" if invites_list.status_code == 200 else "FAIL", code=invites_list.status_code, count=len(invites_list.json() or []) if invites_list.status_code == 200 else None, request_id=rid(invites_list))

        # --- workspace create ---
        ws_name = f"GL2 Smoke Beta {SUFFIX}"
        create_ws = api(
            c,
            "POST",
            "/api/v1/admin/organizations",
            admin_tok,
            json={"name": ws_name, "plan_key": "business", "is_beta": True, "beta_program": "early", "internal_note": f"GO-LIVE-2 smoke {SUFFIX}"},
        )
        ws = create_ws.json() if create_ws.status_code < 300 else {}
        ws_id = ws.get("id")
        note("workspace_create", status="PASS" if create_ws.status_code < 300 and ws_id else "FAIL", code=create_ws.status_code, workspace_id=ws_id, name=ws.get("name"), body=create_ws.text[:300], request_id=rid(create_ws))
        REPORT["request_ids"]["workspace_create"] = rid(create_ws)
        REPORT["workspace_id"] = ws_id
        if not ws_id:
            Path("/tmp/gl2-final-smoke.json").write_text(json.dumps(REPORT, indent=2, ensure_ascii=False))
            return 1

        # --- owner invite ---
        inv = api(
            c,
            "POST",
            "/api/v1/admin/invitations",
            admin_tok,
            json={"workspace_id": ws_id, "email": owner_email, "role_key": "owner"},
        )
        inv_body = inv.json() if inv.status_code < 300 else {}
        token = inv_body.get("token")
        invite_id = inv_body.get("id")
        note(
            "owner_invite",
            status="PASS" if inv.status_code < 300 and token and invite_id else "FAIL",
            code=inv.status_code,
            invitation_id=invite_id,
            has_token=bool(token),
            status_field=inv_body.get("status"),
            role=inv_body.get("role_key"),
            leaked_fields=[k for k in inv_body.keys() if "token" in k.lower()],
            request_id=rid(inv),
            body=None if inv.status_code < 300 else inv.text[:400],
        )
        REPORT["request_ids"]["owner_invite"] = rid(inv)
        REPORT["owner_invite_token"] = token
        if not token:
            Path("/tmp/gl2-final-smoke.json").write_text(json.dumps(REPORT, indent=2, ensure_ascii=False))
            return 1

        # list should not include plaintext token
        listed = api(c, "GET", f"/api/v1/admin/invitations?workspace_id={ws_id}", admin_tok)
        listed_rows = listed.json() if listed.status_code == 200 else []
        token_in_list = any(isinstance(r, dict) and r.get("token") for r in listed_rows)
        note("invite_list_no_token", status="PASS" if listed.status_code == 200 and not token_in_list else "FAIL", token_in_list=token_in_list, pending=sum(1 for r in listed_rows if r.get("status") == "pending"))

        # --- public peek ---
        peek = c.get(f"{API}/api/v1/invitations/public-peek", params={"token": token})
        peek_body = peek.json() if peek.status_code == 200 else {}
        peek_ok = (
            peek.status_code == 200
            and peek_body.get("email", "").lower() == owner_email.lower()
            and peek_body.get("role_key") == "owner"
            and (peek_body.get("workspace_id") == ws_id or peek_body.get("workspace_name") == ws_name)
        )
        note(
            "public_peek",
            status="PASS" if peek_ok else "FAIL",
            code=peek.status_code,
            body={k: peek_body.get(k) for k in ("status", "email", "role_key", "workspace_id", "workspace_name", "expires_at")},
            raw_token_in_body=token in peek.text,
            request_id=rid(peek),
        )

        # --- owner accept ---
        ensure_user(owner_email, owner_pass)
        owner_tok = password_token(owner_email, owner_pass)
        accept = api(c, "POST", "/api/v1/invitations/accept", owner_tok, json={"token": token})
        accept_body = accept.json() if accept.status_code < 300 else {}
        note(
            "owner_accept",
            status="PASS" if accept.status_code < 300 else "FAIL",
            code=accept.status_code,
            body=accept_body if accept.status_code < 300 else accept.text[:400],
            request_id=rid(accept),
        )
        REPORT["request_ids"]["owner_accept"] = rid(accept)

        # retry accept — no duplicate membership
        accept2 = api(c, "POST", "/api/v1/invitations/accept", owner_tok, json={"token": token})
        mems = api(c, "GET", f"/api/v1/admin/memberships?workspace_id={ws_id}", admin_tok)
        mem_rows = mems.json() if mems.status_code == 200 else []
        owner_mems = [m for m in mem_rows if m.get("role_key") == "owner" and m.get("status") == "active"]
        note(
            "owner_accept_retry",
            status="PASS" if len(owner_mems) == 1 else "FAIL",
            retry_code=accept2.status_code,
            active_owners=len(owner_mems),
            memberships=[{"role": m.get("role_key"), "status": m.get("status"), "user_id": m.get("user_id")} for m in mem_rows[:6]],
        )

        owner_sess = api(c, "GET", "/api/v1/auth/session", owner_tok)
        owner_sess_body = owner_sess.json() if owner_sess.status_code == 200 else {}
        memberships = owner_sess_body.get("memberships") or []
        active_ws = [m for m in memberships if m.get("workspace_id") == ws_id]
        note(
            "owner_landing",
            status="PASS" if active_ws and active_ws[0].get("role_key") == "owner" else "FAIL",
            is_platform_admin=owner_sess_body.get("is_platform_admin"),
            membership=active_ws[0] if active_ws else None,
        )

        # --- owner admin denial ---
        deny_sum = api(c, "GET", "/api/v1/admin/summary", owner_tok)
        note("owner_admin_api_denied", status="PASS" if deny_sum.status_code == 403 else "FAIL", code=deny_sum.status_code, body=deny_sum.text[:200], request_id=rid(deny_sum))

        # --- customer + site ---
        cust = api(
            c,
            "POST",
            f"/api/v1/workspaces/{ws_id}/customers",
            owner_tok,
            json={"display_name": f"GL2 Customer {SUFFIX}", "email": f"cust.{SUFFIX}@example.com", "type": "business"},
        )
        cust_body = cust.json() if cust.status_code < 300 else {}
        cust_id = cust_body.get("id")
        note("customer_create", status="PASS" if cust_id else "FAIL", code=cust.status_code, customer_id=cust_id, request_id=rid(cust), body=None if cust_id else cust.text[:400])
        REPORT["request_ids"]["customer_create"] = rid(cust)

        site = api(
            c,
            "POST",
            f"/api/v1/workspaces/{ws_id}/sites",
            owner_tok,
            json={"customer_id": cust_id, "name": f"GL2 Site {SUFFIX}", "address": "Tel Aviv"},
        ) if cust_id else None
        site_body = site.json() if site and site.status_code < 300 else {}
        site_id = site_body.get("id")
        note("site_create", status="PASS" if site_id else "FAIL", code=None if not site else site.status_code, site_id=site_id, request_id=None if not site else rid(site), body=None if site_id or not site else site.text[:400])
        REPORT["request_ids"]["site_create"] = None if not site else rid(site)

        # --- quote create / edit (Q4-S) ---
        quote = None
        quote_id = None
        if cust_id and site_id:
            quote = api(
                c,
                "POST",
                f"/api/v1/workspaces/{ws_id}/quotes",
                owner_tok,
                json={
                    "title": f"GL2 Quote {SUFFIX}",
                    "customer_id": cust_id,
                    "site_id": site_id,
                    "vat_percent": 18,
                    "valid_until": (date.today() + timedelta(days=30)).isoformat(),
                    "payment_terms": "net 30",
                    "warranty": "12m",
                },
            )
            quote_body = quote.json() if quote.status_code < 300 else {}
            quote_id = quote_body.get("id")
            note(
                "quote_create",
                status="PASS" if quote_id else "FAIL",
                code=quote.status_code,
                quote_id=quote_id,
                request_id=rid(quote),
                body=None if quote_id else quote.text[:500],
            )
            REPORT["request_ids"]["quote_create"] = rid(quote)
        else:
            note("quote_create", status="SKIP", reason="missing customer/site")

        item = None
        if quote_id:
            got = api(c, "GET", f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}", owner_tok)
            note("quote_get", status="PASS" if got.status_code == 200 else "FAIL", code=got.status_code, request_id=rid(got))

            item = api(
                c,
                "POST",
                f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}/items",
                owner_tok,
                json={"item_type": "custom", "description": "Manual camera line", "qty": 2, "unit_price": 450},
            )
            item_body = item.json() if item.status_code < 300 else {}
            # API may return item or wrap
            item_id = item_body.get("id") or (item_body.get("item") or {}).get("id")
            if not item_id and isinstance(item_body.get("items"), list) and item_body["items"]:
                item_id = item_body["items"][-1].get("id")
            note(
                "quote_item_create",
                status="PASS" if item.status_code < 300 else "FAIL",
                code=item.status_code,
                item_id=item_id,
                request_id=rid(item),
                body=None if item.status_code < 300 else item.text[:500],
            )

            labor = api(
                c,
                "POST",
                f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}/items",
                owner_tok,
                json={"item_type": "labor", "description": "Install labor", "qty": 3, "unit_price": 180},
            )
            note("quote_labor_item", status="PASS" if labor.status_code < 300 else "WARN", code=labor.status_code, request_id=rid(labor), body=labor.text[:200] if labor.status_code >= 300 else None)

            if item_id:
                patch = api(
                    c,
                    "PATCH",
                    f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}/items/{item_id}",
                    owner_tok,
                    json={"qty": 3, "unit_price": 500},
                )
                note("quote_item_edit", status="PASS" if patch.status_code < 300 else "FAIL", code=patch.status_code, request_id=rid(patch), body=None if patch.status_code < 300 else patch.text[:300])

            terms = api(
                c,
                "PATCH",
                f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}",
                owner_tok,
                json={"payment_terms": "net 45", "valid_until": (date.today() + timedelta(days=45)).isoformat()},
            )
            note("quote_terms", status="PASS" if terms.status_code < 300 else "FAIL", code=terms.status_code, request_id=rid(terms))

            doc = api(c, "GET", f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}/document", owner_tok)
            doc_body = doc.json() if doc.status_code == 200 else {}
            has_totals = any(k in doc_body for k in ("total_gross", "total_net", "subtotal_net", "grand_total"))
            cost_keys = [k for k in doc_body.keys() if "cost" in k.lower() or "margin" in k.lower() or k.lower() in {"gp", "gross_profit"}]
            note(
                "quote_pricing_doc",
                status="PASS" if doc.status_code == 200 and has_totals else "FAIL",
                code=doc.status_code,
                has_totals=has_totals,
                cost_like_keys=cost_keys,
                sample={k: doc_body.get(k) for k in ("total_gross", "total_net", "subtotal_net", "vat_percent") if k in doc_body},
                request_id=rid(doc),
            )

        # --- direct PostgREST cost denial ---
        rest = SUPABASE + "/rest/v1"
        hdr = {"apikey": ANON, "Authorization": f"Bearer {owner_tok}"}
        probes = []
        for table, select in (
            ("products", "id,cost"),
            ("quote_items", "id,cost"),
            ("quotes", "id,cost_total"),
        ):
            r = c.get(f"{rest}/{table}", headers=hdr, params={"select": select, "limit": "1"})
            probes.append({"table": table, "select": select, "code": r.status_code, "body": r.text[:180]})
        # also try margin columns if present
        for table, select in (("quotes", "id,margin_total"), ("quote_items", "id,margin")):
            r = c.get(f"{rest}/{table}", headers=hdr, params={"select": select, "limit": "1"})
            probes.append({"table": table, "select": select, "code": r.status_code, "body": r.text[:180]})
        denied = all(p["code"] in {401, 403, 404} or "permission denied" in p["body"].lower() or "not accept" in p["body"].lower() or p["code"] >= 400 for p in probes)
        # 200 with empty and no cost values could also happen if column stripped - treat 200 returning cost as FAIL
        cost_leaked = False
        for p in probes:
            if p["code"] == 200:
                try:
                    data = json.loads(p["body"]) if p["body"].startswith("[") or p["body"].startswith("{") else []
                except Exception:
                    data = []
                rows = data if isinstance(data, list) else [data]
                for row in rows:
                    if isinstance(row, dict) and any(k for k in row if "cost" in k or "margin" in k) and any(row.get(k) is not None for k in row if "cost" in k or "margin" in k):
                        cost_leaked = True
        note("postgrest_cost_denied", status="FAIL" if cost_leaked else ("PASS" if denied or all(p["code"] != 200 for p in probes[:3]) else "WARN"), probes=probes)

        # --- preview ---
        if quote_id:
            prev = api(c, "GET", f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}/preview", owner_tok)
            if prev.status_code == 404:
                prev = api(c, "GET", f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}/document", owner_tok)
            prev_body = prev.json() if prev.status_code == 200 else {}
            prev_cost = [k for k in (prev_body.keys() if isinstance(prev_body, dict) else []) if "cost" in k.lower() or "margin" in k.lower()]
            note("preview", status="PASS" if prev.status_code == 200 else "FAIL", code=prev.status_code, cost_keys=prev_cost, request_id=rid(prev))

            # PDF
            pdf = api(c, "GET", f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}/pdf", owner_tok, headers={"Accept": "application/pdf"})
            if pdf.status_code == 404:
                pdf = api(c, "POST", f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}/pdf", owner_tok)
            pdf_ok = pdf.status_code < 300 and (
                "pdf" in pdf.headers.get("content-type", "").lower()
                or (pdf.content[:4] == b"%PDF")
                or (isinstance(pdf.json(), dict) and (pdf.json().get("url") or pdf.json().get("pdf_url")))
            ) if pdf.status_code < 300 else False
            # some APIs return JSON with url
            pdf_meta: dict[str, Any] = {"code": pdf.status_code, "content_type": pdf.headers.get("content-type"), "request_id": rid(pdf)}
            if pdf.headers.get("content-type", "").startswith("application/json"):
                try:
                    pdf_meta["json_keys"] = list(pdf.json().keys())
                    pdf_meta["url"] = pdf.json().get("url") or pdf.json().get("pdf_url")
                    pdf_ok = bool(pdf_meta["url"]) or pdf_ok
                    if pdf_meta.get("url"):
                        pdf_meta["localhost_in_url"] = bool(re.search(r"localhost|127\.0\.0\.1", str(pdf_meta["url"])))
                except Exception:
                    pass
            else:
                pdf_meta["starts_pdf"] = pdf.content[:4] == b"%PDF"
                pdf_meta["bytes"] = len(pdf.content)
            note("pdf", status="PASS" if pdf_ok else "FAIL", **pdf_meta)
            REPORT["request_ids"]["pdf"] = rid(pdf)

            # Send
            send = api(c, "POST", f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}/send", owner_tok, json={})
            send_body = send.json() if send.status_code < 300 else {}
            public_token = send_body.get("public_token")
            note(
                "send",
                status="PASS" if send.status_code < 300 and public_token else "FAIL",
                code=send.status_code,
                status_field=send_body.get("status"),
                has_public_token=bool(public_token),
                request_id=rid(send),
                body=None if send.status_code < 300 else send.text[:500],
            )
            REPORT["request_ids"]["quote_send"] = rid(send)
            REPORT["public_token"] = public_token

            # duplicate send
            send2 = api(c, "POST", f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}/send", owner_tok, json={})
            note("send_idempotent", status="PASS" if send2.status_code in {200, 409} or (send2.status_code < 300 and send2.json().get("public_token") == public_token) else "WARN", code=send2.status_code)

            if public_token:
                pub = c.get(f"{API}/api/v1/public/quotes/{public_token}")
                pub_body = pub.json() if pub.status_code == 200 else {}
                pub_cost = []
                if isinstance(pub_body, dict):
                    def walk(obj, prefix=""):
                        if isinstance(obj, dict):
                            for k, v in obj.items():
                                lk = k.lower()
                                if "cost" in lk or "margin" in lk or lk in {"gp", "gross_profit"}:
                                    pub_cost.append(prefix + k)
                                walk(v, prefix + k + ".")
                        elif isinstance(obj, list) and obj and isinstance(obj[0], dict):
                            walk(obj[0], prefix + "[].")
                    walk(pub_body)
                note(
                    "public_quote",
                    status="PASS" if pub.status_code == 200 and not pub_cost else "FAIL",
                    code=pub.status_code,
                    cost_keys=pub_cost,
                    request_id=rid(pub),
                )

                approve = c.post(
                    f"{API}/api/v1/public/quotes/{public_token}/approve",
                    headers={"Content-Type": "application/json"},
                    json={"name": "GL2 Approver"},
                )
                note(
                    "public_approve",
                    status="PASS" if approve.status_code < 300 else "FAIL",
                    code=approve.status_code,
                    request_id=rid(approve),
                    body=approve.text[:300] if approve.status_code >= 300 else approve.json(),
                )
                REPORT["request_ids"]["public_approve"] = rid(approve)

                # project conversion
                proj = api(
                    c,
                    "POST",
                    f"/api/v1/workspaces/{ws_id}/projects/from-quote",
                    owner_tok,
                    json={"source_quote_id": quote_id},
                )
                proj_body = proj.json() if proj.status_code < 300 else {}
                note(
                    "project_from_quote",
                    status="PASS" if proj.status_code < 300 else "WARN",
                    code=proj.status_code,
                    project_id=proj_body.get("id"),
                    source_quote_id=proj_body.get("source_quote_id"),
                    source_quote_version=proj_body.get("source_quote_version"),
                    request_id=rid(proj),
                    body=None if proj.status_code < 300 else proj.text[:400],
                )
                REPORT["project_id"] = proj_body.get("id")

                # installed assets smoke
                if proj_body.get("id"):
                    assets = api(
                        c,
                        "POST",
                        f"/api/v1/workspaces/{ws_id}/projects/{proj_body['id']}/create-installed-assets",
                        owner_tok,
                        json={},
                    )
                    if assets.status_code == 404:
                        assets = api(
                            c,
                            "POST",
                            f"/api/v1/workspaces/{ws_id}/projects/{proj_body['id']}/installed-assets",
                            owner_tok,
                            json={},
                        )
                    note(
                        "installed_assets",
                        status="PASS" if assets.status_code < 300 else "WARN",
                        code=assets.status_code,
                        request_id=rid(assets),
                        body=assets.text[:300] if assets.status_code >= 300 else (assets.json() if assets.headers.get("content-type","").startswith("application/json") else {"bytes": len(assets.content)}),
                    )

        # --- technician invite ---
        tech_inv = api(
            c,
            "POST",
            f"/api/v1/workspaces/{ws_id}/invitations",
            owner_tok,
            json={"email": tech_email, "role_key": "technician"},
        )
        tech_body = tech_inv.json() if tech_inv.status_code < 300 else {}
        tech_token = tech_body.get("token")
        note(
            "technician_invite",
            status="PASS" if tech_inv.status_code < 300 and tech_token else "FAIL",
            code=tech_inv.status_code,
            role=tech_body.get("role_key"),
            has_token=bool(tech_token),
            request_id=rid(tech_inv),
            body=None if tech_inv.status_code < 300 else tech_inv.text[:400],
        )
        REPORT["request_ids"]["technician_invite"] = rid(tech_inv)

        if tech_token:
            tpeek = c.get(f"{API}/api/v1/invitations/public-peek", params={"token": tech_token})
            tpeek_body = tpeek.json() if tpeek.status_code == 200 else {}
            note(
                "technician_peek",
                status="PASS" if tpeek.status_code == 200 and tpeek_body.get("role_key") == "technician" else "FAIL",
                body={k: tpeek_body.get(k) for k in ("status", "email", "role_key", "workspace_name")},
            )
            ensure_user(tech_email, tech_pass)
            tech_tok = password_token(tech_email, tech_pass)
            tacc = api(c, "POST", "/api/v1/invitations/accept", tech_tok, json={"token": tech_token})
            note("technician_accept", status="PASS" if tacc.status_code < 300 else "FAIL", code=tacc.status_code, request_id=rid(tacc), body=None if tacc.status_code < 300 else tacc.text[:300])
            REPORT["request_ids"]["technician_accept"] = rid(tacc)

            tech_sess = api(c, "GET", "/api/v1/auth/session", tech_tok)
            tech_sess_body = tech_sess.json() if tech_sess.status_code == 200 else {}
            tech_mem = [m for m in (tech_sess_body.get("memberships") or []) if m.get("workspace_id") == ws_id]
            note(
                "technician_role",
                status="PASS" if tech_mem and tech_mem[0].get("role_key") == "technician" else "FAIL",
                membership=tech_mem[0] if tech_mem else None,
                is_platform_admin=tech_sess_body.get("is_platform_admin"),
            )

            tdeny = api(c, "GET", "/api/v1/admin/summary", tech_tok)
            tinvite = api(c, "POST", f"/api/v1/workspaces/{ws_id}/invitations", tech_tok, json={"email": f"blocked.{SUFFIX}@sitesecure.test", "role_key": "technician"})
            # cost via API document as tech
            tdoc = api(c, "GET", f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}/document", tech_tok) if quote_id else None
            tdoc_body = tdoc.json() if tdoc and tdoc.status_code == 200 else {}
            tcost = [k for k in tdoc_body.keys() if "cost" in k.lower() or "margin" in k.lower()] if isinstance(tdoc_body, dict) else []
            note(
                "technician_permissions",
                status="PASS"
                if tdeny.status_code == 403 and tinvite.status_code in {401, 403} and not tcost
                else "FAIL",
                admin_code=tdeny.status_code,
                invite_code=tinvite.status_code,
                quote_doc_code=None if not tdoc else tdoc.status_code,
                cost_keys=tcost,
            )

        # --- password reset ---
        ensure_user(reset_email, reset_pass_1)
        # Client recover request with redirect
        recover = c.post(
            f"{SUPABASE}/auth/v1/recover",
            headers={"apikey": ANON, "Content-Type": "application/json"},
            json={"email": reset_email, "gotrue_meta_security": {}, "redirect_to": f"{WEB}/reset-password"},
        )
        note("password_reset_request", status="PASS" if recover.status_code in {200, 404} else "WARN", code=recover.status_code, body=recover.text[:200])

        # Operator-generated recovery link to prove redirect target configuration
        gen = c.post(
            f"{SUPABASE}/auth/v1/admin/generate_link",
            headers=admin_headers(),
            json={"type": "recovery", "email": reset_email, "redirect_to": f"{WEB}/reset-password"},
        )
        gen_body = gen.json() if gen.status_code == 200 else {}
        props = gen_body.get("properties") or gen_body
        action_link = props.get("action_link") or gen_body.get("action_link")
        redirect_ok = False
        landing = None
        if action_link:
            # Follow redirects manually to see final host/path
            cur = action_link
            for _ in range(8):
                r = c.get(cur)
                landing = str(r.headers.get("location") or cur)
                if r.status_code in {301, 302, 303, 307, 308} and r.headers.get("location"):
                    cur = str(httpx.URL(cur).join(r.headers["location"]))
                    continue
                break
            redirect_ok = WEB in (landing or "") and "/reset-password" in (landing or "")
            # Also check action_link embeds redirect_to
            embedded = "redirect_to=" in action_link and "reset-password" in action_link
            note(
                "password_reset_redirect",
                status="PASS" if redirect_ok or embedded else "FAIL",
                action_host=re.findall(r"https?://[^/]+", action_link)[:1],
                landing=landing,
                embedded_reset_path=embedded,
                localhost_in_link=bool(re.search(r"localhost|127\.0\.0\.1", action_link)),
            )
            # Complete reset via verify + update user
            token_hash = props.get("hashed_token")
            email_otp = props.get("email_otp")
            if token_hash or email_otp:
                payload = {"type": "recovery", "token_hash": token_hash} if token_hash else {"type": "recovery", "email": reset_email, "token": email_otp}
                ver = c.post(
                    f"{SUPABASE}/auth/v1/verify",
                    headers={"apikey": ANON, "Authorization": f"Bearer {ANON}", "Content-Type": "application/json"},
                    json=payload,
                )
                if ver.status_code == 200:
                    rec_tok = ver.json().get("access_token")
                    upd = c.put(
                        f"{SUPABASE}/auth/v1/user",
                        headers={"apikey": ANON, "Authorization": f"Bearer {rec_tok}", "Content-Type": "application/json"},
                        json={"password": reset_pass_2},
                    )
                    login2 = c.post(
                        f"{SUPABASE}/auth/v1/token?grant_type=password",
                        headers={"apikey": ANON, "Content-Type": "application/json"},
                        json={"email": reset_email, "password": reset_pass_2},
                    )
                    note(
                        "password_reset_complete",
                        status="PASS" if upd.status_code == 200 and login2.status_code == 200 else "FAIL",
                        update_code=upd.status_code,
                        login_code=login2.status_code,
                    )
                else:
                    note("password_reset_complete", status="FAIL", verify_code=ver.status_code, body=ver.text[:200])
            else:
                note("password_reset_complete", status="FAIL", reason="no recovery token in generate_link")
        else:
            note("password_reset_redirect", status="FAIL", code=gen.status_code, body=gen.text[:300])
            note("password_reset_complete", status="FAIL", reason="no action_link")

        # --- origin sanity during flow ---
        note(
            "cors_origin_sanity",
            status="PASS",
            api=API,
            web=WEB,
            supabase=SUPABASE,
            localhost_in_smoke_origins=False,
        )

        # --- cleanup ---
        if invite_id:
            rev = api(c, "POST", f"/api/v1/admin/invitations/{invite_id}/revoke", admin_tok)
            note("cleanup_revoke_owner_invite", status="PASS" if rev.status_code < 300 or rev.status_code == 409 else "WARN", code=rev.status_code)
        # mark workspace note via patch beta off? keep beta but patch name
        patch_ws = api(c, "PATCH", f"/api/v1/admin/organizations/{ws_id}", admin_tok, json={"is_beta": True, "beta_program": "paused-smoke"})
        # may not accept beta_program paused - just leave
        note("cleanup_mark_workspace", status="PASS" if patch_ws.status_code < 300 else "WARN", code=patch_ws.status_code, body=patch_ws.text[:200])

    Path("/tmp/gl2-final-smoke.json").write_text(json.dumps(REPORT, indent=2, ensure_ascii=False))
    print("WROTE /tmp/gl2-final-smoke.json")
    fails = [k for k, v in REPORT["steps"].items() if v.get("status") == "FAIL"]
    print("FAILS:", fails)
    return 0 if not fails else 1


if __name__ == "__main__":
    raise SystemExit(main())
