"""Concise Gate 09 closeout smoke for 0.1.4-beta candidate."""
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

API = os.environ.get("API_URL", "http://127.0.0.1:8010").rstrip("/")
SUP = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
TOKEN_PATH = Path(__file__).resolve().parent / ".tmp_import_token"
AUTH_REPORT = Path(__file__).resolve().parent / "_auth_live_verification" / "report_latest.json"

OUT = Path(__file__).resolve().parent / "_beta_014_closeout_smoke"
OUT.mkdir(parents=True, exist_ok=True)

report: dict = {"api": API, "checks": [], "ok": True}


def check(name: str, ok: bool, **extra):
    row = {"name": name, "ok": ok, **extra}
    report["checks"].append(row)
    if not ok:
        report["ok"] = False
    print(("PASS" if ok else "FAIL"), name, extra or "")


def login_password(email: str, password: str) -> str | None:
    r = httpx.post(
        f"{SUP}/auth/v1/token?grant_type=password",
        headers={"apikey": ANON, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=45,
    )
    if r.status_code != 200:
        return None
    return r.json().get("access_token")


def main() -> int:
    # Ensure owner token
    if not TOKEN_PATH.exists():
        print("missing owner token; run get_owner_token.py first", file=sys.stderr)
        return 2
    owner = TOKEN_PATH.read_text(encoding="utf-8").strip()

    c = httpx.Client(timeout=60)
    # Health
    h = c.get(f"{API}/api/v1/health")
    check("api_health", h.status_code == 200, status=h.status_code)

    # Owner session + flows
    oh = {"Authorization": f"Bearer {owner}"}
    sess = c.get(f"{API}/api/v1/auth/session", headers=oh)
    check("owner_session", sess.status_code == 200, status=sess.status_code)
    body = sess.json() if sess.status_code == 200 else {}
    ws = (body.get("memberships") or [{}])[0].get("workspace_id")
    role = (body.get("memberships") or [{}])[0].get("role_key")
    check("owner_role", role == "owner", role=role, workspace=ws)
    if not ws:
        report["ok"] = False
        (OUT / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        return 1

    dash = c.get(f"{API}/api/v1/workspaces/{ws}/dashboard", headers=oh)
    check("owner_dashboard", dash.status_code == 200, ms_hint="see elapsed", status=dash.status_code)
    dbody = dash.json() if dash.status_code == 200 else {}
    pulse_ok = isinstance(dbody.get("summary"), dict) and (
        dbody.get("business_chart") is None or isinstance(dbody.get("business_chart"), dict)
    )
    check("commercial_pulse_payload", pulse_ok, has_summary=bool(dbody.get("summary")), has_chart=dbody.get("business_chart") is not None)

    custs = c.get(f"{API}/api/v1/workspaces/{ws}/customers", headers=oh, params={"limit": 5})
    check("owner_customers", custs.status_code == 200, status=custs.status_code)
    items = (custs.json() or {}).get("items") or []
    customer_id = items[0]["id"] if items else None
    check("owner_customer_present", bool(customer_id), count=len(items))

    sites = c.get(f"{API}/api/v1/workspaces/{ws}/sites", headers=oh, params={"limit": 5})
    check("owner_sites", sites.status_code == 200, status=sites.status_code)
    site_items = (sites.json() or {}).get("items") or []
    site_id = site_items[0]["id"] if site_items else None
    if site_id:
        site = c.get(f"{API}/api/v1/workspaces/{ws}/sites/{site_id}", headers=oh)
        check("owner_site_detail", site.status_code == 200, status=site.status_code)
        docs = c.get(f"{API}/api/v1/workspaces/{ws}/documents", headers=oh, params={"site_id": site_id, "limit": 5})
        check("owner_documents_list", docs.status_code == 200, status=docs.status_code)
    else:
        check("owner_site_detail", False, reason="no_sites")

    quotes = c.get(f"{API}/api/v1/workspaces/{ws}/quotes", headers=oh, params={"limit": 5})
    check("owner_quotes", quotes.status_code == 200, status=quotes.status_code)
    qitems = (quotes.json() or {}).get("items") or []
    if qitems:
        qid = qitems[0]["id"]
        q = c.get(f"{API}/api/v1/workspaces/{ws}/quotes/{qid}", headers=oh)
        check("owner_quote_open", q.status_code == 200, status=q.status_code)
    else:
        check("owner_quote_open", False, reason="no_quotes")

    # CCTV / build system entry points
    cctv = c.post(
        f"{API}/api/v1/workspaces/{ws}/cctv/recommend",
        headers=oh,
        json={"camera_count": 4},
    )
    check("owner_cctv_recommend", cctv.status_code == 200, status=cctv.status_code)

    cat = c.get(f"{API}/api/v1/workspaces/{ws}/catalog/products", headers=oh, params={"limit": 1})
    check("owner_catalog", cat.status_code == 200, status=cat.status_code)

    # Technician from last auth live report if available
    tech_tok = None
    tech_ws = None
    if AUTH_REPORT.exists():
        auth = json.loads(AUTH_REPORT.read_text(encoding="utf-8"))
        run = auth.get("run_id")
        tech_ws = (auth.get("workspaces") or {}).get("a")
        email = f"authlive.tech.a.{run}@sitesecure.test"
        pw = f"AuthLive-{run}-Qa!"
        tech_tok = login_password(email, pw)
        check("tech_login", bool(tech_tok), email=email)
    else:
        check("tech_login", False, reason="no_auth_live_report")

    if tech_tok:
        th = {"Authorization": f"Bearer {tech_tok}"}
        ts = c.get(f"{API}/api/v1/auth/session", headers=th)
        check("tech_session", ts.status_code == 200, status=ts.status_code)
        tbody = ts.json() if ts.status_code == 200 else {}
        tmem = (tbody.get("memberships") or [{}])[0]
        check("tech_role", tmem.get("role_key") == "technician", role=tmem.get("role_key"))
        tws = tech_ws or tmem.get("workspace_id")
        if tws:
            # Today / jobs (field home data)
            jobs = c.get(f"{API}/api/v1/workspaces/{tws}/jobs", headers=th, params={"limit": 20})
            check("tech_jobs", jobs.status_code == 200, status=jobs.status_code)
            sites_t = c.get(f"{API}/api/v1/workspaces/{tws}/sites", headers=th, params={"limit": 20})
            check("tech_sites", sites_t.status_code == 200, status=sites_t.status_code)
            # Denied commercial
            for path, name in (
                (f"/api/v1/workspaces/{tws}/quotes", "tech_quotes_denied"),
                (f"/api/v1/workspaces/{tws}/catalog/products", "tech_catalog_denied"),
                (f"/api/v1/workspaces/{tws}/roles", "tech_roles_denied"),
            ):
                r = c.get(f"{API}{path}", headers=th, params={"limit": 1})
                # Prefer 403; empty 200 with zero items also documented historically for some lists
                denied = r.status_code in {401, 403} or (
                    r.status_code == 200 and not ((r.json() or {}).get("items") or [])
                )
                check(name, denied, status=r.status_code)

            # Security center style
            sec = c.get(f"{API}/api/v1/workspaces/{tws}/security", headers=th)
            check(
                "tech_security_denied",
                sec.status_code in {401, 403, 404},
                status=sec.status_code,
            )

    # APP_VERSION constant in source
    ver = (ROOT / "apps/web/src/lib/app-version.ts").read_text(encoding="utf-8")
    check("app_version_constant", 'APP_VERSION = "0.1.4-beta"' in ver)

    (OUT / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print("REPORT", OUT / "report.json")
    print("VERDICT", "PASS" if report["ok"] else "FAIL")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
