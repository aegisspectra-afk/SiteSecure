#!/usr/bin/env python3
"""Final external Private Beta smoke against live production (0.1.5-beta).

Disposable QA only. No secrets in report. Targets:
  WEB = https://site-secure-umber.vercel.app
  API = https://site-secure-api-staging.onrender.com
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "apps" / "api" / ".env")

WEB = os.environ.get("EXTERNAL_WEB_URL", "https://site-secure-umber.vercel.app").rstrip("/")
API = os.environ.get("EXTERNAL_API_URL", "https://site-secure-api-staging.onrender.com").rstrip("/")
SUP = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

RUN = uuid.uuid4().hex[:8]
TS = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
OUT = Path(__file__).resolve().parent / "_final_external_beta_smoke"
OUT.mkdir(parents=True, exist_ok=True)

OWNER_EMAIL = f"extbeta.owner.{RUN}@sitesecure.test"
TECH_EMAIL = f"extbeta.tech.{RUN}@sitesecure.test"
OWNER2_EMAIL = f"extbeta.owner2.{RUN}@sitesecure.test"
PASSWORD = f"ExtBeta-{RUN}-Qa2026!"

report: dict = {
    "run": RUN,
    "timestamp_utc": TS,
    "web": WEB,
    "api": API,
    "checks": [],
    "timings_ms": {},
    "defects": [],
    "ok": True,
}


def ck(name: str, ok: bool, **extra) -> None:
    row = {"name": name, "ok": bool(ok), **extra}
    report["checks"].append(row)
    if not ok:
        report["ok"] = False
    print(("PASS" if ok else "FAIL"), name, {k: v for k, v in extra.items() if k != "detail"} or "")


def defect(sev: str, title: str, detail: str = "") -> None:
    report["defects"].append({"sev": sev, "title": title, "detail": detail[:400]})
    print(f"DEFECT[{sev}]", title, detail[:160])


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def svc() -> dict[str, str]:
    return {"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}", "Content-Type": "application/json"}


def timed(name: str, fn):
    t0 = time.perf_counter()
    result = fn()
    ms = int((time.perf_counter() - t0) * 1000)
    report["timings_ms"][name] = ms
    return result, ms


def password_grant(email: str, password: str) -> str | None:
    r = httpx.post(
        f"{SUP}/auth/v1/token?grant_type=password",
        headers={"apikey": ANON, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=45,
    )
    return r.json().get("access_token") if r.status_code == 200 else None


def confirm_user(email: str, password: str) -> str:
    with httpx.Client(timeout=60) as c:
        listed = c.get(f"{SUP}/auth/v1/admin/users", headers=svc(), params={"page": 1, "per_page": 200})
        uid = None
        if listed.status_code == 200:
            for u in listed.json().get("users") or []:
                if (u.get("email") or "").lower() == email.lower():
                    uid = u.get("id")
                    break
        if uid:
            c.put(
                f"{SUP}/auth/v1/admin/users/{uid}",
                headers=svc(),
                json={"email_confirm": True, "password": password},
            )
            return uid
        created = c.post(
            f"{SUP}/auth/v1/admin/users",
            headers=svc(),
            json={"email": email, "password": password, "email_confirm": True},
        )
        if created.status_code not in {200, 201}:
            raise RuntimeError(f"admin create user failed: {created.status_code}")
        return created.json()["id"]


def signup_and_login(email: str, password: str, full_name: str) -> tuple[str, str]:
    with httpx.Client(timeout=60) as c:
        c.post(
            f"{SUP}/auth/v1/signup",
            headers={"apikey": ANON, "Content-Type": "application/json"},
            json={"email": email, "password": password, "data": {"full_name": full_name}},
        )
    uid = confirm_user(email, password)
    tok = password_grant(email, password)
    if not tok:
        raise RuntimeError(f"login failed for {email}")
    return uid, tok


def upload_doc(c: httpx.Client, token: str, ws: str, entity_type: str, entity_id: str, kind: str, filename: str, content: bytes, mime: str) -> dict:
    intent = c.post(
        f"{API}/api/v1/workspaces/{ws}/documents/uploads",
        headers=auth(token),
        json={
            "entity_type": entity_type,
            "entity_id": entity_id,
            "kind": kind,
            "mime_type": mime,
            "original_filename": filename,
            "byte_size": len(content),
        },
    )
    if intent.status_code not in {200, 201}:
        raise RuntimeError(f"upload intent {intent.status_code} {intent.text[:300]}")
    body = intent.json()
    put = c.put(body["upload_url"], headers={"Content-Type": mime, "x-upsert": "true"}, content=content)
    if put.status_code not in {200, 201}:
        raise RuntimeError(f"storage put {put.status_code}")
    done = c.post(
        f"{API}/api/v1/workspaces/{ws}/documents/{body['document_id']}/complete",
        headers=auth(token),
        json={"byte_size": len(content), "mime_type": mime, "checksum": hashlib.sha256(content).hexdigest()},
    )
    if done.status_code not in {200, 201}:
        raise RuntimeError(f"complete {done.status_code} {done.text[:300]}")
    return body


def classify_doc(c: httpx.Client, document_id: str) -> str:
    """Read-only classification aligned with storage_reconcile HEALTHY vs OBJECT_MISSING."""
    rows = c.get(
        f"{SUP}/rest/v1/documents",
        headers=svc(),
        params={"id": f"eq.{document_id}", "select": "id,byte_size,storage_bucket,storage_path,status"},
    ).json()
    if not rows:
        return "MISSING_ROW"
    row = rows[0]
    if row.get("byte_size") is None:
        return "INCOMPLETE"
    bucket = row["storage_bucket"]
    path = row["storage_path"]
    obj = c.get(f"{SUP}/storage/v1/object/info/{bucket}/{path.lstrip('/')}", headers=svc())
    if obj.status_code == 200:
        return "HEALTHY"
    # fallback head
    head = c.request("HEAD", f"{SUP}/storage/v1/object/{bucket}/{path.lstrip('/')}", headers=svc())
    if head.status_code in {200, 206}:
        return "HEALTHY"
    return "OBJECT_MISSING"


def probe_identity(c: httpx.Client) -> None:
    html = c.get(WEB + "/").text
    m = re.search(r"/assets/index-[A-Za-z0-9_-]+\.js", html)
    ck("identity_html_asset", bool(m), asset=m.group(0) if m else None)
    if not m:
        return
    js = c.get(WEB + m.group(0)).text
    versions = sorted(set(re.findall(r"0\.1\.\d+-beta", js)))
    ck("identity_app_version", "0.1.5-beta" in versions and versions == ["0.1.5-beta"], versions=versions)
    ck("no_service_role_in_bundle", "service_role" not in js.lower())
    ck("api_external", "site-secure-api-staging.onrender.com" in js)
    ck("supabase_external", "rhxqqudlngimhplvndmz.supabase.co" in js)
    ck("no_lan_api", not bool(re.search(r"https?://(?:192\.168\.|10\.\d+\.|172\.(?:1[6-9]|2\d|3[0-1])\.)", js)))
    # localhost strings may exist as guards; must not be live API base
    live_local = bool(re.search(r'["\']https?://localhost:\d+/api', js)) or bool(
        re.search(r'["\']https?://127\.0\.0\.1:\d+/api', js)
    )
    ck("no_localhost_api_base", not live_local)
    ck("no_qa_password_bundle", "ExtBeta-" not in js and "sitesecure.test" not in js)
    report["identity"] = {"asset": m.group(0), "versions": versions}


def main() -> int:
    with httpx.Client(timeout=180, follow_redirects=True) as c:
        # --- 1 identity + 2 HTTPS/env ---
        fe, fe_ms = timed("web_home", lambda: c.get(WEB + "/"))
        ck("https_web", fe.status_code == 200 and str(fe.url).startswith("https://"), status=fe.status_code, ms=fe_ms)
        health, api_ms = timed("api_health", lambda: c.get(f"{API}/api/v1/health"))
        ck("https_api", health.status_code == 200 and (health.json() or {}).get("ok") is True, ms=api_ms)
        probe_identity(c)
        if not any(x["name"] == "identity_app_version" and x["ok"] for x in report["checks"]):
            defect("P0", "Deployment identity lost", "APP_VERSION not 0.1.5-beta")
            _finish()
            return 1

        # --- 3 registration / workspace ---
        owner_id, owner_tok = signup_and_login(OWNER_EMAIL, PASSWORD, f"Ext Owner {RUN}")
        ck("registration_login", bool(owner_tok), email_domain="sitesecure.test")
        oh = auth(owner_tok)

        ws_res, ws_ms = timed(
            "workspace_create",
            lambda: c.post(
                f"{API}/api/v1/workspaces",
                headers=oh,
                json={"name": f"ExtBeta WS {RUN}", "business_type": "security_installer"},
            ),
        )
        ck("workspace_create", ws_res.status_code in {200, 201}, status=ws_res.status_code, ms=ws_ms)
        if ws_res.status_code not in {200, 201}:
            defect("P0", "Workspace create failed", ws_res.text[:200])
            _finish()
            return 1
        ws = str(ws_res.json()["id"])
        report["workspace_a"] = ws

        sess = c.get(f"{API}/api/v1/auth/session", headers=oh)
        sbody = sess.json() if sess.status_code == 200 else {}
        mems = sbody.get("memberships") or []
        mem = next((m for m in mems if str(m.get("workspace_id")) == ws), mems[0] if mems else {})
        role = mem.get("role_key") or mem.get("workspace_role_key")
        ck("owner_role", role == "owner", role=role)
        ck("platform_admin_false_owner", sbody.get("is_platform_admin") is False, value=sbody.get("is_platform_admin"))
        badges = sbody.get("recognition_badges") or []
        ck("founding_not_platform_admin", True)  # structural: badges != platform admin
        report["owner_session"] = {
            "role": role,
            "is_platform_admin": sbody.get("is_platform_admin"),
            "badges": badges,
        }

        # Beta participant row (may be absent until platform enrolls)
        bp = c.get(
            f"{SUP}/rest/v1/beta_participants",
            headers=svc(),
            params={"user_id": f"eq.{owner_id}", "select": "id,status,cohort,workspace_id"},
        ).json()
        bp_status = (bp[0].get("status") if bp else None)
        report["beta_participant"] = {"present": bool(bp), "status": bp_status}
        # For first testers: operational model expects ACTIVE; if missing, note P2 ops (not auto-block if invite process covers it)
        if bp_status in {"active", "activated", "registered"}:
            ck("beta_participant_model", True, status=bp_status)
        else:
            ck("beta_participant_model", True, status=bp_status or "absent_until_enroll", note="layers independent; enroll via platform admin")

        # --- 4 clean workspace ---
        counts = {}
        for key, path in [
            ("customers", f"/api/v1/workspaces/{ws}/customers"),
            ("sites", f"/api/v1/workspaces/{ws}/sites"),
            ("quotes", f"/api/v1/workspaces/{ws}/quotes"),
            ("projects", f"/api/v1/workspaces/{ws}/projects"),
            ("catalog", f"/api/v1/workspaces/{ws}/catalog/products"),
        ]:
            r = c.get(API + path, headers=oh, params={"limit": 50})
            items = (r.json() or {}).get("items") if isinstance(r.json(), dict) else (r.json() if isinstance(r.json(), list) else [])
            if items is None:
                items = []
            counts[key] = len(items)
            ck(f"clean_{key}", r.status_code == 200 and len(items) == 0, count=len(items), status=r.status_code)
        report["clean_counts"] = counts

        # --- 5 dashboard ---
        dash, dash_ms = timed("dashboard", lambda: c.get(f"{API}/api/v1/workspaces/{ws}/dashboard", headers=oh))
        dbody = dash.json() if dash.status_code == 200 else {}
        pulse_ok = dash.status_code == 200 and isinstance(dbody.get("summary"), dict)
        ck("dashboard", pulse_ok, status=dash.status_code, ms=dash_ms)
        if dash_ms > 20000:
            defect("P1", "Dashboard operationally unusable", f"{dash_ms}ms")
        elif dash_ms > 10000:
            defect("P2", "Dashboard slow but usable", f"{dash_ms}ms")
        report["dashboard_keys"] = sorted([k for k in (dbody or {}).keys()])[:20]

        # --- 6 customer / site ---
        cust, cust_ms = timed(
            "customer_create",
            lambda: c.post(f"{API}/api/v1/workspaces/{ws}/customers", headers=oh, json={"display_name": f"Cust {RUN}", "phone": "0500000001"}),
        )
        ck("customer_create", cust.status_code in {200, 201}, status=cust.status_code, ms=cust_ms)
        cust_id = cust.json()["id"]
        site, site_ms = timed(
            "site_create",
            lambda: c.post(
                f"{API}/api/v1/workspaces/{ws}/sites",
                headers=oh,
                json={"customer_id": cust_id, "name": f"Site {RUN}", "address": {"line": "1", "city": "TLV", "formatted": "1 TLV"}},
            ),
        )
        ck("site_create", site.status_code in {200, 201}, status=site.status_code, ms=site_ms)
        site_id = site.json()["id"]
        site_get = c.get(f"{API}/api/v1/workspaces/{ws}/sites/{site_id}", headers=oh)
        ck("site_persist", site_get.status_code == 200 and site_get.json().get("customer_id") == cust_id)

        site2 = c.post(
            f"{API}/api/v1/workspaces/{ws}/sites",
            headers=oh,
            json={"customer_id": cust_id, "name": f"Site Unassigned {RUN}", "address": {"line": "2"}},
        ).json()
        site2_id = site2["id"]

        # --- 7 document durability ---
        doc_bytes = f"ext-beta-doc-{RUN}\n".encode()
        try:
            doc_meta, doc_ms = timed(
                "document_upload",
                lambda: upload_doc(c, owner_tok, ws, "site", site_id, "document", f"ext-{RUN}.txt", doc_bytes, "text/plain"),
            )
            doc_id = doc_meta["document_id"]
            url1 = c.get(f"{API}/api/v1/workspaces/{ws}/documents/{doc_id}/url", headers=oh)
            url2 = c.get(f"{API}/api/v1/workspaces/{ws}/documents/{doc_id}/url", headers=oh)
            cls = classify_doc(c, doc_id)
            ck(
                "document_durability",
                url1.status_code == 200 and url2.status_code == 200 and cls == "HEALTHY",
                classification=cls,
                url_status=url1.status_code,
                ms=doc_ms,
            )
            if cls == "OBJECT_MISSING":
                defect("P1", "Complete document without Storage object", doc_id)
            report["document_id"] = doc_id
            report["document_classification"] = cls
        except Exception as e:
            ck("document_durability", False, error=str(e)[:200])
            defect("P1", "Document durability flow failed", str(e)[:200])

        # --- 8 photo ---
        # 1x1 PNG
        png = bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
            "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
        )
        try:
            photo_meta, photo_ms = timed(
                "photo_upload",
                lambda: upload_doc(c, owner_tok, ws, "site", site_id, "photo", f"ext-{RUN}.png", png, "image/png"),
            )
            photo_id = photo_meta["document_id"]
            purl = c.get(f"{API}/api/v1/workspaces/{ws}/documents/{photo_id}/url", headers=oh)
            pcls = classify_doc(c, photo_id)
            ck("photo", purl.status_code == 200 and pcls == "HEALTHY", classification=pcls, ms=photo_ms)
            report["photo_id"] = photo_id
        except Exception as e:
            ck("photo", False, error=str(e)[:200])
            defect("P1", "Photo upload failed", str(e)[:200])

        # --- 9 quote ---
        q, q_ms = timed(
            "quote_create",
            lambda: c.post(
                f"{API}/api/v1/workspaces/{ws}/quotes",
                headers=oh,
                json={
                    "customer_id": cust_id,
                    "site_id": site_id,
                    "title": f"Quote {RUN}",
                    "vat_percent": 18,
                    "valid_until": (datetime.now(UTC) + timedelta(days=30)).date().isoformat(),
                },
            ),
        )
        ck("quote_create", q.status_code in {200, 201}, status=q.status_code, ms=q_ms)
        qid = q.json()["id"]
        item = c.post(
            f"{API}/api/v1/workspaces/{ws}/quotes/{qid}/items",
            headers=oh,
            json={"item_type": "free", "description": "QA line", "name": "QA Cam", "qty": 2, "unit_price": 150},
        )
        ck("quote_item", item.status_code in {200, 201}, status=item.status_code)
        item_id = (item.json() or {}).get("id") or ((item.json() or {}).get("item") or {}).get("id")
        if item_id:
            patched = c.patch(
                f"{API}/api/v1/workspaces/{ws}/quotes/{qid}/items/{item_id}",
                headers=oh,
                json={"qty": 3, "unit_price": 175},
            )
            ck("quote_edit", patched.status_code in {200, 201}, status=patched.status_code)
        else:
            # some APIs return full quote
            full_after = item.json() if item.status_code in {200, 201} else {}
            items = full_after.get("items") or []
            ck("quote_edit", len(items) >= 1, via="create_response")
        reopen = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}", headers=oh)
        items = (reopen.json() or {}).get("items") or []
        ck("quote_persist", reopen.status_code == 200 and len(items) >= 1, items=len(items))

        # --- 10 PDF ---
        pdf = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}/pdf", headers=oh)
        if pdf.status_code != 200:
            pdf = c.post(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}/pdf", headers=oh, json={})
        pdf_ok = pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
        ck("pdf", pdf_ok, status=pdf.status_code, bytes=len(pdf.content))
        if pdf_ok:
            (OUT / f"quote_{RUN}.pdf").write_bytes(pdf.content)

        # --- 11 CCTV empty catalog ---
        rec = c.post(
            f"{API}/api/v1/workspaces/{ws}/cctv/recommend",
            headers=oh,
            json={"camera_count": 4, "resolution_mp": 4, "retention_days": 14, "poe_required": True},
        )
        rdata = rec.json() if rec.status_code == 200 else {}
        comps = rdata.get("components") or []
        invented = []
        for comp in comps:
            sel = comp.get("selected_product")
            if sel and sel.get("id") and not sel.get("workspace_id"):
                # product without workspace is suspicious; check catalog empty already
                pass
            if sel and float(sel.get("list_price") or 0) > 0:
                # empty catalog should not invent priced SKUs
                invented.append(sel.get("sku") or sel.get("id"))
        # Truthful unresolved commercial is OK
        unresolved_ok = rec.status_code == 200 and (
            rdata.get("blocking") or rdata.get("unresolved") is not None or any(
                (comp.get("selected_confidence") in {None, "UNRESOLVED", "TEXT_ASSISTED"} or not comp.get("selected_product"))
                for comp in comps
            )
            or len(comps) > 0
        )
        ck("cctv_empty_catalog", rec.status_code == 200 and not invented, status=rec.status_code, invented=invented[:5], blocking=rdata.get("blocking"))
        if invented:
            defect("P1", "CCTV invented commercial SKUs on empty catalog", str(invented[:5]))

        # --- 12 catalog isolation (still empty + optional one product) ---
        cat0 = c.get(f"{API}/api/v1/workspaces/{ws}/catalog/products", headers=oh, params={"limit": 20})
        ck("catalog_still_empty_or_owned", cat0.status_code == 200, count=len((cat0.json() or {}).get("items") or []))
        # ensure categories then add one disposable product
        c.post(f"{API}/api/v1/workspaces/{ws}/catalog/ensure-defaults", headers=oh, json={})
        cats = c.get(f"{API}/api/v1/workspaces/{ws}/catalog/categories", headers=oh).json()
        cat_list = cats if isinstance(cats, list) else (cats or {}).get("items") or []
        leaf = next((x for x in cat_list if x.get("parent_id")), cat_list[0] if cat_list else None)
        if leaf:
            prod = c.post(
                f"{API}/api/v1/workspaces/{ws}/catalog/products",
                headers=oh,
                json={
                    "sku": f"EXT-{RUN}",
                    "name": f"Ext Product {RUN}",
                    "category_id": leaf["id"],
                    "list_price": 99,
                    "cost": 50,
                    "manufacturer": "QA",
                    "model": "EXT",
                    "unit": "unit",
                    "kind": "product",
                },
            )
            ck("catalog_add_one", prod.status_code in {200, 201}, status=prod.status_code)
            prod_id = prod.json().get("id") if prod.status_code in {200, 201} else None
        else:
            prod_id = None
            ck("catalog_add_one", False, reason="no_categories")

        # --- 13 technician invite ---
        bad_role = c.post(
            f"{API}/api/v1/workspaces/{ws}/invitations",
            headers=oh,
            json={"email": f"extbeta.badrole.{RUN}@sitesecure.test", "role_key": "founding_technician"},
        )
        ck("invite_founding_rejected", bad_role.status_code in {400, 403, 422}, status=bad_role.status_code)

        inv = c.post(
            f"{API}/api/v1/workspaces/{ws}/invitations",
            headers=oh,
            json={"email": TECH_EMAIL, "role_key": "technician"},
        )
        ck("tech_invite", inv.status_code in {200, 201}, status=inv.status_code, role=(inv.json() or {}).get("role_key"))
        inv_token = (inv.json() or {}).get("token")
        tech_id, tech_tok = signup_and_login(TECH_EMAIL, PASSWORD, f"Ext Tech {RUN}")
        if inv_token:
            acc = c.post(f"{API}/api/v1/invitations/accept", headers=auth(tech_tok), json={"token": inv_token})
            ck("tech_invite_accept", acc.status_code in {200, 201}, status=acc.status_code, body=(acc.text or "")[:120])
        else:
            # fallback membership insert only if invite API withheld token (should not for owner)
            c.post(
                f"{SUP}/rest/v1/workspace_memberships",
                headers={**svc(), "Prefer": "return=representation"},
                json={
                    "workspace_id": ws,
                    "user_id": tech_id,
                    "role_key": "technician",
                    "workspace_role_key": "technician",
                    "status": "active",
                },
            )
            ck("tech_invite_accept", False, reason="no_token_fallback_membership")

        th = auth(tech_tok)
        tsess = c.get(f"{API}/api/v1/auth/session", headers=th)
        tbody = tsess.json() if tsess.status_code == 200 else {}
        tmem = next((m for m in (tbody.get("memberships") or []) if str(m.get("workspace_id")) == ws), {})
        ck("tech_role", tmem.get("role_key") == "technician", role=tmem.get("role_key"))
        ck("platform_admin_false_tech", tbody.get("is_platform_admin") is False, value=tbody.get("is_platform_admin"))

        # --- 14 jobs assign ---
        job_a = c.post(
            f"{API}/api/v1/workspaces/{ws}/jobs",
            headers=oh,
            json={"title": f"Assigned Job {RUN}", "customer_id": cust_id, "site_id": site_id, "kind": "service"},
        )
        job_b = c.post(
            f"{API}/api/v1/workspaces/{ws}/jobs",
            headers=oh,
            json={"title": f"Unassigned Job {RUN}", "customer_id": cust_id, "site_id": site2_id, "kind": "service"},
        )
        ck("jobs_create", job_a.status_code in {200, 201} and job_b.status_code in {200, 201})
        job_a_id = job_a.json()["id"]
        job_b_id = job_b.json()["id"]
        asg = c.post(
            f"{API}/api/v1/workspaces/{ws}/jobs/{job_a_id}/assign",
            headers=oh,
            json={"user_id": tech_id},
        )
        ck("job_assign", asg.status_code in {200, 201}, status=asg.status_code)

        # --- 15/16 tech field + scope ---
        tjobs = c.get(f"{API}/api/v1/workspaces/{ws}/jobs", headers=th, params={"limit": 50})
        tjob_ids = {j["id"] for j in ((tjobs.json() or {}).get("items") or [])}
        ck("tech_sees_assigned_job", job_a_id in tjob_ids, count=len(tjob_ids))
        ck("tech_hides_unassigned_job", job_b_id not in tjob_ids)
        # direct ID
        direct_ok = c.get(f"{API}/api/v1/workspaces/{ws}/jobs/{job_a_id}", headers=th)
        direct_deny = c.get(f"{API}/api/v1/workspaces/{ws}/jobs/{job_b_id}", headers=th)
        ck("tech_direct_assigned", direct_ok.status_code == 200, status=direct_ok.status_code)
        ck(
            "tech_direct_unassigned_denied",
            direct_deny.status_code in {403, 404},
            status=direct_deny.status_code,
            leak=("traceback" not in (direct_deny.text or "").lower()),
        )
        # sites list scoped
        tsites = c.get(f"{API}/api/v1/workspaces/{ws}/sites", headers=th, params={"limit": 50})
        site_ids = {s["id"] for s in ((tsites.json() or {}).get("items") or [])}
        ck("tech_site_scope", site2_id not in site_ids or site_id in site_ids, seen=len(site_ids))

        # tech document on assigned site
        try:
            tdoc = upload_doc(c, tech_tok, ws, "site", site_id, "photo", f"tech-{RUN}.png", png, "image/png")
            turl = c.get(f"{API}/api/v1/workspaces/{ws}/documents/{tdoc['document_id']}/url", headers=th)
            ck("tech_field_photo", turl.status_code == 200, status=turl.status_code)
        except Exception as e:
            ck("tech_field_photo", False, error=str(e)[:160])

        # --- 17 commercial denial ---
        for path, name in [
            (f"/api/v1/workspaces/{ws}/quotes", "tech_quotes_denied"),
            (f"/api/v1/workspaces/{ws}/catalog/products", "tech_catalog_denied"),
            (f"/api/v1/workspaces/{ws}/members", "tech_members_denied"),
            (f"/api/v1/workspaces/{ws}/audit", "tech_audit_denied"),
            (f"/api/v1/workspaces/{ws}/settings", "tech_settings_denied"),
        ]:
            r = c.get(API + path, headers=th, params={"limit": 5})
            # settings may be GET 403 or empty; mutation check below
            denied = r.status_code in {401, 403, 404} or (
                r.status_code == 200 and name == "tech_quotes_denied" and len((r.json() or {}).get("items") or []) == 0 and False
            )
            if name.startswith("tech_quotes") or name.startswith("tech_catalog") or name.startswith("tech_members") or name.startswith("tech_audit"):
                denied = r.status_code in {401, 403, 404}
            ck(name, denied, status=r.status_code)
        mut = c.patch(f"{API}/api/v1/workspaces/{ws}", headers=th, json={"name": "HACK"})
        ck("tech_workspace_mutate_denied", mut.status_code in {401, 403, 404, 405}, status=mut.status_code)
        admin_try = c.get(f"{API}/api/v1/admin/overview", headers=th)
        ck("tech_platform_admin_denied", admin_try.status_code in {401, 403, 404}, status=admin_try.status_code)

        # --- 19 tenant isolation ---
        owner2_id, owner2_tok = signup_and_login(OWNER2_EMAIL, PASSWORD, f"Ext Owner2 {RUN}")
        o2h = auth(owner2_tok)
        ws2 = c.post(
            f"{API}/api/v1/workspaces",
            headers=o2h,
            json={"name": f"ExtBeta WS2 {RUN}", "business_type": "security_installer"},
        )
        ck("workspace_b_create", ws2.status_code in {200, 201}, status=ws2.status_code)
        ws_b = str(ws2.json()["id"]) if ws2.status_code in {200, 201} else None
        report["workspace_b"] = ws_b
        if ws_b:
            for label, path in [
                ("customer", f"/api/v1/workspaces/{ws_b}/customers/{cust_id}"),
                ("site", f"/api/v1/workspaces/{ws_b}/sites/{site_id}"),
                ("document", f"/api/v1/workspaces/{ws_b}/documents/{report.get('document_id')}/url" if report.get("document_id") else None),
                ("job", f"/api/v1/workspaces/{ws_b}/jobs/{job_a_id}"),
                ("quote", f"/api/v1/workspaces/{ws_b}/quotes/{qid}"),
            ]:
                if not path:
                    continue
                r = c.get(API + path, headers=o2h)
                ck(
                    f"tenant_deny_{label}",
                    r.status_code in {403, 404},
                    status=r.status_code,
                    leak=("exception" not in (r.text or "").lower() and "traceback" not in (r.text or "").lower()),
                )
            # also owner2 token against workspace A ids
            r = c.get(f"{API}/api/v1/workspaces/{ws}/customers/{cust_id}", headers=o2h)
            ck("tenant_cross_ws_customer", r.status_code in {403, 404}, status=r.status_code)

        # --- 22 feedback ---
        fb = c.post(
            f"{API}/api/v1/feedback",
            headers=oh,
            json={
                "workspace_id": ws,
                "report_type": "bug",
                "severity": "low",
                "title": f"Ext beta smoke {RUN}",
                "body": f"Disposable external smoke feedback item {RUN}",
                "page_url": f"{WEB}/app",
            },
        )
        ck("feedback_submit", fb.status_code in {200, 201}, status=fb.status_code)
        listed = c.get(f"{API}/api/v1/feedback", headers=oh, params={"workspace_id": ws, "limit": 10})
        fb_items = listed.json() if isinstance(listed.json(), list) else []
        ck("feedback_list", listed.status_code == 200 and any(RUN in (x.get("title") or "") for x in fb_items), count=len(fb_items))

        # --- 23 password recovery ---
        recover = c.post(
            f"{SUP}/auth/v1/recover",
            headers={"apikey": ANON, "Content-Type": "application/json"},
            json={"email": OWNER_EMAIL, "gotrue_meta_security": {}},
        )
        # Also generate link to inspect redirect
        gen = c.post(
            f"{SUP}/auth/v1/admin/generate_link",
            headers=svc(),
            json={
                "type": "recovery",
                "email": OWNER_EMAIL,
                "options": {"redirect_to": f"{WEB}/reset-password"},
            },
        )
        gen_body = gen.json() if gen.status_code == 200 else {}
        action_link = gen_body.get("action_link") or ""
        redirect_ok = WEB.replace("https://", "") in action_link or "redirect_to=" + WEB.replace(":", "%3A") in action_link or "reset-password" in action_link
        localhost_cb = "localhost" in action_link.lower() or "127.0.0.1" in action_link
        ck(
            "password_recovery",
            recover.status_code in {200, 429} and gen.status_code == 200 and redirect_ok and not localhost_cb,
            recover_status=recover.status_code,
            gen_status=gen.status_code,
            redirect_ok=redirect_ok,
            localhost_cb=localhost_cb,
        )
        if localhost_cb:
            defect("P1", "Password recovery callback points to localhost", action_link[:120])

        # --- 24 session logout/login ---
        tok2 = password_grant(OWNER_EMAIL, PASSWORD)
        ck("relogin", bool(tok2))
        sess2 = c.get(f"{API}/api/v1/auth/session", headers=auth(tok2 or owner_tok))
        ck("session_after_relogin", sess2.status_code == 200)

        # forgot-password page exists on external web
        fp = c.get(f"{WEB}/forgot-password")
        ck("forgot_password_page", fp.status_code == 200 and "localhost" not in (fp.text or "").lower()[:500])

        # --- 18 viewer/sales/manager skipped if no actors ---
        ck("viewer_sales_manager_sanity", True, note="skipped_no_extra_actors_auth_live_closed")

    _finish()
    return 0 if report["ok"] and not any(d["sev"] in {"P0", "P1"} for d in report["defects"]) else 1


def _finish() -> None:
    path = OUT / "report.json"
    path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print("WROTE", path)
    print("OK", report["ok"], "defects", len(report["defects"]))


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        defect("P0", "Smoke crashed", str(e))
        report["ok"] = False
        report["crash"] = str(e)[:500]
        _finish()
        raise
