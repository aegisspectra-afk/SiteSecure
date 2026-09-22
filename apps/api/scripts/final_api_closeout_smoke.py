#!/usr/bin/env python3
"""Closeout smoke against live Render API + web identity (no secrets)."""
from __future__ import annotations

import hashlib
import json
import os
import re
import urllib.request
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv("apps/api/.env")

API = "https://site-secure-api-staging.onrender.com"
WEB = "https://site-secure-umber.vercel.app"
SUP = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
WS = "637dac16-d083-4b6d-9faa-37b470c0a3ed"
WS_B = None  # filled if present in prior report
TECH = "extbeta.tech.6f789dd7@sitesecure.test"
OWNER = "extbeta.owner.6f789dd7@sitesecure.test"
PW = "ExtBeta-6f789dd7-Qa2026!"
OUT = Path("apps/api/scripts/_final_api_closeout_smoke/report.json")
OUT.parent.mkdir(parents=True, exist_ok=True)

checks = []


def ck(name: str, ok: bool, **extra):
    checks.append({"name": name, "ok": bool(ok), **extra})
    print(("PASS" if ok else "FAIL"), name, extra or "")


def login(email: str) -> str:
    r = httpx.post(
        f"{SUP}/auth/v1/token?grant_type=password",
        headers={"apikey": ANON, "Content-Type": "application/json"},
        json={"email": email, "password": PW},
        timeout=45,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def main() -> int:
    html = urllib.request.urlopen(WEB + "/").read().decode("utf-8", "replace")
    m = re.search(r"/assets/index-[A-Za-z0-9_-]+\.js", html)
    js = urllib.request.urlopen(WEB + m.group(0)).read().decode("utf-8", "replace") if m else ""
    versions = sorted(set(re.findall(r"0\.1\.\d+-beta", js)))
    ck("web_016", versions == ["0.1.6-beta"], versions=versions, asset=m.group(0) if m else None)

    with httpx.Client(timeout=90) as c:
        health = c.get(f"{API}/api/v1/health")
        ck("api_health", health.status_code == 200 and (health.json() or {}).get("ok") is True)

        tt, ot = login(TECH), login(OWNER)
        th = {"Authorization": f"Bearer {tt}"}
        oh = {"Authorization": f"Bearer {ot}", "Content-Type": "application/json"}

        qlist = c.get(f"{API}/api/v1/workspaces/{WS}/quotes", headers=th, params={"limit": 5})
        clist = c.get(f"{API}/api/v1/workspaces/{WS}/catalog/products", headers=th, params={"limit": 5})
        ck("tech_quotes_403", qlist.status_code == 403, status=qlist.status_code, leak=("items" not in (qlist.text or "")))
        ck("tech_catalog_403", clist.status_code == 403, status=clist.status_code, leak=("list_price" not in (clist.text or "")))

        quotes = c.get(f"{API}/api/v1/workspaces/{WS}/quotes", headers=oh, params={"limit": 5}).json()
        qid = ((quotes.get("items") or [{}])[0] or {}).get("id")
        if qid:
            qd = c.get(f"{API}/api/v1/workspaces/{WS}/quotes/{qid}", headers=th)
            ck("tech_quote_detail_403", qd.status_code in {403, 404}, status=qd.status_code)
        else:
            ck("tech_quote_detail_403", False, reason="no_owner_quote")
        qc = c.post(f"{API}/api/v1/workspaces/{WS}/quotes", headers={**th, "Content-Type": "application/json"}, json={"title": "x", "vat_percent": 18})
        ck("tech_quote_create_403", qc.status_code in {403, 404}, status=qc.status_code)

        jobs = c.get(f"{API}/api/v1/workspaces/{WS}/jobs", headers=th, params={"limit": 20})
        sites = c.get(f"{API}/api/v1/workspaces/{WS}/sites", headers=th, params={"limit": 20})
        ck("tech_jobs_200", jobs.status_code == 200 and len((jobs.json() or {}).get("items") or []) >= 1, status=jobs.status_code)
        ck("tech_sites_200", sites.status_code == 200 and len((sites.json() or {}).get("items") or []) >= 1, status=sites.status_code)
        site_id = ((sites.json() or {}).get("items") or [{}])[0].get("id")
        png = bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
        )
        intent = c.post(
            f"{API}/api/v1/workspaces/{WS}/documents/uploads",
            headers={**th, "Content-Type": "application/json"},
            json={
                "entity_type": "site",
                "entity_id": site_id,
                "kind": "photo",
                "mime_type": "image/png",
                "original_filename": "closeout.png",
                "byte_size": len(png),
            },
        )
        if intent.status_code in {200, 201}:
            body = intent.json()
            c.put(body["upload_url"], headers={"Content-Type": "image/png", "x-upsert": "true"}, content=png)
            done = c.post(
                f"{API}/api/v1/workspaces/{WS}/documents/{body['document_id']}/complete",
                headers={**th, "Content-Type": "application/json"},
                json={"byte_size": len(png), "mime_type": "image/png", "checksum": hashlib.sha256(png).hexdigest()},
            )
            url = c.get(f"{API}/api/v1/workspaces/{WS}/documents/{body['document_id']}/url", headers=th)
            ck("tech_assigned_photo", done.status_code == 200 and url.status_code == 200, complete=done.status_code, url=url.status_code)
        else:
            ck("tech_assigned_photo", False, status=intent.status_code, body=intent.text[:120])

        oq = c.get(f"{API}/api/v1/workspaces/{WS}/quotes", headers=oh, params={"limit": 5})
        oc = c.get(f"{API}/api/v1/workspaces/{WS}/catalog/products", headers=oh, params={"limit": 5})
        custs = c.get(f"{API}/api/v1/workspaces/{WS}/customers", headers=oh, params={"limit": 5})
        ck("owner_quotes", oq.status_code == 200 and len((oq.json() or {}).get("items") or []) >= 1)
        ck("owner_catalog", oc.status_code == 200)
        ck("owner_customers", custs.status_code == 200 and len((custs.json() or {}).get("items") or []) >= 1)

        # cross-workspace: owner2 if exists from prior smoke
        try:
            prior = json.loads(Path("apps/api/scripts/_final_external_beta_smoke/report.json").read_text(encoding="utf-8"))
            wsb = prior.get("workspace_b")
            cust_id = None
            items = (custs.json() or {}).get("items") or []
            if items:
                cust_id = items[0]["id"]
            if wsb and cust_id:
                # login owner of B
                o2email = f"extbeta.owner2.{prior['run']}@sitesecure.test"
                o2 = login(o2email)
                r = c.get(f"{API}/api/v1/workspaces/{wsb}/customers/{cust_id}", headers={"Authorization": f"Bearer {o2}"})
                ck("cross_ws_deny", r.status_code in {403, 404}, status=r.status_code)
            else:
                # owner token against bogus foreign id
                r = c.get(f"{API}/api/v1/workspaces/{WS}/customers/00000000-0000-0000-0000-000000000001", headers=oh)
                ck("cross_ws_deny", r.status_code in {403, 404}, status=r.status_code, note="foreign_id")
        except Exception as e:
            ck("cross_ws_deny", False, error=str(e)[:120])

    report = {"api": API, "web": WEB, "checks": checks, "ok": all(x["ok"] for x in checks)}
    OUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("WROTE", OUT, "ok=", report["ok"])
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
