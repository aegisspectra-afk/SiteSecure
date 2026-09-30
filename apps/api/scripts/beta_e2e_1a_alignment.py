#!/usr/bin/env python3
"""BETA-E2E-1A — SETTINGS-3B live alignment recert (A–H + golden smoke)."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "Docs" / "beta-e2e-1a-alignment"
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "artifacts").mkdir(exist_ok=True)
(OUT / "pdfs").mkdir(exist_ok=True)


def load_env() -> None:
    for p in (ROOT / ".env", ROOT / "apps" / "api" / ".env"):
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            if not line.strip() or line.strip().startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env()

API = os.environ.get("EXTERNAL_API_URL", "https://site-secure-api-staging.onrender.com").rstrip("/")
WEB = os.environ.get("EXTERNAL_WEB_URL", "https://site-secure-umber.vercel.app").rstrip("/")
SUPABASE = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
GIT_SHA = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT).decode().strip()
# Prefer the SHA we pushed / Render deployed
DEPLOY_SHA = os.environ.get("EXPECTED_API_SHA", "f8fa9e5a5180c2927c7a2d22b3c7b9362897d96e")

SUFFIX = datetime.now(timezone.utc).strftime("%H%M%S")
OWNER_EMAIL = f"e2e1a.owner.{SUFFIX}@sitesecure.test"
OWNER_PASS = f"E2e1a!{SUFFIX}Aa1"
TERMS = "40% מקדמה · 60% בגמר התקנה · E2E1A"

report: dict = {
    "suite": "BETA-E2E-1A",
    "timestamp_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "web": WEB,
    "api": API,
    "git_sha_workspace": GIT_SHA,
    "expected_deployed_api_sha": DEPLOY_SHA,
    "accounts": {"owner": OWNER_EMAIL, "note": "Passwords omitted"},
    "ids": {},
    "cases": {},
    "defects": [],
}


def note(key: str, **kwargs) -> None:
    report["cases"][key] = kwargs
    safe = {k: v for k, v in kwargs.items() if k != "result"}
    print(f"[{kwargs.get('result', '?')}] {key}: {json.dumps(safe, ensure_ascii=False)[:240]}")


def defect(sev: str, title: str, detail: str) -> None:
    report["defects"].append({"sev": sev, "title": title, "detail": detail[:500]})
    print(f"DEFECT[{sev}] {title} :: {detail[:200]}")


def admin_headers() -> dict:
    return {"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}", "Content-Type": "application/json"}


def auth_h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def api(c: httpx.Client, method: str, path: str, token: str, **kw) -> httpx.Response:
    return c.request(method, f"{API}{path}", headers=auth_h(token), **kw)


def platform_admin_token(c: httpx.Client) -> str:
    link = c.post(
        f"{SUPABASE}/auth/v1/admin/generate_link",
        headers=admin_headers(),
        json={"type": "magiclink", "email": "aegisspectra@gmail.com"},
    )
    link.raise_for_status()
    data = link.json()
    props = data.get("properties") or data
    payload = (
        {"type": "magiclink", "token_hash": props["hashed_token"]}
        if props.get("hashed_token")
        else {"type": "email", "email": "aegisspectra@gmail.com", "token": props["email_otp"]}
    )
    verify = c.post(
        f"{SUPABASE}/auth/v1/verify",
        headers={"apikey": ANON, "Authorization": f"Bearer {ANON}", "Content-Type": "application/json"},
        json=payload,
    )
    verify.raise_for_status()
    tok = verify.json().get("access_token")
    if not tok:
        raise RuntimeError("no platform admin token")
    return tok


def ensure_user(c: httpx.Client, email: str, password: str, full_name: str) -> None:
    listed = c.get(f"{SUPABASE}/auth/v1/admin/users", headers=admin_headers(), params={"page": 1, "per_page": 200})
    uid = None
    if listed.status_code == 200:
        for u in listed.json().get("users") or []:
            if (u.get("email") or "").lower() == email.lower():
                uid = u.get("id")
                break
    body = {"email": email, "password": password, "email_confirm": True, "user_metadata": {"full_name": full_name}}
    if uid:
        c.put(f"{SUPABASE}/auth/v1/admin/users/{uid}", headers=admin_headers(), json=body).raise_for_status()
    else:
        c.post(f"{SUPABASE}/auth/v1/admin/users", headers=admin_headers(), json=body).raise_for_status()


def password_token(c: httpx.Client, email: str, password: str) -> str:
    r = c.post(
        f"{SUPABASE}/auth/v1/token?grant_type=password",
        headers={"apikey": ANON, "Content-Type": "application/json"},
        json={"email": email, "password": password},
    )
    r.raise_for_status()
    return r.json()["access_token"]


def expected_valid_until(days: int = 21) -> str:
    return (datetime.now(ZoneInfo("Asia/Jerusalem")).date() + timedelta(days=days)).isoformat()


def walk_cost_keys(obj, prefix: str = "") -> list[str]:
    found: list[str] = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            lk = str(k).lower()
            if "cost" in lk or "margin" in lk or lk in {"gp", "gross_profit", "unit_cost"}:
                found.append(prefix + str(k))
            found.extend(walk_cost_keys(v, prefix + str(k) + "."))
    elif isinstance(obj, list) and obj:
        found.extend(walk_cost_keys(obj[0], prefix + "[]."))
    return found


def main() -> int:
    with httpx.Client(timeout=120, follow_redirects=False) as c:
        h = c.get(f"{API}/api/v1/health")
        report["api_v1_health"] = {"status": h.status_code, "body": h.text[:200]}
        if h.status_code != 200:
            defect("P0", "API health failed", h.text[:200])
            _write()
            return 1

        admin_tok = platform_admin_token(c)
        create_ws = api(
            c,
            "POST",
            "/api/v1/admin/organizations",
            admin_tok,
            json={
                "name": f"BETA-E2E-1A {SUFFIX}",
                "plan_key": "business",
                "is_beta": True,
                "beta_program": "early",
                "internal_note": f"BETA-E2E-1A {SUFFIX}",
            },
        )
        ws = create_ws.json() if create_ws.status_code < 300 else {}
        ws_id = ws.get("id")
        report["ids"]["workspace_id"] = ws_id
        if not ws_id:
            defect("P0", "workspace create failed", create_ws.text[:300])
            _write()
            return 1

        inv = api(
            c,
            "POST",
            "/api/v1/admin/invitations",
            admin_tok,
            json={"workspace_id": ws_id, "email": OWNER_EMAIL, "role_key": "owner"},
        )
        inv_body = inv.json() if inv.status_code < 300 else {}
        token = inv_body.get("token")
        if not token:
            defect("P0", "invite failed", inv.text[:300])
            _write()
            return 1

        ensure_user(c, OWNER_EMAIL, OWNER_PASS, f"E2E1A Owner {SUFFIX}")
        owner_tok = password_token(c, OWNER_EMAIL, OWNER_PASS)
        acc = api(c, "POST", "/api/v1/invitations/accept", owner_tok, json={"token": token})
        if acc.status_code >= 300:
            defect("P0", "invite accept failed", acc.text[:300])
            _write()
            return 1

        # Persist SETTINGS-3B
        patch = api(
            c,
            "PATCH",
            f"/api/v1/workspaces/{ws_id}/settings",
            owner_tok,
            json={
                "quotes": {"validity_days": 21, "payment_terms": TERMS, "show_vat": True},
                "scheduling": {"sites": {"require_address": True, "require_access_notes": True}},
            },
        )
        if patch.status_code >= 300:
            defect("P0", "settings patch failed", patch.text[:300])
            _write()
            return 1
        settings = api(c, "GET", f"/api/v1/workspaces/{ws_id}/settings", owner_tok).json()
        sched = ((settings.get("scheduling") or {}).get("sites") or {})
        quotes_cfg = settings.get("quotes") or {}
        note(
            "settings_saved",
            result="PASS"
            if sched.get("require_address") is True and int(quotes_cfg.get("validity_days") or 0) == 21
            else "FAIL",
            scheduling_sites=sched,
            quotes={k: quotes_cfg.get(k) for k in ("validity_days", "payment_terms")},
        )

        cust = api(
            c,
            "POST",
            f"/api/v1/workspaces/{ws_id}/customers",
            owner_tok,
            json={"display_name": f"לקוח יישור {SUFFIX}", "email": f"cust.{SUFFIX}@example.com"},
        )
        cust.raise_for_status()
        customer_id = cust.json()["id"]
        report["ids"]["customer_id"] = customer_id

        # A
        a = api(
            c,
            "POST",
            f"/api/v1/workspaces/{ws_id}/sites",
            owner_tok,
            json={"customer_id": customer_id, "name": "אתר ללא כתובת", "access_notes": "יש הערות"},
        )
        note("A_require_address_on", result="PASS" if a.status_code >= 400 else "FAIL", code=a.status_code, body=a.text[:180])
        if a.status_code < 400:
            defect("P1", "A require_address ON not enforced", f"code={a.status_code}")

        # B
        api(
            c,
            "PATCH",
            f"/api/v1/workspaces/{ws_id}/settings",
            owner_tok,
            json={"scheduling": {"sites": {"require_address": False, "require_access_notes": True}}},
        ).raise_for_status()
        b = api(
            c,
            "POST",
            f"/api/v1/workspaces/{ws_id}/sites",
            owner_tok,
            json={"customer_id": customer_id, "name": "אתר ללא כתובת OFF", "access_notes": "הערות גישה"},
        )
        note("B_require_address_off", result="PASS" if b.status_code < 300 else "FAIL", code=b.status_code, body=b.text[:180])
        if b.status_code >= 300:
            defect("P1", "B require_address OFF should allow create", f"code={b.status_code}")

        # C
        c_resp = api(
            c,
            "POST",
            f"/api/v1/workspaces/{ws_id}/sites",
            owner_tok,
            json={
                "customer_id": customer_id,
                "name": "אתר ללא הערות",
                "address": {"line": "רחוב הבדיקה 1", "city": "תל אביב"},
            },
        )
        note(
            "C_require_access_notes_on",
            result="PASS" if c_resp.status_code >= 400 else "FAIL",
            code=c_resp.status_code,
            body=c_resp.text[:180],
        )
        if c_resp.status_code < 400:
            defect("P1", "C require_access_notes ON not enforced", f"code={c_resp.status_code}")

        # D
        api(
            c,
            "PATCH",
            f"/api/v1/workspaces/{ws_id}/settings",
            owner_tok,
            json={"scheduling": {"sites": {"require_address": False, "require_access_notes": False}}},
        ).raise_for_status()
        d = api(
            c,
            "POST",
            f"/api/v1/workspaces/{ws_id}/sites",
            owner_tok,
            json={
                "customer_id": customer_id,
                "name": "אתר ללא הערות OFF",
                "address": {"line": "רחוב חופשי 2", "city": "חיפה"},
            },
        )
        note("D_require_access_notes_off", result="PASS" if d.status_code < 300 else "FAIL", code=d.status_code, body=d.text[:180])
        if d.status_code >= 300:
            defect("P1", "D require_access_notes OFF should allow create", f"code={d.status_code}")

        # Restore quote defaults + site requirements for golden path
        api(
            c,
            "PATCH",
            f"/api/v1/workspaces/{ws_id}/settings",
            owner_tok,
            json={
                "quotes": {"validity_days": 21, "payment_terms": TERMS, "show_vat": True},
                "scheduling": {"sites": {"require_address": True, "require_access_notes": True}},
            },
        ).raise_for_status()

        exp = expected_valid_until(21)

        # E + F
        qe = api(
            c,
            "POST",
            f"/api/v1/workspaces/{ws_id}/quotes",
            owner_tok,
            json={"customer_id": customer_id, "title": f"E defaults {SUFFIX}"},
        )
        qe_body = qe.json() if qe.status_code < 300 else {}
        e_pass = qe.status_code < 300 and qe_body.get("valid_until") == exp
        note(
            "E_validity_default",
            result="PASS" if e_pass else "FAIL",
            code=qe.status_code,
            valid_until=qe_body.get("valid_until"),
            expected=exp,
        )
        if not e_pass:
            defect("P1", "E validity_days default not applied", f"got={qe_body.get('valid_until')} expected={exp} code={qe.status_code} {qe.text[:120]}")

        f_pass = qe.status_code < 300 and (qe_body.get("payment_terms") or "").strip() == TERMS
        note(
            "F_payment_terms_default",
            result="PASS" if f_pass else "FAIL",
            payment_terms=qe_body.get("payment_terms"),
            expected=TERMS,
        )
        if not f_pass:
            defect("P1", "F payment_terms default not applied", f"got={qe_body.get('payment_terms')}")

        existing_quote_id = qe_body.get("id")
        report["ids"]["quote_defaults_id"] = existing_quote_id
        before_h = None
        if existing_quote_id:
            before_h = api(c, "GET", f"/api/v1/workspaces/{ws_id}/quotes/{existing_quote_id}", owner_tok).json()

        # G
        explicit_until = (date.today() + timedelta(days=7)).isoformat()
        explicit_terms = "תנאים מפורשים OVERRIDE"
        qg = api(
            c,
            "POST",
            f"/api/v1/workspaces/{ws_id}/quotes",
            owner_tok,
            json={
                "customer_id": customer_id,
                "title": f"G override {SUFFIX}",
                "valid_until": explicit_until,
                "payment_terms": explicit_terms,
            },
        )
        qg_body = qg.json() if qg.status_code < 300 else {}
        g_pass = (
            qg.status_code < 300
            and qg_body.get("valid_until") == explicit_until
            and (qg_body.get("payment_terms") or "").strip() == explicit_terms
        )
        note(
            "G_explicit_override",
            result="PASS" if g_pass else "FAIL",
            code=qg.status_code,
            valid_until=qg_body.get("valid_until"),
            payment_terms=qg_body.get("payment_terms"),
        )
        if not g_pass:
            defect("P1", "G explicit override failed", qg.text[:160])

        # H
        h_pass = False
        if before_h and existing_quote_id:
            after = api(c, "GET", f"/api/v1/workspaces/{ws_id}/quotes/{existing_quote_id}", owner_tok).json()
            h_pass = (
                after.get("valid_until") == before_h.get("valid_until")
                and after.get("payment_terms") == before_h.get("payment_terms")
                and after.get("version") == before_h.get("version")
            )
            note(
                "H_existing_unchanged",
                result="PASS" if h_pass else "FAIL",
                before_valid=before_h.get("valid_until"),
                after_valid=after.get("valid_until"),
            )
        else:
            note("H_existing_unchanged", result="FAIL", reason="no baseline")
        if not h_pass:
            defect("P1", "H existing quote changed unexpectedly", "see cases")

        # Golden path — defaults only
        site = api(
            c,
            "POST",
            f"/api/v1/workspaces/{ws_id}/sites",
            owner_tok,
            json={
                "customer_id": customer_id,
                "name": f"אתר זהב {SUFFIX}",
                "address": {"line": "דרך השלום 10", "city": "תל אביב"},
                "access_notes": "קוד 9999",
            },
        )
        site.raise_for_status()
        site_id = site.json()["id"]
        report["ids"]["site_id"] = site_id

        quote = api(
            c,
            "POST",
            f"/api/v1/workspaces/{ws_id}/quotes",
            owner_tok,
            json={"customer_id": customer_id, "site_id": site_id, "title": f"הצעת זהב {SUFFIX}"},
        )
        quote.raise_for_status()
        q = quote.json()
        quote_id = q["id"]
        report["ids"]["golden_quote_id"] = quote_id
        defaults_ok = q.get("valid_until") == exp and (q.get("payment_terms") or "").strip() == TERMS
        note(
            "golden_quote_defaults",
            result="PASS" if defaults_ok else "FAIL",
            valid_until=q.get("valid_until"),
            payment_terms=q.get("payment_terms"),
        )
        if not defaults_ok:
            defect("P0", "Golden quote missing workspace defaults", json.dumps({k: q.get(k) for k in ('valid_until','payment_terms')}, ensure_ascii=False))

        item = api(
            c,
            "POST",
            f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}/items",
            owner_tok,
            json={"description": "מצלמת IP 4MP", "qty": 4, "unit_price": 450},
        )
        item.raise_for_status()
        q_after = api(c, "GET", f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}", owner_tok).json()
        pricing_ok = float(q_after.get("total_gross") or 0) > 0
        note("regression_pricing", result="PASS" if pricing_ok else "FAIL", total_gross=q_after.get("total_gross"))

        items = q_after.get("items") or []
        item_id = items[0]["id"] if items else (item.json().get("items") or [{}])[0].get("id") or item.json().get("id")
        if item_id and items:
            patch_item = api(
                c,
                "PATCH",
                f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}/items/{item_id}",
                owner_tok,
                json={"qty": 5},
            )
            note("regression_autosave", result="PASS" if patch_item.status_code < 300 else "FAIL", code=patch_item.status_code)
        elif item_id:
            # item endpoint may return the item itself
            patch_item = api(
                c,
                "PATCH",
                f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}/items/{item_id}",
                owner_tok,
                json={"qty": 5},
            )
            note("regression_autosave", result="PASS" if patch_item.status_code < 300 else "FAIL", code=patch_item.status_code)
        else:
            note("regression_autosave", result="FAIL", reason="no item id", item_keys=list(item.json().keys())[:20])

        doc = api(c, "GET", f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}/document", owner_tok)
        note("golden_preview", result="PASS" if doc.status_code < 300 else "FAIL", code=doc.status_code)

        pdf = api(c, "GET", f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}/pdf", owner_tok)
        pdf_ok = pdf.status_code < 300 and pdf.content[:4] == b"%PDF"
        note("golden_pdf", result="PASS" if pdf_ok else "FAIL", code=pdf.status_code, nbytes=len(pdf.content))
        if pdf_ok:
            (OUT / "pdfs" / f"quote-{quote_id}.pdf").write_bytes(pdf.content)

        send = api(c, "POST", f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}/send", owner_tok, json={})
        send_body = send.json() if send.status_code < 300 and "json" in send.headers.get("content-type", "") else {}
        if send.status_code >= 300:
            # try without body
            send = api(c, "POST", f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}/send", owner_tok)
            send_body = send.json() if send.status_code < 300 else {}
        note("golden_send", result="PASS" if send.status_code < 300 else "FAIL", code=send.status_code, body=str(send_body)[:200] or send.text[:200])
        if send.status_code >= 300:
            defect("P0", "Golden send failed", send.text[:250])

        pub_token = None
        if send.status_code < 300:
            gq = api(c, "GET", f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}", owner_tok).json()
            pub_token = (
                send_body.get("public_token")
                or send_body.get("token")
                or gq.get("public_token")
                or (send_body.get("share") or {}).get("token")
            )
            if not pub_token:
                # share endpoint variants used in E2E-1
                for path in (
                    f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}/share",
                    f"/api/v1/workspaces/{ws_id}/quotes/{quote_id}/public-link",
                ):
                    sh = api(c, "POST", path, owner_tok, json={})
                    if sh.status_code < 300:
                        pub_token = sh.json().get("token") or sh.json().get("public_token")
                        if pub_token:
                            break
            report["ids"]["public_token_present"] = bool(pub_token)

        if pub_token:
            pub = c.get(f"{API}/api/v1/public/quotes/{pub_token}")
            pub_j = pub.json() if pub.status_code < 300 else {}
            leaks = walk_cost_keys(pub_j)
            note(
                "regression_public_cost_protection",
                result="PASS" if pub.status_code < 300 and not leaks else "FAIL",
                code=pub.status_code,
                leaks=leaks[:10],
            )
            appr = c.post(
                f"{API}/api/v1/public/quotes/{pub_token}/approve",
                headers={"Content-Type": "application/json"},
                json={
                    "name": "לקוח בדיקה",
                    "terms_accepted": True,
                    "signature_data_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5W2fQAAAAASUVORK5CYII=",
                },
            )
            note("regression_approval", result="PASS" if appr.status_code < 300 else "FAIL", code=appr.status_code, body=appr.text[:160])
            if appr.status_code >= 300:
                defect("P1", "Approval regression failed", appr.text[:200])
            proj = api(
                c,
                "POST",
                f"/api/v1/workspaces/{ws_id}/projects/from-quote",
                owner_tok,
                json={"source_quote_id": quote_id},
            )
            note(
                "regression_project_conversion",
                result="PASS" if proj.status_code < 300 else "FAIL",
                code=proj.status_code,
                body=proj.text[:180],
            )
            if proj.status_code < 300:
                report["ids"]["project_id"] = proj.json().get("id") or (proj.json().get("project") or {}).get("id")
        else:
            note("regression_public_cost_protection", result="FAIL", reason="no public token")
            note("regression_approval", result="FAIL", reason="no public token")
            note("regression_project_conversion", result="FAIL", reason="no public token")

    fails = [k for k, v in report["cases"].items() if v.get("result") == "FAIL"]
    p0 = [d for d in report["defects"] if d["sev"] == "P0"]
    p1 = [d for d in report["defects"] if d["sev"] == "P1"]
    report["summary"] = {
        "fails": fails,
        "p0": len(p0),
        "p1": len(p1),
        "pass_count": sum(1 for v in report["cases"].values() if v.get("result") == "PASS"),
        "fail_count": len(fails),
    }
    _write()
    print("SUMMARY", json.dumps(report["summary"], ensure_ascii=False))
    return 0 if not fails and not p0 and not p1 else 1


def _write() -> None:
    (OUT / "artifacts" / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    raise SystemExit(main())
