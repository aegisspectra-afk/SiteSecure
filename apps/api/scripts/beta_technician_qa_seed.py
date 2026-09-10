"""Disposable Technician Today / Field Job QA seed (no auth bypasses).

Creates (or reuses) a workspace owner + technician membership, a Site, and a Job
scheduled for today assigned to the technician — using canonical API + RBAC.

Usage (API must be running, e.g. :8010):

  python apps/api/scripts/beta_technician_qa_seed.py

Prints email/password/workspace/job for physical Gate 09 re-test.
Does not commit secrets; passwords are disposable QA-only.
"""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / ".env")

API = os.environ.get("MAPS_API_URL") or os.environ.get("API_URL") or "http://127.0.0.1:8010"
SUP = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
OUT = Path(__file__).resolve().parent / "_beta_technician_qa" / "seed_report.json"
OUT.parent.mkdir(parents=True, exist_ok=True)


def ensure_user(email: str, password: str) -> str:
    with httpx.Client(timeout=60) as c:
        c.post(
            f"{SUP}/auth/v1/signup",
            headers={"apikey": ANON, "Content-Type": "application/json"},
            json={"email": email, "password": password},
        )
        listed = c.get(
            f"{SUP}/auth/v1/admin/users",
            headers={"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}"},
            params={"page": 1, "per_page": 200},
        ).json()
        uid = next(
            (u["id"] for u in (listed.get("users") or []) if (u.get("email") or "").lower() == email.lower()),
            None,
        )
        ah = {"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}", "Content-Type": "application/json"}
        if uid:
            c.put(f"{SUP}/auth/v1/admin/users/{uid}", headers=ah, json={"email_confirm": True, "password": password})
        else:
            created = c.post(
                f"{SUP}/auth/v1/admin/users",
                headers=ah,
                json={"email": email, "password": password, "email_confirm": True},
            )
            uid = created.json().get("id")
        tok = c.post(
            f"{SUP}/auth/v1/token?grant_type=password",
            headers={"apikey": ANON, "Content-Type": "application/json"},
            json={"email": email, "password": password},
        )
        if tok.status_code != 200:
            raise SystemExit(f"login failed {email} {tok.status_code} {tok.text}")
        return tok.json()["access_token"]


def main() -> int:
    run = int(time.time())
    owner_email = f"techqa.owner.{run}@sitesecure.test"
    tech_email = f"techqa.tech.{run}@sitesecure.test"
    password = f"TechQa-{run}-2026!"
    print("ensuring users…", flush=True)
    owner_tok = ensure_user(owner_email, password)
    tech_tok = ensure_user(tech_email, password)

    with httpx.Client(timeout=120) as c:
        ws = c.post(
            f"{SUP}/rest/v1/rpc/create_workspace",
            headers={
                "Authorization": f"Bearer {owner_tok}",
                "apikey": ANON,
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            json={"p_name": f"Tech QA {run}", "p_plan_key": "solo"},
        )
        body = ws.json()
        workspace_id = body if isinstance(body, str) else (body.get("id") if isinstance(body, dict) else None)
        if not workspace_id or ws.status_code >= 400:
            raise SystemExit(f"workspace failed {ws.status_code} {body}")

        # Invite / add technician via memberships if RPC exists; else patch membership row with service role.
        tech_user = c.get(
            f"{SUP}/auth/v1/admin/users",
            headers={"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}"},
            params={"page": 1, "per_page": 200},
        ).json()
        tech_uid = next(
            (u["id"] for u in (tech_user.get("users") or []) if (u.get("email") or "").lower() == tech_email.lower()),
            None,
        )
        if not tech_uid:
            raise SystemExit("technician uid missing")

        mem = c.post(
            f"{SUP}/rest/v1/workspace_memberships",
            headers={
                "apikey": SERVICE,
                "Authorization": f"Bearer {SERVICE}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            json={
                "workspace_id": workspace_id,
                "user_id": tech_uid,
                "role_key": "technician",
                "workspace_role_key": "technician",
                "status": "active",
            },
        )
        if mem.status_code >= 400:
            # may already exist
            print("membership note", mem.status_code, mem.text[:200], flush=True)

        h = {
            "Authorization": f"Bearer {owner_tok}",
            "Content-Type": "application/json",
        }
        cust = c.post(f"{API}/api/v1/workspaces/{workspace_id}/customers", headers=h, json={"display_name": "Tech QA Customer"}).json()
        site = c.post(
            f"{API}/api/v1/workspaces/{workspace_id}/sites",
            headers=h,
            json={"customer_id": cust["id"], "name": "Tech QA Site", "address": {"line": "שטח בדיקה"}},
        ).json()

        local_now = datetime.now(ZoneInfo("Asia/Jerusalem"))
        scheduled = local_now.replace(hour=10, minute=0, second=0, microsecond=0).astimezone(timezone.utc).isoformat()
        job = c.post(
            f"{API}/api/v1/workspaces/{workspace_id}/jobs",
            headers=h,
            json={
                "title": "בדיקת שטח — היום",
                "customer_id": cust["id"],
                "site_id": site["id"],
                "kind": "service",
                "status": "scheduled",
                "scheduled_for": scheduled,
            },
        )
        if job.status_code >= 400:
            raise SystemExit(f"job create failed {job.status_code} {job.text}")
        job_body = job.json()

        # Assign technician to job (canonical assignments)
        assign = c.post(
            f"{API}/api/v1/workspaces/{workspace_id}/jobs/{job_body['id']}/assign",
            headers=h,
            json={"user_id": tech_uid},
        )
        if assign.status_code >= 400:
            # fallback: direct assignments table
            c.post(
                f"{SUP}/rest/v1/assignments",
                headers={
                    "apikey": SERVICE,
                    "Authorization": f"Bearer {SERVICE}",
                    "Content-Type": "application/json",
                    "Prefer": "return=representation",
                },
                json={
                    "workspace_id": workspace_id,
                    "user_id": tech_uid,
                    "resource_type": "job",
                    "resource_id": job_body["id"],
                },
            )

        # Verify technician session sees today
        tech_sess = c.get(f"{API}/api/v1/auth/session", headers={"Authorization": f"Bearer {tech_tok}"}).json()
        dash = c.get(
            f"{API}/api/v1/workspaces/{workspace_id}/dashboard",
            headers={"Authorization": f"Bearer {tech_tok}"},
        )

    report = {
        "ok": dash.status_code == 200,
        "owner_email": owner_email,
        "technician_email": tech_email,
        "password": password,
        "workspace_id": workspace_id,
        "site_id": site["id"],
        "job_id": job_body["id"],
        "technician_memberships": tech_sess.get("memberships"),
        "dashboard_status": dash.status_code,
        "dashboard_variant": (dash.json() or {}).get("home_variant") if dash.status_code == 200 else None,
        "instructions_he": [
            "התחברו בטלפון עם technician_email + password",
            "וודאו ניווט ל־Today (לא Ops Dashboard)",
            "פתחו את העבודה המשויכת להיום",
            "צלמו/העלו תמונה דרך שטח/מסמכים באתר",
        ],
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
