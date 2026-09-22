#!/usr/bin/env python3
"""Prove whether Render API image ships current technician catalog (no commercial).

Clears one QA workspace technician grants to [] so resolve rehydrates from the
API image catalog, then restores field grants. No secrets printed.
"""
from __future__ import annotations

import json
import os
import sys

import httpx
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv("apps/api/.env")

API = "https://site-secure-api-staging.onrender.com"
SUP = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
WS = "637dac16-d083-4b6d-9faa-37b470c0a3ed"
TECH = "extbeta.tech.6f789dd7@sitesecure.test"
PW = "ExtBeta-6f789dd7-Qa2026!"

FIELD = [
    "dashboard.view",
    "calendar.view",
    "calendar.edit",
    "settings.view",
    "crm.view",
    "projects.view",
    "jobs.view",
    "jobs.start",
    "jobs.complete",
    "service.view",
    "service.create",
    "service.edit",
    "service.close",
    "sites.view",
    "sites.edit",
    "systems.view",
    "systems.edit",
    "documents.view",
    "documents.upload",
    "warranties.view",
    "warranties.issue",
    "knowledge.view",
]


def main() -> int:
    svc = {
        "apikey": SERVICE,
        "Authorization": f"Bearer {SERVICE}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    with httpx.Client(timeout=90) as c:
        row = c.get(
            f"{SUP}/rest/v1/workspace_roles",
            headers=svc,
            params={"workspace_id": f"eq.{WS}", "key": "eq.technician", "select": "id,grants"},
        ).json()[0]
        rid = row["id"]
        # force empty → API must rehydrate from image catalog on session/resolve
        c.patch(
            f"{SUP}/rest/v1/workspace_roles",
            headers=svc,
            params={"id": f"eq.{rid}"},
            json={"grants": []},
        )
        tok = c.post(
            f"{SUP}/auth/v1/token?grant_type=password",
            headers={"apikey": ANON, "Content-Type": "application/json"},
            json={"email": TECH, "password": PW},
        ).json()["access_token"]
        sess = c.get(f"{API}/api/v1/auth/session", headers={"Authorization": f"Bearer {tok}"}).json()
        mem = next(m for m in sess["memberships"] if m["workspace_id"] == WS)
        perms = set(mem.get("permissions") or [])
        # restore immediately
        c.patch(
            f"{SUP}/rest/v1/workspace_roles",
            headers=svc,
            params={"id": f"eq.{rid}"},
            json={"grants": FIELD},
        )
        has_q = "quotes.view" in perms
        has_c = "catalog.view" in perms
        has_jobs = "jobs.view" in perms
        # After empty-grants resolve, image may have patched DB; re-read
        after = c.get(
            f"{SUP}/rest/v1/workspace_roles",
            headers=svc,
            params={"id": f"eq.{rid}", "select": "grants"},
        ).json()[0]["grants"]
        report = {
            "rehydrated_quotes_view": has_q,
            "rehydrated_catalog_view": has_c,
            "rehydrated_jobs_view": has_jobs,
            "image_looks_like_016_catalog": (not has_q) and (not has_c) and has_jobs,
            "db_grants_restored_or_patched": sorted(after) if isinstance(after, list) else after,
        }
        print(json.dumps(report, indent=2))
        return 0 if report["image_looks_like_016_catalog"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
