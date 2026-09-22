"""CCTV blocker regression using Gate08 Beres workspace + disposable empty/full.

Does not commit the private workbook. Uses API only.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "apps" / "api" / ".env")

API = os.environ.get("API_URL", "http://127.0.0.1:8010").rstrip("/")
SUP = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
OUT = Path(__file__).resolve().parent / "_beta_cctv_blocker" / "report.json"
OUT.parent.mkdir(parents=True, exist_ok=True)
GATE08_REPORT = ROOT / "apps" / "web" / "scripts" / "_beta_gate08" / "report.json"

report: dict = {"ok": True, "failures": [], "scenarios": {}}


def fail(msg: str) -> None:
    report["ok"] = False
    report["failures"].append(msg)
    print("FAIL", msg, flush=True)


def note(msg: str) -> None:
    print("NOTE", msg, flush=True)


def svc_headers():
    return {"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}", "Content-Type": "application/json"}


def password_login(email: str, password: str) -> str | None:
    r = httpx.post(
        f"{SUP}/auth/v1/token?grant_type=password",
        headers={"apikey": ANON, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=60,
    )
    if r.status_code == 200:
        return r.json()["access_token"]
    return None


def ensure_password(email: str, password: str) -> str:
    tok = password_login(email, password)
    if tok:
        return tok
    with httpx.Client(timeout=60) as c:
        listed = c.get(f"{SUP}/auth/v1/admin/users", headers=svc_headers(), params={"page": 1, "per_page": 200})
        users = (listed.json() or {}).get("users") or []
        uid = next((u["id"] for u in users if (u.get("email") or "").lower() == email.lower()), None)
        if not uid:
            # create
            c.post(
                f"{SUP}/auth/v1/admin/users",
                headers=svc_headers(),
                json={"email": email, "password": password, "email_confirm": True},
            )
        else:
            c.put(
                f"{SUP}/auth/v1/admin/users/{uid}",
                headers=svc_headers(),
                json={"email_confirm": True, "password": password},
            )
    tok = password_login(email, password)
    if not tok:
        raise RuntimeError(f"login failed for {email}")
    return tok


def create_user_ws(label: str) -> tuple[str, str, str]:
    email = f"cctv-block-{int(time.time())}-{label}@sitesecure.test"
    password = f"CctvBlock-{label}-2026!"
    print(f"create_user_ws {label}…", flush=True)
    with httpx.Client(timeout=60) as c:
        c.post(
            f"{SUP}/auth/v1/signup",
            headers={"apikey": ANON, "Content-Type": "application/json"},
            json={"email": email, "password": password},
        )
        listed = c.get(f"{SUP}/auth/v1/admin/users", headers=svc_headers(), params={"page": 1, "per_page": 200}).json()
        uid = next((u["id"] for u in (listed.get("users") or []) if (u.get("email") or "").lower() == email.lower()), None)
        if uid:
            c.put(f"{SUP}/auth/v1/admin/users/{uid}", headers=svc_headers(), json={"email_confirm": True, "password": password})
        else:
            c.post(
                f"{SUP}/auth/v1/admin/users",
                headers=svc_headers(),
                json={"email": email, "password": password, "email_confirm": True},
            )
        tok = ensure_password(email, password)
        ws = c.post(
            f"{SUP}/rest/v1/rpc/create_workspace",
            headers={
                "Authorization": f"Bearer {tok}",
                "apikey": ANON,
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            json={"p_name": f"CCTV Blocker {label}", "p_plan_key": "solo"},
        )
        body = ws.json()
        ws_id = body if isinstance(body, str) else (body.get("id") if isinstance(body, dict) else None)
        if not ws_id or ws.status_code >= 400:
            fail(f"create_workspace {ws.status_code} {str(body)[:200]}")
            raise SystemExit(1)
        return email, tok, str(ws_id)


def api(c: httpx.Client, tok: str, method: str, path: str, **kw):
    return c.request(method, f"{API}{path}", headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}, **kw)


def summarize_rec(rec: dict) -> dict:
    comps = {c["role"]: c for c in rec.get("components") or []}
    out = {"status": rec.get("status"), "blocking": rec.get("blocking"), "roles": {}, "warnings": [w.get("code") for w in (rec.get("warnings") or [])]}
    for role, c in comps.items():
        out["roles"][role] = {
            "resolution": c.get("resolution_status"),
            "selected": (c.get("selected_product") or {}).get("sku") or (c.get("selected_product") or {}).get("id"),
            "confidence": c.get("selected_confidence"),
            "candidates": len(c.get("candidates") or []),
            "env_check": ((c.get("selected_compatibility") or {}).get("environment")),
        }
    eng = rec.get("engineering") or {}
    out["eng_storage_tb"] = (eng.get("storage") or {}).get("requiredTbWithOverhead")
    out["eng_nvr"] = (eng.get("recorder") or {}).get("selectedChannelTier")
    return out


def resolved_lines(rec: dict) -> list[dict]:
    lines = []
    for c in rec.get("components") or []:
        sel = c.get("selected_product")
        conf = c.get("selected_confidence")
        if not sel or not sel.get("id") or conf == "TEXT_ASSISTED":
            continue
        lines.append({"role": c["role"], "product_id": sel["id"], "qty": float(c.get("quantity") or 1), "sku": sel.get("sku")})
    return lines


def apply_lines(c: httpx.Client, tok: str, ws: str, title: str, lines: list[dict]) -> dict:
    cust = api(c, tok, "GET", f"/api/v1/workspaces/{ws}/customers?limit=1").json()
    items = cust.get("items") if isinstance(cust, dict) else cust
    if not items:
        cr = api(c, tok, "POST", f"/api/v1/workspaces/{ws}/customers", json={"display_name": "CCTV Blocker Customer"})
        if cr.status_code >= 400:
            fail(f"create customer {cr.status_code} {cr.text[:200]}")
            return {"error": cr.text[:200]}
        cust_id = cr.json()["id"]
    else:
        cust_id = items[0]["id"]
    sites = api(c, tok, "GET", f"/api/v1/workspaces/{ws}/sites?limit=1").json()
    sitems = sites.get("items") if isinstance(sites, dict) else sites
    if not sitems:
        sr = api(c, tok, "POST", f"/api/v1/workspaces/{ws}/sites", json={"customer_id": cust_id, "name": "CCTV Blocker Site"})
        if sr.status_code >= 400:
            fail(f"create site {sr.status_code} {sr.text[:200]}")
            return {"error": sr.text[:200]}
        site_id = sr.json()["id"]
    else:
        site_id = sitems[0]["id"]
    q = api(
        c,
        tok,
        "POST",
        f"/api/v1/workspaces/{ws}/quotes",
        json={"customer_id": cust_id, "site_id": site_id, "title": title, "vat_percent": 18, "valid_until": "2026-12-31", "payment_terms": "net 30"},
    )
    if q.status_code >= 400:
        fail(f"create quote {q.status_code} {q.text[:200]}")
        return {"error": q.text[:200]}
    qid = q.json()["id"]
    sec = api(c, tok, "POST", f"/api/v1/workspaces/{ws}/quotes/{qid}/sections", json={"name": "CCTV", "sort_order": 10})
    sj = sec.json() if sec.status_code < 400 else {}
    section_id = (sj.get("section") or {}).get("id") or (sj.get("sections") or [{}])[-1].get("id") or sj.get("id")
    applied = []
    for line in lines:
        r = api(
            c,
            tok,
            "POST",
            f"/api/v1/workspaces/{ws}/quotes/{qid}/items",
            json={"product_id": line["product_id"], "item_type": "catalog", "qty": line["qty"], "section_id": section_id},
        )
        applied.append({"role": line["role"], "sku": line.get("sku"), "status": r.status_code})
    full = api(c, tok, "GET", f"/api/v1/workspaces/{ws}/quotes/{qid}").json()
    refresh = api(c, tok, "GET", f"/api/v1/workspaces/{ws}/quotes/{qid}").json()
    return {
        "quote_id": qid,
        "applied": applied,
        "items": len(full.get("items") or []),
        "refresh_items": len(refresh.get("items") or []),
        "skus": [i.get("sku") or i.get("description") for i in (full.get("items") or [])],
    }


def seed_full_catalog(c: httpx.Client, tok: str, ws: str) -> None:
    api(c, tok, "POST", f"/api/v1/workspaces/{ws}/catalog/ensure-defaults", json={})
    cats = api(c, tok, "GET", f"/api/v1/workspaces/{ws}/catalog/categories").json()
    clist = cats if isinstance(cats, list) else cats.get("items") or []
    by_key = {x["key"]: x["id"] for x in clist}
    specs = [
        ("cameras_ip", {"sku": "FULL-CAM-4", "name": "Full Cam 4MP Outdoor", "attributes": {"resolution_mp": 4, "environment": "outdoor", "poe": True, "max_power_w": 8}}),
        ("nvr", {"sku": "FULL-NVR-16", "name": "Full NVR 16", "attributes": {"channels": 16, "drive_bays": 4, "max_hdd_tb": 12, "poe_ports": 16, "poe_budget_w": 200}}),
        ("hdd_recorders", {"sku": "FULL-HDD-10", "name": "Full HDD 10TB", "attributes": {"capacity_tb": 10, "surveillance_grade": True}}),
        ("poe_plus", {"sku": "FULL-SW-16", "name": "Full PoE Switch 16", "attributes": {"ports": 16, "poe_ports": 16, "poe_budget_w": 200}}),
    ]
    for key, body in specs:
        cid = by_key.get(key) or by_key.get("switch") or by_key.get("poe")
        r = api(
            c,
            tok,
            "POST",
            f"/api/v1/workspaces/{ws}/catalog/products",
            json={**body, "category_id": cid, "list_price": 100, "cost": 50, "manufacturer": "QAFull", "model": body["sku"], "unit": "unit", "kind": "product"},
        )
        if r.status_code >= 400:
            fail(f"seed {body['sku']} {r.status_code} {r.text[:160]}")


def main() -> int:
    print("start", flush=True)
    g8 = json.loads(GATE08_REPORT.read_text(encoding="utf-8"))
    email = g8["auth"]["email"]
    ws = g8["workspace"]
    # password from email runId: beta.gate08.{runId}@…
    run_id = email.split("@")[0].split(".")[-1]
    password = f"Gate08-{run_id}-2026!"
    print(f"beres ws={ws} email={email}", flush=True)
    tok = ensure_password(email, password)
    report["beres_workspace"] = ws
    report["beres_email"] = email
    report["import"] = {"reused_gate08_workspace": True, "workbook_outside_git": True}

    with httpx.Client(timeout=120) as c:
        products = api(c, tok, "GET", f"/api/v1/workspaces/{ws}/catalog/products?limit=100").json()
        items = products.get("items") if isinstance(products, dict) else (products or [])
        total = products.get("total") if isinstance(products, dict) and products.get("total") is not None else len(items or [])
        report["import"]["product_total"] = total
        print(f"catalog products total={total}", flush=True)
        if not items:
            fail("Gate08 workspace has no products — re-import required")
            OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
            return 1

        def recommend(cams: int, environment=None):
            body = {
                "camera_count": cams,
                "resolution_mp": 4,
                "retention_days": 14,
                "recording_mode": "continuous",
                "expansion_headroom": 0.2,
                "architecture_intent": "prefer_external_switch",
                "environment": environment,
                "camera_max_power_w": 8,
            }
            r = api(c, tok, "POST", f"/api/v1/workspaces/{ws}/cctv/recommend", json=body)
            if r.status_code >= 400:
                fail(f"recommend {cams}/{environment} {r.status_code} {r.text[:250]}")
                return {}
            return r.json()

        print("env null…", flush=True)
        rec_null = recommend(4, None)
        s_null = summarize_rec(rec_null)
        report["scenarios"]["env_null_4"] = s_null
        cam_n = s_null["roles"].get("camera", {})
        if cam_n.get("candidates", 0) < 1 or not cam_n.get("selected"):
            fail("null env: expected camera candidates")

        print("env outdoor…", flush=True)
        rec_out = recommend(4, "outdoor")
        s_out = summarize_rec(rec_out)
        report["scenarios"]["env_outdoor_4"] = s_out
        cam_o = s_out["roles"].get("camera", {})
        if cam_o.get("candidates", 0) < 1:
            fail("outdoor: expected unknown-env cameras as candidates")
        if cam_o.get("env_check") == "UNKNOWN" and "CAMERA_ENVIRONMENT_UNVERIFIED" not in s_out.get("warnings", []):
            fail("outdoor+unknown env: missing CAMERA_ENVIRONMENT_UNVERIFIED")
        if cam_o.get("env_check") == "PASS" and cam_o.get("confidence") == "STRUCTURED":
            note("outdoor PASS STRUCTURED — product has explicit outdoor (unexpected for Beres)")

        for cams in (4, 8, 16):
            print(f"cams {cams}…", flush=True)
            rec = recommend(cams, None)
            s = summarize_rec(rec)
            lines = resolved_lines(rec)
            report["scenarios"][f"cams_{cams}"] = {**s, "resolved_line_roles": [l["role"] for l in lines]}
            if not s["roles"].get("camera", {}).get("selected"):
                fail(f"{cams}cam: camera unresolved")
            if not s["roles"].get("recorder", {}).get("selected"):
                fail(f"{cams}cam: recorder unresolved")
            st = s["roles"].get("storage", {})
            if st.get("selected"):
                fail(f"{cams}cam: fabricated storage {st.get('selected')}")
            if s.get("eng_storage_tb") is None:
                fail(f"{cams}cam: engineering storage missing")
            if not lines:
                fail(f"{cams}cam: no resolved lines")
            applied = apply_lines(c, tok, ws, f"Beres {cams} cam partial", lines)
            report["scenarios"][f"cams_{cams}_apply"] = applied
            if applied.get("items") != len(lines) or applied.get("refresh_items") != len(lines):
                fail(f"{cams}cam apply persist mismatch {applied}")

        print("empty catalog…", flush=True)
        _, e_tok, e_ws = create_user_ws("empty")
        rec_e = api(
            c,
            e_tok,
            "POST",
            f"/api/v1/workspaces/{e_ws}/cctv/recommend",
            json={"camera_count": 4, "resolution_mp": 4, "retention_days": 14, "recording_mode": "continuous", "environment": None},
        ).json()
        s_e = summarize_rec(rec_e)
        report["scenarios"]["empty_catalog"] = s_e
        if any(r.get("selected") for r in s_e["roles"].values()):
            fail("empty catalog fabricated products")
        if s_e.get("eng_storage_tb") is None:
            fail("empty catalog missing engineering")
        if resolved_lines(rec_e):
            fail("empty catalog should have zero resolved lines")

        print("full catalog…", flush=True)
        _, f_tok, f_ws = create_user_ws("full")
        seed_full_catalog(c, f_tok, f_ws)
        rec_f = api(
            c,
            f_tok,
            "POST",
            f"/api/v1/workspaces/{f_ws}/cctv/recommend",
            json={
                "camera_count": 4,
                "resolution_mp": 4,
                "retention_days": 14,
                "recording_mode": "continuous",
                "environment": "outdoor",
                "architecture_intent": "prefer_external_switch",
                "camera_max_power_w": 8,
            },
        ).json()
        s_f = summarize_rec(rec_f)
        lines_f = resolved_lines(rec_f)
        report["scenarios"]["full_catalog"] = {**s_f, "resolved_line_roles": [l["role"] for l in lines_f]}
        for role in ("camera", "recorder", "storage"):
            if not s_f["roles"].get(role, {}).get("selected"):
                fail(f"full catalog missing {role}")
        applied_f = apply_lines(c, f_tok, f_ws, "Full catalog apply", lines_f)
        report["scenarios"]["full_catalog_apply"] = applied_f
        if applied_f.get("items", 0) < 3:
            fail(f"full apply expected >=3 items got {applied_f}")

        # tenant: Beres SKU must not appear in empty recommend
        if any(str(r.get("selected") or "").startswith("32323") for r in s_e["roles"].values()):
            fail("cross-workspace Beres SKU leak")

    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("REPORT", OUT, flush=True)
    print("OK" if report["ok"] else "FAILED", len(report["failures"]), "failures", flush=True)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
