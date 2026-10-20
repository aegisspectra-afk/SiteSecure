#!/usr/bin/env python3
"""Safe local bootstrap: assign patrol_manager to an existing Auth user by email.

Does NOT create Auth users, change passwords, or invent IDs.
Requires: migration applied locally, SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY,
and an active workspace membership for the user.

Usage (from apps/api, with env loaded):
  python scripts/bootstrap_ssp_patrol_manager.py \\
    --email ilya.kerner@g1-group.com \\
    --workspace-id <uuid> \\
    --company-name "G1 Group"

If the email is not found, exits non-zero with instructions (no fabricated assignment).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.ssp.company_ids import new_company_id  # noqa: E402
from app.supabase_service import ServiceClient  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument("--workspace-id", required=True)
    parser.add_argument("--company-name", default="G1 Group")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    email = args.email.strip().lower()
    workspace_id = args.workspace_id.strip()

    settings = get_settings()
    if not settings.supabase_service_role_key:
        print("ERROR: SUPABASE_SERVICE_ROLE_KEY not configured (server-side only).")
        return 2

    svc = ServiceClient(settings)
    profiles = svc.get(
        "profiles",
        params={"email": f"eq.{email}", "select": "id,email,full_name,archived_at", "limit": "1"},
    )
    rows = profiles.json() if profiles.status_code == 200 else []
    if not rows:
        print(f"NOT FOUND: no profiles row for email={email}")
        print("Do not invent a user_id. Invite/create the Auth user via existing Platform flows,")
        print("ensure they have an active workspace_membership, then re-run this script.")
        return 1
    user = rows[0]
    if user.get("archived_at"):
        print(f"ERROR: profile archived for {email}")
        return 1
    user_id = user["id"]
    print(f"Found profile id={user_id} email={user.get('email')}")

    wm = svc.get(
        "workspace_memberships",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "user_id": f"eq.{user_id}",
            "status": "eq.active",
            "select": "role_key,status",
            "limit": "1",
        },
    )
    if wm.status_code != 200 or not (wm.json() or []):
        print(f"ERROR: user is not an active member of workspace {workspace_id}")
        print("Add membership via existing team/invite APIs first. role_key will not be changed by this script.")
        return 1
    print(f"Workspace membership OK role_key={wm.json()[0].get('role_key')} (unchanged)")

    companies = svc.get(
        "ssp_companies",
        params={"workspace_id": f"eq.{workspace_id}", "select": "*", "limit": "1"},
    )
    company_rows = companies.json() if companies.status_code == 200 else []
    if not company_rows:
        if args.dry_run:
            print("DRY-RUN: would create ssp_companies + root unit + patrol department")
            return 0
        company_id = new_company_id()
        cres = svc.post(
            "ssp_companies",
            json={
                "workspace_id": workspace_id,
                "company_id": company_id,
                "name": args.company_name,
                "created_by": user_id,
            },
        )
        if cres.status_code not in {200, 201}:
            print(f"ERROR creating company: {cres.status_code} {cres.text[:300]}")
            return 1
        company = cres.json()[0] if isinstance(cres.json(), list) else cres.json()
        ures = svc.post(
            "ssp_org_units",
            json={
                "workspace_id": workspace_id,
                "company_pk": company["id"],
                "name": "מטה",
                "unit_type": "root",
            },
        )
        unit = ures.json()[0] if isinstance(ures.json(), list) else ures.json()
        dres = svc.post(
            "ssp_departments",
            json={
                "workspace_id": workspace_id,
                "company_pk": company["id"],
                "org_unit_id": unit["id"],
                "key": "patrol",
                "name_he": "סיור",
                "name_en": "Patrol",
            },
        )
        dept = dres.json()[0] if isinstance(dres.json(), list) else dres.json()
        print(f"Created company_id={company['company_id']} patrol_department={dept['id']}")
    else:
        company = company_rows[0]
        depts = svc.get(
            "ssp_departments",
            params={
                "workspace_id": f"eq.{workspace_id}",
                "company_pk": f"eq.{company['id']}",
                "key": "eq.patrol",
                "select": "*",
                "limit": "1",
            },
        )
        dept_rows = depts.json() if depts.status_code == 200 else []
        if not dept_rows:
            print("ERROR: company exists but patrol department missing — create via API org UI")
            return 1
        dept = dept_rows[0]
        print(f"Using company_id={company['company_id']} patrol_department={dept['id']}")

    if args.dry_run:
        print(f"DRY-RUN: would upsert ssp_memberships product_role=patrol_manager for {email}")
        return 0

    existing = svc.get(
        "ssp_memberships",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "company_pk": f"eq.{company['id']}",
            "user_id": f"eq.{user_id}",
            "select": "id",
            "limit": "1",
        },
    )
    payload = {
        "workspace_id": workspace_id,
        "company_pk": company["id"],
        "user_id": user_id,
        "org_unit_id": dept["org_unit_id"],
        "department_id": dept["id"],
        "product_role": "patrol_manager",
        "status": "active",
        "created_by": user_id,
    }
    erows = existing.json() if existing.status_code == 200 else []
    if erows:
        svc.patch(
            "ssp_memberships",
            params={"id": f"eq.{erows[0]['id']}"},
            json={
                "org_unit_id": dept["org_unit_id"],
                "department_id": dept["id"],
                "product_role": "patrol_manager",
                "status": "active",
            },
        )
        print(f"Updated membership id={erows[0]['id']} → patrol_manager")
    else:
        res = svc.post("ssp_memberships", json=payload)
        if res.status_code not in {200, 201}:
            print(f"ERROR assigning membership: {res.status_code} {res.text[:400]}")
            print("Hint: apply migration 20261019220000_ssp_organization_core.sql locally first.")
            return 1
        print("Assigned product_role=patrol_manager (workspace role_key unchanged)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
