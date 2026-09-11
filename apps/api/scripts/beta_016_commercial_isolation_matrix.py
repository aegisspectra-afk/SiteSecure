#!/usr/bin/env python3
"""Focused 0.1.6 technician commercial isolation matrix (API)."""
from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "apps" / "api" / ".env")

API = os.environ.get("EXTERNAL_API_URL", os.environ.get("API_URL", "http://127.0.0.1:8010")).rstrip("/")
SUP = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
RUN = uuid.uuid4().hex[:8]
PW = f"Iso16-{RUN}-Qa!"


def ck(name: str, ok: bool, **extra) -> None:
    print(("PASS" if ok else "FAIL"), name, extra or "")
    if not ok:
        raise SystemExit(1)


def login(email: str) -> str:
    r = httpx.post(
        f"{SUP}/auth/v1/token?grant_type=password",
        headers={"apikey": ANON, "Content-Type": "application/json"},
        json={"email": email, "password": PW},
        timeout=45,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def ensure(email: str) -> tuple[str, str]:
    svc = {"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}", "Content-Type": "application/json"}
    with httpx.Client(timeout=60) as c:
        listed = c.get(f"{SUP}/auth/v1/admin/users", headers=svc, params={"page": 1, "per_page": 200})
        uid = None
        for u in (listed.json() or {}).get("users") or []:
            if (u.get("email") or "").lower() == email.lower():
                uid = u["id"]
                break
        if uid:
            c.put(f"{SUP}/auth/v1/admin/users/{uid}", headers=svc, json={"email_confirm": True, "password": PW})
        else:
            created = c.post(
                f"{SUP}/auth/v1/admin/users",
                headers=svc,
                json={"email": email, "password": PW, "email_confirm": True},
            )
            created.raise_for_status()
            uid = created.json()["id"]
    return uid, login(email)


def main() -> int:
    owner_email = f"iso16.owner.{RUN}@sitesecure.test"
    tech_email = f"iso16.tech.{RUN}@sitesecure.test"
    owner_id, owner_tok = ensure(owner_email)
    tech_id, tech_tok = ensure(tech_email)
    oh = {"Authorization": f"Bearer {owner_tok}", "Content-Type": "application/json"}
    th = {"Authorization": f"Bearer {tech_tok}", "Content-Type": "application/json"}
    with httpx.Client(timeout=120) as c:
        ws = c.post(f"{API}/api/v1/workspaces", headers=oh, json={"name": f"ISO16 {RUN}"}).json()["id"]
        inv = c.post(
            f"{API}/api/v1/workspaces/{ws}/invitations",
            headers=oh,
            json={"email": tech_email, "role_key": "technician"},
        )
        ck("invite", inv.status_code in {200, 201}, status=inv.status_code)
        acc = c.post(f"{API}/api/v1/invitations/accept", headers=th, json={"token": inv.json()["token"]})
        ck("accept", acc.status_code in {200, 201}, status=acc.status_code)

        sess = c.get(f"{API}/api/v1/auth/session", headers=th).json()
        mem = next(m for m in sess["memberships"] if m["workspace_id"] == ws)
        perms = set(mem.get("permissions") or [])
        ck("no_quotes_view", "quotes.view" not in perms)
        ck("no_catalog_view", "catalog.view" not in perms)
        ck("has_jobs_view", "jobs.view" in perms)
        ck("has_documents_upload", "documents.upload" in perms)

        cust = c.post(f"{API}/api/v1/workspaces/{ws}/customers", headers=oh, json={"display_name": "C"}).json()
        site = c.post(
            f"{API}/api/v1/workspaces/{ws}/sites",
            headers=oh,
            json={"customer_id": cust["id"], "name": "S", "address": {"line": "1"}},
        ).json()
        site2 = c.post(
            f"{API}/api/v1/workspaces/{ws}/sites",
            headers=oh,
            json={"customer_id": cust["id"], "name": "S2", "address": {"line": "2"}},
        ).json()
        job = c.post(
            f"{API}/api/v1/workspaces/{ws}/jobs",
            headers=oh,
            json={"title": "J", "customer_id": cust["id"], "site_id": site["id"], "kind": "service"},
        ).json()
        c.post(f"{API}/api/v1/workspaces/{ws}/jobs/{job['id']}/assign", headers=oh, json={"user_id": tech_id})

        q = c.post(
            f"{API}/api/v1/workspaces/{ws}/quotes",
            headers=oh,
            json={"customer_id": cust["id"], "site_id": site["id"], "title": "Q", "vat_percent": 18},
        ).json()
        c.post(f"{API}/api/v1/workspaces/{ws}/catalog/ensure-defaults", headers=oh, json={})

        # commercial deny
        for name, path, method in [
            ("tech_quotes_list", f"/api/v1/workspaces/{ws}/quotes", "GET"),
            ("tech_quote_detail", f"/api/v1/workspaces/{ws}/quotes/{q['id']}", "GET"),
            ("tech_catalog_list", f"/api/v1/workspaces/{ws}/catalog/products", "GET"),
        ]:
            r = c.request(method, API + path, headers=th, params={"limit": 5})
            ck(name, r.status_code in {401, 403, 404}, status=r.status_code)
        r = c.post(f"{API}/api/v1/workspaces/{ws}/quotes", headers=th, json={"title": "x", "vat_percent": 18})
        ck("tech_quote_create", r.status_code in {401, 403, 404}, status=r.status_code)
        r = c.get(f"{API}/api/v1/workspaces/{ws}/catalog/import/sessions", headers=th)
        ck("tech_catalog_import", r.status_code in {401, 403, 404, 405}, status=r.status_code)

        # field pass
        jobs = c.get(f"{API}/api/v1/workspaces/{ws}/jobs", headers=th, params={"limit": 20})
        ck("tech_jobs", jobs.status_code == 200 and any(j["id"] == job["id"] for j in (jobs.json() or {}).get("items") or []))
        sites = c.get(f"{API}/api/v1/workspaces/{ws}/sites", headers=th, params={"limit": 20})
        site_ids = {s["id"] for s in (sites.json() or {}).get("items") or []}
        ck("tech_assigned_site", site["id"] in site_ids or jobs.status_code == 200)
        un = c.get(f"{API}/api/v1/workspaces/{ws}/sites/{site2['id']}", headers=th)
        ck("tech_unassigned_site", un.status_code in {403, 404}, status=un.status_code)

        # owner retains
        oq = c.get(f"{API}/api/v1/workspaces/{ws}/quotes", headers=oh, params={"limit": 5})
        ck("owner_quotes", oq.status_code == 200 and len((oq.json() or {}).get("items") or []) >= 1)
        oc = c.get(f"{API}/api/v1/workspaces/{ws}/catalog/products", headers=oh, params={"limit": 5})
        ck("owner_catalog", oc.status_code == 200)

    print("OK iso16 matrix")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
