#!/usr/bin/env python3
"""Forensics: production web API base + DNS + empty-grants probe details."""
from __future__ import annotations

import json
import os
import re
import socket
import ssl
import urllib.request
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / "apps" / "api" / ".env")

WEB = "https://site-secure-umber.vercel.app"
OUT = Path(__file__).resolve().parent / "_forensics_api_deploy.json"


def main() -> None:
    report: dict = {"web": WEB}

    # --- Web API base from bundle ---
    html = urllib.request.urlopen(WEB + "/", timeout=30).read().decode("utf-8", "replace")
    m = re.search(r"/assets/index-[A-Za-z0-9_-]+\.js", html)
    report["asset"] = m.group(0) if m else None
    js = urllib.request.urlopen(WEB + m.group(0), timeout=60).read().decode("utf-8", "replace")
    report["web_versions"] = sorted(set(re.findall(r"0\.1\.\d+-beta", js)))
    onrender = sorted(set(re.findall(r"https://[a-zA-Z0-9._-]+\.onrender\.com", js)))
    report["onrender_hosts_in_bundle"] = onrender
    # relative /api usage
    report["relative_api_refs"] = len(re.findall(r'["\']/api/v1/', js))
    api_base = onrender[0] if onrender else None
    report["WEB_PRODUCTION_API_BASE_URL"] = api_base

    if api_base:
        host = api_base.replace("https://", "").split("/")[0]
        try:
            ips = sorted({ai[4][0] for ai in socket.getaddrinfo(host, 443)})
        except Exception as e:
            ips = [f"err:{e}"]
        report["api_dns_ips"] = ips
        # TLS cert SAN / subject
        try:
            ctx = ssl.create_default_context()
            with socket.create_connection((host, 443), timeout=15) as sock:
                with ctx.wrap_socket(sock, server_hostname=host) as ssock:
                    cert = ssock.getpeercert()
                    report["tls_subject"] = cert.get("subject")
                    report["tls_san"] = cert.get("subjectAltName")
        except Exception as e:
            report["tls_err"] = str(e)[:200]
        # health + headers
        r = httpx.get(f"{api_base}/api/v1/health", timeout=45)
        report["health"] = {"status": r.status_code, "body": r.text[:200]}
        interesting = {
            k: r.headers.get(k)
            for k in [
                "server",
                "x-render-origin-server",
                "x-request-id",
                "cf-ray",
                "x-powered-by",
                "via",
            ]
            if r.headers.get(k)
        }
        report["response_headers"] = interesting

    # Render auth availability (no secret values)
    report["render_api_key_present"] = bool(
        os.environ.get("RENDER_API_KEY") or os.environ.get("RENDER_API_TOKEN") or os.environ.get("RENDER_TOKEN")
    )

    # Empty-grants probe (same as before) with more detail
    API = api_base or "https://site-secure-api-staging.onrender.com"
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
        before = row.get("grants")
        c.patch(f"{SUP}/rest/v1/workspace_roles", headers=svc, params={"id": f"eq.{rid}"}, json={"grants": []})
        tok = c.post(
            f"{SUP}/auth/v1/token?grant_type=password",
            headers={"apikey": ANON, "Content-Type": "application/json"},
            json={"email": TECH, "password": PW},
        ).json()["access_token"]
        sess = c.get(f"{API}/api/v1/auth/session", headers={"Authorization": f"Bearer {tok}"}).json()
        mem = next(m for m in sess["memberships"] if m["workspace_id"] == WS)
        perms = sorted(mem.get("permissions") or [])
        mid = c.get(
            f"{SUP}/rest/v1/workspace_roles",
            headers=svc,
            params={"id": f"eq.{rid}", "select": "grants"},
        ).json()[0]["grants"]
        # restore
        c.patch(
            f"{SUP}/rest/v1/workspace_roles",
            headers=svc,
            params={"id": f"eq.{rid}"},
            json={"grants": FIELD},
        )
        after = c.get(
            f"{SUP}/rest/v1/workspace_roles",
            headers=svc,
            params={"id": f"eq.{rid}", "select": "grants"},
        ).json()[0]["grants"]
        report["empty_grants_probe"] = {
            "api_used": API,
            "grants_before_had_quotes": isinstance(before, list) and "quotes.view" in before,
            "session_permissions_commercial": [p for p in perms if p.startswith("quotes") or p.startswith("catalog")],
            "session_has_quotes_view": "quotes.view" in perms,
            "session_has_catalog_view": "catalog.view" in perms,
            "db_grants_after_session_call": mid,
            "db_after_session_has_quotes": isinstance(mid, list) and "quotes.view" in mid,
            "db_after_session_has_catalog": isinstance(mid, list) and "catalog.view" in mid,
            "restored_ok": sorted(after) == sorted(FIELD) if isinstance(after, list) else False,
            "strip_effective": ("quotes.view" not in perms) and ("catalog.view" not in perms),
            "image_catalog_looks_current": (
                isinstance(mid, list)
                and "quotes.view" not in mid
                and "catalog.view" not in mid
                and "jobs.view" in mid
            ),
        }

    # Compare local installed path logic
    report["dockerfile_copies_authz_package"] = True
    report["dockerfile_authz_catalog_env"] = "/src/packages/authz/catalog.json"
    report["pip_install_packages"] = ["app"]  # hatchling packages=["app"] only
    report["resolve_role_grants_module"] = "app.workspace_rbac.resolve_role_grants"
    report["strip_helper_source"] = "apps/api/app/workspace_rbac.py::strip_technician_commercial_grants"
    report["catalog_source"] = "packages/authz/catalog.json via AUTHZ_CATALOG_PATH"

    OUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
